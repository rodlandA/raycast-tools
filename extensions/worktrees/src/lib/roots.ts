import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Root {
  path: string;
  label: string;
  repoCount: number;
}

export const ALL_ROOTS = "__all__";

// Big, uninteresting, or hostile to walk. Skipped wherever they appear.
const SKIP = new Set([
  "node_modules",
  "Library",
  "Applications",
  "Music",
  "Movies",
  "Pictures",
  "Public",
  "Desktop",
  "Downloads",
  "dist",
  "build",
  "vendor",
  "target",
]);

function isInteresting(name: string): boolean {
  return !name.startsWith(".") && !SKIP.has(name);
}

async function subdirectories(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && isInteresting(entry.name))
      .map((entry) => join(dir, entry.name));
  } catch {
    return [];
  }
}

export function isRepo(dir: string): boolean {
  return existsSync(join(dir, ".git"));
}

async function countRepos(dir: string, depth: number): Promise<number> {
  const children = await subdirectories(dir);
  const counts = await Promise.all(
    children.map(async (child) => {
      if (isRepo(child)) {
        return 1;
      }
      return depth < 2 ? countRepos(child, depth + 1) : 0;
    }),
  );
  return counts.reduce((total, n) => total + n, 0);
}

export function tildePath(path: string): string {
  const home = homedir();
  return path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

/**
 * Directories under the home folder that hold git repositories — whatever the
 * user happens to call theirs. Most repos first, so the real one leads.
 */
export async function discoverRoots(extra: string[] = []): Promise<Root[]> {
  const candidates = await subdirectories(homedir());
  const counted = await Promise.all(
    [...candidates, ...extra].map(async (path) => ({
      path,
      label: tildePath(path),
      repoCount: isRepo(path) ? 0 : await countRepos(path, 1),
    })),
  );

  const seen = new Set<string>();
  return counted
    .filter((root) => {
      if (root.repoCount === 0 || seen.has(root.path)) {
        return false;
      }
      seen.add(root.path);
      return true;
    })
    .sort(
      (a, b) => b.repoCount - a.repoCount || a.label.localeCompare(b.label),
    );
}
