import { world, system } from "@minecraft/server";
import { pushSample, toChunks, fromChunks, positionAt } from "./ghostdata.js";
import { direction } from "./scout.js";
import { fmt } from "./util.js";
import { getSetting } from "./settings.js";

// "Race your PB": records your position during timed runs and, once you set a
// PB, replays it as a see-through ghost on your next attempts.

const GHOST = "academy:ghost";
const SHOW_WITHIN = 80; // blocks: farther than this the ghost is shown on the action bar instead
const RECORD_EVERY_MS = 500;
const MAX_CHUNKS = 20;

/** player.id -> { run, rec, lastRec, ghost?: {rec, splits, total}, entity?, idx } */
const active = new Map();

// ---------- storage (per player, per world) ----------

function loadGhost(player) {
  const n = Number(player.getDynamicProperty("ghost:n") ?? 0);
  if (!n) return undefined;
  if (player.getDynamicProperty("ghost:seed") !== world.seed) return undefined;
  try {
    const chunks = [];
    for (let i = 0; i < n; i++) chunks.push(String(player.getDynamicProperty(`ghost:${i}`)));
    return {
      rec: fromChunks(chunks),
      splits: JSON.parse(String(player.getDynamicProperty("ghost:splits") ?? "[]")),
      total: Number(player.getDynamicProperty("ghost:total") ?? 0),
    };
  } catch (e) {
    console.warn(`[Speedrun Academy] bad ghost data: ${e}`);
    return undefined;
  }
}

function saveGhost(player, rec, splits, total) {
  const chunks = toChunks(rec);
  if (chunks.length > MAX_CHUNKS) {
    player.sendMessage("§7(Run too long to save as a ghost.)");
    return;
  }
  const old = Number(player.getDynamicProperty("ghost:n") ?? 0);
  for (let i = 0; i < Math.max(old, chunks.length); i++) player.setDynamicProperty(`ghost:${i}`, chunks[i]);
  player.setDynamicProperty("ghost:n", chunks.length);
  player.setDynamicProperty("ghost:seed", world.seed);
  player.setDynamicProperty("ghost:splits", JSON.stringify(splits.map((s) => ({ id: s.id, at: s.at }))));
  player.setDynamicProperty("ghost:total", total);
}

export function hasGhost(player) {
  return Number(player.getDynamicProperty("ghost:n") ?? 0) > 0 && player.getDynamicProperty("ghost:seed") === world.seed;
}

export function deleteGhost(player) {
  const n = Number(player.getDynamicProperty("ghost:n") ?? 0);
  for (let i = 0; i < n; i++) player.setDynamicProperty(`ghost:${i}`, undefined);
  for (const k of ["ghost:n", "ghost:seed", "ghost:splits", "ghost:total"]) player.setDynamicProperty(k, undefined);
}

// ---------- lifecycle (called from run.js) ----------

/** Start recording (always, for timed runs) and playback (if a PB ghost exists for this seed). */
export function beginGhost(run) {
  endGhost(run);
  const state = { run, rec: [], lastRec: -Infinity, ghost: undefined, entity: undefined, idx: 0 };
  const worldRace = run.race && run.race !== "seed";
  if (getSetting("ghost") && !worldRace) {
    state.ghost = loadGhost(run.player);
    if (state.ghost) run.player.sendMessage(`§bYour PB ghost (${fmt(state.ghost.total)}) is racing you.`);
  }
  active.set(run.player.id, state);
}

export function endGhost(run) {
  const s = active.get(run.player.id);
  if (!s) return;
  removeEntity(s);
  active.delete(run.player.id);
}

/** Called on every split: "-0:12.300 vs ghost" */
export function ghostSplitDelta(run, phaseId, at) {
  const g = active.get(run.player.id)?.ghost;
  const gs = g?.splits.find((s) => s.id === phaseId);
  if (!gs) return "";
  const d = at - gs.at;
  return d <= 0 ? ` §a(-${fmt(-d)} vs ghost)` : ` §c(+${fmt(d)} vs ghost)`;
}

/** Called when the run finishes. Saves a new ghost if it beats the saved one for this seed. */
export function finishGhost(run, total, counts) {
  const s = active.get(run.player.id);
  if (!s) return;
  pushSample(s.rec, total, run.player.location, run.player.getRotation().y, run.player.dimension.id);
  const prev = hasGhost(run.player) ? Number(run.player.getDynamicProperty("ghost:total")) : undefined;
  if (counts && (!prev || total < prev)) {
    saveGhost(run.player, s.rec, run.splits, total);
    run.player.sendMessage("§bSaved as your new PB ghost.§7 It'll race you next time on this seed.");
  } else if (s.ghost) {
    const d = total - s.ghost.total;
    if (d < 0) run.player.sendMessage(`§aYou beat your ghost by §f${fmt(-d)}§a!`);
    else run.player.sendMessage(`§7Your ghost won by §f${fmt(d)}§7.`);
  }
  endGhost(run);
}

/** One action-bar line about the ghost, or "" */
export function ghostStatus(run) {
  const s = active.get(run.player.id);
  if (!s?.ghost || !s.pos) return "";
  const p = run.player;
  if (s.pos.done) return "§bGhost finished!";
  if (s.pos.dim !== p.dimension.id) return `§bGhost is in the ${s.pos.dim.replace("minecraft:", "").replace("the_", "")}`;
  const d = Math.round(Math.hypot(s.pos.x - p.location.x, s.pos.y - p.location.y, s.pos.z - p.location.z));
  if (d <= SHOW_WITHIN) return d < 3 ? "§bNeck and neck with your ghost!" : `§bGhost ${d}m ${direction(p, { x: s.pos.x - 0.5, y: s.pos.y, z: s.pos.z - 0.5 })}`;
  return `§bGhost ${d}m away, ${direction(p, { x: s.pos.x - 0.5, y: s.pos.y, z: s.pos.z - 0.5 })}`;
}

// ---------- the entity ----------

function removeEntity(s) {
  try {
    if (s.entity?.isValid) s.entity.remove();
  } catch {}
  s.entity = undefined;
}

function placeEntity(s, pos) {
  const p = s.run.player;
  const near = pos.dim === p.dimension.id && Math.hypot(pos.x - p.location.x, pos.z - p.location.z) <= SHOW_WITHIN;
  if (!near || pos.done) return removeEntity(s);
  const loc = { x: pos.x, y: pos.y, z: pos.z };
  try {
    if (!s.entity?.isValid || s.entity.dimension.id !== pos.dim) {
      removeEntity(s);
      if (!p.dimension.isChunkLoaded(loc)) return;
      s.entity = p.dimension.spawnEntity(GHOST, loc);
      s.entity.nameTag = `§bPB ghost`;
      s.entity.addTag("academy_ghost");
    }
    s.entity.teleport(loc, { rotation: { x: 0, y: pos.yaw } });
  } catch {
    removeEntity(s);
  }
}

// record + move every tick
system.runInterval(() => {
  for (const s of active.values()) {
    const { run } = s;
    const p = run.player;
    if (!p.isValid || !run.startMs) continue;
    const t = Date.now() - run.startMs;
    if (t < 0) continue;
    try {
      if (t - s.lastRec >= RECORD_EVERY_MS) {
        s.lastRec = t;
        pushSample(s.rec, t, p.location, p.getRotation().y, p.dimension.id);
      }
      if (s.ghost) {
        s.pos = positionAt(s.ghost.rec, t, s.idx);
        if (s.pos) {
          s.idx = s.pos.idx;
          placeEntity(s, s.pos);
        }
      }
    } catch (e) {
      console.warn(`[Speedrun Academy] ghost: ${e}`);
    }
  }
}, 1);

// clean up ghosts left behind by a crash / world reload
world.afterEvents.entityLoad.subscribe(({ entity }) => {
  if (entity.typeId === GHOST && ![...active.values()].some((s) => s.entity?.id === entity.id)) {
    try {
      entity.remove();
    } catch {}
  }
});
world.afterEvents.worldLoad.subscribe(() => {
  for (const d of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
    try {
      for (const e of world.getDimension(d).getEntities({ type: GHOST })) e.remove();
    } catch {}
  }
});
