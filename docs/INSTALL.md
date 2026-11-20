# Install and first run

## Install

1. Open `HaloCut-<version>.pkg` and finish the installer, or open the `.dmg` and drag HaloCut to Applications.
2. Open HaloCut. It lives in the menu bar.

## macOS permissions

HaloCut needs two switches in **System Settings › Privacy & Security**:

| Permission | Why |
| --- | --- |
| Accessibility | To take over the trigger key or button, so the app underneath doesn't also get it |
| Input Monitoring | To see the mouse and keyboard at all |

HaloCut asks for both on first launch. Turn on **HaloCut** in each list, then restart HaloCut.

Let HaloCut create its own entry by asking. Don't add it by hand with **+**.

With only Input Monitoring on, HaloCut still works in a limited way: the wheel opens, but the trigger key also reaches the app.
The Devices page then says "Listening, limited".

## The panel

1. **Settings › Setup › Install** links the panel into `~/Library/Application Support/Adobe/CEP/extensions`.
2. Restart Premiere Pro or After Effects.
3. **Window › Extensions › HaloCut**. Dock the panel and leave it open.

## Check that it works

- Devices page says "Listening to every mouse and keyboard".
- Hold the Tool wheel trigger over the timeline: the wheel opens.
- Pick a tool: the panel shows what ran.

If not, see [Troubleshooting](TROUBLESHOOTING.md).
