// Генератор — крути ручку мышью/пальцем, вырабатывай ток.
// Мощность → лампочка (левая) + электровоз (правая панель).

import audio from '../../core/audio.js';

const GEN_CX     = 88;
const GEN_CY     = 108;
const CRANK_R    = 40;
const HANDLE_ORB = 32;
const MAX_OMEGA  = Math.PI * 5;   // ~2.5 об/с = 100% мощность (доступно для спокойного кручения)
const OMEGA_DECAY = 0.86;         // остаточный коэф. в секунду — мягче, инерция держится дольше

// 7-сегментный шрифт: порядок сегментов a,b,c,d,e,f,g
const SEG = [
  [1,1,1,1,1,1,0], // 0
  [0,1,1,0,0,0,0], // 1
  [1,1,0,1,1,0,1], // 2
  [1,1,1,1,0,0,1], // 3
  [0,1,1,0,0,1,1], // 4
  [1,0,1,1,0,1,1], // 5
  [1,0,1,1,1,1,1], // 6
  [1,1,1,0,0,0,0], // 7
  [1,1,1,1,1,1,1], // 8
  [1,1,1,1,0,1,1], // 9
];

function drawDigit(ctx, x, y, w, h, d, on, off) {
  const lw  = Math.max(1.5, w * 0.14);
  const hw  = w - lw;
  const hh  = h * 0.5 - lw;
  ctx.lineWidth = lw;
  ctx.lineCap   = 'round';
  // [x1,y1,x2,y2] per segment
  const seg = [
    [lw / 2, 0,         hw,   0        ], // a top
    [w,      lw / 2,    w,    hh       ], // b top-right
    [w,      h/2+lw/2,  w,    h-lw/2   ], // c bot-right
    [lw / 2, h,         hw,   h        ], // d bottom
    [0,      h/2+lw/2,  0,    h-lw/2   ], // e bot-left
    [0,      lw / 2,    0,    hh       ], // f top-left
    [lw / 2, h / 2,     hw,   h / 2    ], // g middle
  ];
  const mask = SEG[d] || SEG[0];
  for (let i = 0; i < 7; i++) {
    ctx.strokeStyle = mask[i] ? on : off;
    const [x1,y1,x2,y2] = seg[i];
    ctx.beginPath();
    ctx.moveTo(x + x1, y + y1);
    ctx.lineTo(x + x2, y + y2);
    ctx.stroke();
  }
}

// draws N-digit display; returns bounding width
function drawDisplay(ctx, x, y, value, nDigits, dw, dh, gap, unit) {
  const total = nDigits * dw + (nDigits - 1) * gap;
  ctx.fillStyle = '#0b1304';
  ctx.fillRect(x - 5, y - 5, total + 14 + (unit ? unit.length * dw * 0.7 + 2 : 0), dh + 10);

  const str = String(Math.min(Math.max(0, Math.round(value)), 10 ** nDigits - 1)).padStart(nDigits, '0');
  for (let i = 0; i < nDigits; i++) {
    drawDigit(ctx, x + i * (dw + gap), y, dw, dh, parseInt(str[i]), '#c8e040', '#1c2408');
  }
  if (unit) {
    ctx.save();
    ctx.fillStyle    = '#c8e040';
    ctx.font         = `bold ${Math.round(dh * 0.52)}px monospace`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(unit, x + total + 5, y + dh / 2);
    ctx.restore();
  }
}

const generatorGame = {
  name:  'generator',
  label: 'Генератор',
  icon:  '⚡',

  init(canvas, ctx) {
    this._canvas   = canvas;
    this._ctx      = ctx;
    this._W        = canvas.width;
    this._H        = canvas.height;
    this._angle       = 0;
    this._omega       = 0;
    this._power       = 0;
    this._smoothPower = 0;   // EMA от _power для плавности фона
    this._dragging    = false;
    this._prevAng     = 0;
    this._prevT       = 0;
    this._bgOff       = 0;
    this._sparks      = [];
    this._hint        = true;

    const starRx = Math.floor(this._W / 2);
    const starRw = Math.floor(this._W / 2);
    const starGY = this._H - 50;
    this._stars = Array.from({ length: 22 }, (_, i) => ({
      x: starRx + ((i * 41 + 17) % starRw),
      y: 5 + ((i * 29 + 13) % Math.floor(starGY * 0.44)),
      r: 0.5 + (i % 3) * 0.4,
    }));

    this._onDown  = this._onDown.bind(this);
    this._onMove  = this._onMove.bind(this);
    this._onUp    = this._onUp.bind(this);
    this._onTouch = this._onTouch.bind(this);

    canvas.addEventListener('mousedown',  this._onDown);
    canvas.addEventListener('mousemove',  this._onMove);
    canvas.addEventListener('mouseup',    this._onUp);
    canvas.addEventListener('mouseleave', this._onUp);
    canvas.addEventListener('touchstart', this._onTouch, { passive: true });
    canvas.addEventListener('touchmove',  this._onTouch, { passive: true });
    canvas.addEventListener('touchend',   this._onUp);

    this._motor = audio.motor();
  },

  _pt(cx, cy) {
    const r = this._canvas.getBoundingClientRect();
    return {
      x: (cx - r.left) * (this._W / r.width),
      y: (cy - r.top)  * (this._H / r.height),
    };
  },

  _onDown(e) {
    const { x, y } = this._pt(e.clientX, e.clientY);
    if (Math.hypot(x - GEN_CX, y - GEN_CY) < CRANK_R + 12) {
      this._dragging = true;
      this._prevAng  = Math.atan2(y - GEN_CY, x - GEN_CX);
      this._prevT    = performance.now();
    }
  },

  _onMove(e) {
    if (!this._dragging) return;
    const { x, y } = this._pt(e.clientX, e.clientY);
    const dx = x - GEN_CX, dy = y - GEN_CY;
    if (Math.hypot(dx, dy) < 6) return;

    const newAng = Math.atan2(dy, dx);
    const now    = performance.now();
    const dt     = Math.min((now - this._prevT) / 1000, 0.1);

    let delta = newAng - this._prevAng;
    if (delta >  Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;

    const inst     = dt > 0 ? delta / dt : 0;
    this._omega    = this._omega * 0.55 + inst * 0.45;
    this._angle    = newAng;
    this._prevAng  = newAng;
    this._prevT    = now;
    this._hint     = false;
  },

  _onUp() { this._dragging = false; },

  _onTouch(e) {
    const t = e.changedTouches[0];
    const ev = { clientX: t.clientX, clientY: t.clientY };
    if (e.type === 'touchstart')                      this._onDown(ev);
    else if (e.type === 'touchmove' && this._dragging) this._onMove(ev);
  },

  handleInput() {},
  pause()  {},
  resume() {},

  update(dt) {
    const s = Math.min(dt / 1000, 0.05);

    if (!this._dragging) this._omega *= Math.pow(OMEGA_DECAY, s);
    this._angle += this._omega * s;
    this._power  = Math.min(1, Math.abs(this._omega) / MAX_OMEGA);

    // Плавная (EMA) копия мощности — нужна для движения фона.
    // Без неё резкие скачки power давали "дёргающиеся" деревья и поезд.
    const followRate = 1 - Math.pow(0.001, s); // постоянная времени ~7 сек
    this._smoothPower += (this._power - this._smoothPower) * Math.min(1, followRate * 8);

    this._motor?.setSpeed(this._power);

    this._bgOff = (this._bgOff + this._smoothPower * 260 * s) % 260;

    // Spark spawn at high power
    if (this._power > 0.6 && Math.random() < this._power * 0.55) {
      this._spawnSparks();
    }
    for (let i = this._sparks.length - 1; i >= 0; i--) {
      const sp  = this._sparks[i];
      sp.x     += sp.vx * s;
      sp.y     += sp.vy * s;
      sp.vy    += 140 * s;
      sp.life  -= s * 3.5;
      if (sp.life <= 0) this._sparks.splice(i, 1);
    }

    this._draw();
  },

  _spawnSparks() {
    if (this._sparks.length >= 20) return;
    // Pantograph tip: right panel center minus 10, at H-121
    const px = this._W * 0.75 - 10;
    const py = this._H - 121;
    for (let i = 0; i < 2; i++) {
      const a   = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 1.4;
      const spd = 35 + Math.random() * 90;
      this._sparks.push({
        x:    px + (Math.random() - 0.5) * 18,
        y:    py + Math.random() * 8,
        vx:   Math.cos(a) * spd,
        vy:   Math.sin(a) * spd,
        life: 1.0,
      });
    }
  },

  _draw() {
    const ctx = this._ctx;
    const p   = this._power;
    const W   = this._W, H = this._H;

    ctx.clearRect(0, 0, W, H);
    this._drawLeft(ctx, p, W, H);
    this._drawRight(ctx, p, W, H);

    // Panel divider
    ctx.strokeStyle = 'rgba(100,130,160,0.22)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
    ctx.stroke();
  },

  // ── LEFT PANEL ───────────────────────────────────────────────────

  _drawLeft(ctx, p, W, H) {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W / 2, H); ctx.clip();

    ctx.fillStyle = '#141820';
    ctx.fillRect(0, 0, W / 2, H);

    // Panel title
    ctx.fillStyle  = 'rgba(140,165,200,0.5)';
    ctx.font       = '8px monospace';
    ctx.textAlign  = 'center';
    ctx.fillText('ГЕНЕРАТОР', GEN_CX, 13);

    // Generator housing
    ctx.fillStyle   = '#252f3d';
    ctx.strokeStyle = '#445566';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(GEN_CX - 50, GEN_CY - 50, 100, 100, 7);
    ctx.fill(); ctx.stroke();

    // Subtle hex-grid texture lines on housing
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth   = 0.5;
    for (let i = -3; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(GEN_CX - 50, GEN_CY + i * 16 - 8);
      ctx.lineTo(GEN_CX + 50, GEN_CY + i * 16 + 8);
      ctx.stroke();
    }

    // Crank wheel rim
    ctx.strokeStyle = '#5a7080';
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.arc(GEN_CX, GEN_CY, CRANK_R, 0, Math.PI * 2);
    ctx.stroke();

    // Spokes (4)
    ctx.strokeStyle = '#4a6070';
    ctx.lineWidth   = 2;
    for (let i = 0; i < 4; i++) {
      const a = this._angle + i * Math.PI * 0.5;
      ctx.beginPath();
      ctx.moveTo(GEN_CX, GEN_CY);
      ctx.lineTo(GEN_CX + Math.cos(a) * CRANK_R * 0.88, GEN_CY + Math.sin(a) * CRANK_R * 0.88);
      ctx.stroke();
    }

    // Centre hub
    ctx.fillStyle = '#5a7080';
    ctx.beginPath();
    ctx.arc(GEN_CX, GEN_CY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Crank handle
    const hx = GEN_CX + Math.cos(this._angle) * HANDLE_ORB;
    const hy = GEN_CY + Math.sin(this._angle) * HANDLE_ORB;
    ctx.save();
    if (p > 0.08) { ctx.shadowColor = '#cc8830'; ctx.shadowBlur = 8 + p * 10; }
    ctx.fillStyle = '#cc8830';
    ctx.beginPath();
    ctx.arc(hx, hy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,220,120,0.6)';
    ctx.beginPath();
    ctx.arc(hx - 2, hy - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Segmented display — watts
    const watts = p * 9999;
    drawDisplay(ctx, GEN_CX - 38, 176, watts, 4, 14, 24, 3, 'W');

    // Bulb
    this._drawBulb(ctx, p, GEN_CX, 248);

    // Hint
    if (this._hint) {
      ctx.fillStyle = 'rgba(140,165,200,0.4)';
      ctx.font      = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Крути ручку!', GEN_CX, GEN_CY + 64);
    }

    ctx.restore();
  },

  _drawBulb(ctx, p, cx, cy) {
    const r    = 13;
    const glow = p * p;

    ctx.save();
    // Outer glow
    if (glow > 0.02) {
      const gr = ctx.createRadialGradient(cx, cy - 2, 0, cx, cy, r * (3 + glow * 6));
      gr.addColorStop(0, `rgba(255,215,60,${(glow * 0.55).toFixed(2)})`);
      gr.addColorStop(1, 'rgba(255,200,40,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(cx - r * 8, cy - r * 8, r * 16, r * 16);
    }

    // Glass
    const lum = glow > 0.02 ? Math.round(38 + glow * 48) : 10;
    ctx.fillStyle   = `hsl(46,${glow > 0.02 ? 95 : 10}%,${lum}%)`;
    ctx.strokeStyle = '#445566';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy - 3, r, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Base
    ctx.fillStyle = '#445566';
    ctx.beginPath();
    ctx.roundRect(cx - 6, cy + r - 4, 12, 9, 2);
    ctx.fill();

    // Filament (visible when lit)
    if (glow > 0.03) {
      ctx.strokeStyle = `rgba(255,255,180,${Math.min(1, glow * 1.8).toFixed(2)})`;
      ctx.lineWidth   = 1;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy);
      ctx.lineTo(cx - 1, cy - 5);
      ctx.lineTo(cx + 1, cy);
      ctx.lineTo(cx + 3, cy - 5);
      ctx.stroke();
    }

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 8, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  // ── RIGHT PANEL ──────────────────────────────────────────────────

  _drawRight(ctx, p, W, H) {
    const rx = W / 2;
    const rw = W / 2;

    ctx.save();
    ctx.beginPath(); ctx.rect(rx, 0, rw, H); ctx.clip();

    // Sky
    const dim  = Math.round(p * 28);
    const sky  = ctx.createLinearGradient(0, 0, 0, H * 0.72);
    sky.addColorStop(0,   `rgb(${28 - dim},${50 - dim},${82 - dim})`);
    sky.addColorStop(0.7, `rgb(${50 - dim},${78 - dim},${110 - dim})`);
    sky.addColorStop(1,   `rgb(${72 - dim},${58 - dim},${38 - dim})`);
    ctx.fillStyle = sky;
    ctx.fillRect(rx, 0, rw, H);

    // Background scene
    this._drawBackground(ctx, p, rx, rw, H);

    // Ground strip
    ctx.fillStyle = '#221a10';
    ctx.fillRect(rx, H - 50, rw, 50);

    // Track sleepers
    ctx.strokeStyle = '#3e2e1a';
    ctx.lineWidth   = 4;
    ctx.lineCap     = 'butt';
    const sGap = 20;
    const sOff = this._bgOff % sGap;
    for (let x = rx - sOff; x < rx + rw + sGap; x += sGap) {
      ctx.beginPath();
      ctx.moveTo(x, H - 44);
      ctx.lineTo(x, H - 23);
      ctx.stroke();
    }

    // Rails
    ctx.strokeStyle = '#6a5a42';
    ctx.lineWidth   = 3;
    ctx.lineCap     = 'round';
    [H - 40, H - 27].forEach(y => {
      ctx.beginPath();
      ctx.moveTo(rx, y); ctx.lineTo(rx + rw, y);
      ctx.stroke();
    });

    // Locomotive
    this._drawLocomotive(ctx, p, rx, rw, H);

    // Sparks
    ctx.save();
    for (const sp of this._sparks) {
      const a = sp.life;
      ctx.fillStyle   = `rgba(255,${180 + Math.round(a * 75)},30,${a.toFixed(2)})`;
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur  = 5;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 1.2 + sp.life * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Speed display — km/h
    drawDisplay(ctx, rx + rw - 74, H - 28, p * 350, 3, 10, 18, 2, 'km/h');

    ctx.restore();
  },

  _drawBackground(ctx, p, rx, rw, H) {
    const groundY = H - 50;

    // Moon
    ctx.save();
    ctx.globalAlpha = Math.max(0, (1 - p * 1.6) * 0.85);
    ctx.fillStyle = '#f0e8c0';
    ctx.shadowColor = '#f0e8c0';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(rx + rw * 0.18, H * 0.09, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Stars — visible dots at low speed, horizontal streaks at high speed
    ctx.save();
    for (const s of this._stars) {
      if (p < 0.55) {
        ctx.globalAlpha = (1 - p * 1.6) * 0.75;
        ctx.fillStyle = '#d0dcff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (p < 0.88) {
        const streakLen = (p - 0.5) * rw * 0.65;
        ctx.globalAlpha = (1 - p) * 0.55;
        ctx.fillStyle = '#c8d4ff';
        ctx.fillRect(s.x - streakLen, s.y - 0.5, streakLen, 1);
      }
    }
    ctx.restore();

    // Mountain silhouette — fades as speed increases
    const mountA = Math.max(0, 1 - p * 1.25);
    if (mountA > 0.01) {
      ctx.save();
      ctx.globalAlpha = mountA * 0.55;
      ctx.fillStyle = '#182030';
      ctx.beginPath();
      ctx.moveTo(rx,              groundY * 0.44);
      ctx.lineTo(rx + rw * 0.10, groundY * 0.20);
      ctx.lineTo(rx + rw * 0.22, groundY * 0.34);
      ctx.lineTo(rx + rw * 0.38, groundY * 0.13);
      ctx.lineTo(rx + rw * 0.52, groundY * 0.30);
      ctx.lineTo(rx + rw * 0.66, groundY * 0.17);
      ctx.lineTo(rx + rw * 0.80, groundY * 0.28);
      ctx.lineTo(rx + rw,        groundY * 0.42);
      ctx.lineTo(rx + rw,        groundY);
      ctx.lineTo(rx,             groundY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Discrete elements: poles + trees — fade as speed increases
    const elemA = Math.max(0, 1 - p * 1.3);
    if (elemA > 0.02) {
      const spacing = 42;
      const off     = this._bgOff % spacing;
      ctx.save();
      ctx.globalAlpha = elemA;
      let idx = 0;
      for (let x = rx - off; x < rx + rw + spacing; x += spacing, idx++) {
        ctx.fillStyle = 'rgba(50,40,30,0.75)';
        ctx.fillRect(x + 4, groundY * 0.28, 3, groundY * 0.72);
        if (idx % 2 === 0) {
          ctx.fillStyle = 'rgba(18,38,22,0.8)';
          ctx.beginPath();
          ctx.moveTo(x + 5,  groundY * 0.28);
          ctx.lineTo(x + 20, groundY * 0.54);
          ctx.lineTo(x - 10, groundY * 0.54);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Speed streaks (motion blur) — ramp up from p=0.45
    if (p > 0.45) {
      const streakA = Math.min(1, (p - 0.45) * 2.2);
      ctx.save();
      for (let y = 12; y < groundY; y += 4) {
        const len = (40 + y * 0.75) * streakA;
        const hue = 200 + (y % 55);
        const lt  = 30 + y / groundY * 35;
        ctx.fillStyle = `hsla(${hue},45%,${Math.round(lt)}%,${(streakA * 0.09).toFixed(2)})`;
        ctx.fillRect(rx + rw - len - 5, y, len, 1.5);
      }
      ctx.restore();
    }
  },

  _drawLocomotive(ctx, p, rx, rw, H) {
    const lx  = rx + rw * 0.5;       // centre of right panel
    const ly  = H - 52;              // bottom edge of train body
    const bw  = 114;
    const bh  = 38;
    const winL = Math.round(38 + p * p * 55); // window lightness

    ctx.save();

    // --- Body ---
    ctx.fillStyle   = '#28333f';
    ctx.strokeStyle = '#3d5060';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(lx - bw / 2, ly - bh, bw, bh, 4);
    ctx.fill(); ctx.stroke();

    // Front cab face (darker)
    ctx.fillStyle = '#1e2830';
    ctx.beginPath();
    ctx.roundRect(lx + bw / 2 - 30, ly - bh, 30, bh, [0, 4, 4, 0]);
    ctx.fill();

    // --- Windows ---
    ctx.save();
    const winColor = p > 0.05 ? `hsl(46,90%,${winL}%)` : '#1a2030';
    ctx.fillStyle  = winColor;
    if (p > 0.25) { ctx.shadowColor = winColor; ctx.shadowBlur = 4 + p * 14; }
    // Side windows
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.roundRect(lx - bw / 2 + 10 + i * 25, ly - bh + 8, 18, 14, 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    // Front windshield
    ctx.fillStyle = p > 0.05 ? `hsl(46,80%,${Math.min(90, winL + 8)}%)` : '#1a2030';
    if (p > 0.25) { ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 6 + p * 16; }
    ctx.beginPath();
    ctx.roundRect(lx + bw / 2 - 26, ly - bh + 5, 20, 20, 2);
    ctx.fill();
    ctx.restore();

    // --- Roof strip ---
    ctx.fillStyle = '#1e2830';
    ctx.beginPath();
    ctx.roundRect(lx - bw / 2 + 4, ly - bh - 7, bw - 8, 9, 2);
    ctx.fill();

    // --- Pantograph ---
    const pTX = lx - 10;
    const pTY = ly - bh - 30;
    ctx.strokeStyle = p > 0.3 ? `hsl(${195 + p * 35},75%,${50 + Math.round(p * 25)}%)` : '#4a6070';
    ctx.lineWidth   = 1.5;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(lx - 32, ly - bh - 1);
    ctx.lineTo(pTX,     pTY);
    ctx.lineTo(lx + 12, ly - bh - 1);
    ctx.stroke();
    // Contact bar
    ctx.beginPath();
    ctx.moveTo(pTX - 13, pTY);
    ctx.lineTo(pTX + 13, pTY);
    ctx.stroke();

    // Overhead wire
    ctx.strokeStyle = 'rgba(110,130,155,0.35)';
    ctx.lineWidth   = 0.8;
    ctx.beginPath();
    ctx.moveTo(rx, pTY); ctx.lineTo(rx + rw, pTY);
    ctx.stroke();

    // Pantograph arc glow at high power
    if (p > 0.5) {
      const arcA = (p - 0.5) * 2;
      ctx.save();
      ctx.shadowColor = '#70d0ff';
      ctx.shadowBlur  = 12 + p * 22;
      ctx.fillStyle   = `rgba(110,210,255,${arcA.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(pTX, pTY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // --- Wheels ---
    ctx.fillStyle   = '#2e3c48';
    ctx.strokeStyle = '#445566';
    ctx.lineWidth   = 2;
    const wheelY = ly + 9;
    for (const wx of [lx - 38, lx - 14, lx + 14, lx + 40]) {
      ctx.beginPath();
      ctx.arc(wx, wheelY, 11, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#445566';
      ctx.beginPath();
      ctx.arc(wx, wheelY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2e3c48';
    }

    ctx.restore();
  },

  destroy() {
    this._canvas.removeEventListener('mousedown',  this._onDown);
    this._canvas.removeEventListener('mousemove',  this._onMove);
    this._canvas.removeEventListener('mouseup',    this._onUp);
    this._canvas.removeEventListener('mouseleave', this._onUp);
    this._canvas.removeEventListener('touchstart', this._onTouch);
    this._canvas.removeEventListener('touchmove',  this._onTouch);
    this._canvas.removeEventListener('touchend',   this._onUp);
    this._motor?.stop();
    this._motor = null;
  },
};

export default generatorGame;
