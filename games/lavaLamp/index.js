const N_BLOBS = 7;
const SC      = 4;     // 1 grid px = SC canvas px

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t)     { return a + (b - a) * t; }

const lavaLampGame = {
  name:  'lavaLamp',
  label: 'Лавовая лампа',
  icon:  '🫠',

  init(canvas, ctx) {
    this._canvas = canvas;
    this._ctx    = ctx;
    this._W      = canvas.width;
    this._H      = canvas.height;

    const W = this._W, H = this._H;

    // Tube geometry
    this._tx = Math.round(W * 0.19);
    this._tw = Math.round(W * 0.62);
    this._ty = Math.round(H * 0.05);
    this._th = Math.round(H * 0.86);

    // Pixel grid
    this._gW = Math.ceil(W / SC);
    this._gH = Math.ceil(H / SC);
    this._off = document.createElement('canvas');
    this._off.width  = this._gW;
    this._off.height = this._gH;
    this._xo = this._off.getContext('2d');
    this._id = this._xo.createImageData(this._gW, this._gH);

    const tL = this._tx, tR = this._tx + this._tw;
    const tT = this._ty, tB = this._ty + this._th;

    this._blobs = Array.from({ length: N_BLOBS }, () => {
      const r = 22 + Math.random() * 30;
      return {
        x:  lerp(tL + r, tR - r, Math.random()),
        y:  lerp(tT + r, tB - r, Math.random()),
        vx: (Math.random() - 0.5) * 28,
        vy: (Math.random() - 0.5) * 28,
        r, r2: r * r,
      };
    });
  },

  update(dt) {
    const s = Math.min(dt / 1000, 0.05);
    const { _W: W, _H: H, _blobs: blobs, _gW: gW, _gH: gH } = this;
    const { _tx: tx, _tw: tw, _ty: ty, _th: th } = this;
    const tL = tx, tR = tx + tw, tT = ty, tB = ty + th;

    // Physics
    for (const b of blobs) {
      const normY = (b.y - tT) / th;    // 0=top, 1=bottom
      const buoy  = (normY - 0.28) * 58;
      b.vy += -buoy * s;
      b.vx += (Math.random() - 0.5) * 28 * s;
      b.vy += (Math.random() - 0.5) * 14 * s;
      b.vx *= Math.pow(0.12, s);
      b.vy *= Math.pow(0.30, s);
      b.vx  = clamp(b.vx, -60, 60);
      b.vy  = clamp(b.vy, -85, 85);
      b.x  += b.vx * s;
      b.y  += b.vy * s;
      if (b.x < tL + b.r)  { b.x = tL + b.r;  b.vx =  Math.abs(b.vx) * 0.45; }
      if (b.x > tR - b.r)  { b.x = tR - b.r;  b.vx = -Math.abs(b.vx) * 0.45; }
      if (b.y < tT + b.r)  { b.y = tT + b.r;  b.vy =  Math.abs(b.vy) * 0.30; }
      if (b.y > tB - b.r)  { b.y = tB - b.r;  b.vy = -Math.abs(b.vy) * 0.30; }
    }

    // Metaball pixel rendering
    const data = this._id.data;
    for (let gy = 0; gy < gH; gy++) {
      const py = gy * SC;
      for (let gx = 0; gx < gW; gx++) {
        const px = gx * SC;
        const i  = (gy * gW + gx) * 4;

        if (px < tL || px > tR || py < tT || py > tB) {
          data[i + 3] = 0; continue;
        }

        let field = 0;
        for (const b of blobs) {
          const dx = px - b.x, dy = py - b.y;
          const d2 = dx * dx + dy * dy || 0.001;
          field += b.r2 / d2;
        }

        if (field >= 0.58) {
          const alpha = clamp((field - 0.58) / 0.52, 0, 1);
          const yr    = 1 - (py - tT) / th;   // 1=top, 0=bottom
          data[i]     = Math.round(lerp(205, 255, 1 - yr * 0.12));
          data[i + 1] = Math.round(lerp(88,  165, 1 - yr));
          data[i + 2] = Math.round(lerp(8,   28,  yr));
          data[i + 3] = Math.round(alpha * 245);
        } else {
          data[i + 3] = 0;
        }
      }
    }

    const ctx = this._ctx;
    ctx.fillStyle = '#040209';
    ctx.fillRect(0, 0, W, H);

    // Liquid background
    const liq = ctx.createLinearGradient(0, tT, 0, tB);
    liq.addColorStop(0,   '#0f0805');
    liq.addColorStop(0.5, '#180c06');
    liq.addColorStop(1,   '#1d0e06');
    ctx.fillStyle = liq;
    ctx.fillRect(tx, ty, tw, th);

    // Blobs (clipped to tube)
    this._xo.putImageData(this._id, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(tx, ty, tw, th);
    ctx.clip();
    ctx.drawImage(this._off, 0, 0, W, H);
    ctx.restore();

    this._drawTube(ctx, W, H, tx, tw, ty, th);
  },

  _drawTube(ctx, W, H, tx, tw, ty, th) {
    // Left glass reflection
    const refL = ctx.createLinearGradient(tx, 0, tx + tw * 0.14, 0);
    refL.addColorStop(0, 'rgba(255,185,70,0.13)');
    refL.addColorStop(1, 'rgba(255,185,70,0)');
    ctx.fillStyle = refL;
    ctx.fillRect(tx, ty, tw * 0.14, th);

    // Right shadow
    const refR = ctx.createLinearGradient(tx + tw * 0.86, 0, tx + tw, 0);
    refR.addColorStop(0, 'rgba(0,0,0,0)');
    refR.addColorStop(1, 'rgba(0,0,0,0.32)');
    ctx.fillStyle = refR;
    ctx.fillRect(tx + tw * 0.86, ty, tw * 0.14, th);

    ctx.strokeStyle = 'rgba(175,120,55,0.28)';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(tx, ty, tw, th);

    // Caps
    const capH = Math.round(H * 0.055);
    ctx.fillStyle = '#100802';
    ctx.fillRect(tx - 9, tT - capH, tw + 18, capH);
    ctx.fillRect(tx - 9, ty + th,   tw + 18, capH);
    ctx.strokeStyle = 'rgba(145,95,38,0.28)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(tx - 9, ty - capH, tw + 18, capH);
    ctx.strokeRect(tx - 9, ty + th,   tw + 18, capH);

    // Heat glow at base
    const glow = ctx.createRadialGradient(tx + tw / 2, ty + th + 18, 6, tx + tw / 2, ty + th + 18, tw * 0.68);
    glow.addColorStop(0, 'rgba(255,110,18,0.14)');
    glow.addColorStop(1, 'rgba(255,110,18,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, ty + th - 30, W, capH + 70);
  },

  handleInput() {},
  pause()  {},
  resume() {},

  destroy() {
    this._off = null;
    this._xo  = null;
    this._id  = null;
  },
};

export default lavaLampGame;
