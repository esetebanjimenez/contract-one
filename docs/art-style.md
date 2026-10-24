# Contract One: Art Style

Reference: Esteban's top-down arena shot (dense pixel art, thick dark outlines, opaque bright FX).
Concept v1: `docs/art/concept_v1.jpg` (mock, not final).

## Look
- True top-down view, characters seen from above (head and shoulders dominate the silhouette).
- Pixel art, 1px near-black outline (`#14110F`) on every sprite, 2-3 flat tones per material, no gradients, no anti-aliasing.
- FX (splatter, muzzle flash, hits) are bright, opaque, few frames.

## Resolution and scale
- Native canvas 360x640 (portrait 9:16), integer upscale, nearest-neighbour filtering (`roundPixels`, `scaleMode: 'nearest'`).
- Sprite sizes (native px): player 24x24, Grunt 20x20, Runner 16x16, Rifleman 24x24, Heavy 32x32, Elite = base +25%, boss 64-96.
- Bullets: player 4x4 (+3px tracer), enemy 5x5. Scrap pickup 8x8. Ground tile 64x64 seamless.
- All sprites face right (angle 0); the renderer rotates them toward movement or aim.

## Palette
| Role | Colours |
| --- | --- |
| Player merc | tan `#B89B6A`, khaki `#7D7048`, gunmetal `#4A4E52`, accent orange `#E8792B` (one accent per merc) |
| Enemies | charcoal `#2E3033`, slate `#55595E`, maroon trim `#5C1F2A`, skin `#C9A07E` |
| Ground | sand `#B08A55`, dark sand `#8C6B3E`, pebble `#6F6258` |
| Player bullet | pale yellow `#FFE98A`, core `#FFFFFF` |
| Enemy bullet | red-orange `#FF4A1C`, dark core `#7A1405` |
| Scrap | cyan-green `#40E0FF (shadow #1480AA)`, shade `#1F8C6E`, glint `#FFFFFF` |
| Outline | `#14110F` |

## Readability rules
1. Enemy-bullet red-orange and Scrap cyan-green are reserved: nothing else (bodies, ground, UI) uses them.
2. Player-bullet pale yellow is reserved for player shots and muzzle flash.
3. Enemies must read darker than the ground; the player reads lighter and warmer than enemies.
4. Elites keep the base silhouette, larger, with a maroon glow outline.

## M1-M2 asset list
| Asset | Frames | Size |
| --- | --- | --- |
| Player merc | idle, walk x2, hit, death | 24 |
| Grunt (melee) | walk x2, death | 20 |
| Runner | walk x2, death | 16 |
| Rifleman | walk x2, aim/fire, death | 24 |
| Heavy | walk x2, death | 32 |
| Player bullet, enemy bullet | 1 each | 4 / 5 |
| Muzzle flash, hit spark, splatter decal | 2 / 2 / 3 variants | 8-16 |
| Scrap pickup | 2 (glint) | 8 |
| Ground tile + 4 scatter props | 1 + 4 | 64 / 8-16 |
| UI: joystick base + knob, XP bar, perk card frame, 6 perk icons | - | 16-48 |

Naming: `public/art/<name>_<state>_<nn>.png`, transparent PNG, native size.
