// Two-throw eye of ender triangulation (shared by the lesson and the guided run).

/** state.marks: up to 2 throws; state.estimate: last good {x, z}. */
export function markThrow(p, state) {
  state.marks ??= [];
  const v = p.getViewDirection();
  const len = Math.hypot(v.x, v.z);
  if (len < 0.2) {
    p.sendMessage("§cYou're looking too far up/down. Look at the hovering eye, then mark.");
    return;
  }
  const mark = { x: p.location.x, z: p.location.z, dx: v.x / len, dz: v.z / len };
  state.marks.push(mark);
  if (state.marks.length > 2) state.marks.shift();
  const bearing = Math.round((Math.atan2(-mark.dx, mark.dz) * 180) / Math.PI);
  p.sendMessage(`§aThrow marked§7 at §f${Math.round(mark.x)}, ${Math.round(mark.z)}§7 facing §f${bearing}°`);

  if (state.marks.length < 2) {
    p.sendMessage("§7Now move ~200 blocks §fsideways§7 to the eye's direction and throw again.");
    return;
  }
  const [a, b] = state.marks;
  const sep = Math.hypot(b.x - a.x, b.z - a.z);
  const angle = (Math.acos(Math.max(-1, Math.min(1, a.dx * b.dx + a.dz * b.dz))) * 180) / Math.PI;
  const hit = intersect(a, b);
  if (!hit) {
    p.sendMessage(`§cThe two lines don't cross well (${angle.toFixed(1)}° apart). Move further sideways and throw again.`);
    return;
  }
  state.estimate = hit;
  const dist = Math.round(Math.hypot(hit.x - p.location.x, hit.z - p.location.z));
  p.sendMessage(
    `§6Stronghold estimate:§f ${Math.round(hit.x)}, ${Math.round(hit.z)}§7  (${dist} blocks away)\n` +
      `§cNether:§f ${Math.round(hit.x / 8)}, ${Math.round(hit.z / 8)}\n` +
      `§7Throws were ${Math.round(sep)} blocks apart, lines cross at ${angle.toFixed(1)}°.` +
      (angle < 5 ? " §eLow angle = shaky estimate. Spread throws out more." : " §aGood spread.")
  );
}

/** Intersect two rays (x,z + t*(dx,dz)); null if parallel or behind either thrower. */
export function intersect(a, b) {
  const den = a.dx * b.dz - a.dz * b.dx;
  if (Math.abs(den) < 1e-4) return null;
  const t = ((b.x - a.x) * b.dz - (b.z - a.z) * b.dx) / den;
  const u = ((b.x - a.x) * a.dz - (b.z - a.z) * a.dx) / den;
  if (t < 0 || u < 0) return null;
  return { x: a.x + a.dx * t, z: a.z + a.dz * t };
}
