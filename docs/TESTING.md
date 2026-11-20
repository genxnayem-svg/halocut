# Testing

## Automatic tests

```bash
cd desktop && npm test
```

Runs every `test/*.test.js`: wheel geometry, config, the bridge, Quick search, layouts, backups, themes, updates,
and each Premiere / After Effects script against a fake host. No app needs to be open. All of them should print `ok`.

## Live tests in Premiere Pro

These edit a real timeline, so there are two guards:

- Only run them on a project named **HaloCut Test**.
- Set the sequence that must never be edited: `HALOCUT_AVOID=<name>`, or put its name in `desktop/test/.avoid`.

```bash
cd desktop && sh test/live-when-safe.sh
```

It waits until the active sequence is not the protected one, then runs the edit suite.

## Manual checklist

Open a project named **HaloCut Test** with a few video and audio clips on a timeline. Close client projects first.
Tick each line when it works. Status on 2026-11-11: none of the timeline lines have been checked on a real timeline yet.

### Wheels and triggers

- [ ] Tool wheel opens on its trigger, closes on release, centre cancels
- [ ] Quick tap keeps it open, click runs a tool
- [ ] Scroll with the wheel open switches layout, and it reopens on the last one
- [ ] Options wheel opens in Premiere Pro and in another app
- [x] § key as Options wheel trigger (confirmed by the user, 2026-11-11)
- [ ] Orbit switch on F9 switches apps
- [ ] Middle button and side buttons run their actions
- [ ] The trigger key is not typed into the app underneath

### Premiere Pro tools

- [ ] Adjustment: layer appears over the selection
- [ ] Timeline: cut, ripple, markers
- [ ] Nest and Unnest (with and without keeping a copy)
- [ ] Speed: each preset, then Reverse
- [ ] Effects: Cross Dissolve, Dip to Black, Dip to White on a cut
- [ ] Color matte: appears in the project and on the timeline
- [ ] Gain: up, down
- [ ] Colour: Copy from one clip, Paste on another, Reset
- [ ] Sequence: New sequence, Sequence from clip, Duplicate

### Quick search

- [ ] ⌥ Space opens it in Premiere Pro
- [ ] An effect goes on the selected clips
- [ ] A transition goes on the selected cut
- [ ] Recent picks are listed first

### Panel

- [ ] Opens from Window › Extensions › HaloCut
- [ ] Switcher lists every tool, each page loads without an error
- [ ] One action from each page works: Toolbar, Command, Studio, Grade, Motion, Transitions, Zoom, Split, Caption Styles, Retakes, Podcast, Beat, Markers, Bins
- [ ] Changing the theme in Settings changes the panel

### Other apps

- [ ] DaVinci Resolve wheel opens and a tool runs
- [ ] Lightroom Classic wheel opens and a tool runs
- [ ] + Add app adds a new app, its wheel opens there

### Settings

- [ ] Record captures a key combination
- [ ] Save settings, change something, Restore brings it back
- [ ] Export, Import, Reset
- [ ] Accent and background change the window and the wheels, Paper (light) reads well

### After a rebuild

- [ ] HaloCut opens, Devices says "Listening to every mouse and keyboard" with no new permission step
