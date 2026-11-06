#!/bin/sh
# Builds HaloCut.app and wraps it two ways: dist/HaloCut-<version>.pkg (installer) and dist/HaloCut-<version>.dmg
# (drag to Applications). Afterwards dist holds only those two; the app folder is removed.
#   scripts/make-pkg.sh             build the app, then the installer and the disk image
#   scripts/make-pkg.sh --no-build  wrap the HaloCut.app already in dist/
#   scripts/make-pkg.sh --keep-app  also leave dist/HaloCut-darwin-arm64 in place
# The installer puts HaloCut in /Applications, adds the panels to Premiere Pro and After Effects for the
# person installing, and starts HaloCut. It is not signed with an Apple Developer ID yet.
# © 2026 Imtayz Nayem
set -e
cd "$(dirname "$0")/.."
VERSION=$(node -p "require('./desktop/package.json').version")
APP="dist/HaloCut-darwin-arm64/HaloCut.app"
OUT="dist/HaloCut-$VERSION.pkg"

if [ "$1" != "--no-build" ]; then (cd desktop && npm run package:mac); fi
[ -d "$APP" ] || { echo "No $APP: build the app first"; exit 1; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/root/Applications" "$WORK/scripts" "$WORK/resources" "$WORK/packages"
ditto "$APP" "$WORK/root/Applications/HaloCut.app"
cp scripts/pkg/preinstall scripts/pkg/postinstall "$WORK/scripts/"
chmod 755 "$WORK/scripts/preinstall" "$WORK/scripts/postinstall"
cp scripts/pkg/welcome.html scripts/pkg/conclusion.html "$WORK/resources/"
cp LICENSE "$WORK/resources/license.txt"

# Always install into /Applications, even if macOS finds another copy of HaloCut.app somewhere else
pkgbuild --analyze --root "$WORK/root" "$WORK/component.plist" >/dev/null
plutil -replace 0.BundleIsRelocatable -bool NO "$WORK/component.plist"

pkgbuild --root "$WORK/root" --component-plist "$WORK/component.plist" --identifier com.samistudio.halocut \
  --version "$VERSION" --install-location / --scripts "$WORK/scripts" "$WORK/packages/HaloCut-app.pkg"
sed "s/VERSION/$VERSION/" scripts/pkg/distribution.xml > "$WORK/distribution.xml"
productbuild --distribution "$WORK/distribution.xml" --resources "$WORK/resources" --package-path "$WORK/packages" "$OUT"
echo "Made $OUT"

# The disk image: HaloCut and a shortcut to Applications, to drag across
DMG="dist/HaloCut-$VERSION.dmg"
STAGE=$(mktemp -d)
cp -R "$APP" "$STAGE/" && ln -s /Applications "$STAGE/Applications"
hdiutil create -volname "HaloCut $VERSION" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null
rm -rf "$STAGE"
echo "Made $DMG"

# Only the two files stay in dist (a spare HaloCut.app there also confuses macOS's permissions)
case " $* " in *" --keep-app "*) ;; *) rm -rf "dist/HaloCut-darwin-arm64" dist/.DS_Store ;; esac
