import { world } from "@minecraft/server";

// Options shown in the world-creation "pack settings" screen (see manifest.json),
// with in-game overrides stored on the world so the book can change them too.

export const MODES = [
  { id: "practice", name: "Practice / Guided run" },
  { id: "race_world", name: "Race: same world" },
  { id: "race_seed", name: "Race: same seed, separate worlds" },
];

export const START_TYPES = [
  { id: "random", name: "Random (normal spawn)" },
  { id: "village", name: "Village" },
  { id: "ruined_portal", name: "Ruined portal" },
  { id: "shipwreck", name: "Shipwreck" },
  { id: "buried_treasure", name: "Buried treasure" },
  { id: "lava_pool", name: "Lava pool (desert/badlands)" },
];

const KEYS = {
  mode: "academy:mode",
  start: "academy:start_type",
  scout: "academy:allow_scout",
  pvp: "academy:race_pvp",
  countdown: "academy:countdown",
  ghost: "academy:show_ghost",
};
const DEFAULTS = { mode: "practice", start: "random", scout: true, pvp: false, countdown: 5, ghost: true };
const LISTS = { mode: MODES, start: START_TYPES };

/** Normalise whatever the engine hands back (option name, index, or namespaced name). */
export function normalize(key, v) {
  const list = LISTS[key];
  if (!list) return v;
  if (typeof v === "number") return list[v]?.id ?? DEFAULTS[key];
  if (typeof v === "string") {
    const bare = v.includes(":") ? v.split(":").pop() : v;
    return list.some((o) => o.id === bare) ? bare : DEFAULTS[key];
  }
  return DEFAULTS[key];
}

export function getSetting(key) {
  const override = world.getDynamicProperty(`cfg:${key}`);
  if (override !== undefined) return override;
  try {
    const v = world.getPackSettings()[KEYS[key]];
    if (v !== undefined) return normalize(key, v);
  } catch {
    // older game version without pack settings
  }
  return DEFAULTS[key];
}

export function setSetting(key, value) {
  world.setDynamicProperty(`cfg:${key}`, value);
}

export const modeName = (id) => MODES.find((m) => m.id === id)?.name ?? id;
export const startName = (id) => START_TYPES.find((s) => s.id === id)?.name ?? id;
