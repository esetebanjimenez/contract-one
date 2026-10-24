import { DAMAGE_NUMBERS as DN } from '../data/damage-numbers';

/** One floating number (design.md 16.10). Effect state only: nothing in the sim reads it. */
export interface DamageNumber {
  key: number; // enemy id, or BOSS_KEY
  x: number;
  y: number;
  value: number;
  crit: boolean;
  born: number; // run time it spawned (drives the pop and rise)
  at: number; // run time of its last hit (drives the fade)
}

export const BOSS_KEY = -1;

interface Host {
  time: number;
  tick: number;
  damageNumbers: DamageNumber[];
}

/** Seconds a number stays after its last hit. */
export const DAMAGE_NUMBER_LIFE = DN.riseSec;

/** Show a hit: normal hits merge into a live number on the same target; crits always get their own. */
export function addDamageNumber(w: Host, key: number, x: number, y: number, dmg: number, crit: boolean): void {
  if (dmg <= 0) return;
  const list = w.damageNumbers;
  if (!crit) {
    const win = key === BOSS_KEY ? DN.bossMergeSec : DN.mergeSec;
    for (let i = list.length - 1; i >= 0; i--) {
      const n = list[i];
      if (n.key === key && !n.crit && w.time - n.at <= win) {
        n.value += dmg;
        n.at = w.time;
        return;
      }
    }
  }
  if (list.length >= DN.cap) {
    let oldest = 0;
    for (let i = 1; i < list.length; i++) if (list[i].at < list[oldest].at) oldest = i;
    list.splice(oldest, 1);
  }
  // Sideways offset from a hash, so the run's RNG is never touched.
  const h = Math.imul((key + 0x9e37) ^ Math.imul(w.tick + list.length, 0x85ebca6b), 0xc2b2ae35) >>> 0;
  const jitter = (h / 2 ** 32) * 2 * DN.jitterPx - DN.jitterPx;
  list.push({ key, x: x + jitter, y, value: dmg, crit, born: w.time, at: w.time });
}

export function pruneDamageNumbers(w: Host): void {
  const list = w.damageNumbers;
  if (list.some((n) => w.time - n.at > DAMAGE_NUMBER_LIFE)) w.damageNumbers = list.filter((n) => w.time - n.at <= DAMAGE_NUMBER_LIFE);
}

/** Draw state at a run time: rise offset (px, up), scale and alpha. */
export function damageNumberLook(n: DamageNumber, time: number): { rise: number; scale: number; alpha: number } {
  const age = time - n.born;
  const since = time - n.at;
  const rise = Math.round(Math.min(1, Math.max(0, age - DN.popSec) / DN.riseSec) * DN.risePx);
  const scale = age < DN.popSec ? DN.popScale : 1;
  const k = since / DAMAGE_NUMBER_LIFE;
  const alpha = k <= DN.fadeFrom ? 1 : Math.max(0, 1 - (k - DN.fadeFrom) / (1 - DN.fadeFrom));
  return { rise, scale, alpha };
}
