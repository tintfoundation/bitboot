#!/bin/sh
# Fails when the committed dist/ differs from a fresh build of src/. dist/ is
# committed because consumers install this package as a git dependency with
# install scripts disabled, and Node will not strip types under node_modules.
set -eu
cd "$(dirname "$0")/.."
check_dir=.dist-check
rm -rf "$check_dir"
trap 'rm -rf "$check_dir"' EXIT
node_modules/.bin/tsc -p tsconfig.build.json --outDir "$check_dir"
if ! diff -r "$check_dir" dist; then
  echo 'dist/ is stale: run `bun run build` and commit dist/' >&2
  exit 1
fi
