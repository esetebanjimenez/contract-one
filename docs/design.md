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
- Kills drop Scrap pickups (pure cyan; no other cyan on screen). Pickups **never despawn** (Esteban, 2026-10-24). At the 300-pickup cap, new drops fly straight to the player. Magnet 70 px; inside it, pickups fly to the player at 300 px/s.
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

**Live tuning (M2, `d74a8f2`):** HP slope 0.12, contact slope 0.03, Runner speed 95, Elite share 10% in the 7:00–10:00 band, Scrap no longer despawns. These override the starting values above; `src/data/` is the source of truth.

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
- Median level at 10:00 for kite-smart: 25–35.
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
- **HUD:** top-centre, `TARGET IN 9:59`, counting down from 10:00. White, and red-orange for the last 10 s.
- **9:30:** a banner reads "TARGET INBOUND", shown for 2 s. Pressure waves and rings stop from 9:30, so the arrival isn't buried.
- **10:00:** the timer is replaced by the boss HP bar (full width, top, with the name "THE WARLORD").

### 14.2 Boss arrival
- A 3 s warning (§9), then he walks in from the top edge, 120 px off-screen. He can't be damaged until fully on-screen.
- Normal spawns drop to 30% of the rate at 10:00, the band mix stays at 7:00–10:00, and there are no waves or rings.
- Scrap and level-ups continue during the fight.

### 14.3 Boss numbers (refines §9)
| Value | Start |
|---|---|
| HP | 2000 × (1 + 0.1 × (level − 20)), clamped 2000–5000, using the player level at arrival |
| Body | about 80 px on a 96 px canvas, hitbox radius 30 |
| Walk speed | 35 px/s toward the player |
| Contact damage | 20 (not scaled by §12) |
| Charge | every 5 s; 0.8 s telegraph line, then a 300 px dash at 140 px/s; 25 dmg |
| Phase 2 ring (below 66%) | 16 bullets every 3 s, one rotating gap of 2 bullets, 90 px/s, 10 dmg |
| Phase 3 adds (below 33%) | 12 Grunts in a ring every 8 s; ring every 2 s; charge every 3.5 s |
| Knockback | immune |
| Phase change | 1 s stagger: he can't attack, flashes white, and every enemy bullet on screen is cleared |
| Enrage | if still alive at 13:00: ring every 1.5 s, walk speed ×1.5. Every run ends. |

### 14.4 Win
On the kill: 1 s slow-mo at 0.3×, every other enemy dies with no Scrap, the banner "CONTRACT COMPLETE" shows, then 2 s later the results screen.

### 14.5 Lose
At 0 HP: a 0.5 s freeze, the banner "KIA", then the results screen. If the boss was alive, show "TARGET HP LEFT: 34%".

### 14.6 Results screen (win and lose)
- Title: CONTRACT COMPLETE or CONTRACT FAILED.
- Stats: time, level, kills, Scrap collected, and boss damage dealt.
- The list of perks taken: each shows its icon, plain-language name and total value (never an icon alone).
- One button, **New Contract**, in the bottom third (thumb reach). Input is locked for 0.8 s so a joystick release can't tap it by accident.
- No meta-progression, no menus (§2).

### 14.7 M3 tuning targets (bot sim: bots fight the boss with their usual movement)
- Kite-smart kills the boss in **40–60%** of runs that reach 10:00.
- Fight length for kite-smart: **60–120 s**.
- The enrage fires in **under 10%** of fights.
- Lever order if targets miss: boss HP base (2000), then the phase-2 ring interval, then charge damage.

### 14.8 Needs
- **Art:** the boss sprite (top-down, 96 px canvas, walk and charge pose), a telegraph line in red-orange, and the banner and results-screen look.
- **Data:** every value above goes in `src/data/boss.ts`, with the timer and banner times in `src/data/run.ts`.

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

Whole-number perks are `pierce`, `multishot`, `ricochet`, `armor`, `regen`. They have no Rare version: a Rare roll on one of them becomes Common. Each perk's max applies to the **total effect**, not the number of picks, and the excess is lost.

**Card labels and values** (name in the title bar, effect line under the icon; `{v}` is the tier value):

| Id | Name | Effect line | Common | Rare | Epic | Mythic | Max total |
|---|---|---|---|---|---|---|---|
| `dmg` | DAMAGE | +{v}% damage | 15 | 23 | 30 | 45 | +75% |
| `rof` | FIRE RATE | +{v}% fire rate | 12 | 18 | 24 | 36 | +60% |
| `pierce` | PIERCE | +{v} pierce | 1 | – | 2 | 3 | 3 |
| `multishot` | MULTISHOT | +{v} bullets | 1 | – | 2 | 3 | 3 |
| `move` | MOVE SPEED | +{v}% move speed | 8 | 12 | 16 | 24 | +32% |
| `maxhp` | MAX HP | +{v} max HP, heal | 20 | 30 | 40 | 60 | +100 |
| `magnet` | MAGNET | +{v}% magnet | 30 | 45 | 60 | 90 | +90% |
| `crit` | CRIT | +{v}% crit | 5 | 8 | 10 | 15 | 25% |
| `bspeed` | BULLET SPEED | +{v}% speed/range | 15 | 23 | 30 | 45 | +45% |
| `regen` | REGEN | +{v} HP per 2s | 1 | – | 2 | 3 | 3 |
| `armor` | ARMOR | -{v} dmg per hit | 1 | – | 2 | 3 | 3 |
| `ricochet` | RICOCHET | +{v} bounces | 1 | – | 2 | 3 | 2 |

Every name fits in 12 characters and every effect line in 16, so each stays on one line on the 104 px card (Silkscreen 8 px). "Max HP, heal" means the pick also heals by the same amount; "crit" is double damage. Use "bullet"/"bounce" when `{v}` is 1. A card for a perk that is one pick away from its max shows the value actually gained.

Tier odds by player level (Common / Rare / Epic / Mythic):
| Level | Odds |
|---|---|
| 1–5 | 70 / 25 / 5 / 0 |
| 6–15 | 55 / 30 / 12 / 3 |
| 16+ | 40 / 33 / 20 / 7 |

- The card shows the tier name, the plain-language perk name under the icon, and the scaled effect ("EPIC — DAMAGE — +30% damage"). Plain names (DAMAGE, FIRE RATE, PIERCE…) replace the flavour names in the UI. **An icon is never shown without its name**, anywhere.
- Tier colour goes on the card frame and title bar (approved: Common `#9AA0A6`, Rare `#3D6BFF`, Epic `#A44DFF`, Mythic `#FFC233` with a slow twinkle). The attack, defence and utility category stays as the coloured border on the icon tile (approved by Esteban).
- Later: `explosive`, `drone` and `grenade` can enter as Mythic-only perks.

### 15.3 Scrap persistence
- Pickups never despawn. At the 300 cap, new drops fly straight to the player.
- Balance: with no despawn and with tiers, the player gets stronger. The rerun uses the enemy HP slope as the main lever, aiming at the §12.4 targets.

### 15.4 Regen
- Reported as not working in the playtest; Programmer to check.
- New value: +1 HP every 2 s per stack, with a brief white tick on the HP bar when it heals (not green: reserved for the player).

