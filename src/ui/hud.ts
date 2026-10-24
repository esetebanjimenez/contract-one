import { scrapForLevel } from '../data/levels';
import { TIERS, effectText, perkDef, type PerkId } from '../data/perks';
import type { World } from '../sim/world';

const ICON_BASE = `${import.meta.env.BASE_URL}art/perks/`;

/** DOM overlay: top bar, perk cards and the death screen. Sized in native px via the --s CSS scale. */
export class Hud {
  private bar: HTMLDivElement;
  private hp: HTMLDivElement;
  private xp: HTMLDivElement;
  private label: HTMLDivElement;
  private modal: HTMLDivElement;
  private shownPhase = '';

  constructor(
    root: HTMLElement,
    private readonly onPick: (id: PerkId) => void,
    private readonly onRestart: () => void,
  ) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="hud"><div class="bars"><div class="hpbar"><div class="fill hp"></div></div><div class="xpbar"><div class="fill xp"></div></div></div><div class="label"></div></div><div class="modal" hidden></div>`,
    );
    this.bar = root.querySelector('.hud')!;
    this.hp = this.bar.querySelector('.fill.hp')!;
    this.xp = this.bar.querySelector('.fill.xp')!;
    this.label = this.bar.querySelector('.label')!;
    this.modal = root.querySelector('.modal')!;
  }

  private lastHp = 0;

  update(w: World): void {
    // Short white tick on the HP bar whenever HP goes up (regen, Plate Carrier).
    if (w.player.hp > this.lastHp && this.lastHp > 0) {
      this.hp.classList.remove('tick');
      void this.hp.offsetWidth;
      this.hp.classList.add('tick');
    }
    this.lastHp = w.player.hp;
    this.hp.style.width = `${(100 * w.player.hp) / w.stats.maxHp}%`;
    this.xp.style.width = `${(100 * w.scrap) / scrapForLevel(w.level)}%`;
    const t = Math.floor(w.time);
    this.label.textContent = `LV ${w.level}   ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}   KILLS ${w.kills}`;
    const key = w.phase + w.offer.map((o) => o.id + o.tier).join();
    if (key === this.shownPhase) return;
    this.shownPhase = key;
    if (w.phase === 'play') {
      this.modal.hidden = true;
      return;
    }
    this.modal.hidden = false;
    if (w.phase === 'levelup') {
      this.modal.innerHTML =
        `<div class="title">LEVEL UP</div>` +
        `<div class="cards">` +
        w.offer
          .map((o) => {
            const d = perkDef(o.id);
            const t = TIERS.find((x) => x.id === o.tier)!;
            // The icon is never shown without its name (design.md 15.2).
            return (
              `<button class="card tier-${t.id}" data-id="${o.id}" style="--tc:${t.color}">` +
              `<div class="tbar">${t.name}</div>` +
              `<div class="tile"><img src="${ICON_BASE}perk_${o.id}_00.png" alt=""></div>` +
              `<div class="pname">${d.name}</div><div class="rule"></div>` +
              `<div class="eff">${effectText(d, o.value)}</div></button>`
            );
          })
          .join('') +
        `</div>`;
      this.modal
        .querySelectorAll<HTMLButtonElement>('.card')
        .forEach((b) => b.addEventListener('click', () => this.onPick(b.dataset.id as PerkId)));
    } else {
      const t2 = Math.floor(w.time);
      this.modal.innerHTML = `<div class="title">KIA</div><div class="stats">Survived ${Math.floor(t2 / 60)}:${String(t2 % 60).padStart(2, '0')}<br>Level ${w.level}<br>Kills ${w.kills}</div><button class="card restart">REDEPLOY</button>`;
      this.modal.querySelector('.restart')!.addEventListener('click', () => this.onRestart());
    }
  }
}
