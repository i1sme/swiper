// Тетрис — автоматический рестарт при заполнении поля, без экранов

const TC_COLS  = 10;
const TC_ROWS  = 20;
const TC_SZ    = 14;    // px per cell
const TC_OX    = Math.round((360 - TC_COLS * TC_SZ) / 2); // 110
const TC_OY    = 0;
const FALL_MS  = 700;   // мс на одну ступеньку падения
const SOFT_MS  = 50;    // мс при удержании ↓

const TC_SHAPES = [
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[1,1],[1,1]],                               // O
  [[0,1,0],[1,1,1],[0,0,0]],                  // T
  [[0,1,1],[1,1,0],[0,0,0]],                  // S
  [[1,1,0],[0,1,1],[0,0,0]],                  // Z
  [[1,0,0],[1,1,1],[0,0,0]],                  // J
  [[0,0,1],[1,1,1],[0,0,0]],                  // L
];

// Muted zen-friendly palette; index 0 = empty
const TC_COLORS = [
  null,
  '#5ba4cf', // I
  '#c9a034', // O
  '#9b6bbf', // T
  '#4db87b', // S
  '#c95555', // Z
  '#4070b8', // J
  '#c97830', // L
];

function tcRotCW(mat) {
  return mat[0].map((_, j) => mat.map(row => row[j]).reverse());
}

const tetrisGame = {
  name:  'tetris',
  label: 'Тетрис',
  icon:  '🟦',

  init(canvas, ctx) {
    this._canvas   = canvas;
    this._ctx      = ctx;
    this._softDrop = false;
    this._fallAcc  = 0;

    this._onKD = this._onKD.bind(this);
    this._onKU = this._onKU.bind(this);
    this._onT  = this._onT.bind(this);
    document.addEventListener('keydown',  this._onKD);
    document.addEventListener('keyup',    this._onKU);
    canvas.addEventListener('touchstart', this._onT, { passive: true });

    this._newGame();
  },

  _newGame() {
    this._board    = new Array(TC_COLS * TC_ROWS).fill(0);
    this._fallAcc  = 0;
    this._softDrop = false;
    this._spawnPiece();
  },

  _spawnPiece() {
    const idx   = Math.floor(Math.random() * TC_SHAPES.length);
    const shape = TC_SHAPES[idx].map(r => [...r]);
    const px    = Math.floor((TC_COLS - shape[0].length) / 2);
    this._cur   = { shape, ci: idx + 1, x: px, y: 0 };
    if (!this._fits(shape, px, 0)) this._newGame();
  },

  _fits(shape, px, py) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = px + c, ny = py + r;
        if (nx < 0 || nx >= TC_COLS || ny >= TC_ROWS) return false;
        if (ny >= 0 && this._board[ny * TC_COLS + nx]) return false;
      }
    }
    return true;
  },

  _onKD(e) {
    switch (e.code) {
      case 'ArrowLeft':  this._move(-1); break;
      case 'ArrowRight': this._move(1); break;
      case 'ArrowUp':    if (!e.repeat) this._rotate(); break;
      case 'ArrowDown':  this._softDrop = true; break;
      case 'Space':      if (!e.repeat) { this._hardDrop(); e.preventDefault(); } break;
    }
  },

  _onKU(e) {
    if (e.code === 'ArrowDown') this._softDrop = false;
  },

  _onT(e) {
    const t  = e.changedTouches[0];
    const rc = this._canvas.getBoundingClientRect();
    const cx = (t.clientX - rc.left) * (360 / rc.width);
    if      (cx < 120) this._move(-1);
    else if (cx > 240) this._move(1);
    else               this._rotate();
  },

  _move(dx) {
    if (this._fits(this._cur.shape, this._cur.x + dx, this._cur.y))
      this._cur.x += dx;
  },

  _rotate() {
    const rot   = tcRotCW(this._cur.shape);
    const kicks = [0, 1, -1, 2, -2];
    for (const dx of kicks) {
      if (this._fits(rot, this._cur.x + dx, this._cur.y)) {
        this._cur.shape = rot;
        this._cur.x    += dx;
        return;
      }
    }
  },

  _hardDrop() {
    while (this._fits(this._cur.shape, this._cur.x, this._cur.y + 1))
      this._cur.y++;
    this._lock();
    this._fallAcc = 0;
  },

  _stepDown() {
    if (this._fits(this._cur.shape, this._cur.x, this._cur.y + 1)) {
      this._cur.y++;
    } else {
      this._lock();
    }
  },

  _lock() {
    const { shape, ci, x, y } = this._cur;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const ny = y + r;
        if (ny < 0) { this._newGame(); return; }
        this._board[ny * TC_COLS + x + c] = ci;
      }
    }
    this._clearLines();
    this._spawnPiece();
    this._fallAcc = 0;
  },

  _clearLines() {
    for (let r = TC_ROWS - 1; r >= 0; ) {
      let full = true;
      for (let c = 0; c < TC_COLS; c++) {
        if (!this._board[r * TC_COLS + c]) { full = false; break; }
      }
      if (full) {
        for (let row = r; row > 0; row--) {
          for (let c = 0; c < TC_COLS; c++) {
            this._board[row * TC_COLS + c] = this._board[(row - 1) * TC_COLS + c];
          }
        }
        for (let c = 0; c < TC_COLS; c++) this._board[c] = 0;
        // re-check same row index after shift
      } else {
        r--;
      }
    }
  },

  handleInput() {},
  pause()  { this._softDrop = false; },
  resume() {},

  update(dt) {
    const iv = this._softDrop ? SOFT_MS : FALL_MS;
    this._fallAcc += dt;
    while (this._fallAcc >= iv) {
      this._fallAcc -= iv;
      this._stepDown();
    }
    this._draw();
  },

  _ghostY() {
    let gy = this._cur.y;
    while (this._fits(this._cur.shape, this._cur.x, gy + 1)) gy++;
    return gy;
  },

  _draw() {
    const ctx = this._ctx;

    // Background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, 360, 280);

    // Board background
    ctx.fillStyle = '#0f161f';
    ctx.fillRect(TC_OX, TC_OY, TC_COLS * TC_SZ, TC_ROWS * TC_SZ);

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth   = 0.5;
    for (let c = 0; c <= TC_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(TC_OX + c * TC_SZ, TC_OY);
      ctx.lineTo(TC_OX + c * TC_SZ, TC_OY + TC_ROWS * TC_SZ);
      ctx.stroke();
    }
    for (let r = 0; r <= TC_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(TC_OX,                TC_OY + r * TC_SZ);
      ctx.lineTo(TC_OX + TC_COLS * TC_SZ, TC_OY + r * TC_SZ);
      ctx.stroke();
    }

    // Placed cells
    for (let r = 0; r < TC_ROWS; r++) {
      for (let c = 0; c < TC_COLS; c++) {
        const v = this._board[r * TC_COLS + c];
        if (v) this._cell(ctx, c, r, TC_COLORS[v]);
      }
    }

    // Ghost piece
    const gy = this._ghostY();
    if (gy !== this._cur.y) {
      ctx.globalAlpha = 0.18;
      for (let r = 0; r < this._cur.shape.length; r++) {
        for (let c = 0; c < this._cur.shape[r].length; c++) {
          if (!this._cur.shape[r][c]) continue;
          const cy = gy + r;
          if (cy >= 0) this._cell(ctx, this._cur.x + c, cy, TC_COLORS[this._cur.ci]);
        }
      }
      ctx.globalAlpha = 1;
    }

    // Active piece
    for (let r = 0; r < this._cur.shape.length; r++) {
      for (let c = 0; c < this._cur.shape[r].length; c++) {
        if (!this._cur.shape[r][c]) continue;
        const cy = this._cur.y + r;
        if (cy >= 0) this._cell(ctx, this._cur.x + c, cy, TC_COLORS[this._cur.ci]);
      }
    }

    // Board border
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(TC_OX, TC_OY, TC_COLS * TC_SZ, TC_ROWS * TC_SZ);
  },

  _cell(ctx, cx, cy, color) {
    const x = TC_OX + cx * TC_SZ + 1;
    const y = TC_OY + cy * TC_SZ + 1;
    const s = TC_SZ - 2;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, s, s);
    // top/left highlight
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x, y, s, 2);
    ctx.fillRect(x, y, 2, s);
    // bottom/right shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x + s - 2, y, 2, s);
    ctx.fillRect(x, y + s - 2, s, 2);
  },

  destroy() {
    document.removeEventListener('keydown',  this._onKD);
    document.removeEventListener('keyup',    this._onKU);
    this._canvas.removeEventListener('touchstart', this._onT);
  },
};

export default tetrisGame;
