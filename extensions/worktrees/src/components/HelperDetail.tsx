import {
  Action,
  ActionPanel,
  closeMainWindow,
  Detail,
  Icon,
  showToast,
  Toast,
} from "@raycast/api";
import { homedir } from "node:os";
import { CustomCommand } from "../lib/commands";
import { errorMessage } from "../lib/exec";
import { openInEditor, openInTerminal } from "../lib/run";

export function HelperDetail({ command }: { command: CustomCommand }) {
  async function runInTerminal() {
    try {
      await openInTerminal(homedir(), [command.path]);
      await closeMainWindow();
    } catch (caught) {
      await showToast({
        style: Toast.Style.Failure,
        title: `Could not start ${command.title}`,
        message: errorMessage(caught),
      });
    }
  }

  const usage = command.usage ?? "No usage comment in the file.";
  const markdown = `# ${command.title}\n\n\`\`\`\n${usage}\n\`\`\`\n\n\`${command.path}\``;

  return (
    <Detail
      navigationTitle={command.title}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action
            title="Run in Terminal"
            icon={Icon.Terminal}
            onAction={runInTerminal}
          />
          <Action
            title="Open in VS Code"
            icon={Icon.Code}
            onAction={() => openInEditor(command.path)}
          />
          <Action.CopyToClipboard title="Copy Path" content={command.path} />
        </ActionPanel>
      }
    />
  );
}
