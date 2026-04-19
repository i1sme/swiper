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

    this._rafId      = null;
    this._lastTime   = 0;
    this._isVisible  = true;

    this._onVisibility = () => {
      this._isVisible = !document.hidden;
      if (this._isVisible) {
        this.current?.resume?.();
      } else {
        this.current?.pause?.();
      }
    };
    document.addEventListener('visibilitychange', this._onVisibility);

    this._resizeCanvas();
  }

  _resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width  = rect.width  || 360;
    this.canvas.height = rect.height || 280;
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
    document.removeEventListener('visibilitychange', this._onVisibility);
  }
}
