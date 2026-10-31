// MoFu Sniper – HEKO präsentiert · highspeedvorort.de
import { TARIFFS, CATEGORIES, difficulty, spawnWeight, valueChance } from './data.js?v=20261031-1510';
import * as A from './audio.js?v=20261031-1510';
import { fetchTop, submitScore } from './leaderboard.js?v=20261031-1510';

export const VERSION = '20261031-1510';
const params = new URLSearchParams(location.search);
const ROUND_SECONDS = Math.max(5, +params.get('seconds') || 30);
const MAG_SIZE = 5, BOLT_TIME = 0.6, RELOAD_TIME = 1.7, ZOOM = 3.0, ZOOM_TIME = 0.2;
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
let bgCanvas = null, cloudSprites = [], clouds = [], banners = {};
const IMG = {};
const sprites = new Map(); let backSprite = null, spritePx = 400;

function resize() {
  W = window.innerWidth; H = window.innerHeight;
  DPR = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  const m = Math.min(W, H);
  baseCard = clamp(m * 0.22, 70, 170);
  scopeR = clamp(m * 0.40, 120, 260);
  HORIZON = H * (W > H ? 0.70 : 0.64);
  spritePx = clamp(Math.round(baseCard * DPR * 1.9), 220, 680);
  sprites.clear(); backSprite = null;
  buildBackground(); buildClouds();
  aim.x = clamp(aim.x || W / 2, 0, W); aim.y = clamp(aim.y || H * 0.4, 0, H);
}

// ---------- Hintergrund: Metropole bei Abendrot ----------
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }

function buildBackground() {
  const scale = Math.min(DPR * 2, Math.sqrt(16e6 / (W * H)));
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
  banners.bb = { x: bbX, y: bbY, w: bbW, h: bbH };
  // Fassaden-Banner am Telekom-Haus
  const fw = bwid * 0.86, fh = Math.min(bhh * 0.2, fw * 0.32);
  banners.facade = { x: bx + (bwid - fw) / 2, y: HORIZON - bhh + bhh * 0.12, w: fw, h: fh };
  // HEKO-Tower
  drawTower(g, hx, hw, hh, true, R);
  g.fillStyle = '#3a3360'; g.fillRect(hx + hw * 0.47, HORIZON - hh - hh * 0.12, hw * 0.06, hh * 0.12);
  g.fillStyle = '#ff3366'; g.beginPath(); g.arc(hx + hw * 0.5, HORIZON - hh - hh * 0.12, 2.5, 0, 7); g.fill();
  const lw = hw * 1.9, lh = lw * 0.36, lx = hx + hw / 2 - lw / 2, ly = HORIZON - hh - lh * 0.55;
  banners.heko = { x: lx, y: ly, w: lw, h: lh };
  // senkrechtes Banner am HEKO-Tower
  banners.vert = { x: hx + hw * 0.18, y: ly + lh + hh * 0.06, w: hw * 0.64, h: Math.min(hh * 0.42, hw * 2.6) };
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
  { const pw = Math.min(110, W * 0.22), ph = pw * 0.3; banners.ledge = { x: W * 0.5 - pw / 2, y: ry + 10, w: pw, h: ph }; }
}

// ---------- Banner & Logos: Vektor, jedes Bild neu gezeichnet → gestochen scharf, auch im 3×-Zoom ----------
const HEKO_W = 414.88, HEKO_H = 101.83;
const HEKO_NAVY = ["M0,95.73c0,6.1,6.1,6.1,6.1,6.1h7.95c.07,0,5.82-.05,6.07-5.73V61.06h57.07v35.03c.25,5.69,6,5.73,6.07,5.73h7.95s6.1,0,6.1-6.1V6.1C97.32,0,91.22,0,91.22,0h-7.94s-5.83,.02-6.08,5.73V40.77H20.12V5.73C19.87,.02,14.05,0,14.05,0H6.1S0,0,0,6.1V95.73H0Z", "M211.98,95.73c0,6.1,6.1,6.1,6.1,6.1h8.11c.07,0,5.96-.04,6.08-5.92v-29.47l45.14,33.98c1.08,.72,2.48,1.39,3.77,1.41h26.07c1.31-.27,3.48-1.32-3.38-6.02l-12.62-9.05h-.03l-51.49-35.76,51.44-35.84-.03,.02,12.73-9.08C312.38,.16,306.89,0,306.49,0h-24.35c-1.83,0-3.65,.69-5.02,1.68-.62,.44-1.46,1.06-2.2,1.61l-42.64,32.1V5.92C232.15,.01,226.19,0,226.19,0h-8.11S211.98,0,211.98,6.1V95.73h0Z", "M414.88,81.53v-24.87h-20.12v24.87h-60.54V20.3h24.55s-.03,0-.03,0V0h-24.53c-5.78,0-10.58,2.05-14.4,6.16-3.82,4.11-5.72,8.82-5.72,14.14v61.24c0,2.43,.23,4.68,.69,6.77,2.2,9.02,8.67,13.53,19.43,13.53h60.54c13.41,0,20.12-6.77,20.12-20.3", "M189.92,101.83s6.1,0,6.1-6.1v-8.11c0-5.27-4.55-5.99-5.79-6.08h-16.29s-38.29,0-38.29,0v-20.47h14.46v.03h31.38v-.03h8.96c1.49-.17,5.57-1.07,5.57-6.06v-8.13c0-5.69-5.3-6.07-6.02-6.1h-8.51s-31.32,0-31.32,0h0s-.06-.01-.06-.01v.02h-14.46V20.3h14.46v.02h.06s31.32-.01,31.32-.01h0s8.52,0,8.52,0c.77-.03,6-.44,6-6.1V6.1C196.02,0,189.92,0,189.92,0h-39.75s-28.72,0-28.72,0c0,0-6.1,0-6.1,6.1V95.73c0,6.1,6.1,6.1,6.1,6.1h68.46Z"];
const HEKO_BLUE = "M414.88,50.91V20.3c0-5.55-1.94-10.32-5.81-14.31C405.19,2,400.42,0,394.76,0h-30.27V20.3h30.27v30.62h20.12Z";
const T_PATH = 'M20 22h60v14H57v48H43V36H20z';
let hekoPaths = null, tPath = null;
function vecPaths() {
  if (!hekoPaths) { hekoPaths = { navy: HEKO_NAVY.map(d => new Path2D(d)), blue: new Path2D(HEKO_BLUE) }; tPath = new Path2D(T_PATH); }
}
export function drawHeko(g, x, y, w, navy = '#262455', blue = '#009fe3') {
  vecPaths(); const k = w / HEKO_W;
  g.save(); g.translate(x, y); g.scale(k, k);
  g.fillStyle = navy; for (const p of hekoPaths.navy) g.fill(p);
  g.fillStyle = blue; g.fill(hekoPaths.blue); g.restore();
}
function drawTGlyph(g, x, y, size, color = '#fff', bg = null) { // Box 100×100
  vecPaths(); const k = size / 100;
  g.save(); g.translate(x, y); g.scale(k, k);
  if (bg) { g.fillStyle = bg; roundRect(g, 0, 0, 100, 100, 14); g.fill(); }
  g.fillStyle = color; g.fill(tPath); g.fillRect(18, 52, 13, 13); g.fillRect(69, 52, 13, 13);
  g.restore();
}
const FONT = '"Segoe UI", Roboto, "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif';
function bannerText(g, txt, x, y, maxW, size, weight, color) {
  g.font = `${weight} ${size}px ${FONT}`;
  const tw = g.measureText(txt).width; if (tw > maxW) { size *= maxW / tw; g.font = `${weight} ${size}px ${FONT}`; }
  g.fillStyle = color; g.fillText(txt, x, y);
}
function drawBanners(g) {
  const B = banners; if (!B.bb) return;
  g.save(); g.textBaseline = 'middle'; g.textAlign = 'left';
  // 1) highspeedvorort.de – Dach-Billboard (magenta, leuchtend)
  let b = B.bb;
  g.save(); g.shadowColor = 'rgba(226,0,116,.85)'; g.shadowBlur = 16; g.fillStyle = '#E20074'; roundRect(g, b.x, b.y, b.w, b.h, b.h * 0.06); g.fill(); g.restore();
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = Math.max(0.6, b.h * 0.02); roundRect(g, b.x + b.h * 0.04, b.y + b.h * 0.04, b.w - b.h * 0.08, b.h * 0.92, b.h * 0.05); g.stroke();
  drawTGlyph(g, b.x + b.h * 0.1, b.y + b.h * 0.1, b.h * 0.8, '#fff');
  bannerText(g, 'highspeedvorort.de', b.x + b.h * 0.98, b.y + b.h * 0.37, b.w - b.h * 1.1, b.h * 0.24, 900, '#fff');
  bannerText(g, 'Glasfaser & MoFu vor Ort', b.x + b.h * 0.98, b.y + b.h * 0.68, b.w - b.h * 1.1, b.h * 0.165, 700, '#ffe3f1');
  // 2) Fassaden-Banner am Telekom-Haus
  b = B.facade;
  g.fillStyle = '#ffffff'; roundRect(g, b.x, b.y, b.w, b.h, b.h * 0.08); g.fill();
  g.fillStyle = '#E20074'; g.fillRect(b.x, b.y + b.h * 0.86, b.w, b.h * 0.14);
  drawTGlyph(g, b.x + b.h * 0.1, b.y + b.h * 0.08, b.h * 0.72, '#fff', '#E20074');
  bannerText(g, 'MOBILFUNK & GLASFASER', b.x + b.h * 0.95, b.y + b.h * 0.43, b.w - b.h * 1.05, b.h * 0.3, 900, '#1a1830');
  // 3) HEKO-Leuchtschild auf dem Tower
  b = B.heko;
  g.save(); g.shadowColor = 'rgba(120,200,255,.9)'; g.shadowBlur = 18; g.fillStyle = '#fff'; roundRect(g, b.x, b.y, b.w, b.h, b.h * 0.1); g.fill(); g.restore();
  { const iw = b.w * 0.84; drawHeko(g, b.x + (b.w - iw) / 2, b.y + (b.h - iw * HEKO_H / HEKO_W) / 2, iw); }
  // 4) senkrechtes Banner am HEKO-Tower
  b = B.vert;
  g.fillStyle = '#262455'; roundRect(g, b.x, b.y, b.w, b.h, b.w * 0.08); g.fill();
  g.fillStyle = '#E20074'; g.fillRect(b.x, b.y, b.w, b.w * 0.12); g.fillRect(b.x, b.y + b.h - b.w * 0.12, b.w, b.w * 0.12);
  g.save(); g.translate(b.x + b.w * 0.52, b.y + b.h / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center';
  bannerText(g, 'HEKO BÜROSERVICE', 0, 0, b.h * 0.8, b.w * 0.42, 900, '#ffffff'); g.restore();
  // 5) HEKO-Schild an der Brüstung
  b = B.ledge;
  g.fillStyle = 'rgba(255,255,255,.92)'; roundRect(g, b.x, b.y, b.w, b.h, 4); g.fill();
  drawHeko(g, b.x + b.w * 0.08, b.y + (b.h - b.w * 0.84 * HEKO_H / HEKO_W) / 2, b.w * 0.84);
  g.restore();
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
    mag: MAG_SIZE, boltT: 0, reloadT: 0, contracts: [], spawnT: 0.2, breath: 1, steady: false, zoom: false, zoomT: 0,
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
// Alle Schwierigkeits-Stellgrößen als stetige Funktionen des Werts (d = 0 … 1).
// Größer d ⇒ weiter weg/kleiner, schneller, hektischer, häufigere Richtungswechsel, stärkeres Überschlagen.
export function profile(d) {
  return {
    zFar: 0.42 - 0.2 * d, zNear: 0.78 - 0.3 * d,   // Tiefe (Maßstab) – fern bzw. selten nah
    sizeK: 1.08 - 0.3 * d,                          // zusätzlicher Größenfaktor
    speedK: 0.055 + 0.23 * d,                       // Drift in Bildschirmbreiten/s (vor Tiefenfaktor)
    omegaK: 1 + 1.6 * d,                            // Pendel-Frequenz (Flattern)
    swingK: 0.012 + 0.035 * d, bobK: 0.012 + 0.03 * d,
    rotAmp: 0.22 + 0.45 * d, flipAmp: 0.55 + 2.4 * d, flipFreqK: 1 + 1.8 * d,
    jitEvery: 2.6 - 2.2 * d,                        // s zwischen Richtungswechseln
    jitAmp: 0.02 + 0.16 * d,                        // Stärke der Richtungswechsel
    jitRate: 1.2 + 4 * d,                           // wie abrupt
    fallK: 0.012 + 0.02 * d,
  };
}
function makeContract(t, x, y, onScreen) {
  const d = difficulty(t), P = profile(d);
  // Tiefe: fast alle weit weg zwischen den Hochhäusern, nur ab und zu ein näherer; teuer = noch weiter weg
  const near = Math.random() < 0.12;
  const z = near ? clamp(P.zNear + rand(-0.08, 0.08), 0.4, 0.9)
                 : clamp(P.zFar + rand(-0.06, 0.06), 0.17, 0.5);
  const w = baseCard * z * P.sizeK, h = w * SH / SW;               // teuer = kleiner
  const dir = windDir;
  const speed = W * P.speedK * (0.55 + 0.45 * z) * rand(0.85, 1.15); // teuer = schneller
  const fromTop = !onScreen && Math.random() < 0.18;
  const yMax = Math.min(HORIZON + (H * 0.86 - HORIZON) * 0.5, H * 0.8) - (1 - z) * (H * 0.06);
  const c = {
    t, d, z, w, h, dir,
    x: x ?? (onScreen ? rand(0.1, 0.9) * W : fromTop ? rand(0.05, 0.85) * W : (dir > 0 ? -w : W + w)),
    y: y ?? (fromTop ? -h : z < 0.55 ? rand(Math.max(H * 0.14, HORIZON - H * 0.42), HORIZON - h * 1.2) : rand(H * 0.1, yMax - h)),
    vx: dir * speed * (fromTop ? 0.5 : 1),
    fall: H * P.fallK * z * (fromTop ? 3 : 1),
    phase: rand(0, 7), omega: rand(1.1, 1.6) * P.omegaK,
    swing: W * P.swingK * z, bob: H * P.bobK * z,
    rotAmp: P.rotAmp, spin: rand(-0.25, 0.25),
    flipAmp: P.flipAmp, flipFreq: rand(0.7, 1.2) * P.flipFreqK, flipPh: rand(0, 7),
    jitT: rand(0.3, P.jitEvery), jitEvery: P.jitEvery, jitAmp: P.jitAmp, jitRate: P.jitRate, jx: 0, jy: 0, tjx: 0, tjy: 0,
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
    c.tjx = rand(-1, 1) * W * c.jitAmp * c.z;
    c.tjy = rand(-1, 1) * H * c.jitAmp * c.z;
  }
  if (c.y < H * 0.06) c.tjy = Math.abs(c.tjy) + H * 0.04;
  if (c.y > c.yMax) c.tjy = -Math.abs(c.tjy) - H * 0.05 - c.fall;
  const k = Math.min(1, dt * c.jitRate);
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
  g.globalAlpha = 0.8 + 0.2 * Math.min(1, c.z);
  g.drawImage(sp, -(SW / 2 + PAD) * s, -(SH / 2 + PAD) * s, (SW + 2 * PAD) * s, (SH + 2 * PAD) * s);
  const shade = (1 - Math.abs(cf)) * 0.4;
  if (shade > 0.02) { g.globalAlpha = shade; g.fillStyle = '#2a1840'; roundRect(g, -c.w / 2, -c.h / 2, c.w, c.h, 10 * s); g.fill(); }
  const haze = clamp((0.85 - c.z) * 0.5, 0, 0.36);              // Dunst der Abendluft: weit weg = blasser/rosa
  if (haze > 0.01) { g.globalAlpha = haze; g.fillStyle = '#c98bb8'; roundRect(g, -c.w / 2, -c.h / 2, c.w, c.h, 10 * s); g.fill(); }
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
  drawBanners(g); // nach den Wolken → volle Leuchtkraft & Kontrast
  const sorted = [...list].sort((a, b) => a.z - b.z);
  for (const c of sorted) drawContract(g, c);
  drawParts(g);
}

// Unruhe: aus der Hüfte leicht, im Zoom stark (Atmung + Handzittern). RUHIG hilft, aber nicht ganz.
function sway() {
  if (!G || opts.noSway) return { x: 0, y: 0 };
  const t = G.swayT, m = Math.min(W, H), z = ease(G.zoomT);
  const holding = G.steady && G.breath > 0, empty = G.breath <= 0.02;
  let breathAmp = m * lerp(0.008, 0.036, z), tremor = m * lerp(0.0015, 0.0055, z);
  if (holding) { breathAmp *= 0.32; tremor *= 0.55; } else if (empty) { breathAmp *= 1.6; tremor *= 1.8; }
  const bx = Math.sin(t * 1.15) * 0.65 + Math.sin(t * 2.7 + 1.3) * 0.35;
  const by = Math.sin(t * 0.85 + 0.6) * 0.6 + Math.cos(t * 2.2) * 0.4;
  const tx = Math.sin(t * 9.3) * 0.5 + Math.sin(t * 13.7 + 2) * 0.3 + Math.sin(t * 21.1 + 4) * 0.2;
  const ty = Math.cos(t * 8.1 + 1) * 0.5 + Math.sin(t * 15.3) * 0.3 + Math.cos(t * 19.7 + 3) * 0.2;
  return { x: breathAmp * bx + tremor * tx, y: breathAmp * by + tremor * ty };
}
const ease = t => t * t * (3 - 2 * t);
function aimPoint() { const s = sway(); return { x: clamp(aim.x + s.x, 0, W), y: clamp(aim.y + s.y - (G ? G.recoil * (0.25 + 0.75 * ease(G.zoomT)) : 0), 0, H) }; }
// Streuung aus der Hüfte (ohne Zoom): großer Kreis, darum lohnt sich das Anlegen
function hipSpread() { return opts.noSway ? 0 : Math.min(W, H) * 0.07; }

// ---------- Gewehr (First-Person) ----------
function drawRifle(g, P) {
  const z = ease(G ? G.zoomT : 0);
  if (z > 0.98) return;
  const m = Math.min(W, H);
  const L = clamp(Math.min(H * 0.5, W * 0.95), 180, 440);
  const px = W * (W > H ? 0.64 : 0.58), py = H + L * 0.14;
  let ang = Math.atan2(P.x - px, -(P.y - py));           // 0 = gerade nach oben
  ang = clamp(ang * 0.85, -0.95, 0.35);
  const kick = G ? G.recoil / scopeR : 0;
  g.save();
  g.globalAlpha = 1 - z;
  g.translate(px - z * (px - W / 2) * 0.6, py + z * L * 0.55 + kick * L * 0.12);
  g.rotate(ang + kick * 0.08);
  // perspektivisches Trapez entlang der Laufachse: y=0 nah (breit), y=-1 fern (schmal)
  const k = v => v * L;
  const WF = 1.45; const quad = (y0, y1, w0, w1, fill, r = 0) => { w0 *= WF; w1 *= WF; g.beginPath(); g.moveTo(-k(w0) / 2, k(y0)); g.lineTo(-k(w1) / 2, k(y1)); g.lineTo(k(w1) / 2, k(y1)); g.lineTo(k(w0) / 2, k(y0)); g.closePath(); g.fillStyle = fill; g.fill(); };
  const lg = (x0, x1, stops) => { const gr = g.createLinearGradient(k(x0), 0, k(x1), 0); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
  // Schatten
  g.save(); g.globalAlpha *= 0.28; g.translate(L * 0.03, L * 0.02); quad(0.1, -0.62, 0.36, 0.1, '#000'); g.restore();
  // Schaft (Kunststoff/Carbon, dunkel) mit Magenta-Zierlinie
  quad(0.12, -0.3, 0.36, 0.17, lg(-0.18, 0.18, [[0, '#15151c'], [0.35, '#34343f'], [0.6, '#2a2a33'], [1, '#101016']]));
  quad(0.12, -0.3, 0.05, 0.022, 'rgba(226,0,116,.95)');
  g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(-k(0.15), k(0.1)); g.lineTo(-k(0.075), k(-0.29)); g.lineTo(-k(0.06), k(-0.29)); g.lineTo(-k(0.12), k(0.1)); g.fill();
  // HEKO-Plakette am Schaft
  if (IMG.heko) { g.save(); g.translate(k(0.09), k(-0.02)); g.rotate(-0.06); g.fillStyle = 'rgba(255,255,255,.9)'; roundRect(g, -k(0.05), -k(0.014), k(0.1), k(0.028), 3); g.fill();
    g.drawImage(IMG.heko, -k(0.044), -k(0.010), k(0.088), k(0.088) * 101.83 / 414.88); g.restore(); }
  // System / Verschluss
  quad(-0.28, -0.56, 0.17, 0.1, lg(-0.09, 0.09, [[0, '#2c2d33'], [0.45, '#6a6c76'], [0.6, '#4a4c55'], [1, '#1e1f24']]));
  // Kammerstängel rechts
  g.strokeStyle = '#5b5d66'; g.lineWidth = k(0.016); g.lineCap = 'round';
  g.beginPath(); g.moveTo(k(0.06), k(-0.36)); g.lineTo(k(0.13), k(-0.33)); g.stroke();
  g.fillStyle = '#2a2b31'; g.beginPath(); g.arc(k(0.135), k(-0.33), k(0.018), 0, 7); g.fill();
  // Lauf
  quad(-0.55, -1.0, 0.05, 0.024, lg(-0.025, 0.025, [[0, '#1a1b20'], [0.4, '#7c7f8a'], [0.55, '#4d4f58'], [1, '#141418']]));
  // Mündungsbremse
  quad(-0.95, -1.02, 0.036, 0.032, lg(-0.02, 0.02, [[0, '#111'], [0.5, '#555'], [1, '#111']]));
  // Zielfernrohr (oben auf dem System)
  g.save(); g.translate(0, 0);
  quad(-0.2, -0.27, 0.15, 0.135, '#18181d');                  // Okular
  quad(-0.205, -0.215, 0.152, 0.15, '#E20074');               // Magenta-Ring
  quad(-0.27, -0.6, 0.095, 0.075, lg(-0.05, 0.05, [[0, '#0f0f13'], [0.4, '#3d3e46'], [0.55, '#25262c'], [1, '#0c0c10']]));
  quad(-0.6, -0.7, 0.075, 0.115, '#1a1a20');                  // Objektiv-Glocke
  quad(-0.67, -0.69, 0.11, 0.112, '#E20074');
  g.fillStyle = 'rgba(120,200,255,.55)'; g.beginPath(); g.ellipse(0, k(-0.7), k(0.05), k(0.012), 0, 0, 7); g.fill();
  // Türme
  g.fillStyle = '#26272d'; roundRect(g, -k(0.022), k(-0.43), k(0.044), k(0.04), 3); g.fill();
  roundRect(g, k(0.04), k(-0.42), k(0.03), k(0.03), 3); g.fill();
  if (IMG.t) g.drawImage(IMG.t, -k(0.016), k(-0.505), k(0.032), k(0.032));
  g.restore();
  // Mündungsfeuer
  if (flash > 0.4) {
    const r = k(0.09) * flash; const fg = g.createRadialGradient(0, k(-1.05), 0, 0, k(-1.05), r * 2);
    fg.addColorStop(0, 'rgba(255,255,230,1)'); fg.addColorStop(0.3, 'rgba(255,200,90,.9)'); fg.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = fg; g.beginPath(); g.arc(0, k(-1.05), r * 2, 0, 7); g.fill();
  }
  g.restore();
}

function drawReticle(g, P) {
  const z = ease(G.zoomT); if (z > 0.6) return;
  g.save(); g.globalAlpha = 1 - z / 0.6;
  const sr = hipSpread();
  if (sr > 0) { g.strokeStyle = 'rgba(255,255,255,.35)'; g.setLineDash([4, 6]); g.lineWidth = 1.2; g.beginPath(); g.arc(P.x, P.y, sr, 0, 7); g.stroke(); g.setLineDash([]); }
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 4;
  const seg = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(P.x + x1, P.y + y1); g.lineTo(P.x + x2, P.y + y2); g.stroke(); };
  for (const [c, w] of [['rgba(0,0,0,.55)', 4], ['#fff', 2]]) { g.strokeStyle = c; g.lineWidth = w; seg(-16, 0, -6, 0); seg(6, 0, 16, 0); seg(0, -16, 0, -6); seg(0, 6, 0, 16); }
  g.fillStyle = '#ff1f8f'; g.beginPath(); g.arc(P.x, P.y, 2.4, 0, 7); g.fill();
  const busy = G.reloadT > 0 ? 1 - G.reloadT / RELOAD_TIME : G.boltT > 0 ? 1 - G.boltT / BOLT_TIME : 1;
  if (busy < 1) { g.strokeStyle = G.reloadT > 0 ? '#ffcf3f' : '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(P.x, P.y, 22, -Math.PI / 2, -Math.PI / 2 + busy * Math.PI * 2); g.stroke(); }
  g.restore();
}

function drawScope(g, P) {
  const z = ease(G.zoomT); if (z < 0.03) return;
  const R = scopeR * (0.55 + 0.45 * z), Z = lerp(1, ZOOM, z);
  g.save(); g.globalAlpha = Math.min(1, z * 1.6);
  // Vignette um das Zielfernrohr (fast schwarz, wie beim echten Anlegen)
  g.save(); g.beginPath(); g.rect(0, 0, W, H); g.arc(P.x, P.y, R, 0, Math.PI * 2, true);
  g.fillStyle = `rgba(4,3,10,${0.86 * z})`; g.fill('evenodd'); g.restore();
  // vergrößertes Bild
  g.save(); g.beginPath(); g.arc(P.x, P.y, R, 0, Math.PI * 2); g.clip();
  g.translate(P.x, P.y); g.scale(Z, Z); g.translate(-P.x, -P.y);
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
  g.fillText(`${Z.toFixed(1).replace('.', ',')}×`, P.x + R * 0.62, P.y + R * 0.7);
  g.restore();
}

// ---------- Schießen ----------
function fire() {
  if (state !== 'play' || !G || G.ended) return;
  if (G.boltT > 0 || G.reloadT > 0) { A.dry(); return; }
  const P = aimPoint();
  const scoped = G.zoomT > 0.85;
  if (!scoped) { const sr = hipSpread() * (1 - ease(G.zoomT)), a = rand(0, Math.PI * 2), r = sr * Math.sqrt(Math.random()); P.x += Math.cos(a) * r; P.y += Math.sin(a) * r; }
  G.lastShot = { x: P.x, y: P.y, scoped };
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
    if (G.streak % 5 === 0) A.bonus(); // nur Jingle – keine Zeitgutschrift, Runde bleibt exakt 30 s
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
  $('btnZoom').classList.toggle('on', G.zoom);
  document.body.classList.toggle('scoped', G.zoom);
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
  G.ended = true; state = 'end'; G.steady = false; G.zoom = false; document.body.classList.remove('scoped');
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
    if (e.button === 2) setZoom(true);
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
const endDrag = e => { if (e.pointerId === dragId) dragId = null; if (e.pointerType === 'mouse' && e.button === 2) setZoom(false); };
function setZoom(on) {
  if (!G || state !== 'play') return;
  if (on !== G.zoom) { G.zoom = on; A.zoom?.(on); }
  updateHud();
}
// ZOOM-Knopf: kurz tippen = an/aus, gedrückt halten = nur solange gehalten
let zoomDownAt = 0, zoomWasOn = false;
$('btnZoom').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); zoomDownAt = performance.now(); zoomWasOn = !!(G && G.zoom); setZoom(true); });
const zoomUp = e => { if (!zoomDownAt) return; const held = performance.now() - zoomDownAt; zoomDownAt = 0;
  if (held > 260 || zoomWasOn) setZoom(false); };
for (const ev of ['pointerup', 'pointercancel']) $('btnZoom').addEventListener(ev, zoomUp);
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
  if ((e.key === 'z' || e.key === 'Z' || e.key === 'q' || e.key === 'Q') && !e.repeat && G) setZoom(!G.zoom);
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
    G.zoomT = clamp(G.zoomT + (G.zoom ? 1 : -1) * dt / ZOOM_TIME, 0, 1);
    G.swayT += dt * (G.steady && G.breath > 0 ? 0.6 : 1);
    if (G.steady && G.breath > 0) G.breath = Math.max(0, G.breath - dt / 3.2); else if (!G.steady) G.breath = Math.min(1, G.breath + dt / 4);
    G.recoil *= Math.exp(-dt * 7);
    if (G.boltT > 0) G.boltT = Math.max(0, G.boltT - dt);
    if (G.reloadT > 0) { G.reloadT = Math.max(0, G.reloadT - dt); if (G.reloadT === 0) G.mag = MAG_SIZE; }
    G.timeLeft -= dt;
    const sec = Math.ceil(G.timeLeft);
    if (sec <= 5 && sec >= 1 && sec !== G.lastTick) { G.lastTick = sec; A.tick(); }
    G.spawnT -= dt;
    const maxC = W > H ? 11 : 9;
    if (G.spawnT <= 0 && !opts.freeze) { G.spawnT = rand(0.5, 1.0); if (G.contracts.length < maxC) G.contracts.push(makeContract(pickTariff())); }
    for (const c of G.contracts) updateContract(c, dt);
    G.contracts = G.contracts.filter(c => !outOfView(c));
    updateFx(dt);
    drawWorld(ctx, G.contracts);
    const P = aimPoint();
    drawRifle(ctx, P);
    drawReticle(ctx, P);
    drawScope(ctx, P);
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
  setAim(x, y) { aim.x = x; aim.y = y; }, fire, startRound, setZoom, hipSpread,
  aimPoint, endNow() { if (G) G.timeLeft = 0; },
  spawnAt(id, x, y) { const c = makeContract(TARIFFS[id], x, y, true); c.frozen = true; c.rot = 0; c.flip = 0; c.x = x; c.y = y; G.contracts.push(c); return c; },
  clearContracts() { if (G) G.contracts.length = 0; },
  clearFx() { parts = []; floats = []; rings = []; },
  profile, valueChance, spawnWeight, difficulty, get banners() { return banners; },
  // simuliert die Flugzeit (Sekunden sichtbar) eines frisch vom Rand gestarteten Vertrags
  simLife(id, n = 200) { let tot = 0, vis = 0; const g0 = gust;
    for (let i = 0; i < n; i++) { const c = makeContract(TARIFFS[id]); let t = 0, seen = 0;
      while (!outOfView(c) && t < 40) { gust = 0.5 + 0.5 * Math.sin(t * 0.37 + i); updateContract(c, 1 / 30); t += 1 / 30; if (c.x > 0 && c.x < W && c.y > 0 && c.y < H) seen += 1 / 30; }
      tot += t; vis += seen; }
    gust = g0; return { life: tot / n, visible: vis / n }; },
  sample(id) { const c = makeContract(TARIFFS[id], W / 2, H / 3, true); return { d: c.d, z: c.z, w: c.w, scoped: c.w * ZOOM, speed: Math.abs(c.vx), jitEvery: c.jitEvery, flipAmp: c.flipAmp, omega: c.omega, weight: spawnWeight(TARIFFS[id]) }; },
};
