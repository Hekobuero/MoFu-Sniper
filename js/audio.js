// Prozedurale Sounds (WebAudio) – kein einziges Audiofile nötig.
let ctx = null, master = null, sfx = null, musicBus = null, windGain = null, windFilter = null;
let muted = localStorage.getItem('mofu_muted') === '1';
let musicTimer = null, musicStep = 0, nextNoteTime = 0;
let noiseBuf = null;

export function isMuted() { return muted; }

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ctx.destination);
  sfx = ctx.createGain(); sfx.gain.value = 1; sfx.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master);
  // Rauschpuffer
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // Wind (Dauerschleife, Lautstärke folgt den Böen)
  const wn = ctx.createBufferSource(); wn.buffer = noiseBuf; wn.loop = true;
  windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 500; windFilter.Q.value = 0.6;
  windGain = ctx.createGain(); windGain.gain.value = 0;
  wn.connect(windFilter); windFilter.connect(windGain); windGain.connect(master); wn.start();
  if (ctx.state === 'suspended') ctx.resume();
}

export function setMuted(m) {
  muted = m; localStorage.setItem('mofu_muted', m ? '1' : '0');
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
}

function noise(dur, t0 = ctx.currentTime) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  s.start(t0, Math.random() * 1.5, dur + 0.05); return s;
}
function env(g, t0, a, peak, dec) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec);
}

export function setWind(level) { // 0..1
  if (!ctx) return;
  windGain.gain.setTargetAtTime(0.025 + level * 0.07, ctx.currentTime, 0.4);
  windFilter.frequency.setTargetAtTime(350 + level * 600, ctx.currentTime, 0.4);
}

export function shot() {
  if (!ctx) return; const t = ctx.currentTime;
  // Knall
  const n = noise(0.5, t); const f = ctx.createBiquadFilter(); f.type = 'lowpass';
  f.frequency.setValueAtTime(6000, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.35);
  const g = ctx.createGain(); env(g, t, 0.002, 1.0, 0.45);
  n.connect(f); f.connect(g); g.connect(sfx);
  // Druckwelle
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
  const g2 = ctx.createGain(); env(g2, t, 0.003, 0.9, 0.3);
  o.connect(g2); g2.connect(sfx); o.start(t); o.stop(t + 0.4);
  // Echo über der Stadt
  const d = ctx.createDelay(); d.delayTime.value = 0.23;
  const fb = ctx.createGain(); fb.gain.value = 0.32;
  const eg = ctx.createGain(); eg.gain.value = 0.35;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
  g.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(eg); eg.connect(sfx);
  setTimeout(() => { try { d.disconnect(); fb.disconnect(); } catch (e) {} }, 2500);
}

function click(t, freq, vol = 0.4, dur = 0.04) {
  const n = noise(dur, t); const f = ctx.createBiquadFilter(); f.type = 'bandpass';
  f.frequency.value = freq; f.Q.value = 3; const g = ctx.createGain(); env(g, t, 0.001, vol, dur);
  n.connect(f); f.connect(g); g.connect(sfx);
  const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = freq * 0.6;
  const g2 = ctx.createGain(); env(g2, t, 0.001, vol * 0.12, dur * 0.8);
  o.connect(g2); g2.connect(sfx); o.start(t); o.stop(t + dur + 0.02);
}

export function bolt() { // Repetieren
  if (!ctx) return; const t = ctx.currentTime + 0.12;
  click(t, 2600, 0.35); click(t + 0.13, 1800, 0.3); click(t + 0.3, 2200, 0.35); click(t + 0.42, 3200, 0.4);
}
export function reload() { // Magazinwechsel
  if (!ctx) return; const t = ctx.currentTime + 0.05;
  click(t, 1500, 0.4, 0.06); click(t + 0.5, 900, 0.5, 0.08); click(t + 0.95, 2400, 0.4); click(t + 1.15, 3000, 0.45);
}
export function dry() { if (ctx) click(ctx.currentTime, 4000, 0.25, 0.03); }

export function hit(big = 0) { // Papier zerfetzt + Kasse
  if (!ctx) return; const t = ctx.currentTime;
  const n = noise(0.3, t); const f = ctx.createBiquadFilter(); f.type = 'bandpass';
  f.frequency.value = 2500; f.Q.value = 0.8;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
  for (let i = 0; i < 6; i++) { g.gain.setValueAtTime(0.5 * Math.random() + 0.2, t + i * 0.035); g.gain.setValueAtTime(0.05, t + i * 0.035 + 0.02); }
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  n.connect(f); f.connect(g); g.connect(sfx);
  const notes = big > 0.6 ? [1318.5, 1568, 2093] : big > 0.3 ? [1318.5, 1760] : [1568, 2093];
  notes.forEach((fr, i) => {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
    const og = ctx.createGain(); env(og, t + 0.08 + i * 0.08, 0.005, 0.22, 0.35);
    o.connect(og); og.connect(sfx); o.start(t + 0.08 + i * 0.08); o.stop(t + 0.6 + i * 0.08);
  });
}
export function miss() {
  if (!ctx) return; const t = ctx.currentTime + 0.05;
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(3200, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.25);
  const g = ctx.createGain(); env(g, t, 0.01, 0.05, 0.25); o.connect(g); g.connect(sfx); o.start(t); o.stop(t + 0.3);
}
export function bonus() {
  if (!ctx) return; const t = ctx.currentTime;
  [784, 988, 1175, 1568].forEach((fr, i) => {
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr;
    const g = ctx.createGain(); env(g, t + i * 0.07, 0.005, 0.08, 0.15);
    o.connect(g); g.connect(sfx); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.2);
  });
}
export function tick() {
  if (!ctx) return; const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 1000;
  const g = ctx.createGain(); env(g, t, 0.003, 0.12, 0.08); o.connect(g); g.connect(sfx); o.start(t); o.stop(t + 0.12);
}
export function fanfare() {
  if (!ctx) return; const t = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((fr, i) => {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
    const g = ctx.createGain(); env(g, t + i * 0.12, 0.01, 0.25, i === 5 ? 0.8 : 0.18);
    o.connect(g); g.connect(sfx); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 1);
  });
}

// Leichte Hintergrundschleife: ruhiges Arpeggio + Bass, 92 BPM
const PROG = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 60], [55, 59, 62, 67]];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function scheduleMusic() {
  const spb = 60 / 92 / 2; // Achtel
  while (nextNoteTime < ctx.currentTime + 0.25) {
    const bar = Math.floor(musicStep / 8) % 4, st = musicStep % 8;
    const ch = PROG[bar]; const t = nextNoteTime;
    const note = ch[[0, 1, 2, 3, 2, 1, 2, 3][st]] + 12;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(note);
    const g = ctx.createGain(); env(g, t, 0.01, 0.3, spb * 1.6);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + spb * 2);
    if (st === 0 || st === 4) {
      const b = ctx.createOscillator(); b.type = 'sine'; b.frequency.value = mtof(ch[0] - 12);
      const bg = ctx.createGain(); env(bg, t, 0.02, 0.6, spb * 3.5);
      b.connect(bg); bg.connect(musicBus); b.start(t); b.stop(t + spb * 4);
    }
    nextNoteTime += spb; musicStep++;
  }
}
export function startMusic() {
  if (!ctx || musicTimer) return;
  nextNoteTime = ctx.currentTime + 0.1; musicTimer = setInterval(scheduleMusic, 80);
}
export function stopMusic() { clearInterval(musicTimer); musicTimer = null; }
