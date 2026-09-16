# My Commands

A Raycast extension that lists everything you have made for yourself in one
searchable place: your script commands, the extensions you built locally, and
the shell helpers in `~/.local/bin` that nothing else calls.

```bash
./install.sh my-commands   # from the repository root
```

## What it finds

**Script commands** — Raycast keeps the folders it loads them from in an
encrypted database, so the extension looks for the files instead: anything under
your home folder carrying `@raycast.schemaVersion`. The first search takes a
couple of seconds; after that the list opens from cache and refreshes in the
background. "Rescan Script Folders" (⌘R) searches again.

It cannot tell a folder Raycast actually loads from one that merely contains
script commands, such as a cloned collection you never added. When more than one
folder is found, a dropdown in the search bar filters by folder, which makes a
stray one easy to spot. To skip the search entirely, list your folders under
**Script Command Folders** in the preferences.

Commands are grouped by `@raycast.packageName`, and their arguments are asked
for in a form before running. A script linked into a folder and found again at
its source is listed once.

**Extensions** — those you built yourself with `ray build`. Store extensions are
left out: Raycast installs them in folders named by a UUID, while a local build
lives in a folder named after the extension.

**Shell helpers** — executable scripts in `~/.local/bin`, following symlinks. A
helper that a script command calls is plumbing and is hidden; so are compiled
programs and backup files.

## Developing

Use `npm run dev` while editing — it hot-reloads and streams errors into the
Raycast window.
