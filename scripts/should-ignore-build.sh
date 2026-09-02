#!/usr/bin/env bash
# Netlify's [build].ignore command — see netlify.toml. Exit 0 = skip this
# build (nothing outside src/data/topics.json changed), exit 1 = build
# normally. Netlify runs this shell command directly (not as an executable
# file), so it's invoked as `bash scripts/should-ignore-build.sh` from
# netlify.toml rather than relying on this file's shebang/exec bit.
#
# Added 2026-09-03 to replace a one-line `git diff --quiet ...` version
# (added 2026-08-26) that was confirmed NOT working in production: a real
# topics-only commit (7e8f764, "Topics: update topic #9") built as a full
# production deploy 36 minutes after the ignore rule went live, instead of
# showing "Skipped" like it should have. The original command was verified
# correct via a *local* `git diff` replay against a full local clone, but
# was never verified against an actual Netlify build — Netlify's checkout
# may not always have $CACHED_COMMIT_REF's commit object resolvable (a cold
# cache, a cache eviction, a shallow-clone edge case, etc.), which makes a
# bare `git diff $CACHED_COMMIT_REF $COMMIT_REF` error out — and an erroring
# command exits non-zero, which Netlify safely (but silently, with no hint
# in the deploy list) treats as "build normally." That's almost certainly
# why every topics-only commit after 10:51 PM on 2026-08-26 still built.
#
# This version explicitly checks for both failure modes before attempting
# the diff, and — just as important — echoes what it's doing so a future
# failure is diagnosable straight from the build log's "Initializing" phase
# instead of requiring after-the-fact detective work through the Deploys
# list like this one did.
set -u

TOPICS_PATH='src/data/topics.json'

if [ -z "${CACHED_COMMIT_REF:-}" ]; then
  echo "[ignore-check] no \$CACHED_COMMIT_REF (first build on this cache lineage) -- building"
  exit 1
fi

if ! git cat-file -e "${CACHED_COMMIT_REF}^{commit}" 2>/dev/null; then
  echo "[ignore-check] \$CACHED_COMMIT_REF ($CACHED_COMMIT_REF) not resolvable in this checkout -- building rather than risk a false skip"
  exit 1
fi

if git diff --quiet "$CACHED_COMMIT_REF" "$COMMIT_REF" -- . ":(exclude)$TOPICS_PATH"; then
  echo "[ignore-check] only $TOPICS_PATH changed between $CACHED_COMMIT_REF and $COMMIT_REF -- skipping build"
  exit 0
else
  echo "[ignore-check] real changes outside $TOPICS_PATH between $CACHED_COMMIT_REF and $COMMIT_REF -- building"
  exit 1
fi
