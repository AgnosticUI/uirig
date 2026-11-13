#!/usr/bin/env bash
# scripts/release.sh
# Deterministic local release gate and NPM publisher for `uirig`.
#
# Usage:
#   bash scripts/release.sh             # Dry-run: runs all checks, tarball smoke test & npm publish --dry-run
#   bash scripts/release.sh --publish   # Live release: runs all checks, creates git tag vX.Y.Z, pushes & publishes to NPM

set -euo pipefail

MODE="dry-run"
if [[ "${1:-}" == "--publish" ]]; then
  MODE="publish"
elif [[ -n "${1:-}" ]]; then
  echo "[release] Error: Unknown flag '${1}'. Use '--publish' or omit for dry-run." >&2
  exit 1
fi

# Always clean up temporary smoke-test directories and packed .tgz files on exit
TMP_SMOKE_DIR=""
TARBALL_PATH=""
cleanup() {
  if [[ -n "$TMP_SMOKE_DIR" && -d "$TMP_SMOKE_DIR" ]]; then
    rm -rf "$TMP_SMOKE_DIR"
  fi
  if [[ -n "$TARBALL_PATH" && -f "$TARBALL_PATH" ]]; then
    rm -f "$TARBALL_PATH"
  fi
}
trap cleanup EXIT

echo "============================================================"
echo "  uirig Release Pipeline (mode: ${MODE})"
echo "============================================================"

# 1. Verify git working tree is clean so uncommitted edits never sneak into a release
if [[ -n "$(git status --porcelain)" ]]; then
  echo "[release] Error: Git working tree has uncommitted changes. Commit or stash before releasing." >&2
  exit 1
fi

# 2. Extract and cross-check package.json version against UIRIG_VERSION in src/index.ts
PKG_VERSION="$(node -p "require('./package.json').version")"

TAG_NAME="v${PKG_VERSION}"
echo "[release] Verified version alignment: ${TAG_NAME}"

# 3. Verify NPM authentication status before doing heavy build/test work
NPM_USER="$(npm whoami 2>/dev/null || true)"
if [[ -z "$NPM_USER" ]]; then
  if [[ "$MODE" == "publish" ]]; then
    echo "[release] Error: Not logged in to NPM. Run 'npm login' first." >&2
    exit 1
  else
    echo "[release] Warning: Not logged in to NPM ('npm whoami' empty). Continuing dry-run..."
  fi
else
  echo "[release] Authenticated NPM user: ${NPM_USER}"
fi

# 4. Ensure tag does not already exist on live publish
if [[ "$MODE" == "publish" ]] && git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
  echo "[release] Error: Git tag '${TAG_NAME}' already exists. Bump version in package.json and src/index.ts first." >&2
  exit 1
fi

# 5. Run full build, strict TypeScript checks, and Vitest suite
echo "[release] Running build, typecheck:all, and test suite..."
npm run build
npm run typecheck:all
npm test

# 6. Pack tarball and run isolated consumer smoke test outside the workspace
echo "[release] Packing tarball and verifying isolated consumer installation..."
TARBALL_FILE="$(npm pack --silent | tail -n 1)"
TARBALL_PATH="$(pwd)/${TARBALL_FILE}"
TMP_SMOKE_DIR="$(mktemp -d)"

(
  cd "$TMP_SMOKE_DIR"
  npm init -y >/dev/null 2>&1
  npm install --no-fund --no-audit "$TARBALL_PATH" >/dev/null 2>&1
  INSTALLED_VER="$(npx --no-install uirig --version)"
  if [[ "$INSTALLED_VER" != "$PKG_VERSION" ]]; then
    echo "[release] Error: Installed CLI reported '${INSTALLED_VER}', expected '${PKG_VERSION}'" >&2
    exit 1
  fi
  npx --no-install uirig --help >/dev/null
  npx --no-install uirig dark-mode --help >/dev/null
)
echo "[release] Isolated consumer smoke test passed for ${TARBALL_FILE}"

# 7. Execute dry-run or live publish + annotated git tag
if [[ "$MODE" == "dry-run" ]]; then
  echo "[release] Running npm publish --dry-run..."
  npm publish --dry-run --access public
  echo "============================================================"
  echo "  Dry-run complete! Run 'npm run release:publish' to ship ${TAG_NAME}."
  echo "============================================================"
  exit 0
fi

echo "[release] Publishing ${TAG_NAME} to NPM..."
npm publish --access public

echo "[release] Creating and pushing annotated git tag ${TAG_NAME}..."
git tag -a "$TAG_NAME" -m "Release ${TAG_NAME}"
git push origin HEAD
git push origin "$TAG_NAME"

echo "============================================================"
echo "  Successfully published uirig@${PKG_VERSION} and pushed ${TAG_NAME}!"
echo "============================================================"
