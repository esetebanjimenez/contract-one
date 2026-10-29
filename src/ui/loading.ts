/** Full-screen loading overlay (title + progress bar) shown while the art loads, before the menu. */
export class Loading {
  private el: HTMLDivElement;
  private fill: HTMLDivElement;

  constructor(root: HTMLElement) {
    // Appended to the host (not the frame): it covers the screen even before the frame is sized.
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="loading"><div class="ltitle">CONTRACT ONE</div>` +
        `<div class="lbar"><div class="lfill"></div></div><div class="lsub">LOADING</div></div>`,
    );
    this.el = root.querySelector('.loading')!;
    this.fill = this.el.querySelector('.lfill')!;
  }

  set(frac: number): void {
    this.fill.style.width = `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`;
  }

  done(): void {
    this.el.remove();
  }
}
