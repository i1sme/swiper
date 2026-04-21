// Zen Garden — рисуешь граблями узоры на песке, узоры сохраняются

const TINES       = 7;     // зубьев граблей
const TINE_GAP    = 6;     // px между зубьями
const TINE_R      = 1.8;   // радиус одного зуба
const LINE_WIDTH  = 1.4;   // ширина борозды
const RAKE_W      = (TINES - 1) * TINE_GAP; // полная ширина

// Камни: фиксированные позиции в долях от размера canvas
const ROCK_DEFS = [
  { fx: 0.18, fy: 0.28, rx: 18, ry: 13, angle: -0.3 },
  { fx: 0.72, fy: 0.60, rx: 22, ry: 16, angle:  0.5 },
  { fx: 0.45, fy: 0.75, rx: 12, ry:  9, angle: -0.1 },
];

function buildRocks(W, H) {
  return ROCK_DEFS.map(d => ({ ...d, x: d.fx * W, y: d.fy * H }));
}

const zenGardenGame = {
  name: 'zenGarden',
  label: 'Сад камней',
  icon:  '🪨',

  init(canvas, ctx) {
    this._canvas = canvas;
    this._ctx    = ctx;
    this._W      = canvas.width;
    this._H      = canvas.height;

    this._rocks = buildRocks(this._W, this._H);

    // Offscreen: постоянный слой с узорами граблей
    this._off    = document.createElement('canvas');
    this._off.width  = this._W;
    this._off.height = this._H;
    this._offCtx = this._off.getContext('2d');
    this._clearSand(this._offCtx);

    // Предгенерируем зернистость один раз в offscreen canvas
    this._grainCanvas = document.createElement('canvas');
    this._grainCanvas.width  = this._W;
    this._grainCanvas.height = this._H;
    const gctx = this._grainCanvas.getContext('2d');
    gctx.fillStyle = '#5a3c10';
    const grainCount = Math.floor(this._W * this._H / 18);
    for (let i = 0; i < grainCount; i++) {
      gctx.fillRect(Math.random() * this._W | 0, Math.random() * this._H | 0, 1, 1);
    }

    this._drawing   = false;
    this._prev      = null;
    this._rakeAngle = null; // сглаженный угол направления граблей

    this._onDown    = this._onDown.bind(this);
    this._onMove    = this._onMove.bind(this);
    this._onUp      = this._onUp.bind(this);
    this._onTouch   = this._onTouch.bind(this);
    this._onDblClick = this._onDblClick.bind(this);

    canvas.style.cursor = 'crosshair';
    canvas.addEventListener('mousedown',  this._onDown);
    canvas.addEventListener('mousemove',  this._onMove);
    canvas.addEventListener('mouseup',    this._onUp);
    canvas.addEventListener('mouseleave', this._onUp);
    canvas.addEventListener('dblclick',   this._onDblClick);
    canvas.addEventListener('touchstart', this._onTouch, { passive: true });
    canvas.addEventListener('touchmove',  this._onTouch, { passive: true });
    canvas.addEventListener('touchend',   this._onUp);
  },

  _clearSand(octx) {
    const W = this._W, H = this._H;
    // Базовый цвет песка с лёгким шумом через gradient
    const g = octx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0,   '#d4b87c');
    g.addColorStop(0.5, '#c8a968');
    g.addColorStop(1,   '#d6bc80');
    octx.fillStyle = g;
    octx.fillRect(0, 0, W, H);
  },

  // --- ввод ---

  _clientToCanvas(cx, cy) {
    const rect   = this._canvas.getBoundingClientRect();
    const scaleX = this._canvas.width  / rect.width;
    const scaleY = this._canvas.height / rect.height;
    return { x: (cx - rect.left) * scaleX, y: (cy - rect.top) * scaleY };
  },

  _onDown(e) {
    this._drawing = true;
    this._prev = this._clientToCanvas(e.clientX, e.clientY);
  },

  _onMove(e) {
    if (!this._drawing) return;
    const cur = this._clientToCanvas(e.clientX, e.clientY);
    if (this._drawRake(this._prev, cur)) this._prev = cur;
  },

  _onUp() {
    this._drawing   = false;
    this._prev      = null;
    this._rakeAngle = null;
  },

  _onDblClick() {
    this._clearSand(this._offCtx);
  },

  _onTouch(e) {
    const t = e.changedTouches[0];
    const pt = this._clientToCanvas(t.clientX, t.clientY);
    if (e.type === 'touchstart') {
      this._drawing   = true;
      this._prev      = pt;
      this._rakeAngle = null;
    } else if (this._drawing) {
      if (this._drawRake(this._prev, pt)) this._prev = pt;
    }
  },

  // Рисуем след граблей между двумя точками; возвращает true если нарисовали
  _drawRake(from, to) {
    if (!from) return false;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < 2) return false;

    // Лёгкое сглаживание угла — убирает дрожание, но не создаёт задержку
    const rawAngle = Math.atan2(dy, dx);
    if (this._rakeAngle === null) {
      this._rakeAngle = rawAngle;
    } else {
      let diff = rawAngle - this._rakeAngle;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this._rakeAngle += diff * 0.7; // постоянный коэффициент — быстро и без задержки
    }

    // Перпендикуляр к сглаженному направлению
    const px = -Math.sin(this._rakeAngle);
    const py =  Math.cos(this._rakeAngle);

    const octx = this._offCtx;
    octx.lineCap = 'round';

    for (let i = 0; i < TINES; i++) {
      const off = (i - (TINES - 1) / 2) * TINE_GAP;
      const x0  = from.x + px * off;
      const y0  = from.y + py * off;
      const x1  = to.x   + px * off;
      const y1  = to.y   + py * off;

      // Слой 1 — широкий светлый ореол: потревоженный песок вокруг борозды
      octx.beginPath();
      octx.moveTo(x0, y0);
      octx.lineTo(x1, y1);
      octx.strokeStyle = 'rgba(210,175,100,0.22)';
      octx.lineWidth   = 5.5;
      octx.stroke();

      // Слой 2 — тёмное дно борозды
      octx.beginPath();
      octx.moveTo(x0, y0);
      octx.lineTo(x1, y1);
      octx.strokeStyle = 'rgba(60,38,8,0.62)';
      octx.lineWidth   = 2.0;
      octx.stroke();

      // Слой 3 — светлый гребень слева (свет падает сверху-слева)
      const hx = px * 1.6, hy = py * 1.6;
      octx.beginPath();
      octx.moveTo(x0 + hx, y0 + hy);
      octx.lineTo(x1 + hx, y1 + hy);
      octx.strokeStyle = 'rgba(235,200,130,0.45)';
      octx.lineWidth   = 1.1;
      octx.stroke();

      // Слой 4 — тёмная тень справа
      octx.beginPath();
      octx.moveTo(x0 - hx, y0 - hy);
      octx.lineTo(x1 - hx, y1 - hy);
      octx.strokeStyle = 'rgba(50,30,5,0.28)';
      octx.lineWidth   = 0.9;
      octx.stroke();
    }

    // Точки зубьев у кончика (ямки от вхождения в песок)
    for (let i = 0; i < TINES; i++) {
      const off = (i - (TINES - 1) / 2) * TINE_GAP;
      const tx  = to.x + px * off;
      const ty  = to.y + py * off;

      // Тёмный центр ямки
      octx.beginPath();
      octx.arc(tx, ty, TINE_R, 0, Math.PI * 2);
      octx.fillStyle = 'rgba(50,30,5,0.7)';
      octx.fill();

      // Светлый ободок — приподнятый песок вокруг ямки
      octx.beginPath();
      octx.arc(tx, ty, TINE_R + 1.4, 0, Math.PI * 2);
      octx.strokeStyle = 'rgba(225,190,120,0.38)';
      octx.lineWidth   = 1.2;
      octx.stroke();
    }

    return true;
  },

  handleInput() {},
  pause() {},
  resume() {},

  update(dt) {
    const ctx = this._ctx;
    const W = this._W, H = this._H;

    // Копируем offscreen (песок + борозды)
    ctx.drawImage(this._off, 0, 0);

    // Тонкая зернистость поверх
    this._drawGrain(ctx, W, H);

    // Камни
    for (const r of this._rocks) {
      this._drawRock(ctx, r);
    }
  },

  _drawGrain(ctx, W, H) {
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.drawImage(this._grainCanvas, 0, 0);
    ctx.restore();
  },

  _drawRock(ctx, r) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.angle);

    // Тень
    ctx.shadowColor  = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur   = 8;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;

    const g = ctx.createRadialGradient(-r.rx * 0.25, -r.ry * 0.3, 2, 0, 0, r.rx);
    g.addColorStop(0,   '#9a9a9a');
    g.addColorStop(0.5, '#6e6e6e');
    g.addColorStop(1,   '#4a4a4a');

    ctx.beginPath();
    ctx.ellipse(0, 0, r.rx, r.ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    // Блик
    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    ctx.ellipse(-r.rx * 0.22, -r.ry * 0.28, r.rx * 0.18, r.ry * 0.1, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fill();

    ctx.restore();
  },

  destroy() {
    this._canvas.removeEventListener('mousedown',  this._onDown);
    this._canvas.removeEventListener('mousemove',  this._onMove);
    this._canvas.removeEventListener('mouseup',    this._onUp);
    this._canvas.removeEventListener('mouseleave', this._onUp);
    this._canvas.removeEventListener('dblclick',   this._onDblClick);
    this._canvas.removeEventListener('touchstart', this._onTouch);
    this._canvas.removeEventListener('touchmove',  this._onTouch);
    this._canvas.removeEventListener('touchend',   this._onUp);
    this._canvas.style.cursor = '';
  },
};

export default zenGardenGame;
