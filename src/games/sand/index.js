// Sand — классический falling-sand: рисуешь мышью, песчинки сыплются вниз

let CELL = 4;            // пикселей на клетку (адаптивно, перевыч. в init)
let BRUSH_R = 3;         // радиус кисти в клетках (адаптивно)
const EMPTY  = 0;
const SAND   = 1;

// Цвета песка — несколько оттенков для живости (индекс 0 = пусто)
const SAND_COLORS = [
  null,
  '#c8a96e', '#d4b87a', '#b89558', '#dfc080', '#c29a62',
];

const sandGame = {
  name: 'sand',
  label: 'Песок',
  icon:  '⌛',

  init(canvas, ctx) {
    this._canvas = canvas;
    this._ctx    = ctx;

    // Адаптивный размер клетки: ~80-100 клеток по короткой стороне
    CELL = Math.max(2, Math.floor(Math.min(canvas.width, canvas.height) / 90));
    BRUSH_R = Math.max(2, Math.round(12 / CELL));

    this._cols = Math.floor(canvas.width  / CELL);
    this._rows = Math.floor(canvas.height / CELL);
    const size = this._cols * this._rows;

    // grid: тип клетки (EMPTY/SAND)
    // colorIdx: индекс цвета (0 = пусто, 1-5 = оттенки)
    this._grid     = new Uint8Array(size);
    this._colorIdx = new Uint8Array(size);

    // Offscreen canvas для рендера клеток — перерисовываем только изменённые
    this._offscreen    = document.createElement('canvas');
    this._offscreen.width  = canvas.width;
    this._offscreen.height = canvas.height;
    this._offCtx = this._offscreen.getContext('2d');
    this._offCtx.fillStyle = '#1a1208';
    this._offCtx.fillRect(0, 0, canvas.width, canvas.height);

    this._painting = false;
    this._cursorX  = 0;
    this._cursorY  = 0;
    this._cursorOn = false;

    this._onDown    = this._onDown.bind(this);
    this._onMove    = this._onMove.bind(this);
    this._onUp      = this._onUp.bind(this);
    this._onLeave   = this._onLeave.bind(this);
    this._onTouch   = this._onTouch.bind(this);
    this._onContext = this._onContext.bind(this);

    canvas.addEventListener('mousedown',   this._onDown);
    canvas.addEventListener('mousemove',   this._onMove);
    canvas.addEventListener('mouseup',     this._onUp);
    canvas.addEventListener('mouseleave',  this._onLeave);
    canvas.addEventListener('contextmenu', this._onContext);
    canvas.addEventListener('touchstart',  this._onTouch, { passive: true });
    canvas.addEventListener('touchmove',   this._onTouch, { passive: true });
    canvas.addEventListener('touchend',    this._onUp);
  },

  // --- ввод ---

  _clientToGrid(cx, cy) {
    const rect   = this._canvas.getBoundingClientRect();
    const scaleX = this._canvas.width  / rect.width;
    const scaleY = this._canvas.height / rect.height;
    return {
      col: Math.floor((cx - rect.left) * scaleX / CELL),
      row: Math.floor((cy - rect.top)  * scaleY / CELL),
    };
  },

  _onDown(e) {
    this._painting = true;
    const { col, row } = this._clientToGrid(e.clientX, e.clientY);
    this._paint(col, row);
  },

  _onMove(e) {
    const rect = this._canvas.getBoundingClientRect();
    this._cursorX = (e.clientX - rect.left) * (this._canvas.width  / rect.width);
    this._cursorY = (e.clientY - rect.top)  * (this._canvas.height / rect.height);
    this._cursorOn = true;
    if (!this._painting) return;
    const { col, row } = this._clientToGrid(e.clientX, e.clientY);
    this._paint(col, row);
  },

  _onUp() { this._painting = false; },

  _onLeave() { this._painting = false; this._cursorOn = false; },

  _onContext(e) { e.preventDefault(); this._clearAll(); },

  _clearAll() {
    this._grid.fill(EMPTY);
    this._colorIdx.fill(0);
    this._offCtx.fillStyle = '#1a1208';
    this._offCtx.fillRect(0, 0, this._offscreen.width, this._offscreen.height);
  },

  _onTouch(e) {
    const t = e.changedTouches[0];
    this._painting = e.type !== 'touchend';
    const { col, row } = this._clientToGrid(t.clientX, t.clientY);
    if (this._painting) this._paint(col, row);
  },

  _paint(col, row) {
    for (let dc = -BRUSH_R; dc <= BRUSH_R; dc++) {
      for (let dr = -BRUSH_R; dr <= BRUSH_R; dr++) {
        if (dc * dc + dr * dr > BRUSH_R * BRUSH_R) continue;
        // Не каждую клетку, чтобы кисть выглядела «россыпью»
        if (Math.random() < 0.4) continue;
        const c = col + dc;
        const r = row + dr;
        if (c < 0 || c >= this._cols || r < 0 || r >= this._rows) continue;
        const idx = r * this._cols + c;
        if (this._grid[idx] === EMPTY) {
          this._grid[idx]     = SAND;
          this._colorIdx[idx] = (1 + Math.floor(Math.random() * 5));
          this._drawCell(c, r);
        }
      }
    }
  },

  handleInput() {},
  pause() {},
  resume() {},

  // --- симуляция ---

  update(dt) {
    this._simulate();
    this._ctx.drawImage(this._offscreen, 0, 0);
    if (this._cursorOn) this._drawBrushPreview();
  },

  _drawBrushPreview() {
    const ctx = this._ctx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(this._cursorX, this._cursorY, BRUSH_R * CELL, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(210,175,100,0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.restore();
  },

  _simulate() {
    // Идём снизу вверх, случайный порядок по X чтобы не было направленного смещения
    for (let r = this._rows - 2; r >= 0; r--) {
      const leftFirst = Math.random() < 0.5;
      for (let ci = 0; ci < this._cols; ci++) {
        const c = leftFirst ? ci : (this._cols - 1 - ci);
        const idx = r * this._cols + c;
        if (this._grid[idx] !== SAND) continue;

        const below = idx + this._cols;
        if (this._grid[below] === EMPTY) {
          this._move(idx, below, c, r, c, r + 1);
          continue;
        }

        // Диагональ влево или вправо
        const dl = leftFirst ? -1 : 1;
        const dr2 = -dl;

        const bL = below + dl;
        const bR = below + dr2;
        const cL = c + dl;
        const cR = c + dr2;
        const lOk = cL >= 0 && cL < this._cols && this._grid[bL] === EMPTY;
        const rOk = cR >= 0 && cR < this._cols && this._grid[bR] === EMPTY;

        if (lOk && rOk) {
          if (Math.random() < 0.5) this._move(idx, bL, c, r, cL, r + 1);
          else                     this._move(idx, bR, c, r, cR, r + 1);
        } else if (lOk) {
          this._move(idx, bL, c, r, cL, r + 1);
        } else if (rOk) {
          this._move(idx, bR, c, r, cR, r + 1);
        }
      }
    }
  },

  _move(fromIdx, toIdx, fc, fr, tc, tr) {
    this._grid[toIdx]     = this._grid[fromIdx];
    this._colorIdx[toIdx] = this._colorIdx[fromIdx];
    this._grid[fromIdx]   = EMPTY;
    this._colorIdx[fromIdx] = 0;
    this._drawCell(fc, fr);
    this._drawCell(tc, tr);
  },

  _drawCell(c, r) {
    const x = c * CELL;
    const y = r * CELL;
    const ci = this._colorIdx[r * this._cols + c];
    if (ci === 0) {
      this._offCtx.fillStyle = '#1a1208';
    } else {
      this._offCtx.fillStyle = SAND_COLORS[ci];
    }
    this._offCtx.fillRect(x, y, CELL, CELL);
  },

  destroy() {
    this._canvas.removeEventListener('mousedown',   this._onDown);
    this._canvas.removeEventListener('mousemove',   this._onMove);
    this._canvas.removeEventListener('mouseup',     this._onUp);
    this._canvas.removeEventListener('mouseleave',  this._onLeave);
    this._canvas.removeEventListener('contextmenu', this._onContext);
    this._canvas.removeEventListener('touchstart',  this._onTouch);
    this._canvas.removeEventListener('touchmove',   this._onTouch);
    this._canvas.removeEventListener('touchend',    this._onUp);
  },
};

export default sandGame;
