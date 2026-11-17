import { world, system, Player } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { LESSONS, getLesson } from "./lessons.js";
import { fmt, cmd, showForm, isBook, giveBook, resetPlayer, sleep } from "./util.js";
import { runs, runMenu, runStartMenu, stopRun, onDimensionChange, onDragonDeath } from "./run.js";

/** player.id -> { lesson, state, startMs (0 until GO), player } */
const sessions = new Map();

// ---------------- menus ----------------

async function openMenu(player) {
  const s = sessions.get(player.id);
  if (s) return sessionMenu(player, s);
  if (runs.has(player.id)) return runMenu(player);

  const form = new ActionFormData()
    .title("Speedrun Academy")
    .body("§7Do a §fGuided Run§7 with a live checklist, or drill one piece of the route in a lesson.");
  form.button("§6Guided Run + Checklist", "textures/items/map_filled");
  for (const l of LESSONS) {
    const pb = getPB(player, l.id);
    form.button(l.read ? l.name : `${l.name}${pb ? `\n§2PB ${fmt(pb)}` : "\n§8no PB yet"}`, l.icon);
  }
  form.button("Personal Bests", "textures/items/clock_item");

  const res = await showForm(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  if (res.selection === 0) return runStartMenu(player, () => openMenu(player));
  if (res.selection === LESSONS.length + 1) return showPBs(player);
  return lessonIntro(player, LESSONS[res.selection - 1]);
}

async function lessonIntro(player, lesson, page = 0) {
  const last = page === lesson.pages.length - 1;
  const form = new MessageFormData()
    .title(`${lesson.name}  (${page + 1}/${lesson.pages.length})`)
    .body(lesson.pages[page])
    .button1(last ? (lesson.read ? "Back to menu" : "§aStart!") : "Next")
    .button2(page === 0 ? "Back" : "Previous");

  const res = await showForm(player, form);
  if (!res || res.canceled) return;
  if (res.selection === 1) return page === 0 ? openMenu(player) : lessonIntro(player, lesson, page - 1);
  if (!last) return lessonIntro(player, lesson, page + 1);
  if (lesson.read) return openMenu(player);
  return startLesson(player, lesson);
}

async function sessionMenu(player, s) {
  const elapsed = s.startMs ? fmt(Date.now() - s.startMs) : "starting...";
  const extra = s.lesson.actions ?? [];
  const form = new ActionFormData()
    .title(s.lesson.name)
    .body(`§fGoal:§7 ${s.lesson.goal}\n§fTime:§7 ${elapsed}`);
  for (const a of extra) form.button(a.label);
  form.button("Re-read tips");
  form.button("§eRestart lesson");
  form.button("§cQuit lesson");

  const res = await showForm(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  const i = res.selection;
  if (i < extra.length) return extra[i].run(player, s.state);
  const rest = i - extra.length;
  if (rest === 0) return showTips(player, s.lesson);
  if (rest === 1) {
    sessions.delete(player.id);
    return startLesson(player, s.lesson);
  }
  sessions.delete(player.id);
  player.onScreenDisplay.setActionBar("§7Lesson quit.");
}

async function showTips(player, lesson, page = 0) {
  const form = new MessageFormData()
    .title(`${lesson.name}  (${page + 1}/${lesson.pages.length})`)
    .body(lesson.pages[page])
    .button1(page < lesson.pages.length - 1 ? "Next" : "Close")
    .button2("Close");
  const res = await showForm(player, form);
  if (res && !res.canceled && res.selection === 0 && page < lesson.pages.length - 1) return showTips(player, lesson, page + 1);
}

async function showPBs(player) {
  const lines = LESSONS.filter((l) => !l.read).map((l) => {
    const pb = getPB(player, l.id);
    const tries = player.getDynamicProperty(`tries:${l.id}`) ?? 0;
    return `§f${l.name}\n  §7PB: ${pb ? `§a${fmt(pb)}` : "§8-"}§7   attempts: ${tries}`;
  });
  const runPB = /** @type {number|undefined} */ (player.getDynamicProperty("run:pb"));
  lines.unshift(`§6Guided Run (full)\n  §7PB: ${runPB ? `§a${fmt(runPB)}` : "§8-"}`);
  const form = new MessageFormData()
    .title("Personal Bests")
    .body(lines.join("\n\n"))
    .button1("Back")
    .button2("Close");
  const res = await showForm(player, form);
  if (res && res.selection === 0) return openMenu(player);
}

// ---------------- lesson lifecycle ----------------

async function startLesson(player, lesson) {
  if (lesson.dimension && player.dimension.id !== lesson.dimension) {
    const where = lesson.dimension.replace("minecraft:", "").replace("_", " ");
    player.sendMessage(`§cStart "${lesson.name}" from the ${where}.`);
    return;
  }

  stopRun(player, true);
  const s = { lesson, state: {}, startMs: 0, player };
  sessions.set(player.id, s);
  const tries = /** @type {number} */ (player.getDynamicProperty(`tries:${lesson.id}`) ?? 0);
  player.setDynamicProperty(`tries:${lesson.id}`, tries + 1);

  resetPlayer(player);
  await lesson.setup(player, s.state);
  if (sessions.get(player.id) !== s) return; // quit/restarted during setup

  // 3-2-1 with the player frozen in place
  cmd(player, "effect @s slowness 3 255 true");
  for (const n of ["§c3", "§e2", "§a1"]) {
    player.onScreenDisplay.setTitle(n, { fadeInDuration: 0, stayDuration: 18, fadeOutDuration: 2 });
    cmd(player, "playsound note.hat @s");
    await sleep(20);
    if (sessions.get(player.id) !== s) return;
  }
  cmd(player, "effect @s clear");
  player.onScreenDisplay.setTitle("§aGO!", { fadeInDuration: 0, stayDuration: 15, fadeOutDuration: 5 });
  cmd(player, "playsound note.pling @s");
  s.startMs = Date.now();
}

function finish(s) {
  const { player, lesson } = s;
  sessions.delete(player.id);
  const time = Date.now() - s.startMs;
  const pb = getPB(player, lesson.id);
  const isPB = !pb || time < pb;
  if (isPB) player.setDynamicProperty(`pb:${lesson.id}`, time);

  player.onScreenDisplay.setTitle(isPB ? "§6NEW PB!" : "§aDone!", {
    subtitle: `§f${fmt(time)}`,
    fadeInDuration: 0,
    stayDuration: 60,
    fadeOutDuration: 20,
  });
  const diff = pb ? `  §7(${time < pb ? "§a-" : "§c+"}${fmt(Math.abs(time - pb))}§7 vs PB)` : "";
  player.sendMessage(`§a${lesson.name} complete in §f${fmt(time)}${diff}`);
  cmd(player, `playsound ${isPB ? "random.levelup" : "random.orb"} @s`);
}

function fail(s, why) {
  sessions.delete(s.player.id);
  s.player.sendMessage(`§c${s.lesson.name} failed: ${why}. §7Open the book to try again.`);
}

function getPB(player, id) {
  return /** @type {number|undefined} */ (player.getDynamicProperty(`pb:${id}`));
}

// ---------------- loop & events ----------------

let tickCount = 0;
system.runInterval(() => {
  tickCount++;
  for (const s of sessions.values()) {
    const { player, lesson, state } = s;
    if (!player.isValid) {
      sessions.delete(player.id);
      continue;
    }
    if (!s.startMs) continue;
    const prog = lesson.progress ? `  §7${lesson.progress(player, state)}` : "";
    player.onScreenDisplay.setActionBar(`§e${fmt(Date.now() - s.startMs)}${prog}\n§7${lesson.goal}`);

    if (tickCount % 5 === 0) {
      try {
        lesson.tick?.(player, state);
        if (lesson.check?.(player, state)) finish(s);
      } catch (e) {
        console.warn(`[Speedrun Academy] ${lesson.id}: ${e}`);
      }
    }
  }
}, 2);

// Open the menu by using the book…
world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
  if (source instanceof Player && isBook(itemStack)) openMenu(source);
});

// …or with /scriptevent academy:menu
system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
  if (id === "academy:menu" && sourceEntity instanceof Player) openMenu(sourceEntity);
});

world.afterEvents.playerSpawn.subscribe(({ player }) => giveBook(player));

world.afterEvents.playerDimensionChange.subscribe(({ player, toDimension }) => {
  const s = sessions.get(player.id);
  if (s?.startMs && s.lesson.onDimension?.(player, s.state, toDimension.id)) finish(s);
  onDimensionChange(player, toDimension.id);
});

world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  if (deadEntity.typeId === "minecraft:ender_dragon") {
    for (const s of [...sessions.values()]) if (s.startMs && s.lesson.onDragonDeath) finish(s);
    onDragonDeath();
    return;
  }
  if (deadEntity instanceof Player) {
    const s = sessions.get(deadEntity.id);
    if (s) fail(s, "you died");
  }
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  sessions.delete(playerId);
  runs.delete(playerId);
});
