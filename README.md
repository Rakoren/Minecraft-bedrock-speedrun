# Speedrun Academy (Minecraft Bedrock)

A **practice-only** behavior pack that teaches Bedrock Any% speedrunning. It has lessons for each section of the route, kits and arenas built for you, a live timer, and personal bests.

> ⚠️ Never have this pack on during a real run. Leaderboards require vanilla Minecraft. Behavior packs also disable achievements on the world they're applied to.

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
npm run check   # typecheck scripts against the Script API
npm run build   # -> dist/SpeedrunAcademy.mcpack
```

Open the `.mcpack` on your device and Minecraft imports it. Then create a new world and add **Speedrun Academy** under Behavior Packs.
