#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Claude Sessions
# @raycast.mode fullOutput

# Optional parameters:
# @raycast.icon 🧠
# @raycast.packageName Claude

# Documentation:
# @raycast.description Which Claude sessions are running, and in which folder

here=$(dirname "$(readlink -f "$0")")

exec "$here/../bin/claude-sessions"
