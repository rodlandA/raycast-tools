import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Shell helpers from this repository's bin/. They are optional: an action that
// needs one is hidden rather than left to fail when it is not installed.
export type HelperName = "iterm-run" | "cl" | "git-review";

export function helperPath(name: HelperName): string {
  return join(homedir(), ".local", "bin", name);
}

export function hasHelper(name: HelperName): boolean {
  return existsSync(helperPath(name));
}
