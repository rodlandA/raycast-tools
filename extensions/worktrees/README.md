# Worktrees

Raycast extension for jumping between the git worktrees of a repository —
useful when several agents or branches are in flight at once and each has its
own checkout.

No setup: it finds the folders under your home that hold git repositories and
lists their worktrees, grouped by repository. Pick where to look from the
dropdown in the search bar — the choice is remembered. New worktrees are created
next to the main checkout as `<repo>-<slug>`.

Code outside your home folder, such as on an external volume, goes under **Extra
Roots** in the preferences.

## Commands

**Worktrees** — every worktree of the repository, with the branch as accessory
and a red `branch gone` tag when the upstream has been deleted, which is what a
merged branch looks like locally.

| Action | Shortcut |
|--------|----------|
| Open in VS Code | ⏎ |
| Open in Terminal | ⌘⏎ (Raycast assigns it to the second action) |
| Open Claude Panes | ⌘⇧⏎ — needs `cl` |
| Run Script… | in the panel |
| Review Changes | ⌘⇧R — needs `git-review` |
| Open Pull Request | ⌘O — resolved with `gh`, opened in the default browser |
| Copy Path | ⌘⇧C |
| New Worktree | ⌘N |
| Remove Worktree | ⌃X, confirms first |

Creating and removing worktrees lives in the same command as opening them, on
purpose: one place that knows about worktrees rather than three commands to
remember.

**Pull Requests** — pick a repository, then its open pull requests with a
`passing` / `failing` / `running`
tag rolled up from all their checks. "Show Checks" lists each check and its
result, so a red tag doesn't mean a trip to the browser to find out which one
broke.

**Run Script** — the same worktree list, but starting a script is the primary
action. Reads `package.json` from the repository root or a `Frontend`/`web`/
`client`/`app` subdirectory, plus the `*.sh` files at the root and in
`scripts/`, so each worktree offers its own.

**My Commands** — an index over every Raycast script command grouped by
`@raycast.packageName`, this extension's own commands, and the helpers in
`~/.local/bin` that no command calls. It reads the same metadata Raycast does,
so a new wrapper turns up there on its own, arguments included. Grouping is
only as good as the package names, so give a new wrapper the same
`@raycast.packageName` as its neighbours.

**Phone QR** — renders a repository's own `scripts/phone-qr.sh --urls <port>`
output as QR codes, for opening a running dev stack on a phone. The action only
appears when the repository actually supplies that script. Raycast markdown
ignores `file://` images, so the PNGs are written to
`~/Library/Caches/worktrees-phone-qr/` and referenced by tilde path.

## Optional helpers

Three actions shell out to helpers in `~/.local/bin`, and each is **hidden when
its helper is not installed** rather than left to fail:

| Helper | Gives you |
|--------|-----------|
| `cl` | Open Claude Panes — a grid of iTerm2 panes running `claude` |
| `git-review` | Review Changes — the branch's cumulative diff against its merge-base |
| `iterm-run` | Running a script in a new iTerm tab |

Without `iterm-run`, "Open in Terminal" falls back to Terminal.app, but Run
Script needs it — there is no way to send a command to a tab without it.

`cl` and `iterm-run` are in [this repository](../../README.md) — install them by name alongside the extension.

## Install

From the root of this repository:

```bash
./install.sh worktrees            # the extension on its own
./install.sh worktrees iterm-run  # plus what Run Script needs
```

See the [repository README](../../README.md) for the rest.

## Developing

Use `npm run dev` while editing — it hot-reloads and streams errors into the
Raycast window.

## Notes

Raycast starts the extension with a minimal `PATH`, so `src/lib/exec.ts` sets
one that covers `/usr/local/bin` and `~/.local/bin`. Without it `git`, `gh`,
`code` and the helpers are all "not found".
