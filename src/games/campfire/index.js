// Костёр — петля вовлечённости: тяни брёвна на кострище, они горят и догорают.
// Огонь угасает без новых брёвен — нужно поддерживать его живым.

import audio from '../../core/audio.js';

const FIREPIT_R  = 52;   // радиус кострища, px
const LOG_LEN    = 48;   // полудлина бревна (эллипс)
const LOG_H      = 8;    // полувысота бревна
const BURN_SEC   = 38;   // секунд на сгорание одного бревна
const RESPAWN_S  = 8;    // секунд до появления нового бревна в запасе
const FIRE_POOL  = 160;
const SMOKE_POOL = 45;
const EMIT_BASE  = 5;    // частиц огня в кадр на бревно при полном горении

function makeParticle() {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1 };
}

const campfireGame = {
  name:  'campfire',
  label: 'Костёр',
  icon:  '🔥',

  init(canvas, ctx) {
    this._canvas = canvas;
    this._ctx    = ctx;
    this._W      = canvas.width;
    this._H      = canvas.height;

    this._pitX = this._W * 0.5;
    this._pitY = this._H * 0.48;

    // Запас брёвен внизу (3 слота)
    const slotY = this._H * 0.88;
    const spacing = this._W / 4;
    this._reserve = [
      { x: spacing,     y: slotY, log: this._newLog(spacing,     slotY, 0) },
      { x: spacing * 2, y: slotY, log: this._newLog(spacing * 2, slotY, 0) },
      { x: spacing * 3, y: slotY, log: this._newLog(spacing * 3, slotY, 0) },
    ];

    // Брёвна на кострище
    this._pitLogs = [];

    // Пулы частиц
    this._fire  = Array.from({ length: FIRE_POOL },  makeParticle);
    this._smoke = Array.from({ length: SMOKE_POOL }, makeParticle);

    this._smokeAcc = 0;
    this._time     = 0;

    this._drag     = null; // { log, offsetX, offsetY, fromSlot }

    this._pitSprite = this._buildPitSprite();
    this._fireAudio = audio.fire();

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

  _newLog(x, y, angle) {
    return { x, y, angle, health: 1, burning: false, respawnTimer: 0 };
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
    // Проверяем слоты запаса
    for (const slot of this._reserve) {
      if (!slot.log) continue;
      if (Math.hypot(pt.x - slot.log.x, pt.y - slot.log.y) < LOG_LEN * 1.1) {
        this._drag = { log: slot.log, slot, offsetX: pt.x - slot.log.x, offsetY: pt.y - slot.log.y };
        slot.log = null; // убираем из слота на время перетаскивания
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
    this._drag.log.x = pt.x - this._drag.offsetX;
    this._drag.log.y = pt.y - this._drag.offsetY;
  },

  _onUp(e) {
    if (!this._drag) return;
    const log  = this._drag.log;
    const slot = this._drag.slot;
    this._drag = null;

    const dist = Math.hypot(log.x - this._pitX, log.y - this._pitY);
    if (dist < FIREPIT_R + 20) {
      // Бросаем на кострище
      log.x       = this._pitX + (Math.random() - 0.5) * FIREPIT_R * 0.8;
      log.y       = this._pitY + (Math.random() - 0.5) * FIREPIT_R * 0.5;
      log.angle   = (Math.random() - 0.5) * 1.1;
      log.burning = true;
      log.health  = 1;
      this._pitLogs.push(log);
    } else {
      // Возвращаем в слот
      log.x       = slot.x;
      log.y       = slot.y;
      log.angle   = 0;
      slot.log    = log;
    }
  },

  _spawnFire(lx, ly) {
    const p = this._fire.find(f => !f.active);
    if (!p) return;
    p.active  = true;
    p.x       = lx + (Math.random() - 0.5) * 20;
    p.y       = ly + (Math.random() - 0.5) * 6 - 2;
    p.vx      = (Math.random() - 0.5) * 28;
    p.vy      = -(110 + Math.random() * 100);
    p.life    = 0;
    p.maxLife = 0.55 + Math.random() * 0.6;
    p.size    = 8 + Math.random() * 8;
  },

  _spawnSmoke(lx, ly) {
    const p = this._smoke.find(s => !s.active);
    if (!p) return;
    p.active  = true;
    p.x       = lx + (Math.random() - 0.5) * 18;
    p.y       = ly - 50 - Math.random() * 20;
    p.vx      = (Math.random() - 0.5) * 10;
    p.vy      = -(28 + Math.random() * 22);
    p.life    = 0;
    p.maxLife = 2.0 + Math.random() * 1.2;
    p.size    = 9 + Math.random() * 6;
  },

  handleInput() {},
  pause()  {},
  resume() {},

  update(dt) {
    const dtSec = Math.min(dt / 1000, 0.05);
    this._time += dt;
    const ctx = this._ctx;
    const W = this._W, H = this._H;

    // Сжигаем брёвна на кострище
    for (let i = this._pitLogs.length - 1; i >= 0; i--) {
      const log = this._pitLogs[i];
      if (!log.burning) continue;
      log.health -= dtSec / BURN_SEC;
      if (log.health <= 0) {
        log.burning = false;
        this._pitLogs.splice(i, 1);
        // Запускаем таймер возрождения слота
        const emptySlot = this._reserve.find(s => !s.log);
        if (emptySlot) emptySlot.log = { ...this._newLog(emptySlot.x, emptySlot.y, 0), _respawnLeft: RESPAWN_S };
      }
    }

    // Таймеры возрождения слотов
    for (const slot of this._reserve) {
      if (slot.log && slot.log._respawnLeft !== undefined) {
        slot.log._respawnLeft -= dtSec;
        if (slot.log._respawnLeft <= 0) {
          delete slot.log._respawnLeft;
        }
      }
    }

    // Эмиссия частиц от горящих брёвен
    for (const log of this._pitLogs) {
      if (!log.burning) continue;
      const emitCount = Math.ceil(EMIT_BASE * log.health);
      for (let i = 0; i < emitCount; i++) this._spawnFire(log.x, log.y);
      this._smokeAcc += 0.8 * log.health;
    }
    while (this._smokeAcc >= 1) {
      const burningLogs = this._pitLogs.filter(l => l.burning);
      if (burningLogs.length > 0) {
        const l = burningLogs[(Math.random() * burningLogs.length) | 0];
        this._spawnSmoke(l.x, l.y);
      }
      this._smokeAcc -= 1;
    }

    // Физика частиц
    for (const p of this._fire) {
      if (!p.active) continue;
      const turb = Math.sin(this._time * 0.01 + p.x * 0.05) * 35;
      p.vx += turb * dtSec;
      p.x  += p.vx * dtSec;
      p.y  += p.vy * dtSec;
      p.life += dtSec;
      if (p.life >= p.maxLife) p.active = false;
    }
    for (const p of this._smoke) {
      if (!p.active) continue;
      p.x  += p.vx * dtSec;
      p.y  += p.vy * dtSec;
      p.life += dtSec;
      if (p.life >= p.maxLife) p.active = false;
    }

    // ─── Рисование ────────────────────────────────────────

    ctx.fillStyle = '#080810';
    ctx.fillRect(0, 0, W, H);

    // Кострище — каменный круг
    this._drawPit(ctx);

    // Зона запаса брёвен (слоты)
    this._drawReserveArea(ctx);

    // Тянущееся бревно поверх всего
    if (this._drag) this._drawLog(ctx, this._drag.log, 1.0, true);

    // Брёвна на кострище (снизу)
    for (const log of this._pitLogs) {
      this._drawLog(ctx, log, log.health, false);
    }

    // Звук костра — обновляем интенсивность каждый кадр
    {
      const fireI = this._pitLogs.filter(l => l.burning).reduce((s, l) => s + l.health, 0) / 3;
      this._fireAudio?.setIntensity(fireI);
    }

    // Зарево под огнём
    if (this._pitLogs.some(l => l.burning)) {
      const intensity = this._pitLogs.reduce((s, l) => s + l.health, 0) / 3;
      const glow = ctx.createRadialGradient(this._pitX, this._pitY + 8, 0, this._pitX, this._pitY + 8, 80);
      glow.addColorStop(0,   `rgba(255,100,10,${0.18 * intensity})`);
      glow.addColorStop(0.6, `rgba(180,40,0,${0.07 * intensity})`);
      glow.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(this._pitX - 80, this._pitY - 70, 160, 150);
    }

    // Огонь (additive blending)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this._fire) {
      if (!p.active) continue;
      const t    = p.life / p.maxLife;
      const hue  = 50 - t * 45;
      const lit  = 72 - t * 48;
      const sz   = p.size * (1 - t * 0.5);
      ctx.globalAlpha = (1 - t) * 0.52;
      ctx.fillStyle   = `hsl(${hue},100%,${lit}%)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, sz), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Дым
    ctx.save();
    for (const p of this._smoke) {
      if (!p.active) continue;
      const t   = p.life / p.maxLife;
      const sz  = p.size * (1 + t * 2.2);
      ctx.globalAlpha = Math.sin(Math.PI * t) * 0.15;
      ctx.fillStyle   = '#8888a0';
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, sz), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Подсказка если огонь угас
    if (this._pitLogs.length === 0) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle   = '#ff9060';
      ctx.font        = '12px system-ui';
      ctx.textAlign   = 'center';
      ctx.fillText('перетащи бревно на кострище', W / 2, this._pitY - 65);
      ctx.restore();
    }
  },

  _buildPitSprite() {
    const PAD = 16;
    const w = (FIREPIT_R + PAD) * 2;
    const h = (FIREPIT_R + PAD) * 2;
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const o = off.getContext('2d');
    const cx = w / 2, cy = h / 2;

    for (let i = 0; i < 10; i++) {
      const a  = (i / 10) * Math.PI * 2;
      const sx = cx + Math.cos(a) * FIREPIT_R;
      const sy = cy + Math.sin(a) * FIREPIT_R * 0.65;
      const sr = 7 + Math.sin(i * 1.7) * 2;
      const sg = o.createRadialGradient(sx - 1, sy - 1, 0, sx, sy, sr);
      sg.addColorStop(0, '#6e6e72');
      sg.addColorStop(1, '#2a2a2e');
      o.fillStyle = sg;
      o.beginPath();
      o.ellipse(sx, sy, sr * 1.2, sr * 0.7, a, 0, Math.PI * 2);
      o.fill();
    }

    o.fillStyle = '#18181c';
    o.beginPath();
    o.ellipse(cx, cy, FIREPIT_R - 8, (FIREPIT_R - 8) * 0.62, 0, 0, Math.PI * 2);
    o.fill();

    return { canvas: off, halfW: w / 2, halfH: h / 2 };
  },

  _drawPit(ctx) {
    const s = this._pitSprite;
    ctx.drawImage(s.canvas, this._pitX - s.halfW, this._pitY - s.halfH);
  },

  _drawReserveArea(ctx) {
    const W = this._W;
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#806040';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.roundRect(12, this._H * 0.80, W - 24, this._H * 0.15, 6);
    ctx.stroke();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle   = '#604020';
    ctx.fill();
    ctx.restore();
    ctx.setLineDash([]);

    // Брёвна в запасе
    for (const slot of this._reserve) {
      if (!slot.log) {
        // Пустой слот — силуэт
        this._drawLogShadow(ctx, slot.x, slot.y);
        continue;
      }
      const appearing = slot.log._respawnLeft !== undefined;
      const alpha = appearing
        ? Math.max(0, 1 - slot.log._respawnLeft / RESPAWN_S)
        : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      this._drawLog(ctx, slot.log, 1, false);
      ctx.restore();
    }
  },

  _drawLogShadow(ctx, x, y) {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle   = '#604020';
    ctx.beginPath();
    ctx.ellipse(x, y, LOG_LEN, LOG_H, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  _drawLog(ctx, log, health, dragging) {
    const h01 = Math.max(0, health);
    const curLen = LOG_LEN * (0.4 + h01 * 0.6); // усыхает до 40%

    // Цвет: от тёмно-коричневого к углю (тёмно-серый)
    const r = Math.round(60  + h01 * 50);
    const g = Math.round(28  + h01 * 18);
    const b = Math.round(5   + h01 * 8);

    ctx.save();
    ctx.translate(log.x, log.y);
    ctx.rotate(log.angle);
    if (dragging) {
      ctx.shadowColor = 'rgba(255,140,0,0.5)';
      ctx.shadowBlur  = 14;
    }

    // Основное тело бревна
    const grad = ctx.createLinearGradient(0, -LOG_H, 0, LOG_H);
    grad.addColorStop(0, `rgb(${r + 25},${g + 12},${b + 3})`);
    grad.addColorStop(1, `rgb(${r - 15},${g - 8},${b})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, curLen, LOG_H, 0, 0, Math.PI * 2);
    ctx.fill();

    // Торец слева
    ctx.fillStyle = `rgb(${r + 10},${g + 5},${b + 2})`;
    ctx.beginPath();
    ctx.ellipse(-curLen, 0, LOG_H * 0.7, LOG_H, 0, 0, Math.PI * 2);
    ctx.fill();

    // Торец справа
    ctx.fillStyle = `rgb(${r + 5},${g + 2},${b})`;
    ctx.beginPath();
    ctx.ellipse(curLen, 0, LOG_H * 0.7, LOG_H, 0, 0, Math.PI * 2);
    ctx.fill();

    // Жилки дерева
    if (h01 > 0.3) {
      ctx.strokeStyle = `rgba(0,0,0,0.15)`;
      ctx.lineWidth   = 0.5;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-curLen * 0.8, i * LOG_H * 0.4);
        ctx.lineTo( curLen * 0.8, i * LOG_H * 0.4);
        ctx.stroke();
      }
    }

    // Жарящиеся угли (светлячки внутри)
    if (h01 < 0.7 && log.burning) {
      const emberCount = Math.floor((1 - h01) * 5);
      for (let i = 0; i < emberCount; i++) {
        const ex = (Math.random() - 0.5) * curLen * 1.5;
        const ey = (Math.random() - 0.5) * LOG_H * 1.2;
        ctx.fillStyle = `rgba(255,${120 + Math.random() * 80 | 0},0,0.7)`;
        ctx.beginPath();
        ctx.arc(ex, ey, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

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
    this._fireAudio?.stop();
    this._fireAudio = null;
  },
};

export default campfireGame;
