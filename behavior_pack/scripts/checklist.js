import { EntityComponentTypes, EquipmentSlot } from "@minecraft/server";
import { countItem, container } from "./util.js";

// ---------- item groups ----------

const LOGS = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak"].map((w) => `minecraft:${w}_log`);
const PICKS = ["stone", "iron", "diamond", "golden"].map((m) => `minecraft:${m}_pickaxe`);
const IRON_PLUS_PICKS = ["iron", "diamond"].map((m) => `minecraft:${m}_pickaxe`);
const BUCKETS = ["minecraft:bucket", "minecraft:water_bucket", "minecraft:lava_bucket"];
const FIRE = ["minecraft:flint_and_steel", "minecraft:fire_charge"];
const WEAPONS = ["stone", "iron", "diamond", "golden", "wooden"].flatMap((m) => [`minecraft:${m}_sword`, `minecraft:${m}_axe`]);
const BEDS = ["minecraft:bed"];
export const BLOCKS = [
  "cobblestone", "cobbled_deepslate", "dirt", "netherrack", "blackstone", "basalt", "stone", "end_stone",
  "oak_planks", "spruce_planks", "birch_planks", "sandstone", "soul_soil",
].map((b) => `minecraft:${b}`);
export const FOODS = [
  "bread", "apple", "golden_apple", "carrot", "baked_potato", "potato", "beetroot", "melon_slice", "sweet_berries",
  "cooked_beef", "cooked_porkchop", "cooked_mutton", "cooked_chicken", "cooked_cod", "cooked_salmon", "cooked_rabbit",
  "beef", "porkchop", "mutton", "chicken", "cod", "salmon", "rabbit", "cookie", "pumpkin_pie", "dried_kelp",
].map((f) => `minecraft:${f}`);

export const sum = (p, ids) => ids.reduce((n, id) => n + countItem(p, id), 0);
const any = (p, ids) => sum(p, ids) > 0;

function wearingGold(p) {
  const eq = p.getComponent(EntityComponentTypes.Equippable);
  if (!eq) return false;
  return [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet].some((s) =>
    eq.getEquipment(s)?.typeId.startsWith("minecraft:golden_")
  );
}

/** Blaze rods "earned", counting ones already turned into powder/eyes. */
function rodValue(p) {
  return countItem(p, "minecraft:blaze_rod") + Math.floor((countItem(p, "minecraft:blaze_powder") + countItem(p, "minecraft:ender_eye")) / 2);
}

/** How many more eyes you could craft right now. */
export function craftableEyes(p) {
  const powder = countItem(p, "minecraft:blaze_powder") + countItem(p, "minecraft:blaze_rod") * 2;
  return Math.min(powder, countItem(p, "minecraft:ender_pearl"));
}

// ---------- checklist items ----------
// count(p, run) -> number; done when count >= need. `opt` items are nice-to-have.

const beds = (need, opt) => ({
  id: "beds", label: "Beds (for the dragon)", need, opt,
  count: (p) => sum(p, BEDS),
  hint: "Beds explode in the End and are your main dragon damage. Grab them from villages, or craft them: 3 wool + 3 planks. Wool comes from sheep (kill or shear) or string from piglin trades (4 string = 1 wool).",
});

const food = (need) => ({
  id: "food", label: "Food", need,
  count: (p) => sum(p, FOODS),
  hint: "Kill a few sheep/cows/pigs as you pass (cook them with a furnace or a lit campfire if you have time). Villages: hay bales -> bread. Don't stop to farm.",
});

export const PHASES = [
  {
    id: "overworld",
    name: "Overworld",
    exit: "Enter the Nether",
    items: [
      {
        id: "wood", label: "Logs", need: 4,
        count: (p) => (any(p, PICKS) ? 4 : sum(p, LOGS)),
        hint: "4-5 logs is plenty: crafting table, sticks, wooden pickaxe. Don't chop the whole tree, take what you need and move.",
      },
      {
        id: "pick", label: "Stone pickaxe", need: 1,
        count: (p) => (any(p, PICKS) ? 1 : 0),
        hint: "Wooden pickaxe -> mine 3 cobblestone -> stone pickaxe. Grab 3 extra cobble for a stone axe (faster wood, and it's a decent weapon).",
      },
      {
        id: "iron", label: "Iron (for bucket)", need: 3,
        count: (p) => (any(p, BUCKETS) ? 3 : countItem(p, "minecraft:iron_ingot")),
        hint: "Best sources: ruined portal / shipwreck / village chests (already smelted!). Ore on cliffs or in caves gives raw iron, which needs a furnace. Use Scout -> Iron ore or Village.",
      },
      {
        id: "bucket", label: "Bucket", need: 1,
        count: (p) => (any(p, BUCKETS) ? 1 : 0),
        hint: "3 iron ingots in a V shape. Fill it with water right away. Water is how you make obsidian, and it saves you from falls and fire.",
      },
      {
        id: "fire", label: "Flint & steel", need: 1,
        count: (p) => (any(p, FIRE) ? 1 : 0),
        hint: "1 iron + 1 flint. Flint drops from gravel (~10%). Ruined portal chests often have flint & steel or a fire charge, which also lights portals.",
      },
      {
        id: "lava", label: "Find lava", need: 1,
        count: (p, run) => (run.foundLava || countItem(p, "minecraft:lava_bucket") || countItem(p, "minecraft:obsidian") >= 10 ? 1 : 0),
        hint: "Look for an orange glow, smoke particles or burnt grass. Surface pools are common in deserts, savannas and badlands, and ruined portals often have lava around them. A big ravine or cave also works. Use Scout -> Lava to learn what it looks like from a distance.",
      },
      food(8),
      {
        id: "ironpick", label: "Iron pickaxe", need: 1, opt: true,
        count: (p) => (any(p, IRON_PLUS_PICKS) ? 1 : 0),
        hint: "3 more iron. Only an iron pickaxe can mine gold blocks in bastions, and that's a ton of bartering gold.",
      },
      beds(5, true),
    ],
  },
  {
    id: "nether",
    name: "Nether",
    exit: "Back to the Overworld",
    items: [
      {
        id: "gold", label: "Wear gold armor", need: 1,
        count: (p) => (wearingGold(p) ? 1 : 0),
        hint: "One piece of gold armor (boots are cheapest: 4 ingots) keeps piglins from attacking you. Get it on BEFORE you walk into a bastion.",
      },
      {
        id: "pearls", label: "Ender pearls", need: 12,
        count: (p) => countItem(p, "minecraft:ender_pearl") + countItem(p, "minecraft:ender_eye"),
        hint: "Barter gold with piglins: throw gold near several at once. Pearls are a rare roll, so it takes lots of gold. Mine gold blocks (9 ingots each) with an iron pickaxe.",
      },
      {
        id: "rods", label: "Blaze rods", need: 7,
        count: (p) => rodValue(p),
        hint: "Find a fortress (dark red bricks). Sit next to a blaze spawner behind a block and let blazes come to you. Each drops 0-1 rods. 6-7 is enough.",
      },
      food(6),
      {
        id: "blocks", label: "Building blocks", need: 32, opt: true,
        count: (p) => sum(p, BLOCKS),
        hint: "Keep a stack of one block type for bridging over lava and pillaring. Netherrack and blackstone are free in the Nether.",
      },
      beds(5, true),
    ],
  },
  {
    id: "stronghold",
    name: "Stronghold",
    exit: "Enter the End",
    items: [
      {
        id: "eyes", label: "Eyes of ender", need: 12,
        count: (p) => countItem(p, "minecraft:ender_eye") + craftableEyes(p),
        hint: "1 pearl + 1 blaze powder each. Every throw has a 20% chance to break the eye, and a portal is usually missing ~10, so 12+ is safe.",
      },
      {
        id: "tri", label: "Triangulate (2 throws)", need: 1,
        count: (p, run) => (run.tri?.estimate ? 1 : 0),
        hint: "Throw an eye, look right at it while it hovers, book -> Mark eye throw. Move ~200 blocks sideways, do it again. The book gives you coordinates. Doing this in the Nether (divide by 8) saves a lot of walking.",
      },
      {
        id: "pick", label: "Pickaxe", need: 1,
        count: (p) => (any(p, PICKS) ? 1 : 0),
        hint: "You'll dig down into the stronghold. Dig a 1x2 staircase, never straight down.",
      },
      beds(5, false),
      {
        id: "blocks", label: "Building blocks", need: 32,
        count: (p) => sum(p, BLOCKS),
        hint: "You need blocks in the End to tower up, block the bed blast, and cross gaps.",
      },
      food(4),
    ],
  },
  {
    id: "end",
    name: "The End",
    exit: "Kill the dragon",
    items: [
      beds(4, false),
      {
        id: "blocks", label: "Building blocks", need: 16,
        count: (p) => sum(p, BLOCKS),
        hint: "Put a block between you and the bed before you blow it up.",
      },
      {
        id: "weapon", label: "Sword or axe", need: 1,
        count: (p) => (any(p, WEAPONS) ? 1 : 0),
        hint: "For hitting the dragon's head while it perches, and for endermen. Don't look at endermen!",
      },
      food(4),
    ],
  },
];

export function getPhase(id) {
  return PHASES.find((ph) => ph.id === id) ?? PHASES[0];
}

/** Evaluate each item: [{item, have, done}] */
export function evaluate(p, run, phase) {
  return phase.items.map((item) => {
    const have = item.count(p, run);
    return { item, have, done: have >= item.need };
  });
}

/** First unfinished required item, else first unfinished optional, else undefined. */
export function nextItem(results) {
  return results.find((r) => !r.done && !r.item.opt) ?? results.find((r) => !r.done);
}

// ---------- inventory coaching ----------

const is = (ids) => (id) => ids.includes(id);
const HOTBARS = {
  overworld: [
    { name: "Pickaxe", match: is(PICKS) },
    { name: "Axe", match: (id) => id.endsWith("_axe") },
    { name: "Bucket", match: is(BUCKETS) },
    { name: "Flint & steel", match: is(FIRE) },
    { name: "Blocks", match: is(BLOCKS) },
    { name: "Food", match: is(FOODS) },
    { name: "Logs/planks", match: (id) => LOGS.includes(id) || id.endsWith("_planks") },
    { name: "Crafting table", match: is(["minecraft:crafting_table"]) },
  ],
  nether: [
    { name: "Pickaxe", match: is(PICKS) },
    { name: "Sword/axe", match: is(WEAPONS) },
    { name: "Blocks", match: is(BLOCKS) },
    { name: "Gold", match: is(["minecraft:gold_ingot"]) },
    { name: "Food", match: is(FOODS) },
    { name: "Pearls", match: is(["minecraft:ender_pearl"]) },
    { name: "Fire res / potion", match: is(["minecraft:potion", "minecraft:splash_potion"]) },
    { name: "Bucket", match: is(BUCKETS) },
  ],
  stronghold: [
    { name: "Pickaxe", match: is(PICKS) },
    { name: "Eyes", match: is(["minecraft:ender_eye"]) },
    { name: "Blocks", match: is(BLOCKS) },
    { name: "Food", match: is(FOODS) },
    { name: "Sword/axe", match: is(WEAPONS) },
    { name: "Pearls", match: is(["minecraft:ender_pearl"]) },
    { name: "Water bucket", match: is(["minecraft:water_bucket"]) },
    { name: "Beds", match: is(BEDS) },
  ],
  end: [
    { name: "Sword/axe", match: is(WEAPONS) },
    { name: "Beds", match: is(BEDS) },
    { name: "Blocks", match: is(BLOCKS) },
    { name: "Pickaxe", match: is(PICKS) },
    { name: "Food", match: is(FOODS) },
    { name: "Pearls", match: is(["minecraft:ender_pearl"]) },
    { name: "Water bucket", match: is(["minecraft:water_bucket"]) },
    { name: "Bow", match: is(["minecraft:bow"]) },
  ],
};

const JUNK = [
  "wheat_seeds", "rotten_flesh", "bone", "spider_eye", "andesite", "diorite", "granite", "tuff", "gravel", "sand",
  "feather", "leather", "egg", "poisonous_potato", "flint", "string", "coal",
].map((j) => `minecraft:${j}`);
const KEEP_IN_CASE = { "minecraft:flint": "overworld", "minecraft:string": "*", "minecraft:coal": "overworld" };

export function inventoryReport(p, phaseId) {
  const inv = container(p);
  const layout = HOTBARS[phaseId] ?? HOTBARS.overworld;
  const lines = [];
  lines.push(`§fFree slots: ${inv.emptySlotsCount}/${inv.size}`);

  // hotbar
  lines.push("\n§eRecommended hotbar (slot: item):");
  layout.forEach((spec, i) => {
    const it = inv.getItem(i);
    const ok = it && spec.match(it.typeId);
    lines.push(` ${ok ? "§a" : "§c"}${i + 1}: ${spec.name}${ok ? "" : `§7 (now: ${it ? pretty(it.typeId) : "empty"})`}`);
  });
  lines.push(" §79: Academy book");

  // junk + clutter
  const counts = new Map();
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (it) counts.set(it.typeId, (counts.get(it.typeId) ?? 0) + it.amount);
  }
  const junk = [...counts]
    .filter(([id]) => JUNK.includes(id) && !(KEEP_IN_CASE[id] === "*" || KEEP_IN_CASE[id] === phaseId))
    .map(([id, n]) => `${pretty(id)} x${n}`);
  const blockTypes = [...counts.keys()].filter((id) => BLOCKS.includes(id));
  lines.push("\n§eClutter:");
  if (junk.length) lines.push(` §cToss:§7 ${junk.join(", ")}`);
  if (blockTypes.length > 2) lines.push(` §6You carry ${blockTypes.length} kinds of blocks.§7 Keep 1-2 kinds so the stacks stay full.`);
  if (!junk.length && blockTypes.length <= 2) lines.push(" §aLooks clean!");
  lines.push(
    "\n§eHabits:§7 Pick up only what's on your checklist. Toss junk while you're walking, not standing still. Keep tools in the same slots every run so your fingers learn them."
  );
  return lines.join("\n");
}

/** Swap matching items into the recommended hotbar slots (never touches slot 9). */
export function arrangeHotbar(p, phaseId) {
  const inv = container(p);
  const layout = HOTBARS[phaseId] ?? HOTBARS.overworld;
  const settled = new Set([8]); // slot 9 = book
  layout.forEach((spec, i) => {
    const cur = inv.getItem(i);
    if (cur && spec.match(cur.typeId)) return void settled.add(i);
    for (let j = 0; j < inv.size; j++) {
      if (j === i || settled.has(j)) continue;
      const it = inv.getItem(j);
      if (it && spec.match(it.typeId)) {
        inv.swapItems(i, j, inv);
        settled.add(i);
        return;
      }
    }
  });
}

export function pretty(id) {
  return id.replace("minecraft:", "").replace(/_/g, " ");
}
