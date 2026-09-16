import { open } from "@raycast/api";
import { exec } from "./exec";
import { hasHelper, helperPath } from "./helpers";

export async function openInEditor(dir: string): Promise<void> {
  await exec("code", [dir]);
}

// Without a command the directory is enough, so Terminal.app stands in when
// iterm-run is missing. Running a command there needs the helper.
export async function openInTerminal(
  dir: string,
  command: string[] = [],
): Promise<void> {
  if (!hasHelper("iterm-run")) {
    if (command.length > 0) {
      throw new Error(
        "iterm-run is not installed — run ./install.sh iterm-run in raycast-tools",
      );
    }
    await open(dir, "Terminal");
    return;
  }
  await exec(helperPath("iterm-run"), [dir, ...command]);
}

export async function openClaudePanes(dir: string): Promise<void> {
  await exec(helperPath("cl"), [dir]);
}

export async function openUrl(url: string): Promise<void> {
  await open(url);
}

export async function openReview(
  worktree: string,
  as: "browser" | "document",
): Promise<void> {
  const args = as === "document" ? [worktree, "--doc"] : [worktree];
  await exec(helperPath("git-review"), args);
}
