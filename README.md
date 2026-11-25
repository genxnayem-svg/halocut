# HaloCut

© 2026 Imtayz Nayem. All rights reserved.

HaloCut puts your editing tools on a wheel under the mouse. Hold a key or mouse button, move toward a tool, let go.
It works in Premiere Pro and After Effects, and in any other app you add (DaVinci Resolve, Final Cut Pro, Photoshop, Lightroom Classic, …).

| Part | Folder | What it is |
| --- | --- | --- |
| Desktop app | `desktop/` | Electron tray app: the wheels, mouse buttons, Quick search, settings |
| Panel | `extension/` | CEP panel for Premiere Pro and After Effects: runs the tools on the timeline |
| Build scripts | `scripts/` | Signing, PKG and DMG |

## Docs

- [Features](docs/FEATURES.md): the wheels, Quick search, panel tools, themes, backups
- [Install and first run](docs/INSTALL.md): installing and the two macOS permissions
- [Build and release](docs/BUILD.md): building the PKG and DMG, signing, GitHub releases
- [Testing](docs/TESTING.md): the automatic tests and the manual checklist
- [Troubleshooting](docs/TROUBLESHOOTING.md): when the wheel doesn't open or a tool does nothing

## Quick start (development, macOS)

```bash
cd desktop && npm install && npm start
```

Then open **Settings › Setup**, install the panel, and turn HaloCut on under **Accessibility** and **Input Monitoring**.
In development the entry in those lists is called "Electron".

## Default triggers

| What | Trigger |
| --- | --- |
| Tool wheel | hold **F10** |
| Orbit switch (switch apps) | **F9** |
| Quick search (Premiere Pro / After Effects) | **⌥ Space** |

All of them can be changed in Settings. Any key or mouse button can be a trigger.

## Known limits

- Windows: a first build exists (`cd desktop && npm run package:win` → `dist/HaloCut-Setup-<version>.exe` and a zip), but it has
  not been run on a PC yet. Wheels, buttons, the Orbit switch and the Adobe bridge are in; browser tabs on the Orbit
  switch, copy/paste frame in the panel and captions (speech) are still Mac only. See `docs/WINDOWS.md`.
- Labels colour the source clip: a limit of Premiere's scripting API.
- After Effects menu tools (Split layer, Freeze frame…) look up English menu names.
- Side mouse buttons may be taken by the mouse maker's own software (Logi Options+ and similar) before HaloCut sees them.
