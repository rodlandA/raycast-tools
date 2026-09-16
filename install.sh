#!/usr/bin/env bash
#
# Install scripts from bin/ and Raycast extensions from extensions/.
#
# Usage: ./install.sh [name ...] [--list] [--force] [--dry-run]
#
#   ./install.sh                 everything
#   ./install.sh worktrees cl    only these
#   ./install.sh --list          what there is to install
#
# A script is symlinked into ~/.local/bin, so a git pull updates it in place.
# An extension is built and registered with Raycast, which has to be running;
# rerun this after a pull to update it.
# Anything already at a target path is left alone unless --force, which keeps
# a .bak.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$ROOT/bin"
EXTENSIONS_DIR="$ROOT/extensions"
TARGET_DIR="$HOME/.local/bin"

force=0
dry=0
list=0
wanted=""
while [ $# -gt 0 ]; do
    case "$1" in
        --force)   force=1 ;;
        --dry-run) dry=1 ;;
        --list)    list=1 ;;
        -h|--help) sed -n '3,15p' "$0" | cut -c3-; exit 0 ;;
        -*) echo "install: unknown option '$1'" >&2; exit 1 ;;
        *) wanted="$wanted $1" ;;
    esac
    shift
done

scripts() {
    local f
    for f in "$BIN_DIR"/*; do
        [ -f "$f" ] && [ -x "$f" ] && basename "$f"
    done
}

extensions() {
    local d
    for d in "$EXTENSIONS_DIR"/*/; do
        [ -f "$d/package.json" ] && basename "$d"
    done
}

script_summary() {
    sed -n '2,6{s/^# *//;/^$/d;p;}' "$BIN_DIR/$1" | head -1 | sed -e "s/^$1 — //" -e 's/\.$//' | awk '{ print toupper(substr($0, 1, 1)) substr($0, 2) }'
}

extension_summary() {
    grep -m1 '"description"' "$EXTENSIONS_DIR/$1/package.json" | sed 's/.*"description": *"\(.*\)",*$/\1/'
}

is_wanted() {
    [ -z "$wanted" ] && return 0
    case " $wanted " in
        *" $1 "*) return 0 ;;
    esac
    return 1
}

if [ "$list" -eq 1 ]; then
    echo "Scripts (symlinked into $TARGET_DIR):"
    for name in $(scripts); do
        printf '  %-18s %s\n' "$name" "$(script_summary "$name")"
    done
    echo
    echo "Raycast extensions:"
    for name in $(extensions); do
        printf '  %-18s %s\n' "$name" "$(extension_summary "$name")"
    done
    echo
    echo "Raycast script commands are not installed by this script. Add this folder in"
    echo "Raycast → Settings → Extensions → Script Commands → Add Directories:"
    echo "  $ROOT/script-commands"
    exit 0
fi

for name in $wanted; do
    if [ ! -x "$BIN_DIR/$name" ] && [ ! -f "$EXTENSIONS_DIR/$name/package.json" ]; then
        echo "install: nothing called '$name' — see ./install.sh --list" >&2
        exit 1
    fi
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

failed=0

link_script() {
    local name=$1 source="$BIN_DIR/$1" target="$TARGET_DIR/$1"

    if [ -L "$target" ] && [ "$(readlink "$target")" = "$source" ]; then
        echo "ok       $name"
        return
    fi

    # -e follows a symlink, so a dangling one from an old checkout is simply relinked.
    if [ -e "$target" ] && [ "$force" -eq 0 ]; then
        echo "skipped  $name — $target exists; rerun with --force to replace it"
        failed=1
        return
    fi

    if [ -e "$target" ]; then
        say "backup   $name -> $target.bak"
        run mv "$target" "$target.bak"
    fi

    say "link     $name"
    run mkdir -p "$TARGET_DIR"
    run ln -sfn "$source" "$target"
}

build_extension() {
    local name=$1 dir="$EXTENSIONS_DIR/$1" log pid tries

    if ! command -v npm >/dev/null 2>&1; then
        echo "skipped  $name — npm is not installed"
        failed=1
        return
    fi

    say "build    $name"
    [ "$dry" -eq 1 ] && return

    log=$(mktemp "${TMPDIR:-/tmp}/raycast-tools-$name.XXXXXX")
    if ! (cd "$dir" && npm install --no-fund --no-audit) >"$log" 2>&1; then
        echo "failed   $name — see $log"
        failed=1
        return
    fi

    # ray build only writes files. Raycast registers an extension it has not seen
    # before when ray develop starts, so run that until the build is in, then stop it.
    set -m
    (cd "$dir" && exec npx ray develop --non-interactive) >>"$log" 2>&1 &
    pid=$!
    set +m

    tries=0
    while [ "$tries" -lt 240 ] && kill -0 "$pid" 2>/dev/null; do
        grep -q "built extension successfully" "$log" && break
        sleep 0.5
        tries=$((tries + 1))
    done

    if grep -q "built extension successfully" "$log"; then
        sleep 3
        rm -f "$log"
    else
        echo "failed   $name — see $log"
        failed=1
    fi
    kill -- "-$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
}

linked=0
for name in $(scripts); do
    if is_wanted "$name"; then
        link_script "$name"
        linked=1
    fi
done

if [ "$linked" -eq 1 ]; then
    case ":$PATH:" in
        *":$TARGET_DIR:"*) ;;
        *) echo "Note: $TARGET_DIR is not on your PATH." ;;
    esac
fi

for name in $(extensions); do
    if is_wanted "$name"; then
        build_extension "$name"
    fi
done

exit "$failed"
