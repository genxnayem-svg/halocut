// Tool catalog and default Tool wheel layouts.
// A tool is either run by the Adobe bridge panel (kind "bridge") or sent as keystrokes (kind "keys").
// Keys use "mod" for Cmd on macOS and Ctrl on Windows.

const PR_LABELS = [
  ['Violet', '#a990dd'], ['Iris', '#e384e3'], ['Caribbean', '#00a3a3'], ['Lavender', '#e1a1ff'],
  ['Cerulean', '#00b2e1'], ['Forest', '#4b8f2f'], ['Rose', '#f05a8c'], ['Mango', '#ef9b1d'],
  ['Purple', '#9348c4'], ['Blue', '#3e5fd9'], ['Teal', '#31a6a1'], ['Magenta', '#e23bd6'],
  ['Tan', '#c7a37b'], ['Green', '#3b9e3e'], ['Brown', '#8e5d33'], ['Yellow', '#e2d63b'],
];

const PR_MARKERS = [
  ['Green', '#3fc46b'], ['Red', '#e4473c'], ['Purple', '#a35bd6'], ['Orange', '#f08b2a'],
  ['Yellow', '#e9d33c'], ['White', '#f0f0f0'], ['Blue', '#3e8ef0'], ['Cyan', '#3ed6e0'],
];

const tools = {
  // ---- Any app (keystrokes) ----
  'key.undo': { label: 'Undo', icon: 'undo', kind: 'keys', keys: 'mod+z' },
  'key.redo': { label: 'Redo', icon: 'redo', kind: 'keys', keys: 'mod+shift+z' },
  'key.play': { label: 'Play / stop', icon: 'play', kind: 'keys', keys: 'space' },
  'key.zoomIn': { label: 'Zoom in', icon: 'zoomIn', kind: 'keys', keys: 'equal' },
  'key.zoomOut': { label: 'Zoom out', icon: 'zoomOut', kind: 'keys', keys: 'minus' },
  'key.save': { label: 'Save', icon: 'save', kind: 'keys', keys: 'mod+s' },

  // ---- Premiere Pro ----
  'pr.cut': { label: 'Cut', hint: 'Targeted tracks at the playhead', icon: 'scissors', kind: 'bridge', app: 'PPRO' },
  'pr.cutAll': { label: 'Cut all tracks', icon: 'scissorsAll', kind: 'bridge', app: 'PPRO' },
  'pr.rippleDelete': { label: 'Ripple delete', icon: 'ripple', kind: 'bridge', app: 'PPRO' },
  'pr.delete': { label: 'Delete', hint: 'Leaves the gap', icon: 'trash', kind: 'bridge', app: 'PPRO' },
  'pr.toggleEnable': { label: 'Enable / disable', icon: 'eyeOff', kind: 'bridge', app: 'PPRO' },
  'pr.link': { label: 'Link', icon: 'link', kind: 'bridge', app: 'PPRO' },
  'pr.unlink': { label: 'Unlink', icon: 'unlink', kind: 'bridge', app: 'PPRO' },
  'pr.selectAtPlayhead': { label: 'Select at playhead', icon: 'select', kind: 'bridge', app: 'PPRO' },
  'pr.selectForward': { label: 'Select forward', icon: 'forward', kind: 'bridge', app: 'PPRO' },
  'pr.center': { label: 'Centre', icon: 'center', kind: 'bridge', app: 'PPRO' },
  'pr.scale100': { label: 'Scale 100%', icon: 'hundred', kind: 'bridge', app: 'PPRO' },
  'pr.fitFrame': { label: 'Fit frame', icon: 'fit', kind: 'bridge', app: 'PPRO' },
  'pr.fillFrame': { label: 'Fill frame', hint: 'No black bars', icon: 'fill', kind: 'bridge', app: 'PPRO' },
  'pr.fillWidth': { label: 'Fill width', icon: 'fillW', kind: 'bridge', app: 'PPRO' },
  'pr.fillHeight': { label: 'Fill height', icon: 'fillH', kind: 'bridge', app: 'PPRO' },
  'pr.punchIn': { label: 'Punch in', hint: '×1.2', icon: 'zoomIn', kind: 'bridge', app: 'PPRO' },
  'pr.punchOut': { label: 'Punch out', icon: 'zoomOut', kind: 'bridge', app: 'PPRO' },
  'pr.rotateCW': { label: 'Rotate +90°', icon: 'rotate', kind: 'bridge', app: 'PPRO', tool: 'pr.rotate', args: { degrees: 90 } },
  'pr.rotateCCW': { label: 'Rotate −90°', icon: 'rotateBack', kind: 'bridge', app: 'PPRO', tool: 'pr.rotate', args: { degrees: -90 } },
  'pr.flipH': { label: 'Flip horizontal', icon: 'flipH', kind: 'bridge', app: 'PPRO' },
  'pr.flipV': { label: 'Flip vertical', icon: 'flipV', kind: 'bridge', app: 'PPRO' },
  'pr.opacity50': { label: 'Opacity 50%', icon: 'opacity', kind: 'bridge', app: 'PPRO', tool: 'pr.opacity', args: { value: 50 } },
  'pr.opacity100': { label: 'Opacity 100%', icon: 'opacityFull', kind: 'bridge', app: 'PPRO', tool: 'pr.opacity', args: { value: 100 } },
  'pr.resetMotion': { label: 'Reset motion', icon: 'reset', kind: 'bridge', app: 'PPRO' },
  'pr.muteTargeted': { label: 'Mute targeted', icon: 'mute', kind: 'bridge', app: 'PPRO' },
  'pr.marker': { label: 'Add marker', icon: 'flag', kind: 'bridge', app: 'PPRO' },
  'pr.closeGaps': { label: 'Close gaps', hint: 'Only where every track is empty', icon: 'ripple', kind: 'bridge', app: 'PPRO' },
  'pr.muteClips': { label: 'Mute clips', hint: 'The selected clips with sound', icon: 'mute', kind: 'bridge', app: 'PPRO' },

  // Adjustment layers: over the selected clips, or the clip at the playhead
  'pr.adjust': { label: 'Adjustment layer', hint: 'Over the selected clips', icon: 'adjust', kind: 'bridge', app: 'PPRO', tool: 'pr.adjustment', args: {} },
  'pr.adjust.lumetri': { label: 'Lumetri', hint: 'Adjustment layer with Lumetri Color', icon: 'palette', kind: 'bridge', app: 'PPRO', tool: 'pr.adjustment', args: { effect: 'Lumetri Color' } },
  'pr.adjust.blur': { label: 'Blur', hint: 'Adjustment layer with Gaussian Blur', icon: 'fx', kind: 'bridge', app: 'PPRO', tool: 'pr.adjustment', args: { effect: 'Gaussian Blur' } },
  'pr.adjust.transform': { label: 'Transform', hint: 'Adjustment layer with Transform', icon: 'rotate', kind: 'bridge', app: 'PPRO', tool: 'pr.adjustment', args: { effect: 'Transform' } },
  'pr.adjust.crop': { label: 'Crop', hint: 'Adjustment layer with Crop, for bars', icon: 'fillW', kind: 'bridge', app: 'PPRO', tool: 'pr.adjustment', args: { effect: 'Crop' } },
  'pr.adjust.bw': { label: 'Black & White', hint: 'Adjustment layer with Black & White', icon: 'opacity', kind: 'bridge', app: 'PPRO', tool: 'pr.adjustment', args: { effect: 'Black & White' } },
  'pr.adjust.whole': { label: 'Whole sequence', hint: 'Adjustment layer over everything', icon: 'fill', kind: 'bridge', app: 'PPRO', tool: 'pr.adjustment', args: { whole: true } },

  // Speed
  'pr.reverse': { label: 'Reverse', hint: 'Plays the clip backwards', icon: 'reverse', kind: 'bridge', app: 'PPRO' },
  'pr.key.speed': { label: 'Speed / Duration…', hint: '⌘R', icon: 'clock', kind: 'keys', keys: 'mod+r', app: 'PPRO' },
  'pr.key.rateStretch': { label: 'Rate Stretch', hint: 'Premiere tool · R', icon: 'trim', kind: 'keys', keys: 'r', app: 'PPRO' },

  // Colour: copy the Lumetri grade of one clip onto others
  'pr.colorCopy': { label: 'Copy colour', hint: 'The Lumetri Color of the clip at the playhead', icon: 'copy', kind: 'bridge', app: 'PPRO' },
  'pr.colorPaste': { label: 'Paste colour', hint: 'On the selected clips', icon: 'palette', kind: 'bridge', app: 'PPRO' },
  'pr.colorReset': { label: 'Reset colour', hint: 'Lumetri Color back to neutral', icon: 'reset', kind: 'bridge', app: 'PPRO' },
  'pr.key.pasteAttributes': { label: 'Paste attributes…', hint: '⌥⌘V', icon: 'copy', kind: 'keys', keys: 'alt+mod+v', app: 'PPRO' },

  // Sequences
  'pr.key.newSequence': { label: 'New sequence…', hint: '⌘N', icon: 'plus', kind: 'keys', keys: 'mod+n', app: 'PPRO' },
  'pr.seqFromClip': { label: 'Sequence from clip', hint: 'Its size and frame rate, opened at once', icon: 'timeline', kind: 'bridge', app: 'PPRO' },
  'pr.seqDuplicate': { label: 'Duplicate sequence', hint: 'A copy, opened to work on', icon: 'layersEach', kind: 'bridge', app: 'PPRO' },
  'pr.key.exportFrame': { label: 'Export frame', hint: '⇧E', icon: 'save', kind: 'keys', keys: 'shift+e', app: 'PPRO' },
  'pr.key.render': { label: 'Render in to out', hint: 'Return', icon: 'play', kind: 'keys', keys: 'return', app: 'PPRO' },
  'pr.key.matchFrame': { label: 'Match frame', hint: 'F', icon: 'copy', kind: 'keys', keys: 'f', app: 'PPRO' },
  // Premiere's own Nest keeps every effect, but has no shortcut: give Clip › Nest ⌃⌥N in Premiere once
  'pr.key.nest': { label: 'Nest…', hint: 'Premiere’s Clip › Nest: give it ⌃⌥N in Keyboard Shortcuts once', icon: 'layers', kind: 'keys', keys: 'ctrl+alt+n', app: 'PPRO' },
  'pr.unnest': { label: 'Unnest', hint: 'The nest’s clips back on the timeline (a copy of the sequence is kept)', icon: 'layersEach', kind: 'bridge', app: 'PPRO', args: { keepCopy: true } },

  // Gain
  'pr.gain.zero': { label: '0 dB', hint: 'Volume back to as recorded', listIcon: 'reset', kind: 'bridge', app: 'PPRO', tool: 'pr.gain', args: { set: 0 } },
  'pr.key.audioGain': { label: 'Audio Gain…', hint: 'G', icon: 'gain', kind: 'keys', keys: 'g', app: 'PPRO' },
};

[25, 50, 75, 100, 150, 200, 400].forEach((p) => {
  // no icon: the wheel shows "200%" on the disc, so the speeds tell apart at a glance (listIcon: for the settings lists)
  tools[`pr.speed.${p}`] = {
    label: `${p}%`, hint: p < 100 ? 'Slower · clip speed' : p > 100 ? 'Faster · clip speed' : 'Normal speed',
    listIcon: p < 100 ? 'speedDown' : p > 100 ? 'speed' : 'reset', kind: 'bridge', app: 'PPRO', tool: 'pr.speed', args: { percent: p },
  };
});
[6, 3, 1, -1, -3, -6].forEach((db) => {
  tools[`pr.gain.${db > 0 ? 'up' : 'down'}${Math.abs(db)}`] = {
    label: `${db > 0 ? '+' : '−'}${Math.abs(db)} dB`, hint: db > 0 ? 'Louder · clip volume' : 'Quieter · clip volume',
    listIcon: db > 0 ? 'gainUp' : 'gainDown', kind: 'bridge', app: 'PPRO', tool: 'pr.gain', args: { db },
  };
});
const PR_MATTES = [
  ['Black', '#000000'], ['White', '#FFFFFF'], ['Grey', '#808080'], ['Red', '#E5322D'], ['Orange', '#FF7A1A'],
  ['Yellow', '#FFD400'], ['Green', '#1FB35A'], ['Blue', '#2D6FF0'], ['Purple', '#8E44EC'], ['Pink', '#FF4FA3'],
];
PR_MATTES.forEach(([name, color]) => {
  tools[`pr.matte.${name.toLowerCase()}`] = {
    label: `${name} matte`, hint: '5 s at the playhead, or over the selected clips', icon: 'square', tint: color === '#000000' ? '#3a3540' : color,
    kind: 'bridge', app: 'PPRO', tool: 'pr.matte', args: { color, name },
  };
});

PR_MARKERS.forEach(([name, color], i) => {
  tools[`pr.marker.${name.toLowerCase()}`] = {
    label: `${name} marker`, icon: 'flag', tint: color, kind: 'bridge', app: 'PPRO', tool: 'pr.marker', args: { color: i },
  };
});
PR_LABELS.forEach(([name, color], i) => {
  tools[`pr.label.${name.toLowerCase()}`] = {
    label: name, icon: 'tag', tint: color, kind: 'bridge', app: 'PPRO', tool: 'pr.label', args: { index: i },
  };
});
[
  ['Gaussian Blur', 'blur'], ['Lumetri Color', 'color'], ['Warp Stabilizer', 'stabilize'],
  ['Crop', 'crop'], ['Ultra Key', 'key'], ['Drop Shadow', 'shadow'], ['Black & White', 'bw'],
].forEach(([name, icon]) => {
  tools[`pr.fx.${icon}`] = { label: name, icon: 'fx', kind: 'bridge', app: 'PPRO', tool: 'pr.effect', args: { name, kind: 'video' } };
});
// Transitions, 1 s at the end of each selected clip (the same as picking them from Premiere's list, so never listed twice)
[['Dip to Black', 'dipBlack'], ['Dip to White', 'dipWhite'], ['Cross Dissolve', 'cross'], ['Film Dissolve', 'film'], ['Additive Dissolve', 'additive']]
  .forEach(([name, key]) => {
    tools[`pr.tr.${key}`] = { label: name, hint: 'At the end of the selected clips', icon: 'transition', kind: 'bridge', app: 'PPRO', tool: 'pr.transition', args: { name, seconds: 1 } };
  });

// ---- After Effects ----
Object.assign(tools, {
  'ae.precompose': { label: 'Pre-compose', icon: 'layers', kind: 'bridge', app: 'AEFT' },
  'ae.precomposeEach': { label: 'Pre-comp each', icon: 'layersEach', kind: 'bridge', app: 'AEFT' },
  'ae.splitLayer': { label: 'Split layer', icon: 'scissors', kind: 'bridge', app: 'AEFT' },
  'ae.duplicate': { label: 'Duplicate', icon: 'copy', kind: 'bridge', app: 'AEFT' },
  'ae.trimToWorkArea': { label: 'Trim to work area', icon: 'trim', kind: 'bridge', app: 'AEFT' },
  'ae.newNull': { label: 'Null', icon: 'null', kind: 'bridge', app: 'AEFT' },
  'ae.nullParent': { label: 'Null + parent', icon: 'parent', kind: 'bridge', app: 'AEFT' },
  'ae.newAdjustment': { label: 'Adjustment', icon: 'adjust', kind: 'bridge', app: 'AEFT' },
  'ae.newSolid': { label: 'Solid', icon: 'square', kind: 'bridge', app: 'AEFT' },
  'ae.newText': { label: 'Text', icon: 'text', kind: 'bridge', app: 'AEFT' },
  'ae.newShape': { label: 'Shape', icon: 'shape', kind: 'bridge', app: 'AEFT' },
  'ae.newCamera': { label: 'Camera', icon: 'camera', kind: 'bridge', app: 'AEFT' },
  'ae.fitToComp': { label: 'Fit to comp', icon: 'fill', kind: 'bridge', app: 'AEFT' },
  'ae.fitWidth': { label: 'Fit width', icon: 'fillW', kind: 'bridge', app: 'AEFT' },
  'ae.fitHeight': { label: 'Fit height', icon: 'fillH', kind: 'bridge', app: 'AEFT' },
  'ae.centerLayer': { label: 'Centre in comp', icon: 'center', kind: 'bridge', app: 'AEFT' },
  'ae.freezeFrame': { label: 'Freeze frame', icon: 'freeze', kind: 'bridge', app: 'AEFT' },
  'ae.timeReverse': { label: 'Reverse', icon: 'reverse', kind: 'bridge', app: 'AEFT' },
  'ae.timeRemap': { label: 'Time remap', icon: 'clock', kind: 'bridge', app: 'AEFT' },
  'ae.easyEase': { label: 'Easy ease', icon: 'ease', kind: 'bridge', app: 'AEFT' },
  'ae.easeIn': { label: 'Ease in', icon: 'easeIn', kind: 'bridge', app: 'AEFT' },
  'ae.easeOut': { label: 'Ease out', icon: 'easeOut', kind: 'bridge', app: 'AEFT' },
  'ae.loopOut': { label: 'Loop', icon: 'loop', kind: 'bridge', app: 'AEFT' },
  'ae.pingPong': { label: 'Ping-pong', icon: 'pingpong', kind: 'bridge', app: 'AEFT' },
  'ae.wiggle': { label: 'Wiggle', icon: 'wiggle', kind: 'bridge', app: 'AEFT' },
  'ae.clearExpression': { label: 'Clear expression', icon: 'trash', kind: 'bridge', app: 'AEFT' },
  'ae.marker': { label: 'Marker', icon: 'flag', kind: 'bridge', app: 'AEFT' },
  'ae.toggleShy': { label: 'Shy', icon: 'eyeOff', kind: 'bridge', app: 'AEFT' },
  'ae.toggleMotionBlur': { label: 'Motion blur', icon: 'motionBlur', kind: 'bridge', app: 'AEFT' },
  'ae.toggle3D': { label: '3D layer', icon: 'cube', kind: 'bridge', app: 'AEFT' },
});

[
  ['Centre', 0.5, 0.5, 'anchorC'], ['Top left', 0, 0, 'anchorTL'], ['Top', 0.5, 0, 'anchorT'],
  ['Top right', 1, 0, 'anchorTR'], ['Right', 1, 0.5, 'anchorR'], ['Bottom right', 1, 1, 'anchorBR'],
  ['Bottom', 0.5, 1, 'anchorB'], ['Bottom left', 0, 1, 'anchorBL'], ['Left', 0, 0.5, 'anchorL'],
].forEach(([name, x, y, icon]) => {
  tools[`ae.anchor.${icon.slice(6).toLowerCase()}`] = {
    label: `Anchor ${name.toLowerCase()}`, icon, kind: 'bridge', app: 'AEFT', tool: 'ae.anchor', args: { x, y },
  };
});
[
  ['Gaussian Blur', 'ADBE Gaussian Blur 2'], ['Glow', 'ADBE Glo2'], ['Fill', 'ADBE Fill'],
  ['Drop Shadow', 'ADBE Drop Shadow'], ['Tint', 'ADBE Tint'], ['Curves', 'ADBE CurvesCustom'],
  ['Lumetri Color', 'ADBE Lumetri'], ['Transform', 'ADBE Geometry2'],
].forEach(([name, matchName]) => {
  tools[`ae.fx.${name.toLowerCase().replace(/\W+/g, '')}`] = {
    label: name, icon: 'fx', kind: 'bridge', app: 'AEFT', tool: 'ae.effect', args: { matchName, name },
  };
});

// ---- Default layouts: segments around the ring, each with its own tools ----

const AEFT_LAYOUT = {
  name: 'After Effects · Default',
  segments: [
    { name: 'Comp', icon: 'layers', color: '#ff7a45', main: 'ae.precompose',
      tools: ['ae.precompose', 'ae.precomposeEach', 'ae.splitLayer', 'ae.duplicate', 'ae.trimToWorkArea'] },
    { name: 'New', icon: 'plus', color: '#ff5d7a', main: 'ae.nullParent',
      tools: ['ae.nullParent', 'ae.newNull', 'ae.newAdjustment', 'ae.newSolid', 'ae.newText', 'ae.newShape', 'ae.newCamera'] },
    { name: 'Fit', icon: 'fill', color: '#e5489a', main: 'ae.fitToComp',
      tools: ['ae.fitToComp', 'ae.fitWidth', 'ae.fitHeight', 'ae.centerLayer'] },
    { name: 'Anchor', icon: 'anchorC', color: '#c44bd6', main: 'ae.anchor.c',
      tools: Object.keys(tools).filter((k) => k.startsWith('ae.anchor.')) },
    { name: 'Time', icon: 'clock', color: '#8f5cf0', main: 'ae.freezeFrame',
      tools: ['ae.freezeFrame', 'ae.timeReverse', 'ae.timeRemap'] },
    { name: 'Keys', icon: 'ease', color: '#5a7cf5', main: 'ae.easyEase',
      tools: ['ae.easyEase', 'ae.easeIn', 'ae.easeOut', 'ae.loopOut', 'ae.pingPong', 'ae.wiggle', 'ae.clearExpression'] },
    { name: 'Effects', icon: 'fx', color: '#3fb0e8', main: 'ae.fx.gaussianblur',
      tools: Object.keys(tools).filter((k) => k.startsWith('ae.fx.')) },
    { name: 'Layer', icon: 'cube', color: '#36c9a8', main: 'ae.marker',
      tools: ['ae.marker', 'ae.toggleShy', 'ae.toggleMotionBlur', 'ae.toggle3D', 'key.undo', 'key.play'] },
  ],
};

const layouts = {
  PPRO: {
    name: 'Premiere Pro · Default',
    segments: [
      { name: 'Adjustment', icon: 'adjust', color: '#ff7a45', main: 'pr.adjust',
        tools: ['pr.adjust', 'pr.adjust.lumetri', 'pr.adjust.blur', 'pr.adjust.transform', 'pr.adjust.crop', 'pr.adjust.bw', 'pr.adjust.whole'] },
      { name: 'Timeline', icon: 'timeline', color: '#ff5d7a', main: 'pr.cut',
        tools: ['pr.cut', 'pr.cutAll', 'pr.rippleDelete', 'pr.delete', 'pr.closeGaps', 'pr.selectAtPlayhead', 'pr.selectForward',
          'pr.toggleEnable', 'pr.link', 'pr.unlink', 'key.zoomIn', 'key.zoomOut'] },
      { name: 'Speed', icon: 'speed', color: '#e5489a', main: 'pr.key.speed',
        tools: ['pr.key.speed', 'pr.speed.25', 'pr.speed.50', 'pr.speed.75', 'pr.speed.100', 'pr.speed.150', 'pr.speed.200', 'pr.speed.400',
          'pr.reverse', 'pr.key.rateStretch'] },
      { name: 'Effects', icon: 'fx', color: '#c44bd6', main: 'pr.fx.blur',
        tools: ['pr.fx.blur', 'pr.fx.color', 'pr.fx.stabilize', 'pr.fx.crop', 'pr.fx.key', 'pr.fx.shadow', 'pr.fx.bw',
          'pr.tr.dipBlack', 'pr.tr.dipWhite', 'pr.tr.cross', 'pr.tr.film', 'pr.tr.additive'] },
      { name: 'Color matte', icon: 'square', color: '#8f5cf0', main: 'pr.matte.black',
        tools: PR_MATTES.map(([name]) => `pr.matte.${name.toLowerCase()}`) },
      { name: 'Gain', icon: 'gain', color: '#3fb0e8', main: 'pr.gain.up3',
        tools: ['pr.gain.up3', 'pr.gain.up6', 'pr.gain.up1', 'pr.gain.down1', 'pr.gain.down3', 'pr.gain.down6', 'pr.gain.zero',
          'pr.muteClips', 'pr.key.audioGain'] },
      { name: 'Colour', icon: 'palette', color: '#36c9a8', main: 'pr.colorCopy',
        tools: ['pr.colorCopy', 'pr.colorPaste', 'pr.colorReset', 'pr.fx.color', 'pr.key.pasteAttributes'] },
      { name: 'Sequence', icon: 'timeline', color: '#7bc950', main: 'pr.key.newSequence',
        tools: ['pr.key.newSequence', 'pr.seqFromClip', 'pr.seqDuplicate', 'pr.key.nest', 'pr.unnest', 'pr.key.exportFrame', 'pr.key.render', 'pr.key.matchFrame'] },
    ],
  },
  AEFT: AEFT_LAYOUT,
};

// Premiere's earlier defaults, oldest first. A saved layout that is still exactly one of them moves to the new default
// (see config.js): before 0.2.1, then 0.2.1 (only effects on the Effects segment), then 0.2.2 (no Colour, no Sequence).
const previousLayouts = {
  PPRO: [{
    name: 'Premiere Pro · Default',
    segments: [
      { name: 'Edit', icon: 'scissors', color: '#ff7a45', main: 'pr.cut',
        tools: ['pr.cut', 'pr.cutAll', 'pr.rippleDelete', 'pr.delete', 'pr.toggleEnable', 'pr.link', 'pr.unlink', 'pr.selectAtPlayhead', 'pr.selectForward'] },
      { name: 'Frame', icon: 'fill', color: '#ff5d7a', main: 'pr.fillFrame',
        tools: ['pr.fillFrame', 'pr.fitFrame', 'pr.fillWidth', 'pr.fillHeight', 'pr.scale100', 'pr.center', 'pr.punchIn', 'pr.punchOut'] },
      { name: 'Transform', icon: 'rotate', color: '#e5489a', main: 'pr.resetMotion',
        tools: ['pr.resetMotion', 'pr.rotateCW', 'pr.rotateCCW', 'pr.flipH', 'pr.flipV', 'pr.opacity50', 'pr.opacity100'] },
      { name: 'Effects', icon: 'fx', color: '#c44bd6', main: 'pr.fx.blur',
        tools: ['pr.fx.blur', 'pr.fx.color', 'pr.fx.stabilize', 'pr.fx.crop', 'pr.fx.key', 'pr.fx.shadow', 'pr.fx.bw'] },
      { name: 'Markers', icon: 'flag', color: '#8f5cf0', main: 'pr.marker',
        tools: Object.keys(tools).filter((k) => k.startsWith('pr.marker.')) },
      { name: 'Labels', icon: 'tag', color: '#5a7cf5', main: 'pr.label.violet',
        tools: Object.keys(tools).filter((k) => k.startsWith('pr.label.')) },
      { name: 'Playback', icon: 'play', color: '#3fb0e8', main: 'key.play',
        tools: ['key.play', 'key.undo', 'key.redo', 'key.zoomIn', 'key.zoomOut', 'pr.muteTargeted', 'key.save'] },
    ],
  }, {
    ...layouts.PPRO,
    segments: layouts.PPRO.segments.filter((sg) => sg.name !== 'Colour' && sg.name !== 'Sequence')
      .map((sg) => (sg.name === 'Effects' ? { ...sg, tools: sg.tools.filter((id) => !id.startsWith('pr.tr.')) } : sg)),
  }, {
    // 0.2.2: before the Colour and Sequence segments
    ...layouts.PPRO,
    segments: layouts.PPRO.segments.filter((sg) => sg.name !== 'Colour' && sg.name !== 'Sequence'),
  }],
};

// A second Premiere layout out of the box: the tools the first wheel had before 0.2.1 (scroll with the wheel open)
const extraLayouts = {
  PPRO: [{
    name: 'Premiere Pro · Classic',
    segments: previousLayouts.PPRO[0].segments.filter((sg) => ['Frame', 'Transform', 'Markers', 'Labels', 'Playback'].includes(sg.name)),
  }],
};

module.exports = { tools, layouts, previousLayouts, extraLayouts };
