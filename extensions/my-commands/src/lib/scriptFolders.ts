import { Dirent } from "node:fs";
import { open as openFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

// Raycast keeps the folders it loads script commands from in an encrypted
// database, so the only way to find them is to look for the files themselves.
const MARKER = "@raycast.schemaVersion";
const MAX_DEPTH = 5;
const PEEK_BYTES = 2048;
const WORKERS = 16;

const SCRIPT_EXTENSIONS =
  /\.(sh|bash|zsh|py|js|mjs|rb|swift|applescript|php|pl)$/;

const SKIP = new Set([
  "Library",
  "Applications",
  "Movies",
  "Music",
  "Pictures",
  "node_modules",
  ".git",
  ".Trash",
  ".npm",
  ".cache",
  ".nvm",
  ".cargo",
  ".rustup",
  ".gradle",
  ".m2",
  ".docker",
  ".pyenv",
  ".venv",
  "venv",
  "__pycache__",
  "dist",
  "build",
  ".next",
  "vendor",
  "target",
  "Pods",
  "DerivedData",
]);

export function expandHome(path: string): string {
  if (path === "~" || path.startsWith("~/")) {
    return join(homedir(), path.slice(1));
  }
  return resolve(path);
}

export function tildePath(path: string): string {
  const home = homedir();
  return path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

export function parseFolders(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map(expandHome);
}

async function hasMarker(path: string): Promise<boolean> {
  let handle;
  try {
    handle = await openFile(path, "r");
    const buffer = Buffer.alloc(PEEK_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, PEEK_BYTES, 0);
    return buffer.toString("utf8", 0, bytesRead).includes(MARKER);
  } catch {
    return false;
  } finally {
    await handle?.close();
  }
}

async function isScriptCommand(dir: string, entry: Dirent): Promise<boolean> {
  if (!SCRIPT_EXTENSIONS.test(entry.name)) {
    return false;
  }
  const path = join(dir, entry.name);
  const isFile =
    entry.isFile() ||
    (entry.isSymbolicLink() &&
      (await stat(path)
        .then((info) => info.isFile())
        .catch(() => false)));
  return isFile && hasMarker(path);
}

/** Folders under the home folder holding at least one Raycast script command. */
export async function findScriptFolders(): Promise<string[]> {
  const found: string[] = [];
  // A shared stack of folders drained by a fixed number of workers. Walking the
  // whole tree at once holds every pending folder in memory, which is more than
  // Raycast's worker heap allows.
  const pending: { dir: string; depth: number }[] = [
    { dir: homedir(), depth: 0 },
  ];
  let busy = 0;
  let wake: (() => void)[] = [];

  function notify() {
    const waiting = wake;
    wake = [];
    waiting.forEach((resume) => resume());
  }

  async function visit(dir: string, depth: number) {
    const entries = await readdir(dir, { withFileTypes: true }).catch(
      () => [] as Dirent[],
    );
    for (const entry of entries) {
      // Symlinked directories are not followed, so a link back up cannot loop.
      if (entry.isDirectory() && depth < MAX_DEPTH && !SKIP.has(entry.name)) {
        pending.push({ dir: join(dir, entry.name), depth: depth + 1 });
      }
    }
    notify();
    for (const entry of entries) {
      if (await isScriptCommand(dir, entry)) {
        found.push(dir);
        return;
      }
    }
  }

  async function worker() {
    for (;;) {
      const next = pending.pop();
      if (next === undefined) {
        if (busy === 0) {
          return;
        }
        await new Promise<void>((resume) => wake.push(resume));
        continue;
      }
      busy++;
      try {
        await visit(next.dir, next.depth);
      } finally {
        busy--;
        notify();
      }
    }
  }

  await Promise.all(Array.from({ length: WORKERS }, worker));
  return found.sort();
}
