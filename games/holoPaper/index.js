// Голо-бумага — фиксированная текстура из шума, запечённая в init().
// Рисуешь мышью — проявляешь то, что скрыто под тёмным слоем.
// Одно и то же место всегда даёт один и тот же цвет: как натирание монеты.

const BRUSH_R   = 8;    // радиус кисти
const MIN_DIST  = 2;    // минимальный шаг

// Простой hash-based value noise без внешних зависимостей
function rand2(ix, iy, seed) {
  let h = (ix * 1376312589 ^ iy * 3144134277 ^ seed) >>> 0;
  h = Math.imul(h ^ (h >>> 14), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  return (h ^ (h >>> 16)) / 4294967296;
}

function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const sx = xf * xf * (3 - 2 * xf);
  const sy = yf * yf * (3 - 2 * yf);
  const v00 = rand2(xi,     yi,     seed);
  const v10 = rand2(xi + 1, yi,     seed);
  const v01 = rand2(xi,     yi + 1, seed);
  const v11 = rand2(xi + 1, yi + 1, seed);
  return (v00 + (v10 - v00) * sx) * (1 - sy) + (v01 + (v11 - v01) * sx) * sy;
}

// Фрактальный шум (4 октавы)
function fNoise(x, y, seed) {
  let v = 0, a = 1, f = 1, max = 0;
  for (let o = 0; o < 4; o++) {
    v   += valueNoise(x * f, y * f, seed + o * 997) * a;
    max += a;
    a   *= 0.5;
    f   *= 2.1;
  }
  return v / max;
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = t => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [hue2rgb(h + 1 / 3), hue2rgb(h), hue2rgb(h - 1 / 3)].map(v => Math.round(v * 255));
}

const holoPaperGame = {
  name:  'holoPaper',
  label: 'Голо-бумага',
  icon:  '🌈',

  init(canvas, ctx) {
    this._canvas = canvas;
    this._ctx    = ctx;
    this._W      = canvas.width;
    this._H      = canvas.height;

    const W = this._W, H = this._H;
    const seed = 42;

    // ── Запекаем текстуру один раз ─────────────────────────────
    this._texCanvas = document.createElement('canvas');
    this._texCanvas.width  = W;
    this._texCanvas.height = H;
    const texCtx = this._texCanvas.getContext('2d');
    const scale  = 7; // масштаб узора (меньше = крупнее)

    const imgData = texCtx.createImageData(W, H);
    const d = imgData.data;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const n = fNoise(px / scale, py / scale, seed);
        // Второй слой шума сдвигает оттенок — создаёт радужные переливы
        const n2 = fNoise(px / (scale * 1.4) + 100, py / (scale * 1.4), seed + 500);
        const hue = (n * 360 + n2 * 220) % 360;
        const [r, g, b] = hslToRgb(hue, 100, 60);
        const idx  = (py * W + px) * 4;
        d[idx]     = r;
        d[idx + 1] = g;
        d[idx + 2] = b;
        d[idx + 3] = 255;
      }
    }
    texCtx.putImageData(imgData, 0, 0);

    // ── Туман (тёмный слой поверх текстуры) ─────────────────────
    // Brush стирает дыры в тумане через destination-out
    this._fogCanvas = document.createElement('canvas');
    this._fogCanvas.width  = W;
    this._fogCanvas.height = H;
    this._fogCtx = this._fogCanvas.getContext('2d');
    this._fillFog();

    this._drawing = false;
    this._prev    = null;

    this._onDown  = this._onDown.bind(this);
    this._onMove  = this._onMove.bind(this);
    this._onUp    = this._onUp.bind(this);
    this._onTouch = this._onTouch.bind(this);
    this._onDbl   = this._onDbl.bind(this);

    canvas.style.cursor = 'crosshair';
    canvas.addEventListener('mousedown',  this._onDown);
    canvas.addEventListener('mousemove',  this._onMove);
    canvas.addEventListener('mouseup',    this._onUp);
    canvas.addEventListener('mouseleave', this._onUp);
    canvas.addEventListener('dblclick',   this._onDbl);
    canvas.addEventListener('touchstart', this._onTouch, { passive: true });
    canvas.addEventListener('touchmove',  this._onTouch, { passive: true });
    canvas.addEventListener('touchend',   this._onUp);
  },

  _fillFog() {
    const fc = this._fogCtx;
    fc.globalCompositeOperation = 'source-over';
    fc.fillStyle = '#000000';
    fc.fillRect(0, 0, this._W, this._H);
  },

  _clientToCanvas(cx, cy) {
    const r = this._canvas.getBoundingClientRect();
    return {
      x: (cx - r.left) * (this._canvas.width  / r.width),
      y: (cy - r.top)  * (this._canvas.height / r.height),
    };
  },

  _reveal(x, y) {
    const fc = this._fogCtx;
    fc.globalCompositeOperation = 'destination-out';
    const grad = fc.createRadialGradient(x, y, 0, x, y, BRUSH_R);
    grad.addColorStop(0,   'rgba(0,0,0,1)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.7)');
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    fc.fillStyle = grad;
    fc.beginPath();
    fc.arc(x, y, BRUSH_R, 0, Math.PI * 2);
    fc.fill();
    fc.globalCompositeOperation = 'source-over';
  },

  _onDown(e) {
    this._drawing = true;
    const pt = this._clientToCanvas(e.clientX, e.clientY);
    this._prev = pt;
    this._reveal(pt.x, pt.y);
  },

  _onMove(e) {
    if (!this._drawing) return;
    const cur = this._clientToCanvas(e.clientX, e.clientY);
    if (!this._prev || Math.hypot(cur.x - this._prev.x, cur.y - this._prev.y) < MIN_DIST) return;
    // Интерполируем точки вдоль мазка для плотного покрытия
    const dist  = Math.hypot(cur.x - this._prev.x, cur.y - this._prev.y);
    const steps = Math.ceil(dist / (BRUSH_R * 0.5));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      this._reveal(
        this._prev.x + (cur.x - this._prev.x) * t,
        this._prev.y + (cur.y - this._prev.y) * t
      );
    }
    this._prev = cur;
  },

  _onUp() { this._drawing = false; this._prev = null; },

  _onDbl() { this._fillFog(); },

  _onTouch(e) {
    const t  = e.changedTouches[0];
    const pt = this._clientToCanvas(t.clientX, t.clientY);
    if (e.type === 'touchstart') {
      this._drawing = true;
      this._prev    = pt;
      this._reveal(pt.x, pt.y);
    } else if (this._drawing && this._prev) {
      if (Math.hypot(pt.x - this._prev.x, pt.y - this._prev.y) >= MIN_DIST) {
        const dist  = Math.hypot(pt.x - this._prev.x, pt.y - this._prev.y);
        const steps = Math.ceil(dist / (BRUSH_R * 0.5));
        for (let s = 1; s <= steps; s++) {
          const tv = s / steps;
          this._reveal(
            this._prev.x + (pt.x - this._prev.x) * tv,
            this._prev.y + (pt.y - this._prev.y) * tv
          );
        }
        this._prev = pt;
      }
    }
  },

  handleInput() {},
  pause()  {},
  resume() {},

  update(_dt) {
    const ctx = this._ctx;
    // Текстура под туманом (фиксированная, не меняется со временем)
    ctx.drawImage(this._texCanvas, 0, 0);
    // Туман поверх: там где кисть прошлась — прозрачно, видна текстура
    ctx.drawImage(this._fogCanvas, 0, 0);
  },

  destroy() {
    this._canvas.style.cursor = '';
    this._canvas.removeEventListener('mousedown',  this._onDown);
    this._canvas.removeEventListener('mousemove',  this._onMove);
    this._canvas.removeEventListener('mouseup',    this._onUp);
    this._canvas.removeEventListener('mouseleave', this._onUp);
    this._canvas.removeEventListener('dblclick',   this._onDbl);
    this._canvas.removeEventListener('touchstart', this._onTouch);
    this._canvas.removeEventListener('touchmove',  this._onTouch);
    this._canvas.removeEventListener('touchend',   this._onUp);
  },
};

export default holoPaperGame;
