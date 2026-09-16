import { readdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { exec } from "./exec";
import { isRepo } from "./roots";
import { listWorktrees, Worktree } from "./worktrees";

export interface Repo {
  path: string;
  name: string;
  worktrees: Worktree[];
}

const MAX_DEPTH = 3;

const SKIP = new Set([
  "node_modules",
  "Library",
  "dist",
  "build",
  "vendor",
  "target",
]);

async function findRepoDirs(dir: string, depth: number): Promise<string[]> {
  if (depth > MAX_DEPTH) {
    return [];
  }
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const found = await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !entry.name.startsWith(".") &&
          !SKIP.has(entry.name),
      )
      .map(async (entry) => {
        const path = join(dir, entry.name);
        // A repo is not searched further: its worktrees live beside it, not within.
        return isRepo(path) ? [path] : findRepoDirs(path, depth + 1);
      }),
  );
  return found.flat();
}

/**
 * The checkout a worktree belongs to. Both a main checkout and its worktrees
 * report the same common git dir, so this collapses them onto one repository.
 */
async function mainCheckout(dir: string): Promise<string | null> {
  try {
    const stdout = await exec(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      dir,
    );
    return dirname(stdout.trim());
  } catch {
    return null;
  }
}

export async function findRepos(roots: string[]): Promise<Repo[]> {
  const dirs = await Promise.all(roots.map((root) => findRepoDirs(root, 1)));
  const checkouts = await Promise.all(dirs.flat().map(mainCheckout));

  const unique = [...new Set(checkouts.filter((p): p is string => p !== null))];
  const repos = await Promise.all(
    unique.map(async (path) => ({
      path,
      name: basename(path),
      worktrees: await listWorktrees(path).catch(() => []),
    })),
  );

  return repos
    .filter((repo) => repo.worktrees.length > 0)
    .sort(
      (a, b) =>
        b.worktrees.length - a.worktrees.length || a.name.localeCompare(b.name),
    );
}
