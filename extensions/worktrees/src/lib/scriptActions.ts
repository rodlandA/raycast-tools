import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { exec } from "./exec";

export interface ScriptVariant {
  title: string;
  args: string[];
}

export interface ScriptAction extends ScriptVariant {
  script: string;
}

// A repository declares these in a script, one per line, as the title, a colon and the arguments:
//   # @worktrees.action Start the mock: mock
//   # @worktrees.variant Sign-in on: --auth
const ACTION = /^#\s*@worktrees\.action\s+([^:]+):\s*(.*)$/;
const VARIANT = /^#\s*@worktrees\.variant\s+([^:]+):\s*(.*)$/;
const SCRIPT_DIR = "scripts";

async function declared(
  path: string,
  pattern: RegExp,
): Promise<ScriptVariant[]> {
  const text = await readFile(path, "utf8").catch(() => "");
  return text
    .split("\n")
    .map((line) => line.match(pattern))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map(([, title, args]) => ({
      title: title.trim(),
      args: args.trim().split(/\s+/).filter(Boolean),
    }));
}

export async function scriptActions(worktree: string): Promise<ScriptAction[]> {
  const names = await readdir(join(worktree, SCRIPT_DIR)).catch(() => []);
  const found = await Promise.all(
    names
      .filter((name) => name.endsWith(".sh"))
      .map(async (name) => {
        const script = join(SCRIPT_DIR, name);
        const actions = await declared(join(worktree, script), ACTION);
        return actions.map((action) => ({ ...action, script }));
      }),
  );
  return found.flat();
}

export function scriptVariants(
  worktree: string,
  script: string,
): Promise<ScriptVariant[]> {
  return declared(join(worktree, script), VARIANT);
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
