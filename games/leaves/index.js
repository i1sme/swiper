const N_LEAVES = 22;

function makeLeaf(W, H, fromTop) {
  const size = 9 + Math.random() * 14;
  return {
    x:     Math.random() * W,
    y:     fromTop ? -size * 2 : Math.random() * H,
    vx:    (Math.random() - 0.5) * 35,
    vy:    18 + Math.random() * 28,
    angle: Math.random() * Math.PI * 2,
    spin:  (Math.random() - 0.5) * 3,
    size,
    hue:   15 + Math.random() * 55,
    sat:   65 + Math.random() * 35,
    lit:   32 + Math.random() * 22,
    alpha: 0.75 + Math.random() * 0.25,
    phase: Math.random() * Math.PI * 2,
  };
}

const leavesGame = {
  name:  'leaves',
  label: 'Листья',
  icon:  '🍂',

  init(canvas, ctx) {
    this._canvas = canvas;
    this._ctx    = ctx;
    this._W      = canvas.width;
    this._H      = canvas.height;
    this._t      = 0;
    this._mx     = -9999;
    this._my     = -9999;

    this._leaves = Array.from({ length: N_LEAVES }, () =>
      makeLeaf(canvas.width, canvas.height, false)
    );

    this._onMove  = this._onMove.bind(this);
    this._onLeave = () => { this._mx = -9999; this._my = -9999; };
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
    const src = e.touches ? e.touches[0] : e;
    const p   = this._pt(src.clientX, src.clientY);
    this._mx  = p.x;
    this._my  = p.y;
  },

  update(dt) {
    const s = Math.min(dt / 1000, 0.05);
    this._t += s;
    const { _W: W, _H: H, _leaves: leaves, _t: t, _mx: mx, _my: my } = this;
    const ctx = this._ctx;

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1a1005');
    sky.addColorStop(1, '#0e0802');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < leaves.length; i++) {
      const l = leaves[i];

      const dx = l.x - mx, dy = l.y - my;
      const d2 = dx * dx + dy * dy;
      if (d2 < 80 * 80 && d2 > 1) {
        const d  = Math.sqrt(d2);
        const f  = (1 - d / 80) * 180 * s;
        l.vx += (dx / d) * f;
        l.vy += (dy / d) * f - 25 * s;
      }

      l.vy  += 38 * s;
      l.vx  *= 1 - 1.8 * s;
      l.vy  *= 1 - 0.6 * s;
      l.vx  += Math.sin(t * 1.2 + l.phase) * 9 * s;
      l.x   += l.vx * s;
      l.y   += l.vy * s;
      l.angle += l.spin * s;

      if (l.y > H + l.size * 2) leaves[i] = makeLeaf(W, H, true);
      if (l.x < -l.size * 4)    l.x = W + l.size;
      if (l.x > W + l.size * 4) l.x = -l.size;

      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.angle);
      ctx.globalAlpha = l.alpha;

      const sz = l.size;
      ctx.fillStyle   = `hsl(${l.hue},${l.sat}%,${l.lit}%)`;
      ctx.strokeStyle = `hsl(${l.hue},${l.sat}%,${l.lit - 14}%)`;
      ctx.lineWidth   = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, -sz);
      ctx.bezierCurveTo( sz * 0.65, -sz * 0.45,  sz * 0.65, sz * 0.45, 0, sz);
      ctx.bezierCurveTo(-sz * 0.65,  sz * 0.45, -sz * 0.65, -sz * 0.45, 0, -sz);
      ctx.fill();
      ctx.stroke();

      ctx.globalAlpha = l.alpha * 0.45;
      ctx.strokeStyle = `hsl(${l.hue},${l.sat - 15}%,${l.lit - 8}%)`;
      ctx.lineWidth   = 0.7;
      ctx.beginPath();
      ctx.moveTo(0, -sz * 0.82);
      ctx.lineTo(0,  sz * 0.82);
      ctx.stroke();

      ctx.restore();
    }
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

export default leavesGame;
