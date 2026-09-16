#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Claude Panes
# @raycast.mode silent

# Optional parameters:
# @raycast.icon 🤖
# @raycast.packageName Claude
# @raycast.argument1 { "type": "text", "placeholder": "preset or folder" }
# @raycast.argument2 { "type": "text", "placeholder": "panes", "optional": true }

# Documentation:
# @raycast.description Open an iTerm tab split into panes running claude, for a cl preset or a folder

here=$(dirname "$(readlink -f "$0")")

args=()
for a in "$@"; do
  [ -n "$a" ] && args+=("$a")
done

exec "$here/../bin/cl" ${args[@]+"${args[@]}"}
