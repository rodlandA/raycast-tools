import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { worktreeAccessories } from "../lib/accessories";
import { inspectDevServers } from "../lib/devServers";
import { errorMessage } from "../lib/exec";
import { openInTerminal, runAndClose } from "../lib/run";
import { expandHome, listWorktrees, Worktree } from "../lib/worktrees";

async function worktreesWith(
  repoPath: string,
  script: string,
): Promise<Worktree[]> {
  const worktrees = await listWorktrees(repoPath);
  return worktrees.filter((worktree) =>
    existsSync(join(worktree.path, script)),
  );
}

export function WorktreePicker({
  repoPath,
  script,
}: {
  repoPath: string;
  script: string;
}) {
  const { data, isLoading, error } = usePromise(worktreesWith, [
    repoPath,
    script,
  ]);
  const { data: servers } = usePromise(inspectDevServers, []);
  const worktrees = data ?? [];
  const nothingFound =
    !isLoading && error === undefined && worktrees.length === 0;

  return (
    <List
      isLoading={isLoading}
      navigationTitle={`Run ${script}`}
      searchBarPlaceholder={`Pick a worktree to run ${script} in`}
    >
      {error !== undefined && (
        <List.EmptyView
          icon={Icon.Warning}
          title="Could not read the worktrees"
          description={errorMessage(error)}
        />
      )}
      {nothingFound && (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title={`No worktree has ${script}`}
          description={expandHome(repoPath)}
        />
      )}
      <List.Section title={basename(expandHome(repoPath))}>
        {worktrees.map((worktree) => (
          <List.Item
            key={worktree.path}
            title={worktree.name}
            keywords={[worktree.branch]}
            icon={worktree.isMain ? Icon.House : Icon.Folder}
            accessories={worktreeAccessories(worktree, servers)}
            actions={
              <ActionPanel>
                <Action
                  title="Run in Terminal"
                  icon={Icon.Play}
                  onAction={() =>
                    runAndClose(
                      () => openInTerminal(worktree.path, [script]),
                      "Could not start",
                    )
                  }
                />
                <Action.CopyToClipboard
                  title="Copy Path"
                  content={worktree.path}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
