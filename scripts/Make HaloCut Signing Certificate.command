#!/bin/sh
# Double-click to add the "HaloCut Local Signing" certificate to your login keychain (see make-signing-cert.sh).
cd "$(dirname "$0")"
sh ./make-signing-cert.sh
echo
echo "You can close this window."
