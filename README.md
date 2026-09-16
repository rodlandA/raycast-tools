# raycast-tools

Raycast extensions and shell helpers for working with several git worktrees and
Claude Code sessions at once on macOS. Take all of it, or only the parts you
want.

| Name | Kind | What it does |
|------|------|--------------|
| [worktrees](extensions/worktrees) | Raycast extension | Jump between the worktrees of every repository you have, open them, create and remove them |
| [my-commands](extensions/my-commands) | Raycast extension | Every script command, self-built extension and shell helper you have, in one searchable list |
| [Claude Panes, Claude Sessions](#raycast-script-commands) | Raycast script commands | `cl` and `claude-sessions` from the Raycast search bar |
| [cl](#cl) | script | Open an iTerm2 tab split into a grid of panes, each running `claude` |
| [claude-sessions](#claude-sessions) | script | List the running Claude sessions and where each one works |
| [iterm-run](#iterm-run) | script | Open an iTerm2 tab in a directory and run a command there |

## Install

```bash
git clone https://github.com/rodlandA/raycast-tools ~/Dev/raycast-tools
cd ~/Dev/raycast-tools

./install.sh --list              # what there is
./install.sh                     # everything
./install.sh worktrees iterm-run # or only what you want
```

Scripts are symlinked into `~/.local/bin`, so a `git pull` updates them in place.
Extensions are built into Raycast, which needs Node and npm — rerun
`./install.sh` with the same names after a pull to rebuild them.

The installer never overwrites something already at a target path. It tells you
what it skipped; `--force` replaces it and keeps a `.bak`. `--dry-run` shows
what would happen.

The Raycast script commands are not installed this way — see
[Raycast script commands](#raycast-script-commands).

Make sure `~/.local/bin` is on your `PATH`:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
```

### What depends on what

Nothing is required, but some parts get better together. The **worktrees**
extension hides an action whose helper is missing rather than failing:

- **Run Script** needs `iterm-run`
- **Open Claude Panes** needs `cl`
- **Review Changes** needs a `git-review` helper, which is not in this repository

## Adding something

- **A script:** put an executable file in `bin/`. Its first comment line after
  the shebang is what `--list` shows. Commit and push; colleagues pull and run
  `./install.sh <name>` once to get the link.
- **An extension:** put the Raycast extension in `extensions/<name>/`. The
  installer finds it by its `package.json` and builds it.
- **A Raycast script command:** put it in `script-commands/`. Call a script from
  `bin/` relative to the command's own path, as the existing ones do, so it works
  without running the installer.

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

The [worktrees](extensions/worktrees) extension uses this to run a worktree's scripts.

## Raycast script commands

`script-commands/` holds **Claude Panes** and **Claude Sessions**. Raycast reads
script commands straight from a folder, so there is nothing to install: add

```
~/Dev/raycast-tools/script-commands
```

under Raycast → Settings → Extensions → Script Commands → Add Directories. A
`git pull` updates them. They call `cl` and `claude-sessions` from this
repository's `bin/`, so they work without `./install.sh`.

**Claude Panes** takes a `cl` preset or a folder, and optionally a pane count.

## License

[MIT](LICENSE)
