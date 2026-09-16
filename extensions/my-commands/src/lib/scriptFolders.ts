import { open as openFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

// Raycast keeps the folders it loads script commands from in an encrypted
// database, so the only way to find them is to look for the files themselves.
const MARKER = "@raycast.schemaVersion";
const MAX_DEPTH = 5;
const PEEK_BYTES = 2048;
const CONCURRENCY = 64;

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

// Keeps tens of thousands of file peeks from exhausting file descriptors.
function limiter(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= max) {
      await new Promise<void>((release) => waiting.push(release));
    }
    active++;
    try {
      return await task();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
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

/** Folders under the home folder holding at least one Raycast script command. */
export async function findScriptFolders(): Promise<string[]> {
  const limit = limiter(CONCURRENCY);
  const found = new Set<string>();

  async function walk(dir: string, depth: number): Promise<void> {
    const entries = await limit(() =>
      readdir(dir, { withFileTypes: true }).catch(() => []),
    );
    await Promise.all(
      entries.map(async (entry) => {
        const path = join(dir, entry.name);
        // Symlinked directories are not followed, so a link back up cannot loop.
        if (entry.isDirectory()) {
          if (depth < MAX_DEPTH && !SKIP.has(entry.name)) {
            await walk(path, depth + 1);
          }
          return;
        }
        if (!SCRIPT_EXTENSIONS.test(entry.name) || found.has(dir)) {
          return;
        }
        const isFile =
          entry.isFile() ||
          (entry.isSymbolicLink() &&
            (await stat(path)
              .then((s) => s.isFile())
              .catch(() => false)));
        if (isFile && (await limit(() => hasMarker(path)))) {
          found.add(dir);
        }
      }),
    );
  }

  await walk(homedir(), 0);
  return [...found].sort();
}
