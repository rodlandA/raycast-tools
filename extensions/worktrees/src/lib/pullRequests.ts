import { exec } from "./exec";
import { expandHome } from "./worktrees";

export type CheckState = "passing" | "failing" | "running" | "none";

export interface Check {
  name: string;
  conclusion: string;
  finished: boolean;
}

export interface PullRequest {
  number: number;
  title: string;
  branch: string;
  isDraft: boolean;
  url: string;
  author: string;
  checks: Check[];
  state: CheckState;
}

// A rollup entry is either a CheckRun (name/status/conclusion) or a legacy
// StatusContext (context/state), so both shapes have to be flattened.
interface RawCheck {
  name?: string;
  context?: string;
  status?: string;
  state?: string;
  conclusion?: string;
}

interface RawPullRequest {
  number: number;
  title: string;
  headRefName: string;
  isDraft: boolean;
  url: string;
  author?: { login?: string };
  statusCheckRollup?: RawCheck[] | null;
}

const FAILED = [
  "FAILURE",
  "TIMED_OUT",
  "CANCELLED",
  "ERROR",
  "ACTION_REQUIRED",
  "STARTUP_FAILURE",
];

function normalise(raw: RawCheck): Check {
  return {
    name: raw.name ?? raw.context ?? "check",
    conclusion: raw.conclusion ?? raw.state ?? "",
    finished: (raw.status ?? "COMPLETED") === "COMPLETED",
  };
}

export function rollup(checks: Check[]): CheckState {
  if (checks.length === 0) {
    return "none";
  }
  if (checks.some((check) => FAILED.includes(check.conclusion))) {
    return "failing";
  }
  if (checks.some((check) => !check.finished)) {
    return "running";
  }
  return "passing";
}

export async function listPullRequests(
  repoPath: string,
): Promise<PullRequest[]> {
  const stdout = await exec(
    "gh",
    [
      "pr",
      "list",
      "--json",
      "number,title,headRefName,isDraft,url,author,statusCheckRollup",
    ],
    expandHome(repoPath),
  );
  const raw = JSON.parse(stdout) as RawPullRequest[];

  return raw.map((pr) => {
    const checks = (pr.statusCheckRollup ?? []).map(normalise);
    return {
      number: pr.number,
      title: pr.title,
      branch: pr.headRefName,
      isDraft: pr.isDraft,
      url: pr.url,
      author: pr.author?.login ?? "unknown",
      checks,
      state: rollup(checks),
    };
  });
}
