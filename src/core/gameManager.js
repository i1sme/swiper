import audio from './audio.js';

const TARGET_FPS_ACTIVE = 30;
const TARGET_FPS_BACKGROUND = 10;
const FRAME_MS_ACTIVE = 1000 / TARGET_FPS_ACTIVE;
const FRAME_MS_BG     = 1000 / TARGET_FPS_BACKGROUND;

export class GameManager {
  constructor(canvas) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.games   = new Map();
    this.current = null;

    this._rafId       = null;
    this._lastTime    = 0;
    this._isVisible   = true;
    this._resizeTimer = null;

    this._onVisibility = () => {
      this._isVisible = !document.hidden;
      if (this._isVisible) {
        audio.resume();
        this.current?.resume?.();
      } else {
        audio.suspend();
        this.current?.pause?.();
      }
    };
    document.addEventListener('visibilitychange', this._onVisibility);

    // Reinitialize active game when canvas container is resized
    this._resizeObs = new ResizeObserver(() => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        const name = this.current?.name;
        if (name) this.switchTo(name);
      }, 120);
    });
    this._resizeObs.observe(canvas);

    this._resizeCanvas();
  }

  _resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width  > 0) this.canvas.width  = Math.round(rect.width);
    if (rect.height > 0) this.canvas.height = Math.round(rect.height);
  }

  register(game) {
    this.games.set(game.name, game);
  }

  switchTo(name) {
    const next = this.games.get(name);
    if (!next) return;

    if (this.current) {
      this.current.destroy();
      this._stopLoop();
    }

    this._resizeCanvas();
    this.current = next;
    this.current.init(this.canvas, this.ctx, {});
    this._startLoop();
  }

  get gameNames() {
    return [...this.games.keys()];
  }

  _startLoop() {
    this._lastTime = 0;
    const tick = (ts) => {
      this._rafId = requestAnimationFrame(tick);
      const frameMs = this._isVisible ? FRAME_MS_ACTIVE : FRAME_MS_BG;
      const dt = ts - this._lastTime;
      if (dt < frameMs) return;
      this._lastTime = ts - (dt % frameMs);
      this.current?.update(dt);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  _stopLoop() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  destroy() {
    this._stopLoop();
    this.current?.destroy();
    this._resizeObs.disconnect();
    clearTimeout(this._resizeTimer);
    document.removeEventListener('visibilitychange', this._onVisibility);
  }
}
