import {
  Action,
  ActionPanel,
  Form,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { basename } from "node:path";
import { useState } from "react";
import { errorMessage } from "../lib/exec";
import { openInEditor } from "../lib/run";
import { addWorktree, defaultBranch } from "../lib/worktrees";

interface Values {
  branch: string;
  slug: string;
  base: string;
}

export function NewWorktreeForm({
  repoPath,
  onCreated,
}: {
  repoPath: string;
  onCreated: () => void;
}) {
  const { pop } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const { data: detectedBase } = usePromise(defaultBranch, [repoPath]);

  async function submit(values: Values) {
    const branch = values.branch.trim();
    if (branch.length === 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Branch is required",
      });
      return;
    }
    const slug = values.slug.trim() || branch.split("/").pop() || branch;

    setIsLoading(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `Creating ${branch}`,
    });
    try {
      const base = values.base.trim() || (await defaultBranch(repoPath));
      const path = await addWorktree(repoPath, branch, slug, base);
      toast.style = Toast.Style.Success;
      toast.title = "Worktree created";
      toast.message = path;
      onCreated();
      pop();
      await openInEditor(path);
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Could not create worktree";
      toast.message = errorMessage(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      navigationTitle={`New Worktree in ${basename(repoPath)}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Worktree" onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="branch" title="Branch" placeholder="feat/my-thing" />
      <Form.TextField
        id="slug"
        title="Folder suffix"
        placeholder="my-thing"
        info="Defaults to the last part of the branch name."
      />
      <Form.TextField
        id="base"
        title="Base"
        placeholder={detectedBase ?? "default branch"}
        info="Leave empty to start from the repository's default branch."
      />
    </Form>
  );
}
