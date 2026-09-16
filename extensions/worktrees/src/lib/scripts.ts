import { readdir, readFile, realpath } from "node:fs/promises";
import { basename, join } from "node:path";

export interface Runnable {
  id: string;
  title: string;
  subtitle: string;
  cwd: string;
  command: string[];
  section: string;
}

const SHELL_DIRS = [
  { dir: ".", section: "Repository" },
  { dir: "scripts", section: "Scripts" },
];

// A repo keeps its package.json at the root, or one level down in a monorepo.
const NPM_DIRS = [".", "Frontend", "frontend", "web", "client", "app"];

async function npmScriptsIn(
  worktree: string,
  dir: string,
  section: string,
): Promise<Runnable[]> {
  let parsed: { scripts?: Record<string, string> };
  try {
    parsed = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
  } catch {
    return [];
  }
  return Object.entries(parsed.scripts ?? {}).map(([name, body]) => ({
    id: `npm:${section}:${name}`,
    title: `npm run ${name}`,
    subtitle: body,
    cwd: dir,
    command: ["npm", "run", name],
    section,
  }));
}

// realpath, because macOS is case-insensitive: "Frontend" and "frontend" are
// the same directory and would otherwise be listed twice.
async function npmDirs(worktree: string): Promise<Map<string, string>> {
  const root = await realpath(worktree).catch(() => worktree);
  const resolved = new Map<string, string>();
  for (const relative of NPM_DIRS) {
    const dir = await realpath(join(worktree, relative)).catch(() => null);
    if (dir === null || resolved.has(dir)) {
      continue;
    }
    resolved.set(dir, dir === root ? "npm" : basename(dir));
  }
  return resolved;
}

async function npmScripts(worktree: string): Promise<Runnable[]> {
  const dirs = await npmDirs(worktree);
  const found = await Promise.all(
    [...dirs].map(([dir, section]) => npmScriptsIn(worktree, dir, section)),
  );
  return found.flat();
}

// Run from the worktree root either way, so a script's own relative paths hold.
async function shellScripts(
  worktree: string,
  dir: string,
  section: string,
): Promise<Runnable[]> {
  let entries;
  try {
    entries = await readdir(join(worktree, dir), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sh"))
    .map((entry) => {
      const relative = join(dir, entry.name);
      return {
        id: `sh:${relative}`,
        title: `./${relative}`,
        subtitle: "",
        cwd: worktree,
        command: [`./${relative}`],
        section,
      };
    });
}

export async function listRunnables(worktree: string): Promise<Runnable[]> {
  const [npm, ...shell] = await Promise.all([
    npmScripts(worktree),
    ...SHELL_DIRS.map(({ dir, section }) =>
      shellScripts(worktree, dir, section),
    ),
  ]);
  return [...npm, ...shell.flat()];
}
