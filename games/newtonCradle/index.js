// Колыбель Ньютона — 5 шаров на нитях, упругий удар, передача импульса.
// Тяни любой шарик мышью/пальцем, отпусти — наблюдай.

const N        = 5;
const BALL_R   = 13;
const L_STR    = 95;
const G_SIM    = 1100;
const DAMP_SEC = 0.9997;
const PIVOT_Y  = 32;
const MAX_THETA = 1.05; // ограничиваем угол, чтобы не было артефактов

function dampFactor(dtSec) {
  return Math.pow(DAMP_SEC, dtSec);
}

const newtonCradleGame = {
  name:  'newtonCradle',
  label: 'Колыбель Ньютона',
  icon:  '🔵',

  init(canvas, ctx) {
    this._canvas = canvas;
    this._ctx    = ctx;
    this._W      = canvas.width;
    this._H      = canvas.height;

    const cx      = this._W / 2;
    const spacing = BALL_R * 2 + 1;
    this._pivots  = Array.from({ length: N }, (_, i) =>
      cx + (i - Math.floor(N / 2)) * spacing
    );

    this._initState();

    this._onDown  = this._onDown.bind(this);
    this._onMove  = this._onMove.bind(this);
    this._onUp    = this._onUp.bind(this);
    canvas.addEventListener('mousedown',  this._onDown);
    canvas.addEventListener('mousemove',  this._onMove);
    canvas.addEventListener('mouseup',    this._onUp);
    canvas.addEventListener('mouseleave', this._onUp);
    canvas.addEventListener('touchstart', this._onDown, { passive: true });
    canvas.addEventListener('touchmove',  this._onMove, { passive: true });
    canvas.addEventListener('touchend',   this._onUp);
  },

  _initState() {
    this._lN     = 1;
    this._rN     = 0;
    this._lTheta = -0.52;
    this._rTheta = 0;
    this._lOmega = 0;
    this._rOmega = 0;
    this._prevLT = -0.52;
    this._prevRT = 0;
    this._drag   = null;
  },

  _getBallPos(i) {
    let theta;
    if (i < this._lN)           theta = this._lTheta;
    else if (i >= N - this._rN) theta = this._rTheta;
    else                        theta = 0;
    return {
      x: this._pivots[i] + Math.sin(theta) * L_STR,
      y: PIVOT_Y          + Math.cos(theta) * L_STR,
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
    for (let i = 0; i < N; i++) {
      const b = this._getBallPos(i);
      if (Math.hypot(b.x - pt.x, b.y - pt.y) < BALL_R + 12) {
        const isLeft = i < Math.floor(N / 2) ||
          (i === Math.floor(N / 2) && pt.x < this._pivots[Math.floor(N / 2)]);
        const curTheta = i < this._lN ? this._lTheta
          : (i >= N - this._rN && this._rN > 0 ? this._rTheta : 0);
        if (isLeft) {
          this._lN = i + 1; this._rN = 0;
          this._lTheta = Math.min(-0.01, curTheta); this._lOmega = 0;
          this._rTheta = 0; this._rOmega = 0;
          this._drag = { side: 'left' };
        } else {
          this._rN = N - i; this._lN = 0;
          this._rTheta = Math.max(0.01, curTheta); this._rOmega = 0;
          this._lTheta = 0; this._lOmega = 0;
          this._drag = { side: 'right' };
        }
        break;
      }
    }
  },

  _onMove(e) {
    if (!this._drag) return;
    const pt = this._clientToCanvas(
      e.touches ? e.touches[0].clientX : e.clientX,
      e.touches ? e.touches[0].clientY : e.clientY
    );
    if (this._drag.side === 'left') {
      const px = this._pivots[this._lN - 1];
      const dx = pt.x - px, dy = pt.y - PIVOT_Y;
      const angle = Math.atan2(dx, dy);
      this._lTheta = Math.max(-MAX_THETA, Math.min(-0.01, angle));
      this._lOmega = 0;
    } else {
      const px = this._pivots[N - this._rN];
      const dx = pt.x - px, dy = pt.y - PIVOT_Y;
      const angle = Math.atan2(dx, dy);
      this._rTheta = Math.min(MAX_THETA, Math.max(0.01, angle));
      this._rOmega = 0;
    }
  },

  _onUp() { this._drag = null; },

  handleInput() {},
  pause()  {},
  resume() {},

  update(dt) {
    const dtSec = Math.min(dt / 1000, 0.05);
    const ctx   = this._ctx;
    const W = this._W, H = this._H;

    if (!this._drag) {
      const damp = dampFactor(dtSec);

      if (this._lN > 0) {
        this._prevLT = this._lTheta;
        const alpha  = -(G_SIM / L_STR) * Math.sin(this._lTheta);
        this._lOmega += alpha * dtSec;
        this._lOmega *= damp;
        this._lTheta += this._lOmega * dtSec;
        // Не даём уйти слишком далеко — возможна физическая нестабильность
        if (Math.abs(this._lTheta) > MAX_THETA) {
          this._lTheta = Math.sign(this._lTheta) * MAX_THETA;
          this._lOmega *= -0.85;
        }
      }
      if (this._rN > 0) {
        this._prevRT = this._rTheta;
        const alpha  = -(G_SIM / L_STR) * Math.sin(this._rTheta);
        this._rOmega += alpha * dtSec;
        this._rOmega *= damp;
        this._rTheta += this._rOmega * dtSec;
        if (Math.abs(this._rTheta) > MAX_THETA) {
          this._rTheta = MAX_THETA * Math.sign(this._rTheta);
          this._rOmega *= -0.85;
        }
      }

      // Передача импульса: левая группа пересекает центр →
      if (this._lN > 0 && this._lOmega > 0 && this._prevLT < 0 && this._lTheta >= 0) {
        const n = this._lN, omega = this._lOmega;
        this._lN = 0; this._lTheta = 0; this._lOmega = 0;
        if (this._rN > 0 && this._rOmega < 0) {
          const tmpN = this._rN, tmpO = this._rOmega;
          this._rN = n; this._rOmega = omega; this._rTheta = 0;
          this._lN = tmpN; this._lOmega = tmpO; this._lTheta = 0;
        } else {
          this._rN = n; this._rOmega = omega; this._rTheta = 0;
        }
      }
      // Передача импульса: правая группа пересекает центр ←
      if (this._rN > 0 && this._rOmega < 0 && this._prevRT > 0 && this._rTheta <= 0) {
        const n = this._rN, omega = this._rOmega;
        this._rN = 0; this._rTheta = 0; this._rOmega = 0;
        if (this._lN > 0 && this._lOmega > 0) {
          const tmpN = this._lN, tmpO = this._lOmega;
          this._lN = n; this._lOmega = omega; this._lTheta = 0;
          this._rN = tmpN; this._rOmega = tmpO; this._rTheta = 0;
        } else {
          this._lN = n; this._lOmega = omega; this._lTheta = 0;
        }
      }
    }

    // ─── Рисование ───────────────────────────────────────────
    ctx.fillStyle = '#0e0e1c';
    ctx.fillRect(0, 0, W, H);

    this._drawFrame(ctx);
    this._drawShadows(ctx);
    this._drawStringsAndBalls(ctx);
    this._drawHint(ctx, W, H);
  },

  _drawFrame(ctx) {
    const barH  = 8;
    const barX0 = this._pivots[0]     - BALL_R * 3;
    const barX1 = this._pivots[N - 1] + BALL_R * 3;
    const legY1 = PIVOT_Y + 30;

    // Боковые стойки
    for (const [lx, ox] of [[barX0, -5], [barX1, 5]]) {
      ctx.save();
      const lg = ctx.createLinearGradient(lx, PIVOT_Y, lx + ox, legY1);
      lg.addColorStop(0, 'rgba(155,165,205,0.55)');
      lg.addColorStop(1, 'rgba(55,60,100,0.2)');
      ctx.strokeStyle = lg;
      ctx.lineWidth   = 3;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(lx,      PIVOT_Y);
      ctx.lineTo(lx + ox, legY1);
      ctx.stroke();
      ctx.restore();
    }

    // Верхняя перекладина
    ctx.save();
    ctx.shadowColor   = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur    = 7;
    ctx.shadowOffsetY = 3;
    const bg = ctx.createLinearGradient(barX0, PIVOT_Y - barH, barX0, PIVOT_Y);
    bg.addColorStop(0, 'rgba(205,212,238,0.6)');
    bg.addColorStop(1, 'rgba(105,112,158,0.4)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(barX0, PIVOT_Y - barH, barX1 - barX0, barH, 2);
    ctx.fill();
    // Тонкий блик
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(barX0 + 3, PIVOT_Y - barH + 1);
    ctx.lineTo(barX1 - 3, PIVOT_Y - barH + 1);
    ctx.stroke();
    ctx.restore();
  },

  _drawShadows(ctx) {
    const restY  = PIVOT_Y + L_STR;           // y шара в покое
    const floorY = restY + BALL_R + 24;       // «пол»
    for (let i = 0; i < N; i++) {
      const b = this._getBallPos(i);
      // Чем выше шар (меньше b.y), тем слабее и шире тень
      const lift   = Math.max(0, restY - b.y); // насколько поднят
      const spread = Math.max(0.15, 1 - lift / (L_STR * 0.8));
      const alpha  = 0.25 * spread;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = '#000014';
      ctx.beginPath();
      ctx.ellipse(b.x, floorY, BALL_R * (1.4 - spread * 0.4), BALL_R * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },

  _drawStringsAndBalls(ctx) {
    for (let i = 0; i < N; i++) {
      const b  = this._getBallPos(i);
      const px = this._pivots[i];
      ctx.save();
      ctx.strokeStyle = 'rgba(185,195,230,0.35)';
      ctx.lineWidth   = 1.1;
      ctx.beginPath();
      ctx.moveTo(px - BALL_R * 0.5, PIVOT_Y);
      ctx.lineTo(b.x - BALL_R * 0.5, b.y - BALL_R * 0.88);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px + BALL_R * 0.5, PIVOT_Y);
      ctx.lineTo(b.x + BALL_R * 0.5, b.y - BALL_R * 0.88);
      ctx.stroke();
      ctx.restore();
    }

    for (let i = 0; i < N; i++) {
      this._drawBall(ctx, i);
    }
  },

  _drawBall(ctx, i) {
    const b  = this._getBallPos(i);
    const hx = b.x - BALL_R * 0.36;
    const hy = b.y - BALL_R * 0.40;

    ctx.save();

    // Основной объём: смещённый градиент
    const g = ctx.createRadialGradient(hx, hy, BALL_R * 0.06, b.x, b.y, BALL_R);
    g.addColorStop(0,    '#dce8ff');
    g.addColorStop(0.22, '#a0baf0');
    g.addColorStop(0.60, '#4a64c0');
    g.addColorStop(1,    '#0a1440');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();

    // Тонкий тёмный обод
    ctx.strokeStyle = 'rgba(0,0,28,0.5)';
    ctx.lineWidth   = 0.7;
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    ctx.stroke();

    // Блик — небольшой полупрозрачный овал
    ctx.globalAlpha = 0.65;
    const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, BALL_R * 0.48);
    hg.addColorStop(0,   'rgba(255,255,255,0.9)');
    hg.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  _drawHint(ctx, W, H) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle   = '#a0b8ff';
    ctx.font        = '11px system-ui';
    ctx.textAlign   = 'center';
    ctx.fillText('тяни шарики', W / 2, H - 10);
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

export default newtonCradleGame;
