# Build and release

## What you need

- macOS on Apple silicon, Xcode command line tools (for `swiftc`, `codesign`, `pkgbuild`)
- Node.js, then `cd desktop && npm install`

## Build

```bash
sh scripts/make-pkg.sh
```

This builds the two Swift helpers (`ew-input`, `ew-apps`), packages the Electron app, signs it, and leaves only these in `dist/`:

- `HaloCut-<version>.pkg`
- `HaloCut-<version>.dmg`

Add `--keep-app` to also keep `dist/HaloCut-darwin-arm64/HaloCut.app`.

## Signing

Builds sign with the local certificate **HaloCut Local Signing** when it is in the keychain.
Make it once by double-clicking `scripts/Make HaloCut Signing Certificate.command`.

Why it matters: macOS ties the Accessibility and Input Monitoring permission to the signature.
With the certificate, a rebuild keeps the permission. Without it (`HALOCUT_SIGN=adhoc`), every build is a new app to macOS and the permission must be given again.

The first time `codesign` uses the key, macOS asks to allow it. Choose **Always Allow**.

This certificate is self-signed. Other people's Macs will still show the "unidentified developer" warning.
To remove that warning, sign with an Apple Developer ID and notarize.

## Identifiers

| What | Id |
| --- | --- |
| App bundle | `com.imtayznayem.halocut` |
| CEP extension | `com.samistudio.halocut` |

Don't change the app bundle id: macOS permissions are stored against it.

## Version

Set `version` in `desktop/package.json`. The PKG and DMG names and the update check use it.

## Release on GitHub

Users get the update notice from the latest release of `genxnayem-svg/halocut`.

1. Create the public repository `genxnayem-svg/halocut` on github.com (once).
2. Commit and push: `git push -u origin main`. Sign in with a personal access token when asked.
3. Raise `version`, build, then on GitHub: **Releases › Draft a new release**, tag `v<version>`, attach the PKG and DMG, publish.

Status on 2026-11-11: the repository does not exist yet and nothing has been pushed.

## What must never be published

- Anything outside this folder.
- `desktop/test/.avoid` (the name of a project the live tests must not touch; kept on this Mac only).
- Tokens, passwords, the signing key.
