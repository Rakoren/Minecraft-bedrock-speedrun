import { system, ItemStack, ItemLockMode, EntityComponentTypes } from "@minecraft/server";
import { FormCancelationReason } from "@minecraft/server-ui";

export const BOOK_NAME = "§6Speedrun Academy";

export const sleep = (ticks) => system.waitTicks(ticks);

/** mm:ss.mmm */
export function fmt(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor(ms / 1000) % 60;
  const x = Math.floor(ms % 1000);
  return `${m}:${String(s).padStart(2, "0")}.${String(x).padStart(3, "0")}`;
}

/** Run a command as the player, swallowing errors (e.g. unloaded chunks). Returns true on success. */
export function cmd(player, command) {
  try {
    player.runCommand(command);
    return true;
  } catch {
    return false;
  }
}

/** Show a form, retrying while the player has chat/another screen open. */
export async function showForm(player, form) {
  for (let i = 0; i < 40; i++) {
    const res = await form.show(player);
    if (res.cancelationReason !== FormCancelationReason.UserBusy) return res;
    await sleep(5);
  }
  return undefined;
}

export function container(player) {
  return player.getComponent(EntityComponentTypes.Inventory)?.container;
}

export function countItem(player, typeId) {
  const inv = container(player);
  if (!inv) return 0;
  let n = 0;
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (it?.typeId === typeId) n += it.amount;
  }
  return n;
}

/** Give `count` of an item, split into legal stack sizes. */
export function give(player, typeId, count = 1) {
  const inv = container(player);
  if (!inv) return;
  const max = new ItemStack(typeId, 1).maxAmount;
  while (count > 0) {
    const n = Math.min(max, count);
    inv.addItem(new ItemStack(typeId, n));
    count -= n;
  }
}

export function makeBook() {
  const book = new ItemStack("minecraft:book", 1);
  book.nameTag = BOOK_NAME;
  book.setLore(["§7Use (right-click / hold) to open", "§7lessons, timer & personal bests."]);
  book.lockMode = ItemLockMode.inventory;
  book.keepOnDeath = true;
  return book;
}

export function isBook(item) {
  return item?.typeId === "minecraft:book" && item.nameTag === BOOK_NAME;
}

export function hasBook(player) {
  const inv = container(player);
  if (!inv) return false;
  for (let i = 0; i < inv.size; i++) if (isBook(inv.getItem(i))) return true;
  return false;
}

export function giveBook(player) {
  const inv = container(player);
  if (!inv || hasBook(player)) return;
  // Prefer the last hotbar slot so it stays out of the way.
  if (!inv.getItem(8)) inv.setItem(8, makeBook());
  else inv.addItem(makeBook());
}

/** Clean slate: survival, empty inventory, full health & hunger, no effects. */
export function resetPlayer(player) {
  cmd(player, "gamemode survival @s");
  cmd(player, "clear @s");
  cmd(player, "effect @s clear");
  cmd(player, "effect @s instant_health 1 10 true");
  cmd(player, "effect @s saturation 1 20 true");
  cmd(player, "xp -10000L @s");
  player.extinguishFire?.();
  giveBook(player);
}
