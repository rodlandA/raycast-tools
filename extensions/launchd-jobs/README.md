# Launchd Jobs

A Raycast extension for the jobs in `~/Library/LaunchAgents`: whether each one
is running, when it runs, how its last run ended, and the tail of its log — with
actions to run it now, reload it after editing the plist, or open the plist.

```bash
./install.sh launchd-jobs   # from the repository root
```

## What it shows

Jobs are grouped as **Needs Attention** (last run failed, or not loaded),
**Running** and **Scheduled**. The detail pane has the schedule in words
(`Mon–Fri 16:00`, `every 5 min`, `kept running`), the command, the log path and
the last lines of the log. Status comes from `launchctl list`, so a failed run
stays red until the job runs again and succeeds.

Set **Label Prefixes** in the preferences to see only your own jobs, e.g.
`com.example.,org.me.` — the matching prefix is also dropped from the names in
the list. Left empty, every job in `~/Library/LaunchAgents` is shown.

## Actions

| Action | Shortcut | What it runs |
|---|---|---|
| Show Log | ↵ | The last 256 KB of the job's log |
| Run Now | ⌘↵ | `launchctl kickstart` |
| Reload / Load | ⌘⇧R | `launchctl bootout` + `bootstrap` — stops a running job |
| Edit Plist in VS Code | ⌘O | `code <plist>` |

Run Now and Reload ask first. Only user agents are covered; jobs in
`/Library/LaunchAgents` and `/Library/LaunchDaemons` need root to manage.

## Developing

Use `npm run dev` while editing — it hot-reloads and streams errors into the
Raycast window.
