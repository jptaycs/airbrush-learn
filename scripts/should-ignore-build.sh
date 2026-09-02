#!/usr/bin/env bash
# Netlify's [build].ignore command -- see netlify.toml. Exit 0 = skip this
# build, exit 1 = build normally. Netlify runs this shell command directly
# (not as an executable file), so it's invoked as
# `bash scripts/should-ignore-build.sh` from netlify.toml rather than
# relying on this file's shebang/exec bit.
#
# v2, rewritten 2026-09-03 to batch ALL deploys to once daily instead of
# once per push (previous version, kept in git history, only skipped
# topics.json-only commits). Every ordinary git push -- n8n publishing an
# article, an /admin save, a gallery approval -- is now skipped
# unconditionally, no matter what changed. The ONLY thing allowed to
# actually build is a build triggered by the scheduled Netlify Build Hook
# (see .github/workflows/daily-deploy.yml), and even that skips if nothing
# actually changed since the last real build. This collapses N pushes/day
# (each previously its own ~15-credit deploy) into at most one deploy/day.
#
# Netlify sets INCOMING_HOOK_TITLE (and _URL/_BODY) only when a build was
# triggered via a Build Hook -- confirmed against Netlify's own docs
# 2026-09-03 (docs.netlify.com/build/configure-builds/build-hooks/). A
# plain git push never sets these, which is exactly the signal this script
# gates on. Build hooks are NOT exempt from the `ignore` command (also
# confirmed against Netlify's docs) -- without the check below, this
# script would skip the scheduled deploy too, and nothing would ever go
# live again.
#
# TRADEOFF, read before relying on this: nothing published in /admin (an
# article, a gallery approval, an image regen) or committed by n8n goes
# live until the next scheduled deploy -- up to ~24h later. See CLAUDE.md's
# "Once-daily batched deploys" section for the full reasoning and the
# manual-override path (re-run .github/workflows/daily-deploy.yml via
# workflow_dispatch, or POST the build hook directly) for anything urgent.
set -u

if [ -z "${INCOMING_HOOK_TITLE:-}" ]; then
  echo "[ignore-check] ordinary git-triggered build -- deferring to the once-daily scheduled deploy, skipping"
  exit 0
fi

echo "[ignore-check] triggered by build hook '$INCOMING_HOOK_TITLE' -- checking whether anything actually changed"

if [ -z "${CACHED_COMMIT_REF:-}" ]; then
  echo "[ignore-check] no \$CACHED_COMMIT_REF (first build on this cache lineage) -- building"
  exit 1
fi

if ! git cat-file -e "${CACHED_COMMIT_REF}^{commit}" 2>/dev/null; then
  echo "[ignore-check] \$CACHED_COMMIT_REF ($CACHED_COMMIT_REF) not resolvable in this checkout -- building rather than risk a false skip"
  exit 1
fi

# Still excludes topics.json specifically: if the only thing sitting on
# main since the last real build is a topic-tracking update (invisible to
# visitors, see the data contract in CLAUDE.md), skip today's deploy too
# rather than spend a build on nothing.
TOPICS_PATH='src/data/topics.json'
if git diff --quiet "$CACHED_COMMIT_REF" "$COMMIT_REF" -- . ":(exclude)$TOPICS_PATH"; then
  echo "[ignore-check] nothing changed outside $TOPICS_PATH since the last real build -- skipping today's deploy"
  exit 0
else
  echo "[ignore-check] real changes found since the last build -- building"
  exit 1
fi
