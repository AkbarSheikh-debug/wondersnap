// Synthetic MediaPipe-style hands (21 normalized landmarks), optionally rotated in the image plane.
// Port of tests/synth.py + `peace` and a continuous `openness` blend (fist -> open) for the exploded view.
function local(pose) {
  const L = new Array(21);
  L[0] = [0.0, 1.0];                                           // wrist (local units: s)
  const mcpX = { 5: -0.35, 9: 0.0, 13: 0.3, 17: 0.55 };
  const name = { 5: 'index', 9: 'middle', 13: 'ring', 17: 'pinky' };
  for (const base of [5, 9, 13, 17]) {
    const dx = mcpX[base], finger = name[base];
    L[base] = [dx, 0.0];
    const extended = pose === 'open' || (pose === 'point' && finger === 'index') || (pose === 'peace' && (finger === 'index' || finger === 'middle'))
      || ((pose === 'snap_pressed' || pose === 'snap_released') && finger === 'index');
    if (extended) { L[base + 1] = [dx, -0.45]; L[base + 2] = [dx, -0.8]; L[base + 3] = [dx, -1.1]; }
    else { L[base + 1] = [dx, -0.35]; L[base + 2] = [dx + 0.02, -0.1]; L[base + 3] = [dx + 0.02, 0.25]; }   // curled toward the palm
  }
  if (pose === 'peace') { L[6] = [-0.42, -0.45]; L[7] = [-0.5, -0.8]; L[8] = [-0.58, -1.1]; }             // spread into a V
  if (pose === 'open' || pose === 'snap_released') { L[1] = [-0.45, 0.7]; L[2] = [-0.8, 0.45]; L[3] = [-1.05, 0.2]; L[4] = [-1.3, 0.0]; }
  else { L[1] = [-0.4, 0.7]; L[2] = [-0.5, 0.45]; L[3] = [-0.35, 0.3]; L[4] = [-0.15, 0.25]; }
  if (pose === 'snap_pressed') { L[10] = [0.0, -0.35]; L[11] = [-0.25, -0.3]; L[12] = [-0.45, -0.1]; L[4] = [-0.47, -0.08]; }
  if (pose === 'snap_released') { L[10] = [0.0, -0.35]; L[11] = [0.02, -0.1]; L[12] = [0.02, 0.25]; }
  if (pose === 'pinch') {                                      // "OK" sign: index tip on the thumb tip, other fingers up
    for (const base of [9, 13, 17]) { const dx = mcpX[base]; L[base + 1] = [dx, -0.45]; L[base + 2] = [dx, -0.8]; L[base + 3] = [dx, -1.1]; }
    L[6] = [-0.4, -0.4]; L[7] = [-0.52, -0.3]; L[8] = [-0.55, -0.12];
    L[1] = [-0.45, 0.7]; L[2] = [-0.62, 0.4]; L[3] = [-0.6, 0.12]; L[4] = [-0.5, -0.05];
  }
  return L;
}

/** pose: open | fist | point | peace | pinch | snap_pressed | snap_released | partial (uses `f` = 0 fist .. 1 open). */
export function hand({ cx = 0.5, cy = 0.5, s = 0.1, pose = 'open', angle = 0, f = 1 } = {}) {
  let L;
  if (pose === 'partial') {
    const a = local('fist'), b = local('open');
    L = a.map((p, i) => [p[0] + (b[i][0] - p[0]) * f, p[1] + (b[i][1] - p[1]) * f]);
  } else L = local(pose);
  const c = Math.cos(angle), sn = Math.sin(angle);
  return L.map(([x, y]) => [cx + s * (x * c - y * sn), cy + s * (x * sn + y * c)]);
}
