const { pushSample, toChunks, fromChunks, positionAt, sampleCount, CHUNK_CHARS } = await import("../../behavior_pack/scripts/ghostdata.js");
const assert = (c, m) => { if (!c) { console.error("FAIL", m); process.exitCode = 1; } else console.log("ok  ", m); };
const near = (a, b, e = 0.06) => Math.abs(a - b) <= e;

// simulate a 25-minute run sampled every 0.5s, walking +x, with a portal into the nether at 10:00
const rec = [];
for (let t = 0; t <= 25 * 60000; t += 500) {
  const nether = t >= 600000;
  pushSample(rec, t, { x: nether ? t / 8000 : t / 1000, y: 64.25, z: -12.5 }, (t / 100) % 360, nether ? "minecraft:nether" : "minecraft:overworld");
}
assert(sampleCount(rec) === 3001, "3001 samples recorded");

const chunks = toChunks(rec);
assert(chunks.every((c) => c.length <= CHUNK_CHARS), `every chunk fits in a dynamic property (${chunks.length} chunks)`);
assert(chunks.length <= 20, "a 25 min run fits in the 20 chunk budget");
assert(JSON.stringify(fromChunks(chunks)) === JSON.stringify(rec), "chunks round-trip exactly");

let p = positionAt(rec, 1250);
assert(near(p.x, 1.25) && near(p.y, 64.3, 0.1) && p.dim === "minecraft:overworld", "interpolates between samples");
p = positionAt(rec, 599900);
assert(p.dim === "minecraft:overworld", "still overworld just before the portal");
p = positionAt(rec, 600000);
assert(p.dim === "minecraft:nether" && near(p.x, 75), "snaps across the dimension change (no sliding through the portal)");
p = positionAt(rec, 99999999);
assert(p.done, "after the end the ghost is done");

// hinted search walks forward and backward correctly
let idx = 0, ok = true;
for (let t = 0; t < 120000; t += 50) { const q = positionAt(rec, t, idx); idx = q.idx; if (!near(q.x, t / 1000)) ok = false; }
assert(ok, "tick-by-tick playback with hints stays on track");
assert(near(positionAt(rec, 1000, 2000).x, 1), "a stale hint far ahead still finds the right spot");

// big jump (ender pearl) snaps instead of sliding
const r2 = [];
pushSample(r2, 0, { x: 0, y: 64, z: 0 }, 0, "minecraft:overworld");
pushSample(r2, 500, { x: 40, y: 64, z: 0 }, 0, "minecraft:overworld");
assert(positionAt(r2, 250).x === 0, "pearl-sized jumps snap");
// yaw wraps the short way
const r3 = [];
pushSample(r3, 0, { x: 0, y: 0, z: 0 }, 170, "minecraft:overworld");
pushSample(r3, 1000, { x: 1, y: 0, z: 0 }, -170, "minecraft:overworld");
assert(near(Math.abs(positionAt(r3, 500).yaw), 180, 0.5), "yaw interpolates across ±180 the short way");
