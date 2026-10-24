import { BOSS } from '../data/boss';
import { scrapForLevel } from '../data/levels';
import { RATIONS, TIERS, effectText, perkDef, type OfferId, type PerkId } from '../data/perks';
import { RUN } from '../data/run';
import { enragedFor } from '../sim/boss';
import type { World } from '../sim/world';

const mmss = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

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
    private readonly onPick: (id: OfferId) => void,
    private readonly onRestart: () => void,
  ) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="hud"><div class="bars"><div class="hpbar"><div class="fill hp"></div></div><div class="xpbar"><div class="fill xp"></div></div></div><div class="label"></div>` +
        `<div class="timer"></div><div class="bossbar" hidden><div class="fill boss"></div><div class="bname">${BOSS.name}</div></div><div class="enraged" hidden>ENRAGED</div></div>` +
        `<div class="banner" hidden></div><div class="modal" hidden></div>`,
    );
    this.bar = root.querySelector('.hud')!;
    this.hp = this.bar.querySelector('.fill.hp')!;
    this.xp = this.bar.querySelector('.fill.xp')!;
    this.label = this.bar.querySelector('.label')!;
    this.modal = root.querySelector('.modal')!;
    this.timer = this.bar.querySelector('.timer')!;
    this.bossBar = this.bar.querySelector('.bossbar')!;
    this.bossFill = this.bar.querySelector('.fill.boss')!;
    this.banner = root.querySelector('.banner')!;
    this.enraged = this.bar.querySelector('.enraged')!;
  }

  private enraged: HTMLDivElement;

  private timer: HTMLDivElement;
  private bossBar: HTMLDivElement;
  private bossFill: HTMLDivElement;
  private banner: HTMLDivElement;

  private setBanner(text: string, cls = ''): void {
    const show = text !== '';
    if (this.banner.hidden === !show && this.banner.textContent === text) return;
    this.banner.hidden = !show;
    this.banner.textContent = text;
    this.banner.className = `banner ${cls}`;
  }

  /** Contract timer before 10:00, then the Warlord's HP bar; banners for inbound, warning, win and KIA. */
  private updateContract(w: World, outroSec: number): void {
    const left = RUN.contractSec - w.time;
    const boss = w.boss;
    this.timer.hidden = left <= 0;
    if (left > 0) {
      this.timer.textContent = `TARGET IN ${mmss(Math.ceil(left))}`;
      this.timer.classList.toggle('red', left <= RUN.timerRedLastSec);
    }
    this.bossBar.hidden = left > 0 || w.won;
    this.enraged.hidden = !(boss && boss.hp > 0 && !w.won && w.phase !== 'dead' && enragedFor(boss, w.time) >= 0);
    if (left <= 0) this.bossFill.style.width = boss ? `${(100 * Math.max(0, boss.hp)) / boss.maxHp}%` : '100%';
    if (w.won) this.setBanner(outroSec < RUN.winResultsDelaySec ? 'CONTRACT COMPLETE' : '', 'win');
    else if (w.phase === 'dead')
      this.setBanner(outroSec >= RUN.loseFreezeSec && outroSec < RUN.loseFreezeSec + RUN.loseBannerSec ? 'KIA' : '', 'kia');
    else if (w.time >= RUN.inboundAtSec && w.time < RUN.inboundAtSec + RUN.inboundBannerSec) this.setBanner('TARGET INBOUND');
    else if (w.time >= RUN.contractSec && w.time < RUN.contractSec + RUN.warningSec) this.setBanner('WARNING', 'warn');
    else this.setBanner('');
  }

  /** True once the outro has played and the results screen should show. */
  static resultsDue(w: World, outroSec: number): boolean {
    if (w.won) return outroSec >= RUN.winResultsDelaySec;
    if (w.phase === 'dead') return outroSec >= RUN.loseFreezeSec + RUN.loseBannerSec;
    return false;
  }

  private lastHp = 0;

  update(w: World, outroSec = 0): void {
    this.updateContract(w, outroSec);
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
    this.label.textContent = `LV ${w.level}   ${mmss(t)}   KILLS ${w.kills}`;
    const results = Hud.resultsDue(w, outroSec);
    const key = (results ? 'results' : w.phase === 'dead' ? 'play' : w.phase) + w.offer.map((o) => o.id + o.tier).join();
    if (key === this.shownPhase) return;
    this.shownPhase = key;
    if (!results && w.phase !== 'levelup') {
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
            if (o.id === RATIONS.id) {
              // Tier-less fallback in a grey frame (design.md 15.5).
              return (
                `<button class="card tier-none" data-id="${o.id}" style="--tc:${RATIONS.color}">` +
                `<div class="tbar"></div>` +
                `<div class="tile"></div>` + // icon waits on Esteban's okay
                `<div class="pname">${RATIONS.name}</div><div class="rule"></div>` +
                `<div class="eff">${RATIONS.text.toUpperCase()}</div></button>`
              );
            }
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
        .forEach((b) => b.addEventListener('click', () => this.onPick(b.dataset.id as OfferId)));
    } else {
      this.showResults(w);
    }
  }

  private showResults(w: World): void {
    const boss = w.boss;
    const hpLeft =
      !w.won && boss && boss.hp > 0 ? `<div class="hpleft">TARGET HP LEFT: ${Math.ceil((100 * boss.hp) / boss.maxHp)}%</div>` : '';
    const stat = (k: string, v: string | number): string => `<div class="row"><span>${k}</span><span>${v}</span></div>`;
    const perks = (Object.keys(w.stacks) as PerkId[])
      .filter((id) => w.stacks[id] > 0)
      .map((id) => {
        const d = perkDef(id);
        // Icon always next to its name (design.md 15.2).
        return `<div class="perk"><img src="${ICON_BASE}perk_${id}_00.png" alt=""><span class="pn">${d.name}</span><span class="pv">${effectText(d, w.stacks[id])}</span></div>`;
      })
      .join('');
    this.modal.innerHTML =
      `<div class="results ${w.won ? 'won' : 'failed'}">` +
      `<div class="title">${w.won ? 'CONTRACT COMPLETE' : 'CONTRACT FAILED'}</div>${hpLeft}` +
      `<div class="stats">${stat('TIME', mmss(w.won ? w.wonAt : w.time))}${stat('LEVEL', w.level)}${stat('KILLS', w.kills)}` +
      `${stat('SCRAP', w.scrapCollected)}${stat('BOSS DAMAGE', Math.round(w.bossDamage))}</div>` +
      `<div class="plabel">PERKS</div><div class="perks">${perks || '<div class="none">NO PERKS</div>'}</div>` +
      `<button class="card restart newc" disabled>NEW CONTRACT</button></div>`;
    const btn = this.modal.querySelector<HTMLButtonElement>('.newc')!;
    // Locked briefly so a joystick release can't tap it by accident (design.md 14.6).
    setTimeout(() => (btn.disabled = false), RUN.resultsInputLockSec * 1000);
    btn.addEventListener('click', () => this.onRestart());
  }
}
