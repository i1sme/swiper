// Лавовая лампа.
// Физика: температурная модель с гистерезисом.
//   temp > 0.5 → горячий → поднимается
//   temp < 0.5 → холодный → опускается
//   Температура медленно уравнивается с позицией → блоб проходит через центр
//   и уходит в бассейн на противоположной стороне.
// Мышь — перетаскивание. Сброс температуры при отпускании.

const SC           = 4;
const MAX_R        = 46;
const MERGE_THRESH = 0.27;
const POOL_D       = 30;   // глубина видимого бассейна, px
const GLOW_H       = 22;   // высота glow-ореола под/над бассейном

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t)     { return a + (b - a) * t; }

// Цвет лавы: более красный, менее жёлтый
function lavaRGB(yr) {
  return [
    (lerp(228, 255, 1 - yr * 0.08)) | 0,   // R: 228–255
    (lerp(55,  110, 1 - yr))        | 0,    // G: 55–110 (убрали жёлтость)
    (lerp(5,   18,  yr))            | 0,    // B
  ];
}

function makeBlob(W, H) {
  const r     = 13 + Math.random() * 13;
  const normY = 0.08 + Math.random() * 0.84;   // вся высота, включая зоны пулов
  const temp  = normY;                           // температура = позиция
  return {
    x:    r * 1.5 + Math.random() * (W - 3 * r),
    y:    normY * H,
    vx:   (Math.random() - 0.5) * 18,
    vy:   (temp - 0.50) * -60,   // горячий → сразу движется вверх
    r,  r2: r * r,
    temp,
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
    this._t      = 0;

    this._gW = Math.ceil(this._W / SC);
    this._gH = Math.ceil(this._H / SC);
    this._off = document.createElement('canvas');
    this._off.width  = this._gW;
    this._off.height = this._gH;
    this._xo = this._off.getContext('2d');
    this._id = this._xo.createImageData(this._gW, this._gH);

    this._blobs = Array.from({ length: 9 }, () => makeBlob(this._W, this._H));

    this._poolGrads = this._buildPoolGradients();

    this._dragging   = null;
    this._dragTarget = { x: 0, y: 0 };
    this._dragVx     = 0;
    this._dragVy     = 0;

    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp   = this._onUp.bind(this);
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

  _buildPoolGradients() {
    const ctx = this._ctx;
    const W = this._W, H = this._H;
    const D = POOL_D, GH = GLOW_H, wA = 7;

    const topBody = ctx.createLinearGradient(0, 0, 0, D);
    {
      const [r0, g0, b0] = lavaRGB(1.0);
      const [r1, g1, b1] = lavaRGB(1 - D / H);
      topBody.addColorStop(0, `rgb(${r0},${g0},${b0})`);
      topBody.addColorStop(1, `rgb(${r1},${g1},${b1})`);
    }

    const topGlow = ctx.createLinearGradient(0, D - wA, 0, D + GH);
    {
      const [r, g, b] = lavaRGB(1 - D / H);
      topGlow.addColorStop(0,              `rgba(${r},${g},${b},0.00)`);
      topGlow.addColorStop(wA / (wA + GH), `rgba(${r},${g},${b},0.55)`);
      topGlow.addColorStop(1,              `rgba(${r},${g},${b},0.00)`);
    }

    const botBody = ctx.createLinearGradient(0, H - D, 0, H);
    {
      const [r0, g0, b0] = lavaRGB(D / H);
      const [r1, g1, b1] = lavaRGB(0.0);
      botBody.addColorStop(0, `rgb(${r0},${g0},${b0})`);
      botBody.addColorStop(1, `rgb(${r1},${g1},${b1})`);
    }

    const bD = H - D;
    const botGlow = ctx.createLinearGradient(0, bD - GH, 0, bD + wA);
    {
      const [r, g, b] = lavaRGB(D / H);
      botGlow.addColorStop(0,              `rgba(${r},${g},${b},0.00)`);
      botGlow.addColorStop(GH / (GH + wA), `rgba(${r},${g},${b},0.55)`);
      botGlow.addColorStop(1,              `rgba(${r},${g},${b},0.00)`);
    }

    return { topBody, topGlow, botBody, botGlow };
  },

  _onDown(e) {
    const src = e.touches ? e.touches[0] : e;
    const p   = this._pt(src.clientX, src.clientY);
    let bestD = Infinity, best = null;
    for (const b of this._blobs) {
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < b.r + 16 && d < bestD) { bestD = d; best = b; }
    }
    if (best) {
      this._dragging      = best;
      this._dragTarget.x  = p.x;
      this._dragTarget.y  = p.y;
      this._dragVx        = 0;
      this._dragVy        = 0;
    }
  },

  _onMove(e) {
    if (!this._dragging) return;
    const src = e.touches ? e.touches[0] : e;
    const p   = this._pt(src.clientX, src.clientY);
    this._dragTarget.x = p.x;
    this._dragTarget.y = p.y;
  },

  _onUp() {
    if (this._dragging) {
      const b = this._dragging;
      // Сброс температуры под новую позицию → сразу правильное поведение
      b.temp = clamp(b.y / this._H, 0, 1);
      b.vx   = clamp(this._dragVx * 0.50, -80, 80);
      b.vy   = clamp(this._dragVy * 0.50, -80, 80);
    }
    this._dragging = null;
  },

  update(dt) {
    const s = Math.min(dt / 1000, 0.05);
    this._t += s;
    const t = this._t;
    const { _W: W, _H: H, _gW: gW, _gH: gH } = this;
    let blobs = this._blobs;

    // Drag
    if (this._dragging) {
      const b  = this._dragging;
      const dx = this._dragTarget.x - b.x;
      const dy = this._dragTarget.y - b.y;
      this._dragVx = lerp(this._dragVx, dx / (s || 0.016), 0.35);
      this._dragVy = lerp(this._dragVy, dy / (s || 0.016), 0.35);
      b.x = this._dragTarget.x;
      b.y = this._dragTarget.y;
      b.vx = 0; b.vy = 0;
    }

    // ── Температурная физика ──────────────────────────────────────
    for (const b of blobs) {
      if (b === this._dragging) continue;

      // Температура медленно дрейфует к нормированной позиции
      // (низ = 1 = горячий, верх = 0 = холодный)
      const normY = clamp(b.y / H, -0.05, 1.05);
      b.temp += (normY - b.temp) * 1.1 * s;
      b.temp  = clamp(b.temp, 0, 1);

      // Сила плавучести: горячий (temp>0.5) → вверх, холодный → вниз
      b.vy += -(b.temp - 0.50) * 120 * s;

      // Лёгкое горизонтальное колебание
      b.vx += (Math.random() - 0.5) * 14 * s;

      // Минимальное демпфирование — не убивать накопленную энергию
      b.vx *= Math.pow(0.18, s);   // горизонталь гасим сильнее (лампа = вертикальное движение)
      b.vy *= Math.pow(0.84, s);   // вертикаль гасим слабо → пузыри разгоняются

      b.vx = clamp(b.vx, -35, 35);
      b.vy = clamp(b.vy, -90, 90);

      b.x += b.vx * s;
      b.y += b.vy * s;

      if (b.x < b.r)     { b.x = b.r;     b.vx =  Math.abs(b.vx) * 0.4; }
      if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.4; }
      // Пускаем в бассейн, но не насквозь
      b.y = clamp(b.y, -b.r * 0.9, H + b.r * 0.9);
    }

    // Слияния
    const merged = new Uint8Array(blobs.length);
    const next   = [];
    for (let i = 0; i < blobs.length; i++) {
      if (merged[i]) continue;
      let b = blobs[i];
      for (let j = i + 1; j < blobs.length; j++) {
        if (merged[j]) continue;
        if (blobs[i] === this._dragging || blobs[j] === this._dragging) continue;
        const bj = blobs[j];
        const d  = Math.hypot(b.x - bj.x, b.y - bj.y);
        if (d < (b.r + bj.r) * MERGE_THRESH) {
          const ra2 = b.r2, rb2 = bj.r2, tot = ra2 + rb2;
          b = {
            x:    (b.x  * ra2 + bj.x  * rb2) / tot,
            y:    (b.y  * ra2 + bj.y  * rb2) / tot,
            vx:   (b.vx * ra2 + bj.vx * rb2) / tot,
            vy:   (b.vy * ra2 + bj.vy * rb2) / tot,
            temp: (b.temp * ra2 + bj.temp * rb2) / tot,
            r:    Math.min(Math.sqrt(tot), MAX_R),
            r2:   0,
          };
          b.r2 = b.r * b.r;
          merged[j] = 1;
        }
      }
      next.push(b);
    }
    if (this._dragging && !next.includes(this._dragging)) this._dragging = null;
    this._blobs = blobs = next;

    // ── Пиксельный рендер метабол ─────────────────────────────────
    const data = this._id.data;
    const nb   = blobs.length;

    for (let gy = 0; gy < gH; gy++) {
      const py = gy * SC;
      for (let gx = 0; gx < gW; gx++) {
        const px = gx * SC;
        const ii = (gy * gW + gx) * 4;
        let field = 0;
        for (let k = 0; k < nb; k++) {
          const b  = blobs[k];
          const dx = px - b.x, dy = py - b.y;
          field   += b.r2 / (dx * dx + dy * dy || 0.001);
        }
        if (field >= 0.80) {
          const alpha      = clamp((field - 0.80) / 0.35, 0, 1);
          const yr         = 1 - py / H;
          const [r, g, bv] = lavaRGB(yr);
          data[ii]     = r;
          data[ii + 1] = g;
          data[ii + 2] = bv;
          data[ii + 3] = (alpha * 245) | 0;
        } else {
          data[ii + 3] = 0;
        }
      }
    }

    const ctx = this._ctx;
    ctx.fillStyle = '#0a0610';
    ctx.fillRect(0, 0, W, H);

    this._xo.putImageData(this._id, 0, 0);
    ctx.drawImage(this._off, 0, 0, W, H);

    this._drawPools(ctx, W, H, t);
  },

  _drawPools(ctx, W, H, t) {
    const D  = POOL_D;
    const GH = GLOW_H;
    const wA = 7;   // максимальная амплитуда волны
    const N  = Math.ceil(W / 3);

    // ── Верхний бассейн ───────────────────────────────────────────
    // Тело бассейна (сначала, чтобы glow рисовался поверх и закрывал шов)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * W;
      const y = D + Math.sin(x * 0.055 + t * 0.68) * 4
                  + Math.sin(x * 0.038 + t * 0.48) * 2.5;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, 0);
    ctx.closePath();
    ctx.fillStyle = this._poolGrads.topBody;
    ctx.fill();
    // Glow поверх — колоколообразный, пиком на краю бассейна (скрывает чёрный шов)
    ctx.fillStyle = this._poolGrads.topGlow;
    ctx.fillRect(0, D - wA, W, wA + GH);

    // ── Нижний бассейн ────────────────────────────────────────────
    // Тело бассейна
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * W;
      const y = H - D + Math.sin(x * 0.055 + t * 0.56) * 4
                       + Math.sin(x * 0.038 + t * 0.38) * 2.5;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = this._poolGrads.botBody;
    ctx.fill();
    // Glow поверх нижнего бассейна
    ctx.fillStyle = this._poolGrads.botGlow;
    ctx.fillRect(0, H - D - GH, W, GH + wA);
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
    this._off = null;
    this._xo  = null;
    this._id  = null;
  },
};

export default lavaLampGame;
