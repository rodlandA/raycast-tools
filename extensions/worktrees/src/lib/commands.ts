import { environment } from "@raycast/api";
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const SCRIPTS_DIR = join(homedir(), ".config", "raycast", "scripts");
const BIN_DIR = join(homedir(), ".local", "bin");
// The installed build, since the source checkout can live anywhere.
const EXTENSION_DIR = dirname(environment.assetsPath);

export const EXTENSION_SECTION = "Worktrees";
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
  mode: string;
  args: ScriptArgument[];
  extensionCommand?: string;
  usage?: string;
}

function metadata(body: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const line of body.split("\n")) {
    const match = /^#\s*@raycast\.(\w+)\s+(.+)$/.exec(line.trim());
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

async function readAll(
  dir: string,
  keep: (name: string) => boolean,
): Promise<{ name: string; path: string; body: string }[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = entries.filter((entry) => entry.isFile() && keep(entry.name));
  return Promise.all(
    files.map(async (entry) => {
      const path = join(dir, entry.name);
      return { name: entry.name, path, body: await readFile(path, "utf8") };
    }),
  );
}

function scriptCommands(
  files: { name: string; path: string; body: string }[],
): CustomCommand[] {
  return files.map((file) => {
    const meta = metadata(file.body);
    return {
      id: `script:${file.name}`,
      kind: "script" as const,
      section: meta.get("packageName") ?? "Ungrouped",
      title: meta.get("title") ?? file.name,
      description: meta.get("description") ?? "",
      icon: meta.get("icon"),
      path: file.path,
      mode: meta.get("mode") ?? "silent",
      args: scriptArguments(meta),
    };
  });
}

async function extensionCommands(): Promise<CustomCommand[]> {
  let parsed: {
    commands?: { name: string; title: string; description?: string }[];
  };
  try {
    parsed = JSON.parse(
      await readFile(join(EXTENSION_DIR, "package.json"), "utf8"),
    );
  } catch {
    return [];
  }
  return (parsed.commands ?? []).map((command) => ({
    id: `extension:${command.name}`,
    kind: "extension" as const,
    section: EXTENSION_SECTION,
    title: command.title,
    description: command.description ?? "",
    path: EXTENSION_DIR,
    mode: "view",
    args: [],
    extensionCommand: command.name,
  }));
}

// A helper that some command already calls is plumbing, not something to browse
// for. What is left is the tools that exist only in a terminal.
function helperCommands(
  helpers: { name: string; path: string; body: string }[],
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

function referencedHelpers(
  bodies: { name: string; body: string }[],
): Set<string> {
  const names = new Set<string>();
  for (const file of bodies) {
    for (const match of file.body.matchAll(/local\/bin\/([\w.-]+)/g)) {
      if (match[1] !== file.name) {
        names.add(match[1]);
      }
    }
  }
  return names;
}

// readAll keeps only real files, so a tool that is installed elsewhere and just
// symlinked here — the claude binary, say — never reaches this list.
async function executableFiles(dir: string) {
  const files = await readAll(dir, () => true);
  const checked = await Promise.all(
    files.map(async (file) => {
      try {
        const info = await stat(file.path);
        return (info.mode & 0o111) === 0 ? null : file;
      } catch {
        return null;
      }
    }),
  );
  return checked.filter((file) => file !== null);
}

export async function listCommands(): Promise<CustomCommand[]> {
  const [scripts, helpers, extension] = await Promise.all([
    readAll(SCRIPTS_DIR, (name) => name.endsWith(".sh")),
    executableFiles(BIN_DIR),
    extensionCommands(),
  ]);

  const called = referencedHelpers([...scripts, ...helpers]);
  return [
    ...scriptCommands(scripts),
    ...extension,
    ...helperCommands(helpers, called),
  ];
}

export function sectionsOf(commands: CustomCommand[]): string[] {
  const names = [...new Set(commands.map((command) => command.section))];
  const last = [EXTENSION_SECTION, HELPER_SECTION];
  return [
    ...names.filter((name) => !last.includes(name)).sort(),
    ...last.filter((name) => names.includes(name)),
  ];
}
