#!/usr/bin/env bash
# release.sh: produce a clean zip + Steam Workshop manifest ready for upload.
#
# Usage:  ./release.sh
# Output: dist/economics-vX.Y.Z.zip      (X.Y.Z from economics.modinfo <Version>)
#         dist/economics/                (the content folder steamcmd uploads)
#         dist/workshop_item.vdf         (steamcmd build manifest, no description, no preview)
#         dist/preview.png               (when docs/workshop-preview.svg exists and rsvg-convert is installed)
#
# Runs the verify gate, checks the version against package.json, copies the mod into dist/ without the dev files
# (tests, scripts, docs, devtools, types, node_modules, tooling configs), forces DBG off, syntax-checks and zips it,
# audits the zip against an allow-list, and writes the Workshop .vdf. The JS ships readable, not minified. Run from
# the mod source directory.

set -euo pipefail
cd "$(dirname "$0")"

MOD="economics"
MODINFO="$MOD.modinfo"

# never package a red build. SKIP_VERIFY=1 bypasses the gate (emergency only).
if [ "${SKIP_VERIFY:-0}" != "1" ]; then
  echo "release: running 'npm run verify' (set SKIP_VERIFY=1 to skip)..."
  npm run verify || { echo "release: 'npm run verify' FAILED - aborting."; exit 1; }
fi

[ -f "$MODINFO" ] || { echo "error: $MODINFO not found in $(pwd)"; exit 1; }

VERSION="$(grep -oE '<Version>[^<]+</Version>' "$MODINFO" | head -1 | sed -E 's|</?Version>||g')"
[ -n "$VERSION" ] || { echo "error: could not parse <Version> from modinfo"; exit 1; }
echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$' || { echo "error: <Version> '$VERSION' is not semver"; exit 1; }
PKG_VERSION="$(node -p "require('./package.json').version")"
[ "$VERSION" = "$PKG_VERSION" ] \
    || { echo "error: modinfo <Version> $VERSION and package.json version $PKG_VERSION differ"; exit 1; }

AUTHORS="$(grep -oE '<Authors>[^<]+</Authors>' "$MODINFO" | head -1 | sed -E 's|</?Authors>||g')"
case "$AUTHORS" in
    ""|"Your Name"|"TODO") echo "error: set a real <Authors> in the modinfo first (got '$AUTHORS')."; exit 1 ;;
esac

# Steam Workshop published file id: steamcmd updates the existing item instead of creating a duplicate. It lives
# outside dist/ (which is wiped below) in steam_workshop_id.txt.
WORKSHOP_ID_FILE="steam_workshop_id.txt"
PUBLISHED_FILE_ID="${WORKSHOP_PUBLISHED_FILE_ID:-}"
SAVED_ID=""
[ -f "$WORKSHOP_ID_FILE" ] && SAVED_ID="$(tr -dc '0-9' < "$WORKSHOP_ID_FILE")"
if [ -z "$PUBLISHED_FILE_ID" ] && [ -n "$SAVED_ID" ]; then PUBLISHED_FILE_ID="$SAVED_ID"; fi

DIST_DIR="dist"
TARGET_DIR="$DIST_DIR/$MOD"
ZIP_NAME="$MOD-v$VERSION.zip"
ZIP_PATH="$DIST_DIR/$ZIP_NAME"

echo "==> Cleaning $DIST_DIR/"
rm -rf "$DIST_DIR"
mkdir -p "$TARGET_DIR"

echo "==> Mirroring ./ -> $TARGET_DIR/ (excluding dev files)"
rsync -a \
    --exclude='CHANGELOG.steam.txt' --exclude='.git' --exclude='.gitignore' --exclude='.DS_Store' --exclude='dist' \
    --exclude='release.sh' --exclude='*.bak' --exclude='node_modules' \
    --exclude='docs' --exclude='eslint.config.js' --exclude='package.json' --exclude='package-lock.json' \
    --exclude='tsconfig.json' --exclude='types' --exclude='*.d.ts' --exclude='stryker*.json' --exclude='.stryker-tmp' \
    --exclude='tests' --exclude='steam_workshop_id.txt' --exclude='scripts' --exclude='devtools' \
    --exclude='CONTRIBUTING.md' --exclude='.c8rc.json' --exclude='README.pdf' \
    --exclude='coverage*' --exclude='reports' --exclude='*.log' --exclude='/text/README.md' \
    ./ "$TARGET_DIR"/

echo "==> Forcing DBG off in the dist JS"
# The one debug switch is `const DBG` in ui/econ-log.js; this keeps a development build that left it on from shipping
# verbose traces. BSD/macOS sed needs the empty -i argument.
find "$TARGET_DIR" -name '*.js' -type f -print0 | xargs -0 sed -i '' -E -e 's/^const DBG = true;/const DBG = false;/'
grep -q '^const DBG = false;$' "$TARGET_DIR/ui/econ-log.js" \
    || { echo "error: DBG is not false in the dist copy of ui/econ-log.js"; exit 1; }

echo "==> Syntax-checking shipped JS"
find "$TARGET_DIR" -name '*.js' -type f -print0 | xargs -0 -n1 node -c

echo "==> Verifying modinfo at content root"
[ -f "$TARGET_DIR/$MODINFO" ] || { echo "error: $TARGET_DIR/$MODINFO missing"; exit 1; }

echo "==> Zipping $ZIP_PATH"
( cd "$DIST_DIR" && zip -qr "$ZIP_NAME" "$MOD" )

echo "==> Verifying zip contents against allow-list"
ALLOW="^$MOD/($MOD\\.modinfo|README\\.md|LICENSE|CHANGELOG\\.md)\$"
ALLOW="$ALLOW"'|^'"$MOD"'/ui/(econ-[a-z-]+|settings-keeper)\.js$'
ALLOW="$ALLOW"'|^'"$MOD"'/ui/econ-[a-z-]+\.(css|html)$'
ALLOW="$ALLOW"'|^'"$MOD"'/images/econ-[a-z-]+\.(svg|png)$'
ALLOW="$ALLOW"'|^'"$MOD"'/text/[a-z_]+/(ModText|PediaText)\.xml$'
ALLOW="$ALLOW"'|^'"$MOD"'/history-corrections/[a-z-]+-text\.xml$'
ALLOW="$ALLOW"'|^'"$MOD"'/config/econ-[a-z-]+\.sql$'
ALLOW="$ALLOW"'|^'"$MOD"'/data/econ-[a-z-]+\.(xml|sql)$'
UNEXPECTED="$(unzip -Z1 "$ZIP_PATH" | grep -vE '/$' | grep -vE "$ALLOW" || true)"
if [ -n "$UNEXPECTED" ]; then
    echo "error: zip contains entries not on the allow-list:"
    echo "$UNEXPECTED" | sed 's/^/    /'
    exit 1
fi
echo "    OK: every shipped entry matches the allow-list."
unzip -Z1 "$ZIP_PATH" | grep -vE '/$' | sed 's/^/    /'

SIZE="$(du -h "$ZIP_PATH" | cut -f1)"

# Workshop preview: the branded card in docs/workshop-preview.svg rendered to 1024x1024 when present (prompt 5 draws
# it). The manifest never names it: previewfile uploads are refused for this account, so the image goes up through
# the browser.
PREVIEW_SRC="docs/workshop-preview.svg"
PREVIEW_OUT="$DIST_DIR/preview.png"
if [ -f "$PREVIEW_SRC" ]; then
    if command -v rsvg-convert >/dev/null 2>&1; then
        rsvg-convert -w 1024 -h 1024 "$PREVIEW_SRC" -o "$PREVIEW_OUT"
        echo "==> Workshop preview rendered: $PREVIEW_OUT"
    else
        echo "==> rsvg-convert not found; preview.png NOT generated (brew install librsvg)."
    fi
fi

# Steam Workshop manifest (.vdf). No "description": steamcmd keeps the Workshop page's text. No preview file.
VDF_PATH="$DIST_DIR/workshop_item.vdf"
ABS_CONTENT="$(cd "$TARGET_DIR" && pwd)"
# Change note: this release's block from CHANGELOG.steam.txt, which scripts/steam-changelog.mjs keeps in step with
# CHANGELOG.md (that script documents Steam's change-note formatting rules). The block is VDF-safe: no straight
# double quotes, no backslashes. Edit CHANGELOG.steam.txt to reword a note; a hand-edited block is kept.
CHANGENOTE="$VERSION: first release."
if [ -n "$PUBLISHED_FILE_ID" ]; then
    CHANGENOTE="$(node scripts/steam-changelog.mjs note "$VERSION")" \
        || { echo "error: could not build the Steam change note (see above)"; exit 1; }
fi

{
    echo '"workshopitem"'
    echo '{'
    echo '    "appid"          "1295660"'
    [ -n "$PUBLISHED_FILE_ID" ] && echo "    \"publishedfileid\" \"$PUBLISHED_FILE_ID\""
    echo "    \"contentfolder\"  \"$ABS_CONTENT\""
    echo '    "visibility"     "0"'
    echo '    "title"          "Economics"'
    echo "    \"changenote\"     \"${CHANGENOTE}\""
    echo '}'
} > "$VDF_PATH"

echo "==> Workshop manifest written: $VDF_PATH"
echo ""
echo "Release built:  $ZIP_PATH  ($SIZE)"
echo "  Version:      $VERSION"
echo "  Authors:      $AUTHORS"
if [ -n "$PUBLISHED_FILE_ID" ]; then
    echo "  UPDATE mode:  publishedfileid $PUBLISHED_FILE_ID (existing item)"
else
    echo "  NEW-ITEM mode: no publishedfileid yet. The first upload creates one;"
    echo "                 then run: echo <publishedfileid> > steam_workshop_id.txt"
fi
echo ""
echo "-- Upload (from Mac, needs steamcmd) --"
echo "  ~/steamcmd/steamcmd.sh +login <yourSteamLogin> \\"
echo "      +workshop_build_item $(cd "$DIST_DIR" && pwd)/workshop_item.vdf +quit"
