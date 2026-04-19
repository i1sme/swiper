const N_FLAKES = 300;

function makeFlake(cx, cy, gR) {
  const a = Math.random() * Math.PI * 2;
  const r = Math.random() * gR * 0.88;
  return {
    x:     cx + Math.cos(a) * r,
    y:     cy + Math.sin(a) * r,
    vx:    0,
    vy:    0,
    size:  0.8 + Math.random() * 2.2,
    alpha: 0.45 + Math.random() * 0.55,
  };
}

const snowGlobeGame = {
  name:  'snowGlobe',
  label: 'Снежный шар',
  icon:  '❄️',

  init(canvas, ctx) {
    this._canvas = canvas;
    this._ctx    = ctx;
    this._W      = canvas.width;
    this._H      = canvas.height;
    this._cx     = this._W / 2;
    this._cy     = this._H * 0.44;
    this._gR     = Math.min(this._W, this._H) * 0.41;

    this._flakes = Array.from({ length: N_FLAKES }, () =>
      makeFlake(this._cx, this._cy, this._gR)
    );

    this._mx  = this._cx;
    this._my  = this._cy;
    this._pmx = this._cx;
    this._pmy = this._cy;

    this._onMove = this._onMove.bind(this);
    canvas.addEventListener('mousemove', this._onMove);
    canvas.addEventListener('touchmove', this._onMove, { passive: true });
  },

  _pt(cx, cy) {
    const r = this._canvas.getBoundingClientRect();
    return {
      x: (cx - r.left) * (this._canvas.width  / r.width),
      y: (cy - r.top)  * (this._canvas.height / r.height),
    };
  },

  _onMove(e) {
    const src = e.touches ? e.touches[0] : e;
    const p   = this._pt(src.clientX, src.clientY);
    this._pmx = this._mx; this._pmy = this._my;
    this._mx  = p.x;      this._my  = p.y;
  },

  update(dt) {
    const s   = Math.min(dt / 1000, 0.05);
    const ctx = this._ctx;
    const { _W: W, _H: H, _cx: cx, _cy: cy, _gR: gR } = this;

    const mvx    = (this._mx - this._pmx) / (s || 0.016);
    const mvy    = (this._my - this._pmy) / (s || 0.016);
    const mSpeed = Math.hypot(mvx, mvy);
    this._pmx = this._mx; this._pmy = this._my;

    for (const f of this._flakes) {
      const dx = f.x - this._mx;
      const dy = f.y - this._my;
      const d2 = dx * dx + dy * dy;
      const stir = 65;
      if (mSpeed > 15 && d2 < stir * stir) {
        const d   = Math.sqrt(d2) || 1;
        const frc = (1 - d / stir) * mSpeed * 0.11;
        f.vx += (mvx / mSpeed) * frc + (Math.random() - 0.5) * frc * 0.5;
        f.vy += (mvy / mSpeed) * frc - Math.random() * frc * 0.3;
      }

      f.vy += 28 * s;
      f.vx *= 1 - 2.5 * s;
      f.vy *= 1 - 2.5 * s;
      f.vx += (Math.random() - 0.5) * 4 * s;
      f.x  += f.vx * s;
      f.y  += f.vy * s;

      const fdx = f.x - cx;
      const fdy = f.y - cy;
      const fd  = Math.sqrt(fdx * fdx + fdy * fdy);
      if (fd > gR - f.size) {
        const nx = fdx / fd, ny = fdy / fd;
        f.x = cx + nx * (gR - f.size - 0.5);
        f.y = cy + ny * (gR - f.size - 0.5);
        const dot = f.vx * nx + f.vy * ny;
        if (dot > 0) { f.vx -= dot * nx * 1.2; f.vy -= dot * ny * 1.2; }
      }
    }

    ctx.fillStyle = '#06080f';
    ctx.fillRect(0, 0, W, H);

    // Globe interior
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, gR, 0, Math.PI * 2);
    const bg = ctx.createRadialGradient(cx - gR * 0.25, cy - gR * 0.2, 0, cx, cy, gR);
    bg.addColorStop(0,   '#18264a');
    bg.addColorStop(0.65,'#0d1830');
    bg.addColorStop(1,   '#060c1c');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.restore();

    this._drawScene(ctx, cx, cy, gR);

    // Snowflakes (clipped to globe)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, gR - 1, 0, Math.PI * 2);
    ctx.clip();
    for (const f of this._flakes) {
      ctx.globalAlpha = f.alpha;
      ctx.fillStyle   = '#ddeeff';
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Glass sheen
    ctx.save();
    const sheen = ctx.createRadialGradient(cx - gR * 0.38, cy - gR * 0.3, gR * 0.05, cx, cy, gR);
    sheen.addColorStop(0,   'rgba(255,255,255,0.10)');
    sheen.addColorStop(0.4, 'rgba(255,255,255,0.03)');
    sheen.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, gR, 0, Math.PI * 2);
    ctx.fillStyle   = sheen;
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,190,255,0.28)';
    ctx.lineWidth   = 2;
    ctx.stroke();
    ctx.restore();

    this._drawBase(ctx, W, H, cx, cy, gR);
  },

  _drawScene(ctx, cx, cy, gR) {
    const groundY = cy + gR * 0.62;

    // Snow ground
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, groundY + 2, gR * 0.68, gR * 0.14, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(190,215,255,0.14)';
    ctx.fill();
    ctx.restore();

    // Tree
    const tx = cx, ty0 = groundY;
    const tH  = gR * 0.58;
    ctx.save();
    // Trunk
    ctx.fillStyle = '#1a1208';
    ctx.fillRect(tx - 4, ty0 - tH * 0.1, 8, tH * 0.12);
    // Layers
    for (let k = 0; k < 3; k++) {
      const lY = ty0 - tH * (0.08 + k * 0.28 + 0.28);
      const lW = gR * (0.22 - k * 0.04);
      ctx.beginPath();
      ctx.moveTo(tx, lY - tH * 0.27);
      ctx.lineTo(tx - lW, lY + tH * 0.07);
      ctx.lineTo(tx + lW, lY + tH * 0.07);
      ctx.closePath();
      ctx.fillStyle = `hsl(128,${28 + k * 6}%,${9 + k * 3}%)`;
      ctx.fill();
    }
    ctx.restore();
  },

  _drawBase(ctx, W, H, cx, cy, gR) {
    const baseY = cy + gR;
    const bW    = gR * 1.18;
    const bH    = H * 0.11;
    ctx.save();
    ctx.fillStyle = '#15090380';
    ctx.beginPath();
    ctx.ellipse(cx, baseY, bW, bH * 0.36, 0, Math.PI, 0);
    ctx.rect(cx - bW, baseY - 1, bW * 2, bH + 1);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,70,30,0.35)';
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.restore();
  },

  handleInput() {},
  pause()  {},
  resume() {},

  destroy() {
    this._canvas.removeEventListener('mousemove', this._onMove);
    this._canvas.removeEventListener('touchmove', this._onMove);
  },
};

export default snowGlobeGame;
