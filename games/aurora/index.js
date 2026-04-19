// Северное сияние: пиксельный рендер через Гауссовы ленты.
// Каждый слой = лента с разным цветом и волновой формой.
// Аддитивное наложение через прямое суммирование RGB.
// Курсор → локальное усиление + смещение лент.

const SC = 3;  // пиксельная сетка (1 cell = SC canvas-px)

// hsl → rgb (0..255), только для предвычисления
function hsl2rgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = t => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return [f(h + 1/3), f(h), f(h - 1/3)];
}

const LAYERS = [
  { hue: 132, yBase: 0.34, amp1: 0.105, amp2: 0.065, f1: 0.0110, f2: 0.0185, s1: 0.13, s2: 0.21, sigma: 0.072, br: 1.00 },
  { hue: 168, yBase: 0.44, amp1: 0.088, amp2: 0.048, f1: 0.0160, f2: 0.0260, s1: 0.19, s2: 0.13, sigma: 0.058, br: 0.82 },
  { hue: 272, yBase: 0.24, amp1: 0.095, amp2: 0.042, f1: 0.0092, f2: 0.0148, s1: 0.10, s2: 0.29, sigma: 0.052, br: 0.72 },
  { hue: 198, yBase: 0.52, amp1: 0.070, amp2: 0.038, f1: 0.0220, f2: 0.0120, s1: 0.25, s2: 0.17, sigma: 0.042, br: 0.60 },
  { hue: 115, yBase: 0.18, amp1: 0.075, amp2: 0.035, f1: 0.0140, f2: 0.0220, s1: 0.16, s2: 0.32, sigma: 0.038, br: 0.55 },
];

// Таблица Гаусса: exp(-0.5 * (d/sigma)²), d/sigma в [0..4], 512 ячеек
const GLUT_SIZE = 512;
const GLUT      = new Float32Array(GLUT_SIZE);
for (let i = 0; i < GLUT_SIZE; i++) {
  const x = (i / GLUT_SIZE) * 4;  // d/sigma 0..4
  GLUT[i] = Math.exp(-0.5 * x * x);
}

const N_STARS = 80;

const auroraGame = {
  name:  'aurora',
  label: 'Северное сияние',
  icon:  '🌌',

  init(canvas, ctx) {
    this._canvas = canvas;
    this._ctx    = ctx;
    this._W      = canvas.width;
    this._H      = canvas.height;
    this._t      = 0;
    this._mx     = -9999;
    this._my     = -9999;

    this._gW = Math.ceil(this._W / SC);
    this._gH = Math.ceil(this._H / SC);
    this._off = document.createElement('canvas');
    this._off.width  = this._gW;
    this._off.height = this._gH;
    this._xo  = this._off.getContext('2d');
    this._id  = this._xo.createImageData(this._gW, this._gH);

    // Предвычисляем RGB каждого слоя (постоянные цвета, яркость меняется)
    this._layerRGB = LAYERS.map(L => hsl2rgb(L.hue, 95, 58));

    // Таблица Гаусса в единицах холста (используем разные sigma для слоёв)
    // Sigma у каждого слоя своя — пересчитаем нормировку в render loop

    this._stars = Array.from({ length: N_STARS }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.68,
      r: 0.4 + Math.random() * 1.3,
      a: 0.2 + Math.random() * 0.8,
      tw: Math.random() * Math.PI * 2,
      ts: 0.4 + Math.random() * 1.8,
    }));

    this._onMove  = this._onMove.bind(this);
    this._onLeave = () => { this._mx = -9999; this._my = -9999; };
    canvas.addEventListener('mousemove',  this._onMove);
    canvas.addEventListener('mouseleave', this._onLeave);
    canvas.addEventListener('touchmove',  this._onMove, { passive: true });
  },

  _pt(cx, cy) {
    const r = this._canvas.getBoundingClientRect();
    return {
      x: (cx - r.left) * (this._canvas.width  / r.width),
      y: (cy - r.top)  * (this._canvas.height / r.height),
    };
  },

  _onMove(e) {
    const src = e.touches ? e.touches[0] : e;
    const p   = this._pt(src.clientX, src.clientY);
    this._mx  = p.x; this._my = p.y;
  },

  update(dt) {
    const s = Math.min(dt / 1000, 0.05);
    this._t += s;
    const { _W: W, _H: H, _t: t, _gW: gW, _gH: gH } = this;
    const ctx = this._ctx;
    const mx = this._mx, my = this._my;

    // Предвычислить y_center для каждого слоя по каждому столбцу сетки
    const yCenters = LAYERS.map((L, li) => {
      const col = new Float32Array(gW);
      for (let gx = 0; gx < gW; gx++) {
        const px = gx * SC;
        let yc = H * L.yBase
          + Math.sin(px * L.f1 + t * L.s1) * H * L.amp1
          + Math.sin(px * L.f2 + t * L.s2) * H * L.amp2;
        // Курсор тянет y_center к my в радиусе W*0.35
        if (mx >= 0) {
          const dxm  = Math.abs(px - mx);
          const reach = W * 0.35;
          if (dxm < reach) {
            const str = (1 - dxm / reach) * (1 - dxm / reach) * 0.55;
            yc += (my - yc) * str;
          }
        }
        col[gx] = yc;
      }
      return col;
    });

    // Рендер
    const data  = this._id.data;
    const sigPx = LAYERS.map(L => L.sigma * H);  // sigma в canvas-px
    const brs   = LAYERS.map((L, li) => {
      // Дыхание (пульсация яркости)
      return L.br * (0.72 + Math.sin(t * 0.38 + li * 1.3) * 0.28);
    });
    const rgb   = this._layerRGB;

    for (let gy = 0; gy < gH; gy++) {
      const py = gy * SC;
      for (let gx = 0; gx < gW; gx++) {
        const px = gx * SC;
        let R = 0, G = 0, B = 0;

        // Мерцание по вертикали: имитация занавеса (волокна)
        const shimmer = 1 + Math.sin(gx * 0.85 + t * 2.8) * 0.22
                          + Math.sin(gx * 1.50 + t * 1.6) * 0.12;

        for (let li = 0; li < LAYERS.length; li++) {
          const yc   = yCenters[li][gx];
          const dist = Math.abs(py - yc);
          const sig  = sigPx[li];
          const norm = dist / sig;
          if (norm >= 4) continue;         // за 4σ — нуль
          const lutI  = Math.min(GLUT_SIZE - 1, (norm / 4 * GLUT_SIZE) | 0);
          const intens = GLUT[lutI] * brs[li] * shimmer;

          // Усиление рядом с курсором по X
          let boost = 1;
          if (mx >= 0) {
            const dxm = Math.abs(px - mx);
            if (dxm < W * 0.22) boost = 1 + (1 - dxm / (W * 0.22)) * 0.7;
          }

          R += rgb[li][0] * intens * boost;
          G += rgb[li][1] * intens * boost;
          B += rgb[li][2] * intens * boost;
        }

        const i = (gy * gW + gx) * 4;
        // Тёмный фон смешан аддитивно: небо RGB = (2,4,10)
        data[i]     = Math.min(255, (R * 255 + 2) | 0);
        data[i + 1] = Math.min(255, (G * 255 + 4) | 0);
        data[i + 2] = Math.min(255, (B * 255 + 10) | 0);
        data[i + 3] = 255;
      }
    }

    // Рисуем небо из пиксельного буфера
    this._xo.putImageData(this._id, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(this._off, 0, 0, W, H);
    ctx.restore();

    // Звёзды поверх
    for (const st of this._stars) {
      const tw = Math.sin(t * st.ts + st.tw);
      ctx.globalAlpha = st.a * (0.5 + tw * 0.5);
      ctx.fillStyle   = '#cce8ff';
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Горизонт: лёгкий зеленоватый отсвет (отражение сияния на снегу)
    const hor = ctx.createLinearGradient(0, H * 0.80, 0, H);
    hor.addColorStop(0, 'rgba(40,100,40,0)');
    hor.addColorStop(1, 'rgba(20,55,20,0.22)');
    ctx.fillStyle = hor;
    ctx.fillRect(0, H * 0.80, W, H * 0.20);
  },

  handleInput() {},
  pause()  {},
  resume() {},

  destroy() {
    this._canvas.removeEventListener('mousemove',  this._onMove);
    this._canvas.removeEventListener('mouseleave', this._onLeave);
    this._canvas.removeEventListener('touchmove',  this._onMove);
    this._off = null;
    this._xo  = null;
    this._id  = null;
  },
};

export default auroraGame;
