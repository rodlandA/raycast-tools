import { basename, dirname } from "node:path";
import { exec } from "./exec";

const BACKEND_HTTPS_PORT = 5234;
const FRONTEND_DIR = "Frontend";
const BACKEND_DIR = "Backend";

export interface DevServerSnapshot {
  /** Worktree path to the port its dev server is serving. */
  frontendPorts: Map<string, number>;
  /** Worktree path owning the backend HTTPS port, if anything holds it. */
  backendWorktree?: string;
  /** Worktrees whose port is a backend serving the app itself over plain HTTP. */
  selfServing: Set<string>;
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
  return addresses
    .map((address) => Number(address.split(":").pop()))
    .filter((port) => Number.isInteger(port));
}

function record(snapshot: DevServerSnapshot, cwd: string, ports: number[]) {
  if (ports.length === 0) {
    return;
  }
  if (basename(cwd) === FRONTEND_DIR) {
    const worktree = dirname(cwd);
    const known = snapshot.frontendPorts.get(worktree) ?? Infinity;
    snapshot.frontendPorts.set(worktree, Math.min(known, ...ports));
  }
  if (basename(cwd) === BACKEND_DIR && ports.includes(BACKEND_HTTPS_PORT)) {
    snapshot.backendWorktree = dirname(cwd);
  }
}

// A backend started with --port binds one HTTP port and serves the built app on it.
function recordSelfServing(
  snapshot: DevServerSnapshot,
  cwd: string,
  ports: number[],
) {
  const worktree = dirname(cwd);
  const isSinglePort = new Set(ports).size === 1;
  if (
    basename(cwd) === BACKEND_DIR &&
    isSinglePort &&
    !snapshot.frontendPorts.has(worktree)
  ) {
    snapshot.frontendPorts.set(worktree, ports[0]);
    snapshot.selfServing.add(worktree);
  }
}

/** One lsof pass over every listening socket, mapped back to the worktree that owns it. */
export async function inspectDevServers(): Promise<DevServerSnapshot> {
  const snapshot: DevServerSnapshot = {
    frontendPorts: new Map(),
    selfServing: new Set(),
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
    return cwd === undefined ? [] : [{ cwd, ports: portsOf(addresses) }];
  });
  listening.forEach(({ cwd, ports }) => record(snapshot, cwd, ports));
  listening.forEach(({ cwd, ports }) =>
    recordSelfServing(snapshot, cwd, ports),
  );
  return snapshot;
}
