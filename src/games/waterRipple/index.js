// Water Ripple — кликаешь на воду, расходятся волны; рыбки уплывают от всплеска

const CELL      = 3;       // пикселей на клетку симуляции
const DAMPING   = 0.985;   // затухание волн
const SPLASH_R  = 4;       // радиус всплеска в клетках
const SPLASH_A  = 180;     // амплитуда всплеска

const FISH_COUNT  = 5;
const FISH_SPEED  = 55;    // px/sec нормального плавания
const FISH_FLEE   = 130;   // px/sec при испуге
const SCARE_DIST  = 60;    // px — радиус испуга от эпицентра волны
const SCARE_TIME  = 2200;  // мс — время «испуга»

// ——— Рыбка ———
function makeFish(W, H) {
  const angle = Math.random() * Math.PI * 2;
  return {
    x:       20 + Math.random() * (W - 40),
    y:       20 + Math.random() * (H - 40),
    angle,
    targetAngle: angle,
    scared:  0,         // мс оставшегося испуга
    tailT:   Math.random() * Math.PI * 2,
    color:   `hsl(${190 + Math.floor(Math.random() * 40)},60%,${55 + Math.floor(Math.random() * 20)}%)`,
    size:    10 + Math.random() * 8,
  };
}

const waterRippleGame = {
  name: 'waterRipple',
  label: 'Вода',
  icon:  '🌊',

  init(canvas, ctx) {
    this._canvas = canvas;
    this._ctx    = ctx;
    this._W      = canvas.width;
    this._H      = canvas.height;

    this._cols = Math.ceil(this._W / CELL) + 2;
    this._rows = Math.ceil(this._H / CELL) + 2;
    const n    = this._cols * this._rows;

    // Два буфера высот (Float32 для точности)
    this._cur  = new Float32Array(n);
    this._prev = new Float32Array(n);

    // ImageData для быстрого попиксельного рендера
    this._imgData = ctx.createImageData(this._W, this._H);

    this._fish = Array.from({ length: FISH_COUNT }, () => makeFish(this._W, this._H));
    this._splashAnims = [];

    this._onClick = this._onClick.bind(this);
    this._onTouch = this._onTouch.bind(this);
    canvas.addEventListener('click',      this._onClick);
    canvas.addEventListener('touchstart', this._onTouch, { passive: true });
  },

  // --- ввод ---

  _clientToSim(cx, cy) {
    const rect   = this._canvas.getBoundingClientRect();
    const scaleX = this._canvas.width  / rect.width;
    const scaleY = this._canvas.height / rect.height;
    const px     = (cx - rect.left) * scaleX;
    const py     = (cy - rect.top)  * scaleY;
    return { col: Math.round(px / CELL), row: Math.round(py / CELL), px, py };
  },

  _onClick(e)  { const p = this._clientToSim(e.clientX, e.clientY); this._splash(p); },
  _onTouch(e)  {
    for (const t of e.changedTouches) {
      this._splash(this._clientToSim(t.clientX, t.clientY));
    }
  },

  _splash({ col, row, px, py }) {
    for (let dc = -SPLASH_R; dc <= SPLASH_R; dc++) {
      for (let dr = -SPLASH_R; dr <= SPLASH_R; dr++) {
        const d2 = dc * dc + dr * dr;
        if (d2 > SPLASH_R * SPLASH_R) continue;
        const c = col + dc, r = row + dr;
        if (c < 0 || c >= this._cols || r < 0 || r >= this._rows) continue;
        const amp = SPLASH_A * (1 - Math.sqrt(d2) / SPLASH_R);
        this._cur[r * this._cols + c] += amp;
      }
    }

    this._splashAnims.push({ x: px, y: py, t: 0 });

    // Пугаем рыбок рядом
    for (const f of this._fish) {
      const dx = f.x - px, dy = f.y - py;
      if (Math.hypot(dx, dy) < SCARE_DIST) {
        f.scared       = SCARE_TIME;
        f.targetAngle  = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.8;
      }
    }
  },

  handleInput() {},
  pause() {},
  resume() {},

  // --- update ---

  update(dt) {
    this._dt = dt;
    this._stepWater();
    this._moveFish(dt);
    this._render();
  },

  _stepWater() {
    const cols = this._cols, rows = this._rows;
    const cur  = this._cur, prev = this._prev;

    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        const i = r * cols + c;
        const val =
          (cur[i - 1] + cur[i + 1] + cur[i - cols] + cur[i + cols]) / 2 - prev[i];
        prev[i] = val * DAMPING;
      }
    }

    // Меняем буферы
    const tmp  = this._cur;
    this._cur  = this._prev;
    this._prev = tmp;
  },

  _moveFish(dt) {
    const dtSec = dt / 1000;
    const W = this._W, H = this._H;

    for (const f of this._fish) {
      if (f.scared > 0) {
        f.scared -= dt;
        if (f.scared < 0) f.scared = 0;
      }

      // Плавный поворот к цели
      let dA = f.targetAngle - f.angle;
      // Кратчайший путь по углу
      while (dA >  Math.PI) dA -= Math.PI * 2;
      while (dA < -Math.PI) dA += Math.PI * 2;
      f.angle += dA * Math.min(1, dtSec * 3);

      const speed = f.scared > 0 ? FISH_FLEE : FISH_SPEED;
      f.x += Math.cos(f.angle) * speed * dtSec;
      f.y += Math.sin(f.angle) * speed * dtSec;

      // Отражение от стен
      const margin = 24;
      if (f.x < margin)      { f.x = margin;      f.targetAngle = Math.PI - f.targetAngle + (Math.random() - 0.5) * 0.6; }
      if (f.x > W - margin)  { f.x = W - margin;  f.targetAngle = Math.PI - f.targetAngle + (Math.random() - 0.5) * 0.6; }
      if (f.y < margin)      { f.y = margin;       f.targetAngle = -f.targetAngle            + (Math.random() - 0.5) * 0.6; }
      if (f.y > H - margin)  { f.y = H - margin;   f.targetAngle = -f.targetAngle            + (Math.random() - 0.5) * 0.6; }

      // Случайный поворот для рыбок которые не напуганы
      if (f.scared === 0 && Math.random() < 0.008) {
        f.targetAngle += (Math.random() - 0.5) * 1.2;
      }

      f.tailT += dtSec * (f.scared > 0 ? 12 : 6);
    }
  },

  _render() {
    const ctx   = this._ctx;
    const W     = this._W, H = this._H;
    const cols  = this._cols;
    const cur   = this._cur;
    const data  = this._imgData.data;

    // Рисуем воду через ImageData для скорости
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const c   = Math.floor(px / CELL) + 1;
        const r   = Math.floor(py / CELL) + 1;
        const h   = cur[r * cols + c];

        // Нормаль из соседних клеток для освещения
        const hL  = cur[r * cols + c - 1];
        const hR  = cur[r * cols + c + 1];
        const hU  = cur[(r - 1) * cols + c];
        const hD  = cur[(r + 1) * cols + c];
        const nx  = (hL - hR) * 0.012;
        const ny  = (hU - hD) * 0.012;

        // Базовый цвет воды + рябь
        const light = Math.max(0, Math.min(1, 0.5 + nx * 0.6 + ny * 0.4 + h * 0.003));

        const i = (py * W + px) * 4;
        data[i]     = Math.max(0, Math.min(255, Math.round(15  + light * 40  + h * 0.25))) | 0;
        data[i + 1] = Math.max(0, Math.min(255, Math.round(60  + light * 85  + h * 0.45))) | 0;
        data[i + 2] = Math.max(0, Math.min(255, Math.round(115 + light * 105 + h * 0.75))) | 0;
        data[i + 3] = 255;
      }
    }

    ctx.putImageData(this._imgData, 0, 0);

    this._drawSplashAnims(ctx);

    for (const f of this._fish) {
      this._drawFish(ctx, f);
    }
  },

  _drawSplashAnims(ctx) {
    const dt = this._dt;
    ctx.save();
    for (let i = this._splashAnims.length - 1; i >= 0; i--) {
      const a = this._splashAnims[i];
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.t * 55, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(190,235,255,${((1 - a.t) * 0.65).toFixed(2)})`;
      ctx.lineWidth = 2.5 * (1 - a.t);
      ctx.stroke();
      a.t += dt / 550;
      if (a.t >= 1) this._splashAnims.splice(i, 1);
    }
    ctx.restore();
  },

  _drawFish(ctx, f) {
    const s = f.size;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.angle);

    // Хвост
    const tailSwing = Math.sin(f.tailT) * 0.35;
    ctx.save();
    ctx.translate(-s * 0.6, 0);
    ctx.rotate(tailSwing);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-s * 0.7,  s * 0.45);
    ctx.lineTo(-s * 0.7, -s * 0.45);
    ctx.closePath();
    ctx.fillStyle = f.color;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.restore();

    // Тело
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.42, 0, 0, Math.PI * 2);
    ctx.fillStyle = f.color;
    ctx.globalAlpha = f.scared > 0 ? 0.95 : 0.82;
    ctx.fill();

    // Глаз
    ctx.beginPath();
    ctx.arc(s * 0.5, -s * 0.1, s * 0.13, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.globalAlpha = 1;
    ctx.fill();

    ctx.restore();
  },

  destroy() {
    this._canvas.removeEventListener('click',      this._onClick);
    this._canvas.removeEventListener('touchstart', this._onTouch);
  },
};

export default waterRippleGame;
