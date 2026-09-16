import { homedir } from "node:os";
import { basename, resolve } from "node:path";
import { exec } from "./exec";

export interface Worktree {
  path: string;
  name: string;
  branch: string;
  isMain: boolean;
  upstreamGone: boolean;
  repoPath: string;
}

export function expandHome(input: string): string {
  if (!input.startsWith("~")) {
    return input;
  }
  return resolve(homedir(), input.replace(/^~\/?/, ""));
}

// "[gone]" means the branch had an upstream that no longer exists, which is
// what a merged-and-deleted branch looks like locally.
async function upstreamTracks(cwd: string): Promise<Map<string, string>> {
  const stdout = await exec(
    "git",
    [
      "for-each-ref",
      "--format=%(refname:short)\t%(upstream:track)",
      "refs/heads",
    ],
    cwd,
  );
  const tracks = new Map<string, string>();
  for (const line of stdout.split("\n")) {
    if (line.trim().length === 0) {
      continue;
    }
    const [branch, track = ""] = line.split("\t");
    tracks.set(branch, track);
  }
  return tracks;
}

export async function listWorktrees(repoPath: string): Promise<Worktree[]> {
  const cwd = expandHome(repoPath);
  const stdout = await exec("git", ["worktree", "list", "--porcelain"], cwd);
  const tracks = await upstreamTracks(cwd);

  const worktrees: Worktree[] = [];
  let path: string | undefined;
  let branch: string | undefined;

  const flush = () => {
    if (path === undefined) {
      return;
    }
    const name = basename(path);
    worktrees.push({
      path,
      name,
      branch: branch ?? "detached",
      isMain: worktrees.length === 0,
      upstreamGone: (tracks.get(branch ?? "") ?? "").includes("gone"),
      repoPath: cwd,
    });
    path = undefined;
    branch = undefined;
  };

  for (const line of stdout.split("\n")) {
    if (line.startsWith("worktree ")) {
      flush();
      path = line.slice("worktree ".length);
    } else if (line.startsWith("branch ")) {
      branch = line.slice("branch ".length).replace("refs/heads/", "");
    }
  }
  flush();

  return worktrees;
}

export async function addWorktree(
  repoPath: string,
  branch: string,
  slug: string,
  base: string,
): Promise<string> {
  const cwd = expandHome(repoPath);
  const target = resolve(cwd, "..", `${basename(cwd)}-${slug}`);
  await exec("git", ["worktree", "add", "-b", branch, target, base], cwd);
  return target;
}

export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
): Promise<void> {
  await exec("git", ["worktree", "remove", worktreePath], expandHome(repoPath));
}

export async function pullRequestUrl(
  worktreePath: string,
): Promise<string | null> {
  try {
    const stdout = await exec(
      "gh",
      ["pr", "view", "--json", "url", "--jq", ".url"],
      worktreePath,
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/** The branch new worktrees should start from, as the repository reports it. */
export async function defaultBranch(repoPath: string): Promise<string> {
  const cwd = expandHome(repoPath);
  try {
    const stdout = await exec(
      "git",
      ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"],
      cwd,
    );
    const branch = stdout.trim().replace(/^origin\//, "");
    if (branch.length > 0) {
      return branch;
    }
  } catch {
    // No origin/HEAD — fall through to the usual names.
  }

  for (const candidate of ["develop", "main", "master"]) {
    try {
      await exec(
        "git",
        ["rev-parse", "--verify", "--quiet", `refs/heads/${candidate}`],
        cwd,
      );
      return candidate;
    } catch {
      continue;
    }
  }
  return "main";
}
