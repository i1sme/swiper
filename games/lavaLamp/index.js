// Лавовая лампа: метаболы на всём холсте.
// Клик — расщепить ближайший шар. Шары автоматически сливаются при касании.

const SC       = 4;     // масштаб пиксельной сетки
const MAX_R    = 50;    // макс. радиус после слияний
const MIN_R    = 10;    // мин. радиус для расщепления
const MAX_BLOBS = 18;
const MERGE_THRESH = 0.60; // доля (r1+r2), при которой происходит слияние

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t)     { return a + (b - a) * t; }

function makeBlob(W, H, r) {
  return {
    x:  r + Math.random() * (W - 2 * r),
    y:  r + Math.random() * (H - 2 * r),
    vx: (Math.random() - 0.5) * 30,
    vy: (Math.random() - 0.5) * 30,
    r,
    r2: r * r,
  };
}

const lavaLampGame = {
  name:  'lavaLamp',
  label: 'Лавовая лампа',
  icon:  '🫠',

  init(canvas, ctx) {
    this._canvas = canvas;
    this._ctx    = ctx;
    this._W      = canvas.width;
    this._H      = canvas.height;

    this._gW = Math.ceil(this._W / SC);
    this._gH = Math.ceil(this._H / SC);
    this._off = document.createElement('canvas');
    this._off.width  = this._gW;
    this._off.height = this._gH;
    this._xo = this._off.getContext('2d');
    this._id = this._xo.createImageData(this._gW, this._gH);

    // Начальные шары: 10 штук, небольшого размера
    this._blobs = Array.from({ length: 10 }, () =>
      makeBlob(this._W, this._H, 12 + Math.random() * 14)
    );

    this._onClick = this._onClick.bind(this);
    canvas.addEventListener('mousedown',  this._onClick);
    canvas.addEventListener('touchstart', this._onClick, { passive: true });
  },

  _pt(cx, cy) {
    const r = this._canvas.getBoundingClientRect();
    return {
      x: (cx - r.left) * (this._canvas.width  / r.width),
      y: (cy - r.top)  * (this._canvas.height / r.height),
    };
  },

  _onClick(e) {
    const src = e.touches ? e.touches[0] : e;
    const p   = this._pt(src.clientX, src.clientY);
    let bestDist = Infinity, bestIdx = -1;
    for (let i = 0; i < this._blobs.length; i++) {
      const b = this._blobs[i];
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < b.r + 12 && d < bestDist) { bestDist = d; bestIdx = i; }
    }
    if (bestIdx < 0) return;
    const b = this._blobs[bestIdx];
    if (b.r < MIN_R || this._blobs.length >= MAX_BLOBS) return;

    const nr    = b.r / Math.SQRT2;
    const angle = Math.random() * Math.PI * 2;
    const off   = nr * 0.7;
    const b2 = {
      x: b.x + Math.cos(angle) * off, y: b.y + Math.sin(angle) * off,
      vx: b.vx + Math.cos(angle) * 25, vy: b.vy + Math.sin(angle) * 25,
      r: nr, r2: nr * nr,
    };
    b.x -= Math.cos(angle) * off;  b.y -= Math.sin(angle) * off;
    b.vx -= Math.cos(angle) * 25;  b.vy -= Math.sin(angle) * 25;
    b.r = nr; b.r2 = nr * nr;
    this._blobs.push(b2);
  },

  update(dt) {
    const s = Math.min(dt / 1000, 0.05);
    const { _W: W, _H: H, _gW: gW, _gH: gH } = this;
    let blobs = this._blobs;

    // Physics
    for (const b of blobs) {
      const normY = b.y / H;  // 0=top, 1=bottom → тепло внизу
      b.vy += -(normY - 0.30) * 60 * s;         // плавучесть
      b.vx += (Math.random() - 0.5) * 22 * s;
      b.vy += (Math.random() - 0.5) * 12 * s;
      b.vx *= Math.pow(0.10, s);
      b.vy *= Math.pow(0.28, s);
      b.vx  = clamp(b.vx, -65, 65);
      b.vy  = clamp(b.vy, -90, 90);
      b.x  += b.vx * s;
      b.y  += b.vy * s;
      if (b.x < b.r)       { b.x = b.r;       b.vx =  Math.abs(b.vx) * 0.5; }
      if (b.x > W - b.r)   { b.x = W - b.r;   b.vx = -Math.abs(b.vx) * 0.5; }
      if (b.y < b.r)       { b.y = b.r;       b.vy =  Math.abs(b.vy) * 0.3; }
      if (b.y > H - b.r)   { b.y = H - b.r;   b.vy = -Math.abs(b.vy) * 0.3; }
    }

    // Слияния: один проход, O(n²)
    const merged = new Uint8Array(blobs.length);
    const next   = [];
    for (let i = 0; i < blobs.length; i++) {
      if (merged[i]) continue;
      let b = blobs[i];
      for (let j = i + 1; j < blobs.length; j++) {
        if (merged[j]) continue;
        const bj = blobs[j];
        const d  = Math.hypot(b.x - bj.x, b.y - bj.y);
        if (d < (b.r + bj.r) * MERGE_THRESH) {
          const ra2 = b.r2, rb2 = bj.r2, tot = ra2 + rb2;
          b = {
            x:  (b.x * ra2 + bj.x * rb2) / tot,
            y:  (b.y * ra2 + bj.y * rb2) / tot,
            vx: (b.vx * ra2 + bj.vx * rb2) / tot,
            vy: (b.vy * ra2 + bj.vy * rb2) / tot,
            r:  Math.min(Math.sqrt(tot), MAX_R),
            r2: 0,
          };
          b.r2 = b.r * b.r;
          merged[j] = 1;
        }
      }
      next.push(b);
    }
    this._blobs = blobs = next;

    // Рендер метабол на пиксельной сетке
    const data = this._id.data;
    for (let gy = 0; gy < gH; gy++) {
      const py = gy * SC;
      for (let gx = 0; gx < gW; gx++) {
        const px = gx * SC;
        const i  = (gy * gW + gx) * 4;
        let field = 0;
        for (const b of blobs) {
          const dx = px - b.x, dy = py - b.y;
          const d2 = dx * dx + dy * dy || 0.001;
          field += b.r2 / d2;
        }
        if (field >= 0.55) {
          const alpha = clamp((field - 0.55) / 0.55, 0, 1);
          const yr    = 1 - py / H;   // 1=top, 0=bottom
          data[i]     = Math.round(lerp(215, 255, 1 - yr * 0.1));
          data[i + 1] = Math.round(lerp(95,  170, 1 - yr));
          data[i + 2] = Math.round(lerp(8,   25,  yr));
          data[i + 3] = Math.round(alpha * 245);
        } else {
          data[i + 3] = 0;
        }
      }
    }

    const ctx = this._ctx;

    // Фон: тёмный с тёплым свечением снизу
    ctx.fillStyle = '#07040f';
    ctx.fillRect(0, 0, W, H);

    const heatGlow = ctx.createRadialGradient(W / 2, H + 20, 10, W / 2, H + 20, W * 0.85);
    heatGlow.addColorStop(0, 'rgba(255,100,15,0.18)');
    heatGlow.addColorStop(1, 'rgba(255,100,15,0)');
    ctx.fillStyle = heatGlow;
    ctx.fillRect(0, H * 0.55, W, H * 0.45);

    // Метаболы
    this._xo.putImageData(this._id, 0, 0);
    ctx.drawImage(this._off, 0, 0, W, H);

    // Виньетка
    const vig = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) * 0.52);
    vig.addColorStop(0.5, 'rgba(0,0,0,0)');
    vig.addColorStop(1,   'rgba(0,0,0,0.38)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // Подсказка
    if (blobs.length < 3 || (blobs.length === 1 && blobs[0].r < 18)) {
      ctx.save();
      ctx.globalAlpha  = 0.3;
      ctx.fillStyle    = '#ffb050';
      ctx.font         = '11px sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Нажмите на шар — расщепить', W / 2, H - 18);
      ctx.restore();
    }
  },

  handleInput() {},
  pause()  {},
  resume() {},

  destroy() {
    this._canvas.removeEventListener('mousedown',  this._onClick);
    this._canvas.removeEventListener('touchstart', this._onClick);
    this._off = null;
    this._xo  = null;
    this._id  = null;
  },
};

export default lavaLampGame;
