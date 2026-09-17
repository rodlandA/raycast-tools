# Scripts

Installed by name from the repository root, for example `./install.sh cl`. Each
one is symlinked into `~/.local/bin`, so a `git pull` updates it in place.

## cl

Opens an iTerm2 tab split into a grid of panes, each one `cd`-ed into a project
directory and running `claude`.

```bash
cl                    # 4 panes in the current directory
cl myrepo             # a preset: its directory and pane count
cl myrepo 6           # the preset's directory, 6 panes
cl ~/Dev/animals 2    # 2 panes in an arbitrary directory
cl --list             # registered presets and aliases
cl myrepo --dry-run   # print what would happen, run nothing
```

Running it again for the same target **reuses the tab it opened last time**
rather than making a second one — it remembers the session id in
`~/.local/state/cl/tabs` and focuses it. `--new` forces a fresh tab.

### Presets

The first run writes `~/.config/cl/projects.zsh`. It is a zsh file, so a preset
is a function call:

```zsh
cl_project myrepo ~/Dev/myrepo 4

# One pane per command instead of a pane count — the whole stack in one tab.
cl_project myrepo-stack ~/Dev/myrepo \
  claude \
  "cd Backend && dotnet watch run" \
  "cd Frontend && npm run dev"

# Aliases mean one word to repoint as you move between projects.
cl_alias dev myrepo
```

With a command-list preset, a pane count still works: `cl myrepo-stack 5` takes
the first five commands, padding with `claude` if the list is shorter.

The grid is laid out column-major and as square as it can be — 4 panes is 2×2,
6 is 3 columns. The maximum is 16.

**Requires zsh and iTerm2.** The panes are built with AppleScript against
iTerm2's scripting dictionary; Terminal.app will not work.

## claude-sessions

Lists the running `claude` processes with how long each has been up and which
directory it works in.

```
$ claude-sessions
48213    02:14:07   /Users/you/Dev/myrepo
51902    00:08:31   /Users/you/Dev/myrepo-feature-x

2 session(s). Use Kill Process to end one.
```

Useful when several worktrees are in flight and you have lost track of which
tab is which. "Kill Process" is Raycast's built-in command.

## iterm-run

Opens an iTerm2 tab in a directory, and optionally runs a command there.

```bash
iterm-run ~/Dev/myrepo                    # a shell in that directory
iterm-run ~/Dev/myrepo ./run-dev.sh       # and run this
iterm-run ~/Dev/myrepo sh -c 'a && b'     # shell operators need an explicit shell
```

Each argument is quoted separately, so a pipeline or `&&` has to go through
`sh -c`. Every call gets a fresh tab on purpose: writing into a session that is
already busy would land the text in whatever is running there.

The [worktrees](../extensions/worktrees) extension uses this to run a worktree's scripts.

## worktree-run

Picks one of a repository's worktrees in Raycast, then runs a script there.

```bash
worktree-run ~/Dev/myrepo ./run-dev.sh
```

It opens **Run Script** from the [worktrees](../extensions/worktrees) extension
narrowed to that repository, listing only the worktrees that have the script.
Wrap it in a Raycast script command and one command runs the same script in
whichever worktree you pick.

Raycast asks before a deeplink starts a command. Choose **Always Open Command**
and it stops asking.
