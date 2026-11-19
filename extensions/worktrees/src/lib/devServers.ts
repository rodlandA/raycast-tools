import { basename, dirname } from "node:path";
import { exec } from "./exec";

const FRONTEND_DIR = "Frontend";
const BACKEND_DIR = "Backend";
const PROBE_SECONDS = "1";

export type Scheme = "http" | "https";

export interface DevServerSnapshot {
  /** Worktree path to the port its dev server is serving. */
  frontendPorts: Map<string, number>;
  /** Worktree path to the port its backend answers TLS on. */
  backendHttpsPorts: Map<string, number>;
  /** Worktrees whose backend serves the app itself, and over which scheme. */
  selfServing: Map<string, Scheme>;
}

interface Probe {
  tls: boolean;
  servesApp: boolean;
}

// lsof exits non-zero when nothing matches, which is an empty result, not a fault.
async function lsof(args: string[]): Promise<string> {
  try {
    return await exec("lsof", args);
  } catch (error) {
    return (error as { stdout?: string }).stdout ?? "";
  }
}

// -F prints one tagged field per line: "p" opens a process, "n" is a name —
// a socket address for -i, a directory for -d cwd.
function namesByPid(stdout: string): Map<number, string[]> {
  const names = new Map<number, string[]>();
  let pid: number | undefined;
  for (const line of stdout.split("\n")) {
    if (line.startsWith("p")) {
      pid = Number(line.slice(1));
      names.set(pid, []);
    } else if (line.startsWith("n") && pid !== undefined) {
      names.get(pid)?.push(line.slice(1));
    }
  }
  return names;
}

function portsOf(addresses: string[]): number[] {
  const ports = addresses
    .map((address) => Number(address.split(":").pop()))
    .filter((port) => Number.isInteger(port));
  return [...new Set(ports)];
}

// curl reports 000 when no response arrived, which for https means no TLS on that port.
async function request(scheme: Scheme, port: number) {
  try {
    const out = await exec("curl", [
      "-sk",
      "-o",
      "/dev/null",
      "-m",
      PROBE_SECONDS,
      "-w",
      "%{http_code} %{content_type}",
      `${scheme}://127.0.0.1:${port}/`,
    ]);
    return out.trim();
  } catch (error) {
    return ((error as { stdout?: string }).stdout ?? "000").trim();
  }
}

function isApp(response: string): boolean {
  return response.startsWith("200 text/html");
}

async function probe(port: number): Promise<Probe> {
  const https = await request("https", port);
  if (!https.startsWith("000")) {
    return { tls: true, servesApp: isApp(https) };
  }
  return { tls: false, servesApp: isApp(await request("http", port)) };
}

async function recordBackend(
  snapshot: DevServerSnapshot,
  worktree: string,
  ports: number[],
) {
  const probes = await Promise.all(
    ports.map(async (port) => ({ port, ...(await probe(port)) })),
  );
  const tls = probes.find((p) => p.tls);
  if (tls !== undefined) {
    snapshot.backendHttpsPorts.set(worktree, tls.port);
  }
  if (snapshot.frontendPorts.has(worktree)) {
    return;
  }
  const app =
    probes.find((p) => p.servesApp && p.tls) ?? probes.find((p) => p.servesApp);
  if (app !== undefined) {
    snapshot.frontendPorts.set(worktree, app.port);
    snapshot.selfServing.set(worktree, app.tls ? "https" : "http");
  }
}

/** One lsof pass over every listening socket, mapped back to the worktree that owns it. */
export async function inspectDevServers(): Promise<DevServerSnapshot> {
  const snapshot: DevServerSnapshot = {
    frontendPorts: new Map(),
    backendHttpsPorts: new Map(),
    selfServing: new Map(),
  };
  const listeners = namesByPid(
    await lsof(["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpn"]),
  );
  const pids = [...listeners.keys()];
  if (pids.length === 0) {
    return snapshot;
  }

  const cwds = namesByPid(
    await lsof(["-a", "-p", pids.join(","), "-d", "cwd", "-Fpn"]),
  );
  const listening = [...listeners].flatMap(([pid, addresses]) => {
    const cwd = cwds.get(pid)?.[0];
    const ports = portsOf(addresses);
    return cwd === undefined || ports.length === 0 ? [] : [{ cwd, ports }];
  });
  for (const { cwd, ports } of listening) {
    if (basename(cwd) === FRONTEND_DIR) {
      const worktree = dirname(cwd);
      const known = snapshot.frontendPorts.get(worktree) ?? Infinity;
      snapshot.frontendPorts.set(worktree, Math.min(known, ...ports));
    }
  }
  const backends = listening.filter(({ cwd }) => basename(cwd) === BACKEND_DIR);
  for (const { cwd, ports } of backends) {
    await recordBackend(snapshot, dirname(cwd), ports);
  }
  return snapshot;
}
