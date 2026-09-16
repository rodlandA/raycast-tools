#!/usr/bin/env bash
#
# Symlink bin/* into ~/.local/bin.
#
# Usage: ./install.sh [--force] [--dry-run]
#
# A regular file already in place is left alone and reported, so an existing
# copy is never clobbered without asking. --force replaces it, keeping a .bak.

set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "$0")/bin" && pwd)"
TARGET_DIR="$HOME/.local/bin"

force=0
dry=0
while [ $# -gt 0 ]; do
    case "$1" in
        --force)   force=1; shift ;;
        --dry-run) dry=1; shift ;;
        -h|--help) sed -n '3,9p' "$0" | cut -c3-; exit 0 ;;
        *) echo "install: unknown option '$1'" >&2; exit 1 ;;
    esac
done

say() {
    if [ "$dry" -eq 1 ]; then
        echo "would $*"
    else
        echo "$*"
    fi
}

run() {
    [ "$dry" -eq 1 ] || "$@"
}

run mkdir -p "$TARGET_DIR"

skipped=0
for source in "$SOURCE_DIR"/*; do
    name=$(basename "$source")
    target="$TARGET_DIR/$name"

    if [ -L "$target" ] && [ "$(readlink "$target")" = "$source" ]; then
        echo "ok       $name"
        continue
    fi

    if [ -e "$target" ] && [ ! -L "$target" ] && [ "$force" -eq 0 ]; then
        echo "skipped  $name — $target exists; rerun with --force to replace it"
        skipped=$((skipped + 1))
        continue
    fi

    if [ -e "$target" ] && [ ! -L "$target" ]; then
        say "backup   $name -> $target.bak"
        run mv "$target" "$target.bak"
    fi

    say "link     $name"
    run ln -sfn "$source" "$target"
done

case ":$PATH:" in
    *":$TARGET_DIR:"*) ;;
    *) echo; echo "Note: $TARGET_DIR is not on your PATH." ;;
esac

if [ "$skipped" -gt 0 ]; then
    exit 1
fi
