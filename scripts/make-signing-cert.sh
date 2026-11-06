#!/bin/sh
# Run once, on the Mac that builds HaloCut. It makes a private code-signing certificate, "HaloCut Local Signing",
# in your login keychain. Every build signed with it has the same signature, so macOS keeps HaloCut's Accessibility
# and Input Monitoring permissions when you install a new build. The certificate is self-signed: it signs HaloCut on
# this Mac and nothing trusts it for anything else. To undo: delete "HaloCut Local Signing" in Keychain Access.
# © 2026 Imtayz Nayem
set -e
NAME="HaloCut Local Signing"
KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"

if security find-identity -p codesigning "$KEYCHAIN" | grep -q "\"$NAME\""; then
  echo "Already set up: \"$NAME\" is in your login keychain."
  exit 0
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/cert.cnf" <<EOF
[req]
distinguished_name = dn
x509_extensions = ext
prompt = no
[dn]
CN = $NAME
O = Imtayz Nayem
[ext]
basicConstraints = critical, CA:false
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
subjectKeyIdentifier = hash
EOF

# a key and a 10-year certificate, bundled for the keychain with a throwaway password
openssl req -x509 -newkey rsa:2048 -sha256 -days 3650 -nodes -config "$TMP/cert.cnf" -keyout "$TMP/key.pem" -out "$TMP/cert.pem" 2>/dev/null
PASS=$(openssl rand -hex 16)
openssl pkcs12 -export -inkey "$TMP/key.pem" -in "$TMP/cert.pem" -name "$NAME" -out "$TMP/id.p12" -passout "pass:$PASS"

# into the login keychain; only codesign may use the key
security import "$TMP/id.p12" -k "$KEYCHAIN" -P "$PASS" -T /usr/bin/codesign >/dev/null

# sign something small now, so if macOS asks about the key it asks while you're here: choose "Always Allow"
cp /usr/bin/true "$TMP/check"
codesign --force -s "$NAME" "$TMP/check"
codesign -d -r- "$TMP/check" 2>&1 | grep -q "certificate" || { echo "The certificate was added, but signing with it didn't work." >&2; exit 1; }

echo "Done: HaloCut builds will now be signed with \"$NAME\"."
