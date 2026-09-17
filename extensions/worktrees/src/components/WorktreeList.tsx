import {
  Action,
  ActionPanel,
  Alert,
  confirmAlert,
  Icon,
  List,
  showToast,
  Toast,
  Keyboard,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { worktreeAccessories } from "../lib/accessories";
import { inspectDevServers } from "../lib/devServers";
import { findRepos } from "../lib/repos";
import { RootDropdown, useRoots } from "../lib/useRoots";
import { errorMessage } from "../lib/exec";
import { hasHelper } from "../lib/helpers";
import {
  openClaudePanes,
  openInEditor,
  openInTerminal,
  openUrl,
  openReview,
  runAndClose,
} from "../lib/run";
import {
  expandHome,
  pullRequestUrl,
  removeWorktree,
  Worktree,
} from "../lib/worktrees";
import { NewWorktreeForm } from "./NewWorktreeForm";
import { PhoneQrDetail } from "./PhoneQrDetail";
import { ScriptList } from "./ScriptList";

type Mode = "manage" | "scripts" | "phone-qr";

export function WorktreeList({ mode }: { mode: Mode }) {
  const selection = useRoots();
  const { data, isLoading, error, revalidate } = usePromise(findRepos, [
    selection.paths,
  ]);
  const { data: servers } = usePromise(inspectDevServers, []);
  const repos = data ?? [];
  const canRunClaude = hasHelper("cl");
  const canReview = hasHelper("git-review");

  // Phone QR is driven by a script the repository has to supply itself.
  function canPhoneQr(worktree: Worktree): boolean {
    return existsSync(
      join(expandHome(worktree.repoPath), "scripts", "phone-qr.sh"),
    );
  }

  async function openPullRequest(worktree: Worktree) {
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Looking for a pull request",
    });
    let url: string | null;
    try {
      url = await pullRequestUrl(worktree.path);
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Could not look up the pull request";
      toast.message = errorMessage(error);
      return;
    }
    if (url === null) {
      toast.style = Toast.Style.Failure;
      toast.title = `No pull request for ${worktree.branch}`;
      return;
    }
    toast.hide();
    await runAndClose(() => openUrl(url), "Could not open the pull request");
  }

  async function remove(worktree: Worktree) {
    const confirmed = await confirmAlert({
      title: `Remove ${worktree.name}?`,
      message: "The folder is deleted. The branch itself is kept.",
      primaryAction: { title: "Remove", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) {
      return;
    }
    try {
      await removeWorktree(worktree.repoPath, worktree.path);
      await showToast({
        style: Toast.Style.Success,
        title: `Removed ${worktree.name}`,
      });
      revalidate();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Could not remove",
        message: errorMessage(error),
      });
    }
  }

  function actionsFor(worktree: Worktree) {
    const scripts = (
      <Action.Push
        key="scripts"
        title="Run Script…"
        icon={Icon.Play}
        target={<ScriptList worktree={worktree.path} name={worktree.name} />}
      />
    );
    const editor = (
      <Action
        key="editor"
        title="Open in VS Code"
        icon={Icon.Code}
        onAction={() =>
          runAndClose(
            () => openInEditor(worktree.path),
            "Could not open VS Code",
          )
        }
      />
    );
    const terminal = (
      <Action
        key="terminal"
        title="Open in Terminal"
        icon={Icon.Terminal}
        onAction={() =>
          runAndClose(
            () => openInTerminal(worktree.path),
            "Could not open the terminal",
          )
        }
      />
    );
    const claude = (
      <Action
        key="claude"
        title="Open Claude Panes"
        icon={Icon.Stars}
        shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
        onAction={() =>
          runAndClose(
            () => openClaudePanes(worktree.path),
            "Could not start cl",
          )
        }
      />
    );

    const phone = (
      <Action.Push
        key="phone"
        title="Phone QR…"
        icon={Icon.Mobile}
        target={
          <PhoneQrDetail
            worktree={worktree.path}
            name={worktree.name}
            repoPath={worktree.repoPath}
          />
        }
      />
    );

    const claudeAction = canRunClaude ? [claude] : [];
    const phoneAction = canPhoneQr(worktree) ? [phone] : [];
    const primary: Record<Mode, React.JSX.Element[]> = {
      manage: [editor, terminal, ...claudeAction, scripts, ...phoneAction],
      scripts: [scripts, editor, terminal, ...claudeAction, ...phoneAction],
      "phone-qr": [...phoneAction, editor, terminal, ...claudeAction, scripts],
    };

    return (
      <ActionPanel>
        <ActionPanel.Section>{primary[mode]}</ActionPanel.Section>
        <ActionPanel.Section>
          {/* The main checkout tracks the base branch, so there is nothing to
              review against. */}
          {canReview && !worktree.isMain && (
            <Action
              title="Review Changes"
              icon={Icon.MagnifyingGlass}
              shortcut={{ modifiers: ["cmd", "shift"], key: "r" }}
              onAction={() =>
                runAndClose(
                  () => openReview(worktree.path, "browser"),
                  "Could not run git review",
                )
              }
            />
          )}
          {canReview && !worktree.isMain && (
            <Action
              title="Review as Document"
              icon={Icon.Document}
              onAction={() =>
                runAndClose(
                  () => openReview(worktree.path, "document"),
                  "Could not run git review",
                )
              }
            />
          )}
          <Action
            title="Open Pull Request"
            icon={Icon.Globe}
            shortcut={Keyboard.Shortcut.Common.Open}
            onAction={() => openPullRequest(worktree)}
          />
          <Action.CopyToClipboard
            title="Copy Path"
            content={worktree.path}
            shortcut={Keyboard.Shortcut.Common.Copy}
          />
          <Action.ShowInFinder path={worktree.path} />
        </ActionPanel.Section>
        <ActionPanel.Section>
          <Action.Push
            title="New Worktree"
            icon={Icon.Plus}
            shortcut={Keyboard.Shortcut.Common.New}
            target={
              <NewWorktreeForm
                repoPath={worktree.repoPath}
                onCreated={revalidate}
              />
            }
          />
          {!worktree.isMain && (
            <Action
              title="Remove Worktree"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              shortcut={Keyboard.Shortcut.Common.Remove}
              onAction={() => remove(worktree)}
            />
          )}
        </ActionPanel.Section>
      </ActionPanel>
    );
  }

  const nothingFound =
    !isLoading &&
    !selection.isLoading &&
    error === undefined &&
    repos.length === 0;

  return (
    <List
      isLoading={isLoading || selection.isLoading}
      searchBarPlaceholder="Filter worktrees"
      searchBarAccessory={<RootDropdown selection={selection} />}
    >
      {error !== undefined && (
        <List.EmptyView
          icon={Icon.Warning}
          title="Could not read the repositories"
          description={errorMessage(error)}
        />
      )}
      {nothingFound && (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No git repositories found"
          description="Nothing under your home folder holds a git repository. Add a location outside it under Extra Roots in the extension preferences."
        />
      )}
      {repos.map((repo) => (
        <List.Section
          key={repo.path}
          title={repo.name}
          subtitle={
            repo.worktrees.length > 1 ? `${repo.worktrees.length}` : undefined
          }
        >
          {repo.worktrees.map((worktree) => (
            <List.Item
              key={worktree.path}
              title={worktree.name}
              keywords={[repo.name, worktree.branch]}
              icon={worktree.isMain ? Icon.House : Icon.Folder}
              accessories={worktreeAccessories(worktree, servers)}
              actions={actionsFor(worktree)}
            />
          ))}
        </List.Section>
      ))}
    </List>
  );
}
