import {
  Action,
  ActionPanel,
  closeMainWindow,
  Color,
  Icon,
  Keyboard,
  launchCommand,
  LaunchType,
  List,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { CustomCommand, listCommands, sectionsOf } from "../lib/commands";
import { errorMessage, exec } from "../lib/exec";
import { openInEditor } from "../lib/run";
import { CommandArgumentsForm } from "./CommandArgumentsForm";
import { CommandOutput } from "./CommandOutput";
import { HelperDetail } from "./HelperDetail";

function iconFor(command: CustomCommand) {
  if (command.icon !== undefined) {
    return command.icon;
  }
  return command.kind === "helper" ? Icon.Terminal : Icon.AppWindow;
}

function accessories(command: CustomCommand) {
  const tags = [];
  if (command.args.length > 0) {
    const plural = command.args.length === 1 ? "" : "s";
    tags.push({
      tag: {
        value: `${command.args.length} argument${plural}`,
        color: Color.Blue,
      },
    });
  }
  if (command.kind === "script" && command.mode !== "silent") {
    tags.push({ tag: { value: command.mode, color: Color.SecondaryText } });
  }
  return tags;
}

export function CommandList() {
  const { push } = useNavigation();
  const { data, isLoading, error } = usePromise(listCommands);
  const commands = data ?? [];

  async function run(command: CustomCommand, args: string[]) {
    if (command.mode !== "silent") {
      push(<CommandOutput command={command} args={args} />);
      return;
    }
    try {
      await exec(command.path, args);
      await closeMainWindow();
    } catch (caught) {
      await showToast({
        style: Toast.Style.Failure,
        title: `Could not run ${command.title}`,
        message: errorMessage(caught),
      });
    }
  }

  async function open(command: CustomCommand) {
    try {
      await launchCommand({
        name: command.extensionCommand ?? "",
        type: LaunchType.UserInitiated,
      });
    } catch (caught) {
      await showToast({
        style: Toast.Style.Failure,
        title: `Could not open ${command.title}`,
        message: errorMessage(caught),
      });
    }
  }

  function primaryAction(command: CustomCommand) {
    if (command.kind === "extension") {
      return (
        <Action
          title="Open Command"
          icon={Icon.AppWindow}
          onAction={() => open(command)}
        />
      );
    }
    if (command.kind === "helper") {
      return (
        <Action.Push
          title="Show Usage"
          icon={Icon.Info}
          target={<HelperDetail command={command} />}
        />
      );
    }
    if (command.args.length > 0) {
      return (
        <Action.Push
          title="Run…"
          icon={Icon.Play}
          target={
            <CommandArgumentsForm
              command={command}
              onRun={(args) => run(command, args)}
            />
          }
        />
      );
    }
    return (
      <Action title="Run" icon={Icon.Play} onAction={() => run(command, [])} />
    );
  }

  function actionsFor(command: CustomCommand) {
    return (
      <ActionPanel>
        <ActionPanel.Section>{primaryAction(command)}</ActionPanel.Section>
        <ActionPanel.Section>
          <Action
            title="Open in VS Code"
            icon={Icon.Code}
            shortcut={Keyboard.Shortcut.Common.Open}
            onAction={() => openInEditor(command.path)}
          />
          <Action.CopyToClipboard
            title="Copy Path"
            content={command.path}
            shortcut={Keyboard.Shortcut.Common.Copy}
          />
          <Action.ShowInFinder path={command.path} />
        </ActionPanel.Section>
      </ActionPanel>
    );
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Filter commands">
      {error !== undefined && (
        <List.EmptyView
          icon={Icon.Warning}
          title="Could not read the commands"
          description={errorMessage(error)}
        />
      )}
      {sectionsOf(commands).map((section) => (
        <List.Section key={section} title={section}>
          {commands
            .filter((command) => command.section === section)
            .map((command) => (
              <List.Item
                key={command.id}
                title={command.title}
                subtitle={command.description}
                icon={iconFor(command)}
                accessories={accessories(command)}
                actions={actionsFor(command)}
              />
            ))}
        </List.Section>
      ))}
    </List>
  );
}
