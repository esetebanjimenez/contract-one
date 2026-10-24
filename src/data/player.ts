/** Base merc stats (design.md section 4). Perks modify these at runtime. */
export const PLAYER = {
  hp: 100,
  speed: 90, // px/s
  invulnSec: 0.6,
  hitRadius: 7, // circle around the body, not the rifle
  targetRange: 220,
  damage: 10,
  fireRate: 3, // shots/s
  bulletSpeed: 360,
  bulletRange: 260,
  bulletRadius: 3,
  pierce: 0,
  multishotSpreadDeg: 10,
  magnet: 70, // px, pickups start flying to the player inside this radius
  collectRadius: 10,
  pickupFlySpeed: 300,
};

/** Whole-sprite rotation (design.md v0.2). The sprite faces right at 0 degrees. Pixels are on the art canvas. */
export const MERC_ART = {
  size: { w: 32, h: 32 },
  bodyCenter: { x: 7, y: 16 }, // rotation pivot and hitbox centre
  turnRadPerSec: Math.PI / 0.1, // a half turn in about 0.1 s
  walkFrameMs: 120, // walk cycle A, idle, B, idle while moving (Artist, M2)
  shadow: { rx: 10, ry: 5, offsetY: 4, alpha: 0.3 },
};

export const RIFLEMAN_ART = { size: { w: 24, h: 24 }, bodyCenter: { x: 12, y: 12 } };
