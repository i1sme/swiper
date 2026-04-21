const COLS = 9;
const ROWS = 7;
const BUBBLE_R = 16;
const PAD_X = 20;
const PAD_Y = 16;
const MAX_POPS = 64;
const REFILL_DELAY = 900;

function makeBubble() {
  return { popped: false, popT: 0, refilling: false, refillT: 0 };
}

function makePop(x, y) {
  return { active: false, x, y, t: 0 };
}

const bubblesGame = {
  name: 'bubbles',
  label: 'Пузыри',
  icon:  '🫧',

  init(canvas, ctx) {
    this._canvas = canvas;
    this._ctx    = ctx;

    this._grid = Array.from({ length: ROWS * COLS }, () => makeBubble());
    this._pops = Array.from({ length: MAX_POPS }, () => makePop(0, 0));

    this._cellW = (canvas.width  - PAD_X * 2) / COLS;
    this._cellH = (canvas.height - PAD_Y * 2) / ROWS;
    this._hoverIdx    = -1;
    this._refillTimer = -1;
    this._pressing    = false;

    this._onDown      = this._onDown.bind(this);
    this._onUp        = this._onUp.bind(this);
    this._onTouch     = this._onTouch.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseLeave = this._onMouseLeave.bind(this);

    canvas.addEventListener('mousedown',  this._onDown);
    canvas.addEventListener('mouseup',    this._onUp);
    canvas.addEventListener('touchstart', this._onTouch,     { passive: true });
    canvas.addEventListener('touchmove',  this._onTouch,     { passive: true });
    canvas.addEventListener('mousemove',  this._onMouseMove);
    canvas.addEventListener('mouseleave', this._onMouseLeave);
  },

  _getCell(px, py) {
    const col = Math.floor((px - PAD_X) / this._cellW);
    const row = Math.floor((py - PAD_Y) / this._cellH);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return -1;
    return row * COLS + col;
  },

  _cellCenter(idx) {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    return {
      x: PAD_X + col * this._cellW + this._cellW / 2,
      y: PAD_Y + row * this._cellH + this._cellH / 2,
    };
  },

  _spawnPop(x, y) {
    const p = this._pops.find(p => !p.active);
    if (!p) return;
    p.active = true; p.x = x; p.y = y; p.t = 0;
  },

  _onDown(e) {
    this._pressing = true;
    const rect = this._canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (this._canvas.width  / rect.width);
    const py = (e.clientY - rect.top)  * (this._canvas.height / rect.height);
    this._tryPop(px, py);
  },

  _onUp() { this._pressing = false; },

  _onTouch(e) {
    const rect = this._canvas.getBoundingClientRect();
    const sx = this._canvas.width  / rect.width;
    const sy = this._canvas.height / rect.height;
    for (const t of e.changedTouches) {
      this._tryPop((t.clientX - rect.left) * sx, (t.clientY - rect.top) * sy);
    }
  },

  _onMouseMove(e) {
    const rect = this._canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (this._canvas.width  / rect.width);
    const py = (e.clientY - rect.top)  * (this._canvas.height / rect.height);
    const idx = this._getCell(px, py);
    this._hoverIdx = (idx >= 0 && !this._grid[idx].popped && !this._grid[idx].refilling) ? idx : -1;
    this._canvas.style.cursor = this._hoverIdx >= 0 ? 'pointer' : 'default';
    if (this._pressing) this._tryPop(px, py);
  },

  _onMouseLeave() {
    this._pressing = false;
    this._hoverIdx = -1;
    this._canvas.style.cursor = 'default';
  },

  _tryPop(px, py) {
    const idx = this._getCell(px, py);
    if (idx < 0) return;
    const b = this._grid[idx];
    if (b.popped || b.refilling) return;
    b.popped = true;
    b.popT   = 0;
    const c = this._cellCenter(idx);
    this._spawnPop(c.x, c.y);

    if (this._grid.every(b => b.popped)) {
      this._refillTimer = REFILL_DELAY;
    }
  },

  handleInput() {},
  pause() {},
  resume() {},

  update(dt) {
    const ctx = this._ctx;
    const W = this._canvas.width;
    const H = this._canvas.height;

    if (this._refillTimer > 0) {
      this._refillTimer -= dt;
      if (this._refillTimer <= 0) {
        this._refillTimer = -1;
        for (let i = 0; i < this._grid.length; i++) {
          const b = this._grid[i];
          b.popped    = false;
          b.popT      = 0;
          b.refilling = true;
          // Волновая задержка: сначала левый верх, потом правый низ
          b.refillT   = -((i % COLS) * 0.04 + Math.floor(i / COLS) * 0.055);
        }
      }
    }

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#13131f';
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < this._grid.length; i++) {
      const b = this._grid[i];
      const c = this._cellCenter(i);

      if (b.refilling) {
        b.refillT = Math.min(1, b.refillT + dt / 200);
        if (b.refillT < 0) continue;
        if (b.refillT >= 1) b.refilling = false;
        this._drawBubble(ctx, c.x, c.y, false, b.refillT);
      } else if (b.popped) {
        if (b.popT < 1) b.popT = Math.min(1, b.popT + dt / 200);
        this._drawPopped(ctx, c.x, c.y, b.popT);
      } else {
        this._drawBubble(ctx, c.x, c.y, i === this._hoverIdx, 1);
      }
    }

    for (const p of this._pops) {
      if (!p.active) continue;
      p.t += dt / 350;
      if (p.t >= 1) { p.active = false; continue; }
      this._drawPopAnim(ctx, p.x, p.y, p.t);
    }
  },

  _drawBubble(ctx, x, y, isHovered, scaleT) {
    const r = BUBBLE_R;
    const s = scaleT !== undefined ? scaleT : (isHovered ? 1.1 : 1.0);

    ctx.save();
    if (s !== 1.0) {
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.translate(-x, -y);
    }

    ctx.shadowColor = isHovered ? 'rgba(160,210,255,0.7)' : 'rgba(100,160,255,0.18)';
    ctx.shadowBlur  = isHovered ? 18 : 8;

    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r);
    grad.addColorStop(0,   'rgba(180,210,255,0.55)');
    grad.addColorStop(0.5, 'rgba(120,170,240,0.3)');
    grad.addColorStop(1,   'rgba(80,120,200,0.15)');

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = isHovered ? 'rgba(180,220,255,0.75)' : 'rgba(160,200,255,0.45)';
    ctx.lineWidth   = 1.2;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    if (s !== 1.0) {
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.translate(-x, -y);
    }
    ctx.beginPath();
    ctx.ellipse(x - r * 0.28, y - r * 0.32, r * 0.22, r * 0.12, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
    ctx.restore();
  },

  _drawPopped(ctx, x, y, t) {
    const r = BUBBLE_R;
    ctx.save();
    ctx.globalAlpha = 0.18 * (1 - t);
    ctx.beginPath();
    ctx.arc(x, y, r * (0.7 + t * 0.3), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(160,200,255,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  },

  _drawPopAnim(ctx, x, y, t) {
    const count = 8;
    const maxR  = BUBBLE_R * 1.8;
    ctx.save();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist  = maxR * t;
      const px    = x + Math.cos(angle) * dist;
      const py    = y + Math.sin(angle) * dist;
      const pr    = (1 - t) * (i % 2 === 0 ? 4 : 2.5);
      ctx.globalAlpha = (1 - t) * 0.85;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = i % 3 === 0 ? 'rgba(220,240,255,0.9)' : 'rgba(180,210,255,0.9)';
      ctx.fill();
    }
    ctx.restore();
  },

  destroy() {
    this._canvas.removeEventListener('mousedown',  this._onDown);
    this._canvas.removeEventListener('mouseup',    this._onUp);
    this._canvas.removeEventListener('touchstart', this._onTouch);
    this._canvas.removeEventListener('touchmove',  this._onTouch);
    this._canvas.removeEventListener('mousemove',  this._onMouseMove);
    this._canvas.removeEventListener('mouseleave', this._onMouseLeave);
    this._canvas.style.cursor = '';
  },
};

export default bubblesGame;
