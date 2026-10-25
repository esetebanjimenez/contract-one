import { DT } from '../data/sim';
import { Application, Assets, Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import { BOSS, LIEUTENANT_DOWN, VIPER } from '../data/boss';
import { JOYSTICK } from '../data/controls';
import { LEVELS } from '../data/levels';
import { NATIVE_HEIGHT, NATIVE_WIDTH } from '../data/display';
import { RUN } from '../data/run';
import { GRUNT_WEAPONS, gruntWeapon, type GruntWeapon } from '../data/enemies';
import { MERC_ART, RIFLEMAN_ART } from '../data/player';
import { enragedFor, mineArmed } from '../sim/boss';
import type { World } from '../sim/world';
import type { Controls } from '../ui/input';
import { BONE_WHITE, outlined, silhouette } from './bake';
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
const ELITE_SCALE = 1.25;

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

/** Warlord: 96x96 facing right, body centre at (27,44); A-idle-B-idle walk at 180 ms (Artist, M3). */
const WARLORD_PIVOT = { x: 27 / 96, y: 44 / 96 };
const WARLORD_WALK: ArtId[] = ['warlord_t1_walkA_00', 'warlord_t1_idle_00', 'warlord_t1_walkB_00', 'warlord_t1_idle_00'];
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
};
const DRONE_ROTOR_MS = 60;
const GRENADE_BLINK_MS = 100;
const CACHE_SCALE = 1.5; // 12 px Scrap cache from the 8 px Scrap sprite (design.md 13.4)

/** Grows a list of sprites on demand and hides the unused tail each frame. */
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
  private eliteTex = {} as Record<string, Texture>;
  private flashTex = {} as Record<string, Texture>;
  private enrageTex = {} as Record<string, Texture>;
  private ground!: TilingSprite;
  private world = new Container();
  private pickups!: Pool;
  private enemies!: Pool;
  private enemyBullets!: Pool;
  private bullets!: Pool;
  private blasts!: Pool;
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

  async load(): Promise<void> {
    const base = import.meta.env.BASE_URL;
    for (const id of ART) {
      const t = await Assets.load<Texture>(`${base}art/${id}.png`);
      t.source.scaleMode = 'nearest';
      this.tex[id] = t;
    }
    const enemyArt = new Set<ArtId>([
      ...Object.values(ENEMY_ART),
      ...Object.values(ENEMY_WALK).flatMap((a) => a.frames),
      ...Object.values(GRUNT_FRAMES).flatMap((g) => [...g.walk, g.windup, g.strike]),
    ]);
    for (const id of [...WARLORD_WALK, 'warlord_t1_windup_00', 'warlord_t1_phase2_00', 'warlord_t1_phase3_00'] as ArtId[]) {
      this.flashTex[id] = silhouette(this.tex[id], '#ffffff');
      this.enrageTex[id] = outlined(this.tex[id], ENRAGE_OUTLINE);
    }
    for (const id of enemyArt) {
      this.eliteTex[id] = outlined(this.tex[id], BONE_WHITE);
      this.flashTex[id] = silhouette(this.tex[id], '#ffffff');
    }
    this.ground = new TilingSprite({ texture: this.tex.ground_sand_00, width: NATIVE_WIDTH, height: this.viewH });
    const layers = [new Container(), new Container(), new Container(), new Container(), new Container(), new Container()];
    this.pickups = new Pool(layers[0]);
    this.enemies = new Pool(layers[1]);
    this.enemyBullets = new Pool(layers[3]);
    this.bullets = new Pool(layers[4]);
    this.blasts = new Pool(layers[5]);
    this.merc = new Sprite(this.tex.merc_t1_idle_00);
    this.merc.anchor.set(MERC_ART.bodyCenter.x / MERC_ART.size.w, MERC_ART.bodyCenter.y / MERC_ART.size.h);
    // Soft shadow under the merc so the coyote helmet separates from the sand (Artist, M2).
    this.shadow.ellipse(0, 0, MERC_ART.shadow.rx, MERC_ART.shadow.ry).fill({ color: 0x000000, alpha: MERC_ART.shadow.alpha });
    this.warlord = new Sprite(this.tex.warlord_t1_idle_00);
    this.warlord.anchor.set(WARLORD_PIVOT.x, WARLORD_PIVOT.y);
    this.warlord.visible = false;
    layers[1].addChild(this.warlord);
    layers[2].addChild(this.shadow, this.merc);
    const drones = new Container();
    const grenades = new Container();
    this.drones = new Pool(drones);
    this.grenades = new Pool(grenades);
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
  private drawBand(w: World): void {
    const a = w.arena;
    this.band.visible = !!a && !w.won;
    if (!a || w.won) return;
    const down = w.downAt >= a.lockedAt;
    this.band.alpha = down ? Math.max(0, 1 - (w.time - w.downAt) / LIEUTENANT_DOWN.tapeFadeSec) : 1;
    const k = Math.min(1, (w.time - a.lockedAt) / RUN.arenaGrowSec);
    const t = Math.max(1, Math.round(RUN.arenaBandPx * k));
    const top = RUN.arenaHudPx;
    const W = NATIVE_WIDTH;
    const H = this.viewH;
    const rects = [
      [0, top, W, t],
      [0, H - t, W, t],
      [0, top, t, H - top],
      [W - t, top, t, H - top],
    ];
    rects.forEach(([x, y, rw, rh], i) => {
      const s = this.bandTape[i];
      s.position.set(x, y);
      s.width = rw;
      s.height = rh;
    });
    this.bandLine.clear();
    if (k >= 1) this.bandLine.rect(t, top + t, W - 2 * t, H - top - 2 * t).stroke({ color: 0x14110f, width: 1, alignment: 1 });
  }

  /** LT. VIPER's mines: placeholder red-orange dots until the mine sprite lands; they blink once armed. */
  private drawMines(w: World): void {
    for (const m of w.mines) {
      const armed = mineArmed(m);
      const on = armed ? Math.floor(m.age * 6) % 2 === 0 : true;
      this.fx
        .circle(Math.round(m.x), Math.round(m.y), 4)
        .fill({ color: TELEGRAPH_COLOR, alpha: armed ? (on ? 1 : 0.45) : 0.5 })
        .stroke({ color: 0x14110f, width: 1 });
    }
  }

  private drawWarlord(w: World): void {
    this.drawMines(w);
    const b = w.boss;
    const s = this.warlord;
    s.visible = !!b && b.hp > 0;
    if (!b || b.hp <= 0) return;
    let art: ArtId;
    if (b.state === 'telegraph') art = 'warlord_t1_windup_00';
    else if (b.phase === 3) art = 'warlord_t1_phase3_00';
    else if (b.phase === 2) art = 'warlord_t1_phase2_00';
    else art = b.moving ? WARLORD_WALK[Math.floor((w.time * 1000) / WARLORD_FRAME_MS) % WARLORD_WALK.length] : 'warlord_t1_idle_00';
    const stagger = b.state === 'stagger' && Math.floor(b.stateT * 10) % 2 === 0;
    const ef = enragedFor(b, w.time);
    const pulse = ef >= 0 && Math.floor(ef / (ENRAGE_PULSE_SEC / 2)) % 2 === 0;
    const tex = b.flash > 0 || stagger ? this.flashTex[art] : pulse ? this.enrageTex[art] : this.tex[art];
    if (s.texture !== tex) s.texture = tex;
    s.position.set(Math.round(b.x), Math.round(b.y));
    s.rotation = b.facing;
    if (b.aimT >= 0) {
      // LT. VIPER's aim line: thin while it tracks, brighter and blinking once locked.
      const locked = b.aimT >= VIPER.burst.trackSec;
      const len = 320;
      const blink = Math.floor(b.aimT * 20) % 2 === 0;
      this.fx
        .moveTo(Math.round(b.x + b.aimX * BOSS.radius), Math.round(b.y + b.aimY * BOSS.radius))
        .lineTo(Math.round(b.x + b.aimX * len), Math.round(b.y + b.aimY * len))
        .stroke({ color: TELEGRAPH_COLOR, width: locked ? 2 : 1, alpha: locked ? (blink ? 0.95 : 0.6) : 0.45 });
    }
    if (b.state === 'telegraph') {
      // Locked charge lane, red-orange, from his edge to the end of the charge.
      const x0 = b.x + b.dirX * BOSS.radius;
      const y0 = b.y + b.dirY * BOSS.radius;
      const x1 = b.x + b.dirX * BOSS.charge.distance;
      const y1 = b.y + b.dirY * BOSS.charge.distance;
      const blink = Math.floor(b.stateT * 12) % 2 === 0;
      this.fx
        .moveTo(Math.round(x0), Math.round(y0))
        .lineTo(Math.round(x1), Math.round(y1))
        .stroke({ color: TELEGRAPH_COLOR, width: 3, alpha: blink ? 0.9 : 0.5 });
    }
  }

  /** Called when the screen's aspect ratio changes the visible height. */
  setViewHeight(h: number): void {
    this.viewH = h;
    if (this.ground) this.ground.height = h;
  }

  draw(w: World, controls: Controls, dtSec: number): void {
    const p = w.player;
    // The camera freezes when the boss arena locks.
    const camX = w.arena ? w.arena.camX : Math.round(p.x - NATIVE_WIDTH / 2);
    const camY = w.arena ? w.arena.camY : Math.round(p.y - this.viewH / 2);
    this.drawBand(w);
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

    this.fx.clear();
    // Cyan pop where a merged drop lands.
    for (const k of w.pickups) {
      if (k.pop <= 0) continue;
      const r = 4 + (1 - k.pop / 0.25) * 6;
      this.fx.circle(Math.round(k.x), Math.round(k.y), r).stroke({ color: 0x3fd8ff, width: 1, alpha: k.pop / 0.25 });
    }
    w.enemies.forEach((e, i) => {
      const anim = ENEMY_WALK[e.def.id];
      const art =
        e.def.id === 'grunt'
          ? gruntFrame(gruntWeapon(e.id), e.id, w.time, e.swingAt)
          : anim
            ? anim.frames[Math.floor((w.time * 1000 + e.id * 37) / anim.frameMs) % anim.frames.length]
            : ENEMY_ART[e.def.id];
      // Heavies flash white for one frame per hit; Elites carry a baked bone-white outline.
      const tex = e.flash > 0 ? this.flashTex[art] : e.elite ? this.eliteTex[art] : this.tex[art];
      const s = this.enemies.get(i, tex);
      s.position.set(Math.round(e.x), Math.round(e.y));
      const r = e.def.ranged;
      const look = PLACEHOLDER[e.def.id];
      const sc = look.scale * (e.elite ? ELITE_SCALE : 1);
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
    });
    this.enemies.hideFrom(w.enemies.length);
    this.drawWarlord(w);

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
