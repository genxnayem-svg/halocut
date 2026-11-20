#!/bin/sh
# Signs a built HaloCut.app: sh scripts/sign-mac.sh path/to/HaloCut.app
# With the "HaloCut Local Signing" certificate (scripts/make-signing-cert.sh, made once) every build has the same
# signature, so macOS keeps HaloCut's Accessibility and Input Monitoring permissions across installs.
# Without it the build is signed ad-hoc, and macOS asks for those permissions again after each install.
# © 2026 Imtayz Nayem
APP="$1"
NAME="HaloCut Local Signing"
[ -d "$APP" ] || { echo "No app at $APP" >&2; exit 1; }

# Ad-hoc by default: on this Mac, macOS refused Accessibility to every certificate-signed build, while ad-hoc builds
# get it after the installer clears the old entries (scripts/pkg/postinstall). HALOCUT_SIGN=cert uses the certificate.
ID=""
[ "$HALOCUT_SIGN" != "adhoc" ] && ID=$(security find-identity -p codesigning 2>/dev/null | grep "\"$NAME\"" | head -1 | awk '{print $2}')
if [ -n "$ID" ]; then
  if codesign --force --deep -s "$ID" "$APP" && codesign --verify --deep --strict "$APP"; then
    echo "Signed with \"$NAME\": macOS keeps HaloCut's permissions across installs"
    codesign -d -r- "$APP" 2>&1 | grep designated
    exit 0
  fi
  echo "Signing with \"$NAME\" didn't work: signing ad-hoc instead" >&2
fi
codesign --force --deep -s - "$APP" || exit 1
echo "Signed ad-hoc: the installer clears HaloCut's old permission entries, and HaloCut asks macOS again on its first start"
