// Race codes for "same seed, separate worlds" races. Pure functions (unit tested).
// Code = <start time, unix seconds, base36>-<seed hash>-<start type index>, e.g. "T4X2KQ-9ZQ1-1"

export function seedHash(seed) {
  let h = 0x811c9dc5;
  for (const ch of String(seed)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h % 36 ** 4).toString(36).padStart(4, "0").toUpperCase();
}

export function makeCode(startAtMs, seed, startIndex) {
  return `${Math.floor(startAtMs / 1000).toString(36).toUpperCase()}-${seedHash(seed)}-${startIndex}`;
}

/** -> { startAtMs, hash, startIndex } or undefined if malformed */
export function parseCode(code) {
  const m = String(code).trim().toUpperCase().match(/^([0-9A-Z]{5,8})-([0-9A-Z]{4})-(\d{1,2})$/);
  if (!m) return undefined;
  return { startAtMs: parseInt(m[1], 36) * 1000, hash: m[2], startIndex: Number(m[3]) };
}
