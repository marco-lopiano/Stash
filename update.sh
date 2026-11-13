#!/usr/bin/env bash
cd "$(dirname "$0")" || exit 1

REMOTE_URL="https://github.com/marco-lopiano/Stash.git"

if ! command -v git >/dev/null 2>&1; then
    echo "git is not installed."
    exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Not a git repository. Initializing..."
    git init || exit 1
fi

# Set origin if no remote is configured
if [ -z "$(git remote)" ]; then
    echo "No remote set. Adding origin -> $REMOTE_URL"
    git remote add origin "$REMOTE_URL" || exit 1
fi

REMOTE="$(git remote | head -n 1)"
if git remote | grep -qx origin; then
    REMOTE=origin
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
if [ -z "$BRANCH" ] || [ "$BRANCH" = "HEAD" ]; then
    BRANCH=main
fi

echo "Pulling $REMOTE/$BRANCH..."
git pull "$REMOTE" "$BRANCH" || {
    echo "Pull failed. See the messages above."
    exit 1
}

# Track the remote branch so plain 'git pull' works afterwards
git branch --set-upstream-to="$REMOTE/$BRANCH" "$BRANCH" >/dev/null 2>&1

echo "Up to date."
