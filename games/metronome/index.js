// Метроном — механический, как настоящий. Тяни грузик на стержне:
// вверх → медленнее, вниз → быстрее.

const BPM_MIN  = 40;
const BPM_MAX  = 208;
const AMP_TGT  = 0.44;  // целевая амплитуда маятника (рад)
const VDP_K    = 2.5;   // коэффициент Van der Pol (поддержание амплитуды)
const ROD_LEN  = 148;   // длина стержня выше оси
const TAIL_LEN = 30;    // длина хвоста ниже оси (противовес)

// BPM → позиция грузика на стержне (0 = ось, 1 = кончик)
// Высокий BPM = грузик ниже (wt мало), низкий BPM = грузик выше (wt велико)
function bpmToWt(bpm) {
  const t = (bpm - BPM_MIN) / (BPM_MAX - BPM_MIN);
  return 0.91 - t * 0.68;  // 0.91 (медленно) … 0.23 (быстро)
}

function wtToBpm(wt) {
  const t = (0.91 - wt) / 0.68;
  return Math.round(Math.max(BPM_MIN, Math.min(BPM_MAX, BPM_MIN + t * (BPM_MAX - BPM_MIN))));
}

function tempoLabel(bpm) {
  if (bpm < 60)  return 'Largo';
  if (bpm < 66)  return 'Larghetto';
  if (bpm < 76)  return 'Adagio';
  if (bpm < 108) return 'Andante';
  if (bpm < 120) return 'Moderato';
  if (bpm < 156) return 'Allegro';
  if (bpm < 176) return 'Vivace';
  if (bpm < 200) return 'Presto';
  return 'Prestissimo';
}

// BPM-отметки на шкале (реальные метрономы Wittner)
const SCALE_MARKS = [
  { bpm: 40  }, { bpm: 50  }, { bpm: 60  }, { bpm: 66  },
  { bpm: 72  }, { bpm: 80  }, { bpm: 88  }, { bpm: 96  },
  { bpm: 104 }, { bpm: 112 }, { bpm: 120 }, { bpm: 132 },
  { bpm: 144 }, { bpm: 160 }, { bpm: 176 }, { bpm: 192 }, { bpm: 208 },
];

const metronomeGame = {
  name:  'metronome',
  label: 'Метроном',
  icon:  '🎵',

  init(canvas, ctx) {
    this._canvas = canvas;
    this._ctx    = ctx;
    this._W      = canvas.width;
    this._H      = canvas.height;

    // Ось маятника: в нижней части, корпус выше неё
    this._pivotX = Math.round(this._W / 2);
    this._pivotY = Math.round(this._H * 0.66);

    this._bpm       = 96;
    this._wt        = bpmToWt(this._bpm);
    this._theta     = AMP_TGT;
    this._omega     = 0;
    this._prevSign  = 1;
    this._tickFlash = 0;
    this._dragging  = false;

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

  // Позиция грузика (в пространстве canvas)
  _weightPos() {
    return {
      x: this._pivotX + Math.sin(this._theta) * ROD_LEN * this._wt,
      y: this._pivotY - Math.cos(this._theta) * ROD_LEN * this._wt,
    };
  },
  // Кончик стержня
  _tipPos() {
    return {
      x: this._pivotX + Math.sin(this._theta) * ROD_LEN,
      y: this._pivotY - Math.cos(this._theta) * ROD_LEN,
    };
  },
  // Хвост (противовес)
  _tailPos() {
    return {
      x: this._pivotX - Math.sin(this._theta) * TAIL_LEN,
      y: this._pivotY + Math.cos(this._theta) * TAIL_LEN,
    };
  },

  _clientToCanvas(cx, cy) {
    const r = this._canvas.getBoundingClientRect();
    return {
      x: (cx - r.left) * (this._canvas.width  / r.width),
      y: (cy - r.top)  * (this._canvas.height / r.height),
    };
  },

  _onDown(e) {
    const pt = this._clientToCanvas(
      e.touches ? e.touches[0].clientX : e.clientX,
      e.touches ? e.touches[0].clientY : e.clientY
    );
    const w = this._weightPos();
    if (Math.hypot(pt.x - w.x, pt.y - w.y) < 20) {
      this._dragging = true;
    }
  },

  _onMove(e) {
    if (!this._dragging) return;
    const pt = this._clientToCanvas(
      e.touches ? e.touches[0].clientX : e.clientX,
      e.touches ? e.touches[0].clientY : e.clientY
    );
    // Проекция точки касания на ось стержня
    const rdx  = Math.sin(this._theta);
    const rdy  = -Math.cos(this._theta);
    const proj = (pt.x - this._pivotX) * rdx + (pt.y - this._pivotY) * rdy;
    this._wt   = Math.max(0.23, Math.min(0.91, proj / ROD_LEN));
    this._bpm  = wtToBpm(this._wt);
  },

  _onUp() { this._dragging = false; },

  handleInput() {},
  pause()  {},
  resume() {},

  update(dt) {
    const dtSec = Math.min(dt / 1000, 0.05);
    const ctx   = this._ctx;
    const W = this._W, H = this._H;

    // Физика: гармонический осциллятор + Van der Pol поддержание амплитуды
    const omega0   = Math.PI * this._bpm / 60;
    const k        = omega0 * omega0;
    const prevSign = Math.sign(this._theta);

    this._omega += -k * this._theta * dtSec;
    this._omega += VDP_K * (1 - (this._theta / AMP_TGT) ** 2) * this._omega * dtSec;
    this._theta += this._omega * dtSec;

    // Тик при пересечении вертикали
    const newSign = Math.sign(this._theta);
    if (prevSign !== 0 && newSign !== 0 && newSign !== prevSign) {
      this._tickFlash = 0.14;
    }
    if (this._tickFlash > 0) this._tickFlash -= dtSec;

    // ─── Рисование ───────────────────────────────────────────
    ctx.fillStyle = '#100c08';
    ctx.fillRect(0, 0, W, H);

    this._drawCase(ctx, W, H);
    this._drawRod(ctx);
    this._drawWeight(ctx);
    this._drawBpmInfo(ctx, W, H);
  },

  _drawCase(ctx, W, H) {
    const cx = W / 2;
    const py = this._pivotY;

    // Корпус: трапеция, верх немного выше оси
    const caseTop    = py - 22;
    const caseBottom = H - 14;
    const tw = 50, bw = 120;  // ширина верха / основания

    // Тень корпуса
    ctx.save();
    ctx.shadowColor   = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur    = 22;
    ctx.shadowOffsetY = 10;
    ctx.beginPath();
    ctx.moveTo(cx - tw / 2, caseTop);
    ctx.lineTo(cx + tw / 2, caseTop);
    ctx.lineTo(cx + bw / 2, caseBottom);
    ctx.lineTo(cx - bw / 2, caseBottom);
    ctx.closePath();

    // Дерево: тёмный орех с горизонтальным волокном
    const wood = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
    wood.addColorStop(0,    '#160e06');
    wood.addColorStop(0.08, '#2e1c0a');
    wood.addColorStop(0.25, '#50320e');
    wood.addColorStop(0.46, '#6a4418');
    wood.addColorStop(0.54, '#6a4418');
    wood.addColorStop(0.75, '#50320e');
    wood.addColorStop(0.92, '#2e1c0a');
    wood.addColorStop(1,    '#160e06');
    ctx.fillStyle = wood;
    ctx.fill();
    ctx.restore();

    // Обводка
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - tw / 2, caseTop);
    ctx.lineTo(cx + tw / 2, caseTop);
    ctx.lineTo(cx + bw / 2, caseBottom);
    ctx.lineTo(cx - bw / 2, caseBottom);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(190,130,50,0.45)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.restore();

    // Лёгкий вертикальный блик (лак)
    ctx.save();
    const sheen = ctx.createLinearGradient(cx - 30, 0, cx + 30, 0);
    sheen.addColorStop(0,    'rgba(255,210,100,0)');
    sheen.addColorStop(0.38, 'rgba(255,210,100,0.07)');
    sheen.addColorStop(0.50, 'rgba(255,210,100,0.11)');
    sheen.addColorStop(0.62, 'rgba(255,210,100,0.07)');
    sheen.addColorStop(1,    'rgba(255,210,100,0)');
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.moveTo(cx - tw / 2, caseTop);
    ctx.lineTo(cx + tw / 2, caseTop);
    ctx.lineTo(cx + bw / 2, caseBottom);
    ctx.lineTo(cx - bw / 2, caseBottom);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Шкала BPM — отметки на левой грани корпуса (и чуть выше)
    this._drawScale(ctx, cx, caseTop);

    // Плинтус-основание
    ctx.save();
    ctx.fillStyle = '#0c0804';
    ctx.beginPath();
    ctx.roundRect(cx - bw / 2 - 5, caseBottom - 1, bw + 10, 13, [0, 0, 4, 4]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,90,20,0.35)';
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.restore();
  },

  _drawScale(ctx, cx, caseTop) {
    ctx.save();
    ctx.font      = '7px monospace';
    ctx.textAlign = 'right';

    for (const m of SCALE_MARKS) {
      const wt = bpmToWt(m.bpm);
      // y-позиция грузика при theta=0 для данного BPM
      const my = this._pivotY - wt * ROD_LEN;

      const dist   = Math.abs(this._bpm - m.bpm);
      const active = dist < 6;
      const nearby = dist < 20;

      ctx.globalAlpha = active ? 0.92 : nearby ? 0.48 : 0.24;

      // Штришок
      const x1 = cx - 6;
      const x0 = x1 - (active ? 10 : nearby ? 7 : 5);
      ctx.strokeStyle = active ? '#f0d060' : '#a07828';
      ctx.lineWidth   = active ? 1.4 : 0.8;
      ctx.beginPath();
      ctx.moveTo(x0, my);
      ctx.lineTo(x1, my);
      ctx.stroke();

      // Число для заметных меток (каждые 20 BPM + соседние активные)
      const labeled = m.bpm % 20 === 0 || active;
      if (labeled) {
        ctx.fillStyle = active ? '#f8dc78' : '#b08830';
        ctx.fillText(String(m.bpm), x0 - 2, my + 2.5);
      }
    }
    ctx.restore();
  },

  _drawRod(ctx) {
    const tip  = this._tipPos();
    const tail = this._tailPos();
    const px   = this._pivotX;
    const py   = this._pivotY;

    // Хвост (противовес)
    ctx.save();
    ctx.strokeStyle = '#a08030';
    ctx.lineWidth   = 3.5;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tail.x, tail.y);
    ctx.stroke();
    ctx.restore();

    // Основной стержень с металлическим блеском
    ctx.save();
    // Используем немного сдвинутый линейный градиент поперёк стержня
    const perpX = -Math.cos(this._theta);
    const perpY = -Math.sin(this._theta);
    const gx0 = px + perpX * 3;
    const gy0 = py + perpY * 3;
    const gx1 = px - perpX * 3;
    const gy1 = py - perpY * 3;
    const rg = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    rg.addColorStop(0,   '#806010');
    rg.addColorStop(0.3, '#d4a820');
    rg.addColorStop(0.5, '#f8e060');
    rg.addColorStop(0.7, '#d4a820');
    rg.addColorStop(1,   '#806010');
    ctx.strokeStyle = rg;
    ctx.lineWidth   = 2.8;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.restore();

    // Шар-кончик стержня
    ctx.save();
    ctx.fillStyle = '#f0d850';
    ctx.strokeStyle = '#806010';
    ctx.lineWidth   = 0.8;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Ось (pivot)
    ctx.save();
    const pg = ctx.createRadialGradient(px - 1, py - 1, 0, px, py, 5.5);
    pg.addColorStop(0, '#ffe870');
    pg.addColorStop(1, '#7a5800');
    ctx.fillStyle   = pg;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth   = 0.8;
    ctx.beginPath();
    ctx.arc(px, py, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },

  _drawWeight(ctx) {
    const w      = this._weightPos();
    const flash  = Math.max(0, this._tickFlash / 0.14);
    const wW = 20, wH = 13;

    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(this._theta);

    if (flash > 0) {
      ctx.shadowColor = `rgba(255,210,60,${flash * 0.75})`;
      ctx.shadowBlur  = 16;
    }

    // Тело грузика — прямоугольник со скруглёнными углами
    const wg = ctx.createLinearGradient(-wW / 2, -wH / 2, wW / 2, wH / 2);
    wg.addColorStop(0,    '#fff0a0');
    wg.addColorStop(0.25, '#f0c830');
    wg.addColorStop(0.6,  '#c08810');
    wg.addColorStop(1,    '#6a4400');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.roundRect(-wW / 2, -wH / 2, wW, wH, 3);
    ctx.fill();

    // Горизонтальные прорези — имитация реального скользящего грузика
    ctx.strokeStyle = 'rgba(80,40,0,0.4)';
    ctx.lineWidth   = 0.8;
    for (const dy of [-wH * 0.2, wH * 0.2]) {
      ctx.beginPath();
      ctx.moveTo(-wW / 2 + 4, dy);
      ctx.lineTo( wW / 2 - 4, dy);
      ctx.stroke();
    }

    // Обводка
    ctx.strokeStyle = 'rgba(255,230,90,0.55)';
    ctx.lineWidth   = 0.8;
    ctx.beginPath();
    ctx.roundRect(-wW / 2, -wH / 2, wW, wH, 3);
    ctx.stroke();

    ctx.restore();
  },

  _drawBpmInfo(ctx, W, H) {
    const cx = W / 2;
    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#e8c050';
    ctx.font         = 'bold 18px monospace';
    ctx.fillText(String(this._bpm), cx, H - 32);
    ctx.globalAlpha  = 0.5;
    ctx.font         = 'italic 9px serif';
    ctx.fillText(tempoLabel(this._bpm), cx, H - 18);
    ctx.restore();
  },

  destroy() {
    this._canvas.removeEventListener('mousedown',  this._onDown);
    this._canvas.removeEventListener('mousemove',  this._onMove);
    this._canvas.removeEventListener('mouseup',    this._onUp);
    this._canvas.removeEventListener('mouseleave', this._onUp);
    this._canvas.removeEventListener('touchstart', this._onDown);
    this._canvas.removeEventListener('touchmove',  this._onMove);
    this._canvas.removeEventListener('touchend',   this._onUp);
  },
};

export default metronomeGame;
