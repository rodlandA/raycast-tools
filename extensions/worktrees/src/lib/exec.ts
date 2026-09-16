import { execFile } from "node:child_process";
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
  const { stdout } = await execFileAsync(file, args, { cwd, env: execEnv });
  return stdout;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    const stderr = (error as Error & { stderr?: string }).stderr;
    return (stderr?.trim() || error.message).split("\n")[0];
  }
  return String(error);
}
