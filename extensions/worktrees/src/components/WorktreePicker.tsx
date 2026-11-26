import {
  Action,
  ActionPanel,
  Icon,
  Keyboard,
  List,
  showHUD,
  showToast,
  Toast,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { worktreeAccessories } from "../lib/accessories";
import { inspectDevServers } from "../lib/devServers";
import { errorMessage } from "../lib/exec";
import { openInTerminal, runAndClose } from "../lib/run";
import {
  runScriptAction,
  ScriptAction,
  scriptActions,
  ScriptVariant,
  scriptVariants,
} from "../lib/scriptActions";
import { expandHome, listWorktrees, Worktree } from "../lib/worktrees";

type PickableWorktree = Worktree & {
  actions: ScriptAction[];
  variants: ScriptVariant[];
};

async function worktreesWith(
  repoPath: string,
  script: string,
): Promise<PickableWorktree[]> {
  const worktrees = await listWorktrees(repoPath);
  const holding = worktrees.filter((worktree) =>
    existsSync(join(worktree.path, script)),
  );
  return Promise.all(
    holding.map(async (worktree) => ({
      ...worktree,
      actions: await scriptActions(worktree.path),
      variants: await scriptVariants(worktree.path, script),
    })),
  );
}

async function runDeclared(worktree: string, action: ScriptAction) {
  const toast = await showToast({
    style: Toast.Style.Animated,
    title: action.title,
  });
  try {
    const output = await runScriptAction(worktree, action);
    await toast.hide();
    await showHUD(output || action.title);
  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.message = errorMessage(error);
  }
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
                {worktree.variants.map((variant) => (
                  <Action
                    key={variant.title}
                    title={variant.title}
                    icon={Icon.Play}
                    onAction={() =>
                      runAndClose(
                        () =>
                          openInTerminal(worktree.path, [
                            script,
                            ...variant.args,
                          ]),
                        "Could not start",
                      )
                    }
                  />
                ))}
                <Action.CopyToClipboard
                  title="Copy Path"
                  content={worktree.path}
                  shortcut={Keyboard.Shortcut.Common.Copy}
                />
                {worktree.actions.length > 0 && (
                  <ActionPanel.Section title="From the Repository">
                    {worktree.actions.map((action) => (
                      <Action
                        key={`${action.script} ${action.args.join(" ")}`}
                        title={action.title}
                        icon={Icon.Terminal}
                        onAction={() => runDeclared(worktree.path, action)}
                      />
                    ))}
                  </ActionPanel.Section>
                )}
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
