# HaloCut on Windows

Status: built, **not yet run on a PC**. Everything below is how it is meant to work; the first run on Windows is the test.

## Build (from a Mac or a PC)

```
cd desktop
npm install
npm run package:win
```

This makes `dist/HaloCut-win32-x64/`, `dist/HaloCut-<version>-win-x64.zip` and the installer
`dist/HaloCut-Setup-<version>.exe` (electron-builder + NSIS, settings in `desktop/installer-win.json`). Nothing is
compiled on the Mac.

## Install on the PC

1. Run `HaloCut-Setup-<version>.exe`. It installs for the person running it (no administrator) into
   `%LOCALAPPDATA%\Programs\HaloCut`, adds Start menu and desktop shortcuts and an entry in Windows' list of apps
   (for uninstalling), then starts HaloCut. Running a newer Setup over an old one updates it; settings stay.
   Or, without installing: unzip the zip, open the folder, run `HaloCut.exe`.
   Neither is signed, so Windows SmartScreen shows a warning the first time: **More info → Run anyway**.
2. HaloCut sits in the tray (bottom right). Click it to open Settings.
3. Settings → Setup & help → **Install** puts the bridge into Premiere Pro and After Effects
   (`%APPDATA%\Adobe\CEP\extensions`) and allows unsigned panels. Restart the editor.

## How the Windows parts work

| Part | macOS | Windows |
| --- | --- | --- |
| Mouse and keys (watch and take over) | `helper/ew-input.swift` | `helper/win/ew-input.cs` (low-level hooks) |
| App in front | `lsappinfo` | the same helper, `front` message |
| Orbit switch (apps, windows, icons) | `helper/ew-apps.swift` | `helper/win/ew-apps.cs` |
| An app's id | bundle id | the name of its `.exe`, lower case (`photoshop.exe`) |
| Settings | `~/Library/Application Support/HaloCut` | `%APPDATA%\HaloCut` |

The two helpers are C# sources. HaloCut builds them on the PC the first time it starts, with the C# compiler that ships
with Windows 10 and 11 (`C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`), into `%APPDATA%\HaloCut\helpers`
(`src/win-helper.js`). If that fails, HaloCut still opens the wheels but cannot take the trigger away from the app
underneath; Settings says why on the Buttons page.

## Known gaps on Windows

- Browser tabs on the Orbit switch (macOS uses AppleScript).
- Panel: copy frame, paste image, and captions (the bundled speech tool is a Mac binary).
- No installer and no code signing yet: it is a zip.
- If Premiere Pro runs "as administrator", Windows hides its mouse and keys from HaloCut unless HaloCut runs the same way.
- Final Cut Pro wheel: Mac only (no Windows app).
