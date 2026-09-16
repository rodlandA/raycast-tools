import { getPreferenceValues, List } from "@raycast/api";
import { useLocalStorage, usePromise } from "@raycast/utils";
import { ALL_ROOTS, discoverRoots, Root } from "./roots";
import { expandHome } from "./worktrees";

interface Preferences {
  extraRoots?: string;
}

function parseExtra(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map(expandHome);
}

// Takes the raw preference string, so usePromise sees a stable argument.
function discover(extraRoots: string): Promise<Root[]> {
  return discoverRoots(parseExtra(extraRoots));
}

export interface RootSelection {
  roots: Root[];
  selected: string | undefined;
  select: (value: string) => void;
  paths: string[];
  isLoading: boolean;
}

/**
 * The code roots found on this machine and the one the user last picked. The
 * pick is remembered, and falls back to the root holding the most repositories.
 */
export function useRoots(): RootSelection {
  const { extraRoots = "" } = getPreferenceValues<Preferences>();
  const { data, isLoading: discovering } = usePromise(discover, [extraRoots]);
  const {
    value: saved,
    setValue,
    isLoading: restoring,
  } = useLocalStorage<string>("selected-root");

  const roots = data ?? [];
  const isKnown = saved === ALL_ROOTS || roots.some((r) => r.path === saved);
  const selected = isKnown ? saved : roots[0]?.path;

  let paths: string[] = [];
  if (selected === ALL_ROOTS) {
    paths = roots.map((root) => root.path);
  } else if (selected !== undefined) {
    paths = [selected];
  }

  return {
    roots,
    selected,
    select: (value) => void setValue(value),
    paths,
    isLoading: discovering || restoring,
  };
}

export function RootDropdown({ selection }: { selection: RootSelection }) {
  const { roots, selected, select } = selection;
  if (roots.length === 0) {
    return null;
  }
  return (
    <List.Dropdown
      tooltip="Where to look for repositories"
      value={selected}
      onChange={select}
    >
      <List.Dropdown.Section>
        {roots.map((root) => (
          <List.Dropdown.Item
            key={root.path}
            value={root.path}
            title={`${root.label}  ·  ${root.repoCount}`}
          />
        ))}
      </List.Dropdown.Section>
      {roots.length > 1 && (
        <List.Dropdown.Section>
          <List.Dropdown.Item value={ALL_ROOTS} title="All roots" />
        </List.Dropdown.Section>
      )}
    </List.Dropdown>
  );
}
