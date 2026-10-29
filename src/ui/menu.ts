import { BOSSES } from '../data/boss';
import type { SandboxConfig } from '../sim/world';

/** Start menu overlay (DOM, like the HUD modal): main menu, the sandbox set-up, and the quit screen. */
export interface MenuCallbacks {
  onStart: () => void;
  onSandbox: (cfg: SandboxConfig) => void;
}

const LEVEL = { min: 1, max: 80 };
const CRATES = { min: 0, max: 8 };

export class Menu {
  private el: HTMLDivElement;
  private level = 20;
  private crates = 3;
  private boss = 0;

  constructor(
    root: HTMLElement,
    private readonly cb: MenuCallbacks,
  ) {
    root.insertAdjacentHTML('beforeend', `<div class="menu" hidden></div>`);
    this.el = root.querySelector('.menu')!;
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  hide(): void {
    this.el.hidden = true;
    this.el.innerHTML = '';
  }

  showMain(): void {
    this.el.hidden = false;
    this.el.innerHTML =
      `<div class="mtitle">CONTRACT ONE</div>` +
      `<div class="mbtns">` +
      `<button class="card restart mbtn" data-act="start">START</button>` +
      `<button class="card restart mbtn" data-act="sandbox">SANDBOX</button>` +
      `<button class="card restart mbtn" data-act="quit">QUIT</button>` +
      `</div>`;
    this.el.querySelector<HTMLButtonElement>('[data-act="start"]')!.addEventListener('click', () => this.cb.onStart());
    this.el.querySelector<HTMLButtonElement>('[data-act="sandbox"]')!.addEventListener('click', () => this.showSandbox());
    this.el.querySelector<HTMLButtonElement>('[data-act="quit"]')!.addEventListener('click', () => this.showQuit());
  }

  showSandbox(): void {
    this.el.hidden = false;
    this.el.innerHTML =
      `<div class="mtitle">SANDBOX</div>` +
      `<div class="sbox">` +
      this.stepperRow('LEVEL', 'level', this.level) +
      this.stepperRow('CRATES', 'crates', this.crates) +
      `<div class="srow"><span class="slabel">BOSS</span><div class="bosspick">` +
      BOSSES.map((b, i) => `<button class="bpick${i === this.boss ? ' sel' : ''}" data-boss="${i}">${b.name}</button>`).join('') +
      `</div></div>` +
      `</div>` +
      `<div class="mbtns">` +
      `<button class="card restart mbtn" data-act="begin">BEGIN</button>` +
      `<button class="card restart mbtn ghost" data-act="back">BACK</button>` +
      `</div>`;
    this.wireStepper('level', LEVEL, (v) => (this.level = v));
    this.wireStepper('crates', CRATES, (v) => (this.crates = v));
    this.el.querySelectorAll<HTMLButtonElement>('.bpick').forEach((b) =>
      b.addEventListener('click', () => {
        this.boss = Number(b.dataset.boss);
        this.el.querySelectorAll('.bpick').forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
      }),
    );
    this.el
      .querySelector<HTMLButtonElement>('[data-act="begin"]')!
      .addEventListener('click', () => this.cb.onSandbox({ level: this.level, crates: this.crates, boss: this.boss }));
    this.el.querySelector<HTMLButtonElement>('[data-act="back"]')!.addEventListener('click', () => this.showMain());
  }

  private showQuit(): void {
    // A browser can't truly exit; try to close (works only for script-opened windows), then show a note.
    window.close();
    this.el.hidden = false;
    this.el.innerHTML =
      `<div class="mtitle">STAND DOWN</div>` +
      `<div class="qnote">Thanks for playing.<br>You can close this tab.</div>` +
      `<div class="mbtns"><button class="card restart mbtn ghost" data-act="back">BACK</button></div>`;
    this.el.querySelector<HTMLButtonElement>('[data-act="back"]')!.addEventListener('click', () => this.showMain());
  }

  private stepperRow(label: string, key: string, value: number): string {
    return (
      `<div class="srow"><span class="slabel">${label}</span>` +
      `<div class="stepper" data-key="${key}">` +
      `<button class="step" data-d="-1">−</button>` +
      `<span class="sval">${value}</span>` +
      `<button class="step" data-d="1">+</button>` +
      `</div></div>`
    );
  }

  private wireStepper(key: string, range: { min: number; max: number }, set: (v: number) => void): void {
    const box = this.el.querySelector<HTMLDivElement>(`.stepper[data-key="${key}"]`)!;
    const val = box.querySelector<HTMLSpanElement>('.sval')!;
    box.querySelectorAll<HTMLButtonElement>('.step').forEach((b) =>
      b.addEventListener('click', () => {
        const cur = Number(val.textContent);
        const next = Math.min(range.max, Math.max(range.min, cur + Number(b.dataset.d)));
        val.textContent = String(next);
        set(next);
      }),
    );
  }
}
