import {
  Action,
  ActionPanel,
  Color,
  Detail,
  Icon,
  Keyboard,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { basename } from "node:path";
import { inspectDevServers } from "../lib/devServers";
import { errorMessage } from "../lib/exec";
import { DEFAULT_FRONTEND_PORT, phoneQr, PhoneQr } from "../lib/phoneQr";

const QR_WIDTH = 170;

interface Reading {
  qr: PhoneQr;
  port: number;
  running: boolean;
  backendWorktree?: string;
}

async function read(worktree: string, repoPath: string): Promise<Reading> {
  const servers = await inspectDevServers();
  const running = servers.frontendPorts.get(worktree);
  const port = running ?? DEFAULT_FRONTEND_PORT;
  return {
    qr: await phoneQr(repoPath, port),
    port,
    running: running !== undefined,
    backendWorktree: servers.backendWorktree,
  };
}

function warnings(
  { running, port, backendWorktree }: Reading,
  worktree: string,
) {
  const lines: string[] = [];
  if (!running) {
    lines.push(
      `> ⚠️ No dev server is serving this worktree — falling back to port ${port}.`,
    );
  }
  if (backendWorktree === undefined) {
    lines.push("> ⚠️ Nothing holds port 5234, so step 1 will not load.");
  } else if (backendWorktree !== worktree) {
    lines.push(
      `> ℹ️ The backend on 5234 is running from ${basename(backendWorktree)}.`,
    );
  }
  return lines.join("\n>\n");
}

function markdown(reading: Reading, worktree: string): string {
  const { qr } = reading;
  return [
    warnings(reading, worktree),
    "## Step 1 — accept the certificate",
    "Once per phone, per network. Tap through the warning until the API documentation loads.",
    `![Certificate](${qr.certImage}?raycast-width=${QR_WIDTH})`,
    "## Step 2 — open the app",
    `![App](${qr.appImage}?raycast-width=${QR_WIDTH})`,
  ]
    .filter((block) => block.length > 0)
    .join("\n\n");
}

function metadata(reading: Reading, name: string) {
  const { qr, running, port } = reading;
  return (
    <Detail.Metadata>
      <Detail.Metadata.Label title="Worktree" text={name} />
      <Detail.Metadata.TagList title="Frontend">
        <Detail.Metadata.TagList.Item
          text={running ? `:${port}` : `:${port} (not running)`}
          color={running ? Color.Green : Color.Orange}
        />
      </Detail.Metadata.TagList>
      <Detail.Metadata.Label title="Address" text={qr.ip} />
      <Detail.Metadata.Separator />
      <Detail.Metadata.Label title="Certificate" text={qr.certUrl} />
      <Detail.Metadata.Label title="App" text={qr.appUrl} />
    </Detail.Metadata>
  );
}

export function PhoneQrDetail({
  worktree,
  name,
  repoPath,
}: {
  worktree: string;
  name: string;
  repoPath: string;
}) {
  const { data, isLoading, error, revalidate } = usePromise(read, [
    worktree,
    repoPath,
  ]);

  if (error !== undefined) {
    return (
      <Detail
        navigationTitle={name}
        markdown={`## Could not build the QR codes\n\n${errorMessage(error)}`}
      />
    );
  }

  return (
    <Detail
      isLoading={isLoading}
      navigationTitle={name}
      markdown={data === undefined ? "" : markdown(data, worktree)}
      metadata={data === undefined ? undefined : metadata(data, name)}
      actions={
        <ActionPanel>
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={revalidate}
          />
          {data !== undefined && (
            <Action.CopyToClipboard
              title="Copy App URL"
              content={data.qr.appUrl}
              shortcut={Keyboard.Shortcut.Common.Copy}
            />
          )}
          {data !== undefined && (
            <Action.CopyToClipboard
              title="Copy Certificate URL"
              content={data.qr.certUrl}
            />
          )}
        </ActionPanel>
      }
    />
  );
}
