// Змейка — ставишь еду кликом, змейка сама ползёт через BFS.
// Проходит сквозь стены. Долго не ест — постепенно усыхает.

const SC_CELL    = 18;
const SC_COLS    = 20;
const SC_ROWS    = 15;
const SC_OX      = 0;
const SC_OY      = 5;     // (280 - 15*18) / 2 = 5
const STEP_MS    = 320;   // мс на один шаг
const HUNGER_MAX = 12000; // мс до начала усыхания
const SHRINK_MS  = 2000;  // мс между потерей сегмента
const MIN_LEN    = 3;

const SC_DIRS = [[-1,0],[1,0],[0,-1],[0,1]];

const snakeGame = {
  name:  'snake',
  label: 'Змейка',
  icon:  '🐍',

  init(canvas, ctx) {
    this._canvas       = canvas;
    this._ctx          = ctx;
    this._W            = canvas.width;
    this._H            = canvas.height;
    this._stepAcc      = 0;
    this._animMs       = 0;
    this._hungerMs     = 0;
    this._shrinkAcc    = 0;
    this._food         = null;
    this._hasPlacedFood = false;

    // Start at center moving right, length 3
    const cx = Math.floor(SC_COLS / 2);
    const cy = Math.floor(SC_ROWS / 2);
    this._body = [[cx, cy], [cx - 1, cy], [cx - 2, cy]];
    this._dir  = [1, 0];

    this._onDown = this._onDown.bind(this);
    canvas.addEventListener('mousedown',  this._onDown);
    canvas.addEventListener('touchstart', this._onDown, { passive: true });
  },

  _key(x, y) {
    return y * SC_COLS + x;
  },

  // BFS on toroidal grid; returns [x,y] of the first step from head toward (fx,fy)
  _bfsNext(fx, fy) {
    const C = SC_COLS, R = SC_ROWS;
    const [hx, hy] = this._body[0];
    if (hx === fx && hy === fy) return null;

    const bodySet = new Set(this._body.map(([x, y]) => this._key(x, y)));
    const dist    = new Int32Array(C * R).fill(-1);
    dist[this._key(hx, hy)] = 0;
    const queue   = [[hx, hy]];
    const targetK = this._key(fx, fy);
    let found     = false;

    outer: while (queue.length > 0) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of SC_DIRS) {
        const nx = (x + dx + C) % C;
        const ny = (y + dy + R) % R;
        const nk = this._key(nx, ny);
        if (dist[nk] !== -1 || bodySet.has(nk)) continue;
        dist[nk] = dist[y * C + x] + 1;
        if (nk === targetK) { found = true; break outer; }
        queue.push([nx, ny]);
      }
    }

    if (!found) return null;

    // Backtrack from food to find the first step from head
    let x = fx, y = fy;
    for (let i = 0; i < C * R; i++) {
      const d = dist[y * C + x];
      if (d === 1) return [x, y];
      for (const [dx, dy] of SC_DIRS) {
        const px = (x - dx + C) % C;
        const py = (y - dy + R) % R;
        if (dist[py * C + px] === d - 1) { x = px; y = py; break; }
      }
    }
    return null;
  },

  // Wander: prefer current direction, 8% chance to turn randomly
  _wander(hx, hy) {
    const C = SC_COLS, R = SC_ROWS;
    const bodySet = new Set(this._body.map(([x, y]) => this._key(x, y)));
    const [dx, dy] = this._dir;
    const pfx = (hx + dx + C) % C;
    const pfy = (hy + dy + R) % R;

    if (Math.random() > 0.08 && !bodySet.has(this._key(pfx, pfy))) {
      return [pfx, pfy];
    }

    const shuffled = [...SC_DIRS].sort(() => Math.random() - 0.5);
    for (const [ddx, ddy] of shuffled) {
      const nx = (hx + ddx + C) % C;
      const ny = (hy + ddy + R) % R;
      if (!bodySet.has(this._key(nx, ny))) {
        this._dir = [ddx, ddy];
        return [nx, ny];
      }
    }
    return null;
  },

  _step() {
    const [hx, hy] = this._body[0];
    let next = null;

    if (this._food) next = this._bfsNext(this._food[0], this._food[1]);
    if (!next)      next = this._wander(hx, hy);
    if (!next)      return;

    const [nx, ny] = next;

    // Track direction with wrap-around normalisation
    let ddx = nx - hx, ddy = ny - hy;
    if (ddx >  SC_COLS / 2) ddx -= SC_COLS;
    if (ddx < -SC_COLS / 2) ddx += SC_COLS;
    if (ddy >  SC_ROWS / 2) ddy -= SC_ROWS;
    if (ddy < -SC_ROWS / 2) ddy += SC_ROWS;
    this._dir = [ddx, ddy];

    this._body.unshift([nx, ny]);

    if (this._food && nx === this._food[0] && ny === this._food[1]) {
      this._food      = null;
      this._hungerMs  = 0;
      this._shrinkAcc = 0;
    } else {
      this._body.pop();
    }
  },

  _onDown(e) {
    const src = e.touches ? e.changedTouches[0] : e;
    const r   = this._canvas.getBoundingClientRect();
    const cx  = (src.clientX - r.left) * (this._W / r.width);
    const cy  = (src.clientY - r.top)  * (this._H / r.height);
    const gc  = Math.floor(cx / SC_CELL);
    const gr  = Math.floor((cy - SC_OY) / SC_CELL);
    if (gc < 0 || gc >= SC_COLS || gr < 0 || gr >= SC_ROWS) return;

    const bodySet = new Set(this._body.map(([x, y]) => this._key(x, y)));
    if (!bodySet.has(this._key(gc, gr))) {
      this._food          = [gc, gr];
      this._hasPlacedFood = true;
    }
  },

  handleInput() {},
  pause()  {},
  resume() {},

  update(dt) {
    this._animMs += dt;

    this._stepAcc += dt;
    while (this._stepAcc >= STEP_MS) {
      this._stepAcc -= STEP_MS;
      this._step();
    }

    this._hungerMs += dt;
    if (this._hungerMs > HUNGER_MAX) {
      this._shrinkAcc += dt;
      while (this._shrinkAcc >= SHRINK_MS && this._body.length > MIN_LEN) {
        this._shrinkAcc -= SHRINK_MS;
        this._body.pop();
      }
      if (this._body.length <= MIN_LEN) this._shrinkAcc = 0;
    }

    this._draw();
  },

  _draw() {
    const ctx = this._ctx;
    const W   = this._W, H = this._H;

    // Background
    ctx.fillStyle = '#0e1a12';
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth   = 0.5;
    for (let c = 0; c <= SC_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(SC_OX + c * SC_CELL, SC_OY);
      ctx.lineTo(SC_OX + c * SC_CELL, SC_OY + SC_ROWS * SC_CELL);
      ctx.stroke();
    }
    for (let r = 0; r <= SC_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(SC_OX,                    SC_OY + r * SC_CELL);
      ctx.lineTo(SC_OX + SC_COLS * SC_CELL, SC_OY + r * SC_CELL);
      ctx.stroke();
    }

    // Food — pulsing glow
    if (this._food) {
      const fx    = SC_OX + this._food[0] * SC_CELL + SC_CELL / 2;
      const fy    = SC_OY + this._food[1] * SC_CELL + SC_CELL / 2;
      const pulse = 0.5 + 0.5 * Math.sin(this._animMs * 0.004);
      const fr    = SC_CELL * 0.28 + pulse * 2;
      ctx.save();
      ctx.shadowColor = '#f0a050';
      ctx.shadowBlur  = 10 + pulse * 6;
      ctx.fillStyle   = `hsl(35,90%,${55 + Math.round(pulse * 15)}%)`;
      ctx.beginPath();
      ctx.arc(fx, fy, fr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Snake body — tail → head so head draws on top
    const len = this._body.length;
    for (let i = len - 1; i >= 0; i--) {
      const [cx, cy] = this._body[i];
      const t   = i / Math.max(len - 1, 1); // 0=head, 1=tail
      const lh  = 58 - t * 32;
      const pad = 2 + t;
      const x   = SC_OX + cx * SC_CELL + pad;
      const y   = SC_OY + cy * SC_CELL + pad;
      const s   = SC_CELL - pad * 2;

      ctx.fillStyle = `hsl(148,60%,${Math.round(lh)}%)`;
      ctx.beginPath();
      ctx.roundRect(x, y, s, s, 3);
      ctx.fill();
    }

    // Head eyes
    if (this._body.length > 0) {
      const [hx, hy] = this._body[0];
      const bx  = SC_OX + hx * SC_CELL + SC_CELL / 2;
      const by  = SC_OY + hy * SC_CELL + SC_CELL / 2;
      const [dx, dy] = this._dir;
      // Perpendicular offset for two eyes
      const px2 = -dy, py2 = dx;
      ctx.fillStyle = '#0e1a12';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(bx + dx * 3.5 + px2 * side * 3.5, by + dy * 3.5 + py2 * side * 3.5, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Hunger vignette — subtle red when starving
    if (this._hungerMs > HUNGER_MAX * 0.7) {
      const t   = Math.min(1, (this._hungerMs - HUNGER_MAX * 0.7) / (HUNGER_MAX * 0.3));
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.7);
      vig.addColorStop(0, 'rgba(200,40,40,0)');
      vig.addColorStop(1, `rgba(200,40,40,${(t * 0.25).toFixed(2)})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
    }

    // Hint until user first places food
    if (!this._hasPlacedFood) {
      ctx.save();
      ctx.fillStyle    = 'rgba(100,180,100,0.4)';
      ctx.font         = '11px system-ui';
      ctx.textAlign    = 'center';
      ctx.fillText('Нажми, чтобы поставить еду', W / 2, H - 8);
      ctx.restore();
    }
  },

  destroy() {
    this._canvas.removeEventListener('mousedown',  this._onDown);
    this._canvas.removeEventListener('touchstart', this._onDown);
  },
};

export default snakeGame;
