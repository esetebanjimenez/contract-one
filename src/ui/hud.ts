import { scrapForLevel } from '../data/levels';
import { PERKS, type PerkId } from '../data/perks';
import type { World } from '../sim/world';

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

  update(w: World): void {
    this.hp.style.width = `${(100 * w.player.hp) / w.stats.maxHp}%`;
    this.xp.style.width = `${(100 * w.scrap) / scrapForLevel(w.level)}%`;
    const t = Math.floor(w.time);
    this.label.textContent = `LV ${w.level}   ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}   KILLS ${w.kills}`;
    const key = w.phase + w.offer.join();
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
        w.offer
          .map((id) => {
            const d = PERKS.find((p) => p.id === id)!;
            return `<button class="card" data-id="${id}"><b>${d.name}</b><span>${d.text}</span><i>${w.stacks[id]}/${d.max}</i></button>`;
          })
          .join('');
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
