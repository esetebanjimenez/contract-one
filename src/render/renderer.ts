import { Application, Assets, Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import { JOYSTICK } from '../data/controls';
import { LEVELS } from '../data/levels';
import { NATIVE_HEIGHT, NATIVE_WIDTH } from '../data/display';
import { MERC_ART, RIFLEMAN_ART } from '../data/player';
import type { World } from '../sim/world';
import type { Controls } from '../ui/input';
import { BONE_WHITE, outlined, silhouette } from './bake';

const ART = [
  'ground_sand_00',
  'merc_t1_idle_00',
  'merc_t1_walkA_00',
  'merc_t1_walkB_00',
  'grunt_t1_walk_00',
  'runner_t1_walk_00',
  'runner_t1_walkA_00',
  'runner_t1_walkB_00',
  'rifleman_t1_idle_00',
  'bullet_player_00',
  'bullet_enemy_00',
  'scrap_00',
] as const;
type ArtId = (typeof ART)[number];

const ENEMY_ART: Record<string, ArtId> = {
  grunt: 'grunt_t1_walk_00',
  runner: 'runner_t1_walk_00',
  heavy: 'grunt_t1_walk_00',
  rifleman: 'rifleman_t1_idle_00',
};

/** Placeholder looks until the Artist's Runner, Heavy and Elite sprites land: scale and tint of existing art. */
const PLACEHOLDER: Record<string, { scale: number; tint: number }> = {
  grunt: { scale: 1, tint: 0xffffff },
  runner: { scale: 1, tint: 0xffffff },
  heavy: { scale: 1.4, tint: 0x9a9a9a },
  rifleman: { scale: 1, tint: 0xffffff },
};
const ELITE_SCALE = 1.25;

/** Enemy walk cycles: frames played in order while alive (Artist, M2). */
const ENEMY_WALK: Record<string, { frames: ArtId[]; frameMs: number }> = {
  runner: { frames: ['runner_t1_walkA_00', 'runner_t1_walk_00', 'runner_t1_walkB_00', 'runner_t1_walk_00'], frameMs: 90 },
};
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
  private ground!: TilingSprite;
  private world = new Container();
  private pickups!: Pool;
  private enemies!: Pool;
  private enemyBullets!: Pool;
  private bullets!: Pool;
  private merc!: Sprite;
  private shadow = new Graphics();
  private facing = 0;
  private walkMs = 0;
  private lastX = 0;
  private lastY = 0;
  private fx = new Graphics();
  private stick = new Graphics();

  constructor(private readonly app: Application) {}

  async load(): Promise<void> {
    const base = import.meta.env.BASE_URL;
    for (const id of ART) {
      const t = await Assets.load<Texture>(`${base}art/${id}.png`);
      t.source.scaleMode = 'nearest';
      this.tex[id] = t;
    }
    const enemyArt = new Set<ArtId>([...Object.values(ENEMY_ART), ...Object.values(ENEMY_WALK).flatMap((a) => a.frames)]);
    for (const id of enemyArt) {
      this.eliteTex[id] = outlined(this.tex[id], BONE_WHITE);
      this.flashTex[id] = silhouette(this.tex[id], '#ffffff');
    }
    this.ground = new TilingSprite({ texture: this.tex.ground_sand_00, width: NATIVE_WIDTH, height: NATIVE_HEIGHT });
    const layers = [new Container(), new Container(), new Container(), new Container(), new Container()];
    this.pickups = new Pool(layers[0]);
    this.enemies = new Pool(layers[1]);
    this.enemyBullets = new Pool(layers[3]);
    this.bullets = new Pool(layers[4]);
    this.merc = new Sprite(this.tex.merc_t1_idle_00);
    this.merc.anchor.set(MERC_ART.bodyCenter.x / MERC_ART.size.w, MERC_ART.bodyCenter.y / MERC_ART.size.h);
    // Soft shadow under the merc so the coyote helmet separates from the sand (Artist, M2).
    this.shadow.ellipse(0, 0, MERC_ART.shadow.rx, MERC_ART.shadow.ry).fill({ color: 0x000000, alpha: MERC_ART.shadow.alpha });
    layers[2].addChild(this.shadow, this.merc);
    this.world.addChild(layers[0], layers[1], this.fx, layers[2], layers[3], layers[4]);
    this.app.stage.addChild(this.ground, this.world, this.stick);
  }

  draw(w: World, controls: Controls, dtSec: number): void {
    const p = w.player;
    const camX = Math.round(p.x - NATIVE_WIDTH / 2);
    const camY = Math.round(p.y - NATIVE_HEIGHT / 2);
    this.world.position.set(-camX, -camY);
    this.ground.tilePosition.set(-camX, -camY);

    w.pickups.forEach((k, i) => {
      const s = this.pickups.get(i, this.tex.scrap_00);
      s.position.set(Math.round(k.x), Math.round(k.y));
      s.scale.set(k.cache ? CACHE_SCALE : 1);
      s.alpha = k.age > LEVELS.pickupLifetimeSec - 3 ? (Math.floor(k.age * 8) % 2 ? 0.3 : 1) : 1;
    });
    this.pickups.hideFrom(w.pickups.length);

    this.fx.clear();
    w.enemies.forEach((e, i) => {
      const anim = ENEMY_WALK[e.def.id];
      const art = anim ? anim.frames[Math.floor((w.time * 1000 + e.id * 37) / anim.frameMs) % anim.frames.length] : ENEMY_ART[e.def.id];
      // Heavies flash white for one frame per hit; Elites carry a baked bone-white outline.
      const tex = e.flash > 0 ? this.flashTex[art] : e.elite ? this.eliteTex[art] : this.tex[art];
      const s = this.enemies.get(i, tex);
      s.position.set(Math.round(e.x), Math.round(e.y));
      const r = e.def.ranged;
      const look = PLACEHOLDER[e.def.id];
      const sc = look.scale * (e.elite ? ELITE_SCALE : 1);
      s.tint = e.flash > 0 ? 0xffffff : look.tint;
      if (e.def.id === 'runner') {
        // Top-down Runners face right in the art and rotate toward the player they charge.
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
      if (r && e.fireTimer <= r.telegraphSec) {
        // 0.3 s muzzle-flash telegraph before each Rifleman shot.
        this.fx
          .circle(
            Math.round(e.x + Math.cos(Math.atan2(p.y - e.y, p.x - e.x)) * 12),
            Math.round(e.y + Math.sin(Math.atan2(p.y - e.y, p.x - e.x)) * 12),
            3,
          )
          .fill({ color: 0xff6a2a, alpha: 0.9 });
      }
    });
    this.enemies.hideFrom(w.enemies.length);

    w.enemyBullets.forEach((b, i) => this.enemyBullets.get(i, this.tex.bullet_enemy_00).position.set(Math.round(b.x), Math.round(b.y)));
    this.enemyBullets.hideFrom(w.enemyBullets.length);
    w.bullets.forEach((b, i) => this.bullets.get(i, this.tex.bullet_player_00).position.set(Math.round(b.x), Math.round(b.y)));
    this.bullets.hideFrom(w.bullets.length);

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
