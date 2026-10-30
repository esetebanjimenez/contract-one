# Contract One — Design Spec v0.6

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
| 0:45 | Runners join. |
| 1:30 | Heavies join. |
| 2:15 | Riflemen (first shooters) join. |
| 3:30 | Elite variants start appearing. |
| 5:00 | **Contract target: The Warlord** arrives (§16.8; was 10:00). The boss arena starts (§14.9). |
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
| Pickup magnet | 70 px (pickups fly in at 300 px/s) |
| Hitbox | 7 px radius circle at the body centre (not the sprite centre) |

Facing: the whole sprite rotates (0° = facing right). It faces the auto-aim target when one is in range, otherwise the move direction, and turns within ~0.1 s.

## 5. Enemies
All enemies spawn 24–48 px outside the visible area, from a random edge direction, and move toward the player.

| Id | Name | HP | Speed | Contact dmg | Ranged | Scrap | From |
|---|---|---|---|---|---|---|---|
| `grunt` | Grunt | 10 | 45 | 8 | none | 1 | 0:00 |
| `runner` | Runner | 6 | 85 | 6 | none | 1 | 1:30 |
| `heavy` | Heavy | 60 | 30 | 15 | none | 5 | 3:00 |
| `rifleman` | Rifleman | 25 | 40 | 8 | 1 shot every 2.0 s, 10 dmg, 95 px/s, stops at ~140 px | 3 | 4:30 |
| `elite_*` | Elite variant | x3 HP | x1.1 | x1.5 | same as base | x4 | 7:00 |

Enemy bullets must be dodgeable on a phone: they fire slowly, and every shot is telegraphed by a 0.3 s muzzle flash.

HP scaling: see §12 (M2).

## 6. Spawn ramp
- Spawn rate: `rate(t) = 1.0 × 2^(t / 150)` enemies/s, where t is in seconds. That roughly doubles every 2.5 min, giving ~0.8/s at 0:00 and ~13/s at 10:00.
- Mix weights per time band are kept in `src/data/spawns.ts`. A newly unlocked type starts at 20% weight and grows.
- **Pressure waves:** every 60 s, a 5 s burst at x3 rate arrives from one direction (a ring of Grunts).
- Soft caps: 250 enemies and 400 bullets (Programmer's numbers). Past the cap, spawns pause and the farthest enemies are recycled.

## 7. Scrap and levels
- Kills drop Scrap pickups (pure cyan; no other cyan on screen). Pickups **never despawn** (Esteban, 2026-10-24). At the 300-pickup cap, a new drop adds its value to the pickup nearest the enemy's death spot, with a small cyan pop on that pickup so the drop reads (was: oldest pickup, which hid drops late in a run). Magnet 70 px; inside it, pickups fly to the player at 300 px/s.
- Scrap needed for the next level: `5 + 6 × (level − 1)`. That means 5, 11, 17 and so on, and a typical run reaches level ~25–30 by 10:00.
- A level-up pauses the game and shows **3 perk cards**. Tapping one picks it. There is no reroll in v1.
- Overflow Scrap carries into the next level.

## 8. Perk pool v1
> **Superseded:** live values, tiers and labels are in §15.2, and caps were removed in §16.1. `explosive`, `drone` and `grenade` are not in the game yet; they're held back for effects art (§13.6).

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
| `regen` | Medkit | +1 HP every 2 s, with a tick on the HP bar | 3 |
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

## 12. M2 difficulty: threat per enemy, not more enemies
M1 sim finding: the 250-enemy cap is reached mid-run, so the spawn rate stops adding pressure, and kite bots reach 10:00 every time. From M2 on, late-run pressure comes from **what** spawns, not how many.

### 12.1 Scaling per minute elapsed (m)
| Stat | Formula | At 5:00 | At 10:00 |
|---|---|---|---|
| Enemy HP | × (1 + 0.15·m) | ×1.75 | ×2.5 |
| Contact damage | × (1 + 0.05·m) | ×1.25 | ×1.5 |
| Rifleman fire interval | 2.0 s − 0.08·m (min 1.2 s) | 1.6 s | 1.2 s |
| Enemy move speed | unchanged | | |

### 12.2 Mix replaces count once the cap is hit
When enemies are at the cap, each new spawn replaces the **farthest Grunt** with a pick from the current mix, so the screen's threat keeps climbing.

| Band | Grunt | Runner | Heavy | Rifleman | Elite |
|---|---|---|---|---|---|
| 0:00–1:30 | 100 | – | – | – | – |
| 1:30–3:00 | 75 | 25 | – | – | – |
| 3:00–4:30 | 55 | 25 | 20 | – | – |
| 4:30–7:00 | 40 | 20 | 20 | 20 | – |
| 7:00–10:00 | 25 | 20 | 20 | 20 | 15 |

**Live tuning (`2454f0c`):** HP slope 0.14 (locked; step 2 sim: kite-smart 75% L23, collector 94% L36, kite 69% L26, idle dies 1:16), contact slope 0.03, Runner speed 95, Elite share 10% in the 7:00–10:00 band, Scrap no longer despawns. These override the starting values above; `src/data/` is the source of truth.

Ranged cap: at most 30 Riflemen alive, so bullets stay readable.

Replacement order at the cap: the farthest off-screen non-elite Grunt first; if none, the farthest off-screen non-elite enemy of any type. Spawning never stops at the cap.

### 12.3 Pressure waves (from §6) become the spike
Every 60 s: a 5 s burst, which may exceed the cap by up to 40 for its duration. From 5:00, the ring includes Heavies.
- **Anti-flee:** the burst spawns in a 90° arc **centred on the player's current move direction** (ahead of them). If the player is standing still, the direction is random.
- **Encirclement:** from 3:00, every second wave (3:00, 5:00, 7:00, 9:00) is a **full ring** of Grunts spawned just off-screen all around the player. The player must break through it, not outrun it.

### 12.4 M2 tuning targets
- Every bot auto-fires, so moving while shooting is the intended play, not an exploit.
- **Reference bot = kite-smart** (skilled player): reaches 10:00 in **60–80%** of runs.
- **Collector** (greedy player, detours for pickups): reaches 10:00 in **≥40%** of runs. Greed is risky but viable.
- **Kite** (naive player): reaches 10:00 in **20–50%** of runs.
- Median level at 10:00 for kite-smart: 20–35 (lowered from 25–35 because tiered perks give more power per level).
- Kite is above its target at 69%. Leave the waves as they are and look at kite again after the M3 boss sim, because the boss is the main filter for a naive player.
- Idle still dies before 2:00.
- Scrap collected ≥70% for a **collector** bot (kites in small loops, sweeps back through drops). Judge this value only with that bot; a wide-circling bot is not the reference.

Levers in order if targets miss: HP slope (0.15) first, then the Elite share, then the Rifleman fire interval.

## 13. M2 content: new enemy tiers and perks
Stats are in §5 and scaling in §12. This section adds behaviour, silhouettes and the M2 perk set.

### 13.1 Silhouette rule
Each enemy type is told apart by **size and shape first**, colour second. Sizes are body sizes at native resolution:

| Enemy | Size | Shape read |
|---|---|---|
| Runner | 20 px | same size as the Grunt; told apart by shape: crouched, knife forward, scarf streaking behind (approved by Esteban) |
| Grunt | 20 px | baseline |
| Rifleman | 24 px | rifle pointing at the player |
| Heavy | 28 px | wide and square, shield in front |
| Elite | base type ×1.25 | same shape plus a bone-white 1 px outline |

Reserved colours that no enemy body may use: red-orange (enemy bullets), cyan (Scrap), pale yellow (player bullets) and NVG green (the player).

### 13.2 Runner (`runner`)
- **Behaviour:** heads straight for the player at 85 px/s, with no flocking, and arrives in groups of 3–5 from the same edge.
- **Look:** a crouched knife-man in charcoal, with a maroon scarf trailing behind that shows his direction. Two run frames swap every 100 ms.
- **Role:** punishes standing still and pushes the player to keep moving.

### 13.3 Heavy (`heavy`)
- **Behaviour:** walks slowly toward the player at 30 px/s and is **immune to knockback**. His shield is visual only and blocks nothing.
- **Look:** a wide body in charcoal plate with a slate riot shield in front and a maroon visor slit. Two heavy-step frames swap every 200 ms.
- **Role:** soaks bullets, makes the player value Pierce and damage, and forms walls that close escape routes.
- **Hit feedback:** a 1-frame white flash on every hit, so the player can see damage landing on a high-HP target.

### 13.4 Elite (`elite_grunt`, `elite_runner`, `elite_heavy`, `elite_rifleman`)
- An Elite reuses its base sprite at ×1.25 scale with a bone-white outline. **No new art is needed** beyond the outline pass, which can be drawn in code.
- Stats are ×3 HP, ×1.1 speed and ×1.5 contact damage, as in §5. An Elite Rifleman fires a 3-shot spread.
- **Drop:** one **Scrap cache** worth ×4, drawn as a larger cyan pickup (12 px) so it reads as a reward.

### 13.5 Knockback (new, small)
Every player bullet hit pushes the enemy back 4 px, and Heavies and the boss are immune. It gives hits weight and lets the player open small gaps in a crowd.

### 13.6 M2 perks: 6 more, 12 in total
New in M2, all numbers only, with no new visuals beyond the card icon:

| Id | Perk | Per stack | Max |
|---|---|---|---|
| `magnet` | Scrap Magnet | +30% pickup radius | 3 |
| `crit` | Marksman | +5% crit chance (×2 damage) | 5 |
| `bspeed` | Hot Loads | +15% bullet speed and range | 3 |
| `regen` | Medkit | +1 HP every 2 s, with a tick on the HP bar | 3 |
| `armor` | Ceramic Plates | −1 damage taken per hit (min 1) | 3 |
| `ricochet` | Ricochet | bullets bounce to +1 target within 80 px | 2 |

`explosive`, `drone` and `grenade` are held back until they get their own effects art.

**Perk card:** a 16×16 icon, the perk name and a one-line effect with the stack count (for example "Hollow Points II — +15% damage"). The Artist needs **12 icons** for M2.

**Offer rule:** when the player has fewer than 2 damage-type perks (`dmg`, `rof`, `pierce`, `multishot`, `crit`, `ricochet`), at least one of the 3 cards must be a damage perk. That stops runs from stalling when the rolls are unlucky.

## 14. M3: the contract (timer, boss, win and lose)
Goal: a run has a real ending. You survive to 10:00, kill the Warlord, and get a result screen.

### 14.1 Contract timer
- **HUD:** top-centre, `TARGET IN 4:59`, counting down from 5:00 (§16.8; was 10:00). White, and red-orange for the last 10 s.
- **4:30** (was 9:30): a banner reads "TARGET INBOUND", shown for 2 s. Pressure waves and rings stop from 4:30, so the arrival isn't buried.
- **5:00** (was 10:00): the timer is replaced by the boss HP bar (full width, top, with the name "THE WARLORD").

### 14.2 Boss arrival
- A 3 s warning (§9), then he walks in from the top edge, 120 px off-screen. He can't be damaged until fully on-screen.
- ~~Normal spawns drop to 30%~~. Replaced by the boss arena in §14.9.

### 14.3 Boss numbers (refines §9)
| Value | Start |
|---|---|
| HP | **40 × the player's single-target sheet DPS when the boss spawns, minimum 2000, no upper clamp** (§16.5). Was 2000 flat. With uncapped perks (§16.1), sim `24e8464` showed 2000 HP dying in 2–13 s. |
| Body | about 80 px on a 96 px canvas, hitbox radius 30 |
| Walk speed | 35 px/s toward the player |
| Contact damage | 20 (not scaled by §12) |
| Charge | every 5 s; 0.8 s telegraph line, then a 300 px dash at 140 px/s; 25 dmg (35 proposed in `bf9b206`, **on hold**) |
| Phase 2 ring (below 66%) | 16 bullets every 3 s (2 s proposed, **on hold**), one rotating gap of 2 bullets, 90 px/s, 10 dmg |
| Phase 3 adds (below 33%) | 12 Grunts in a ring every 8 s; ring every 2 s (1.5 s proposed, **on hold**); charge every 3.5 s |
| Knockback | immune |
| Phase change | 1 s stagger: he can't attack, flashes white, and every enemy bullet on screen is cleared |
| Enrage | if still alive 2:00 on the fight clock (which starts when he's fully on-screen; not the 12:00 run time): ring every 1.0 s, walk speed ×1.5. It must be lethal, not just a timer. Every run ends. |

### 14.4 Win
On the kill: 1 s slow-mo at 0.3×, every other enemy dies with no Scrap, the banner "CONTRACT COMPLETE" shows, then 2 s later the results screen.

### 14.5 Lose
At 0 HP: a 0.5 s freeze, the banner "KIA", then the results screen. If the boss was alive, show "TARGET HP LEFT: 34%".

### 14.6 Results screen (win and lose)
- Title: CONTRACT COMPLETE or CONTRACT FAILED.
- Stats: time, level, kills, Scrap collected, and boss damage dealt.
- The list of perks taken: each shows its icon, name and total value (never an icon alone).
- One button, **New Contract**, in the bottom third (thumb reach). Input is locked for 0.8 s so a joystick release can't tap it by accident.
- No meta-progression, no menus (§2).

### 14.7 M3 tuning targets (bot sim: bots fight the boss with their usual movement)
- Kite-smart kills the boss in **40–60%** of runs that reach 10:00.
- Fight length for kite-smart: **60–120 s**.
- The enrage fires in **under 10%** of fights.
- Lever order if targets miss: boss HP base (2000), then the phase-2 ring interval, then charge damage. Sim at `7b0a900` showed kills of 82–100%, The ring and charge buffs are on hold (Producer, 2026-10-24): Esteban found the fight hard in play, so we tune from his arena playtest rather than the bot kill rate.

### 14.8 Needs
- **Art:** the boss sprite (top-down, 96 px canvas, walk and charge pose), a telegraph line in red-orange, and the banner and results-screen look.
- **Data:** every value above goes in `src/data/boss.ts`, with the timer and banner times in `src/data/run.ts`.

### 14.9 Boss arena (M3.1, Esteban playtest 2026-10-24)
At 5:00 (§16.8; was 10:00), when the boss warning starts:
- **Clear-out:** every non-boss enemy turns and flees directly away from the player at 1.5× its speed. Fleeing enemies do no contact damage, can't be hit, drop no Scrap, and despawn once off-screen. Enemy bullets already in flight are cleared.
- **Lock:** the camera freezes where it is. The visible world below the HUD strip is the arena, and its edges are solid walls for the player. The bottom-third joystick zone is still part of the arena.
- **Boss:** walks in from the top edge as before. Once he's fully inside, the walls hold him too. A charge that hits a wall stops there. His bullets despawn at the walls.
- **Spawns:** none during the fight, apart from the phase 3 adds, which walk in from just outside the arena edges, evenly spaced around it. Adds drop **no Scrap**.
- **Scrap:** pieces already on the ground in the arena can still be picked up. Level-ups from them still happen, but the fight itself gives no levels.
- **Edge read:** the Artist's 8px hazard-tape band (4px diagonal stripes in red-orange `#FF4A1C` and `#14110F`, with a 1px dark inner line), drawn in code. It grows in from the screen edges over 0.5 s at the lock.
- Tune from Esteban's playtest of the arena first, then the bot sim.

### 14.10 Enrage tell
At enrage, the Warlord's outline pulses red-orange `#FF4A1C` every 0.5 s, and "ENRAGED" shows in the HUD strip under the boss bar. No new art.

### 14.11 Later: character identities (parked, not in M3)
- Base merc (current): **fires while moving**. That's his identity.
- Future characters swap this rule and make up for it with other strengths. For example, a Marksman who only fires while standing still, with high damage and +2 pierce built in, or a Gunner who deploys a turret after standing still for 1 s.
- Character choice would be one screen before New Contract. Each character keeps the shared perk pool and adds 1–2 signature perks.

## 15. Playtest changes (Esteban, 2026-10-24)

### 15.1 Enemy bullets
- Rifleman bullets 95 px/s (were 140); boss ring bullets 90 px/s (were 120). The player moves at 90, so bullets can be sidestepped.
- Enemy bullets get 1 px larger, with a 1 px dark outline. Still red-orange.

### 15.2 Perk tiers
Each offered card rolls a tier independently.

| Tier | Colour (card border) | Effect multiplier | Whole-number perks |
|---|---|---|---|
| Common | grey | ×1 | +1 |
| Rare | blue | ×1.5 | none (rolls as Common) |
| Epic | purple | ×2 | +2 |
| Mythic | gold (deep gold, not the pale yellow of player bullets) | ×3 | +3 |

Whole-number perks are `pierce`, `multishot`, `ricochet`, `armor`, `regen`. They have no Rare version: a Rare roll on one of them becomes Common. ~~Each perk's max applies to the total effect.~~ **No caps** since §16.1: the Max total column is no longer used.

**Card labels and values** (name in the title bar, effect line under the icon; `{v}` is the tier value):

| Id | Name | Effect line | Common | Rare | Epic | Mythic | Max total |
|---|---|---|---|---|---|---|---|
| `dmg` | HOLLOW POINTS | +{v}% damage | 15 | 23 | 30 | 45 | +75% |
| `rof` | TRIGGER JOB | +{v}% fire rate | 12 | 18 | 24 | 36 | +60% |
| `pierce` | AP ROUNDS | +{v} pierce | 1 | – | 2 | 3 | 3 |
| `multishot` | EXTRA BARREL | +{v} bullets | 1 | – | 2 | 3 | 3 |
| `move` | LIGHT KIT | +{v}% move speed | 8 | 12 | 16 | 24 | +32% |
| `maxhp` | PLATE CARRIER | +{v} max HP, heal | 20 | 30 | 40 | 60 | +100 |
| `magnet` | SCRAP MAGNET | +{v}% magnet | 30 | 45 | 60 | 90 | +90% |
| `crit` | MARKSMAN | +{v}% crit | 5 | 8 | 10 | 15 | 25% |
| `bspeed` | HOT LOADS | +{v}% speed/range | 15 | 23 | 30 | 45 | +45% |
| `regen` | MEDKIT | +{v} HP per 2s | 1 | – | 2 | 3 | 3 |
| `armor` | CERAMIC PLATES | -{v} dmg per hit | 1 | – | 2 | 3 | 3 |
| `ricochet` | RICOCHET | +{v} bounces | 1 | – | 2 | 3 | 2 |

Every name fits in 14 characters and every effect line in 16, so each stays on one line on the 104 px card (Silkscreen 8 px). "Max HP, heal" means the pick also heals by the same amount; "crit" is double damage. Use "bullet"/"bounce" when `{v}` is 1. A card for a perk that is one pick away from its max shows the value actually gained.

Tier odds by player level (Common / Rare / Epic / Mythic):
| Level | Odds |
|---|---|
| 1–5 | 70 / 25 / 5 / 0 |
| 6–15 | 55 / 30 / 12 / 3 |
| 16+ | 40 / 33 / 20 / 7 |

- The card shows the tier name, the perk name under the icon, and the scaled effect ("EPIC — HOLLOW POINTS — +30% damage"). The card uses the flavour name (HOLLOW POINTS, AP ROUNDS…); the effect line underneath says what it does (Esteban, 2026-10-24). **An icon is never shown without its name**, anywhere.
- Tier colour goes on the card frame and title bar (approved: Common `#9AA0A6`, Rare `#3D6BFF`, Epic `#A44DFF`, Mythic `#FFC233` with a slow twinkle). The attack, defence and utility category stays as the coloured border on the icon tile (approved by Esteban).
- Later: `explosive`, `drone` and `grenade` can enter as Mythic-only perks.

### 15.3 Scrap persistence
- Pickups never despawn. At the 300 cap, a new drop adds its value to the pickup nearest the death spot, with a cyan pop (changed from oldest, 2026-10-24).
- Balance: with no despawn and with tiers, the player gets stronger. Levers in order: the cap rule above, then the enemy HP slope 0.12 → 0.14, aiming at the §12.4 targets. Both done; 0.14 is locked.

### 15.4 Regen
- Reported as not working in the playtest; Programmer to check.
- New value: +1 HP every 2 s per stack, with a brief white tick on the HP bar when it heals (not green: reserved for the player).

### 15.5 Perk pool exhausted
- When every perk is at its max, the level-up shows one fallback card: **FIELD RATIONS**, "Heal 25 HP", tier-less in a grey frame. It always appears, so a level-up is never empty. The XP bar keeps showing.
- If only some perks are maxed, maxed perks drop out of the draw and the card count falls to what's left (at least 1, using the fallback if needed).
- Playtest flag: Esteban hit level 49 by 11:05 with every perk maxed, against ~23 for the bots at 10:00, so humans collect far more Scrap. Esteban found the fight hard, so we leave the level curve alone until the arena playtest.

## 16. Playtest 2 changes (Esteban, 2026-10-24, run at 10:23, level 41, win)

### 16.1 No perk caps
- Every perk stacks with no upper limit. Ignore the Max total column in §15.2.
- Guards: armor never reduces a hit below 1 damage. Crit stops at 100% and then leaves the draw.
- Move speed: gains past +60% count at half value, so it keeps growing but stays steerable with a thumb.
- FIELD RATIONS (§15.5) is dropped. With no caps the draw is never empty, and its icon no longer needs an okay.
- Perf watch: uncapped `multishot`, `pierce` and `ricochet` raise the bullet count. These three stay fully open. If the frame rate dips, add a limit on player bullets on screen (oldest bullets go first), not smaller gains per pick.

### 16.2 Four cards per level-up
- 4 cards, not 3, in a 2×2 grid, centred, same 104×124 card. Each card still rolls its tier independently, and no perk appears twice in one offer.

### 16.3 Scrap clumping
- Every **0.5 s**, any group of **3 or more** grounded pickups within **40 px** of each other merges into one pickup at their centre, holding the total value (Esteban, 2026-10-25; was 8 or more within 24 px once a second, which spread-out late-game drops almost never met).
- Pickups more than **400 px** from the player (off screen) merge across **80 px** instead, so a trail left behind becomes a few large caches.
- Flying pickups (inside the magnet) never merge.
- A pickup worth 5 or more drops shows as the 12 px Elite cache sprite. Smaller ones stay the 8 px Scrap.
- The 300 cap (§15.3) stays as the backstop.

### 16.4 Shooters stop to fire
Applies to the Rifleman and the Elite Rifleman. Replaces the fixed fire interval (§5, §12.1).
- They fire only when **fully on-screen**.
- Cycle: stop for **0.6 s** with a red-orange muzzle glint (the telegraph), fire (1 shot, or the Elite's 3-shot spread), then move for at least **2.0 s** before they can stop again.
- Late-game scaling: the move time drops by 0.05 s per minute, to a minimum of 1.4 s. The telegraph never shortens.
- Lever if shooters are too weak: the move time first, then the share of Riflemen in the band mix.

### 16.5 Boss HP follows player damage
- With no perk caps, power grows multiplicatively and no level formula can keep up. The sim at `24e8464` showed boss fights of 0:02–0:13 and kite-smart at level 50 by 10:00.
- **Boss HP = 40 × the player's single-target sheet DPS when the boss spawns, minimum 2000, no upper clamp.** It's set once, at spawn.
- Sheet DPS is worked out from the player's stats, not from damage dealt, because damage dealt is limited by how many enemies are around. It's bullet damage × shots per second × (1 + 0.5 × extra bullets per shot) × (1 + crit chance), with crit doing double damage. Extra bullets count half because many miss a single target. Pierce and ricochet don't count, since there's only one target.
- Levels stop during the arena (§14.9), so sheet DPS holds through the fight. Landing about 60–70% of shots while dodging gives roughly 85–100 s, inside the 60–120 s target, for any build.
- Lever if fights miss: the multiplier (60 at `cd8fba6` gave kite-smart 380k HP and 0% kills; now 40 with extra bullets at half). Tune it from Esteban's playtest, not from the bots, which handle the walled arena badly.
- Level 50 at 10:00 for kite-smart: wait for Esteban's next run. If it holds for a human, the first lever is the Scrap needed per level.

### 16.6 Current kit on the level-up screen (Esteban, 2026-10-24)
- A "YOUR KIT" strip under the 2×2 card grid shows only the perks taken so far.
- Each cell is the 16 px perk icon plus its current total in 8 px Silkscreen, written the same way as the effect line ("+75%", "+3", "-2", "+90"). Cells are 36 px wide, 6 per row, in a 220 px panel aligned with the card grid (Artist's mock `levelup_kit_hl_native.png`, okayed by Esteban 2026-10-24). Order is the §15.2 table order.
- Exception to the "never an icon without its name" rule: allowed here only, because the names are on the cards just above it and on the results screen.
- If a card offers a perk the player already has, that perk's cell gets a 1 px outline in the card's tier colour.
- Art: the Artist mocks it for Esteban's okay. The joystick is off during level-up, so the strip may sit in the bottom third.

### 16.7 HE Rounds, Drone Buddy, Frag Out join the pool
These replace the "Mythic-only" note in §15.2. They roll tiers like every other perk, with the same odds and no caps, because uncapped builds need them to come up regularly.

| Id | Name | Effect line | Common | Rare | Epic | Mythic | Weight |
|---|---|---|---|---|---|---|---|
| `explosive` | HE ROUNDS | +{v}% explode | 10 | 15 | 20 | 30 | 1 |
| `drone` | DRONE BUDDY | +{v} drones | 1 | – | 2 | 3 | 0.6 |
| `grenade` | FRAG OUT | +{v} grenades | 1 | – | 2 | 3 | 0.6 |

- **HE Rounds:** each hit has {total}% chance to explode, 32 px radius, 50% of the hit's damage. It stops at 100% and then leaves the draw, the same as crit.
- **Drone Buddy:** each drone orbits at 28 px and fires at the nearest enemy, 5 damage twice a second. Drones are evenly spaced. Past 8 drones, each extra one adds +12.5% damage to all drones instead of a new body, for performance.
- **Frag Out:** every 4 s, throws {total} grenades at the densest enemy clusters on screen. Each does 40 damage in 48 px. Past 8 grenades per volley, extra ones add +12.5% damage instead.
- ~~Drone and grenade damage scale with HOLLOW POINTS and crit, but not with fire rate.~~ Superseded by §16.9.
- Drone and grenade are whole-number perks, so a Rare roll becomes Common (§15.2).
- **Boss HP (§16.5):** sheet DPS adds drone DPS and grenade DPS in full, and multiplies bullet DPS by (1 + 0.5 × HE chance).
- Art (Artist, needs Esteban's okay): a small explosion, a drone sprite, a grenade, and a 48 px blast. Category tiles: HE and FRAG OUT are attack, DRONE BUDDY is utility.

### 16.8 The Warlord arrives at 5:00 (Esteban, 2026-10-24)
Esteban's run 3 (win at 11:13, level 53, 96,962 boss damage) showed the build outgrowing the run by 10:00. Bringing the boss in earlier keeps the player from becoming overpowered and leaves room for more bosses later without making runs longer.

**Step 1 (now):**
- The Warlord arrives at **5:00** instead of 10:00. The arena (§14.9), phases, numbers (§14.3), enrage on a 2:00 fight clock (§14.3, §14.10), win and lose (§14.4–14.6) are unchanged.
- Timer `TARGET IN 4:59`, "TARGET INBOUND" banner and the stop on waves and rings at 4:30.
- Boss HP stays 40 × sheet DPS at spawn (§16.5). It follows the player's weaker build at 5:00 on its own, so no separate HP change.
- **Enemy timeline at half the old times**, so a 5:00 run still sees every enemy type:

| Band | Grunt | Runner | Heavy | Rifleman | Elite |
|---|---|---|---|---|---|
| 0:00–0:45 | 100 | – | – | – | – |
| 0:45–1:30 | 75 | 25 | – | – | – |
| 1:30–2:15 | 55 | 25 | 20 | – | – |
| 2:15–3:30 | 40 | 20 | 20 | 20 | – |
| 3:30–5:00 | 30 | 20 | 20 | 20 | 10 |

- Pressure waves stay every 60 s (1:00–4:00). Full rings at 2:00 and 4:00 (was 3:00, 5:00, 7:00, 9:00); Heavies join the ring from 4:00.
- Spawn rate (§6) and per-minute scaling (§12.1, HP slope 0.14) stay on the clock as they are. At 5:00 that is ~×1.7 enemy HP. The level curve (§7) is unchanged.
- **Targets (sim, then Esteban's run first):** kite-smart reaches 5:00 in 80–95% of runs at level ~20–30; kite-smart kills the boss in 40–60% of fights; fight length 60–120 s; enrage in under 10% of fights.
- **Sim table on the `feat/` PR:** reach rate, level and boss HP at spawn, kill rate and median fight per bot.
- **Levers if it's off:** boss HP multiplier (40) first, then Scrap per level, then the enemy bands.

**Step 2:** ~~parked~~ **superseded by §16.11** (three fights at 5:00, 9:00 and 13:00). Original note: three bosses per contract at 4:00, 8:00 and 12:00. The first two are lieutenants: arena fight, then the run carries on (camera unlocks, spawns resume). The Warlord is last and ends the contract.

### 16.9 Secondary shooters and special attacks (Esteban, 2026-10-24)
A standing rule for every weapon we add from here on. Each extra weapon is one of two kinds.

**Secondary shooters** (now: DRONE BUDDY; later, e.g. turrets) fire bullets just like the gun, so they take **every gun stat**:
- Damage (HOLLOW POINTS), crit (MARKSMAN) and fire rate (TRIGGER JOB). A drone fires 2 × the player's fire-rate multiplier shots per second.
- Bullet effects: HE ROUNDS explode chance, RICOCHET bounces, pierce, EXTRA BARREL extra bullets (the same spread as the gun), and HOT LOADS speed and range.
- The base stays 5 damage and 2 shots a second at 28 px orbit. Past 8 drones, the +12.5% damage per extra drone still applies.
- Drone bullets look like player bullets (pale yellow), so they share the §16.1 on-screen bullet limit. If the limit is reached, drones skip a shot before the gun does.

**Special attacks** (now: FRAG OUT; later, e.g. airstrikes or mines) run on their own **cooldown** and don't take fire rate or bullet effects:
- They do take damage (HOLLOW POINTS) and crit, so damage builds still help them.
- FRAG OUT's cooldown is 4 s (was "every 4 s"). The rest of §16.7 is unchanged.
- **New perk, FAST HANDS** (`cooldown`): "−{v}% cooldown", Common 10, Rare 15, Epic 20, Mythic 30, weight 0.6. It's offered only once the player has at least one special attack. Picks multiply: each pick sets cooldown × (1 − v). The total shown is the combined cut (two 20% picks show "−36%"). It never reaches zero, so there's no cap and it never leaves the draw. Category: utility.

**Boss HP (§16.5):** drone DPS now uses the same formula as the gun: count × 5 × damage × 2 × fire rate × (1 + 0.5 × extra bullets) × (1 + 0.5 × HE chance) × (1 + crit). Grenade DPS is count × 40 × damage × (1 + crit) ÷ cooldown.

**Sim:** the PR touches `src/data/`, so the sim table posts itself. Drones get much stronger with gun builds. If kite-smart's boss HP or fights move a lot, the first lever is drone base damage (5), not the rule.

**Art:** a FAST HANDS icon (Artist, for Esteban's okay). Drones firing multishot use the gun's spread pattern, so no new effects are needed.

### 16.10 Damage numbers (Esteban, 2026-10-24)
Looks only. Damage, crit rolls and the sim are unchanged.

**What gets a number:** every hit that deals damage to an enemy or the boss. That covers gun bullets (including ricochet and pierce hits), drone bullets, HE explosions and FRAG OUT grenades. Enemy damage to the player does not get a number (the player's hit flash stays as it is).

**Look:**
- Shown as a whole number, rounded (never 0; minimum 1). Over 9,999 shows as "10.2k".
- Spawns above the enemy's head with a small random sideways offset (±6px), pops in at 1.2× for 60ms, then rises 12px over 0.5s, fading out over the last third.
- Font: Silkscreen pixel font from a pre-built font sheet, with a 1px `#14110F` outline.
- **Normal:** white, 8px.
- **Crit:** gold `#FFC21C`, 16px (double size keeps the pixels crisp), with a "!" after the number. Approved by Esteban. It stays clear of red-orange (enemy danger), blue (rare card) and the pale-yellow `#FFE98A` bullets.
- Drawn above enemies and effects, below the HUD.

**Clutter rules:**
1. **Merge:** normal hits on the same enemy within 0.15s add into one number instead of spawning new ones. The live number updates and restarts its fade. Crits never merge; each one shows as its own number.
2. **Cap:** at most 40 numbers on screen. When full, the oldest is removed first.
3. **Boss:** the same rules, with a separate merge window of 0.25s so a boss under heavy fire shows a steady rolling total rather than a stream.
4. **Area hits:** an HE or grenade blast shows a number only on the enemy it hit hardest, so one blast doesn't spray numbers across a crowd.

**Done when:** a busy late-run fight with HE and drones stays readable in the CI screenshot, and normal and crit hits are easy to tell apart at a glance.

### 16.11 Three targets per contract (Esteban, 2026-10-24)
Esteban's win at 5:52 (level 22, 23,594 boss damage, about a 52 s fight) showed today's 5:00 fight is right as an opener. It becomes **Lieutenant 1 with no changes**, and two more fights follow. Supersedes §16.8 step 2.

**Contract clock.** The `TARGET IN` timer counts contract time, which **pauses during every boss fight** (from the warning banner to the kill). Boss times below are contract time, so there are always exactly 4:00 of waves between fights. The results screen still shows real run time (a full contract is roughly 16–18 min with fights). The spawn rate, the enemy bands and per-minute scaling (§12.1) all run on contract time.

| Contract time | Event |
|---|---|
| 5:00 | **Lieutenant 1**: today's fight (§14.3, §14.9), unchanged |
| 9:00 | **Lieutenant 2**: new fight (below) |
| 13:00 | **The Warlord**: final fight. Killing him ends the contract (§14.4) |

**Targets at a glance**
| | Lieutenant 1 | Lieutenant 2 | The Warlord |
|---|---|---|---|
| Working name (Esteban names them) | LT. HAMMER | LT. VIPER | THE WARLORD |
| Role | charger, closes distance | gunner, keeps distance | both, plus everything |
| HP (× sheet DPS at spawn, min 2000) | 40× | 50× | 60× |
| Attack damage (contact, charge, bullets) | ×1.0 (§14.3) | ×1.25 | ×1.5 |
| Enrage | own 2:00 fight clock | own 2:00 fight clock | own 2:00 fight clock |
| Art | today's Warlord sprite | new (Artist) | new, larger (Artist) |

**Lieutenant 2 (LT. VIPER), the gunner.** He holds about 160 px from the player instead of walking in (walk speed 45 px/s, backing off if the player closes in). Contact damage 25.
- **Phase 1 (100–66%), aimed burst:** a thin red-orange aim line tracks the player for 0.6 s, locks for 0.2 s, then 3 bullets fire down it (160 px/s, 12 dmg each). Every 2.5 s.
- **Phase 2 (66–33%), adds a fan:** 7 bullets in a 60° fan toward the player every 4 s (100 px/s, 12 dmg), alternating with the burst.
- **Phase 3 (<33%), adds mines and Runners:** every 6 s he drops 3 mines behind him as he backs off. A mine blinks red-orange, arms after 1 s and explodes when the player is within 30 px (25 dmg, 30 px radius) or after 10 s. 8 Runners walk in from the arena edges every 8 s, with no Scrap.
- Phase change, stagger, arena, walls and Scrap rules are the same as §14.3 and §14.9.

**The Warlord (final), both styles.** Same body rules as §14.3, but bigger (Artist's call on the canvas). Contact damage 30.
- **Phase 1:** charge (§14.3) plus the aimed burst, alternating every 3 s.
- **Phase 2:** adds the 16-bullet ring every 3 s and the fan.
- **Phase 3:** adds reinforcements every 8 s (8 Grunts and 4 Runners) and mines on each charge's start point.
- Attacks are reused from Lieutenant 1 and 2, except ARTILLERY CALL below, which is his own.

**ARTILLERY CALL (the Warlord only; Esteban, 2026-10-25).** Makes standing still punishable so the fight isn't solved by circling.
- **Phase 2:** every 7 s. **Phase 3:** every 6 s. Not in phase 1.
- He stops and plays a throw pose (raised arm) for 0.4 s, then 3 target circles appear at once (5 in phase 3): one centred on the player's position at that moment, the rest at random spots 80–140 px from the player, inside the arena walls. Circles never overlap each other or a mine.
- Each circle is 36 px across: a red-orange `#FF4A1C` ring that fills inward over 1.5 s. In the last 0.4 s a grenade sprite arcs in from the Warlord; when the fill completes it explodes over the full circle.
- **Damage:** 30 per circle (20 base × his ×1.5), once per circle; standing in two overlapping blasts can't happen since circles don't overlap. Ceramic Plates applies.
- **With the charge:** he never charges while throwing. A throw pushes his next charge back by 1.0 s, and the ARTILLERY CALL timer pauses while a charge (telegraph + dash) runs. Rings, bursts, fan, mines and reinforcements keep their own timers.
- **Art (Artist, Esteban okays):** throw pose for phases 2 and 3, the target ring, and a small thrown grenade. Explosion reuses the mine blast.
- **Tuning levers, in order:** circle count, interval, damage. Warlord fight stays inside 60–120 s (§16.11).

**Between fights**
- **On a lieutenant kill:** 0.5 s slow-mo, a "LIEUTENANT DOWN" banner for 2 s, then the hazard tape fades out over 0.5 s, the camera unlocks and waves resume. There are no spawns within 200 px of the player for the first 3 s.
- **Reward:** the lieutenant drops a Scrap pile worth exactly one level (the next level's cost), in cyan pieces that clump as in §16.3.
- The `TARGET IN` timer reappears, counting to the next fight. Each boss bar shows that boss's name.
- **Lose:** results show "TARGETS 1/3" (or 0/3, 2/3) under the title, plus "TARGET HP LEFT" for the one alive.
- **Win:** only on the Warlord kill. Results show "TARGETS 3/3".

**Waves after 5:00**
- **Spawn rate:** doubles every 2:30 until 5:00 (4/s, unchanged), then **every 5:00 after that, with a ceiling of 10/s.** That's about 7/s at 9:00, with the ceiling reached at about 11:40. Late pressure comes from the enemy mix and per-minute HP, not from enemy count. The enemy cap stays 250.
- **Enemy bands:**

| Band (contract time) | Grunt | Runner | Heavy | Rifleman | Elite |
|---|---|---|---|---|---|
| 5:00–9:00 | 25 | 20 | 20 | 20 | 15 |
| 9:00–13:00 | 20 | 20 | 20 | 20 | 20 |

- **Per-minute scaling (§12.1):** unchanged on contract time. About ×2.3 enemy HP at 9:00 and ×2.8 at 13:00. This is the second lever if waves get too easy late.
- **Pressure waves** every 60 s and **full rings** at 7:00, 8:00, 11:00 and 12:00, both stopping 30 s before each fight (8:30 and 12:30), with the "TARGET INBOUND" banner then.

**Sim targets (kite-smart; Esteban's runs come first)**
- Reaches Lieutenant 1 in 80–95% of runs, kills him in 70–85% of fights (Esteban's run says he's the opener, not a wall).
- Kills Lieutenant 2 in 55–75% of fights reached, and the Warlord in 40–60% of fights reached.
- Fight length: Lieutenant 1 **40–90 s** (the opener; Esteban's kill took about 52 s), Lieutenant 2 and the Warlord 60–120 s. Enrage in under 10% of each fight.
- Report the level and boss HP at each spawn, plus contract completion rate; no target yet.
- `tools/sim-report.ts` gets these targets in the same PR.

**Levers if it's off:** each boss's HP multiplier first (40, 50, 60), then the attack damage scale, then the spawn ceiling (10/s).

**Needs**
- **Art:** LT. VIPER sprite (walk, aim and fire poses), the Warlord's new larger sprite, a mine sprite (red-orange blink), the aim line in red-orange. Today's Warlord sprite becomes LT. HAMMER. Esteban okays the looks.
- **Data:** a `BOSSES` list in `src/data/boss.ts` (time, HP multiplier, damage scale, attack schedule per phase, name) and the post-5:00 rate and bands in `src/data/spawns.ts`.
- **Build order (can ship in parts):** (1) the contract clock, the bosses list and a two-lieutenant loop that reuses LT. HAMMER as a stand-in; (2) LT. VIPER's attacks; (3) the Warlord schedule and new art.

### 16.12 Supply crates (Esteban, 2026-10-25)
Esteban's full-contract run (18:28, level 66, 2/3 targets, the Warlord at 1%) made the mid and late game trivial: "run circles around the bosses and they melt". The cause is four perks that multiply each other and come up at every level-up: +13 bullets, 13 grenades, 4 drones and 40% HE in that run. They move out of level-ups into a separate pool that only special kills give, like BoO's sheriff chests. This supersedes the tier rows for these four in §16.7 and §8.

**Crate pool (no longer offered at level-ups):**

| Id | Name | One crate pick gives |
|---|---|---|
| `multishot` | EXTRA BARREL | +1 bullet |
| `grenade` | FRAG OUT | +1 grenade (4 s cooldown, §16.9) |
| `explosive` | HE ROUNDS | +15% explode (stops at 100%) |
| `drone` | DRONE BUDDY | +1 drone |

- No rarity tiers: every pick is the fixed step above. The past-8 overflow rules for drones and grenades stay but won't be reached in normal runs.
- §16.9 still applies: drones take every gun stat; grenades take damage and crit only.

**Where crates come from:**
- **Lieutenants:** each lieutenant kill always drops one crate, next to the Scrap pile (§16.11). The Warlord drops none, because the contract ends.
- **Elites** (the new scheduled elite, below): **every elite kill drops one crate.** Veterans never drop crates.
- **Expected count:** 8 crates by the Warlord (elites at 1:30, 3:30, LT. HAMMER, elites at 5:30, 7:30, LT. VIPER, elites at 9:30, 11:30). A full contract ends around +2 bullets, +2 drones and 30% HE, instead of +13 bullets.

**Veterans and elites (Esteban, 2026-10-25):** in the late game the old elites spawn in mass, so a crate per elite made no sense. They split into two kinds.
- **Veterans** are the old elites, renamed: the same `elite_*` variants, stats and look as §5 and §13.4 (×3 HP, ×1.1 speed, ×1.5 contact, ×4 Scrap, ×1.25 scale with a bone-white outline), the same band shares, spawning in mass. Wherever §5, §12, §13 and the band tables say "Elite", read "Veteran". **No crates.**
- **Elites** are new: one strong enemy on a schedule, **one every 2:00 of contract time starting at 1:30** (1:30, 3:30, 5:30, 7:30, 9:30, 11:30). The clock pauses during fights, so an elite never spawns inside one. It spawns off-screen like any enemy and never counts toward the enemy cap or gets replaced at it.
- An elite is a regular enemy type picked from the current band's weights (Veterans excluded), with **×20 HP** of that type at that time, **×1.5 size**, **×1.5 contact damage**, **×0.9 speed** and **15 Scrap**. An elite Rifleman fires a 5-shot burst (abilities, below).
- Look (Esteban, 2026-10-25): hand-drawn elite sprites of each base type at 1.5× size (drawn at scale 1, no bone-white rim; dark `#14110F` outline so they never read as Veterans), olive gear with the regulars' shading kept, an olive helmet with a maroon band and goggles, no radios or pouches; the Rifleman carries an LMG (looks only). Plus a **small HP bar** 20×3 px, 4 px above its head: white fill on a 1 px `#14110F` outline, shrinking from the right. Not red-orange (reserved for danger). The bar shows from spawn.
- An elite takes damage numbers with the 0.25 s merge window, like bosses (§16.10).
- **Elite abilities (Esteban, 2026-10-25):** each elite sharpens its base type's job and trades some HP for it. These override the shared values above for that type; everything lives in data.

| Elite | HP | Speed | Contact | Ability |
|---|---|---|---|---|
| Grunt | ×20 | ×0.9 | ×1.5 | **Lunge** every 4 s when within 120 px: 0.4 s telegraph (`windup` pose plus the red-orange dot used by the Rifleman's muzzle glint), then a 60 px dash over 0.25 s (`strike` pose) along the aim locked at the end of the telegraph. Contact damage applies during the dash. |
| Runner | ×12 | ×1.3 | ×1.5 | Faster than any regular enemy; walk cycle plays faster to match, no new frames. |
| Heavy | ×25 | ×0.8 | ×2 | Ignores knockback (Heavies already do). |
| Rifleman | ×20 | ×0.9 | ×1.5 | **5-shot burst** in the same 12° spread instead of 3, enemy bullets ×1.3 speed (still red-orange), and moves for ×0.75 a regular Rifleman's current move time between stops, floor 1.0 s. The 0.6 s red-orange telegraph is unchanged. |

- Sim check for the abilities PR: Lieutenant 1 kill rate must not drop more than 10 points against main for any bot. If it does, lower elite HP first.

**The crate:**
- It lands where the elite or lieutenant died and doesn't get pulled by the Scrap magnet; the player walks over it. Crates **never expire**, like Scrap (Esteban, 2026-10-25): no lifetime and no blink. Lieutenant crates use the larger starred crate sprite; elite crates use the standard one.
- Touching it pauses the game and opens a **crate screen**: the same card layout as level-ups, with **3 cards** drawn from the four crate perks, no rarity colours, and a "SUPPLY CRATE" header. Pick one. If HE is already at 100% it isn't offered; with fewer than 3 options left, show what remains.
- Crate perks show in YOUR KIT (§16.6) and on the results screen as usual.
- **Look (Artist's call):** a military crate, distinct from Scrap at a glance. Not cyan (Scrap) and not red-orange (danger). Dull brass straps, kept clear of crit gold.

**Level-up pool without the four:** damage, fire rate, pierce, move speed, max HP, magnet, crit, bullet speed and range (HOT LOADS), regen, armour, ricochet, and FAST HANDS. FAST HANDS is offered only once the player owns FRAG OUT (§16.9). Four cards per level-up (§16.2), uncapped (§16.1), same tiers and weights.

**Boss HP** still follows sheet DPS at spawn (§16.5), so the bosses scale down with the smaller builds on their own.

**Targets (Esteban's next full run comes first):**
- The late game is no longer trivial: Lieutenant 2 and the Warlord fights are inside 60–120 s and the player has to move with intent, not just circle.
- Sim: report crates opened per run and the crate perks owned at each target. Kite-smart reaching the Warlord should have opened 5–8 crates.
- If it's still trivial, the next lever is the Scrap needed per level after 5:00 (level 66 at 18:28 is still a lot of picks), then the gap between elites (2:00). **Superseded by §16.13:** it stayed trivial between the bosses, but slowing level-ups would kill progression, so we scale the waves to the player instead.

**Needs:**
- **Art:** the crate sprite (olive, dull brass straps, glint and bob, no warn frame), a larger starred lieutenant crate, and the crate-screen header.
- **Data:** a `pool: 'level' | 'crate'` field on each perk in `src/data/perks.ts`, with crate steps and the crate rules (elite first spawn 90 s, elite interval 120 s, elite HP ×20, size ×1.5, contact ×1.5, speed ×0.9, Scrap 15, cards 3); rename the `elite_*` variants to `veteran_*` in data.
- **Sim:** bots open any crate they touch and pick by their usual rule. Report elites killed and crates opened per target.
- **Code:** the elite HP bar (drawn in code, no new art).


### 16.13 Late waves scale with the player (Esteban, 2026-10-26)

Esteban's winning full-contract run (15:38, level 68, 3/3) showed the waves **between** the bosses go trivial. Before the first target (0:00–5:00) they're a real fight; from 5:00 on the build one-shots everything, so nothing survives to reach the player and the run becomes "circle and mulch" between bosses. The level-up curve is **not** the lever: progression cadence is the genre's core reward, and slowing it makes the player feel stuck. Instead the **world scales to the player after the first boss**, the way the genre's benchmarks do — Vampire Survivors multiplies enemy HP by the player's level (snapshot at spawn), Brotato layers a per-wave HP curve plus elites — both keep late enemies alive by scaling the opposition, not by throttling the player.

**Revision (Esteban, 2026-10-26):** the first cut scaled trash HP by the player's **single-target sheet DPS** (the §16.5 figure). A second playtest (15:33, level 69, 3/3) felt *easier*, not harder — because that build leaned on **RICOCHET +7** and **DRONE BUDDY +6**, and single-target sheet DPS is blind to crowd-clear (it counts ricochet as zero and multishot at half). The perks that actually trivialise a crowd didn't raise trash HP at all. So part 1 now scales off the player's **level** — the Vampire Survivors model — which rises with *every* perk, crowd-clear included, and can't be gamed by build. (The elite floor in part 2 stays on sheet DPS: an elite is a single target, where ricochet and multishot don't help, so single-target DPS is the right measure there.)

Two parts, both **only from 5:00 on** (pre-5:00 waves are unchanged; Esteban confirms they're well-tuned), both snapshot at spawn like §12.1, and **neither adds enemies, speed or density** — the threat is survivability, so the screen stays readable (§1, §12).

**Level baseline.** The player's **level at 5:00** (snapshot when the first target spawns) is the baseline. There is no jump at 5:00, and the fix touches only the levels gained after the player pulls ahead.

**1. Trash and Veterans — HP scales with level.** Every normal-wave enemy (Grunt, Runner, Heavy, Rifleman and their Veterans — not the bosses' arena adds) spawned at contract time ≥ 5:00 gets an extra HP factor on top of the §12.1 per-minute curve:

> `powerMul = max(1, 1 + hpPerLevel × (level − level at 5:00))`, with **hpPerLevel = 0.15** (starting value).

Each level gained after the first boss makes late trash ~15% tankier. Because the player's damage grows *multiplicatively* with those same levels (and far faster than +15%/level), time-to-kill still **drops** as they level — the power fantasy holds, the screen just stops being a vacuum — but a ricochet/drone build no longer gets a free pass, because every pick that earned the level counts. At `hpPerLevel = 0` this is the old behaviour; higher values make late waves bite harder. Tune from Esteban's playtest and the sim.

**2. Scheduled elites — the threat layer.** The scheduled elite (§16.12) is the readable mini-boss (HP bar, abilities). Its HP today is a fixed multiple of its base type, so late in a run it melts like everything else. From 5:00 its HP follows sheet DPS, floored at the current formula so early or weak-build elites are unchanged:

> `elite HP = max( §16.12 formula , eliteDpsSec × sheetDps(now) )`, with **eliteDpsSec = 3** (starting value).

At ~3 seconds of single-target sheet DPS — and with real fire split across the crowd, so the elite only takes a fraction of it — a late elite is a multi-second kill that forces the player to break off and handle its ability: a pressure spike every 2:00, not a speed bump.

**Scope and non-goals.**
- Pre-5:00 is untouched. Spawn rate, counts, the 250 cap, speeds and contact damage are all unchanged — this is HP only, to protect readability (§1) and the "threat per enemy, not more enemies" rule (§12).
- Boss fights are a separate problem (Esteban: the bosses themselves are "circle until dead"). That is a later pass on their attack density and dodge pressure — now §16.15 — not this change. The bosses' phase-3 adds keep today's HP.

**Levers, in order, if it's off (tune from Esteban's playtest first, then the sim):**
1. `hpPerLevel` (0.15) — the main dial for how much late trash survives.
2. `eliteDpsSec` (3) — how much of a fight each scheduled elite is.
3. Only if the gaps between elites still feel empty: tighten the elite cadence after 5:00 (§16.12's 2:00) or seed the late pressure rings (§16.11, at 7:00/8:00/11:00/12:00) with Veterans. Density stays the last resort, for readability.
4. If HP alone can't counter a pure chain build (ricochet mows through any HP), scale enemy **speed** or **contact damage** late instead, so the few that reach the player bite — not more HP (Esteban, 2026-10-26).

**Targets.**
- Waves between the bosses are no longer trivial for **any** build — crowd-clear builds (ricochet, drones, multishot) included, since level captures them: a naive kite can't stand still or circle untouched from 5:00 on, and reaches each target having spent HP.
- Progression still feels fast: trash time-to-kill keeps **dropping** as the player levels (never flat), and no level-up is slowed.
- The screen stays readable late (§1): no new bodies, just tougher ones.

**Needs:**
- **Data:** `hpPerLevel` in `src/data/enemies.ts`; the level baseline captured on the world at the first target; `powerMul` applied in the wave-spawn path (`src/sim/world.ts`). The elite floor is the part-2 sheet-DPS formula above (§16.14's move onto a contract-stage schedule was retired; see §16.15). No art.
- **Sim:** `src/data/` changes, so the sim table posts. Add to `tools/sim-report.ts` the median player HP at each target's spawn and damage taken per minute in the 5:00–13:00 window, so "waves got threatening" is visible. Bots fight the walled arena badly (§16.5), so Esteban's run is the arbiter; the sim guards against regressions (reach rate holds, idle still dies before 2:00).

### 16.14 Bosses and elites off a contract-stage schedule (RETIRED — see §16.15)

**Retired (Esteban, 2026-10-27).** This section proposed taking boss (and elite) HP off the single-target sheet-DPS coupling (§16.5) and onto a fixed contract-stage schedule `S(t) = max(1, 1 + hpPerLevel × expectedLevelPerMin × minutes past the first target)`, so a DPS build would shred bosses while a crowd-clear build ground to enrage — the idea being that the DPS-vs-CC choice would finally read off the boss fight.

It's retired because it **kept the boss a DPS check** — you win if your damage beats a clock. That's still "circle until dead" with a different number on the wall, and it decides the fight before it starts (did you take the right perks?). §16.15 reframes bosses as **skill gates** — positioning, dodging, reaction, punish timing — that any build can pass by playing well and fail by playing badly, and moves the DPS-vs-CC expression entirely into the **waves** (§16.13). Boss HP becomes a fixed, tuned number (§16.15), not a schedule.

**Kept from the exploration:** decoupling boss HP from the player's *own* level was right — coupling it would punish a fast-levelling crowd build with a tankier boss, and leveling must always be the reward (§16.13). §16.15 keeps boss HP player-independent. Elites return to the §16.13 model as wave-threat mini-bosses (not skill gates): the §16.13 part-2 sheet-DPS floor, not a schedule.

### 16.15 Bosses are skill gates, not DPS checks (Esteban, 2026-10-27)

The run's challenge splits in two: **waves test the build, bosses test the player.** Waves are where DPS-vs-crowd-clear is expressed and §16.13 keeps them honest. A boss is a **skill gate** — positioning, reading telegraphs, reaction, punish timing — that *any* build can pass by playing well and fail by playing badly, regardless of perks. This retires the scaling-lever line (§16.5, §16.14): coupling boss HP to a number made the fight "circle until dead," decided before it started. The fight should demand something the perk sheet can't give.

The benchmarks back the split. Vampire Survivors gates its one real boss (the Reaper) behind a **mechanic** — percent-HP items and freeze, not raw DPS — and is otherwise pure crowd-clear in the waves. Brotato telegraphs its difficulty spikes on a fixed schedule so you prepare and position. Neither lets you out-stat a boss you can't play.

**The core mechanic: damage is earned through a skill window, not a DPS race.** Each boss gates *when* and *how* you can hurt it, and each gates it differently:
- **Armor window** (Hammer) — armored except in a window you earn by surviving an attack.
- **Positional window** (Viper) — you can only land hits once you've out-maneuvered him.
- **Survival window** (Warlord) — hit him whenever you've survived to a safe beat; survival itself is the gate.

So a high-DPS build still has to *play the mechanic* (it can't facetank and shred), and a low-DPS build isn't walled out — it just needs more clean reps at the window. **Skill scales the kill, not perks.**

**Per-boss kits** (each an expansion of the boss's existing identity, not a new boss):

**LT. HAMMER — the brawler (dodge & punish).**
- Takes heavily **reduced** damage (~75%, *not* immune) while not charging — a guard.
- Charges **more often, with a shorter telegraph, and faster.**
- Vulnerable window: after he commits and overshoots/skids to a stop (~1 s exposed). Dodge the charge, then punish the recovery.
- Teaches patient dodge-and-punish timing. Reduced-not-immune means a weak build still chips but a player who nails every window kills fast — the fight is never a hard DPS wall.

**LT. VIPER — the sniper (approach under fire).**
- Actively **backs off and kites**, sniping from max range with his bursts and fans (§16.11).
- Drops **mines along his retreat** so you can't walk a straight line at him — promotes his phase-3 mines to his core identity.
- The "window" is positional, not a stat: **corner him.** He can't kite through a wall, so the skill is herding him into a corner through the minefield while dodging, then unloading when he's trapped.
- Teaches aggressive closing and spacing — the opposite discipline to Hammer.

**THE WARLORD — the finale (spatial survival).**
- ARTILLERY CALL (§16.11) **more frequent, bigger circles, near-full-arena coverage** — escalating area denial that funnels you through shrinking safe pockets.
- Damage is free whenever you've survived to a safe beat.
- Hard fairness rule: the pattern must **always** leave a readable, reachable safe lane (overlapping circles that leave a moving gap). If a beat has no solvable gap, it's a bug, not difficulty.
- Combines Hammer's dodge and Viper's spacing as the climax. Teaches reading an escalating pattern and route planning.

**Enrage's new job.** Today enrage (§14.3) is the "you ran out of DPS, you lose" fail state. Under skill gates the pressure is the **attack escalation** (faster charges, denser artillery), so enrage is no longer the challenge. Keep a soft enrage far out as an **anti-stall net** — it stops a no-damage build from circling forever — but the fight is decided by the dance, not the clock.

**Boss HP is a fixed, tuned number**, sized to "N clean skill windows" for a competent player of a reasonable build to kill inside the §16.11 target fight length. Not a multiple of sheet DPS (§16.5) and not a schedule (§16.14) — both retired for bosses. It stays player-independent. Waves keep §16.13; elites stay wave-threat mini-bosses (§16.13), not skill gates.

**Open question — the damage floor.** Hammer's armor window is the one place build still matters at a boss: a pure crowd-clear build with near-zero single-target damage can dodge perfectly and still barely scratch a 75%-reduced boss. Decision needed — is the floor *"any build with some single-target damage wins on skill,"* or *"a zero-single-target build genuinely can't beat Hammer, and that's the cost of going full crowd"*? The reduced-not-immune guard keeps it from being a hard wall either way; the exact reduction and Hammer's HP tune against whichever answer we pick.

**Needs:**
- **Design only for now.** Implementation is a later pass: per-boss kit changes in `src/sim/boss.ts` (Hammer guard + charge cadence, Viper retreat + mine trail, Warlord artillery density and coverage), fixed boss HP in `src/data/boss.ts` replacing §16.14's `stageMulAt`, elites reverted to the §16.13 floor, and enrage softened to an anti-stall net.
- **Sim:** bots fight the walled arena badly (§16.5) and can't demonstrate dodge skill, so the sim is a **regression guard only** (reach rates hold, idle still dies before 2:00); Esteban's playtest is the arbiter for boss feel. A later telegraph/dodge-success metric could help tune fairness.

**Playtest 2 revisions (Esteban, 2026-10-27).** First playtest of the skill-gate bosses (16:21, level 67, 3/3, a DPS-monster build: +407% damage, +318% fire rate, +100% crit). All three were trivial — the two without a damage gate (Viper, Warlord) melted before their mechanics engaged, and Hammer was a long but toothless sponge. Fixes:

- **HAMMER — more threat, less grind.** Three additions so he demands attention, not just time:
  - **Slam shockwave** (`BOSS.slam`): a full bullet ring radiating from where each charge stops. Rushing in to punish means clearing the ring first — a spacing beat on the window.
  - **Phase-3 multi-charge** (`BOSS.multiCharge`): he chains re-aimed charges, so one sidestep isn't enough; the punish window opens only after the last.
  - **Shield mobs** (`BOSS.shieldAdds`): tanky Heavies (HP × a multiplier) march in from phase 1, splitting the player's focus between the charge and the high-HP enemies (replaces his old phase-3 grunt ring; Heavies already carry shields in the art). HP trimmed (9k→7k) so the guard isn't a grind.
- **VIPER — actually evasive.** He was stopping at hold distance *inside* gun range and soaking bullets. Now: hold distance wider than the arena so he **always flees** until a wall corners him; a **much smaller hitbox** (radius 26→16); and his **mines laid midway** between him and the player (not behind him), so you cross the minefield to reach him.
- **THE WARLORD — ramped HP** (20k→45k) so a strong build can't delete him before ARTILLERY CALL (phase 2) even fires.

Still playtest-tuned, and the fixed HP tuned to a strong build raises the floor for weak ones — the skill mechanics (dodge, chase, survive) are meant to carry the fight length, with HP and the 3:00 enrage as backstops. Shield visual for Hammer's armor window (shield up = guarded, down = exposed) is still an art task; `bossVulnerable()` is exposed for it.

### 16.16 The arena as each boss's signature; VIPER in a big arena (Esteban, 2026-10-29)

Playtest of the §16.15 VIPER found the small-arena "flee-and-corner" design broken: with nowhere to run he hit a wall in seconds and got pinned, so "cornering him" collapsed into "walk up, he stops, unload." The fix reframes the **arena size as a per-boss lever**: HAMMER is a cramped room where he bullies you; VIPER is open ground where a sniper is hard to find.

**Arena scale (`Target.arenaScale`, default 1).** `lockArena` builds a box `arenaScale ×` the screen, centred where the screen-sized box would sit. The camera **follows the player, clamped to the arena rect** — and because the clamp range collapses to a point for a screen-sized box, a scale-1 arena stays frozen exactly as before (HAMMER and the Warlord are untouched). The hazard-tape walls now draw at the real arena edges relative to the camera, so in a big arena you only see a wall when you're near one. VIPER's arena is **2.6×**.

**VIPER's fight — hunt, close, break, re-hunt.**
- **Snipe from range.** He holds at a snipe distance (`holdPx` 300) and picks at the player with a **single quick aimed shot** (tracks, locks, fires — dodgeable but harder than the old slow 3-round burst); most of the time he's off-screen.
- **Tracer reveal** (the only locate tell — no arrow/minimap). Each sniper round leaves a bright fading streak (`VIPER.tracerLen`); you get shot from the dark, trace the line back, move that way.
- **Smoke break** (`VIPER.break`), v2: the break is armed when he **takes damage**; `break.sec` (2 s) later he **drops a smoke cloud and sprints very fast** (`break.speed`) to one of the three arena corners **farthest from the player**, facing the way he runs and firing nothing until he arrives (`break.dur`). The smoke + his speed + the open space mean you lose him — no teleport, no cornering. His next tracer tells you where he went. (So: find him → a few shots → he bolts → re-hunt.)

So the loop is: **tracer → hunt → close → a few shots → smoke-break → re-hunt.** The big space is the challenge, and it makes his "keep your distance" fantasy finally work.

**Mechanics / needs:**
- Camera follow + clamp in `cameraAt`; scaled rect in `lockArena`; arena-edge walls in the renderer's `drawBand`. All reduce to today's behaviour at scale 1.
- New VIPER state (`breakT`/`breakLeft`/`breakX`/`breakY`), a `smokes` effect (visual only), and a `tracer` flag on his bullets. Rendered as a fading cloud and a streak.
- Tuning levers: `arenaScale`, `holdPx`, `break.*` (range/sec/speed/dur), `smoke.*`, `tracerLen`. Start **visible-but-fast** on the break; add brief concealment in the smoke if playtests show you can still chase him down.
