import { register } from "node:module";
register("./hooks.mjs", import.meta.url);
const { PHASES, evaluate, nextItem, inventoryReport, arrangeHotbar, getPhase } = await import("../../behavior_pack/scripts/checklist.js");
const assert = (c, m) => { if (!c) { console.error("FAIL", m); process.exitCode = 1; } else console.log("ok  ", m); };

function fakePlayer(items, feet) {
  const slots = Array(36).fill(undefined);
  items.forEach(([id, n], i) => (slots[i] = { typeId: id, amount: n }));
  const inv = {
    size: 36, get emptySlotsCount() { return slots.filter((s) => !s).length; },
    getItem: (i) => slots[i], swapItems: (a, b) => ([slots[a], slots[b]] = [slots[b], slots[a]]),
  };
  return { slots, getComponent: (c) => (c === "minecraft:inventory" ? { container: inv } : { getEquipment: (s) => (s === "Feet" && feet ? { typeId: feet } : undefined) }) };
}

const ow = getPhase("overworld");
let p = fakePlayer([["minecraft:oak_log", 2]]);
let r = evaluate(p, {}, ow);
assert(nextItem(r).item.id === "wood", "fresh start -> next is wood");
p = fakePlayer([["minecraft:stone_pickaxe", 1], ["minecraft:iron_ingot", 2], ["minecraft:bread", 3]]);
r = evaluate(p, {}, ow);
assert(r.find((x) => x.item.id === "wood").done, "having a stone pick auto-completes logs");
assert(nextItem(r).item.id === "iron" && nextItem(r).have === 2, "next is iron 2/3");
p = fakePlayer([["minecraft:stone_pickaxe", 1], ["minecraft:water_bucket", 1], ["minecraft:flint_and_steel", 1], ["minecraft:cooked_beef", 9]]);
r = evaluate(p, { foundLava: true }, ow);
assert(!nextItem(r) || nextItem(r).item.opt, "all required overworld items done with bucket+f&s+lava+food");

const ne = getPhase("nether");
p = fakePlayer([["minecraft:ender_pearl", 5], ["minecraft:ender_eye", 2], ["minecraft:blaze_rod", 3], ["minecraft:blaze_powder", 2]], "minecraft:golden_boots");
r = evaluate(p, {}, ne);
assert(r.find((x) => x.item.id === "gold").done, "gold boots detected");
assert(r.find((x) => x.item.id === "pearls").have === 7, "pearls count includes eyes (5+2=7)");
assert(r.find((x) => x.item.id === "rods").have === 5, "rods count includes powder & eyes (3 + (2+2)/2 = 5)");

const sh = getPhase("stronghold");
p = fakePlayer([["minecraft:ender_eye", 4], ["minecraft:ender_pearl", 8], ["minecraft:blaze_rod", 3]]);
r = evaluate(p, { tri: {} }, sh);
assert(r.find((x) => x.item.id === "eyes").have === 10, "eyes = 4 held + 6 craftable");

p = fakePlayer([["minecraft:dirt", 20], ["minecraft:wheat_seeds", 5], ["minecraft:bread", 4], ["minecraft:cobblestone", 10], ["minecraft:diorite", 3], ["minecraft:stone_pickaxe", 1], ["minecraft:netherrack", 4]]);
const rep = inventoryReport(p, "overworld");
assert(rep.includes("wheat seeds x5") && rep.includes("diorite x3"), "junk flagged");
assert(rep.includes("3 kinds of blocks"), "block clutter flagged");
arrangeHotbar(p, "overworld");
assert(p.slots[0].typeId === "minecraft:stone_pickaxe", "arrange puts pickaxe in slot 1");
assert(["minecraft:dirt", "minecraft:cobblestone", "minecraft:netherrack"].includes(p.slots[4].typeId), "arrange puts blocks in slot 5");
assert(p.slots[5].typeId === "minecraft:bread", "arrange puts food in slot 6");
assert(PHASES.every((ph) => ph.items.every((i) => i.hint && i.label)), "every item has a hint");
