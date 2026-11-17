import { world, system, DisplaySlotId, ObjectiveSortOrder } from "@minecraft/server";
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";
import { runs, startRun, stopRun, runHooks } from "./run.js";
import { PHASES } from "./checklist.js";
import { getSetting, START_TYPES, startName } from "./settings.js";
import { makeCode, parseCode, seedHash } from "./racecode.js";
import { fmt, showForm, sleep } from "./util.js";

// =====================================================================
// Mode 1: same world. Everyone in this world races from the same spawn.
// =====================================================================

/** @type {{ hostId: string, ids: string[], status: "lobby"|"running"|"done", id: string, winner?: string, finished: {id:string,name:string,time:number}[] } | undefined} */
let race;
const OBJ = "academy_race";

const byId = (id) => world.getAllPlayers().find((p) => p.id === id);
const broadcast = (msg) => world.sendMessage(msg);

function phaseIndex(run) {
  return PHASES.findIndex((p) => p.id === run.phaseId);
}

function renderStandings() {
  if (!race) return;
  const sb = world.scoreboard;
  let obj = sb.getObjective(OBJ) ?? sb.addObjective(OBJ, "§6Race");
  if (sb.getObjectiveAtDisplaySlot(DisplaySlotId.Sidebar)?.objective?.id !== OBJ) {
    sb.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, { objective: obj, sortOrder: ObjectiveSortOrder.Ascending });
  }
  const rows = race.ids.map((id) => {
    const done = race.finished.find((f) => f.id === id);
    const p = byId(id);
    const name = p?.name ?? done?.name ?? "?";
    if (done) return { key: [99, -done.time], line: `§a${name} §fDONE ${fmt(done.time)}` };
    const run = runs.get(id);
    if (!run) return { key: [-1, 0], line: `§8${name} (out)` };
    const ph = PHASES[phaseIndex(run)];
    const last = run.splits.at(-1);
    return { key: [phaseIndex(run), -(last?.at ?? 0)], line: `§f${name} §e${ph.name}${last ? ` §7${fmt(last.at).replace(/\.\d+$/, "")}` : ""}` };
  });
  rows.sort((a, b) => b.key[0] - a.key[0] || b.key[1] - a.key[1]);
  const want = new Map(rows.map((r, i) => [`${i + 1}. ${r.line}`, i + 1]));
  for (const part of obj.getParticipants()) if (!want.has(part.displayName)) obj.removeParticipant(part);
  for (const [l, i] of want) if (obj.getScore(l) !== i) obj.setScore(l, i);
}

function clearStandings() {
  try {
    world.scoreboard.removeObjective(OBJ);
  } catch {}
}

runHooks.onSplit = (run) => {
  if (!race || run.race !== race.id) return;
  const ph = PHASES.find((p) => p.id === run.phaseId);
  broadcast(`§6[Race]§f ${run.player.name}§7 reached §e${ph?.name}§7 at §f${fmt(Date.now() - run.startMs)}`);
  renderStandings();
};

runHooks.onFinish = (run, total) => {
  if (!race || run.race !== race.id) return;
  race.finished.push({ id: run.player.id, name: run.player.name, time: total });
  if (!race.winner) {
    race.winner = run.player.id;
    for (const p of world.getAllPlayers()) {
      p.onScreenDisplay.setTitle(`§6${run.player.name} wins!`, { subtitle: `§f${fmt(total)}`, fadeInDuration: 0, stayDuration: 80, fadeOutDuration: 20 });
    }
  }
  broadcast(`§6[Race]§a ${run.player.name} killed the dragon in §f${fmt(total)}§a!`);
  endRace("dragon killed");
};

function endRace(why) {
  if (!race) return;
  race.status = "done";
  renderStandings();
  for (const id of race.ids) {
    const p = byId(id);
    if (p && runs.get(id)?.race === race.id) stopRun(p, true);
  }
  broadcast(`§6[Race] Race over (${why}).§7 Final standings are on the sidebar for 30s.`);
  const ended = race;
  system.runTimeout(() => {
    if (race === ended) {
      clearStandings();
      race = undefined;
    }
  }, 600);
}

// keep standings fresh + notice racers who quit / left
system.runInterval(() => {
  if (race?.status !== "running") return;
  const alive = race.ids.filter((id) => runs.get(id)?.race === race.id);
  if (alive.length === 0) endRace("no racers left");
  else renderStandings();
}, 100);

async function startWorldRace(host) {
  if (!race || race.status !== "lobby") return;
  world.gameRules.pvp = !!getSetting("pvp");
  race.status = "running";
  race.id = `r${Date.now()}`;
  const secs = Math.max(3, Math.round(Number(getSetting("countdown")) || 5));
  const goAt = Date.now() + (secs + 1) * 1000;
  broadcast(`§6[Race]§f ${host.name}§7 started the race with §f${race.ids.length}§7 player(s). PvP is §f${getSetting("pvp") ? "ON" : "off"}§7.`);
  for (const id of race.ids) {
    const p = byId(id);
    if (p) startRun(p, true, undefined, { race: race.id, startAt: goAt });
  }
  await sleep(10);
  renderStandings();
}

export async function worldRaceMenu(player, back) {
  const form = new ActionFormData().title("Race: same world");
  const buttons = [];
  const add = (label, fn) => {
    form.button(label);
    buttons.push(fn);
  };

  if (!race || race.status === "done") {
    form.body("§7Everyone in this world races from the same spawn with the same countdown. Standings show on the sidebar.\n\n§7First to kill the dragon wins. The dragon is shared, so it's a scramble at the end!");
    add("§aOpen a race lobby", () => {
      race = { hostId: player.id, ids: [player.id], status: "lobby", id: "", finished: [] };
      broadcast(`§6[Race]§f ${player.name}§7 opened a race lobby. Open your Academy book -> Race to join!`);
    });
  } else if (race.status === "lobby") {
    const names = race.ids.map((id) => byId(id)?.name ?? "?").join(", ");
    form.body(`§fIn the lobby:§7 ${names}\n§fStart:§7 ${startName(world.getDynamicProperty("start:type") ?? "random")}\n§fPvP:§7 ${getSetting("pvp") ? "on" : "off"}`);
    if (race.ids.includes(player.id)) add("Leave lobby", () => (race.ids = race.ids.filter((i) => i !== player.id)));
    else add("§aJoin race", () => {
      race.ids.push(player.id);
      broadcast(`§6[Race]§f ${player.name}§7 joined (${race.ids.length} racers).`);
    });
    if (race.hostId === player.id) {
      add("§6Start race!", () => startWorldRace(player));
      add("§cCancel lobby", () => {
        race = undefined;
        broadcast("§6[Race]§7 Lobby cancelled.");
      });
    }
  } else {
    form.body("§7A race is running. Standings are on the sidebar.");
    if (runs.get(player.id)?.race === race.id) add("§cForfeit", () => stopRun(player));
  }
  add("Back", back);
  const res = await showForm(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  return buttons[res.selection]();
}

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  if (race?.status === "lobby") race.ids = race.ids.filter((i) => i !== playerId);
});

// =====================================================================
// Mode 2: same seed, separate worlds. Synced by wall-clock time.
// Each racer makes their own world with the same seed + start type,
// then enters the host's race code. Everyone's GO happens at the same instant.
// =====================================================================

export async function seedRaceMenu(player, back) {
  const startType = String(world.getDynamicProperty("start:type") ?? getSetting("start"));
  const res = await showForm(
    player,
    new ActionFormData()
      .title("Race: same seed")
      .body(
        "§7Everyone makes their own world with the §fsame seed and settings§7. The host makes a race code, everyone enters it, and all timers start at the same moment.\n\n" +
          `§fThis world's seed:§7 ${world.seed}\n§fStart type:§7 ${startName(startType)}\n\n` +
          "§8Starts are synced to your device clocks, so make sure they're set automatically. There's no live sync between worlds, so compare times at the end."
      )
      .button("§aHost: make a race code")
      .button("Join with a code")
      .button("Back")
  );
  if (!res || res.canceled || res.selection === undefined) return;
  if (res.selection === 2) return back();
  if (res.selection === 0) return hostSeedRace(player, startType);
  return joinSeedRace(player, startType);
}

async function hostSeedRace(player, startType) {
  const delays = [1, 2, 3, 5, 10];
  const res = await showForm(
    player,
    new ModalFormData().title("Make a race code").dropdown("Race starts in (minutes)", delays.map(String), { defaultValueIndex: 2 }).submitButton("Make code")
  );
  if (!res || res.canceled || !res.formValues) return;
  const mins = delays[Number(res.formValues[0])];
  // round to a whole second so the code is exact
  const startAt = Math.ceil((Date.now() + mins * 60000) / 1000) * 1000;
  const idx = Math.max(0, START_TYPES.findIndex((s) => s.id === startType));
  const code = makeCode(startAt, world.seed, idx);
  player.sendMessage(
    `§6Race code: §f§l${code}§r\n§7Share it with: seed §f${world.seed}§7, start type §f${startName(startType)}§7.\n§7Race starts in ${mins} min. You're automatically in.`
  );
  await showForm(
    player,
    new MessageFormData()
      .title("Race code")
      .body(`§l§f${code}§r\n\n§7Seed: §f${world.seed}\n§7Start: §f${startName(startType)}\n§7Starts in: §f${mins} min\n\n§7It's in your chat too. Everyone creates their world, adds this pack with the same start type, and enters the code.`)
      .button1("OK")
      .button2("Close")
  );
  return startRun(player, true, undefined, { startAt, race: "seed" });
}

async function joinSeedRace(player, startType) {
  const res = await showForm(player, new ModalFormData().title("Join race").textField("Race code", "e.g. T4X2KQ-9ZQ1-1").submitButton("Join"));
  if (!res || res.canceled || !res.formValues) return;
  const parsed = parseCode(String(res.formValues[0]));
  if (!parsed) return player.sendMessage("§cThat doesn't look like a race code (format: XXXXXX-XXXX-N).");
  if (parsed.hash !== seedHash(world.seed)) return player.sendMessage("§cWrong seed! This world's seed doesn't match the race. Create a new world with the host's seed.");
  const wantType = START_TYPES[parsed.startIndex]?.id;
  if (wantType && wantType !== startType)
    player.sendMessage(`§eHeads up: the host is using a §f${startName(wantType)}§e start, but this world is set to §f${startName(startType)}§e. Spawns may not match.`);
  const wait = parsed.startAtMs - Date.now();
  if (wait < 0) return player.sendMessage(`§cThat race already started ${fmt(-wait).replace(/\.\d+$/, "")} ago.`);
  player.sendMessage(`§aJoined!§7 Race starts in §f${fmt(wait).replace(/\.\d+$/, "")}§7. You'll be frozen at spawn until GO.`);
  return startRun(player, true, undefined, { startAt: parsed.startAtMs, race: "seed" });
}
