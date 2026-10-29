import { DT } from '../data/sim';
import { Application, Assets, Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import { BOSS, BOSSES, LIEUTENANT_DOWN, VIPER, WARLORD, type Target } from '../data/boss';
import { JOYSTICK } from '../data/controls';
import { LEVELS } from '../data/levels';
import { NATIVE_HEIGHT, NATIVE_WIDTH } from '../data/display';
import { RUN } from '../data/run';
import { ELITE, GRUNT_WEAPONS, gruntWeapon, type GruntWeapon } from '../data/enemies';
import { MERC_ART, RIFLEMAN_ART } from '../data/player';
import { bossRadius, enragedFor, mineArmed } from '../sim/boss';
import { cameraAt, type Enemy, type World } from '../sim/world';
import type { Controls } from '../ui/input';
import { BONE_WHITE, innerWhite, outlined, silhouette } from './bake';
import { bossFlashAlpha } from './boss-flash';
import { DamageNumbers } from './damage-numbers';

const ART = [
  'ground_sand_00',
  'merc_t1_idle_00',
  'merc_t1_walkA_00',
  'merc_t1_walkB_00',
  'grunt_t1_walk_00',
  'grunt_shovel_walkA_00',
  'grunt_shovel_walkB_00',
  'grunt_shovel_windup_00',
  'grunt_shovel_strike_00',
  'grunt_baton_walkA_00',
  'grunt_baton_walkB_00',
  'grunt_baton_windup_00',
  'grunt_baton_strike_00',
  'grunt_sledge_walkA_00',
  'grunt_sledge_walkB_00',
  'grunt_sledge_windup_00',
  'grunt_sledge_strike_00',
  'runner_t1_walk_00',
  'heavy_t1_walk_00',
  'heavy_t1_walkA_00',
  'heavy_t1_walkB_00',
  'runner_t1_walkA_00',
  'runner_t1_walkB_00',
  'rifleman_t1_idle_00',
  'bullet_player_00',
  'bullet_enemy_00',
  'scrap_00',
  'warlord_t1_idle_00',
  'warlord_t1_walkA_00',
  'warlord_t1_walkB_00',
  'warlord_t1_windup_00',
  'warlord_t1_phase2_00',
  'warlord_t1_phase3_00',
  'viper_t1_idle_00',
  'viper_t1_walkA_00',
  'viper_t1_walkB_00',
  'viper_t1_aim_00',
  'viper_t1_fire_00',
  'viper_t1_phase2_00',
  'viper_t1_phase3_00',
  'warlordfinal_t1_idle_00',
  'warlordfinal_t1_walkA_00',
  'warlordfinal_t1_walkB_00',
  'warlordfinal_t1_windup_00',
  'warlordfinal_t1_aim_00',
  'warlordfinal_t1_phase2_00',
  'warlordfinal_t1_phase3_00',
  'warlordfinal_t1_phase2_walkA_00',
  'warlordfinal_t1_phase2_walkB_00',
  'warlordfinal_t1_phase3_walkA_00',
  'warlordfinal_t1_phase3_walkB_00',
  'warlordfinal_t1_phase2_windup_00',
  'warlordfinal_t1_phase2_aim_00',
  'warlordfinal_t1_phase3_windup_00',
  'warlordfinal_t1_phase3_aim_00',
  'fx/mine_00',
  'grunt_elite_shovel_walkA_00',
  'grunt_elite_shovel_walkB_00',
  'grunt_elite_shovel_windup_00',
  'grunt_elite_shovel_strike_00',
  'grunt_elite_baton_walkA_00',
  'grunt_elite_baton_walkB_00',
  'grunt_elite_baton_windup_00',
  'grunt_elite_baton_strike_00',
  'grunt_elite_sledge_walkA_00',
  'grunt_elite_sledge_walkB_00',
  'grunt_elite_sledge_windup_00',
  'grunt_elite_sledge_strike_00',
  'runner_elite_t1_walk_00',
  'runner_elite_t1_walkA_00',
  'runner_elite_t1_walkB_00',
  'heavy_elite_t1_walk_00',
  'heavy_elite_t1_walkA_00',
  'heavy_elite_t1_walkB_00',
  'rifleman_elite_t1_idle_00',
  'crates/crate_t1_elite_00',
  'crates/crate_t1_elite_01',
  'crates/crate_t1_lt_00',
  'crates/crate_t1_lt_01',
  'crates/crate_t1_shadow_00',
  'crates/crate_t1_shadow_lt_00',
  'fx/mine_01',
  'fx/drone_00',
  'fx/drone_01',
  'fx/grenade_00',
  'fx/grenade_01',
  'fx/fx_he_00',
  'fx/fx_he_01',
  'fx/fx_he_02',
  'fx/fx_he_03',
  'fx/fx_he_04',
  'fx/fx_frag_00',
  'fx/fx_frag_01',
  'fx/fx_frag_02',
  'fx/fx_frag_03',
  'fx/fx_frag_04',
  'fx/fx_frag_05',
  'fx/artillery_ring_00',
  'fx/enemy_grenade_00',
  'fx/enemy_grenade_01',
  'fx/enemy_grenade_shadow_00',
  'warlordfinal_t1_phase2_throw_00',
  'warlordfinal_t1_phase3_throw_00',
] as const;
type ArtId = (typeof ART)[number];

const ENEMY_ART: Record<string, ArtId> = {
  grunt: 'grunt_t1_walk_00',
  runner: 'runner_t1_walk_00',
  heavy: 'heavy_t1_walk_00',
  rifleman: 'rifleman_t1_idle_00',
};

/** Placeholder looks until the Artist's Runner, Heavy and Elite sprites land: scale and tint of existing art. */
const PLACEHOLDER: Record<string, { scale: number; tint: number }> = {
  grunt: { scale: 1, tint: 0xffffff },
  runner: { scale: 1, tint: 0xffffff },
  heavy: { scale: 1, tint: 0xffffff },
  rifleman: { scale: 1, tint: 0xffffff },
};
const VETERAN_SCALE = 1.25;

/** Enemy walk cycles: frames played in order while alive (Artist, M2). */
const ENEMY_WALK: Record<string, { frames: ArtId[]; frameMs: number }> = {
  runner: { frames: ['runner_t1_walkA_00', 'runner_t1_walk_00', 'runner_t1_walkB_00', 'runner_t1_walk_00'], frameMs: 90 },
  heavy: { frames: ['heavy_t1_walkA_00', 'heavy_t1_walk_00', 'heavy_t1_walkB_00', 'heavy_t1_walk_00'], frameMs: 160 },
};
/**
 * Grunt weapon frames (§13.1 grunt, Esteban 2026-10-24): two walk frames, a wind-up and a strike per weapon,
 * 40x40 with the body centred (Artist, PR #11, okayed by Esteban 2026-10-24).
 */
const GRUNT_FRAMES: Record<GruntWeapon, { walk: [ArtId, ArtId]; windup: ArtId; strike: ArtId }> = {
  shovel: { walk: ['grunt_shovel_walkA_00', 'grunt_shovel_walkB_00'], windup: 'grunt_shovel_windup_00', strike: 'grunt_shovel_strike_00' },
  baton: { walk: ['grunt_baton_walkA_00', 'grunt_baton_walkB_00'], windup: 'grunt_baton_windup_00', strike: 'grunt_baton_strike_00' },
  sledge: { walk: ['grunt_sledge_walkA_00', 'grunt_sledge_walkB_00'], windup: 'grunt_sledge_windup_00', strike: 'grunt_sledge_strike_00' },
};

/** Which grunt frame shows now: the touch swing (wind-up, then strike) if one is playing, else the walk. */
export function gruntFrame(weapon: GruntWeapon, id: number, time: number, swingAt?: number): ArtId {
  const f = GRUNT_FRAMES[weapon];
  if (swingAt !== undefined) {
    const ms = (time - swingAt) * 1000;
    if (ms >= 0 && ms < GRUNT_WEAPONS.windupMs) return f.windup;
    if (ms >= 0 && ms < GRUNT_WEAPONS.windupMs + GRUNT_WEAPONS.strikeMs) return f.strike;
  }
  return f.walk[Math.floor((time * 1000 + id * 37) / GRUNT_WEAPONS.walkFrameMs) % 2];
}

/**
 * An elite's frame: the Artist's hand-drawn elite variant of the same frame, already 1.5x (PR #36, design.md 16.12).
 * The names insert `elite_` after the type, e.g. grunt_shovel_walkA_00 becomes grunt_elite_shovel_walkA_00.
 */
export function eliteArt(id: ArtId): ArtId {
  return id.replace(/^(grunt|runner|heavy|rifleman)_/, '$1_elite_') as ArtId;
}

/** The elite Grunt's lunge frame: windup through the telegraph, strike through the dash (design.md 16.12). */
export function lungeFrame(weapon: GruntWeapon, t: number): ArtId {
  return t < ELITE.lunge.telegraphSec ? GRUNT_FRAMES[weapon].windup : GRUNT_FRAMES[weapon].strike;
}

/**
 * Each target's sprite set, drawn at native size and facing right (Artist, PR #23). LT. HAMMER keeps the M3
 * warlord_t1 frames. Walks go A-idle-B-idle at 180 ms. aim shows while the aim line is up, fire during a burst.
 */
interface BossArt {
  size: number;
  pivot: { x: number; y: number };
  idle: ArtId;
  walk: ArtId[];
  windup: ArtId | null;
  aim: ArtId | null;
  fire: ArtId | null;
  phase2: ArtId;
  phase3: ArtId;
  /** Walk cycles for the phase 2 and 3 looks; a phase without one walks with the phase 1 cycle. */
  phaseWalk: Partial<Record<2 | 3, ArtId[]>>;
  /** Charge wind-up and aim frames for the phase 2 and 3 looks; a phase without one falls back to phase 1. */
  phaseWindup: Partial<Record<2 | 3, ArtId>>;
  phaseAim: Partial<Record<2 | 3, ArtId>>;
  /** ARTILLERY CALL throw pose per phase (design.md 16.11, the Warlord only). */
  phaseThrow: Partial<Record<2 | 3, ArtId>>;
}
const BOSS_ART: Record<Target['style'], BossArt> = {
  charger: {
    size: 96,
    pivot: { x: 27, y: 44 },
    idle: 'warlord_t1_idle_00',
    walk: ['warlord_t1_walkA_00', 'warlord_t1_idle_00', 'warlord_t1_walkB_00', 'warlord_t1_idle_00'],
    windup: 'warlord_t1_windup_00',
    aim: null,
    fire: null,
    phase2: 'warlord_t1_phase2_00',
    phase3: 'warlord_t1_phase3_00',
    phaseWalk: {},
    phaseWindup: {},
    phaseAim: {},
    phaseThrow: {},
  },
  gunner: {
    size: 96,
    pivot: { x: 30, y: 48 },
    idle: 'viper_t1_idle_00',
    walk: ['viper_t1_walkA_00', 'viper_t1_idle_00', 'viper_t1_walkB_00', 'viper_t1_idle_00'],
    windup: null,
    aim: 'viper_t1_aim_00',
    fire: 'viper_t1_fire_00',
    phase2: 'viper_t1_phase2_00',
    phase3: 'viper_t1_phase3_00',
    phaseWalk: {},
    phaseWindup: {},
    phaseAim: {},
    phaseThrow: {},
  },
  warlord: {
    size: 128,
    pivot: { x: 52, y: 64 },
    idle: 'warlordfinal_t1_idle_00',
    walk: ['warlordfinal_t1_walkA_00', 'warlordfinal_t1_idle_00', 'warlordfinal_t1_walkB_00', 'warlordfinal_t1_idle_00'],
    windup: 'warlordfinal_t1_windup_00',
    aim: 'warlordfinal_t1_aim_00',
    fire: 'warlordfinal_t1_aim_00',
    phase2: 'warlordfinal_t1_phase2_00',
    phase3: 'warlordfinal_t1_phase3_00',
    phaseWalk: {
      2: ['warlordfinal_t1_phase2_walkA_00', 'warlordfinal_t1_phase2_00', 'warlordfinal_t1_phase2_walkB_00', 'warlordfinal_t1_phase2_00'],
      3: ['warlordfinal_t1_phase3_walkA_00', 'warlordfinal_t1_phase3_00', 'warlordfinal_t1_phase3_walkB_00', 'warlordfinal_t1_phase3_00'],
    },
    phaseWindup: { 2: 'warlordfinal_t1_phase2_windup_00', 3: 'warlordfinal_t1_phase3_windup_00' },
    phaseAim: { 2: 'warlordfinal_t1_phase2_aim_00', 3: 'warlordfinal_t1_phase3_aim_00' },
    phaseThrow: { 2: 'warlordfinal_t1_phase2_throw_00', 3: 'warlordfinal_t1_phase3_throw_00' },
  },
};
const bossFrames = (a: BossArt): ArtId[] =>
  [
    a.idle,
    ...a.walk,
    a.windup,
    a.aim,
    a.fire,
    a.phase2,
    a.phase3,
    ...(a.phaseWalk[2] ?? []),
    ...(a.phaseWalk[3] ?? []),
    ...Object.values(a.phaseWindup),
    ...Object.values(a.phaseAim),
    ...Object.values(a.phaseThrow),
  ].filter((x): x is ArtId => x !== null);
const WARLORD_FRAME_MS = 180;
const TELEGRAPH_COLOR = 0xff4a1c;
/** Enrage tell: red-orange outline pulsing every 0.5 s (Artist, M3). */
const ENRAGE_OUTLINE = '#FF4A1C';
const ENRAGE_PULSE_SEC = 0.5;

/**
 * design.md 16.7 effects (Artist): frame times, centred on the hit or landing point, last smoke frame fades.
 * Slowed on Esteban's playtest (2026-10-24) so the blasts read: HE 0.45 s (was 0.25), frag 0.66 s (was 0.36).
 */
const BLAST_ANIM = {
  he: { frames: ['fx/fx_he_00', 'fx/fx_he_01', 'fx/fx_he_02', 'fx/fx_he_03', 'fx/fx_he_04'] as ArtId[], frameMs: 90 },
  frag: {
    frames: ['fx/fx_frag_00', 'fx/fx_frag_01', 'fx/fx_frag_02', 'fx/fx_frag_03', 'fx/fx_frag_04', 'fx/fx_frag_05'] as ArtId[],
    frameMs: 110,
  },
  // Mines and ARTILLERY CALL circles share the small HE blast (design.md 16.11: artillery reuses the mine blast).
  mine: { frames: ['fx/fx_he_00', 'fx/fx_he_01', 'fx/fx_he_02', 'fx/fx_he_03', 'fx/fx_he_04'] as ArtId[], frameMs: 90 },
};
const DRONE_ROTOR_MS = 60;
const GRENADE_BLINK_MS = 100;
const CACHE_SCALE = 1.5; // 12 px Scrap cache from the 8 px Scrap sprite (design.md 13.4)

/** Grows a list of sprites on demand and hides the unused tail each frame. */
/** Supply crate animation (Artist, design.md 16.12). */
const CRATE_ART = { glintEverySec: 2.4, glintSec: 0.12, bobSec: 1.2 };

class Pool {
  private items: Sprite[] = [];
  constructor(private readonly layer: Container) {}
  get(i: number, tex: Texture): Sprite {
    let s = this.items[i];
    if (!s) {
      s = new Sprite(tex);
      s.anchor.set(0.5);
      this.layer.addChild(s);
      this.items[i] = s;
    }
    if (s.texture !== tex) s.texture = tex;
    s.visible = true;
    return s;
  }
  hideFrom(n: number): void {
    for (let i = n; i < this.items.length; i++) this.items[i].visible = false;
  }
}

export class Renderer {
  private tex = {} as Record<ArtId, Texture>;
  private outlineTex = {} as Record<string, Texture>;
  private flashTex = {} as Record<string, Texture>;
  private enrageTex = {} as Record<string, Texture>;
  private flashInnerTex = {} as Record<string, Texture>;
  private warlordFlash!: Sprite;
  private ground!: TilingSprite;
  private world = new Container();
  private pickups!: Pool;
  private enemies!: Pool;
  private enemyBullets!: Pool;
  private bullets!: Pool;
  private blasts!: Pool;
  private mines!: Pool;
  private artilleryRings!: Pool;
  private artilleryShadows!: Pool;
  private artilleryGrenades!: Pool;
  private crates!: Pool;
  private crateShadows!: Pool;
  private drones!: Pool;
  private grenades!: Pool;
  private merc!: Sprite;
  private warlord!: Sprite;
  private shadow = new Graphics();
  private facing = 0;
  private walkMs = 0;
  private lastX = 0;
  private lastY = 0;
  private fx = new Graphics();
  private stick = new Graphics();
  private band = new Container();
  private bandTape: TilingSprite[] = [];
  private bandLine = new Graphics();
  private viewH = NATIVE_HEIGHT;
  private numbers = new DamageNumbers();

  constructor(private readonly app: Application) {}

  async load(onProgress?: (frac: number) => void): Promise<void> {
    const base = import.meta.env.BASE_URL;
    let done = 0;
    for (const id of ART) {
      const t = await Assets.load<Texture>(`${base}art/${id}.png`);
      t.source.scaleMode = 'nearest';
      this.tex[id] = t;
      onProgress?.(++done / ART.length);
    }
    onProgress?.(1);
    const enemyArt = new Set<ArtId>([
      ...Object.values(ENEMY_ART),
      ...Object.values(ENEMY_WALK).flatMap((a) => a.frames),
      ...Object.values(GRUNT_FRAMES).flatMap((g) => [...g.walk, g.windup, g.strike]),
    ]);
    for (const id of new Set(Object.values(BOSS_ART).flatMap(bossFrames))) {
      this.flashTex[id] = silhouette(this.tex[id], '#ffffff');
      this.enrageTex[id] = outlined(this.tex[id], ENRAGE_OUTLINE);
      this.flashInnerTex[id] = innerWhite(this.tex[id]);
    }
    for (const id of enemyArt) {
      this.outlineTex[id] = outlined(this.tex[id], BONE_WHITE);
      this.flashTex[id] = silhouette(this.tex[id], '#ffffff');
      const el = eliteArt(id);
      if (this.tex[el]) this.flashTex[el] = silhouette(this.tex[el], '#ffffff'); // grunt_t1_walk_00 has no elite frame
    }
    this.ground = new TilingSprite({ texture: this.tex.ground_sand_00, width: NATIVE_WIDTH, height: this.viewH });
    const layers = [new Container(), new Container(), new Container(), new Container(), new Container(), new Container()];
    this.pickups = new Pool(layers[0]);
    this.enemies = new Pool(layers[1]);
    this.enemyBullets = new Pool(layers[3]);
    this.bullets = new Pool(layers[4]);
    this.blasts = new Pool(layers[5]);
    this.mines = new Pool(layers[0]); // on the sand, under everyone
    this.artilleryRings = new Pool(layers[0]); // ARTILLERY CALL circles sit on the sand, under the units
    this.artilleryShadows = new Pool(layers[0]);
    this.crateShadows = new Pool(layers[0]);
    this.crates = new Pool(layers[0]);
    this.merc = new Sprite(this.tex.merc_t1_idle_00);
    this.merc.anchor.set(MERC_ART.bodyCenter.x / MERC_ART.size.w, MERC_ART.bodyCenter.y / MERC_ART.size.h);
    // Soft shadow under the merc so the coyote helmet separates from the sand (Artist, M2).
    this.shadow.ellipse(0, 0, MERC_ART.shadow.rx, MERC_ART.shadow.ry).fill({ color: 0x000000, alpha: MERC_ART.shadow.alpha });
    this.warlord = new Sprite(this.tex.warlord_t1_idle_00);
    this.warlord.visible = false;
    this.warlordFlash = new Sprite(this.tex.warlord_t1_idle_00);
    this.warlordFlash.visible = false;
    layers[1].addChild(this.warlord, this.warlordFlash);
    layers[2].addChild(this.shadow, this.merc);
    const drones = new Container();
    const grenades = new Container();
    this.drones = new Pool(drones);
    this.grenades = new Pool(grenades);
    this.artilleryGrenades = new Pool(grenades); // the thrown grenade arcs over everything on the ground
    // Blasts draw above enemies (Artist, 16.7); drones fly over the merc; grenades arc over everything on the ground.
    // Damage numbers sit above everything in the arena, below the HUD (design.md 16.10).
    this.world.addChild(layers[0], layers[1], this.fx, layers[5], layers[2], drones, grenades, layers[3], layers[4], this.numbers.layer);
    await this.numbers.load();
    // Hazard-tape arena edge (Artist, design.md 14.9): 4 px diagonal stripes, red-orange and dark.
    const tape = Texture.from(hazardTape());
    tape.source.scaleMode = 'nearest';
    for (let i = 0; i < 4; i++) {
      const t = new TilingSprite({ texture: tape, width: 1, height: 1 });
      this.bandTape.push(t);
      this.band.addChild(t);
    }
    this.band.addChild(this.bandLine);
    this.band.visible = false;
    this.app.stage.addChild(this.ground, this.world, this.band, this.stick);
  }

  /**
   * The band grows in from the screen edges over 0.5 s at the lock; the walls are its inner edge. After a
   * lieutenant kill it fades out over 0.5 s, then the arena releases (design.md 16.11).
   */
  private drawBand(w: World, camX: number, camY: number): void {
    const a = w.arena;
    this.band.visible = !!a && !w.won;
    if (!a || w.won) return;
    const down = w.downAt >= a.lockedAt;
    this.band.alpha = down ? Math.max(0, 1 - (w.time - w.downAt) / LIEUTENANT_DOWN.tapeFadeSec) : 1;
    const k = Math.min(1, (w.time - a.lockedAt) / RUN.arenaGrowSec);
    const t = Math.max(1, Math.round(RUN.arenaBandPx * k));
    // The tape frame, drawn just outside the arena rect in screen coords (design.md 16.16): for a big arena
    // the walls follow the camera; for a screen-sized arena they sit at the screen edge exactly as before.
    const L = Math.round(a.x0 - camX);
    const R = Math.round(a.x1 - camX);
    const T = Math.round(a.y0 - camY);
    const B = Math.round(a.y1 - camY);
    const rects = [
      [L - t, T - t, R - L + 2 * t, t], // top
      [L - t, B, R - L + 2 * t, t], // bottom
      [L - t, T - t, t, B - T + 2 * t], // left
      [R, T - t, t, B - T + 2 * t], // right
    ];
    rects.forEach(([x, y, rw, rh], i) => {
      const s = this.bandTape[i];
      s.position.set(x, y);
      s.width = rw;
      s.height = rh;
    });
    this.bandLine.clear();
    if (k >= 1) this.bandLine.rect(L, T, R - L, B - T).stroke({ color: 0x14110f, width: 1, alignment: 1 });
  }

  /** Mines (Artist, PR #23): mine_00 while arming, then blinking to mine_01 three times a second once armed. */
  private drawMines(w: World): void {
    w.mines.forEach((m, i) => {
      const blink = mineArmed(m) && Math.floor(m.age * 6) % 2 === 0;
      const s = this.mines.get(i, blink ? this.tex['fx/mine_01'] : this.tex['fx/mine_00']);
      s.position.set(Math.round(m.x), Math.round(m.y));
    });
    this.mines.hideFrom(w.mines.length);
  }

  /** Elite HP bar (design.md 16.12): 20x3 px, 4 px above the head, white fill on a 1 px #14110F outline, shrinking from the right. */
  private eliteBar(e: Enemy): void {
    const { w: bw, h: bh, abovePx } = ELITE.bar;
    const head = ELITE.headTopPx[e.def.id] ?? e.def.radius;
    const x = Math.round(e.x) - bw / 2;
    const y = Math.round(e.y) - head - abovePx - bh; // unrotated, whatever the sprite does
    this.fx.rect(x, y, bw, bh).fill({ color: 0x14110f });
    const fill = Math.ceil((bw - 2) * Math.max(0, e.hp / e.maxHp));
    if (fill > 0) this.fx.rect(x + 1, y + 1, fill, bh - 2).fill({ color: 0xffffff });
  }

  private drawWarlord(w: World): void {
    this.drawMines(w);
    const b = w.boss;
    const s = this.warlord;
    const fl = this.warlordFlash;
    s.visible = !!b && b.hp > 0;
    fl.visible = false;
    if (!b || b.hp <= 0) return;
    const set = BOSS_ART[BOSSES[b.target].style];
    let art: ArtId;
    // Wind-up and aim use the frame drawn for his current phase, else phase 1 (Esteban's run: he snapped back to full HP
    // looks before each charge).
    const ph = b.phase === 1 ? null : (b.phase as 2 | 3);
    if (b.throwT >= 0 && ph && set.phaseThrow[ph])
      art = set.phaseThrow[ph]!; // ARTILLERY CALL throw pose
    else if (b.state === 'telegraph' && set.windup) art = (ph && set.phaseWindup[ph]) || set.windup;
    else if (b.burstLeft > 0 && set.fire) art = (ph && set.phaseAim[ph] && set.fire === set.aim ? set.phaseAim[ph] : null) || set.fire;
    else if (b.aimT >= 0 && set.aim) art = (ph && set.phaseAim[ph]) || set.aim;
    else if (b.moving && b.state !== 'stagger') {
      // He walks in every phase (Esteban's run: the held phase pose read as a wobble). The phase pose shows while he
      // stands, including the stagger at each phase change, and attacks keep their own frames above.
      const walk = (b.phase > 1 && set.phaseWalk[b.phase as 2 | 3]) || set.walk;
      art = walk[Math.floor((w.time * 1000) / WARLORD_FRAME_MS) % walk.length];
    } else art = b.phase === 3 ? set.phase3 : b.phase === 2 ? set.phase2 : set.idle;
    const stagger = b.state === 'stagger' && Math.floor(b.stateT * 10) % 2 === 0;
    const ef = enragedFor(b, w.time);
    const pulse = ef >= 0 && Math.floor(ef / (ENRAGE_PULSE_SEC / 2)) % 2 === 0;
    // The stagger keeps its solid white blink; hits fade a white overlay over the sprite instead (never replacing it).
    const tex = stagger ? this.flashTex[art] : pulse ? this.enrageTex[art] : this.tex[art];
    if (s.texture !== tex) s.texture = tex;
    s.position.set(Math.round(b.x), Math.round(b.y));
    s.rotation = b.facing;
    s.anchor.set(set.pivot.x / set.size, set.pivot.y / set.size);
    const a = stagger || b.hitAt < 0 ? 0 : bossFlashAlpha(w.time - b.hitAt);
    if (a > 0) {
      const ft = this.flashInnerTex[art];
      if (fl.texture !== ft) fl.texture = ft;
      fl.visible = true;
      fl.alpha = a;
      fl.position.copyFrom(s.position);
      fl.rotation = s.rotation;
      fl.anchor.set(set.pivot.x / set.size, set.pivot.y / set.size);
    }
    const r = bossRadius(b);
    if (b.aimT >= 0) {
      // The aim line (Artist, PR #23): 1 px #FF4A1C, half alpha while it tracks, full alpha once locked.
      const locked = b.aimT >= VIPER.burst.trackSec;
      const len = 320;
      this.fx
        // Pixel centres (+0.5): a 1 px line on whole-pixel edges falls between pixels and vanishes without antialiasing.
        .moveTo(Math.round(b.x + b.aimX * r) + 0.5, Math.round(b.y + b.aimY * r) + 0.5)
        .lineTo(Math.round(b.x + b.aimX * len) + 0.5, Math.round(b.y + b.aimY * len) + 0.5)
        .stroke({ color: TELEGRAPH_COLOR, width: 1, alpha: locked ? 1 : 0.5 });
    }
    if (b.state === 'telegraph') {
      // Locked charge lane, red-orange, from his edge to the end of the charge.
      const x0 = b.x + b.dirX * r;
      const y0 = b.y + b.dirY * r;
      const x1 = b.x + b.dirX * BOSS.charge.distance;
      const y1 = b.y + b.dirY * BOSS.charge.distance;
      const blink = Math.floor(b.stateT * 12) % 2 === 0;
      this.fx
        .moveTo(Math.round(x0), Math.round(y0))
        .lineTo(Math.round(x1), Math.round(y1))
        .stroke({ color: TELEGRAPH_COLOR, width: 3, alpha: blink ? 0.9 : 0.5 });
    }
  }

  /**
   * ARTILLERY CALL circles (design.md 16.11): the ring sits on the sand, a red-orange fill closes inward
   * over 1.5 s, and a grenade arcs in from the Warlord over the last of it. The fill draws into this.fx.
   */
  /** LT. VIPER's smoke clouds (design.md 16.16): a translucent grey puff that grows and fades. */
  private drawSmokes(w: World): void {
    for (const s of w.smokes) {
      const k = Math.min(1, s.age / VIPER.smoke.fuseSec);
      const r = VIPER.smoke.radiusPx * (0.6 + 0.4 * k);
      const a = 0.55 * (1 - k);
      if (a <= 0) continue;
      const x = Math.round(s.x);
      const y = Math.round(s.y);
      this.fx.circle(x, y, r).fill({ color: 0x8b8f96, alpha: a });
      this.fx.circle(x, y, r * 0.6).fill({ color: 0xaab0b6, alpha: a * 0.8 });
    }
  }

  /** LT. VIPER's tracer streaks (design.md 16.16): a bright line trailing each sniper round — the reveal. */
  private drawTracers(w: World): void {
    for (const b of w.enemyBullets) {
      if (!b.tracer) continue;
      const sp = Math.hypot(b.vx, b.vy) || 1;
      const len = VIPER.tracerLen;
      const x0 = Math.round(b.x);
      const y0 = Math.round(b.y);
      const x1 = Math.round(b.x - (b.vx / sp) * len);
      const y1 = Math.round(b.y - (b.vy / sp) * len);
      this.fx.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: 0xffd23c, width: 2, alpha: 0.85 });
    }
  }

  private drawArtillery(w: World): void {
    const A = WARLORD.artillery;
    const b = w.boss;
    let ng = 0;
    w.artillery.forEach((c, i) => {
      const x = Math.round(c.x);
      const y = Math.round(c.y);
      const frac = Math.min(1, c.t / A.fillSec);
      this.artilleryRings.get(i, this.tex['fx/artillery_ring_00']).position.set(x, y);
      // Inward fill: a red-orange stroke from the edge (r) in to r*(1-frac), so at frac=1 the circle is full.
      const r = A.radiusPx;
      if (frac > 0) this.fx.circle(x, y, r * (1 - frac / 2)).stroke({ color: TELEGRAPH_COLOR, width: Math.max(1, r * frac), alpha: 0.5 });
      // The grenade arcs in from the Warlord over the last grenadeSec, with a small shadow on the ground.
      const gStart = A.fillSec - A.grenadeSec;
      if (b && c.t >= gStart) {
        const k = Math.min(1, (c.t - gStart) / A.grenadeSec);
        const gx = Math.round(b.x + (c.x - b.x) * k);
        const gy = Math.round(b.y + (c.y - b.y) * k);
        const lift = Math.round(Math.sin(k * Math.PI) * 24);
        this.artilleryShadows.get(ng, this.tex['fx/enemy_grenade_shadow_00']).position.set(gx, gy);
        const art: ArtId = Math.floor((c.t * 1000) / GRENADE_BLINK_MS) % 2 ? 'fx/enemy_grenade_01' : 'fx/enemy_grenade_00';
        this.artilleryGrenades.get(ng, this.tex[art]).position.set(gx, gy - lift);
        ng++;
      }
    });
    this.artilleryRings.hideFrom(w.artillery.length);
    this.artilleryShadows.hideFrom(ng);
    this.artilleryGrenades.hideFrom(ng);
  }

  /** Called when the screen's aspect ratio changes the visible height. */
  setViewHeight(h: number): void {
    this.viewH = h;
    if (this.ground) this.ground.height = h;
  }

  draw(w: World, controls: Controls, dtSec: number): void {
    const p = w.player;
    // The camera freezes when the boss arena locks.
    const cam = cameraAt(w, this.viewH);
    const camX = Math.round(cam.x);
    const camY = Math.round(cam.y);
    this.drawBand(w, camX, camY);
    this.world.position.set(-camX, -camY);
    this.ground.tilePosition.set(-camX, -camY);

    w.pickups.forEach((k, i) => {
      const s = this.pickups.get(i, this.tex.scrap_00);
      s.position.set(Math.round(k.x), Math.round(k.y));
      // Merged pieces worth 5+ use the cache look, same sprite as Elite caches.
      s.scale.set(k.cache || k.value >= 5 ? CACHE_SCALE : 1);
      s.alpha = k.age > LEVELS.pickupLifetimeSec - 3 ? (Math.floor(k.age * 8) % 2 ? 0.3 : 1) : 1;
    });
    this.pickups.hideFrom(w.pickups.length);
    // Supply crates (Artist): a still shadow, a 0/-1 px bob and a short glint; the starred crate for lieutenants.
    w.crates.forEach((c, i) => {
      const kind = c.lt ? 'lt' : 'elite';
      const x = Math.round(c.x);
      const y = Math.round(c.y);
      const h = this.tex[`crates/crate_t1_${kind}_00`].height;
      const sh = this.crateShadows.get(i, this.tex[c.lt ? 'crates/crate_t1_shadow_lt_00' : 'crates/crate_t1_shadow_00']);
      sh.position.set(x, y + Math.floor(h / 2) - 1);
      const glint = c.age % CRATE_ART.glintEverySec < CRATE_ART.glintSec;
      const s = this.crates.get(i, this.tex[`crates/crate_t1_${kind}_0${glint ? 1 : 0}`]);
      const bob = Math.floor(c.age / (CRATE_ART.bobSec / 2)) % 2 ? -1 : 0;
      s.position.set(x, y + bob);
    });
    this.crateShadows.hideFrom(w.crates.length);
    this.crates.hideFrom(w.crates.length);

    this.fx.clear();
    // Cyan pop where a merged drop lands.
    for (const k of w.pickups) {
      if (k.pop <= 0) continue;
      const r = 4 + (1 - k.pop / 0.25) * 6;
      this.fx.circle(Math.round(k.x), Math.round(k.y), r).stroke({ color: 0x3fd8ff, width: 1, alpha: k.pop / 0.25 });
    }
    w.enemies.forEach((e, i) => {
      const anim = ENEMY_WALK[e.def.id];
      // An elite Runner's walk cycle plays as much faster as it runs (design.md 16.12).
      const frameMs = anim && (e.elite ? anim.frameMs / ELITE.byType[e.def.id].speed : anim.frameMs);
      const lungeT = e.lunge ? w.time - e.lunge.at : -1;
      const base =
        e.def.id === 'grunt'
          ? lungeT >= 0
            ? lungeFrame(gruntWeapon(e.id), lungeT) // the elite Grunt's lunge: windup, then strike
            : gruntFrame(gruntWeapon(e.id), e.id, w.time, e.swingAt)
          : anim
            ? anim.frames[Math.floor((w.time * 1000 + e.id * 37) / frameMs!) % anim.frames.length]
            : ENEMY_ART[e.def.id];
      // Elites draw their own hand-drawn frames with the dark outline; Veterans carry a baked bone-white outline.
      const art = e.elite ? eliteArt(base) : base;
      const tex = e.flash > 0 ? this.flashTex[art] : e.veteran && !e.elite ? this.outlineTex[art] : this.tex[art];
      const s = this.enemies.get(i, tex);
      s.position.set(Math.round(e.x), Math.round(e.y));
      const r = e.def.ranged;
      const look = PLACEHOLDER[e.def.id];
      // Elite frames are drawn at 1.5x already, so they render at scale 1 (design.md 16.12).
      const sc = look.scale * (e.veteran && !e.elite ? VETERAN_SCALE : 1);
      s.tint = e.flash > 0 ? 0xffffff : look.tint;
      if (e.def.id === 'runner' || e.def.id === 'heavy') {
        // Top-down Runners and Heavies face right in the art and rotate toward the player, shield first.
        s.anchor.set(0.5);
        s.rotation = Math.atan2(p.y - e.y, p.x - e.x);
        s.scale.set(sc);
      } else if (r) {
        // Riflemen rotate as a whole sprite toward the player, like the merc.
        s.anchor.set(RIFLEMAN_ART.bodyCenter.x / RIFLEMAN_ART.size.w, RIFLEMAN_ART.bodyCenter.y / RIFLEMAN_ART.size.h);
        s.rotation = Math.atan2(p.y - e.y, p.x - e.x);
        s.scale.set(sc);
      } else {
        s.anchor.set(0.5);
        s.rotation = 0;
        s.scale.set(e.facing * sc, sc);
      }
      // Muzzle glint (design.md 16.4): a 3x3 #FF4A1C dot blinking every 0.15 s during the 0.6 s stop,
      // then a 1-frame white flash on the shot.
      const fired = r && e.firedAt !== undefined && w.time - e.firedAt < DT * 1.5;
      if (r && ((e.aiming && Math.floor(e.fireTimer / 0.15) % 2 === 0) || fired)) {
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        this.fx
          .rect(Math.round(e.x + Math.cos(a) * 12) - 1, Math.round(e.y + Math.sin(a) * 12) - 1, 3, 3)
          .fill({ color: fired ? 0xffffff : 0xff4a1c });
      }
      // Lunge telegraph (design.md 16.12): the same blinking red-orange dot, out in front along the held aim.
      if (e.lunge && lungeT < ELITE.lunge.telegraphSec && Math.floor(lungeT / 0.15) % 2 === 0) {
        const off = e.def.radius + 4;
        this.fx.rect(Math.round(e.x + e.lunge.ax * off) - 1, Math.round(e.y + e.lunge.ay * off) - 1, 3, 3).fill({ color: 0xff4a1c });
      }
      if (e.elite) this.eliteBar(e);
    });
    this.enemies.hideFrom(w.enemies.length);
    this.drawWarlord(w);
    this.drawArtillery(w);
    this.drawSmokes(w);
    this.drawTracers(w);

    w.enemyBullets.forEach((b, i) => this.enemyBullets.get(i, this.tex.bullet_enemy_00).position.set(Math.round(b.x), Math.round(b.y)));
    this.enemyBullets.hideFrom(w.enemyBullets.length);
    w.bullets.forEach((b, i) => this.bullets.get(i, this.tex.bullet_player_00).position.set(Math.round(b.x), Math.round(b.y)));
    this.bullets.hideFrom(w.bullets.length);

    let nb = 0;
    for (const b of w.blasts) {
      const anim = BLAST_ANIM[b.kind];
      const ms = (w.time - b.at) * 1000;
      const f = Math.floor(ms / anim.frameMs);
      if (f >= anim.frames.length) continue;
      const s = this.blasts.get(nb++, this.tex[anim.frames[f]]);
      s.position.set(Math.round(b.x), Math.round(b.y));
      s.alpha = f === anim.frames.length - 1 ? 1 - (ms - f * anim.frameMs) / anim.frameMs : 1;
    }
    this.blasts.hideFrom(nb);
    this.numbers.draw(w);
    const rotor: ArtId = Math.floor((w.time * 1000) / DRONE_ROTOR_MS) % 2 ? 'fx/drone_01' : 'fx/drone_00';
    w.drones.forEach((d, i) => {
      const s = this.drones.get(i, this.tex[rotor]);
      s.position.set(Math.round(d.x), Math.round(d.y));
      s.rotation = d.aim; // faces its target like the merc
    });
    this.drones.hideFrom(w.drones.length);
    w.grenades.forEach((g, i) => {
      const art: ArtId = Math.floor((g.t * 1000) / GRENADE_BLINK_MS) % 2 ? 'fx/grenade_01' : 'fx/grenade_00';
      this.grenades.get(i, this.tex[art]).position.set(Math.round(g.x), Math.round(g.y));
    });
    this.grenades.hideFrom(w.grenades.length);

    // Merc: whole sprite turns toward the aim target, or the move direction when nothing is targeted.
    let diff = p.facing - this.facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const maxTurn = MERC_ART.turnRadPerSec * dtSec;
    this.facing += Math.abs(diff) <= maxTurn ? diff : Math.sign(diff) * maxTurn;
    const moving = Math.hypot(p.x - this.lastX, p.y - this.lastY) > 0.01;
    this.lastX = p.x;
    this.lastY = p.y;
    this.walkMs = moving ? this.walkMs + dtSec * 1000 : 0;
    const walk = [this.tex.merc_t1_walkA_00, this.tex.merc_t1_idle_00, this.tex.merc_t1_walkB_00, this.tex.merc_t1_idle_00];
    const frame = moving ? walk[Math.floor(this.walkMs / MERC_ART.walkFrameMs) % walk.length] : this.tex.merc_t1_idle_00;
    if (this.merc.texture !== frame) this.merc.texture = frame;
    this.merc.position.set(Math.round(p.x), Math.round(p.y));
    this.shadow.position.set(Math.round(p.x), Math.round(p.y) + MERC_ART.shadow.offsetY);
    this.merc.rotation = this.facing;
    const blink = p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0;
    this.merc.alpha = blink ? 0.4 : 1;

    this.stick.clear();
    if (controls.active) {
      this.stick
        .circle(controls.originX, controls.originY, JOYSTICK.knobRadius)
        .fill({ color: 0xffffff, alpha: 0.08 })
        .stroke({ color: 0xe8e0c8, alpha: 0.35, width: 2 });
      this.stick.circle(controls.knobX, controls.knobY, 16).fill({ color: 0xe8e0c8, alpha: 0.45 });
    }
  }
}

/** 8x8 tile of 4 px diagonal stripes for the arena edge. */
function hazardTape(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 8;
  const g = c.getContext('2d')!;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      g.fillStyle = Math.floor((x + y) / 4) % 2 === 0 ? '#FF4A1C' : '#14110F';
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}
