import { Color, List } from "@raycast/api";
import { DevServerSnapshot } from "./devServers";
import { Worktree } from "./worktrees";

export function worktreeAccessories(
  worktree: Worktree,
  servers: DevServerSnapshot | undefined,
): List.Item.Accessory[] {
  const tags: List.Item.Accessory[] = [];
  const port = servers?.frontendPorts.get(worktree.path);
  if (port !== undefined) {
    tags.push({ tag: { value: `:${port}`, color: Color.Green } });
  }
  if (worktree.isMain) {
    tags.push({ tag: { value: "main", color: Color.SecondaryText } });
  }
  if (worktree.upstreamGone) {
    tags.push({ tag: { value: "branch gone", color: Color.Red } });
  }
  return [...tags, { text: worktree.branch }];
}
