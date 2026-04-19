// Светлячки — летают сами по себе; курсор их пугает, они разлетаются

const COUNT       = 48;
const WANDER_SPD  = 28;   // px/s
const FLEE_SPD    = 110;  // px/s при испуге
const FLEE_R      = 80;   // px — радиус испуга
const SCARE_MS    = 2000; // мс «испуга»
const RETURN_MS   = 1200; // мс плавного возврата к блужданию

function makeFly(W, H) {
  const a = Math.random() * Math.PI * 2;
  return {
    x:      10 + Math.random() * (W - 20),
    y:      10 + Math.random() * (H - 20),
    vx:     Math.cos(a) * WANDER_SPD * (0.6 + Math.random() * 0.8),
    vy:     Math.sin(a) * WANDER_SPD * (0.6 + Math.random() * 0.8),
    glowPh: Math.random() * Math.PI * 2,   // фаза пульсации
    glowHz: 0.7 + Math.random() * 1.4,     // частота пульсации
    scared: 0,    // мс оставшегося испуга
    size:   1.4 + Math.random() * 1.6,
    hue:    55 + Math.floor(Math.random() * 35), // жёлто-зелёный диапазон
  };
}

const firefliesGame = {
  name:  'fireflies',
  label: 'Светлячки',
  icon:  '✨',

  init(canvas, ctx) {
    this._canvas = canvas;
    this._ctx    = ctx;
    this._W      = canvas.width;
    this._H      = canvas.height;
    this._time   = 0;

    this._flies = Array.from({ length: COUNT }, () => makeFly(this._W, this._H));

    // Звёзды — статичные, рисуются один раз на offscreen
    this._bg = this._buildBg();

    this._mx = -999;
    this._my = -999;

    this._onMove  = this._onMove.bind(this);
    this._onLeave = this._onLeave.bind(this);
    canvas.addEventListener('mousemove',  this._onMove);
    canvas.addEventListener('mouseleave', this._onLeave);
    canvas.addEventListener('touchmove',  this._onMove, { passive: true });
  },

  _buildBg() {
    const off = document.createElement('canvas');
    off.width  = this._W;
    off.height = this._H;
    const octx = off.getContext('2d');

    // Небо — градиент
    const grad = octx.createLinearGradient(0, 0, 0, this._H);
    grad.addColorStop(0,   '#07091a');
    grad.addColorStop(0.6, '#0d1030');
    grad.addColorStop(1,   '#0a1520');
    octx.fillStyle = grad;
    octx.fillRect(0, 0, this._W, this._H);

    // Звёзды
    for (let i = 0; i < 55; i++) {
      const x = Math.random() * this._W;
      const y = Math.random() * this._H * 0.8;
      const r = 0.3 + Math.random() * 0.9;
      const a = 0.25 + Math.random() * 0.55;
      octx.beginPath();
      octx.arc(x, y, r, 0, Math.PI * 2);
      octx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
      octx.fill();
    }
    return off;
  },

  _clientToCanvas(cx, cy) {
    const rect = this._canvas.getBoundingClientRect();
    return {
      x: (cx - rect.left) * (this._canvas.width  / rect.width),
      y: (cy - rect.top)  * (this._canvas.height / rect.height),
    };
  },

  _onMove(e) {
    const src = e.touches ? e.touches[0] : e;
    const { x, y } = this._clientToCanvas(src.clientX, src.clientY);
    this._mx = x;
    this._my = y;

    // Пугаем ближайших
    for (const f of this._flies) {
      const dx = f.x - x, dy = f.y - y;
      if (Math.hypot(dx, dy) < FLEE_R) {
        f.scared = SCARE_MS;
        const dist = Math.hypot(dx, dy) || 1;
        f.vx = (dx / dist) * FLEE_SPD;
        f.vy = (dy / dist) * FLEE_SPD;
      }
    }
  },

  _onLeave() { this._mx = -999; this._my = -999; },

  handleInput() {},
  pause()  {},
  resume() {},

  update(dt) {
    const dtSec = dt / 1000;
    this._time += dt;
    const W = this._W, H = this._H;
    const ctx = this._ctx;

    // Фон
    ctx.drawImage(this._bg, 0, 0);

    // Физика светлячков
    for (const f of this._flies) {
      if (f.scared > 0) {
        f.scared -= dt;
      } else {
        // Плавный возврат к скорости блуждания
        const spd   = Math.hypot(f.vx, f.vy);
        const tSpd  = WANDER_SPD * (0.6 + Math.random() * 0.04);
        if (spd > tSpd) {
          const k = 1 - Math.min(1, dtSec * (1000 / RETURN_MS));
          f.vx *= k;
          f.vy *= k;
        }
        // Случайный поворот
        if (Math.random() < 0.018) {
          const a = Math.atan2(f.vy, f.vx) + (Math.random() - 0.5) * 1.4;
          const s = Math.hypot(f.vx, f.vy) || WANDER_SPD;
          f.vx = Math.cos(a) * s;
          f.vy = Math.sin(a) * s;
        }
      }

      f.x += f.vx * dtSec;
      f.y += f.vy * dtSec;
      f.glowPh += f.glowHz * dtSec * Math.PI * 2;

      // Отражение от стен
      if (f.x < 8)      { f.x = 8;      f.vx =  Math.abs(f.vx); }
      if (f.x > W - 8)  { f.x = W - 8;  f.vx = -Math.abs(f.vx); }
      if (f.y < 8)      { f.y = 8;      f.vy =  Math.abs(f.vy); }
      if (f.y > H - 8)  { f.y = H - 8;  f.vy = -Math.abs(f.vy); }
    }

    // Рисуем светлячков двумя проходами: сначала glow, потом точки
    ctx.save();

    // Проход 1: мягкий ореол (большой радиус, низкая непрозрачность)
    for (const f of this._flies) {
      const glow = 0.5 + 0.5 * Math.sin(f.glowPh);
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size * 5 + glow * 4, 0, Math.PI * 2);
      const grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size * 5 + glow * 4);
      grd.addColorStop(0,   `hsla(${f.hue},100%,75%,${(0.12 + glow * 0.1).toFixed(2)})`);
      grd.addColorStop(1,   `hsla(${f.hue},100%,75%,0)`);
      ctx.fillStyle = grd;
      ctx.fill();
    }

    // Проход 2: яркое ядро
    ctx.shadowBlur = 8;
    for (const f of this._flies) {
      const glow = 0.5 + 0.5 * Math.sin(f.glowPh);
      ctx.shadowColor  = `hsl(${f.hue},100%,80%)`;
      ctx.globalAlpha  = 0.6 + glow * 0.4;
      ctx.fillStyle    = `hsl(${f.hue},100%,85%)`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size * (0.8 + glow * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },

  destroy() {
    this._canvas.removeEventListener('mousemove',  this._onMove);
    this._canvas.removeEventListener('mouseleave', this._onLeave);
    this._canvas.removeEventListener('touchmove',  this._onMove);
  },
};

export default firefliesGame;
