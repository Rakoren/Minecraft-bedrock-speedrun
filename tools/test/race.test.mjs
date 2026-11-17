import { register } from "node:module";
register("./hooks.mjs", import.meta.url);
const { makeCode, parseCode, seedHash } = await import("../../behavior_pack/scripts/racecode.js");
const { normalize } = await import("../../behavior_pack/scripts/settings.js");
const assert = (c, m) => { if (!c) { console.error("FAIL", m); process.exitCode = 1; } else console.log("ok  ", m); };

const t = Date.UTC(2026, 10, 20, 19, 30, 0);
const code = makeCode(t, "-4172144997902289642", 1);
const back = parseCode(code);
assert(back && back.startAtMs === t, `race code round-trips start time (${code})`);
assert(back.hash === seedHash("-4172144997902289642") && back.startIndex === 1, "race code keeps seed hash + start type");
assert(parseCode(code.toLowerCase())?.startAtMs === t, "codes are case-insensitive");
assert(parseCode("  " + code + " ") !== undefined, "codes tolerate spaces");
assert(parseCode("hello") === undefined && parseCode("ABCDEF-12-1") === undefined, "garbage codes rejected");
assert(seedHash("123") !== seedHash("124"), "different seeds hash differently");
assert(seedHash("123").length === 4, "hash is 4 chars");

assert(normalize("start", "village") === "village", "settings: plain option name");
assert(normalize("start", "academy:shipwreck") === "shipwreck", "settings: namespaced option name");
assert(normalize("mode", 2) === "race_seed", "settings: option index");
assert(normalize("start", "nonsense") === "random", "settings: unknown falls back to default");
assert(normalize("countdown", 7) === 7, "settings: non-list values pass through");
