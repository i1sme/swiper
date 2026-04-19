const COLS = 85;
const ROWS = 105;
const D    = 0.14;     // diffusion coefficient (< 0.25 for stability)
const DECAY = 0.9992;  // per-frame ink fade

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

const inkGame = {
  name:  'ink',
  label: 'Чернила',
  icon:  '🖋️',

  init(canvas, ctx) {
    this._canvas  = canvas;
    this._ctx     = ctx;
    this._W       = canvas.width;
    this._H       = canvas.height;
    this._t       = 0;
    this._cw      = this._W / COLS;
    this._ch      = this._H / ROWS;
    this._grid    = new Float32Array(COLS * ROWS);
    this._next    = new Float32Array(COLS * ROWS);

    // Small offscreen for pixel rendering → upscaled
    this._off = document.createElement('canvas');
    this._off.width  = COLS;
    this._off.height = ROWS;
    this._xo  = this._off.getContext('2d');
    this._id  = this._xo.createImageData(COLS, ROWS);

    this._isDown = false;
    this._lastX  = -1;
    this._lastY  = -1;
    this._hasInk = false;

    this._onDown  = this._onDown.bind(this);
    this._onMove  = this._onMove.bind(this);
    this._onUp    = this._onUp.bind(this);
    canvas.addEventListener('mousedown',  this._onDown);
    canvas.addEventListener('mousemove',  this._onMove);
    canvas.addEventListener('mouseup',    this._onUp);
    canvas.addEventListener('mouseleave', this._onUp);
    canvas.addEventListener('touchstart', this._onDown, { passive: true });
    canvas.addEventListener('touchmove',  this._onMove, { passive: true });
    canvas.addEventListener('touchend',   this._onUp);
  },

  _pt(cx, cy) {
    const r = this._canvas.getBoundingClientRect();
    return {
      x: (cx - r.left) * (this._canvas.width  / r.width),
      y: (cy - r.top)  * (this._canvas.height / r.height),
    };
  },

  _addInk(cx, cy, amount) {
    const gx0 = Math.floor(cx / this._cw);
    const gy0 = Math.floor(cy / this._ch);
    const R   = 3;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const gx = gx0 + dx, gy = gy0 + dy;
        if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) continue;
        const dist = Math.sqrt(dx * dx + dy * dy) / R;
        if (dist > 1) continue;
        const w = (1 - dist) * (1 - dist);
        this._grid[gy * COLS + gx] = Math.min(1, this._grid[gy * COLS + gx] + w * amount);
      }
    }
    this._hasInk = true;
  },

  _onDown(e) {
    this._isDown = true;
    const src = e.touches ? e.touches[0] : e;
    const p   = this._pt(src.clientX, src.clientY);
    this._addInk(p.x, p.y, 1.5);
    this._lastX = p.x; this._lastY = p.y;
  },

  _onMove(e) {
    if (!this._isDown) return;
    const src = e.touches ? e.touches[0] : e;
    const p   = this._pt(src.clientX, src.clientY);
    const dx  = p.x - this._lastX, dy = p.y - this._lastY;
    const steps = Math.ceil(Math.hypot(dx, dy) / (this._cw * 0.5)) + 1;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      this._addInk(this._lastX + dx * k, this._lastY + dy * k, 0.80);
    }
    this._lastX = p.x; this._lastY = p.y;
  },

  _onUp() {
    this._isDown = false;
    this._lastX  = -1;
    this._lastY  = -1;
  },

  update(dt) {
    const s = Math.min(dt / 1000, 0.05);
    this._t += s;
    const { _W: W, _H: H, _t: t } = this;
    const ctx = this._ctx;

    const grid = this._grid, next = this._next;

    // Diffuse
    for (let gy = 0; gy < ROWS; gy++) {
      for (let gx = 0; gx < COLS; gx++) {
        const c  = grid[gy * COLS + gx];
        const l  = gx > 0         ? grid[gy * COLS + gx - 1] : c;
        const r  = gx < COLS - 1  ? grid[gy * COLS + gx + 1] : c;
        const u  = gy > 0         ? grid[(gy - 1) * COLS + gx] : c;
        const d  = gy < ROWS - 1  ? grid[(gy + 1) * COLS + gx] : c;
        next[gy * COLS + gx] = c * (1 - 4 * D) + D * (l + r + u + d);
      }
    }

    // Semi-Lagrangian advect (slow swirling flow)
    const adv = 0.85 * s * 30;
    for (let gy = 0; gy < ROWS; gy++) {
      const py = (gy + 0.5) / ROWS;
      for (let gx = 0; gx < COLS; gx++) {
        const px  = (gx + 0.5) / COLS;
        const vx  = Math.sin(py * Math.PI * 2 + t * 0.22) * adv;
        const vy  = Math.sin(px * Math.PI * 2 + t * 0.16) * adv * 0.68;
        const sx  = gx - vx, sy = gy - vy;
        const x0  = Math.floor(sx), y0 = Math.floor(sy);
        const x1  = x0 + 1, y1 = y0 + 1;
        const tx2 = sx - x0, ty2 = sy - y0;
        const X0  = clamp(x0, 0, COLS - 1), X1 = clamp(x1, 0, COLS - 1);
        const Y0  = clamp(y0, 0, ROWS - 1), Y1 = clamp(y1, 0, ROWS - 1);
        grid[gy * COLS + gx] = (
          (1 - tx2) * (1 - ty2) * next[Y0 * COLS + X0] +
               tx2  * (1 - ty2) * next[Y0 * COLS + X1] +
          (1 - tx2) *      ty2  * next[Y1 * COLS + X0] +
               tx2  *      ty2  * next[Y1 * COLS + X1]
        ) * DECAY;
      }
    }

    // Render grid → offscreen canvas (COLS×ROWS) → upscale
    const data = this._id.data;
    for (let i = 0; i < COLS * ROWS; i++) {
      const c = grid[i];
      const j = i * 4;
      data[j]     = Math.round(lerp(240, 5,  c));
      data[j + 1] = Math.round(lerp(238, 6,  c));
      data[j + 2] = Math.round(lerp(232, 35, c));
      data[j + 3] = 255;
    }
    this._xo.putImageData(this._id, 0, 0);

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(this._off, 0, 0, W, H);
    ctx.restore();

    // Subtle paper texture vignette
    const vig = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) * 0.55);
    vig.addColorStop(0,   'rgba(0,0,0,0)');
    vig.addColorStop(1,   'rgba(0,0,0,0.18)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // Hint
    if (!this._hasInk) {
      ctx.save();
      ctx.fillStyle    = 'rgba(50,70,130,0.38)';
      ctx.font         = '13px serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Проведите пальцем...', W / 2, H / 2);
      ctx.restore();
    }
  },

  handleInput() {},
  pause()  {},
  resume() {},

  destroy() {
    this._canvas.removeEventListener('mousedown',  this._onDown);
    this._canvas.removeEventListener('mousemove',  this._onMove);
    this._canvas.removeEventListener('mouseup',    this._onUp);
    this._canvas.removeEventListener('mouseleave', this._onUp);
    this._canvas.removeEventListener('touchstart', this._onDown);
    this._canvas.removeEventListener('touchmove',  this._onMove);
    this._canvas.removeEventListener('touchend',   this._onUp);
    this._grid = null;
    this._next = null;
    this._off  = null;
    this._xo   = null;
    this._id   = null;
  },
};

export default inkGame;
