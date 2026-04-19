// Облака — медленно плывут по небу, их можно толкать мышью/пальцем

const CLOUD_COUNT = 5;
const BASE_SPEED  = 12;   // px/sec дрейфа
const PUSH_DECAY  = 0.96; // затухание импульса за кадр
const PUFF_COUNT  = 5;    // кругов-«пуховинок» на облако

function randomCloud(W, H, i) {
  return {
    x:    (W / CLOUD_COUNT) * i + Math.random() * 60 - 30,
    y:    30 + Math.random() * (H * 0.55),
    w:    70  + Math.random() * 60,
    h:    30  + Math.random() * 20,
    speed: BASE_SPEED * (0.7 + Math.random() * 0.6),
    vx:   0,
    vy:   0,
    alpha: 0.72 + Math.random() * 0.22,
  };
}

// Описание «пуховинок» для каждого облака — позиции/радиусы относительно центра
function buildPuffs(w, h) {
  return [
    { dx: 0,          dy: 0,          r: h * 0.72 },
    { dx: -w * 0.28,  dy: h * 0.12,   r: h * 0.55 },
    { dx:  w * 0.28,  dy: h * 0.08,   r: h * 0.55 },
    { dx: -w * 0.46,  dy: h * 0.3,    r: h * 0.38 },
    { dx:  w * 0.46,  dy: h * 0.28,   r: h * 0.38 },
  ];
}

const cloudsGame = {
  name: 'clouds',
  label: 'Облака',
  icon:  '☁️',

  init(canvas, ctx) {
    this._canvas = canvas;
    this._ctx    = ctx;
    this._W      = canvas.width;
    this._H      = canvas.height;

    this._clouds = Array.from({ length: CLOUD_COUNT }, (_, i) =>
      randomCloud(this._W, this._H, i)
    );

    // Предрасчёт пуховинок
    this._puffs = this._clouds.map(c => buildPuffs(c.w, c.h));

    this._drag = null;
    this._time = 0;

    this._stars = Array.from({ length: 28 }, () => ({
      x:     Math.random() * this._W,
      y:     Math.random() * this._H * 0.65,
      r:     0.4 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 1.0,
    }));

    this._onDown  = this._onDown.bind(this);
    this._onMove  = this._onMove.bind(this);
    this._onUp    = this._onUp.bind(this);
    this._onTouch = this._onTouch.bind(this);

    canvas.addEventListener('mousedown',  this._onDown);
    canvas.addEventListener('mousemove',  this._onMove);
    canvas.addEventListener('mouseup',    this._onUp);
    canvas.addEventListener('touchstart', this._onTouch, { passive: true });
    canvas.addEventListener('touchmove',  this._onTouch, { passive: true });
    canvas.addEventListener('touchend',   this._onUp);
  },

  // --- ввод ---

  _clientToCanvas(cx, cy) {
    const rect   = this._canvas.getBoundingClientRect();
    const scaleX = this._canvas.width  / rect.width;
    const scaleY = this._canvas.height / rect.height;
    return { x: (cx - rect.left) * scaleX, y: (cy - rect.top) * scaleY };
  },

  _onDown(e) {
    const { x, y } = this._clientToCanvas(e.clientX, e.clientY);
    this._startDrag(x, y);
  },

  _onMove(e) {
    const { x, y } = this._clientToCanvas(e.clientX, e.clientY);
    if (this._drag) {
      this._moveDrag(x, y);
      return;
    }
    const hover = this._clouds.some((c, i) => this._hitTest(c, this._puffs[i], x, y));
    this._canvas.style.cursor = hover ? 'grab' : 'default';
  },

  _onUp() {
    this._drag = null;
    this._canvas.style.cursor = 'default';
  },

  _onTouch(e) {
    const t = e.changedTouches[0];
    const { x, y } = this._clientToCanvas(t.clientX, t.clientY);
    if (e.type === 'touchstart') this._startDrag(x, y);
    else if (this._drag)         this._moveDrag(x, y);
  },

  _hitTest(cloud, puffs, px, py) {
    for (const p of puffs) {
      const dx = px - (cloud.x + p.dx);
      const dy = py - (cloud.y + p.dy);
      if (dx * dx + dy * dy < p.r * p.r) return true;
    }
    return false;
  },

  _startDrag(x, y) {
    for (let i = this._clouds.length - 1; i >= 0; i--) {
      if (this._hitTest(this._clouds[i], this._puffs[i], x, y)) {
        this._drag = { idx: i, prevX: x, prevY: y, vx: 0, vy: 0 };
        this._canvas.style.cursor = 'grabbing';
        return;
      }
    }
  },

  _moveDrag(x, y) {
    if (!this._drag) return;
    const c = this._clouds[this._drag.idx];
    const dx = x - this._drag.prevX;
    const dy = y - this._drag.prevY;
    c.x += dx;
    c.y += dy;
    this._drag.vx = dx;
    this._drag.vy = dy;
    this._drag.prevX = x;
    this._drag.prevY = y;
  },

  handleInput() {},
  pause() {},
  resume() {},

  // --- update ---

  update(dt) {
    this._time += dt;
    const dtSec = dt / 1000;
    const W = this._W, H = this._H;
    const ctx = this._ctx;

    // Физика облаков
    for (let i = 0; i < this._clouds.length; i++) {
      const c = this._clouds[i];
      if (this._drag && this._drag.idx === i) continue;

      // Затухание импульса после броска
      c.vx *= PUSH_DECAY;
      c.vy *= PUSH_DECAY;

      c.x += (c.speed + c.vx) * dtSec;
      c.y += c.vy * dtSec;

      // Мягкий возврат по Y к исходному диапазону
      const midY = H * 0.3;
      c.y += (midY - c.y) * 0.003;

      // Зацикливание по X
      if (c.x > W + c.w) c.x = -c.w;
    }

    // --- Рисование ---

    // Небо — вертикальный градиент
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0,   '#1a2a4a');
    sky.addColorStop(0.5, '#2a4a7a');
    sky.addColorStop(1,   '#3a6aaa');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Звёзды
    this._drawStars(ctx);

    // Луна / маленькое солнце
    ctx.save();
    ctx.beginPath();
    ctx.arc(W - 40, 32, 14, 0, Math.PI * 2);
    const moonGrad = ctx.createRadialGradient(W - 44, 28, 2, W - 40, 32, 14);
    moonGrad.addColorStop(0, '#fff9e0');
    moonGrad.addColorStop(1, '#f0c060');
    ctx.fillStyle = moonGrad;
    ctx.shadowColor = 'rgba(240,200,80,.5)';
    ctx.shadowBlur  = 18;
    ctx.fill();
    ctx.restore();

    // Облака
    for (let i = 0; i < this._clouds.length; i++) {
      this._drawCloud(ctx, this._clouds[i], this._puffs[i]);
    }
  },

  _drawStars(ctx) {
    ctx.save();
    for (const s of this._stars) {
      const alpha = 0.25 + Math.sin(s.phase + this._time * 0.001 * s.speed) * 0.18;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
      ctx.fill();
    }
    ctx.restore();
  },

  _drawCloud(ctx, c, puffs) {
    ctx.save();
    ctx.globalAlpha = c.alpha;

    for (const p of puffs) {
      const gx = c.x + p.dx;
      const gy = c.y + p.dy;
      const grad = ctx.createRadialGradient(gx, gy - p.r * 0.2, p.r * 0.1, gx, gy, p.r);
      grad.addColorStop(0,   'rgba(255,255,255,1)');
      grad.addColorStop(0.6, 'rgba(220,235,255,0.85)');
      grad.addColorStop(1,   'rgba(180,210,255,0)');

      ctx.beginPath();
      ctx.arc(gx, gy, p.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.restore();
  },

  destroy() {
    this._canvas.removeEventListener('mousedown',  this._onDown);
    this._canvas.removeEventListener('mousemove',  this._onMove);
    this._canvas.removeEventListener('mouseup',    this._onUp);
    this._canvas.removeEventListener('touchstart', this._onTouch);
    this._canvas.removeEventListener('touchmove',  this._onTouch);
    this._canvas.removeEventListener('touchend',   this._onUp);
    this._canvas.style.cursor = '';
  },
};

export default cloudsGame;
