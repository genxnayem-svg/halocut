#!/bin/sh
# Puts a new HaloCut out for everybody, in one go:
#   scripts/release.sh 0.2.1 "What is new, in a line or two"
# It sets the version, runs the tests, builds the Mac installer, the Mac disk image and the Windows zip, commits,
# pushes, and makes the GitHub release with the three files. Every HaloCut already installed (Mac and Windows)
# asks GitHub for the newest release a minute after it starts and every 6 hours, and then offers the download.
# Needs: gh signed in (gh auth status), a clean idea of what is in the commit (it commits everything changed).
# © 2026 Imtayz Nayem
set -e
cd "$(dirname "$0")/.."

VERSION="$1"
NOTES="${2:-HaloCut $1}"
case "$VERSION" in
  [0-9]*.[0-9]*.[0-9]*) ;;
  *) echo "Usage: scripts/release.sh <version like 0.2.1> [notes]"; exit 1 ;;
esac
CURRENT=$(node -p "require('./desktop/package.json').version")
NEWER=$(node -p "require('./desktop/src/updates').compare('$VERSION', '$CURRENT') > 0")
[ "$NEWER" = "true" ] || { echo "$VERSION is not newer than $CURRENT: installed copies would not see it"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Sign in to GitHub first: gh auth login"; exit 1; }
if git rev-parse "v$VERSION" >/dev/null 2>&1; then echo "v$VERSION already exists"; exit 1; fi

(cd desktop && npm version "$VERSION" --no-git-tag-version >/dev/null && npm test)

sh scripts/make-pkg.sh --keep-app
(cd desktop && npm run package:win)

PKG="dist/HaloCut-$VERSION.pkg"
DMG="dist/HaloCut-$VERSION.dmg"
ZIP="dist/HaloCut-$VERSION-win-x64.zip"
for f in "$PKG" "$DMG" "$ZIP"; do [ -f "$f" ] || { echo "Missing $f"; exit 1; }; done

git add -A
git commit -m "HaloCut $VERSION" -m "$NOTES"
git push origin HEAD
gh release create "v$VERSION" "$PKG" "$DMG" "$ZIP" --title "HaloCut $VERSION" --notes "$NOTES"
echo "HaloCut $VERSION is out. Installed copies will offer it within 6 hours (or: menu > Check for updates)."
