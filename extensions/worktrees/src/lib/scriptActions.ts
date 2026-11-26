import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { exec } from "./exec";

export interface ScriptAction {
  title: string;
  script: string;
  args: string[];
}

// A repository offers actions on its worktrees by declaring them in a script:
//   # @worktrees.action Start the mock: mock
const DECLARATION = /^#\s*@worktrees\.action\s+([^:]+):\s*(.*)$/;
const SCRIPT_DIR = "scripts";

async function declaredIn(
  worktree: string,
  name: string,
): Promise<ScriptAction[]> {
  const text = await readFile(join(worktree, SCRIPT_DIR, name), "utf8").catch(
    () => "",
  );
  return text
    .split("\n")
    .map((line) => line.match(DECLARATION))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map(([, title, args]) => ({
      title: title.trim(),
      script: join(SCRIPT_DIR, name),
      args: args.trim().split(/\s+/).filter(Boolean),
    }));
}

export async function scriptActions(worktree: string): Promise<ScriptAction[]> {
  const names = await readdir(join(worktree, SCRIPT_DIR)).catch(() => []);
  const found = await Promise.all(
    names
      .filter((name) => name.endsWith(".sh"))
      .map((name) => declaredIn(worktree, name)),
  );
  return found.flat();
}

// The script's last line of output is what the toast reports.
export async function runScriptAction(
  worktree: string,
  action: ScriptAction,
): Promise<string> {
  const output = await exec(
    join(worktree, action.script),
    action.args,
    worktree,
  );
  return output.trim().split("\n").at(-1) ?? "";
}
