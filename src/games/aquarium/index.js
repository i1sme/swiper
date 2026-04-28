const N_FISH   = 6;
const FOOD_G   = 28;   // gravity px/s²
const EAT_R    = 18;   // eat radius px

function rnd(lo, hi) { return lo + Math.random() * (hi - lo); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

const FISH_COLORS = [
  { hue: 25,  sat: 90, lit: 52 },   // orange
  { hue: 200, sat: 80, lit: 45 },   // blue
  { hue: 340, sat: 85, lit: 48 },   // red
  { hue: 160, sat: 75, lit: 40 },   // teal
  { hue: 50,  sat: 88, lit: 50 },   // yellow
  { hue: 280, sat: 70, lit: 50 },   // purple
];

function makeFish(W, H, idx) {
  const c = FISH_COLORS[idx % FISH_COLORS.length];
  return {
    x:    rnd(W * 0.1, W * 0.9),
    y:    rnd(H * 0.25, H * 0.75),
    vx:   (Math.random() - 0.5) * 35,
    vy:   (Math.random() - 0.5) * 15,
    angle:  Math.random() * Math.PI * 2,
    size:   13 + Math.random() * 10,
    speed:  42 + Math.random() * 26,
    phase:  idx * 1.1,
    hue:    c.hue, sat: c.sat, lit: c.lit,
    tailT:  Math.random() * Math.PI * 2,
  };
}

const aquariumGame = {
  name:  'aquarium',
  label: 'Аквариум',
  icon:  '🐟',

  init(canvas, ctx) {
    this._canvas  = canvas;
    this._ctx     = ctx;
    this._W       = canvas.width;
    this._H       = canvas.height;
    this._t       = 0;
    this._fish    = Array.from({ length: N_FISH }, (_, i) => makeFish(canvas.width, canvas.height, i));
    this._food    = [];
    this._bubbles = [];
    this._bTimer  = 0;

    // Кешированные градиенты — ширина/высота фиксированы пока canvas не пересоздан
    this._bgGrad = ctx.createLinearGradient(0, 0, 0, this._H);
    this._bgGrad.addColorStop(0,    '#051520');
    this._bgGrad.addColorStop(0.55, '#071e2e');
    this._bgGrad.addColorStop(1,    '#030810');

    this._rayGrad = ctx.createLinearGradient(0, 0, 0, this._H);
    this._rayGrad.addColorStop(0, 'rgba(170,215,255,1)');
    this._rayGrad.addColorStop(1, 'rgba(170,215,255,0)');

    this._onClick = this._onClick.bind(this);
    canvas.addEventListener('mousedown',  this._onClick);
    canvas.addEventListener('touchstart', this._onClick, { passive: true });
  },

  _pt(cx, cy) {
    const r = this._canvas.getBoundingClientRect();
    return {
      x: (cx - r.left) * (this._canvas.width  / r.width),
      y: (cy - r.top)  * (this._canvas.height / r.height),
    };
  },

  _onClick(e) {
    const src = e.touches ? e.touches[0] : e;
    const p   = this._pt(src.clientX, src.clientY);
    for (let i = 0; i < 4; i++) {
      this._food.push({ x: p.x + (Math.random() - 0.5) * 18, y: p.y + (Math.random() - 0.5) * 10, vy: 0, eaten: false });
    }
  },

  update(dt) {
    const s = Math.min(dt / 1000, 0.05);
    this._t += s;
    const { _W: W, _H: H, _fish: fish, _food: food, _t: t } = this;
    const ctx = this._ctx;

    // Food
    for (const f of food) {
      if (f.eaten) continue;
      f.vy += FOOD_G * s;
      f.vy *= 1 - 2.5 * s;
      f.y  += f.vy * s;
      if (f.y > H - 8) { f.y = H - 8; f.vy = 0; }
    }

    // Fish
    for (const fi of fish) {
      fi.tailT += s * Math.PI * 2 * 2.2;
      let ax = 0, ay = 0;

      let nearFood = null, nearDist = 130;
      for (const f of food) {
        if (f.eaten) continue;
        const d = Math.hypot(fi.x - f.x, fi.y - f.y);
        if (d < nearDist) { nearDist = d; nearFood = f; }
      }

      if (nearFood) {
        const dx = nearFood.x - fi.x, dy = nearFood.y - fi.y;
        const d  = Math.hypot(dx, dy) || 1;
        ax += (dx / d) * fi.speed * 1.8;
        ay += (dy / d) * fi.speed * 0.9;
        if (nearDist < EAT_R) nearFood.eaten = true;
      } else {
        ax += Math.sin(t * 0.38 + fi.phase * 2.1) * fi.speed * 0.48;
        ay += Math.sin(t * 0.27 + fi.phase)        * fi.speed * 0.28;
      }

      const M = 35;
      // У дна рыбе нужно опускаться ближе чем M, чтобы съесть упавший корм
      // (корм оседает на y = H - 8). Если еды нет — обычная отталкивающая зона.
      const Mbot = nearFood ? 10 : M;
      if (fi.x < M)          ax += fi.speed * 1.2;
      if (fi.x > W - M)      ax -= fi.speed * 1.2;
      if (fi.y < M)          ay += fi.speed * 0.9;
      if (fi.y > H - Mbot)   ay -= fi.speed * 0.9;

      fi.vx += ax * s;
      fi.vy += ay * s;
      fi.vx *= 1 - 2.2 * s;
      fi.vy *= 1 - 2.8 * s;

      const spd = Math.hypot(fi.vx, fi.vy);
      if (spd > fi.speed) { fi.vx = fi.vx / spd * fi.speed; fi.vy = fi.vy / spd * fi.speed; }

      fi.x = clamp(fi.x + fi.vx * s, 8, W - 8);
      fi.y = clamp(fi.y + fi.vy * s, 8, H - 8);

      if (spd > 4) {
        let da = Math.atan2(fi.vy, fi.vx) - fi.angle;
        while (da >  Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        fi.angle += da * Math.min(3.5 * s, 1);
      }
    }

    // Bubbles
    this._bTimer += s;
    if (this._bTimer > 2.5 + Math.random() * 4) {
      this._bTimer = 0;
      const fi = fish[Math.floor(Math.random() * fish.length)];
      this._bubbles.push({ x: fi.x, y: fi.y, r: 0.8 + Math.random() * 2.2, vy: -(10 + Math.random() * 18), a: 0.5, wb: Math.random() * Math.PI * 2 });
    }
    for (let i = this._bubbles.length - 1; i >= 0; i--) {
      const b = this._bubbles[i];
      b.wb += s * 1.8; b.x += Math.sin(b.wb) * 9 * s;
      b.y  += b.vy * s; b.vy *= 1 - 0.5 * s; b.a -= 0.05 * s;
      if (b.y < -10 || b.a <= 0) this._bubbles.splice(i, 1);
    }

    for (let i = food.length - 1; i >= 0; i--) {
      if (food[i].eaten) food.splice(i, 1);
    }

    // Draw
    ctx.fillStyle = this._bgGrad;
    ctx.fillRect(0, 0, W, H);

    this._drawRays(ctx, W, H, t);

    // Food
    for (const f of food) {
      if (f.eaten) continue;
      ctx.fillStyle   = 'rgba(210,188,68,0.85)';
      ctx.beginPath(); ctx.arc(f.x, f.y, 3, 0, Math.PI * 2); ctx.fill();
    }

    // Bubbles
    for (const b of this._bubbles) {
      ctx.save();
      ctx.globalAlpha = b.a;
      ctx.strokeStyle = 'rgba(140,210,255,0.85)';
      ctx.lineWidth   = 0.7;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    for (const fi of fish) this._drawFish(ctx, fi);

    // Surface shimmer
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle   = '#6ab4ff';
    ctx.fillRect(0, 0, W, 5);
    ctx.restore();

    // Hint
    if (food.length === 0 && this._t < 6) {
      ctx.save();
      ctx.globalAlpha  = Math.min(1, (6 - this._t) / 2);
      ctx.fillStyle    = 'rgba(120,200,255,0.5)';
      ctx.font         = '12px serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Нажмите — бросьте еду', W / 2, H * 0.88);
      ctx.restore();
    }
  },

  _drawRays(ctx, W, H, t) {
    ctx.save();
    ctx.globalAlpha = 0.045;
    ctx.fillStyle   = this._rayGrad;
    for (let i = 0; i < 5; i++) {
      const x  = W * (0.12 + i * 0.19) + Math.sin(t * 0.28 + i) * W * 0.035;
      const hw = W * (0.03 + i % 2 * 0.015);
      ctx.beginPath();
      ctx.moveTo(x - hw, 0); ctx.lineTo(x + hw, 0);
      ctx.lineTo(x + hw * 2.2, H); ctx.lineTo(x - hw * 2.2, H);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  },

  _drawFish(ctx, fi) {
    ctx.save();
    ctx.translate(fi.x, fi.y);
    ctx.rotate(fi.angle);

    const sz  = fi.size;
    const wag = Math.sin(fi.tailT) * 0.38;

    // Body
    ctx.fillStyle = `hsl(${fi.hue},${fi.sat}%,${fi.lit}%)`;
    ctx.beginPath();
    ctx.ellipse(0, 0, sz, sz * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.save();
    ctx.translate(-sz * 0.82, 0);
    ctx.rotate(wag);
    ctx.fillStyle = `hsl(${fi.hue},${fi.sat - 10}%,${fi.lit - 10}%)`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-sz * 0.72, -sz * 0.44);
    ctx.lineTo(-sz * 0.72,  sz * 0.44);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // Dorsal fin
    ctx.fillStyle = `hsl(${fi.hue},${fi.sat - 12}%,${fi.lit - 8}%)`;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.18, -sz * 0.48);
    ctx.lineTo( sz * 0.22, -sz * 0.48);
    ctx.lineTo( sz * 0.12, -sz * 0.18);
    ctx.lineTo(-sz * 0.18, -sz * 0.18);
    ctx.closePath(); ctx.fill();

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(sz * 0.5, -sz * 0.1, sz * 0.17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(sz * 0.55, -sz * 0.1, sz * 0.08, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  },

  handleInput() {},
  pause()  {},
  resume() {},

  destroy() {
    this._canvas.removeEventListener('mousedown',  this._onClick);
    this._canvas.removeEventListener('touchstart', this._onClick);
  },
};

export default aquariumGame;
