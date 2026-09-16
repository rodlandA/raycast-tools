import {
  Action,
  ActionPanel,
  Color,
  Detail,
  Icon,
  Keyboard,
  List,
  showToast,
  Toast,
  closeMainWindow,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { errorMessage } from "./lib/exec";
import { CheckState, listPullRequests, PullRequest } from "./lib/pullRequests";
import { findRepos } from "./lib/repos";
import { openUrl } from "./lib/run";
import { RootDropdown, useRoots } from "./lib/useRoots";

const STATE_TAGS: Record<CheckState, { value: string; color: Color }> = {
  passing: { value: "passing", color: Color.Green },
  failing: { value: "failing", color: Color.Red },
  running: { value: "running", color: Color.Yellow },
  none: { value: "no checks", color: Color.SecondaryText },
};

function ChecksDetail({ pullRequest }: { pullRequest: PullRequest }) {
  const rows = pullRequest.checks
    .map((check) => {
      let mark = "⏳";
      if (check.finished) {
        mark =
          check.conclusion === "SUCCESS" || check.conclusion === "NEUTRAL"
            ? "✅"
            : "❌";
      }
      return `| ${mark} | ${check.name} | ${check.conclusion || "pending"} |`;
    })
    .join("\n");

  const markdown =
    pullRequest.checks.length === 0
      ? `# #${pullRequest.number}\n\nThis pull request has no checks.`
      : `# #${pullRequest.number} ${pullRequest.title}\n\n| | Check | Result |\n|---|---|---|\n${rows}`;

  return (
    <Detail
      markdown={markdown}
      navigationTitle={`Checks for #${pullRequest.number}`}
      actions={
        <ActionPanel>
          <Action
            title="Open in Browser"
            icon={Icon.Globe}
            onAction={() =>
              openUrl(pullRequest.url).then(() => closeMainWindow())
            }
          />
        </ActionPanel>
      }
    />
  );
}

function PullRequestList({
  repoPath,
  name,
}: {
  repoPath: string;
  name: string;
}) {
  const { data, isLoading, error, revalidate } = usePromise(listPullRequests, [
    repoPath,
  ]);
  const pullRequests = data ?? [];

  async function open(pullRequest: PullRequest) {
    try {
      await openUrl(pullRequest.url);
      await closeMainWindow();
    } catch (caught) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Could not open the pull request",
        message: errorMessage(caught),
      });
    }
  }

  return (
    <List
      isLoading={isLoading}
      navigationTitle={name}
      searchBarPlaceholder="Filter pull requests"
    >
      {error !== undefined && (
        <List.EmptyView
          icon={Icon.Warning}
          title="Could not reach GitHub"
          description={errorMessage(error)}
        />
      )}
      {error === undefined && !isLoading && pullRequests.length === 0 && (
        <List.EmptyView icon={Icon.Check} title="No open pull requests" />
      )}
      {pullRequests.map((pullRequest) => (
        <List.Item
          key={pullRequest.number}
          title={pullRequest.title}
          subtitle={pullRequest.branch}
          icon={
            pullRequest.isDraft ? Icon.CircleProgress25 : Icon.CircleProgress100
          }
          accessories={[
            { tag: STATE_TAGS[pullRequest.state] },
            {
              text: `#${pullRequest.number}`,
              tooltip: `by ${pullRequest.author}`,
            },
          ]}
          actions={
            <ActionPanel>
              <Action
                title="Open in Browser"
                icon={Icon.Globe}
                onAction={() => open(pullRequest)}
              />
              <Action.Push
                title="Show Checks"
                icon={Icon.List}
                target={<ChecksDetail pullRequest={pullRequest} />}
              />
              <Action.CopyToClipboard
                title="Copy URL"
                content={pullRequest.url}
                shortcut={Keyboard.Shortcut.Common.Copy}
              />
              <Action
                title="Refresh"
                icon={Icon.ArrowClockwise}
                shortcut={Keyboard.Shortcut.Common.Refresh}
                onAction={revalidate}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

export default function Command() {
  const selection = useRoots();
  const { data, isLoading } = usePromise(findRepos, [selection.paths]);
  const repos = data ?? [];

  return (
    <List
      isLoading={isLoading || selection.isLoading}
      searchBarPlaceholder="Pick a repository"
      searchBarAccessory={<RootDropdown selection={selection} />}
    >
      {repos.map((repo) => (
        <List.Item
          key={repo.path}
          title={repo.name}
          icon={Icon.Code}
          accessories={
            repo.worktrees.length > 1
              ? [{ text: `${repo.worktrees.length} worktrees` }]
              : []
          }
          actions={
            <ActionPanel>
              <Action.Push
                title="Show Pull Requests"
                icon={Icon.List}
                target={
                  <PullRequestList repoPath={repo.path} name={repo.name} />
                }
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
