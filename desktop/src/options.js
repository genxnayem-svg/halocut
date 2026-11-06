// Options wheel: three rings of favourites per app (12 + 16 + 20 slots).
// A slot is null or { label, action }, where action is one of
//   { type: "keys", keys: "mod+k" }        keystroke ("mod" = Cmd on macOS, Ctrl on Windows)
//   { type: "text", text: "..." }          typed text (pasted, then the clipboard is put back)
//   { type: "launch", target: "..." }      an app name, a file/folder path or a URL
//   { type: "tool", id: "pr.cut" }         an HaloCut tool (Premiere / After Effects bridge)
//   { type: "macro", steps: [action + optional delayMs, ...] }

const RING_SIZES = [12, 16, 20];

const k = (label, keys) => ({ label, action: { type: 'keys', keys } });
const t = (label, id) => ({ label, action: { type: 'tool', id } });
const go = (label, target) => ({ label, action: { type: 'launch', target } });

function pad(list, n) {
  const out = list.slice(0, n);
  while (out.length < n) out.push(null);
  return out;
}

// Premiere Pro's default shortcuts
const PPRO = [
  [k('Play / stop', 'space'), k('Next frame', 'right'), k('Next edit', 'down'), k('Add edit', 'mod+k'),
    t('Ripple delete', 'pr.rippleDelete'), k('Mark out', 'o'), k('Undo', 'mod+z'), k('Mark in', 'i'),
    k('Add marker', 'm'), k('Previous edit', 'up'), k('Previous frame', 'left'), k('Match frame', 'f')],
  [k('Selection', 'v'), k('Track select', 'a'), k('Ripple edit', 'b'), k('Rolling edit', 'n'),
    k('Rate stretch', 'r'), k('Razor', 'c'), k('Slip', 'y'), k('Slide', 'u'), k('Pen', 'p'),
    k('Hand', 'h'), k('Zoom tool', 'z'), k('Type', 't'), k('Snap', 's'), k('Zoom in', 'equal'),
    k('Zoom out', 'minus'), k('Fit sequence', '\\')],
  [k('Copy', 'mod+c'), k('Paste', 'mod+v'), k('Paste attributes', 'mod+alt+v'), k('Lift', ';'),
    k('Extract', "'"), k('Link', 'mod+l'), k('Export frame', 'shift+e'), t('Fill frame', 'pr.fillFrame'),
    t('Fit frame', 'pr.fitFrame'), t('Scale 100%', 'pr.scale100'), t('Enable / disable', 'pr.toggleEnable'),
    t('Cut all tracks', 'pr.cutAll'), t('Unlink', 'pr.unlink'), t('Mute targeted', 'pr.muteTargeted'),
    k('Add edit all tracks', 'mod+shift+k'), k('Redo', 'mod+shift+z'), k('Save', 'mod+s')],
];

// After Effects' default shortcuts
const AEFT = [
  [k('Play / stop', 'space'), k('Next frame', 'mod+right'), t('Split layer', 'ae.splitLayer'),
    t('Easy ease', 'ae.easyEase'), t('Pre-compose', 'ae.precompose'), k('Trim out', 'alt+]'),
    k('Undo', 'mod+z'), k('Trim in', 'alt+['), k('Duplicate', 'mod+d'), t('Null + parent', 'ae.nullParent'),
    k('Previous frame', 'mod+left'), k('Redo', 'mod+shift+z')],
  [k('Selection', 'v'), k('Hand', 'h'), k('Zoom tool', 'z'), k('Rotate', 'w'), k('Camera', 'c'),
    k('Pan behind', 'y'), k('Shape', 'q'), k('Pen', 'g'), k('Type', 'mod+t'), k('Brush', 'mod+b'),
    k('Puppet', 'mod+p'), k('Position', 'p'), k('Scale', 's'), k('Rotation', 'r'), k('Opacity', 't'),
    k('Anchor point', 'a')],
  [t('Centre in comp', 'ae.centerLayer'), t('Anchor centre', 'ae.anchor.c'), t('Fit to comp', 'ae.fitToComp'),
    t('Freeze frame', 'ae.freezeFrame'), t('Reverse', 'ae.timeReverse'), t('Time remap', 'ae.timeRemap'),
    t('Loop', 'ae.loopOut'), t('Wiggle', 'ae.wiggle'), t('Adjustment', 'ae.newAdjustment'),
    t('Solid', 'ae.newSolid'), t('Text layer', 'ae.newText'), t('Camera layer', 'ae.newCamera'),
    t('Motion blur', 'ae.toggleMotionBlur'), t('3D layer', 'ae.toggle3D'), t('Gaussian Blur', 'ae.fx.gaussianblur'),
    t('Glow', 'ae.fx.glow'), k('Copy', 'mod+c'), k('Paste', 'mod+v'), k('Save', 'mod+s')],
];

// Everywhere else
const OTHER = [
  [k('Copy', 'mod+c'), k('Paste', 'mod+v'), k('Cut', 'mod+x'), k('Undo', 'mod+z'), k('Redo', 'mod+shift+z'),
    k('Select all', 'mod+a'), k('Save', 'mod+s'), k('Find', 'mod+f'), k('New tab', 'mod+t'),
    k('Close tab', 'mod+w'), k('Reopen tab', 'mod+shift+t'), k('Print', 'mod+p')],
  [go('Finder', 'Finder'), go('Premiere Pro', 'Adobe Premiere Pro 2026'), go('After Effects', 'Adobe After Effects 2026'),
    go('Photoshop', 'Adobe Photoshop 2026'), go('YouTube Studio', 'https://studio.youtube.com'),
    go('Downloads', '~/Downloads'), go('Desktop', '~/Desktop')],
  [],
];

function defaultWheels() {
  const build = (rings) => ({ rings: RING_SIZES.map((n, i) => pad(rings[i] || [], n)) });
  return { PPRO: build(PPRO), AEFT: build(AEFT), other: build(OTHER) };
}

function defaultOptions() {
  return {
    triggers: [{ kind: 'key', name: 'F8', mods: [], delayMs: 0 }, null],
    wheels: defaultWheels(),
  };
}

module.exports = { RING_SIZES, defaultOptions, defaultWheels };
