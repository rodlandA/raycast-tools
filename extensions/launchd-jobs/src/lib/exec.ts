import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Raycast starts the extension with a minimal PATH, so git, gh, code and the
// helpers in ~/.local/bin are not on it by default.
const PATH = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  `${homedir()}/.local/bin`,
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin",
].join(":");

export const execEnv = { ...process.env, PATH };

export async function exec(
  file: string,
  args: string[],
  cwd?: string,
): Promise<string> {
  // A missing cwd fails with the same ENOENT as a missing program, so rule it out first.
  if (cwd !== undefined && !existsSync(cwd)) {
    throw new Error(`${cwd} no longer exists`);
  }
  const { stdout } = await execFileAsync(file, args, { cwd, env: execEnv });
  return stdout;
}

interface ExecError extends Error {
  stderr?: string;
  code?: string;
  syscall?: string;
  path?: string;
}

export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const { stderr, code, syscall, path } = error as ExecError;
  if (code === "ENOENT" && syscall?.startsWith("spawn") && path !== undefined) {
    return `${path} is not installed`;
  }
  return (stderr?.trim() || error.message).split("\n")[0];
}
