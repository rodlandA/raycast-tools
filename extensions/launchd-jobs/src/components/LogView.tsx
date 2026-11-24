import { Action, ActionPanel, Detail, Icon, Keyboard } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { Job, readLogTail } from "../lib/jobs";
import { openInEditor } from "../lib/run";

const FULL_TAIL_BYTES = 256 * 1024;

export function LogView({ job, path }: { job: Job; path: string }) {
  const { data, isLoading, revalidate } = usePromise(
    (p: string) => readLogTail(p, FULL_TAIL_BYTES),
    [path],
  );
  const text = data?.text || "(empty)";

  return (
    <Detail
      isLoading={isLoading}
      navigationTitle={job.label}
      markdown={`\`${path}\`\n\n\`\`\`\n${text}\n\`\`\``}
      actions={
        <ActionPanel>
          <Action
            title="Reload Log"
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={revalidate}
          />
          <Action.Open
            title="Open in Console"
            icon={Icon.Terminal}
            target={path}
            application="Console"
          />
          <Action
            title="Open in VS Code"
            icon={Icon.Code}
            shortcut={Keyboard.Shortcut.Common.Open}
            onAction={() => openInEditor(path)}
          />
          <Action.CopyToClipboard
            title="Copy Log"
            content={data?.text ?? ""}
            shortcut={Keyboard.Shortcut.Common.Copy}
          />
        </ActionPanel>
      }
    />
  );
}
