// MoFu Sniper – HEKO präsentiert · highspeedvorort.de
import { TARIFFS, CATEGORIES, difficulty, spawnWeight } from './data.js?v=20261031a';
import * as A from './audio.js?v=20261031a';
import { fetchTop, submitScore } from './leaderboard.js?v=20261031a';

export const VERSION = '20261031a';
const params = new URLSearchParams(location.search);
const ROUND_SECONDS = Math.max(5, +params.get('seconds') || 75);
const MAG_SIZE = 5, BOLT_TIME = 0.6, RELOAD_TIME = 1.7, ZOOM = 2.6;
const SW = 300, SH = 200, PAD = 28; // logische Vertragskarten-Größe (+Rand für Glanz)
const opts = { freeze: params.has('freeze'), noSway: params.has('nosway') };

// ---------- Hilfsfunktionen ----------
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const nf = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtEUR = c => nf.format(c / 100) + ' €';
const fmtAP = c => (c % 100 === 0 ? String(c / 100) : nf.format(c / 100)) + ' €';
export function payoutText(t) { return t.ap > 0 ? `+${fmtEUR(t.eur)} + ${fmtAP(t.ap)} AP` : `+${fmtEUR(t.eur)}`; }
function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function loadImg(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; }); }

// ---------- Canvas ----------
const canvas = $('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1, HORIZON = 0, baseCard = 120, scopeR = 130;
let bgCanvas = null, cloudSprites = [], clouds = [];
const IMG = {};
const sprites = new Map(); let backSprite = null, spritePx = 400;

function resize() {
  W = window.innerWidth; H = window.innerHeight;
  DPR = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  const m = Math.min(W, H);
  baseCard = clamp(m * 0.30, 96, 230);
  scopeR = clamp(m * 0.37, 112, 240);
  HORIZON = H * (W > H ? 0.70 : 0.64);
  spritePx = clamp(Math.round(baseCard * DPR * 1.9), 220, 680);
  sprites.clear(); backSprite = null;
  buildBackground(); buildClouds();
  aim.x = clamp(aim.x || W / 2, 0, W); aim.y = clamp(aim.y || H * 0.4, 0, H);
}

// ---------- Hintergrund: Metropole bei Abendrot ----------
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }

function buildBackground() {
  const scale = Math.min(DPR * 1.6, Math.sqrt(14e6 / (W * H)));
  bgCanvas = document.createElement('canvas');
  bgCanvas.width = Math.round(W * scale); bgCanvas.height = Math.round(H * scale);
  const g = bgCanvas.getContext('2d'); g.scale(scale, scale);
  const R = seeded(42), m = Math.min(W, H);
  // Himmel
  const sky = g.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, '#16163f'); sky.addColorStop(0.42, '#57296f'); sky.addColorStop(0.72, '#d84f8c'); sky.addColorStop(1, '#ffb27c');
  g.fillStyle = sky; g.fillRect(0, 0, W, HORIZON + 2);
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${R() * 0.6})`; g.fillRect(R() * W, R() * HORIZON * 0.35, 1.2, 1.2); }
  // Sonne
  const sx = W * 0.74, sy = HORIZON - m * 0.07, sr = m * 0.09;
  let sg = g.createRadialGradient(sx, sy, 0, sx, sy, sr * 4);
  sg.addColorStop(0, 'rgba(255,240,200,.9)'); sg.addColorStop(0.25, 'rgba(255,190,140,.45)'); sg.addColorStop(1, 'rgba(255,120,150,0)');
  g.fillStyle = sg; g.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
  g.fillStyle = '#fff1cf'; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
  // ferne Skyline (Dunst)
  let x = -10;
  while (x < W + 10) {
    const bw = (0.03 + R() * 0.04) * Math.max(W, 500) * (0.6 + R() * 0.6), bh = (0.05 + R() * 0.16) * H;
    g.fillStyle = 'rgba(120,70,140,.75)'; g.fillRect(x, HORIZON - bh, bw, bh + 2);
    if (R() < 0.3) { g.fillRect(x + bw * 0.45, HORIZON - bh - bh * 0.18, 2, bh * 0.18); }
    x += bw + R() * 4;
  }
  g.fillStyle = 'rgba(255,170,150,.18)'; g.fillRect(0, HORIZON - H * 0.08, W, H * 0.08);
  // Hochhäuser (mittlere Ebene)
  const towers = [];
  x = -20;
  while (x < W + 20) {
    const bw = clamp((0.05 + R() * 0.07) * W, 28, 90), bh = (0.12 + Math.pow(R(), 1.5) * 0.24) * H;
    towers.push({ x, w: bw, h: bh, glass: R() < 0.5 }); x += bw + 2 + R() * 10;
  }
  // HEKO-Tower = höchstes Hochhaus, Telekom-Billboard-Haus
  const hx = W * (W > H ? 0.30 : 0.26), hw = clamp(W * 0.11, 46, 110), hh = H * (W > H ? 0.50 : 0.46);
  const bx = W * (W > H ? 0.66 : 0.70), bwid = clamp(W * 0.16, 70, 170), bhh = H * 0.22;
  for (const t of towers) {
    if (t.x + t.w > hx - hw * 0.6 && t.x < hx + hw * 1.6) continue;
    if (t.x + t.w > bx - 4 && t.x < bx + bwid + 4) continue;
    drawTower(g, t.x, t.w, t.h, t.glass, R);
  }
  drawTower(g, bx, bwid, bhh, false, R);
  // Billboard highspeedvorort.de auf dem Dach
  const bbW = bwid * 1.25, bbH = bbW * 0.42, bbX = bx + bwid / 2 - bbW / 2, bbY = HORIZON - bhh - bbH - 10;
  g.fillStyle = '#222'; g.fillRect(bbX + bbW * 0.2, bbY + bbH, 3, 12); g.fillRect(bbX + bbW * 0.78, bbY + bbH, 3, 12);
  g.save(); g.shadowColor = 'rgba(226,0,116,.9)'; g.shadowBlur = 18;
  g.fillStyle = '#E20074'; roundRect(g, bbX, bbY, bbW, bbH, 4); g.fill(); g.restore();
  if (IMG.t) g.drawImage(IMG.t, bbX + bbH * 0.12, bbY + bbH * 0.12, bbH * 0.76, bbH * 0.76);
  g.fillStyle = '#fff'; g.textBaseline = 'middle';
  g.font = `800 ${bbH * 0.22}px system-ui, sans-serif`;
  fitText(g, 'highspeedvorort.de', bbX + bbH * 0.98, bbY + bbH * 0.36, bbW - bbH * 1.08);
  g.font = `600 ${bbH * 0.16}px system-ui, sans-serif`;
  fitText(g, 'Glasfaser & MoFu vor Ort', bbX + bbH * 0.98, bbY + bbH * 0.68, bbW - bbH * 1.08);
  // HEKO-Tower
  drawTower(g, hx, hw, hh, true, R);
  g.fillStyle = '#3a3360'; g.fillRect(hx + hw * 0.47, HORIZON - hh - hh * 0.12, hw * 0.06, hh * 0.12);
  g.fillStyle = '#ff3366'; g.beginPath(); g.arc(hx + hw * 0.5, HORIZON - hh - hh * 0.12, 2.5, 0, 7); g.fill();
  const lw = hw * 1.9, lh = lw * 0.36, lx = hx + hw / 2 - lw / 2, ly = HORIZON - hh - lh * 0.55;
  g.save(); g.shadowColor = 'rgba(120,200,255,.9)'; g.shadowBlur = 22; g.fillStyle = '#fff';
  roundRect(g, lx, ly, lw, lh, 5); g.fill(); g.restore();
  if (IMG.heko) { const iw = lw * 0.84, ih = iw * 101.83 / 414.88; g.drawImage(IMG.heko, lx + (lw - iw) / 2, ly + (lh - ih) / 2, iw, ih); }
  // Boden/Straßendunst
  const gr = g.createLinearGradient(0, HORIZON, 0, H);
  gr.addColorStop(0, '#2a1f3e'); gr.addColorStop(1, '#0e0b18');
  g.fillStyle = gr; g.fillRect(0, HORIZON, W, H - HORIZON);
  for (let i = 0; i < 90; i++) { // Straßenlichter
    const yy = HORIZON + 4 + R() * (H * 0.86 - HORIZON - 6);
    g.fillStyle = R() < 0.5 ? 'rgba(255,210,140,.8)' : 'rgba(255,120,190,.7)';
    g.beginPath(); g.arc(R() * W, yy, 0.8 + R() * 1.4, 0, 7); g.fill();
  }
  // Bäume
  for (let i = 0; i < W / 18; i++) {
    const tx = R() * W, ty = HORIZON + 3 + R() * 10, tr = 6 + R() * 10;
    g.fillStyle = '#1a1430'; g.beginPath(); g.arc(tx, ty, tr, 0, 7); g.fill();
  }
  // Stadtautobahn mit Lichtspuren
  const ry = H * 0.86;
  const sy0 = HORIZON + (ry - HORIZON) * 0.38, sh = Math.max(10, (ry - HORIZON) * 0.07);
  g.fillStyle = '#17121f'; g.fillRect(0, sy0, W, sh);
  for (let i = 0; i < W / 14; i++) {
    const lx = R() * W, ll = 10 + R() * 40, up = R() < 0.5;
    g.fillStyle = up ? 'rgba(255,60,90,.85)' : 'rgba(255,245,220,.9)';
    g.fillRect(lx, sy0 + (up ? sh * 0.22 : sh * 0.62), ll, 1.6);
  }
  g.fillStyle = 'rgba(255,200,120,.5)';
  for (let x2 = 0; x2 < W; x2 += 46) { g.fillRect(x2, sy0 - 12, 1.5, 12); g.beginPath(); g.arc(x2 + 1, sy0 - 12, 2.2, 0, 7); g.fill(); }
  // nahe, niedrige Häuser vor der Dachkante
  x = -10;
  while (x < W) {
    const bw = 34 + R() * 70, bh = (ry - sy0) * (0.35 + R() * 0.55);
    g.fillStyle = R() < 0.5 ? '#1b1529' : '#211a33'; g.fillRect(x, ry - bh, bw, bh);
    for (let wy = ry - bh + 8; wy < ry - 6; wy += 13) for (let wx = x + 6; wx < x + bw - 8; wx += 12)
      if (R() < 0.38) { g.fillStyle = R() < 0.1 ? 'rgba(255,80,170,.8)' : 'rgba(255,214,150,.75)'; g.fillRect(wx, wy, 6, 6); }
    x += bw + 3 + R() * 8;
  }
  // Dachkante, auf der der Sniper liegt
  const rg = g.createLinearGradient(0, ry, 0, H);
  rg.addColorStop(0, '#4a4658'); rg.addColorStop(0.08, '#2b2836'); rg.addColorStop(1, '#121019');
  g.fillStyle = rg; g.fillRect(0, ry, W, H - ry);
  g.fillStyle = 'rgba(255,170,200,.35)'; g.fillRect(0, ry, W, 2);
  // Lüftung + Antenne
  g.fillStyle = '#1d1a26'; g.fillRect(W * 0.04, ry - 26, 44, 26); g.fillRect(W * 0.04 + 6, ry - 32, 32, 6);
  g.strokeStyle = '#1d1a26'; g.lineWidth = 3; g.beginPath(); g.moveTo(W * 0.04 + 70, ry); g.lineTo(W * 0.04 + 70, ry - 60);
  g.moveTo(W * 0.04 + 58, ry - 50); g.lineTo(W * 0.04 + 82, ry - 50); g.moveTo(W * 0.04 + 62, ry - 40); g.lineTo(W * 0.04 + 78, ry - 40); g.stroke();
  // kleines HEKO-Schild an der Brüstung
  if (IMG.heko) { const pw = Math.min(110, W * 0.22), ph = pw * 0.3; g.fillStyle = 'rgba(255,255,255,.85)'; roundRect(g, W * 0.5 - pw / 2, ry + 10, pw, ph, 4); g.fill();
    g.drawImage(IMG.heko, W * 0.5 - pw * 0.42, ry + 10 + ph * 0.16, pw * 0.84, ph * 0.68); }
}

function drawTower(g, x, w, h, glass, R) {
  const top = HORIZON - h;
  const gr = g.createLinearGradient(x, 0, x + w, 0);
  if (glass) { gr.addColorStop(0, '#2c2c5e'); gr.addColorStop(0.5, '#4b4486'); gr.addColorStop(1, '#221f48'); }
  else { gr.addColorStop(0, '#2a2242'); gr.addColorStop(1, '#1c1730'); }
  g.fillStyle = gr; g.fillRect(x, top, w, h + 2);
  if (glass) { // Spiegelung der Abendsonne
    const rf = g.createLinearGradient(0, top, 0, HORIZON);
    rf.addColorStop(0, 'rgba(255,150,190,.25)'); rf.addColorStop(1, 'rgba(255,150,190,0)');
    g.fillStyle = rf; g.fillRect(x, top, w, h);
  }
  const cols = Math.max(2, Math.floor(w / 9)), rows = Math.floor(h / 11);
  const cw = w / cols;
  for (let r = 1; r < rows; r++) for (let c = 0; c < cols; c++) {
    const p = R();
    if (p < 0.42) { g.fillStyle = p < 0.06 ? 'rgba(255,90,180,.85)' : `rgba(255,${200 + (R() * 40 | 0)},140,${0.55 + R() * 0.4})`;
      g.fillRect(x + c * cw + cw * 0.25, top + r * 11, cw * 0.5, 5); }
  }
  g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x, top, w, 2);
}

function fitText(g, s, x, y, maxW) {
  let size = parseFloat(g.font.match(/(\d+(\.\d+)?)px/)[1]);
  while (g.measureText(s).width > maxW && size > 6) { size *= 0.94; g.font = g.font.replace(/[\d.]+px/, size.toFixed(1) + 'px'); }
  g.fillText(s, x, y);
}

function buildClouds() {
  cloudSprites = [];
  for (let k = 0; k < 3; k++) {
    const c = document.createElement('canvas'); const cw = 320, ch = 110; c.width = cw * 1.5; c.height = ch * 1.5;
    const g = c.getContext('2d'); g.scale(1.5, 1.5);
    for (let i = 0; i < 14; i++) {
      const px = rand(40, cw - 40), py = rand(45, ch - 25), pr = rand(18, 42);
      const rg = g.createRadialGradient(px, py, 0, px, py, pr);
      rg.addColorStop(0, 'rgba(255,200,225,.55)'); rg.addColorStop(1, 'rgba(255,190,220,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(px, py, pr, 0, 7); g.fill();
    }
    cloudSprites.push(c);
  }
  clouds = [];
  for (let i = 0; i < 5; i++) clouds.push({ x: rand(-0.2, 1) * W, y: rand(0.05, 0.45) * HORIZON, s: rand(0.6, 1.3) * Math.max(W, H) / 700, k: i % 3, v: rand(4, 12) });
}

// ---------- Vertrags-Sprites ----------
function cardSprite(t) {
  let sp = sprites.get(t.id);
  if (sp) return sp;
  if (sprites.size > 48) sprites.delete(sprites.keys().next().value);
  const k = spritePx / SW;
  const c = document.createElement('canvas');
  c.width = Math.round((SW + PAD * 2) * k); c.height = Math.round((SH + PAD * 2) * k);
  const g = c.getContext('2d'); g.scale(k, k); g.translate(PAD, PAD);
  const d = difficulty(t), cat = CATEGORIES[t.cat], congstar = cat.brand === 'congstar';
  // Wert-Glanz: stufenlos von Weiß über Silber/Magenta zu Gold
  if (d > 0.18) {
    const gold = clamp((d - 0.35) / 0.5, 0, 1);
    const col = `rgba(${Math.round(lerp(255, 255, gold))},${Math.round(lerp(120, 205, gold))},${Math.round(lerp(210, 40, gold))},`;
    g.save(); g.shadowColor = col + (0.4 + 0.6 * d) + ')'; g.shadowBlur = 6 + 22 * d;
    g.fillStyle = col + '1)'; roundRect(g, -2 - 4 * d, -2 - 4 * d, SW + 4 + 8 * d, SH + 4 + 8 * d, 14); g.fill(); g.restore();
  }
  // Papier
  const pg = g.createLinearGradient(0, 0, SW, SH);
  pg.addColorStop(0, '#ffffff'); pg.addColorStop(1, '#efe9de');
  g.fillStyle = pg; roundRect(g, 0, 0, SW, SH, 10); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1.5; g.stroke();
  // Kopfzeile
  g.save(); roundRect(g, 0, 0, SW, SH, 10); g.clip();
  g.fillStyle = congstar ? '#1d1f3f' : '#E20074'; g.fillRect(0, 0, SW, 48);
  g.restore();
  g.textBaseline = 'middle'; g.fillStyle = '#fff';
  if (!congstar && IMG.t) g.drawImage(IMG.t, 9, 8, 32, 32);
  g.font = '900 17px system-ui, sans-serif'; g.textAlign = 'left';
  g.fillText(congstar ? 'congstar' : 'VERTRAG', congstar ? 12 : 50, 25);
  g.font = '700 13px system-ui, sans-serif'; g.textAlign = 'right';
  g.fillText(cat.short.replace('congstar ', ''), SW - 12, 25);
  // Tarifname (max. 2 Zeilen)
  g.textAlign = 'left'; g.fillStyle = '#1a1830';
  const lines = wrap(g, t.name, SW - 28, 25, 2);
  lines.lines.forEach((ln, i) => { g.font = `800 ${lines.size}px system-ui, sans-serif`; g.fillText(ln, 14, 74 + i * (lines.size + 4)); });
  // Vertragszeilen + Unterschrift
  g.strokeStyle = 'rgba(30,30,60,.18)'; g.lineWidth = 2;
  for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(14, 128 + i * 14); g.lineTo(SW * (0.55 + (i % 2) * 0.2), 128 + i * 14); g.stroke(); }
  g.strokeStyle = '#2a4bbf'; g.lineWidth = 2.2; g.beginPath();
  g.moveTo(SW - 120, 170); g.bezierCurveTo(SW - 100, 140, SW - 90, 190, SW - 72, 160); g.bezierCurveTo(SW - 60, 145, SW - 50, 185, SW - 24, 158); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(SW - 130, 178); g.lineTo(SW - 16, 178); g.stroke();
  g.font = '600 10px system-ui, sans-serif'; g.fillStyle = 'rgba(0,0,0,.45)'; g.fillText('highspeedvorort.de', 14, SH - 14);
  // Stempel für Top-Verträge (ab ca. 70 €)
  if (d > 0.45) {
    g.save(); g.translate(SW - 62, 128); g.rotate(-0.25);
    g.strokeStyle = d > 0.75 ? '#d39b00' : '#E20074'; g.fillStyle = g.strokeStyle; g.lineWidth = 3;
    roundRect(g, -38, -14, 76, 28, 6); g.stroke();
    g.font = '900 15px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(d > 0.75 ? '★ TOP ★' : 'TOP', 0, 1);
    g.restore();
  }
  sprites.set(t.id, c); return c;
}
function wrap(g, s, maxW, size, maxLines) {
  for (; size >= 12; size -= 1) {
    g.font = `800 ${size}px system-ui, sans-serif`;
    const words = s.split(' '); const lines = []; let cur = '';
    for (const w of words) { const test = cur ? cur + ' ' + w : w; if (g.measureText(test).width <= maxW) cur = test; else { lines.push(cur); cur = w; } }
    lines.push(cur);
    if (lines.length <= maxLines && lines.every(l => g.measureText(l).width <= maxW)) return { lines, size };
  }
  return { lines: [s], size: 12 };
}
function getBackSprite() {
  if (backSprite) return backSprite;
  const k = spritePx / SW; const c = document.createElement('canvas');
  c.width = Math.round((SW + PAD * 2) * k); c.height = Math.round((SH + PAD * 2) * k);
  const g = c.getContext('2d'); g.scale(k, k); g.translate(PAD, PAD);
  g.fillStyle = '#e4ddd0'; roundRect(g, 0, 0, SW, SH, 10); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.15)'; g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 2;
  for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(16, 24 + i * 18); g.lineTo(SW - 16, 24 + i * 18); g.stroke(); }
  if (IMG.heko) { g.globalAlpha = 0.28; g.drawImage(IMG.heko, SW * 0.2, SH * 0.4, SW * 0.6, SW * 0.6 * 101.83 / 414.88); g.globalAlpha = 1; }
  backSprite = c; return c;
}

// ---------- Spielzustand ----------
let state = 'intro';
const aim = { x: 0, y: 0 };
let G = null;           // laufende Runde
let ambient = [];       // Verträge im Menü-Hintergrund
let parts = [], floats = [], rings = [];
let windDir = 1, gust = 0, windT = 0, flash = 0, menuSpawnT = 0;

function newRound() {
  return {
    timeLeft: ROUND_SECONDS, provision: 0, hits: 0, shots: 0, streak: 0, bestStreak: 0,
    mag: MAG_SIZE, boltT: 0, reloadT: 0, contracts: [], spawnT: 0.2, breath: 1, steady: false,
    recoil: 0, swayT: rand(0, 10), best: null, log: [], lastTick: 99, ended: false,
  };
}

function pickTariff() {
  let sum = 0; for (const t of TARIFFS) sum += spawnWeight(t);
  let r = Math.random() * sum;
  for (const t of TARIFFS) { r -= spawnWeight(t); if (r <= 0) return t; }
  return TARIFFS[TARIFFS.length - 1];
}

// Schwierigkeit hängt stufenlos am Wert: d=0 billig … d=1 MagentaMobil M Neu (156,50 €)
function makeContract(t, x, y, onScreen) {
  const d = difficulty(t);
  const z = clamp(1.02 - 0.6 * d + rand(-0.07, 0.07), 0.3, 1.05);           // Tiefe: teuer = weiter weg
  const w = baseCard * z * (1.08 - 0.3 * d), h = w * SH / SW;               // teuer = kleiner
  const dir = windDir;
  const speed = W * (0.055 + 0.23 * d) * (0.55 + 0.45 * z) * rand(0.85, 1.15); // teuer = schneller
  const fromTop = !onScreen && Math.random() < 0.18;
  const yMax = Math.min(HORIZON + (H * 0.86 - HORIZON) * 0.5, H * 0.8);
  const c = {
    t, d, z, w, h, dir,
    x: x ?? (onScreen ? rand(0.1, 0.9) * W : fromTop ? rand(0.05, 0.85) * W : (dir > 0 ? -w : W + w)),
    y: y ?? (fromTop ? -h : rand(H * 0.1, yMax - h)),
    vx: dir * speed * (fromTop ? 0.5 : 1),
    fall: H * (0.012 + 0.02 * d) * z * (fromTop ? 3 : 1),
    phase: rand(0, 7), omega: rand(1.1, 1.6) * (1 + 1.6 * d),
    swing: W * (0.012 + 0.035 * d) * z, bob: H * (0.012 + 0.03 * d) * z,
    rotAmp: 0.22 + 0.45 * d, spin: rand(-0.25, 0.25),
    flipAmp: 0.55 + 2.4 * d, flipFreq: rand(0.7, 1.2) * (1 + 1.8 * d), flipPh: rand(0, 7),
    jitT: rand(0.5, 2.5 - 2.0 * d), jitEvery: 2.6 - 2.2 * d, jx: 0, jy: 0, tjx: 0, tjy: 0,
    yMax, age: 0, entered: !!onScreen, rot: 0, flip: 0, frozen: false,
  };
  return c;
}

function updateContract(c, dt) {
  if (c.frozen || opts.freeze) return;
  const d = c.d; c.age += dt; c.phase += c.omega * dt;
  // hektische Richtungswechsel, je wertvoller desto öfter und heftiger
  c.jitT -= dt;
  if (c.jitT <= 0) {
    c.jitT = c.jitEvery * rand(0.6, 1.4);
    c.tjx = rand(-1, 1) * W * (0.02 + 0.16 * d) * c.z;
    c.tjy = rand(-1, 1) * H * (0.02 + 0.16 * d) * c.z;
  }
  if (c.y < H * 0.06) c.tjy = Math.abs(c.tjy) + H * 0.04;
  if (c.y > c.yMax) c.tjy = -Math.abs(c.tjy) - H * 0.05 - c.fall;
  const k = Math.min(1, dt * (1.2 + 4 * d));
  c.jx += (c.tjx - c.jx) * k; c.jy += (c.tjy - c.jy) * k;
  const gx = gust * W * 0.05 * c.z * c.dir;
  c.x += (c.vx + gx + c.jx + Math.cos(c.phase) * c.swing * c.omega) * dt;
  c.y += (c.fall + Math.sin(c.phase * 2) * c.bob * c.omega * 0.5 + c.jy) * dt;
  c.rot = Math.sin(c.phase) * c.rotAmp + c.spin;
  c.flip = Math.sin(c.age * c.flipFreq + c.flipPh) * c.flipAmp;
  if (!c.entered && c.x > 0 && c.x < W && c.y > 0) c.entered = true;
}
const outOfView = c => c.entered && (c.x < -c.w * 1.6 || c.x > W + c.w * 1.6 || c.y > H + c.h) || c.age > 40;

function drawContract(g, c) {
  const cf = Math.cos(c.flip), front = cf >= 0, s = c.w / SW;
  const sp = front ? cardSprite(c.t) : getBackSprite();
  g.save(); g.translate(c.x, c.y); g.rotate(c.rot); g.scale(Math.max(0.04, Math.abs(cf)), 1);
  g.globalAlpha = 0.72 + 0.28 * Math.min(1, c.z);
  g.drawImage(sp, -(SW / 2 + PAD) * s, -(SH / 2 + PAD) * s, (SW + 2 * PAD) * s, (SH + 2 * PAD) * s);
  const shade = (1 - Math.abs(cf)) * 0.4 + (1 - c.z) * 0.15;
  if (shade > 0.02) { g.globalAlpha = shade; g.fillStyle = '#2a1840'; roundRect(g, -c.w / 2, -c.h / 2, c.w, c.h, 10 * s); g.fill(); }
  g.restore();
}

function hitTest(list, px, py) {
  const sorted = [...list].sort((a, b) => b.z - a.z); // vorne zuerst
  for (const c of sorted) {
    const dx = px - c.x, dy = py - c.y, cs = Math.cos(c.rot), sn = Math.sin(c.rot);
    const lx = dx * cs + dy * sn, ly = -dx * sn + dy * cs;
    const sx = Math.abs(Math.cos(c.flip));
    if (Math.abs(lx) <= (c.w / 2) * sx + 2 && Math.abs(ly) <= c.h / 2 + 2) return c;
  }
  return null;
}

// ---------- Effekte ----------
function shred(c) {
  const n = 26 + Math.round(24 * c.d);
  const cols = ['#ffffff', '#f4efe6', '#ffffff', c.t.cat.startsWith('c') ? '#1d1f3f' : '#E20074', '#c9c3b8'];
  if (c.d > 0.45) cols.push('#ffcf3f', '#ffcf3f');
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(40, 260) * (0.6 + c.z * 0.6);
    parts.push({ x: c.x + rand(-c.w, c.w) * 0.3, y: c.y + rand(-c.h, c.h) * 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
      w: rand(4, 11) * c.z + 2, h: rand(3, 7) * c.z + 1.5, rot: rand(0, 7), vr: rand(-12, 12), fl: rand(0, 7), fs: rand(6, 16),
      col: cols[(Math.random() * cols.length) | 0], life: rand(1.4, 2.6), max: 2.6 });
  }
}
function updateFx(dt) {
  for (const p of parts) {
    p.vx += (gust * 30 * windDir - p.vx * 1.8) * dt; p.vy += (110 - p.vy * 1.8) * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.fl += p.fs * dt; p.life -= dt;
  }
  parts = parts.filter(p => p.life > 0);
  for (const f of floats) { f.y -= 38 * dt; f.life -= dt; }
  floats = floats.filter(f => f.life > 0);
  for (const r of rings) r.life -= dt;
  rings = rings.filter(r => r.life > 0);
  flash = Math.max(0, flash - dt * 5);
}
function drawParts(g) {
  for (const p of parts) {
    g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(Math.cos(p.fl), 1);
    g.globalAlpha = Math.min(1, p.life * 1.5); g.fillStyle = p.col; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
  }
  for (const r of rings) {
    const k = 1 - r.life / r.max;
    g.globalAlpha = r.life / r.max; g.strokeStyle = r.col; g.lineWidth = r.lw;
    g.beginPath(); g.arc(r.x, r.y, r.r0 + k * r.r1, 0, 7); g.stroke(); g.globalAlpha = 1;
  }
}
function drawFloats(g) {
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  for (const f of floats) {
    const a = Math.min(1, f.life * 1.6), pop = 1 + Math.max(0, f.life - f.max + 0.15) * 3;
    g.globalAlpha = a; g.font = `900 ${f.size * pop}px system-ui, sans-serif`;
    const tw = g.measureText(f.text).width, x = clamp(f.x, tw / 2 + 6, W - tw / 2 - 6);
    g.lineWidth = 5; g.strokeStyle = 'rgba(20,0,20,.85)'; g.strokeText(f.text, x, f.y);
    g.fillStyle = f.col; g.fillText(f.text, x, f.y);
    if (f.sub) { g.font = `700 ${f.size * 0.55}px system-ui, sans-serif`; g.lineWidth = 4;
      const sx = clamp(f.x, g.measureText(f.sub).width / 2 + 6, W - g.measureText(f.sub).width / 2 - 6);
      g.strokeText(f.sub, sx, f.y + f.size * 0.85); g.fillStyle = '#fff'; g.fillText(f.sub, sx, f.y + f.size * 0.85); }
  }
  g.globalAlpha = 1;
}

// ---------- Welt zeichnen ----------
function drawWorld(g, list) {
  g.drawImage(bgCanvas, 0, 0, W, H);
  for (const c of clouds) g.drawImage(cloudSprites[c.k], c.x, c.y, 320 * c.s, 110 * c.s);
  const sorted = [...list].sort((a, b) => a.z - b.z);
  for (const c of sorted) drawContract(g, c);
  drawParts(g);
}

function sway() {
  if (!G || opts.noSway) return { x: 0, y: 0 };
  const t = G.swayT, m = Math.min(W, H);
  let amp = m * 0.022;
  if (G.steady && G.breath > 0) amp *= 0.12; else if (G.breath <= 0.02) amp *= 1.7;
  return { x: amp * (Math.sin(t * 1.1) * 0.7 + Math.sin(t * 2.7 + 1.3) * 0.3), y: amp * (Math.sin(t * 0.8 + 0.6) * 0.6 + Math.cos(t * 2.1) * 0.4) };
}
function aimPoint() { const s = sway(); return { x: clamp(aim.x + s.x, 0, W), y: clamp(aim.y + s.y - (G ? G.recoil : 0), 0, H) }; }

function drawScope(g, P) {
  const R = scopeR;
  // abgedunkelte Umgebung
  g.save(); g.beginPath(); g.rect(0, 0, W, H); g.arc(P.x, P.y, R, 0, Math.PI * 2, true);
  g.fillStyle = 'rgba(6,4,16,.52)'; g.fill('evenodd'); g.restore();
  // vergrößertes Bild
  g.save(); g.beginPath(); g.arc(P.x, P.y, R, 0, Math.PI * 2); g.clip();
  g.translate(P.x, P.y); g.scale(ZOOM, ZOOM); g.translate(-P.x, -P.y);
  drawWorld(g, G.contracts);
  g.restore();
  // Linsen-Vignette
  const vg = g.createRadialGradient(P.x, P.y, R * 0.55, P.x, P.y, R);
  vg.addColorStop(0, 'rgba(0,10,30,0)'); vg.addColorStop(1, 'rgba(0,5,20,.6)');
  g.fillStyle = vg; g.beginPath(); g.arc(P.x, P.y, R, 0, 7); g.fill();
  // Fadenkreuz
  g.strokeStyle = 'rgba(10,10,10,.9)'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(P.x - R, P.y); g.lineTo(P.x - 7, P.y); g.moveTo(P.x + 7, P.y); g.lineTo(P.x + R, P.y);
  g.moveTo(P.x, P.y - R); g.lineTo(P.x, P.y - 7); g.moveTo(P.x, P.y + 7); g.lineTo(P.x, P.y + R); g.stroke();
  g.lineWidth = 4.5; g.beginPath();
  g.moveTo(P.x - R, P.y); g.lineTo(P.x - R * 0.55, P.y); g.moveTo(P.x + R * 0.55, P.y); g.lineTo(P.x + R, P.y);
  g.moveTo(P.x, P.y + R * 0.55); g.lineTo(P.x, P.y + R); g.stroke();
  g.fillStyle = 'rgba(10,10,10,.85)';
  for (let i = 1; i <= 4; i++) { const o = i * R * 0.11; for (const [dx, dy] of [[o, 0], [-o, 0], [0, o], [0, -o]]) { g.beginPath(); g.arc(P.x + dx, P.y + dy, 1.6, 0, 7); g.fill(); } }
  g.fillStyle = G.steady && G.breath > 0 ? '#3fd0ff' : '#ff1f8f';
  g.beginPath(); g.arc(P.x, P.y, 2.6, 0, 7); g.fill();
  // Ring
  g.lineWidth = R * 0.085; g.strokeStyle = '#0b0b10'; g.beginPath(); g.arc(P.x, P.y, R + R * 0.04, 0, 7); g.stroke();
  g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(P.x, P.y, R + R * 0.085, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
  g.strokeStyle = 'rgba(226,0,116,.8)'; g.lineWidth = 2; g.beginPath(); g.arc(P.x, P.y, R - 1, 0, 7); g.stroke();
  // Repetieren / Nachladen als Fortschrittsring
  const busy = G.reloadT > 0 ? 1 - G.reloadT / RELOAD_TIME : G.boltT > 0 ? 1 - G.boltT / BOLT_TIME : 1;
  if (busy < 1) { g.strokeStyle = G.reloadT > 0 ? '#ffcf3f' : '#ffffff'; g.lineWidth = 4;
    g.beginPath(); g.arc(P.x, P.y, R + R * 0.04, -Math.PI / 2, -Math.PI / 2 + busy * Math.PI * 2); g.stroke(); }
  g.font = `700 ${Math.max(10, R * 0.08)}px system-ui, sans-serif`; g.fillStyle = 'rgba(255,255,255,.75)'; g.textAlign = 'left';
  g.fillText(`${ZOOM.toFixed(1).replace('.', ',')}×`, P.x + R * 0.62, P.y + R * 0.7);
}

// ---------- Schießen ----------
function fire() {
  if (state !== 'play' || !G || G.ended) return;
  if (G.boltT > 0 || G.reloadT > 0) { A.dry(); return; }
  const P = aimPoint();
  G.shots++; G.mag--; A.shot(); flash = 1; G.recoil = scopeR * 0.32;
  const c = hitTest(G.contracts, P.x, P.y);
  if (c) {
    G.contracts.splice(G.contracts.indexOf(c), 1);
    const value = c.t.eur + c.t.ap;
    G.provision += value; G.hits++; G.streak++; G.bestStreak = Math.max(G.bestStreak, G.streak);
    G.log.push({ id: c.t.id, name: c.t.name, eur: c.t.eur, ap: c.t.ap });
    if (!G.best || value > G.best.eur + G.best.ap) G.best = c.t;
    shred(c); A.hit(c.d);
    rings.push({ x: P.x, y: P.y, r0: 4, r1: 40, lw: 3, col: c.d > 0.45 ? '#ffcf3f' : '#ffffff', life: 0.4, max: 0.4 });
    floats.push({ x: P.x, y: P.y - 26, text: payoutText(c.t), sub: c.t.name, size: clamp(Math.min(W, H) * 0.06, 18, 30), col: c.d > 0.45 ? '#ffd84a' : '#ffffff', life: 1.6, max: 1.6 });
    const pb = $('hudProv').parentElement; pb.classList.remove('bump'); void pb.offsetWidth; pb.classList.add('bump');
    if (G.streak % 5 === 0) {
      G.timeLeft += 3; A.bonus();
      floats.push({ x: W / 2, y: H * 0.3, text: `🔥 Serie ×${G.streak}! +3 s`, size: clamp(Math.min(W, H) * 0.065, 20, 34), col: '#ffcf3f', life: 1.8, max: 1.8 });
    }
  } else {
    G.streak = 0; A.miss();
    rings.push({ x: P.x, y: P.y, r0: 2, r1: 16, lw: 2, col: 'rgba(255,255,255,.7)', life: 0.35, max: 0.35 });
  }
  if (G.mag > 0) { G.boltT = BOLT_TIME; A.bolt(); }
  else { G.reloadT = RELOAD_TIME; A.reload(); }
  updateHud();
  $('aimHint').classList.add('fade');
}

// ---------- HUD ----------
function updateHud() {
  if (!G) return;
  $('hudProv').textContent = fmtEUR(G.provision);
  const tl = Math.max(0, Math.ceil(G.timeLeft));
  $('hudTime').textContent = tl; $('hudTime').parentElement.classList.toggle('low', tl <= 10);
  const am = $('hudAmmo'); let html = '';
  for (let i = 0; i < MAG_SIZE; i++) html += `<i class="${i < G.mag ? '' : 'empty'}"></i>`;
  if (am.innerHTML !== html) am.innerHTML = html;
  $('hudStreak').textContent = G.streak >= 2 ? `🔥 ${G.streak} in Folge` : '';
  $('reloadMsg').classList.toggle('hidden', !(G.reloadT > 0));
  $('btnFire').classList.toggle('cooldown', G.boltT > 0 || G.reloadT > 0);
  $('btnSteady').classList.toggle('on', G.steady && G.breath > 0);
  $('breathBar').style.transform = `scaleX(${G.breath})`;
}

// ---------- Ablauf ----------
function show(id) {
  for (const s of ['intro', 'menu', 'help', 'end', 'board']) $(s).classList.toggle('hidden', s !== id);
}
function startRound() {
  A.initAudio(); A.startMusic();
  G = newRound(); state = 'play'; parts = []; floats = []; rings = [];
  windDir = Math.random() < 0.5 ? 1 : -1;
  for (let i = 0; i < 4; i++) G.contracts.push(makeContract(pickTariff(), undefined, undefined, true));
  aim.x = W / 2; aim.y = H * 0.4;
  show(null); $('hud').classList.remove('hidden'); $('aimHint').classList.remove('fade');
  setTimeout(() => $('aimHint').classList.add('fade'), 5000);
  updateHud();
}
function endRound() {
  G.ended = true; state = 'end'; G.steady = false;
  $('hud').classList.add('hidden');
  A.fanfare();
  $('endProv').textContent = fmtEUR(G.provision);
  $('endHits').textContent = G.hits;
  $('endAcc').textContent = (G.shots ? Math.round(G.hits / G.shots * 100) : 0) + ' %';
  $('endStreak').textContent = G.bestStreak;
  $('endBest').textContent = G.best ? `Bester Abschuss: ${G.best.name} (${CATEGORIES[G.best.cat].short}) ${payoutText(G.best).slice(1).replace(/ /g, '\u00a0')}` : 'Kein Treffer – beim nächsten Mal!';
  $('nameInput').value = localStorage.getItem('mofu_name') || '';
  $('submitMsg').textContent = ''; $('submitMsg').className = 'submit-msg';
  $('btnSubmit').disabled = G.provision <= 0;
  if (G.provision <= 0) $('submitMsg').textContent = 'Ohne Provision kein Eintrag in die Bestenliste.';
  G.submitted = false;
  show('end');
  ambient = G.contracts; // fliegen im Hintergrund weiter
}

let lastBoardHighlight = null;
async function openBoard(from) {
  boardReturn = from; show('board');
  const list = $('boardList'), msg = $('boardMsg');
  list.innerHTML = ''; msg.textContent = 'Lade Bestenliste…';
  try {
    const rows = await fetchTop(15);
    msg.textContent = rows.length ? '' : 'Noch keine Einträge – sei die/der Erste!';
    rows.forEach((r, i) => {
      const li = document.createElement('li');
      const rk = document.createElement('span'); rk.className = 'rk'; rk.textContent = ['🥇', '🥈', '🥉'][i] || (i + 1);
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = r.name;
      const sm = document.createElement('small'); sm.textContent = `${r.hits} Treffer`; nm.appendChild(sm);
      const pv = document.createElement('span'); pv.className = 'pv'; pv.textContent = fmtEUR(r.provision_cents);
      li.append(rk, nm, pv);
      if (lastBoardHighlight && lastBoardHighlight.name === r.name && lastBoardHighlight.cents === r.provision_cents) li.classList.add('me');
      list.appendChild(li);
    });
  } catch (e) {
    msg.textContent = e.kind === 'missing' ? 'Bestenliste noch nicht eingerichtet.' : (e.message || 'Bestenliste gerade nicht erreichbar.');
  }
}
let boardReturn = 'menu';

// ---------- Eingabe ----------
let dragId = null, lastX = 0, lastY = 0;
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') {
    document.body.classList.add('mouse');
    aim.x = e.clientX; aim.y = e.clientY;
    if (e.button === 0) fire();
    if (e.button === 2 && G) G.steady = true;
    return;
  }
  document.body.classList.remove('mouse');
  if (dragId === null) { dragId = e.pointerId; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture?.(e.pointerId); }
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') { aim.x = e.clientX; aim.y = e.clientY; return; }
  if (e.pointerId !== dragId) return;
  const sens = 1.05;
  aim.x = clamp(aim.x + (e.clientX - lastX) * sens, 0, W); aim.y = clamp(aim.y + (e.clientY - lastY) * sens, 0, H);
  lastX = e.clientX; lastY = e.clientY;
  $('aimHint').classList.add('fade');
});
const endDrag = e => { if (e.pointerId === dragId) dragId = null; if (e.pointerType === 'mouse' && e.button === 2 && G) G.steady = false; };
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('contextmenu', e => e.preventDefault());
$('btnFire').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fire(); });
const steadyOn = e => { e.preventDefault(); e.stopPropagation(); if (G) G.steady = true; };
const steadyOff = () => { if (G) G.steady = false; };
$('btnSteady').addEventListener('pointerdown', steadyOn);
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('btnSteady').addEventListener(ev, steadyOff);
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space' || e.key === 'Shift') { if (G) G.steady = true; e.preventDefault(); }
  if (e.key === 'Enter' || e.key === 'f' || e.key === 'F') fire();
});
window.addEventListener('keyup', e => { if (e.code === 'Space' || e.key === 'Shift') steadyOff(); });
document.addEventListener('gesturestart', e => e.preventDefault());

$('intro').addEventListener('click', () => { A.initAudio(); A.startMusic(); state = 'menu'; show('menu'); });
$('btnPlay').addEventListener('click', startRound);
$('btnAgain').addEventListener('click', startRound);
$('btnBoard').addEventListener('click', () => openBoard('menu'));
$('btnEndBoard').addEventListener('click', () => openBoard('end'));
$('btnHelp').addEventListener('click', () => show('help'));
$('btnEndMenu').addEventListener('click', () => { state = 'menu'; show('menu'); });
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => {
  const back = b.closest('#board') ? boardReturn : 'menu'; show(back);
}));
const muteBtn = $('btnMute');
const syncMute = () => { muteBtn.textContent = A.isMuted() ? '🔇' : '🔊'; };
muteBtn.addEventListener('pointerdown', e => { e.stopPropagation(); A.initAudio(); A.setMuted(!A.isMuted()); syncMute(); });
syncMute();
$('nameForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!G || G.submitted || G.provision <= 0) return;
  const name = $('nameInput').value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 16);
  const msg = $('submitMsg');
  if (!name) { msg.textContent = 'Bitte gib einen Namen ein (1–16 Zeichen).'; msg.className = 'submit-msg err'; return; }
  localStorage.setItem('mofu_name', name);
  $('btnSubmit').disabled = true; msg.textContent = 'Speichere…'; msg.className = 'submit-msg';
  try {
    await submitScore({ name, provisionCents: G.provision, hits: G.hits, shots: G.shots });
    G.submitted = true; lastBoardHighlight = { name, cents: G.provision };
    msg.textContent = 'Eingetragen! ✔'; msg.className = 'submit-msg ok';
    setTimeout(() => { if (state === 'end') openBoard('end'); }, 700);
  } catch (err) {
    $('btnSubmit').disabled = false;
    msg.textContent = err.kind === 'missing' ? 'Bestenliste noch nicht eingerichtet.' : (err.message || 'Fehler beim Speichern.');
    msg.className = 'submit-msg err';
  }
});

// ---------- Hauptschleife ----------
let last = performance.now(), hudT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  // Wind & Böen
  windT += dt;
  gust = 0.5 + 0.5 * Math.sin(windT * 0.37) * Math.sin(windT * 0.13 + 1) + 0.25 * Math.sin(windT * 1.3);
  A.setWind(clamp(gust, 0, 1));
  for (const c of clouds) { c.x += c.v * windDir * (0.6 + gust) * dt; if (c.x > W + 50) c.x = -320 * c.s; if (c.x < -330 * c.s) c.x = W + 20; }

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (state === 'play' && G) {
    G.swayT += dt * (G.steady && G.breath > 0 ? 0.5 : 1);
    if (G.steady && G.breath > 0) G.breath = Math.max(0, G.breath - dt / 3.2); else if (!G.steady) G.breath = Math.min(1, G.breath + dt / 4);
    G.recoil *= Math.exp(-dt * 7);
    if (G.boltT > 0) G.boltT = Math.max(0, G.boltT - dt);
    if (G.reloadT > 0) { G.reloadT = Math.max(0, G.reloadT - dt); if (G.reloadT === 0) G.mag = MAG_SIZE; }
    G.timeLeft -= dt;
    const sec = Math.ceil(G.timeLeft);
    if (sec <= 5 && sec >= 1 && sec !== G.lastTick) { G.lastTick = sec; A.tick(); }
    G.spawnT -= dt;
    const maxC = W > H ? 9 : 7;
    if (G.spawnT <= 0 && !opts.freeze) { G.spawnT = rand(0.5, 1.0); if (G.contracts.length < maxC) G.contracts.push(makeContract(pickTariff())); }
    for (const c of G.contracts) updateContract(c, dt);
    G.contracts = G.contracts.filter(c => !outOfView(c));
    updateFx(dt);
    drawWorld(ctx, G.contracts);
    drawScope(ctx, aimPoint());
    drawFloats(ctx);
    if (flash > 0) { ctx.fillStyle = `rgba(255,240,220,${flash * 0.18})`; ctx.fillRect(0, 0, W, H); }
    hudT -= dt; if (hudT <= 0) { hudT = 0.1; updateHud(); }
    if (G.timeLeft <= 0) endRound();
  } else {
    // Menü / Endbildschirm: Verträge fliegen dekorativ vorbei
    menuSpawnT -= dt;
    if (menuSpawnT <= 0 && !opts.freeze) { menuSpawnT = rand(0.7, 1.3); if (ambient.length < 6) ambient.push(makeContract(pickTariff())); }
    for (const c of ambient) updateContract(c, dt);
    ambient = ambient.filter(c => !outOfView(c));
    updateFx(dt);
    drawWorld(ctx, ambient);
    drawFloats(ctx);
  }
  requestAnimationFrame(frame);
}

// ---------- Start ----------
(async function boot() {
  [IMG.heko, IMG.t] = await Promise.all([loadImg('assets/heko-logo.svg'), loadImg('assets/t-logo.svg')]);
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  for (let i = 0; i < 4; i++) ambient.push(makeContract(pickTariff(), undefined, undefined, true));
  if (params.has('nointro')) { state = 'menu'; show('menu'); }
  else setTimeout(() => { if (state === 'intro') { state = 'menu'; show('menu'); } }, 4200);
  requestAnimationFrame(frame);
})();

// Test-/Debug-Schnittstelle (für automatische Tests)
window.__mofu = {
  VERSION, TARIFFS, opts, aim, fmtEUR, payoutText,
  get state() { return state; }, get game() { return G; },
  setAim(x, y) { aim.x = x; aim.y = y; }, fire, startRound,
  aimPoint, endNow() { if (G) G.timeLeft = 0; },
  spawnAt(id, x, y) { const c = makeContract(TARIFFS[id], x, y, true); c.frozen = true; c.rot = 0; c.flip = 0; c.x = x; c.y = y; G.contracts.push(c); return c; },
  clearContracts() { if (G) G.contracts.length = 0; },
  clearFx() { parts = []; floats = []; rings = []; },
  sample(id) { const c = makeContract(TARIFFS[id], W / 2, H / 3, true); return { d: c.d, z: c.z, w: c.w, speed: Math.abs(c.vx), jitEvery: c.jitEvery, flipAmp: c.flipAmp, omega: c.omega, weight: spawnWeight(TARIFFS[id]) }; },
};
