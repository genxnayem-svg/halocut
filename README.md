# HaloCut

© 2026 Imtayz Nayem. All rights reserved.

A Tool wheel and per-app mouse buttons for Premiere Pro and After Effects.

```
desktop/     Electron tray app: Tool wheel overlay, mouse buttons, settings, WebSocket bridge server
extension/   CEP panel for Premiere Pro + After Effects: runs the commands (jsx/premiere.jsx, jsx/aftereffects.jsx)
```

## Run it (macOS)
1. `cd desktop && npm install && npm start`
2. Setup tab → **Open settings**, then turn HaloCut on under **Accessibility** and **Input Monitoring**.
   In development the entry is called "Electron". Restart the app afterwards.
3. Setup tab → **Install**. This links `extension/` into `~/Library/Application Support/Adobe/CEP/extensions`.
4. Restart Premiere Pro / After Effects → **Window › Extensions › HaloCut**. Dock the panel and leave it open.
5. Hold **F10** over the timeline, move toward a tool and let go. Release in the centre to cancel; a quick tap keeps the wheel open.

## Tests
`cd desktop && npm test` runs the wheel hit-testing, the bridge round trip and the Premiere scripts against a fake DOM.

## Known limits in Phase 1
- Mouse buttons still reach the app too (no blocking yet). A native helper in a later phase fixes this.
- Labels colour the source clip: this is a limit of Premiere's scripting API.
- Front-app detection and keystrokes are written for macOS; the Windows paths are marked TODO.
- After Effects menu tools (Split layer, Freeze frame…) look up English menu names.
