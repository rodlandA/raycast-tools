import { exec } from "./exec";

export async function openInEditor(path: string): Promise<void> {
  await exec("code", [path]);
}
