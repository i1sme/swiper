// Маятник — 9 маятников разной длины создают волновой паттерн.
// Двойной клик / тап — перезапуск. Клик по шарику — лёгкий толчок.

const N       = 9;
const G_SIM   = 2000; // px/s² — визуальная гравитация
const T_WAVE  = 18;   // секунд — период волны
const K_BASE  = 9;    // маятник n делает (K_BASE+n) полных колебаний за T_WAVE
const INIT_A  = 0.42; // рад — начальный угол (~24°)
const DAMPING = 0.9998; // затухание ω за кадр

const PIVOT_Y  = 22;
const PAD_X    = 30;
const TRAIL_LEN = 28; // точек в следе

// Цвета маятников: спектр от синего к красному
const COLORS = Array.from({ length: N }, (_, i) =>
  `hsl(${200 + i * 18},80%,62%)`
);

function makePendulum(i, pivotX) {
  const n      = i;
  const omega  = 2 * Math.PI * (K_BASE + n) / T_WAVE;
  const length = G_SIM / (omega * omega);
  return {
    pivotX,
    length,
    theta:  INIT_A,
    omega:  0,
    trail:  [],
    color:  COLORS[i],
  };
}

const pendulumGame = {
  name:  'pendulum',
  label: 'Маятник',
  icon:  '🎵',

  init(canvas, ctx) {
    this._canvas = canvas;
    this._ctx    = ctx;
    this._W      = canvas.width;
    this._H      = canvas.height;

    const step = (this._W - PAD_X * 2) / (N - 1);
    this._pends = Array.from({ length: N }, (_, i) =>
      makePendulum(i, PAD_X + i * step)
    );

    this._onClick  = this._onClick.bind(this);
    this._onDbl    = this._onDbl.bind(this);
    this._onTouch  = this._onTouch.bind(this);
    canvas.addEventListener('click',     this._onClick);
    canvas.addEventListener('dblclick',  this._onDbl);
    canvas.addEventListener('touchend',  this._onTouch);
  },

  _bobPos(p) {
    return {
      x: p.pivotX + Math.sin(p.theta) * p.length,
      y: PIVOT_Y  + Math.cos(p.theta) * p.length,
    };
  },

  _clientToCanvas(cx, cy) {
    const rect = this._canvas.getBoundingClientRect();
    return {
      x: (cx - rect.left) * (this._canvas.width  / rect.width),
      y: (cy - rect.top)  * (this._canvas.height / rect.height),
    };
  },

  _onClick(e) {
    const { x, y } = this._clientToCanvas(e.clientX, e.clientY);
    // Толкаем ближайший маятник если попали в шарик
    for (const p of this._pends) {
      const b = this._bobPos(p);
      if (Math.hypot(b.x - x, b.y - y) < 14) {
        p.omega += (Math.random() > 0.5 ? 1 : -1) * 1.8;
        break;
      }
    }
  },

  _onDbl() { this._reset(); },

  _onTouch(e) {
    if (e.touches.length === 0 && e.changedTouches.length > 0) {
      // одиночный tap → толчок ближайшего
      const { x, y } = this._clientToCanvas(
        e.changedTouches[0].clientX, e.changedTouches[0].clientY
      );
      let closest = null, minD = 20;
      for (const p of this._pends) {
        const b = this._bobPos(p);
        const d = Math.hypot(b.x - x, b.y - y);
        if (d < minD) { minD = d; closest = p; }
      }
      if (closest) closest.omega += (Math.random() > 0.5 ? 1 : -1) * 1.8;
    }
  },

  _reset() {
    for (const p of this._pends) {
      p.theta = INIT_A;
      p.omega = 0;
      p.trail = [];
    }
  },

  handleInput() {},
  pause()  {},
  resume() {},

  update(dt) {
    const dtSec = Math.min(dt / 1000, 0.05); // clamp чтобы не взрывалось при потере фокуса
    const ctx   = this._ctx;
    const W     = this._W, H = this._H;

    // --- физика ---
    for (const p of this._pends) {
      const alpha = -(G_SIM / p.length) * Math.sin(p.theta);
      p.omega += alpha * dtSec;
      p.omega *= DAMPING;
      p.theta += p.omega * dtSec;

      // Записываем след
      const b = this._bobPos(p);
      p.trail.push({ x: b.x, y: b.y });
      if (p.trail.length > TRAIL_LEN) p.trail.shift();
    }

    // --- рисование ---

    // Фон
    ctx.fillStyle = '#0e0e1c';
    ctx.fillRect(0, 0, W, H);

    // Горизонтальная перекладина
    ctx.save();
    ctx.strokeStyle = 'rgba(150,160,200,0.25)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(PAD_X - 12, PIVOT_Y);
    ctx.lineTo(W - PAD_X + 12, PIVOT_Y);
    ctx.stroke();
    ctx.restore();

    // Следы
    for (const p of this._pends) {
      if (p.trail.length < 2) continue;
      ctx.save();
      for (let i = 1; i < p.trail.length; i++) {
        const t  = i / p.trail.length;
        ctx.globalAlpha  = t * 0.45;
        ctx.strokeStyle  = p.color;
        ctx.lineWidth    = 1.5 * t;
        ctx.lineCap      = 'round';
        ctx.beginPath();
        ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
        ctx.lineTo(p.trail[i].x,     p.trail[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Нити и шарики
    for (const p of this._pends) {
      const b = this._bobPos(p);

      // Нить
      ctx.save();
      ctx.strokeStyle = 'rgba(160,170,210,0.4)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(p.pivotX, PIVOT_Y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      // Точка крепления
      ctx.fillStyle = 'rgba(160,170,210,0.5)';
      ctx.beginPath();
      ctx.arc(p.pivotX, PIVOT_Y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Шарик: glow + ядро
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = 10;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
      ctx.fill();

      // Блик
      ctx.shadowBlur = 0;
      ctx.fillStyle  = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(b.x - 2, b.y - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Подсказка при старте
    const totalSwings = this._pends.reduce((s, p) => s + Math.abs(p.omega), 0);
    if (totalSwings < 0.5) {
      ctx.save();
      ctx.globalAlpha  = 0.3;
      ctx.fillStyle    = '#a6c8ff';
      ctx.font         = '11px system-ui';
      ctx.textAlign    = 'center';
      ctx.fillText('двойной клик — перезапуск', W / 2, H - 12);
      ctx.restore();
    }
  },

  destroy() {
    this._canvas.removeEventListener('click',    this._onClick);
    this._canvas.removeEventListener('dblclick', this._onDbl);
    this._canvas.removeEventListener('touchend', this._onTouch);
  },
};

export default pendulumGame;
