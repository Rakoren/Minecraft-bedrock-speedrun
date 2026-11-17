// Verifies every literal "minecraft:..." id in the scripts exists in vanilla data (items, blocks, entities, dimensions).
import { readFileSync, readdirSync } from "fs";
const lib = "node_modules/@minecraft/vanilla-data/lib/";
const known = new Set(readdirSync(lib).filter((f) => f.endsWith(".d.ts")).flatMap((f) => [...readFileSync(lib + f, "utf8").matchAll(/"(minecraft:[a-z0-9_]+)"/g)].map((m) => m[1])));
const dir = "behavior_pack/scripts/";
let bad = 0;
for (const f of readdirSync(dir)) {
  const src = readFileSync(dir + f, "utf8");
  // expand `minecraft:${x}_suffix` templates from simple array maps
  const ids = [...src.matchAll(/"(minecraft:[a-z0-9_]+)"/g)].map((m) => m[1]);
  for (const m of src.matchAll(/\[([^\]]+)\]\.map\(\((\w)\) => `minecraft:(\w*)\$\{\2\}(\w*)`\)/g))
    for (const w of m[1].matchAll(/"([a-z0-9_]+)"/g)) ids.push(`minecraft:${m[3]}${w[1]}${m[4]}`);
  for (const m of src.matchAll(/\[([^\]]+)\]\.flatMap\(\((\w)\) => \[([^\]]+)\]\)/g))
    for (const w of m[1].matchAll(/"([a-z0-9_]+)"/g))
      for (const t of m[3].matchAll(/`minecraft:\$\{\w\}(\w*)`/g)) ids.push(`minecraft:${w[1]}${t[1]}`);
  for (const id of new Set(ids)) if (!id.endsWith("_") && !known.has(id)) { console.log(`${f}: unknown id ${id}`); bad++; }
}
console.log(bad ? `${bad} unknown ids` : "all ids ok");
process.exit(bad ? 1 : 0);
