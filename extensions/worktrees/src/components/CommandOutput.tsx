import { Action, ActionPanel, Detail, Icon } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { CustomCommand } from "../lib/commands";
import { errorMessage, exec } from "../lib/exec";
import { openInEditor } from "../lib/run";

export function CommandOutput({
  command,
  args,
}: {
  command: CustomCommand;
  args: string[];
}) {
  const { data, isLoading, error } = usePromise(
    (path: string, params: string[]) => exec(path, params),
    [command.path, args],
  );

  const body = error !== undefined ? errorMessage(error) : (data ?? "");
  const markdown = `# ${command.title}\n\n\`\`\`\n${body.trimEnd() || "(no output)"}\n\`\`\``;

  return (
    <Detail
      isLoading={isLoading}
      navigationTitle={command.title}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Output" content={body} />
          <Action
            title="Open in VS Code"
            icon={Icon.Code}
            onAction={() => openInEditor(command.path)}
          />
        </ActionPanel>
      }
    />
  );
}
