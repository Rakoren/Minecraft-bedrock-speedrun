// Pure ghost data helpers (no game imports, unit tested).
//
// A recording is a flat list of samples: [tDeci, x10, y10, z10, yaw, dim, ...]
//   tDeci - tenths of a second since GO
//   x10.. - position * 10, rounded
//   yaw   - degrees, rounded
//   dim   - 0 overworld, 1 nether, 2 end

export const DIMS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];
export const STRIDE = 6;
export const CHUNK_CHARS = 30000; // dynamic property strings max out around 32k

export function pushSample(rec, tMs, loc, yaw, dimId) {
  rec.push(Math.round(tMs / 100), Math.round(loc.x * 10), Math.round(loc.y * 10), Math.round(loc.z * 10), Math.round(yaw), Math.max(0, DIMS.indexOf(dimId)));
}

export const sampleCount = (rec) => Math.floor(rec.length / STRIDE);

/** Split a JSON-encoded recording into strings that each fit in one dynamic property. */
export function toChunks(rec) {
  const chunks = [];
  let cur = [];
  let len = 2;
  for (let i = 0; i < rec.length; i += STRIDE) {
    const s = rec.slice(i, i + STRIDE);
    const add = JSON.stringify(s).length;
    if (len + add > CHUNK_CHARS && cur.length) {
      chunks.push(JSON.stringify(cur));
      cur = [];
      len = 2;
    }
    cur.push(...s);
    len += add;
  }
  if (cur.length) chunks.push(JSON.stringify(cur));
  return chunks;
}

export function fromChunks(chunks) {
  return chunks.flatMap((c) => JSON.parse(c));
}

/**
 * Where is the ghost at time tMs? Returns { x, y, z, yaw, dim, idx } with
 * linear interpolation, snapping across dimension changes and big jumps
 * (pearls, portals). `hint` = last index, so playback is O(1) per tick.
 */
export function positionAt(rec, tMs, hint = 0) {
  const n = sampleCount(rec);
  if (!n) return undefined;
  const t = tMs / 100;
  let i = Math.min(Math.max(0, hint), n - 1);
  while (i > 0 && rec[i * STRIDE] > t) i--;
  while (i < n - 1 && rec[(i + 1) * STRIDE] <= t) i++;
  const a = i * STRIDE;
  const at = (k) => ({ x: rec[k + 1] / 10, y: rec[k + 2] / 10, z: rec[k + 3] / 10, yaw: rec[k + 4], dim: DIMS[rec[k + 5]] });
  const pa = at(a);
  if (i >= n - 1 || t <= rec[a]) return { ...pa, idx: i, done: i >= n - 1 && t > rec[a] };
  const b = a + STRIDE;
  const pb = at(b);
  const jump = Math.hypot(pb.x - pa.x, pb.y - pa.y, pb.z - pa.z);
  if (pa.dim !== pb.dim || jump > 24) return { ...pa, idx: i, done: false };
  const f = (t - rec[a]) / (rec[b] - rec[a] || 1);
  let dyaw = ((((pb.yaw - pa.yaw + 180) % 360) + 360) % 360) - 180;
  return {
    x: pa.x + (pb.x - pa.x) * f,
    y: pa.y + (pb.y - pa.y) * f,
    z: pa.z + (pb.z - pa.z) * f,
    yaw: pa.yaw + dyaw * f,
    dim: pa.dim,
    idx: i,
    done: false,
  };
}
