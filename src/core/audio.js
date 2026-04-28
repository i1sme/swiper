// Централизованный звуковой движок (Web Audio API).
// Все звуки процедурные — никаких внешних файлов.
//
// AudioContext создаётся лениво (по первому вызову) и автоматически
// возобновляется на любом пользовательском действии — так требуют браузеры.

let _ctx     = null;
let _master  = null;
let _muted   = false;
let _resumeBound = false;

const MASTER_VOL = 0.55;

function _ensureCtx() {
  if (_ctx) return _ctx;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  _ctx    = new C();
  _master = _ctx.createGain();
  _master.gain.value = _muted ? 0 : MASTER_VOL;
  _master.connect(_ctx.destination);

  if (!_resumeBound) {
    _resumeBound = true;
    const resume = () => {
      if (_ctx && _ctx.state === 'suspended') _ctx.resume();
    };
    ['mousedown', 'touchstart', 'keydown'].forEach(ev =>
      window.addEventListener(ev, resume, { capture: true })
    );
  }
  return _ctx;
}

function _now() { return _ctx ? _ctx.currentTime : 0; }

function _noiseBuffer(color) {
  const ctx = _ensureCtx();
  const bufSize = 2 * ctx.sampleRate;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);
  if (color === 'brown') {
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i]  = last * 3.5;
    }
  } else {
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
  }
  return buf;
}

function _noiseSource(color) {
  const ctx = _ensureCtx();
  const node = ctx.createBufferSource();
  node.buffer = _noiseBuffer(color);
  node.loop   = true;
  return node;
}

// ── One-shot effects ────────────────────────────────────────────────

function tick(freq = 1100, dur = 0.045, vol = 0.22) {
  const ctx = _ensureCtx();
  if (!ctx) return;
  const t0 = _now();

  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = freq;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.0015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(g).connect(_master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// Тик старых механических напольных часов:
// 3 наложенных noise-burst — защёлк (high), резонанс корпуса (mid),
// удар по дереву (low). Меняя центральные частоты получаем "тик/так".
function mechTick(high = 6500, mid = 1300, low = 180) {
  const ctx = _ensureCtx();
  if (!ctx) return;
  const t0 = _now();
  _noiseHit(t0,         high, 9,  0.014, 0.20);
  _noiseHit(t0,         mid,  4,  0.032, 0.16);
  _noiseHit(t0 + 0.006, low,  3,  0.050, 0.13);
}

function _noiseHit(when, freq, Q, dur, peakGain) {
  const ctx = _ctx;
  const noise = _noiseSource('white');
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = Q;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peakGain, when + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

  noise.connect(bp).connect(g).connect(_master);
  const start = Math.max(when - 0.001, ctx.currentTime);
  noise.start(start);
  noise.stop(when + dur + 0.03);
}

function clack(intensity = 1) {
  const ctx = _ensureCtx();
  if (!ctx) return;
  const t0  = _now();
  const v   = Math.max(0.05, Math.min(1, intensity));
  const dur = 0.06;

  // Тональный треугольник с быстрым спуском по частоте
  const osc = ctx.createOscillator();
  osc.type  = 'triangle';
  osc.frequency.setValueAtTime(1700, t0);
  osc.frequency.exponentialRampToValueAtTime(900, t0 + dur);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.18 * v, t0 + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(g).connect(_master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);

  // Лёгкий шумовой "клик" поверх
  const noise = _noiseSource('white');
  const nf = ctx.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = 4500;
  nf.Q.value = 1;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.exponentialRampToValueAtTime(0.10 * v, t0 + 0.001);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.025);
  noise.connect(nf).connect(ng).connect(_master);
  noise.start(t0);
  noise.stop(t0 + 0.05);
}

function pop(size = 1) {
  const ctx = _ensureCtx();
  if (!ctx) return;
  const t0  = _now();
  const dur = 0.08;

  const osc = ctx.createOscillator();
  osc.type  = 'sine';
  const f0  = 800 - size * 25;
  const f1  = 220 - size * 12;
  osc.frequency.setValueAtTime(f0, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(80, f1), t0 + dur);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(g).connect(_master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// ── Continuous loops ────────────────────────────────────────────────

function motor() {
  const ctx = _ensureCtx();
  if (!ctx) return null;

  const low  = ctx.createOscillator(); low.type  = 'sawtooth'; low.frequency.value  = 55;
  const high = ctx.createOscillator(); high.type = 'square';   high.frequency.value = 110;
  const highGain = ctx.createGain();   highGain.gain.value = 0.30;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 350;
  filter.Q.value = 0.7;

  const g = ctx.createGain();
  g.gain.value = 0;

  low.connect(filter);
  high.connect(highGain).connect(filter);
  filter.connect(g).connect(_master);

  low.start();
  high.start();

  let alive = true;
  return {
    setSpeed(p) {
      if (!alive) return;
      const power = Math.max(0, Math.min(1, p));
      const f = 50 + power * 180;
      low.frequency.setTargetAtTime(f,         ctx.currentTime, 0.05);
      high.frequency.setTargetAtTime(f * 2,    ctx.currentTime, 0.05);
      filter.frequency.setTargetAtTime(300 + power * 1400, ctx.currentTime, 0.08);
      g.gain.setTargetAtTime(power * 0.10, ctx.currentTime, 0.10);
    },
    stop() {
      if (!alive) return;
      alive = false;
      try {
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        setTimeout(() => {
          try { low.stop(); high.stop(); } catch (e) { /* already stopped */ }
        }, 250);
      } catch (e) { /* context closed */ }
    },
  };
}

function fire() {
  const ctx = _ensureCtx();
  if (!ctx) return null;

  // Постоянный гул углей — brown noise, lowpass поглубже, чтобы было
  // тёплое "ш-ш-ш" без свистящих верхов
  const noise  = _noiseSource('brown');
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 450;
  filter.Q.value = 0.4;

  const g = ctx.createGain();
  g.gain.value = 0;

  noise.connect(filter).connect(g).connect(_master);
  noise.start();

  let alive = true;
  let intensity = 0;
  let crackleTimer = null;

  // Треск — короткий burst шума через bandpass, без тонального осциллятора.
  // Реальный треск дерева — это удар, не нота, поэтому гладкий envelope
  // и фильтрованный шум звучат натурально, а square-wave давал "пик".
  function scheduleCrackle() {
    if (!alive || intensity < 0.05) { crackleTimer = null; return; }
    const wait = (450 + Math.random() * 1100) / Math.max(0.25, intensity);
    crackleTimer = setTimeout(() => {
      if (!alive) return;
      const t0  = ctx.currentTime;
      const dur = 0.05 + Math.random() * 0.10;

      const cn = _noiseSource('white');
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 800 + Math.random() * 1200;  // 800–2000 Гц
      bp.Q.value = 1.6 + Math.random() * 1.2;

      const cg = ctx.createGain();
      const v  = (0.015 + Math.random() * 0.020) * intensity;
      cg.gain.setValueAtTime(0.0001, t0);
      cg.gain.exponentialRampToValueAtTime(v, t0 + 0.008);
      cg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      cn.connect(bp).connect(cg).connect(_master);
      cn.start(t0);
      cn.stop(t0 + dur + 0.05);

      scheduleCrackle();
    }, wait);
  }

  return {
    setIntensity(i) {
      if (!alive) return;
      intensity = Math.max(0, Math.min(1, i));
      g.gain.setTargetAtTime(intensity * 0.085, ctx.currentTime, 0.30);
      filter.frequency.setTargetAtTime(350 + intensity * 500, ctx.currentTime, 0.30);
      if (intensity > 0.05 && !crackleTimer) scheduleCrackle();
    },
    stop() {
      if (!alive) return;
      alive = false;
      if (crackleTimer) { clearTimeout(crackleTimer); crackleTimer = null; }
      try {
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
        setTimeout(() => { try { noise.stop(); } catch (e) {} }, 400);
      } catch (e) {}
    },
  };
}

function sand() {
  const ctx = _ensureCtx();
  if (!ctx) return null;

  const noise  = _noiseSource('white');
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 4500;

  const g = ctx.createGain();
  g.gain.value = 0;

  noise.connect(filter).connect(g).connect(_master);
  noise.start();

  let alive = true;
  return {
    setActive(active) {
      if (!alive) return;
      g.gain.setTargetAtTime(active ? 0.045 : 0, ctx.currentTime, 0.05);
    },
    stop() {
      if (!alive) return;
      alive = false;
      try {
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        setTimeout(() => { try { noise.stop(); } catch (e) {} }, 200);
      } catch (e) {}
    },
  };
}

// ── Mute / suspend ──────────────────────────────────────────────────

function setMuted(m) {
  _muted = !!m;
  if (_master && _ctx) {
    _master.gain.setTargetAtTime(_muted ? 0 : MASTER_VOL, _ctx.currentTime, 0.05);
  }
}

function isMuted() { return _muted; }

function suspend() {
  if (_ctx && _ctx.state === 'running') _ctx.suspend();
}

function resume() {
  if (_ctx && _ctx.state === 'suspended') _ctx.resume();
}

export default {
  tick, mechTick, clack, pop,
  motor, fire, sand,
  setMuted, isMuted,
  suspend, resume,
};
