# Troubleshooting

## The wheel doesn't open

1. Is HaloCut in the menu bar, and not paused?
2. **Settings › Devices** should say "Listening to every mouse and keyboard".
3. In **System Settings › Privacy & Security**, HaloCut must be on under **Accessibility** and **Input Monitoring**. Restart HaloCut after changing either.
4. Check the trigger in Settings. Record it again if it is empty.

## Devices says "Listening, limited"

Input Monitoring is on but Accessibility isn't counted. The wheel opens, but the trigger also reaches the app.
Turn HaloCut on under Accessibility and restart it.

## The Accessibility switch is on but HaloCut still says it's off

This happens when macOS holds a stale record for the app.

- Use a build signed with the **HaloCut Local Signing** certificate. See [Build and release](BUILD.md).
- Remove the HaloCut entry, let HaloCut ask again, and switch on the entry it creates. Don't add it by hand with **+**.
- Reopen System Settings after HaloCut asks: the list doesn't refresh while open.
- Keep one copy of HaloCut, in Applications. Old copies elsewhere confuse macOS.

For developers: check the helper with `pgrep -x ew-input`. One steady process id means it is running.
A new id every few seconds means macOS is refusing it.

## A side mouse button does nothing

The mouse maker's software (Logi Options+ and similar) may take the button first.
There, set the button to its plain default (Back / Forward, or a generic button), then record it in HaloCut.

## The wheel opens but a tool does nothing

- The HaloCut panel must be open in Premiere Pro or After Effects.
- Select a clip or put the playhead where the tool should act.
- The panel shows a message when a tool fails. Read it there.
- After installing a new version, close and reopen the panel, or restart the Adobe app.

## The panel is blank or missing

- **Settings › Setup › Install**, then restart the Adobe app.
- Look under **Window › Extensions › HaloCut**.

## A trigger or an added app disappeared from Settings

Use **Restore** in Settings to bring back a saved copy. HaloCut keeps one automatic copy a day.

## Quick search doesn't open

It works only when Premiere Pro or After Effects is in front. Another app may also be using **⌥ Space**: change the trigger in Settings.

## No update notice

The notice comes from the latest GitHub release. Until a release is published there is nothing to find.
