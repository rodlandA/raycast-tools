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
import { inspectDevServers, Scheme } from "../lib/devServers";
import { errorMessage } from "../lib/exec";
import { DEFAULT_FRONTEND_PORT, phoneQr, PhoneQr } from "../lib/phoneQr";

const QR_WIDTH = 170;

const SELF_SERVING_NOTE: Record<Scheme, string> = {
  http: "This worktree's backend serves the app itself over plain HTTP, so there is no certificate to accept.",
  https:
    "This worktree's backend serves the app itself over HTTPS. Tap through the certificate warning the first time on each phone.",
};

interface Reading {
  qr: PhoneQr;
  port: number;
  running: boolean;
  selfServing?: Scheme;
  backend?: { worktree: string; httpsPort: number };
}

async function read(worktree: string, repoPath: string): Promise<Reading> {
  const servers = await inspectDevServers();
  const running = servers.frontendPorts.get(worktree);
  const port = running ?? DEFAULT_FRONTEND_PORT;
  const selfServing = servers.selfServing.get(worktree);
  return {
    qr: await phoneQr(repoPath, {
      port,
      https: selfServing === "https",
      backendHttpsPort: servers.backend?.httpsPort,
    }),
    port,
    running: running !== undefined,
    selfServing,
    backend: servers.backend,
  };
}

function warnings({ running, port, backend }: Reading, worktree: string) {
  const lines: string[] = [];
  if (!running) {
    lines.push(
      `> ⚠️ No dev server is serving this worktree — falling back to port ${port}.`,
    );
  }
  if (backend === undefined) {
    lines.push("> ⚠️ No backend answers HTTPS, so step 1 will not load.");
  } else if (backend.worktree !== worktree) {
    lines.push(
      `> ℹ️ The backend on ${backend.httpsPort} is running from ${basename(backend.worktree)}.`,
    );
  }
  return lines.join("\n>\n");
}

function markdown(reading: Reading, worktree: string): string {
  const { qr, selfServing } = reading;
  if (selfServing !== undefined) {
    return [
      SELF_SERVING_NOTE[selfServing],
      "## Open the app",
      `![App](${qr.appImage}?raycast-width=${QR_WIDTH})`,
    ].join("\n\n");
  }
  return [
    warnings(reading, worktree),
    "## Step 1 — accept the certificate",
    "Once per phone, and again on each new network unless this Mac is on a tailnet. Tap through the warning until the API documentation loads.",
    `![Certificate](${qr.certImage}?raycast-width=${QR_WIDTH})`,
    "## Step 2 — open the app",
    `![App](${qr.appImage}?raycast-width=${QR_WIDTH})`,
  ]
    .filter((block) => block.length > 0)
    .join("\n\n");
}

function metadata(reading: Reading, name: string) {
  const { qr, running, port, selfServing } = reading;
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
      {selfServing === undefined && (
        <Detail.Metadata.Label title="Certificate" text={qr.certUrl} />
      )}
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
          {data !== undefined && data.selfServing === undefined && (
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
