import { world } from "@minecraft/server";
import { cmd, give, countItem, sleep } from "./util.js";
import { markThrow } from "./tri.js";

const OVERWORLD = "minecraft:overworld";
const NETHER = "minecraft:nether";
const END = "minecraft:the_end";

/**
 * A lesson is either a "read" page set, or a timed challenge.
 *
 * Challenge fields:
 *   dimension   - where the player must be to start it (optional)
 *   pages       - teaching text shown before starting
 *   goal        - one-line goal shown on the action bar
 *   setup(p, s) - build the scenario & give the kit (s = per-run state object)
 *   progress(p, s) -> short string for the action bar
 *   check(p, s) -> true when the goal is met (polled ~2x/sec)
 *   tick(p, s)  - optional, called with check
 *   onDimension(p, s, toId) -> true to finish on a dimension change
 *   onDragonDeath - finish when an ender dragon dies
 *   actions     - extra menu buttons while the lesson is running
 */
export const LESSONS = [
  {
    id: "route",
    name: "The Route (read first)",
    icon: "textures/items/book_writable",
    read: true,
    pages: [
      "§lWhat is Any% (Random Seed)?§r\n\nBeat the Ender Dragon as fast as possible on a brand new random world. The timer starts when you gain control and stops when the credits roll.\n\n§eThe whole run in 6 splits:§r\n §f1.§7 Overworld - wood, stone tools, buckets/iron\n §f2.§7 Enter the Nether - build a portal fast\n §f3.§7 Bastion - barter gold for §fender pearls§7\n §f4.§7 Fortress - kill blazes for §fblaze rods§7\n §f5.§7 Stronghold - throw eyes, triangulate, find the portal\n §f6.§7 The End - kill the dragon (beds go boom)",
      "§lHow many do I need?§r\n\n §fEnder pearls:§7 aim for ~12. Some get used for travel.\n §fBlaze rods:§7 aim for 6-7. One rod = 2 powder = 2 eyes.\n §fEyes of Ender:§7 an end portal is usually missing ~10 eyes, and every throw has a 20% chance to break the eye.\n\n§lThe golden rule§r\n§7Speed comes from §fnot stopping§7. Plan your next move while you're still doing the current one. These lessons drill each section so it becomes muscle memory.",
      "§lStaying legit§r\n\n§7This add-on is for §cpractice worlds only§7. Leaderboards require vanilla Minecraft, so §cturn this pack off for real runs§7. Behavior packs also disable achievements in the world they're on.\n\n§7Always check the current rules on the Bedrock leaderboard before you submit a run.\n\n§lHow lessons work§r\n§7Pick one, read the tips, press Start. You get a kit, a 3-2-1, then a live timer. Beat the goal to save a personal best.",
    ],
  },

  {
    id: "wood",
    name: "1. Overworld Start",
    icon: "textures/items/wood_axe",
    dimension: OVERWORLD,
    goal: "Craft a stone pickaxe",
    pages: [
      "§lGoal: stone pickaxe from nothing.§r\n\nStand near some trees and start. You get an empty inventory.\n\n§eThe fast way:§r\n §f1.§7 Punch ~4-5 logs (don't fully break the tree, just what you need)\n §f2.§7 Planks -> crafting table -> sticks -> wooden pickaxe\n §f3.§7 Mine 3+ cobblestone (dig down 1-2 blocks if no stone is showing)\n §f4.§7 Stone pickaxe. Grab extra cobble for a stone axe/shovel later.\n\n§eTips:§r §7Use the recipe book's search instead of scrolling. Keep moving toward the next tree while the log breaks.",
    ],
    setup() {},
    progress: (p) => `logs ${countLogs(p)}`,
    check: (p) => countItem(p, "minecraft:stone_pickaxe") > 0,
  },

  {
    id: "portal",
    name: "2. Lava Pool Portal",
    icon: "textures/items/bucket_lava",
    dimension: OVERWORLD,
    goal: "Build a portal & enter the Nether",
    pages: [
      "§lGoal: get into the Nether.§r\n\nA lava pool spawns next to you (it carves up the ground a bit, practice world only!). You get a water bucket, an empty bucket, flint & steel and dirt.\n\n§eThe frame:§r §74 wide x 5 tall, but §fcorners are optional§7, so you only need §f10 obsidian§7.\n\n§eMaking obsidian:§r §7Water touching a lava §fsource§7 block turns it into obsidian. Flowing lava just becomes cobble.",
      "§lTwo common methods§r\n\n§fPool method:§7 Build a small dirt mold at the pool's edge, place water so it flows onto lava source blocks in the frame shape, pick the water back up, repeat.\n\n§fBucket casting:§7 Build a dirt mold, scoop lava into the empty bucket, pour it into the mold, then water over it to make obsidian. Pick up water, repeat.\n\n§eTip:§r §7Learn ONE method until it's automatic. Under a minute is a good first target, under 30s is great.",
    ],
    setup(p) {
      // carve space, then build a stone-lined 5x5 lava pool right in front (+x)
      cmd(p, "fill ~2 ~ ~-4 ~9 ~5 ~4 air");
      cmd(p, "fill ~2 ~-2 ~-4 ~9 ~-1 ~4 stone");
      cmd(p, "fill ~3 ~-1 ~-2 ~7 ~-1 ~2 lava");
      give(p, "minecraft:water_bucket");
      give(p, "minecraft:bucket");
      give(p, "minecraft:flint_and_steel");
      give(p, "minecraft:dirt", 32);
      give(p, "minecraft:iron_pickaxe");
    },
    onDimension: (_p, _s, to) => to === NETHER,
  },

  {
    id: "barter",
    name: "3. Bastion Bartering",
    icon: "textures/items/gold_ingot",
    dimension: NETHER,
    goal: "Get 10 ender pearls",
    pages: [
      "§lGoal: barter for 10 ender pearls.§r §c(Start this in the Nether.)§r\n\nYou get boxed in with piglins, gold armor and lots of gold.\n\n§eWhy gold boots?§r §7Piglins attack you unless you wear at least one piece of gold armor. Boots are cheapest.\n\n§eBartering:§r §7Each gold ingot = one random trade. Pearls are a rare roll (~4-5%), so you need a lot of trades. More piglins at once = more trades at once.",
      "§lTips§r\n\n §7- Throw/give gold to §fevery§7 piglin, not one at a time\n §7- While they inspect gold, collect the drops\n §7- Don't hit them - they all turn hostile\n §7- Real runs: bastions have gold blocks you can mine (gold blocks = 9 ingots)\n §7- Obsidian and string from trades are useful too (portal / beds)\n\n§eTip:§r §7Bring piglins together into a small space so all drops land in one spot.",
    ],
    setup(p) {
      cmd(p, "fill ~-5 ~-1 ~-5 ~5 ~5 ~5 blackstone hollow");
      cmd(p, "replaceitem entity @s slot.armor.feet 0 golden_boots");
      give(p, "minecraft:gold_ingot", 192);
      const d = p.dimension;
      const { x, y, z } = p.location;
      for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3], [3, 3], [-3, -3]]) {
        try {
          d.spawnEntity("minecraft:piglin", { x: x + dx, y, z: z + dz });
        } catch {}
      }
    },
    progress: (p) => `pearls ${countItem(p, "minecraft:ender_pearl")}/10`,
    check: (p) => countItem(p, "minecraft:ender_pearl") >= 10,
  },

  {
    id: "blaze",
    name: "4. Blaze Fight",
    icon: "textures/items/blaze_rod",
    dimension: NETHER,
    goal: "Get 6 blaze rods",
    pages: [
      "§lGoal: collect 6 blaze rods.§r §c(Start this in the Nether.)§r\n\nYou're boxed in with blazes that keep respawning. Each blaze drops 0-1 rods.\n\n§eFighting blazes:§r\n §7- They shoot 3 fireballs in a burst. Strafe sideways or duck behind a block between bursts.\n §7- Hit them when they float close. A sword crit (jump + hit) is fastest.\n §7- Place a block as a shield if you're getting cornered.",
      "§lReal run tips§r\n\n §7- Fortresses have blaze spawners. Wall yourself in near the spawner with a 1-block gap and let them come to you.\n §7- Don't chase blazes across the fortress, let them come to you.\n §7- Fire Resistance makes this way safer if you got one from bartering.\n §7- 6-7 rods is enough. Don't over-farm.",
    ],
    setup(p) {
      cmd(p, "fill ~-7 ~-1 ~-7 ~7 ~6 ~7 nether_brick hollow");
      give(p, "minecraft:iron_sword");
      give(p, "minecraft:cobblestone", 32);
      give(p, "minecraft:cooked_beef", 16);
      cmd(p, "replaceitem entity @s slot.armor.feet 0 golden_boots");
    },
    tick(p) {
      const near = p.dimension.getEntities({ type: "minecraft:blaze", location: p.location, maxDistance: 14 });
      if (near.length < 2) {
        const a = Math.random() * Math.PI * 2;
        const { x, y, z } = p.location;
        try {
          p.dimension.spawnEntity("minecraft:blaze", { x: x + Math.cos(a) * 5, y: y + 2, z: z + Math.sin(a) * 5 });
        } catch {}
      }
    },
    progress: (p) => `rods ${countItem(p, "minecraft:blaze_rod")}/6`,
    check: (p) => countItem(p, "minecraft:blaze_rod") >= 6,
  },

  {
    id: "stronghold",
    name: "5. Triangulation",
    icon: "textures/items/ender_eye",
    dimension: OVERWORLD,
    goal: "Find the stronghold & enter the End",
    pages: [
      "§lGoal: find the stronghold and go through the End portal.§r\n\nYou get eyes, a pickaxe, blocks and food. Coordinates get turned on.\n\n§eWhy triangulate?§r §7Following eyes one throw at a time wastes eyes AND time. Two good throws tell you almost exactly where the stronghold is.",
      "§lHow to triangulate§r\n\n §f1.§7 Throw an eye. While it hovers, look §fdead center§7 at it.\n §f2.§7 Open this book -> §fMark eye throw§7.\n §f3.§7 Move §fsideways§7 (perpendicular to where the eye went) about 200+ blocks. Farther = more accurate.\n §f4.§7 Throw again, look at it, §fMark eye throw§7 again.\n §f5.§7 The book gives you the stronghold's X/Z (and Nether X/Z = divided by 8).\n\n§7In real runs you'd do the math with an outside calculator. Here, the book does it so you can learn the feel.",
      "§lBedrock notes§r\n\n §7- Bedrock has more strongholds than Java, so the nearest one can be surprisingly close.\n §7- Eyes always point to the §fnearest§7 stronghold.\n §7- Real runs: do the long travel in the Nether (1 block there = 8 blocks here).\n §7- When you're close, dig down and look for stone bricks. The portal room usually has a lava pool and silverfish spawner.\n §7- Don't throw eyes you need for the portal! Count missing frames first.",
    ],
    setup(p, s) {
      world.gameRules.showCoordinates = true;
      s.marks = [];
      give(p, "minecraft:ender_eye", 16);
      give(p, "minecraft:iron_pickaxe");
      give(p, "minecraft:iron_shovel");
      give(p, "minecraft:cobblestone", 64);
      give(p, "minecraft:cooked_beef", 16);
      give(p, "minecraft:water_bucket");
    },
    progress: (p, s) => `throws marked ${s.marks.length}`,
    onDimension: (_p, _s, to) => to === END,
    actions: [
      { label: "Mark eye throw", run: markThrow },
      { label: "Clear marks", run: (p, s) => { s.marks = []; p.sendMessage("§7Marks cleared."); } },
    ],
  },

  {
    id: "dragon",
    name: "6. Dragon Fight",
    icon: "textures/items/bed_red",
    goal: "Kill the Ender Dragon",
    pages: [
      "§lGoal: kill the dragon.§r\n\nYou get teleported to the End with beds, a sword, a bow and blocks.\n§c(If this world's dragon is already dead, a new one is summoned. Summoned dragons can act a little differently.)§r\n\n§eBeds explode§r §7in the End (and Nether). That's the main damage in a speedrun. A bed explosion does a ton of damage to a perched dragon.",
      "§lBed bombing§r\n\n §f1.§7 Wait for the dragon to §fperch§7 on the fountain (the bedrock pillar in the middle).\n §f2.§7 Stand so the dragon's head is near you. Place a bed against the dragon's head/body.\n §f3.§7 Put a block between you and the bed (or stand below it) so you don't eat the blast.\n §f4.§7 Use the bed -> boom. Place the next one immediately.\n\n§eTips:§r §7Don't stand on the fountain when the dragon perches (its breath hurts). Crystals heal the dragon. Shoot the ones you can reach, but fast runs often ignore most of them.",
    ],
    async setup(p, s) {
      const end = world.getDimension(END);
      cmd(p, "effect @s slow_falling 15 0 true");
      cmd(p, "effect @s resistance 10 4 true");
      p.teleport({ x: 100, y: 52, z: 0 }, { dimension: end });
      // wait for chunks, then build a safe platform (like the vanilla spawn platform)
      for (let i = 0; i < 40; i++) {
        await sleep(5);
        if (cmd(p, "fill 98 48 -2 102 48 2 obsidian")) {
          cmd(p, "fill 98 49 -2 102 51 2 air");
          break;
        }
      }
      give(p, "minecraft:bed", 8);
      give(p, "minecraft:iron_sword");
      give(p, "minecraft:iron_pickaxe");
      give(p, "minecraft:bow");
      give(p, "minecraft:arrow", 32);
      give(p, "minecraft:cobblestone", 64);
      give(p, "minecraft:cooked_beef", 16);
      give(p, "minecraft:water_bucket");
      s.dragonCheckAt = Date.now() + 4000;
    },
    tick(p, s) {
      if (s.dragonCheckAt && Date.now() > s.dragonCheckAt) {
        s.dragonCheckAt = 0;
        const end = world.getDimension(END);
        const dragons = end.getEntities({ type: "minecraft:ender_dragon" });
        if (dragons.length === 0) {
          try {
            end.spawnEntity("minecraft:ender_dragon", { x: 0, y: 90, z: 0 });
            p.sendMessage("§7No dragon found - summoned a new one.");
          } catch {
            p.sendMessage("§cCouldn't summon a dragon yet. Walk toward the center (0, 0).");
            s.dragonCheckAt = Date.now() + 3000;
          }
        }
      }
    },
    progress: (p) => `beds ${countItem(p, "minecraft:bed")}`,
    onDragonDeath: true,
  },
];

export function getLesson(id) {
  return LESSONS.find((l) => l.id === id);
}

function countLogs(p) {
  const logs = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak"];
  return logs.reduce((n, w) => n + countItem(p, `minecraft:${w}_log`), 0);
}
