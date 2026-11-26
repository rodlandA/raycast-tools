import { LaunchProps } from "@raycast/api";
import { WorktreeList } from "./components/WorktreeList";
import { WorktreePicker } from "./components/WorktreePicker";

interface ScriptContext {
  repo?: string;
  script?: string;
}

export default function Command({
  launchContext,
}: LaunchProps<{ launchContext: ScriptContext }>) {
  const { repo, script } = launchContext ?? {};
  if (repo !== undefined && script !== undefined) {
    return <WorktreePicker repoPath={repo} script={script} />;
  }
  return <WorktreeList mode="scripts" />;
}
