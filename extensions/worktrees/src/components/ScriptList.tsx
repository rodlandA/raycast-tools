import {
  Action,
  ActionPanel,
  closeMainWindow,
  Icon,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { errorMessage } from "../lib/exec";
import { openInTerminal } from "../lib/run";
import { listRunnables, Runnable } from "../lib/scripts";

async function start(item: Runnable) {
  try {
    await openInTerminal(item.cwd, item.command);
    await closeMainWindow();
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Could not start",
      message: errorMessage(error),
    });
  }
}

export function ScriptList({
  worktree,
  name,
}: {
  worktree: string;
  name: string;
}) {
  const { data, isLoading } = usePromise(listRunnables, [worktree]);
  const runnables = data ?? [];
  const sections = [...new Set(runnables.map((item) => item.section))];

  return (
    <List
      isLoading={isLoading}
      navigationTitle={name}
      searchBarPlaceholder="Filter scripts"
    >
      <List.EmptyView
        title="Nothing to run"
        description="No package.json scripts and no shell scripts in this worktree."
      />
      {sections.map((section) => (
        <List.Section key={section} title={section}>
          {runnables
            .filter((item) => item.section === section)
            .map((item) => (
              <List.Item
                key={item.id}
                title={item.title}
                subtitle={item.subtitle}
                icon={Icon.Terminal}
                actions={
                  <ActionPanel>
                    <Action
                      title="Run in Terminal"
                      icon={Icon.Terminal}
                      onAction={() => start(item)}
                    />
                    <Action.CopyToClipboard
                      title="Copy Command"
                      content={item.command.join(" ")}
                    />
                  </ActionPanel>
                }
              />
            ))}
        </List.Section>
      ))}
    </List>
  );
}
