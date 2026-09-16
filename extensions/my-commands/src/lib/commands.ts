import { environment } from "@raycast/api";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const BIN_DIR = join(homedir(), ".local", "bin");
const EXTENSIONS_DIR = join(homedir(), ".config", "raycast", "extensions");
const SCRIPT_EXTENSIONS =
  /\.(sh|bash|zsh|py|js|mjs|rb|swift|applescript|php|pl)$/;
// Anything bigger is not a hand-written script.
const MAX_SCRIPT_BYTES = 256 * 1024;
const BACKUP = /(\.bak|\.orig|~)$/;

export const HELPER_SECTION = "Command line only";

export interface ScriptArgument {
  name: string;
  type: string;
  placeholder: string;
  optional: boolean;
  data: { title: string; value: string }[];
}

export interface CustomCommand {
  id: string;
  kind: "script" | "extension" | "helper";
  section: string;
  title: string;
  description: string;
  icon?: string;
  path: string;
  folder?: string;
  mode: string;
  args: ScriptArgument[];
  extensionCommand?: string;
  extensionName?: string;
  extensionOwner?: string;
  usage?: string;
}

interface SourceFile {
  name: string;
  path: string;
  folder: string;
  body: string;
}

function metadata(body: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const line of body.split("\n")) {
    const match = /^(?:#|\/\/|--)\s*@raycast\.(\w+)\s+(.+)$/.exec(line.trim());
    if (match) {
      found.set(match[1], match[2].trim());
    }
  }
  return found;
}

function scriptArguments(meta: Map<string, string>): ScriptArgument[] {
  const args: ScriptArgument[] = [];
  for (let i = 1; i <= 3; i++) {
    const raw = meta.get(`argument${i}`);
    if (raw === undefined) {
      break;
    }
    try {
      const parsed = JSON.parse(raw);
      args.push({
        name: `argument${i}`,
        type: parsed.type ?? "text",
        placeholder: parsed.placeholder ?? `Argument ${i}`,
        optional: parsed.optional === true,
        data: parsed.data ?? [],
      });
    } catch {
      // A malformed argument line is Raycast's problem to report, not a reason
      // to drop the command from the list.
    }
  }
  return args;
}

// The comment block under the shebang, which is where the helpers keep their
// usage.
function header(body: string): string {
  const lines: string[] = [];
  for (const line of body.split("\n").slice(1)) {
    if (!line.startsWith("#")) {
      break;
    }
    lines.push(line.replace(/^#\s?/, ""));
  }
  return lines.join("\n").trim();
}

function firstLine(text: string): string {
  return text.split("\n").find((line) => line.trim() !== "") ?? "";
}

// Follows symlinks, so a script installed by linking it in is read like any other.
async function readSmallFile(
  folder: string,
  name: string,
): Promise<SourceFile | null> {
  const path = join(folder, name);
  try {
    const info = await stat(path);
    if (!info.isFile() || info.size > MAX_SCRIPT_BYTES) {
      return null;
    }
    return { name, path, folder, body: await readFile(path, "utf8") };
  } catch {
    return null;
  }
}

async function readFolder(
  folder: string,
  keep: (name: string) => boolean,
): Promise<SourceFile[]> {
  let names: string[];
  try {
    names = await readdir(folder);
  } catch {
    return [];
  }
  const files = await Promise.all(
    names.filter(keep).map((name) => readSmallFile(folder, name)),
  );
  return files.filter((file): file is SourceFile => file !== null);
}

// A script linked into a script folder and found again at its source would be
// listed twice; the linked copy is the one the user put there on purpose.
async function dedupe(files: SourceFile[]): Promise<SourceFile[]> {
  const byTarget = new Map<string, SourceFile>();
  for (const file of files) {
    const target = await realpath(file.path).catch(() => file.path);
    const seen = byTarget.get(target);
    if (seen === undefined || seen.path === target) {
      byTarget.set(target, file);
    }
  }
  return [...byTarget.values()];
}

function scriptCommands(files: SourceFile[]): CustomCommand[] {
  return files
    .map((file) => ({ file, meta: metadata(file.body) }))
    .filter(({ meta }) => meta.has("schemaVersion"))
    .map(({ file, meta }) => ({
      id: `script:${file.path}`,
      kind: "script" as const,
      section: meta.get("packageName") ?? "Ungrouped",
      title: meta.get("title") ?? file.name,
      description: meta.get("description") ?? "",
      icon: meta.get("icon"),
      path: file.path,
      folder: file.folder,
      mode: meta.get("mode") ?? "silent",
      args: scriptArguments(meta),
    }));
}

interface Manifest {
  name: string;
  title: string;
  author?: string;
  owner?: string;
  commands?: { name: string; title: string; description?: string }[];
}

// Store installs live in folders named by a UUID; one built locally with
// ray build lives in a folder named after the extension itself.
async function extensionCommands(): Promise<CustomCommand[]> {
  let dirs: string[];
  try {
    dirs = await readdir(EXTENSIONS_DIR);
  } catch {
    return [];
  }
  const manifests = await Promise.all(
    dirs.map(async (dir) => {
      try {
        const path = join(EXTENSIONS_DIR, dir);
        const manifest: Manifest = JSON.parse(
          await readFile(join(path, "package.json"), "utf8"),
        );
        const isOwnBuild =
          manifest.name === dir && manifest.name !== environment.extensionName;
        return isOwnBuild ? { path, manifest } : null;
      } catch {
        return null;
      }
    }),
  );

  return manifests
    .filter((entry) => entry !== null)
    .flatMap(({ path, manifest }) =>
      (manifest.commands ?? []).map((command) => ({
        id: `extension:${manifest.name}:${command.name}`,
        kind: "extension" as const,
        section: manifest.title,
        title: command.title,
        description: command.description ?? "",
        path,
        mode: "view",
        args: [],
        extensionCommand: command.name,
        extensionName: manifest.name,
        extensionOwner: manifest.owner ?? manifest.author ?? "",
      })),
    );
}

// A helper that some command already calls is plumbing, not something to browse
// for. What is left is the tools that exist only in a terminal.
function helperCommands(
  helpers: SourceFile[],
  calledBy: Set<string>,
): CustomCommand[] {
  return helpers
    .filter((helper) => !calledBy.has(helper.name))
    .map((helper) => {
      const usage = header(helper.body);
      return {
        id: `helper:${helper.name}`,
        kind: "helper" as const,
        section: HELPER_SECTION,
        title: helper.name,
        description: firstLine(usage),
        path: helper.path,
        mode: "terminal",
        args: [],
        usage,
      };
    });
}

function referencedHelpers(files: SourceFile[]): Set<string> {
  const names = new Set<string>();
  for (const file of files) {
    for (const match of file.body.matchAll(/\/bin\/([\w.-]+)/g)) {
      if (match[1] !== file.name) {
        names.add(match[1]);
      }
    }
  }
  return names;
}

// Only scripts count: a compiled tool such as the claude binary has no usage
// header to show, and the size cap keeps it from being read at all.
async function helperScripts(): Promise<SourceFile[]> {
  const files = await readFolder(BIN_DIR, (name) => !BACKUP.test(name));
  const checked = await Promise.all(
    files.map(async (file) => {
      const info = await stat(file.path).catch(() => null);
      const executable = info !== null && (info.mode & 0o111) !== 0;
      return executable && file.body.startsWith("#!") ? file : null;
    }),
  );
  return checked.filter((file): file is SourceFile => file !== null);
}

export async function listCommands(
  folders: string[],
): Promise<CustomCommand[]> {
  const [scriptFiles, helpers, extensions] = await Promise.all([
    Promise.all(
      folders.map((folder) =>
        readFolder(folder, (name) => SCRIPT_EXTENSIONS.test(name)),
      ),
    ).then((found) => dedupe(found.flat())),
    helperScripts(),
    extensionCommands(),
  ]);

  const called = referencedHelpers([...scriptFiles, ...helpers]);
  return [
    ...scriptCommands(scriptFiles),
    ...extensions,
    ...helperCommands(helpers, called),
  ];
}

const KIND_ORDER: CustomCommand["kind"][] = ["script", "extension", "helper"];

export function sectionsOf(commands: CustomCommand[]): string[] {
  const ordered = KIND_ORDER.flatMap((kind) =>
    [
      ...new Set(
        commands
          .filter((command) => command.kind === kind)
          .map((command) => command.section),
      ),
    ].sort(),
  );
  return [...new Set(ordered)];
}
