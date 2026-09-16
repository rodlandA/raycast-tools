import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import QRCode from "qrcode";
import { exec } from "./exec";
import { expandHome } from "./worktrees";

const QR_PIXELS = 512;
const CACHE_DIR = "Library/Caches/worktrees-phone-qr";

export const DEFAULT_FRONTEND_PORT = 3000;

export interface PhoneQr {
  ip: string;
  certUrl: string;
  appUrl: string;
  /** Tilde paths: Raycast markdown renders those and ignores `file://` ones. */
  certImage: string;
  appImage: string;
}

function parseUrls(stdout: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of stdout.split("\n")) {
    const separator = line.indexOf("=");
    if (separator > 0) {
      values.set(line.slice(0, separator), line.slice(separator + 1).trim());
    }
  }
  return values;
}

// Named for their content so a changed address never reuses a cached image.
async function renderQr(name: string, url: string): Promise<string> {
  const file = `${name}-${url.replace(/\W+/g, "-")}.png`;
  await QRCode.toFile(join(homedir(), CACHE_DIR, file), url, {
    width: QR_PIXELS,
    margin: 2,
  });
  return `~/${CACHE_DIR}/${file}`;
}

/**
 * Builds the two phone URLs by asking the repository's own phone-qr.sh, so the
 * addresses stay defined in one place, and renders each as a PNG.
 */
export async function phoneQr(
  repoPath: string,
  port: number,
): Promise<PhoneQr> {
  const root = expandHome(repoPath);
  const script = join(root, "scripts", "phone-qr.sh");
  const values = parseUrls(await exec(script, ["--urls", String(port)], root));

  const ip = values.get("IP");
  const certUrl = values.get("CERT_URL");
  const appUrl = values.get("APP_URL");
  if (ip === undefined || certUrl === undefined || appUrl === undefined) {
    throw new Error("phone-qr.sh did not report an address");
  }

  await mkdir(join(homedir(), CACHE_DIR), { recursive: true });
  const [certImage, appImage] = await Promise.all([
    renderQr("cert", certUrl),
    renderQr("app", appUrl),
  ]);
  return { ip, certUrl, appUrl, certImage, appImage };
}
