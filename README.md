# Speedrun Academy (Minecraft Bedrock)

A **practice-only** behavior pack that teaches Bedrock Any% speedrunning. It has lessons for each section of the route, kits and arenas built for you, a live timer, and personal bests.

> ⚠️ Never have this pack on during a real run. Leaderboards require vanilla Minecraft. Behavior packs also disable achievements on the world they're applied to.

## Guided Run + Checklist (new in 0.2)

A full Any% run with coaching:

- **Live checklist on the right side of the screen** (the scoreboard sidebar, so it needs no extra textures). It reads your inventory and ticks items off as you get them: green = done, red = still needed, gray = optional. It switches phases automatically when you change dimension (Overworld → Nether → Stronghold → The End).
- **Action bar** shows the timer, the next thing to get, and an inventory-full warning.
- **"What do I do next?"** explains how to get the next item (where iron comes from, how to find flint, and so on).
- **Phase guides** cover pathing: what to look for in your first 10 seconds, how to find a lava pool, how to read the Nether, and how to dig into a stronghold.
- **Scout** (training wheels) finds the nearest lava, ruined portal, village, iron, gravel, bastion, gold block or fortress, then points you there with an arrow and tells you what it looks like so you learn to spot it yourself. Timed runs that use Scout don't save a PB.
- **Inventory check** compares your hotbar to a recommended layout for the current phase, flags junk and block clutter, and can arrange the hotbar for you.
- **Splits** for each phase, with your best segments saved.

There are two modes. **Timed** clears your inventory and is meant for a brand new world. **Checklist only** keeps your stuff and has no timer.

Only one checklist fits on the shared sidebar, so in multiplayer it shows the most recent player who started a run.

## Lessons

| # | Lesson | Where to start | Goal |
|---|--------|----------------|------|
| 0 | The Route | anywhere | Read-only overview of the run |
| 1 | Overworld Start | Overworld, near trees | Craft a stone pickaxe from nothing |
| 2 | Lava Pool Portal | Overworld | Build a portal from a lava pool & enter the Nether |
| 3 | Bastion Bartering | Nether | Barter piglins for 10 ender pearls |
| 4 | Blaze Fight | Nether | Collect 6 blaze rods |
| 5 | Triangulation | Overworld | Find a stronghold using 2-throw triangulation, enter the End |
| 6 | Dragon Fight | anywhere (teleports you) | Kill the dragon with bed bombing |

Each lesson: tips pages → **Start** → inventory reset + kit → 3-2-1 → timer on the action bar → PB saved when you hit the goal. Dying fails the attempt.

## Using it

- You get a **Speedrun Academy** book (locked to your inventory, kept on death). Use it to open the menu.
- Fallback: `/scriptevent academy:menu`
- While in a lesson, the book shows Restart / Quit / Re-read tips. In the Triangulation lesson it also shows **Mark eye throw**.

Lessons 2-4 edit the terrain around you (lava pool, arenas). Use a throwaway practice world.

## Requirements

Minecraft Bedrock **1.21.90+**. It uses the stable Script API (`@minecraft/server` 2.0.0), so you don't need any experimental toggles.

## Install

```
npm install
npm run check   # typecheck scripts against the Script API + validate item/block ids
npm test        # checklist logic tests (mocked game API)
npm run build   # -> dist/SpeedrunAcademy.mcpack
```

Open the `.mcpack` on your device and Minecraft imports it. Then create a new world and add **Speedrun Academy** under Behavior Packs.
