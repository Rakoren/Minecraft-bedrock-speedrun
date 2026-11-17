import { BlockVolume } from "@minecraft/server";
import { sleep } from "./util.js";

// What the Scout can look for. `look` teaches what to spot by eye in a real run.
export const SCOUT_TARGETS = {
  "minecraft:overworld": [
    {
      id: "lava",
      label: "Lava",
      types: ["minecraft:lava", "minecraft:flowing_lava"],
      look: "Orange glow at night, smoke/drip particles, burnt grass. Surface pools are common in deserts, savannas and badlands. Underground: ravines and big caves near the bottom of the world.",
    },
    {
      id: "portal",
      label: "Ruined portal",
      types: ["minecraft:crying_obsidian", "minecraft:obsidian"],
      look: "A broken obsidian frame, usually with netherrack, magma and a loot chest (flint & steel, obsidian, gold, sometimes iron). Often there's lava nearby too.",
    },
    {
      id: "village",
      label: "Village",
      types: ["minecraft:bed", "minecraft:hay_block", "minecraft:bell"],
      look: "Paths, farms and hay bales. Free beds, bread (from hay) and a blacksmith chest that might have iron.",
    },
    {
      id: "iron",
      label: "Iron ore",
      types: ["minecraft:iron_ore", "minecraft:deepslate_iron_ore"],
      look: "Tan-spotted stone on cliffs and cave walls. Drops raw iron, which you smelt in a furnace (coal or planks as fuel).",
    },
    {
      id: "gravel",
      label: "Gravel (flint)",
      types: ["minecraft:gravel"],
      look: "Gray speckled blocks on beaches, riverbeds and mountains. About 1 in 10 drops flint. Break it on the ground so it doesn't keep falling.",
    },
  ],
  "minecraft:nether": [
    {
      id: "bastion",
      label: "Bastion",
      types: ["minecraft:gilded_blackstone", "minecraft:polished_blackstone_bricks"],
      look: "Huge dark blackstone castles with piglins. Gold blocks and chests inside. Wear gold armor before you go in.",
    },
    {
      id: "gold",
      label: "Gold blocks",
      types: ["minecraft:gold_block"],
      look: "Shiny yellow blocks inside bastions. Each one = 9 ingots of bartering. Needs an iron pickaxe or better.",
    },
    {
      id: "fortress",
      label: "Fortress",
      types: ["minecraft:nether_brick", "minecraft:nether_brick_fence"],
      look: "Dark red-brown brick bridges and towers. Blaze spawners are on raised platforms with fences.",
    },
    {
      id: "nlava",
      label: "Lava (careful!)",
      types: ["minecraft:lava"],
      look: "Lava lakes are everywhere in the Nether. Watch your step and don't dig straight down.",
    },
  ],
  "minecraft:the_end": [],
};

/**
 * Scan a box around `center` in `dim` for any of `types`, spread over several ticks.
 * `accept(loc)` can reject matches (e.g. a chest that isn't in a shipwreck).
 * Returns { nearest, dist, count, cluster } or undefined.
 * @param {import("@minecraft/server").Dimension} dim
 * @param {import("@minecraft/server").Vector3} center
 * @param {string[]} types
 * @param {{ radius?: number, below?: number, above?: number, accept?: (loc: import("@minecraft/server").Vector3) => boolean }} [opts]
 */
export async function scanAt(dim, center, types, { radius = 48, below = 32, above = 24, accept } = {}) {
  const c = center;
  const ymin = Math.max(dim.heightRange.min, Math.floor(c.y - below));
  const ymax = Math.min(dim.heightRange.max - 1, Math.floor(c.y + above));
  const cx = Math.floor(c.x);
  const cz = Math.floor(c.z);

  let nearest;
  let best = Infinity;
  let count = 0;
  const sample = [];
  const STEP = 8;
  for (let x = cx - radius; x <= cx + radius; x += STEP) {
    try {
      const vol = new BlockVolume(
        { x, y: ymin, z: cz - radius },
        { x: Math.min(x + STEP - 1, cx + radius), y: ymax, z: cz + radius }
      );
      for (const loc of dim.getBlocks(vol, { includeTypes: types }, true).getBlockLocationIterator()) {
        if (accept && !accept(loc)) continue;
        count++;
        if (sample.length < 4000) sample.push(loc);
        const d = (loc.x - c.x) ** 2 + (loc.y - c.y) ** 2 + (loc.z - c.z) ** 2;
        if (d < best) {
          best = d;
          nearest = loc;
        }
      }
    } catch {
      // unloaded / out of range slice, skip it
    }
    await sleep(1);
  }
  if (!nearest) return undefined;
  const cluster = sample.filter((l) => Math.abs(l.x - nearest.x) <= 4 && Math.abs(l.y - nearest.y) <= 2 && Math.abs(l.z - nearest.z) <= 4).length;
  return { nearest, dist: Math.round(Math.sqrt(best)), count, cluster };
}

/** Scan around the player. */
export function scan(player, types, radius = 48, below = 32, above = 24) {
  return scanAt(player.dimension, player.location, types, { radius, below, above });
}

/** "ahead", "right", "behind-left"... relative to where the player is looking. */
export function direction(player, target) {
  const p = player.location;
  const dx = target.x + 0.5 - p.x;
  const dz = target.z + 0.5 - p.z;
  const want = (Math.atan2(-dx, dz) * 180) / Math.PI;
  let rel = want - player.getRotation().y;
  rel = ((((rel + 180) % 360) + 360) % 360) - 180;
  const names = ["ahead", "ahead-right", "right", "behind-right", "behind", "behind-left", "left", "ahead-left"];
  const idx = ((Math.round(rel / 45) % 8) + 8) % 8;
  const dy = Math.round(target.y - p.y);
  const vert = dy > 3 ? `, ${dy} up` : dy < -3 ? `, ${-dy} down` : "";
  return `${names[idx]}${vert}`;
}
