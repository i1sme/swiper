const BANDS = [
  { hue: 138, amp: 0.095, freq: 0.011, speed: 0.16, yBase: 0.28, bw: 0.20 },
  { hue: 168, amp: 0.075, freq: 0.017, speed: 0.24, yBase: 0.37, bw: 0.16 },
  { hue: 278, amp: 0.085, freq: 0.009, speed: 0.11, yBase: 0.21, bw: 0.14 },
  { hue: 198, amp: 0.060, freq: 0.021, speed: 0.30, yBase: 0.44, bw: 0.11 },
  { hue: 122, amp: 0.065, freq: 0.014, speed: 0.19, yBase: 0.17, bw: 0.09 },
];

const N_STARS = 95;

const auroraGame = {
  name:  'aurora',
  label: 'Северное сияние',
  icon:  '🌌',

  init(canvas, ctx) {
    this._canvas = canvas;
    this._ctx    = ctx;
    this._W      = canvas.width;
    this._H      = canvas.height;
    this._t      = 0;
    this._mx     = canvas.width / 2;
    this._my     = canvas.height / 2;
    this._dstrb  = 0;

    this._stars = Array.from({ length: N_STARS }, () => ({
      x:  Math.random() * canvas.width,
      y:  Math.random() * canvas.height * 0.72,
      r:  0.4 + Math.random() * 1.4,
      a:  0.25 + Math.random() * 0.75,
      tw: Math.random() * Math.PI * 2,
      ts: 0.5 + Math.random() * 2.0,
    }));

    this._onMove  = this._onMove.bind(this);
    this._onLeave = () => { this._dstrb = 0; };
    canvas.addEventListener('mousemove',  this._onMove);
    canvas.addEventListener('mouseleave', this._onLeave);
    canvas.addEventListener('touchmove',  this._onMove, { passive: true });
  },

  _pt(cx, cy) {
    const r = this._canvas.getBoundingClientRect();
    return {
      x: (cx - r.left) * (this._canvas.width  / r.width),
      y: (cy - r.top)  * (this._canvas.height / r.height),
    };
  },

  _onMove(e) {
    const src     = e.touches ? e.touches[0] : e;
    const p       = this._pt(src.clientX, src.clientY);
    this._mx      = p.x;
    this._my      = p.y;
    this._dstrb   = 1.0;
  },

  update(dt) {
    const s = Math.min(dt / 1000, 0.05);
    this._t    += s;
    this._dstrb = Math.max(0, this._dstrb - s * 0.55);

    const { _W: W, _H: H, _t: t } = this;
    const ctx = this._ctx;

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0,   '#010408');
    sky.addColorStop(0.65,'#020819');
    sky.addColorStop(1,   '#06021a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    for (const st of this._stars) {
      const tw = Math.sin(t * st.ts + st.tw);
      ctx.globalAlpha = st.a * (0.55 + tw * 0.45);
      ctx.fillStyle   = '#cce8ff';
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (let bi = BANDS.length - 1; bi >= 0; bi--) {
      this._drawBand(ctx, BANDS[bi], W, H, t);
    }
  },

  _drawBand(ctx, band, W, H, t) {
    const { hue, amp, freq, speed, yBase, bw } = band;
    const STEPS  = 72;
    const stepW  = W / STEPS;
    const bandH  = H * bw;
    const dstrb  = this._dstrb;
    const mx     = this._mx;

    const pts = [];
    for (let i = 0; i <= STEPS; i++) {
      const x = i * stepW;
      let y = H * yBase
        + Math.sin(x * freq + t * speed)           * H * amp
        + Math.sin(x * freq * 1.73 + t * speed * 0.65) * H * amp * 0.38;
      if (dstrb > 0) {
        const dxm = x - mx;
        const dist = Math.abs(dxm);
        if (dist < W * 0.38) {
          const str = (1 - dist / (W * 0.38)) * dstrb;
          y += Math.sin(t * 2.8 + dxm * 0.04) * H * 0.055 * str;
        }
      }
      pts.push({ x, y });
    }

    // Curtain pillars: vertical alpha modulation
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].y + bandH);
    ctx.closePath();
    ctx.clip();

    // Base band gradient
    const midY = H * yBase;
    const grad = ctx.createLinearGradient(0, midY - 4, 0, midY + bandH);
    grad.addColorStop(0,   `hsla(${hue},95%,62%,0.60)`);
    grad.addColorStop(0.25,`hsla(${hue},90%,50%,0.38)`);
    grad.addColorStop(0.7, `hsla(${hue},85%,40%,0.12)`);
    grad.addColorStop(1,   `hsla(${hue},80%,35%,0.00)`);
    ctx.fillStyle   = grad;
    ctx.globalAlpha = 0.80;
    ctx.fillRect(0, midY - 20, W, bandH + 30);

    // Pillar highlights
    ctx.globalAlpha = 0.22;
    const nPillars = Math.ceil(W / 28);
    for (let p = 0; p < nPillars; p++) {
      const px   = p * 28 + Math.sin(t * 0.2 + p * 1.3) * 10;
      const pw   = 6 + Math.sin(t * 0.15 + p * 2.1) * 4;
      const palpha = 0.4 + Math.sin(t * 0.35 + p * 0.9) * 0.3;
      const pg   = ctx.createLinearGradient(px, midY, px, midY + bandH * 0.7);
      pg.addColorStop(0, `hsla(${hue},100%,80%,${palpha})`);
      pg.addColorStop(1, `hsla(${hue},100%,70%,0)`);
      ctx.fillStyle = pg;
      ctx.fillRect(px - pw / 2, midY - 5, pw, bandH * 0.75);
    }

    ctx.restore();
  },

  handleInput() {},
  pause()  {},
  resume() {},

  destroy() {
    this._canvas.removeEventListener('mousemove',  this._onMove);
    this._canvas.removeEventListener('mouseleave', this._onLeave);
    this._canvas.removeEventListener('touchmove',  this._onMove);
  },
};

export default auroraGame;
