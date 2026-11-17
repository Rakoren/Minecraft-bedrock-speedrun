import { world, system, DisplaySlotId, ObjectiveSortOrder, BlockVolume } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { PHASES, getPhase, evaluate, nextItem, inventoryReport, arrangeHotbar } from "./checklist.js";
import { SCOUT_TARGETS, scan, direction } from "./scout.js";
import { markThrow } from "./tri.js";
import { getSetting } from "./settings.js";
import { goToStart } from "./startfinder.js";
import { beginGhost, endGhost, finishGhost, ghostSplitDelta, ghostStatus, hasGhost, deleteGhost } from "./ghost.js";
import { fmt, cmd, showForm, resetPlayer, sleep, countItem, container } from "./util.js";

/** player.id -> run */
export const runs = new Map();
let sidebarOwner; // only one checklist fits on the shared sidebar

// ---------------- pathing guides (one set per phase) ----------------

const GUIDES = {
  overworld: [
    "§lYour first 10 seconds§r\n\n§7Before you touch a tree, §fspin 360°§7. Climb a tree or hill if you're in a hole. You're looking for, roughly best to worst:\n\n §f1. Ruined portal§7 - obsidian, loot chest (flint & steel, gold, sometimes iron), often lava right there\n §f2. Village§7 - beds, bread, blacksmith iron, hay\n §f3. Shipwreck§7 (ocean/beach) - chests with iron & food\n §f4. Surface lava pool§7\n §f5. Trees§7 - you need them anyway\n\n§7Pick a direction §fon purpose§7 and grab wood on the way there.",
    "§lFinding a lava pool§r\n\n§eOn the surface:§r\n §7- Orange glow, very visible at night\n §7- Smoke/drip particles and burnt or burning grass/trees\n §7- Common in §fdeserts, savannas and badlands§7, rare in snowy/jungle areas\n §7- Ruined portals often have lava patches beside them\n\n§eUnderground:§r\n §7- Ravines (big cracks in the ground) often have lava at the bottom\n §7- Deep caves near the bottom of the world have lava lakes\n §7- Listen for the lava 'pop' sound\n\n§cDon't wander for minutes.§7 If nothing shows up, keep moving and gather iron/food/flint so the time isn't wasted.",
    "§lA typical Overworld route§r\n\n §f1.§7 4-5 logs -> table -> wooden pickaxe\n §f2.§7 3+ cobble -> stone pickaxe (+ stone axe)\n §f3.§7 Head toward the best thing you spotted\n §f4.§7 3 iron -> bucket, fill it with water\n §f5.§7 Flint (gravel or chest) -> flint & steel\n §f6.§7 Grab food as you pass animals\n §f7.§7 Find lava -> make 10 obsidian -> portal\n\n§7The sidebar on the right tracks all of this live. §fGreen = done, red = still need it, gray = optional.",
    "§lInventory habits§r\n\n §7- Keep tools in the §fsame hotbar slots every run§7 so your hands learn them\n §7- Only pick up what's on your checklist\n §7- Carry §f1-2 kinds§7 of blocks, not 6 half-stacks\n §7- Toss junk while you walk (seeds, flowers, diorite...)\n §7- Book -> §fInventory check§7 shows your hotbar vs. the recommended layout and flags clutter",
  ],
  nether: [
    "§lFirst thing in the Nether§r\n\n §f1.§7 Write down your portal's coordinates. You'll come back to it.\n §f2.§7 Spin 360° and read the land:\n   §8-§7 Dark blackstone castle = §fBastion§7\n   §8-§7 Red-brown brick bridges = §fFortress§7\n   §8-§7 Soul sand valleys are open and easy to see far in\n   §8-§7 Basalt deltas are slow and dangerous, avoid them\n §f3.§7 Put on gold armor before you go near piglins.",
    "§lBastion: pearls§r\n\n §7- Mine gold blocks (iron pickaxe) and loot chests\n §7- Barter: throw gold near several piglins at once\n §7- Aim for ~12 pearls\n §7- Useful trades too: obsidian, string (beds!), fire resistance\n §7- Never hit a piglin. They all gang up on you.\n §7- Watch for piglin brutes. They ignore gold armor.",
    "§lFortress: blaze rods§r\n\n §7- Look for raised platforms with fences around them, that's where blaze spawners are\n §7- Block yourself in next to the spawner, leave a gap, let blazes come to you\n §7- 6-7 rods total. Don't over-farm.\n §7- Wither skeletons are dangerous (wither effect), so avoid them\n\n§7Bastion or fortress first? Whichever is closer, but you need gold armor before the bastion.",
    "§lLeaving the Nether§r\n\n §7- Craft your eyes (pearl + blaze powder)\n §7- Go back to your portal and throw eyes in the Overworld\n §7- Triangulate (2 throws far apart)\n §7- Pro move: travel in the Nether using stronghold coords ÷ 8, then build a portal there. That needs 10 obsidian (from bartering). Crying obsidian doesn't work.",
  ],
  stronghold: [
    "§lTriangulation§r\n\n §f1.§7 Throw an eye. While it hovers, look §fdead center§7 at it.\n §f2.§7 Book -> §fMark eye throw§7.\n §f3.§7 Move ~200 blocks §fsideways§7 to the eye's direction.\n §f4.§7 Throw + mark again. The book gives you X/Z.\n\n§7In real runs you'd use an outside calculator or do it by eye. The sidebar ticks off once you have an estimate.",
    "§lDigging in§r\n\n §7- When you're close, throw one more eye. If it goes §fdown§7, you're right above it.\n §7- Dig a 1x2 staircase down, never straight down\n §7- Look for stone bricks, iron bars, mossy stone\n §7- The portal room has a lava pool under the frame and a silverfish spawner\n §7- Count empty frames §fbefore§7 you use your eyes",
  ],
  end: [
    "§lDragon basics§r\n\n §7- Don't look at endermen. Wear a carved pumpkin if you're scared of it.\n §7- The dragon circles the pillars, then sometimes §fperches§7 on the fountain in the middle\n §7- Perch = bed time\n §7- Crystals heal the dragon. Shoot the easy ones with a bow if you have one.",
    "§lBed bombing§r\n\n §f1.§7 Wait for a perch\n §f2.§7 Stand near the dragon's head, below or beside it\n §f3.§7 Place the bed against the dragon, put a block between you and it\n §f4.§7 Use the bed -> boom. Place the next one immediately.\n\n§7Beds can only be placed on solid blocks, so place one on the fountain or a block you put down.",
  ],
};

// ---------------- sidebar ----------------

const OBJ = "academy_checklist";

function sidebarObjective() {
  const sb = world.scoreboard;
  let obj = sb.getObjective(OBJ);
  if (!obj) obj = sb.addObjective(OBJ, "§6Speedrun Checklist");
  if (sb.getObjectiveAtDisplaySlot(DisplaySlotId.Sidebar)?.objective?.id !== OBJ) {
    sb.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, { objective: obj, sortOrder: ObjectiveSortOrder.Ascending });
  }
  return obj;
}

function renderSidebar(lines) {
  const obj = sidebarObjective();
  // make every line unique (fake player names must differ)
  const seen = new Set();
  const uniq = lines.map((l) => {
    while (seen.has(l)) l += "§r";
    seen.add(l);
    return l;
  });
  const want = new Map(uniq.map((l, i) => [l, i + 1]));
  for (const part of obj.getParticipants()) if (!want.has(part.displayName)) obj.removeParticipant(part);
  for (const [l, i] of want) if (obj.getScore(l) !== i) obj.setScore(l, i);
}

function clearSidebar() {
  try {
    world.scoreboard.removeObjective(OBJ);
  } catch {}
}

// ---------------- lifecycle ----------------

/** Race modules hook in here to track standings. */
export const runHooks = { onSplit: undefined, onFinish: undefined };

/**
 * opts.race     - race id; the sidebar is left to the race standings
 * opts.startAt  - wall-clock ms when GO should happen (keeps racers in sync)
 */
export async function startRun(player, timed, onStop, opts = {}) {
  stopRun(player, true);
  const run = {
    player,
    timed,
    startMs: 0,
    phaseId: phaseForDimension(player.dimension.id),
    splits: [],
    foundLava: false,
    tri: {},
    target: undefined,
    assisted: false,
    done: new Set(),
    onStop,
    race: opts.race,
  };
  runs.set(player.id, run);
  if (!run.race || run.race === "seed") sidebarOwner = player.id;
  world.gameRules.showCoordinates = true;

  if (timed) {
    resetPlayer(player);
    goToStart(player);
    run.phaseId = "overworld";
    const secs = Math.max(3, Math.round(Number(getSetting("countdown")) || 5));
    const goAt = opts.startAt ?? Date.now() + secs * 1000;
    // wait (frozen) until the countdown window, then count down to goAt
    while (goAt - Date.now() > secs * 1000) {
      cmd(player, "effect @s slowness 2 255 true");
      player.onScreenDisplay.setActionBar(`§eRace starts in ${fmt(goAt - Date.now()).replace(/\.\d+$/, "")}`);
      await sleep(10);
      if (runs.get(player.id) !== run) return;
    }
    let shown = -1;
    while (Date.now() < goAt) {
      const left = Math.ceil((goAt - Date.now()) / 1000);
      if (left !== shown) {
        shown = left;
        cmd(player, "effect @s slowness 2 255 true");
        player.onScreenDisplay.setTitle(`${left <= 1 ? "§a" : left <= 3 ? "§e" : "§c"}${left}`, { fadeInDuration: 0, stayDuration: 18, fadeOutDuration: 2 });
        cmd(player, "playsound note.hat @s");
      }
      await sleep(1);
      if (runs.get(player.id) !== run) return;
    }
    run.startMs = goAt;
    cmd(player, "effect @s clear");
    player.onScreenDisplay.setTitle("§aGO!", { fadeInDuration: 0, stayDuration: 15, fadeOutDuration: 5 });
    cmd(player, "playsound note.pling @s");
  }
  run.startMs ||= Date.now();
  if (timed) beginGhost(run);
  // pre-mark already-finished items so we don't spam "done!" for stuff you had
  for (const r of evaluate(player, run, getPhase(run.phaseId))) if (r.done) run.done.add(`${run.phaseId}:${r.item.id}`);
  player.sendMessage(
    run.race
      ? "§6GO!§7 Race standings are on the right. Your next item is on the action bar, and the full checklist is in the book."
      : "§6Guided run started.§7 Checklist is on the right. Open the book for hints, pathing guides, Scout and inventory check."
  );
}

export function stopRun(player, silent = false) {
  const run = runs.get(player.id);
  if (!run) return;
  runs.delete(player.id);
  endGhost(run);
  if (sidebarOwner === player.id) {
    clearSidebar();
    sidebarOwner = undefined;
  }
  if (!silent) player.sendMessage("§7Guided run ended.");
}

function phaseForDimension(dim) {
  if (dim === "minecraft:nether") return "nether";
  if (dim === "minecraft:the_end") return "end";
  return "overworld";
}

function setPhase(run, phaseId) {
  if (run.phaseId === phaseId) return;
  const t = Date.now() - run.startMs;
  const from = getPhase(run.phaseId);
  run.splits.push({ id: from.id, name: from.name, at: t });
  run.phaseId = phaseId;
  runHooks.onSplit?.(run);
  const to = getPhase(phaseId);
  for (const r of evaluate(run.player, run, to)) if (r.done) run.done.add(`${to.id}:${r.item.id}`);
  run.player.onScreenDisplay.setTitle(`§e${to.name}`, {
    subtitle: run.timed ? `§7split ${fmt(t)}` : "§7new checklist",
    fadeInDuration: 0,
    stayDuration: 40,
    fadeOutDuration: 10,
  });
  run.player.sendMessage(`§e${from.name} done${run.timed ? ` at §f${fmt(t)}${ghostSplitDelta(run, from.id, t)}` : ""}§e. Next up: §f${to.name}§7 (book -> Phase guide for pathing tips)`);
}

export function onDimensionChange(player, toId) {
  const run = runs.get(player.id);
  if (!run || !run.startMs) return;
  if (toId === "minecraft:the_end") setPhase(run, "end");
  else if (toId === "minecraft:nether" && run.phaseId === "overworld") setPhase(run, "nether");
  else if (toId === "minecraft:overworld" && run.phaseId === "nether") setPhase(run, "stronghold");
  run.target = undefined;
}

/** killer: the player who landed the final hit (if any). In a same-world race only they finish. */
export function onDragonDeath(killer) {
  for (const run of [...runs.values()]) {
    if (!run.startMs || run.phaseId !== "end") continue;
    if (run.race && killer && run.player.id !== killer.id) continue;
    finishRun(run);
  }
}

function finishRun(run) {
  const { player } = run;
  const total = Date.now() - run.startMs;
  run.splits.push({ id: "end", name: "The End", at: total });
  runs.delete(player.id);
  runHooks.onFinish?.(run, total);
  if (sidebarOwner === player.id) clearSidebar();

  if (!run.timed) {
    player.sendMessage("§aDragon down! §7(Checklist mode, no time saved.)");
    return;
  }
  const pb = /** @type {number|undefined} */ (player.getDynamicProperty("run:pb"));
  const countsForPB = !run.assisted;
  const isPB = countsForPB && (!pb || total < pb);
  if (isPB) player.setDynamicProperty("run:pb", total);
  finishGhost(run, total, countsForPB);

  const lines = [`§6=== Run complete: §f${fmt(total)} ${isPB ? "§6NEW PB!" : ""}`];
  let prev = 0;
  for (const s of run.splits) {
    const seg = s.at - prev;
    prev = s.at;
    const key = `run:seg:${s.id}`;
    const best = /** @type {number|undefined} */ (player.getDynamicProperty(key));
    const tag = best ? (seg < best ? ` §a(-${fmt(best - seg)})` : ` §c(+${fmt(seg - best)})`) : "";
    if (countsForPB && (!best || seg < best)) player.setDynamicProperty(key, seg);
    lines.push(` §f${s.name}: §7${fmt(seg)}${tag}`);
  }
  if (!countsForPB) lines.push("§8Scout was used, so this run doesn't count toward PBs.");
  player.sendMessage(lines.join("\n"));
  player.onScreenDisplay.setTitle(isPB ? "§6NEW PB!" : "§aGG!", { subtitle: `§f${fmt(total)}`, fadeInDuration: 0, stayDuration: 80, fadeOutDuration: 20 });
  cmd(player, "playsound random.levelup @s");
}

// ---------------- per-tick ----------------

let ticks = 0;
system.runInterval(() => {
  ticks++;
  for (const run of runs.values()) {
    const p = run.player;
    if (!p.isValid) {
      runs.delete(p.id);
      continue;
    }
    if (!run.startMs) continue;
    try {
      const phase = getPhase(run.phaseId);
      const results = evaluate(p, run, phase);

      // lava proximity (counts as "found" once you've been within ~8 blocks)
      if (!run.foundLava && ticks % 10 === 0 && p.dimension.id === "minecraft:overworld") {
        const l = p.location;
        const vol = new BlockVolume({ x: l.x - 8, y: l.y - 6, z: l.z - 8 }, { x: l.x + 8, y: l.y + 4, z: l.z + 8 });
        if (p.dimension.containsBlock(vol, { includeTypes: ["minecraft:lava", "minecraft:flowing_lava"] }, true)) {
          run.foundLava = true;
        }
      }

      // newly completed items
      for (const r of results) {
        const key = `${phase.id}:${r.item.id}`;
        if (r.done && !run.done.has(key)) {
          run.done.add(key);
          p.sendMessage(`§a[x] ${r.item.label}`);
          cmd(p, "playsound random.orb @s ~ ~ ~ 0.6 1.4");
        }
      }

      if (sidebarOwner === p.id) {
        const lines = [`§e» ${phase.name} §8(${PHASES.indexOf(phase) + 1}/${PHASES.length})`];
        for (const r of results) {
          const n = r.item.need > 1 ? ` ${Math.min(r.have, 999)}/${r.item.need}` : "";
          if (r.done) lines.push(` §a[x] ${r.item.label}`);
          else if (r.item.opt) lines.push(` §8[ ] ${r.item.label}${n} (opt)`);
          else lines.push(` §c[ ] §f${r.item.label}§7${n}`);
        }
        lines.push(`§b» ${phase.exit}`);
        renderSidebar(lines);
      }

      // action bar: timer / next step / scout arrow / inventory warning
      const next = nextItem(results);
      const bar = [];
      bar.push(
        (run.timed ? `§e${fmt(Date.now() - run.startMs)}  ` : "§6Checklist  ") +
          (next ? `§7Next: §f${next.item.label}${next.item.need > 1 ? ` ${next.have}/${next.item.need}` : ""}` : `§a${phase.exit}!`)
      );
      if (run.target) {
        const t = run.target;
        if (t.dim !== p.dimension.id) run.target = undefined;
        else {
          const d = Math.round(Math.hypot(t.loc.x - p.location.x, t.loc.y - p.location.y, t.loc.z - p.location.z));
          if (d <= 4) {
            p.sendMessage(`§b${t.label} reached.§7 ${t.look}`);
            run.target = undefined;
          } else bar.push(`§bScout: ${t.label} ${d}m ${direction(p, t.loc)}`);
        }
      }
      const inv = container(p);
      const g = run.timed ? ghostStatus(run) : "";
      if (g) bar.push(g);
      if (inv && inv.emptySlotsCount <= 3) bar.push("§cInventory almost full! Book -> Inventory check");
      p.onScreenDisplay.setActionBar(bar.join("\n"));
    } catch (e) {
      console.warn(`[Speedrun Academy] run: ${e}`);
    }
  }
}, 4);

// ---------------- menus ----------------

export async function runMenu(player) {
  const run = runs.get(player.id);
  const phase = getPhase(run.phaseId);
  const results = evaluate(player, run, phase);
  const next = nextItem(results);
  const doneCount = results.filter((r) => r.done && !r.item.opt).length;
  const reqCount = results.filter((r) => !r.item.opt).length;

  const buttons = [];
  const form = new ActionFormData()
    .title(`Guided Run: ${phase.name}`)
    .body(
      `${run.timed ? `§fTime:§7 ${fmt(Date.now() - run.startMs)}\n` : ""}§fRequired:§7 ${doneCount}/${reqCount} done\n§fNext:§7 ${next ? next.item.label : phase.exit}`
    );
  const add = (label, fn, icon) => {
    form.button(label, icon);
    buttons.push(fn);
  };
  add("What do I do next?", () => showNext(player, run), "textures/items/compass_item");
  add("Phase guide (pathing)", () => showGuide(player, run.phaseId), "textures/items/map_filled");
  add("Full checklist + tips", () => showChecklist(player, run), "textures/items/book_writable");
  if (getSetting("scout") && !run.race && (SCOUT_TARGETS[player.dimension.id] ?? []).length) add("Scout nearby §8(training wheels)", () => scoutMenu(player, run), "textures/items/spyglass");
  if (run.phaseId === "stronghold" || countItem(player, "minecraft:ender_eye") > 0)
    add("Mark eye throw", () => markThrow(player, run.tri), "textures/items/ender_eye");
  add("Inventory check", () => inventoryMenu(player, run), "textures/blocks/chest_front");
  add("Change phase", () => phaseMenu(player, run), "textures/items/clock_item");
  add("§cEnd guided run", () => {
    stopRun(player);
    run.onStop?.();
  });

  const res = await showForm(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  return buttons[res.selection]();
}

async function showNext(player, run) {
  const phase = getPhase(run.phaseId);
  const next = nextItem(evaluate(player, run, phase));
  const body = next
    ? `§l${next.item.label}§r ${next.item.need > 1 ? `§7(${next.have}/${next.item.need})` : ""}${next.item.opt ? " §8(optional)" : ""}\n\n§7${next.item.hint}`
    : `§aEverything on the ${phase.name} list is done!§r\n\n§7Next step: §f${phase.exit}§7.`;
  const res = await showForm(player, new MessageFormData().title("Next step").body(body).button1("Back").button2("Close"));
  if (res && res.selection === 0) return runMenu(player);
}

async function showGuide(player, phaseId, page = 0) {
  const pages = GUIDES[phaseId] ?? [];
  if (!pages.length) return;
  const last = page === pages.length - 1;
  const res = await showForm(
    player,
    new MessageFormData()
      .title(`${getPhase(phaseId).name} guide (${page + 1}/${pages.length})`)
      .body(pages[page])
      .button1(last ? "Back" : "Next")
      .button2(page === 0 ? "Close" : "Previous")
  );
  if (!res || res.canceled) return;
  if (res.selection === 0) return last ? runMenu(player) : showGuide(player, phaseId, page + 1);
  if (page > 0) return showGuide(player, phaseId, page - 1);
}

async function showChecklist(player, run) {
  const phase = getPhase(run.phaseId);
  const results = evaluate(player, run, phase);
  const form = new ActionFormData().title(`${phase.name} checklist`).body("§7Tap an item for how to get it.");
  for (const r of results) {
    const n = r.item.need > 1 ? ` ${r.have}/${r.item.need}` : "";
    form.button(`${r.done ? "§2[x]" : r.item.opt ? "§8[ ]" : "§4[ ]"} ${r.item.label}${n}${r.item.opt ? " (opt)" : ""}`);
  }
  form.button("Back");
  const res = await showForm(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  if (res.selection === results.length) return runMenu(player);
  const r = results[res.selection];
  const back = await showForm(player, new MessageFormData().title(r.item.label).body(`§7${r.item.hint}`).button1("Back").button2("Close"));
  if (back && back.selection === 0) return showChecklist(player, run);
}

async function scoutMenu(player, run) {
  const targets = SCOUT_TARGETS[player.dimension.id] ?? [];
  const form = new ActionFormData()
    .title("Scout")
    .body("§7Points you at the nearest one within ~50 blocks and tells you what it looks like, so you learn to spot it yourself.\n§8Timed runs that use Scout don't count for PBs.");
  for (const t of targets) form.button(t.label);
  form.button("Back");
  const res = await showForm(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  if (res.selection === targets.length) return runMenu(player);
  const t = targets[res.selection];
  if (run.timed) run.assisted = true;

  player.onScreenDisplay.setActionBar(`§bScouting for ${t.label}...`);
  const nether = player.dimension.id === "minecraft:nether";
  const found = await scan(player, t.types, nether ? 64 : 48, nether ? 40 : 32, nether ? 40 : 24);
  if (!found) {
    player.sendMessage(`§cNo ${t.label.toLowerCase()} within range.§7 ${t.look}`);
    return;
  }
  run.target = { loc: found.nearest, label: t.label, look: t.look, dim: player.dimension.id };
  let extra = "";
  if (t.id === "lava") {
    extra =
      found.cluster >= 10
        ? ` §aThat pool is big (${found.cluster}+ blocks), good for the pool method.`
        : ` §eSmall patch (${found.cluster} blocks). Use bucket casting, or keep looking for a bigger pool.`;
  }
  player.sendMessage(`§bScout:§f ${t.label} ${found.dist} blocks ${direction(player, found.nearest)}.${extra}\n§7What to look for: ${t.look}`);
}

async function inventoryMenu(player, run) {
  const res = await showForm(
    player,
    new MessageFormData()
      .title("Inventory check")
      .body(inventoryReport(player, run.phaseId))
      .button1("Arrange my hotbar like this")
      .button2("Back")
  );
  if (!res || res.canceled) return;
  if (res.selection === 0) {
    arrangeHotbar(player, run.phaseId);
    player.sendMessage("§aHotbar arranged.§7 Try to set it up like this yourself next time, it becomes muscle memory.");
    return;
  }
  return runMenu(player);
}

async function phaseMenu(player, run) {
  const form = new ActionFormData().title("Change phase").body("§7Phases switch automatically when you change dimension. Use this if you want to look at a different checklist.");
  for (const ph of PHASES) form.button(`${ph.id === run.phaseId ? "§2> " : ""}${ph.name}`);
  const res = await showForm(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  const ph = PHASES[res.selection];
  run.phaseId = ph.id;
  for (const r of evaluate(player, run, ph)) if (r.done) run.done.add(`${ph.id}:${r.item.id}`);
  player.sendMessage(`§7Checklist switched to §f${ph.name}§7.`);
}

export async function runStartMenu(player, back) {
  const pb = /** @type {number|undefined} */ (player.getDynamicProperty("run:pb"));
  const res = await showForm(
    player,
    new ActionFormData()
      .title("Guided Run")
      .body(
        "§7A full Any% run with a §fchecklist on the right side of the screen§7 that updates from your inventory, plus hints, pathing guides, a Scout and an inventory coach in this book.\n\n" +
          `§fBest guided run:§7 ${pb ? fmt(pb) : "none yet"}\n` +
          `§fPB ghost:§7 ${hasGhost(player) ? `saved (${fmt(Number(player.getDynamicProperty("ghost:total")))})${getSetting("ghost") ? "" : " §8- hidden in World setup"}` : "none yet, finish a timed run to make one"}\n\n` +
          "§fTimed run:§7 clears your inventory, 3-2-1, splits per phase. Your PB ghost races you.\n" +
          "§fChecklist only:§7 keeps your stuff, no timer. Good for just learning while you play.\n\n" +
          "§8Tip: mined blocks and looted chests stay that way. For a truly fresh attempt, keep a backup copy of the world (World settings -> Copy World) and play the copy."
      )
      .button("§aTimed run (fresh start)", "textures/items/clock_item")
      .button("Checklist only", "textures/items/book_writable")
      .button(hasGhost(player) ? "§cDelete my PB ghost" : "§8(no ghost yet)")
      .button("Back")
  );
  if (!res || res.canceled || res.selection === undefined) return;
  if (res.selection === 3) return back();
  if (res.selection === 2) {
    if (hasGhost(player)) {
      deleteGhost(player);
      player.sendMessage("§7PB ghost deleted. Your next finished timed run becomes the new ghost.");
    }
    return runStartMenu(player, back);
  }
  return startRun(player, res.selection === 0);
}

