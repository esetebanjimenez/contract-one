# Contract One — Design Spec v0.1

Owner: Game Designer. All numbers are starting values; they live in `src/data/` and get tuned from the bot sim.

## 1. Pillars
- **One more run:** a run lasts ~10–12 min and ends in a win (boss dead) or death.
- **Thumb-only play:** movement is the only input. Firing is automatic.
- **Build variety:** 3 perks are offered per level from a larger pool, so no two runs play the same.
- **Readable chaos:** the screen gets dense, but threats stay legible (see colour rules in `docs/art-style.md`).

## 2. Run structure
| Time | Event |
|---|---|
| 0:00 | Drop-in. Grunts only. |
| 1:30 | Runners join. |
| 3:00 | Heavies join. |
| 4:30 | Riflemen (first shooters) join. |
| 7:00 | Elite variants start appearing. |
| 10:00 | **Contract target: The Warlord** arrives. Normal spawns drop to 30%. |
| Boss dead | Run won, then the results screen. |

There is no meta-progression in v1. Death shows run stats and a Restart button.

## 3. Controls (portrait)
- A press anywhere in the **bottom third** of the screen spawns a floating joystick at the touch point. It works with either thumb.
- Knob radius 48 px (logical). Dead zone 10%. Releasing hides the stick and stops the player.
- The camera follows the player, who stays centered. The world is an open, unbounded tiled ground.
- Desktop testing: WASD or the arrow keys.

## 4. Player (base merc)
| Stat | Value |
|---|---|
| HP | 100 |
| Move speed | 90 px/s |
| Hit invulnerability | 0.6 s |
| Weapon | Rifle, auto-targets the nearest enemy within 220 px |
| Damage | 10 |
| Fire rate | 3 shots/s |
| Bullet speed | 360 px/s, range 260 px |
| Pierce | 0 |
| Crit | 0% (x2 damage) |
| Pickup magnet | 40 px |
| Hitbox | 7 px radius circle at the body centre (not the sprite centre) |

Facing: the whole sprite rotates (0° = facing right). It faces the auto-aim target when one is in range, otherwise the move direction, and turns within ~0.1 s.

## 5. Enemies
All enemies spawn 24–48 px outside the visible area, from a random edge direction, and move toward the player.

| Id | Name | HP | Speed | Contact dmg | Ranged | Scrap | From |
|---|---|---|---|---|---|---|---|
| `grunt` | Grunt | 10 | 45 | 8 | none | 1 | 0:00 |
| `runner` | Runner | 6 | 85 | 6 | none | 1 | 1:30 |
| `heavy` | Heavy | 60 | 30 | 15 | none | 5 | 3:00 |
| `rifleman` | Rifleman | 25 | 40 | 8 | 1 shot every 2.0 s, 10 dmg, 140 px/s, stops at ~140 px | 3 | 4:30 |
| `elite_*` | Elite variant | x3 HP | x1.1 | x1.5 | same as base | x4 | 7:00 |

Enemy bullets must be dodgeable on a phone: they fire slowly, and every shot is telegraphed by a 0.3 s muzzle flash.

HP scaling: all enemy HP x(1 + 0.08 × minutes elapsed).

## 6. Spawn ramp
- Spawn rate: `rate(t) = 0.8 × 2^(t / 150)` enemies/s, where t is in seconds. That roughly doubles every 2.5 min, giving ~0.8/s at 0:00 and ~13/s at 10:00.
- Mix weights per time band are kept in `src/data/spawns.ts`. A newly unlocked type starts at 20% weight and grows.
- **Pressure waves:** every 60 s, a 5 s burst at x3 rate arrives from one direction (a ring of Grunts).
- Soft caps: 250 enemies and 400 bullets (Programmer's numbers). Past the cap, spawns pause and the farthest enemies are recycled.

## 7. Scrap and levels
- Kills drop Scrap pickups (pure cyan; no other cyan on screen). Pickups despawn after 30 s.
- Scrap needed for the next level: `5 + 6 × (level − 1)`. That means 5, 11, 17 and so on, and a typical run reaches level ~25–30 by 10:00.
- A level-up pauses the game and shows **3 perk cards**. Tapping one picks it. There is no reroll in v1.
- Overflow Scrap carries into the next level.

## 8. Perk pool v1
Rules: perks are drawn without duplicates per offer, each stacks up to the listed max, and a maxed perk leaves the pool. Weight is 1 unless listed otherwise.

| Id | Perk | Per stack | Max |
|---|---|---|---|
| `dmg` | Hollow Points | +15% damage | 5 |
| `rof` | Trigger Job | +12% fire rate | 5 |
| `pierce` | AP Rounds | +1 pierce | 3 |
| `multishot` | Extra Barrel | +1 projectile (10° spread) | 3 |
| `move` | Light Kit | +8% move speed | 4 |
| `maxhp` | Plate Carrier | +20 max HP, heals 20 | 5 |
| `magnet` | Scrap Magnet | +30% pickup radius | 3 |
| `crit` | Marksman | +5% crit chance | 5 |
| `bspeed` | Hot Loads | +15% bullet speed and range | 3 |
| `regen` | Medkit | +1 HP every 5 s | 3 |
| `ricochet` | Ricochet | bullets bounce to +1 target | 2 |
| `explosive` | HE Rounds | 20% of hits explode (32 px, 50% dmg) | 3 |
| `drone` | Drone Buddy | an orbiting drone, 5 dmg at 2/s | 2 (weight 0.6) |
| `grenade` | Frag Out | a grenade every 4 s (−0.5 s per stack), 40 dmg, 48 px | 3 (weight 0.6) |
| `armor` | Ceramic Plates | −1 damage taken per hit (min 1) | 3 |

Vertical slice subset: `dmg`, `rof`, `pierce`, `multishot`, `move`, `maxhp`.

## 9. Boss — The Warlord
- **HP:** 2,000 × (1 + 0.1 × player level above 20). Size 64–96 px. A boss HP bar sits at the top of the screen.
- **Arrival:** a 3 s warning banner, then the boss enters from the top edge.
- **Phase 1 (100–66%):** Charge. A red telegraph line is shown for 0.8 s, then he dashes 300 px at 4× speed. 25 dmg on contact. He walks between charges.
- **Phase 2 (66–33%):** adds a Bullet ring. 16 bullets go out radially every 3 s, with one rotating gap. Charges continue.
- **Phase 3 (<33%):** adds Call reinforcements. 12 Grunts spawn in a ring every 8 s. Rings come every 2 s, and charge cooldown −30%.
- His contact damage is 20, and he ignores the soft cap.
- Kill: a slow-mo, then "CONTRACT COMPLETE".

## 10. Tuning targets (bot sim)
- A no-perk idle bot (standing still) dies before 2:00.
- A kiting bot with random perks reaches the boss in ≥60% of runs.
- A kiting bot with a sensible build (damage/rate/pierce first) kills the boss in ≥50% of runs.
- Level at 10:00: 22–30.
- Boss fight length: 60–120 s for a sensible build.

## 11. Later (not in v1)
Character select with 2–3 mercs, each with its own starting weapon and passive. Weapon swaps, perk reroll and banish, meta-progression, and more contracts and bosses.
