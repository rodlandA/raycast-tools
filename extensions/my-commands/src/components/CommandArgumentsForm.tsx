import { Action, ActionPanel, Form, Icon } from "@raycast/api";
import { CustomCommand } from "../lib/commands";

export function CommandArgumentsForm({
  command,
  onRun,
}: {
  command: CustomCommand;
  onRun: (args: string[]) => void;
}) {
  function submit(values: Record<string, string>) {
    onRun(command.args.map((argument) => values[argument.name] ?? ""));
  }

  return (
    <Form
      navigationTitle={command.title}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={`Run ${command.title}`}
            icon={Icon.Play}
            onSubmit={submit}
          />
        </ActionPanel>
      }
    >
      {command.args.map((argument) =>
        argument.type === "dropdown" ? (
          <Form.Dropdown
            key={argument.name}
            id={argument.name}
            title={argument.placeholder}
          >
            {argument.data.map((choice) => (
              <Form.Dropdown.Item
                key={choice.value}
                value={choice.value}
                title={choice.title}
              />
            ))}
          </Form.Dropdown>
        ) : (
          <Form.TextField
            key={argument.name}
            id={argument.name}
            title={argument.placeholder}
            placeholder={argument.optional ? "optional" : argument.placeholder}
          />
        ),
      )}
    </Form>
  );
}
