# Launchd Jobs

A Raycast extension for the jobs in `~/Library/LaunchAgents`: whether each one
is running, when it runs, how its last run ended, and the tail of its log — with
actions to run it now, reload it after editing the plist, or open the plist.

```bash
./install.sh launchd-jobs   # from the repository root
```

## What it shows

Jobs whose last run failed, or that are not loaded, come first under **Needs
Attention**. The rest are grouped by project: the label segment after a matching
prefix, so `com.example.backup.nightly` is `nightly` under `backup`, or the
reverse-DNS owner (`com.google`) when no prefix matches. The detail pane has the schedule in words
(`Mon–Fri 16:00`, `every 5 min`, `kept running`), the command, the log path and
the last lines of the log. Status comes from `launchctl list`, so a failed run
stays red until the job runs again and succeeds.

Set **Label Prefixes** in the preferences to see only your own jobs, e.g.
`com.example.,org.me.`. Naming your jobs `<prefix>.<project>.<job>` is what
makes the grouping useful. Left empty, every job in `~/Library/LaunchAgents` is shown.

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
