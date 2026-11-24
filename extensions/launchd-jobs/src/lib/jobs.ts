import { open, readdir, stat } from "node:fs/promises";
import { homedir, userInfo } from "node:os";
import { basename, join } from "node:path";
import { exec } from "./exec";
import { describeSchedule, Triggers } from "./schedule";

export const AGENTS_DIR = join(homedir(), "Library", "LaunchAgents");

interface Plist extends Triggers {
  Label?: string;
  Program?: string;
  ProgramArguments?: string[];
  WorkingDirectory?: string;
  StandardOutPath?: string;
  StandardErrorPath?: string;
}

export interface JobName {
  group: string;
  name: string;
}

export type JobState = "failed" | "unloaded" | "running" | "idle";

export interface Job {
  label: string;
  plistPath: string;
  command: string;
  workingDirectory?: string;
  schedule: string;
  logPaths: string[];
  loaded: boolean;
  pid?: number;
  lastExit?: number;
  state: JobState;
  logTail: string;
  logUpdated?: Date;
}

interface LoadedJob {
  pid?: number;
  lastExit?: number;
}

const LOG_TAIL_BYTES = 16 * 1024;
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

export const domain = () => `gui/${userInfo().uid}`;

export function parsePrefixes(configured: string): string[] {
  return configured
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

async function loadedJobs(): Promise<Map<string, LoadedJob>> {
  const out = await exec("/bin/launchctl", ["list"]);
  const jobs = new Map<string, LoadedJob>();
  for (const line of out.split("\n").slice(1)) {
    const [pid, status, label] = line.split("\t");
    if (label === undefined) {
      continue;
    }
    jobs.set(label, {
      pid: pid === "-" ? undefined : Number(pid),
      lastExit: status === "-" ? undefined : Number(status),
    });
  }
  return jobs;
}

async function readPlist(path: string): Promise<Plist | undefined> {
  try {
    const json = await exec("/usr/bin/plutil", [
      "-convert",
      "json",
      "-o",
      "-",
      path,
    ]);
    return JSON.parse(json) as Plist;
  } catch {
    return undefined;
  }
}

export async function readLogTail(
  path: string,
  bytes = LOG_TAIL_BYTES,
): Promise<{ text: string; updated?: Date }> {
  try {
    const info = await stat(path);
    const handle = await open(path, "r");
    try {
      const length = Math.min(bytes, info.size);
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, info.size - length);
      const lines = buffer.toString("utf8").replace(ANSI, "").split("\n");
      // A tail that starts mid-file starts mid-line, so drop the partial one.
      const whole = length < info.size ? lines.slice(1) : lines;
      return { text: whole.join("\n").trimEnd(), updated: info.mtime };
    } finally {
      await handle.close();
    }
  } catch {
    return { text: "" };
  }
}

function stateOf(loaded?: LoadedJob): JobState {
  if (loaded === undefined) {
    return "unloaded";
  }
  if (loaded.pid !== undefined) {
    return "running";
  }
  return (loaded.lastExit ?? 0) === 0 ? "idle" : "failed";
}

async function toJob(
  plistPath: string,
  plist: Plist,
  loaded: Map<string, LoadedJob>,
): Promise<Job> {
  const label = plist.Label ?? basename(plistPath, ".plist");
  const live = loaded.get(label);
  const logPaths = [
    ...new Set(
      [plist.StandardOutPath, plist.StandardErrorPath].filter(
        (p): p is string => p !== undefined,
      ),
    ),
  ];
  const log =
    logPaths.length > 0 ? await readLogTail(logPaths[0], 4096) : { text: "" };
  const args = plist.ProgramArguments ?? (plist.Program ? [plist.Program] : []);
  return {
    label,
    plistPath,
    command: args.join(" "),
    workingDirectory: plist.WorkingDirectory,
    schedule: describeSchedule(plist),
    logPaths,
    loaded: live !== undefined,
    pid: live?.pid,
    lastExit: live?.lastExit,
    state: stateOf(live),
    logTail: log.text,
    logUpdated: log.updated,
  };
}

export async function listJobs(prefixes: string[]): Promise<Job[]> {
  const [files, loaded] = await Promise.all([
    readdir(AGENTS_DIR),
    loadedJobs(),
  ]);
  const jobs = await Promise.all(
    files
      .filter((f) => f.endsWith(".plist"))
      .map(async (f) => {
        const path = join(AGENTS_DIR, f);
        const plist = await readPlist(path);
        return plist ? toJob(path, plist, loaded) : undefined;
      }),
  );
  return jobs
    .filter((job): job is Job => job !== undefined)
    .filter(
      (job) =>
        prefixes.length === 0 || prefixes.some((p) => job.label.startsWith(p)),
    )
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function shortName(label: string, prefixes: string[]): string {
  const prefix = prefixes.find((p) => label.startsWith(p) && label !== p);
  return prefix ? label.slice(prefix.length).replace(/^[.-]/, "") : label;
}

export function groupOf(label: string, prefixes: string[]): JobName {
  const short = shortName(label, prefixes);
  if (short !== label) {
    const [group, ...rest] = short.split(".");
    return { group, name: rest.length > 0 ? rest.join(".") : short };
  }
  const owner = label.split(".").slice(0, 2).join(".");
  return { group: owner, name: label.slice(owner.length + 1) || label };
}

export function exitDescription(code: number): string {
  if (code < 0) {
    return `killed by signal ${-code}`;
  }
  return `exit ${code}`;
}

export async function runNow(job: Job): Promise<void> {
  await exec("/bin/launchctl", ["kickstart", `${domain()}/${job.label}`]);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function reload(job: Job): Promise<void> {
  if (job.loaded) {
    await exec("/bin/launchctl", ["bootout", domain(), job.plistPath]);
  }
  // bootout returns before launchd has let go, so an immediate bootstrap fails with EIO.
  let lastError: unknown;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await exec("/bin/launchctl", ["bootstrap", domain(), job.plistPath]);
      return;
    } catch (error) {
      lastError = error;
      await sleep(300);
    }
  }
  throw lastError;
}
