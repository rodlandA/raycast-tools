import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  getPreferenceValues,
  Icon,
  Keyboard,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { errorMessage } from "../lib/exec";
import {
  exitDescription,
  Job,
  JobState,
  listJobs,
  parsePrefixes,
  reload,
  runNow,
  shortName,
  groupOf,
} from "../lib/jobs";
import { openInEditor } from "../lib/run";
import { LogView } from "./LogView";

interface Preferences {
  labelPrefixes?: string;
}

const STATES: Record<
  JobState,
  { attention: boolean; tag: string; color: Color; icon: Icon }
> = {
  failed: {
    attention: true,
    tag: "Failed",
    color: Color.Red,
    icon: Icon.XMarkCircle,
  },
  unloaded: {
    attention: true,
    tag: "Not loaded",
    color: Color.Orange,
    icon: Icon.CircleDisabled,
  },
  running: {
    attention: false,
    tag: "Running",
    color: Color.Green,
    icon: Icon.CircleProgress50,
  },
  idle: {
    attention: false,
    tag: "OK",
    color: Color.SecondaryText,
    icon: Icon.CheckCircle,
  },
};

const PREVIEW_LINES = 30;

function statusText(job: Job): string {
  if (job.state === "running") {
    return `Running, PID ${job.pid}`;
  }
  if (!job.loaded) {
    return "Not loaded";
  }
  if (job.lastExit === undefined) {
    return "Not run yet";
  }
  return job.lastExit === 0
    ? "Last run OK"
    : `Last run failed, ${exitDescription(job.lastExit)}`;
}

function JobDetail({ job }: { job: Job }) {
  const preview = job.logTail.split("\n").slice(-PREVIEW_LINES).join("\n");
  const markdown =
    job.logPaths.length > 0
      ? `\`\`\`\n${preview || "(log is empty)"}\n\`\`\``
      : "_This job writes no log._";
  const state = STATES[job.state];

  return (
    <List.Item.Detail
      markdown={markdown}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.TagList title="Status">
            <List.Item.Detail.Metadata.TagList.Item
              text={statusText(job)}
              color={state.color}
            />
          </List.Item.Detail.Metadata.TagList>
          <List.Item.Detail.Metadata.Label
            title="Schedule"
            text={job.schedule}
          />
          <List.Item.Detail.Metadata.Label title="Label" text={job.label} />
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label title="Command" text={job.command} />
          {job.workingDirectory && (
            <List.Item.Detail.Metadata.Label
              title="Working Directory"
              text={job.workingDirectory}
            />
          )}
          {job.logPaths.map((path) => (
            <List.Item.Detail.Metadata.Label
              key={path}
              title="Log"
              text={path}
            />
          ))}
          {job.logUpdated && (
            <List.Item.Detail.Metadata.Label
              title="Log Written"
              text={job.logUpdated.toLocaleString()}
            />
          )}
        </List.Item.Detail.Metadata>
      }
    />
  );
}

export function JobList() {
  const { labelPrefixes = "" } = getPreferenceValues<Preferences>();
  const prefixes = parsePrefixes(labelPrefixes);
  const { data, isLoading, revalidate } = useCachedPromise(
    listJobs,
    [prefixes],
    {
      keepPreviousData: true,
    },
  );
  const jobs = data ?? [];

  async function perform(
    job: Job,
    verb: string,
    action: (job: Job) => Promise<void>,
    warning: string,
  ) {
    const confirmed = await confirmAlert({
      title: `${verb} ${job.label}?`,
      message: warning,
      primaryAction: { title: verb, style: Alert.ActionStyle.Default },
    });
    if (!confirmed) {
      return;
    }
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `${verb}…`,
    });
    try {
      await action(job);
      toast.style = Toast.Style.Success;
      toast.title = `${verb}: ${shortName(job.label, prefixes)}`;
    } catch (caught) {
      toast.style = Toast.Style.Failure;
      toast.title = `Could not ${verb.toLowerCase()} ${job.label}`;
      toast.message = errorMessage(caught);
    }
    revalidate();
  }

  function actionsFor(job: Job) {
    return (
      <ActionPanel>
        <ActionPanel.Section>
          {job.logPaths.map((path) => (
            <Action.Push
              key={path}
              title={
                job.logPaths.length > 1
                  ? `Show Log (${path.split("/").pop()})`
                  : "Show Log"
              }
              icon={Icon.Document}
              target={<LogView job={job} path={path} />}
            />
          ))}
          {job.loaded && (
            <Action
              title="Run Now"
              icon={Icon.Play}
              shortcut={{ modifiers: ["cmd"], key: "return" }}
              onAction={() =>
                perform(
                  job,
                  "Run",
                  runNow,
                  "Starts the job now, outside its schedule.",
                )
              }
            />
          )}
          <Action
            title={job.loaded ? "Reload" : "Load"}
            icon={Icon.RotateClockwise}
            shortcut={{ modifiers: ["cmd", "shift"], key: "r" }}
            onAction={() =>
              perform(
                job,
                job.loaded ? "Reload" : "Load",
                reload,
                job.state === "running"
                  ? "Stops the running process and loads the plist again."
                  : "Loads the plist again, picking up any changes to it.",
              )
            }
          />
        </ActionPanel.Section>
        <ActionPanel.Section>
          <Action
            title="Edit Plist in VS Code"
            icon={Icon.Code}
            shortcut={Keyboard.Shortcut.Common.Open}
            onAction={() => openInEditor(job.plistPath)}
          />
          <Action.ShowInFinder path={job.plistPath} />
          <Action.CopyToClipboard
            title="Copy Label"
            content={job.label}
            shortcut={Keyboard.Shortcut.Common.Copy}
          />
        </ActionPanel.Section>
        <ActionPanel.Section>
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={revalidate}
          />
        </ActionPanel.Section>
      </ActionPanel>
    );
  }

  const attention = jobs.filter((job) => STATES[job.state].attention);
  const groups = new Map<string, Job[]>();
  for (const job of jobs.filter((j) => !STATES[j.state].attention)) {
    const { group } = groupOf(job.label, prefixes);
    groups.set(group, [...(groups.get(group) ?? []), job]);
  }

  function item(job: Job, title: string) {
    const state = STATES[job.state];
    return (
      <List.Item
        key={job.label}
        title={title}
        keywords={[job.label]}
        icon={{ source: state.icon, tintColor: state.color }}
        accessories={[{ tag: { value: state.tag, color: state.color } }]}
        detail={<JobDetail job={job} />}
        actions={actionsFor(job)}
      />
    );
  }

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarPlaceholder="Filter jobs"
    >
      <List.Section title="Needs Attention">
        {attention.map((job) => item(job, shortName(job.label, prefixes)))}
      </List.Section>
      {[...groups.entries()].map(([group, members]) => (
        <List.Section key={group} title={group}>
          {members.map((job) => item(job, groupOf(job.label, prefixes).name))}
        </List.Section>
      ))}
    </List>
  );
}
