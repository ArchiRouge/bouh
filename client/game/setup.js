/* Pixels Worlds — client, setup.js : Monde de l'île en cours, canvases et échelle, ambiance par zone, police pixel, état du jeu.
   Les fichiers de client/game/ se partagent leurs déclarations (scripts classiques chargés dans l'ordre par persist.js,
   voir GAME_FILES) : une fonction ou une variable d'un fichier sert aux suivants. */
'use strict';
const C = window.EtheriaCore,
  ARTAPI = window.EtheriaArt;
// île où se trouve le héros (voyage par les ponts) : lue dans la sauvegarde avant de construire le monde
const ISLE = (() => {
  try {
    const f = sessionStorage.getItem('etheria_isle_force');
    if (f) return C.cleanIsle(JSON.parse(f));
  } catch (e) {
    /* ignore */
  }
  try {
    const sv = JSON.parse(localStorage.getItem('etheria_solo') || 'null') || (window.ETHERIA_SEED && window.ETHERIA_SEED.solo);
    return C.cleanIsle(sv && sv.isle);
  } catch (e) {
    return { k: 'bourg' };
  }
})();
const W = C.buildWorld(C.SEED, ISLE),
  PVP = W.isle !== 'bourg';
const DGN = W.isle === 'donjon' ? C.DG[W.tier] : null; // dans un donjon : sa rareté (couleur, lumière)
let ISLE_DG = null,
  simT = 0,
  simT0 = 0; // donjon de l'île [rareté, boss, éteint] ; horloge de la simulation (pièges)
const sameIsle = (a, b) => a && b && a.k === b.k && (a.s | 0) === (b.s | 0);
function gotoIsle(i, auto) {
  try {
    sessionStorage.setItem('etheria_isle_force', JSON.stringify(C.cleanIsle(i)));
    if (auto) sessionStorage.setItem('etheria_autoplay', '1');
  } catch (e) {
    /* ignore */
  }
}
const { MW, MH, TY, HT, idx } = W;
const NB = MW + MH;
const TAU = Math.PI * 2,
  FACES = ['front', 'back', 'side'];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pick = a => a[Math.floor(Math.random() * a.length)];
// recul de la caméra : 0 proche, 1 normal (par défaut), 2 loin — un cran = un pixel d'écran de moins par pixel de jeu (reste net)
let ZOOM = (() => {
  try {
    const v = localStorage.getItem('etheria_zoom');
    return v == null ? 1 : clamp(v | 0, 0, 2);
  } catch (e) {
    return 1;
  }
})();
const $ = id => document.getElementById(id);

/* ---------- canvases : monde (pixels fins) + interface (pixels plus gros) ---------- */
const cvW = $('world'),
  cvU = $('ui'),
  u = cvU.getContext('2d');
let g = cvW.getContext('2d'); // le monde (atmo.js le détourne un instant pour peindre le décor en glyphes)
// rendu en glyphes : activé par défaut ; localStorage.etheria_glyph = '0' le coupe (et la qualité adaptative peut le couper)
let GLYPH = (() => {
  try {
    return localStorage.getItem('etheria_glyph') !== '0';
  } catch (e) {
    return true;
  }
})();

let ST = 0,
  SB = 0,
  S = 4,
  SU = 6,
  VW = 300,
  VH = 600,
  UW = 200,
  UH = 400,
  K = S / SU,
  dpr = 1,
  GRADES = [],
  BACKDROP = null,
  gradeFrom = 0,
  gradeTo = 0,
  gradeK = 1,
  SUBX = 0,
  SUBY = 0,
  RQ = 0;
/* ---------- ambiance « aquarelle » : tout est précalculé, un seul dessin par image ---------- */
// 0 bourg (aube chaude), 1 prairies (or et jade), 2 bois (brume bleu-violet + rais de lumière), 3 terres sauvages (braise corail)
const ZONE_LOOK = [
  { lt: 'rgba(255,214,170,0.22)', dk: 'rgba(122,88,170,0.16)', vg: 'rgba(42,24,64,0.22)', mote: [255, 228, 190] },
  { lt: 'rgba(255,238,178,0.20)', dk: 'rgba(70,150,150,0.14)', vg: 'rgba(20,48,64,0.18)', mote: [255, 246, 200] },
  {
    lt: 'rgba(170,230,220,0.18)',
    dk: 'rgba(56,36,130,0.30)',
    vg: 'rgba(14,18,52,0.34)',
    mote: [190, 255, 170],
    rays: 1,
    haze: 'rgba(170,200,220,0.12)'
  },
  {
    lt: 'rgba(255,170,110,0.28)',
    dk: 'rgba(140,40,64,0.28)',
    vg: 'rgba(52,16,28,0.30)',
    mote: [255, 150, 90],
    haze: 'rgba(255,190,150,0.08)'
  },
  // îles du voyage : 4 givre (bleu glacé), 5 braises (rougeoiement), 6 brume (violet laiteux)
  {
    lt: 'rgba(230,245,255,0.24)',
    dk: 'rgba(60,90,160,0.24)',
    vg: 'rgba(20,30,70,0.30)',
    mote: [255, 255, 255],
    haze: 'rgba(220,235,255,0.14)'
  },
  {
    lt: 'rgba(255,140,60,0.30)',
    dk: 'rgba(120,20,30,0.30)',
    vg: 'rgba(40,8,12,0.38)',
    mote: [255, 160, 70],
    haze: 'rgba(255,120,60,0.12)'
  },
  {
    lt: 'rgba(220,200,255,0.22)',
    dk: 'rgba(80,60,150,0.28)',
    vg: 'rgba(24,16,50,0.36)',
    mote: [230, 210, 255],
    rays: 1,
    haze: 'rgba(200,190,240,0.20)'
  },
  // 7 donjon : l'obscurité est dessinée à part (rayon de lumière autour du héros)
  { lt: 'rgba(255,220,170,0.06)', dk: 'rgba(40,20,80,0.20)', vg: 'rgba(6,2,14,0.30)', mote: [255, 210, 150] }
];
const THEME_LOOK = { givre: 4, braise: 5, brume: 6, donjon: 7 };
function zoneGrade(i) {
  if (GRADES[i]) return GRADES[i];
  const L = ZONE_LOOK[i] || ZONE_LOOK[0],
    c = document.createElement('canvas');
  c.width = VW;
  c.height = VH;
  const o = c.getContext('2d');
  let gr = o.createLinearGradient(0, 0, VW * 0.6, VH);
  gr.addColorStop(0, L.lt);
  gr.addColorStop(0.5, 'rgba(255,255,255,0)');
  gr.addColorStop(1, L.dk);
  o.fillStyle = gr;
  o.fillRect(0, 0, VW, VH);
  if (L.rays)
    for (let k = 0; k < 4; k++) {
      const x0 = VW * (0.05 + k * 0.22),
        w = VW * (0.06 + (k % 2) * 0.05);
      const rg = o.createLinearGradient(0, 0, 0, VH * 0.8);
      rg.addColorStop(0, 'rgba(230,255,240,0.20)');
      rg.addColorStop(1, 'rgba(230,255,235,0)');
      o.fillStyle = rg;
      o.beginPath();
      o.moveTo(x0, 0);
      o.lineTo(x0 + w, 0);
      o.lineTo(x0 + w + VH * 0.35, VH * 0.8);
      o.lineTo(x0 + VH * 0.35 - w * 0.3, VH * 0.8);
      o.closePath();
      o.fill();
    }
  if (L.haze) {
    const hz = o.createLinearGradient(0, VH * 0.55, 0, VH);
    hz.addColorStop(0, 'rgba(0,0,0,0)');
    hz.addColorStop(1, L.haze);
    o.fillStyle = hz;
    o.fillRect(0, VH * 0.55, VW, VH * 0.45);
  }
  const vg = o.createRadialGradient(VW / 2, VH * 0.46, Math.min(VW, VH) * 0.32, VW / 2, VH / 2, Math.max(VW, VH) * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, L.vg);
  o.fillStyle = vg;
  o.fillRect(0, 0, VW, VH);
  return (GRADES[i] = c);
}
// mer peinte : dégradé profond, auréoles d'aquarelle et fines lignes de houle (précalculé par taille d'écran)
function buildBackdrop() {
  if (GLYPH) {
    // décor en glyphes : fond presque noir, comme un écran
    const c = document.createElement('canvas');
    c.width = VW;
    c.height = VH;
    const o = c.getContext('2d'),
      gr = o.createLinearGradient(0, 0, 0, VH);
    gr.addColorStop(0, '#07060f');
    gr.addColorStop(1, '#0b0a18');
    o.fillStyle = gr;
    o.fillRect(0, 0, VW, VH);
    return c;
  }
  const c = document.createElement('canvas');
  c.width = VW;
  c.height = VH;
  const o = c.getContext('2d');
  const SEA = {
    givre: ['#5a9ab4', '#2e6a8e', '#1c4468'],
    braise: ['#7a2a2a', '#4a1424', '#26081a'],
    brume: ['#5a5486', '#38345e', '#201c40'],
    donjon: ['#0a0612', '#07040e', '#040208']
  }[W.theme] || ['#3a7a92', '#26567a', '#1b3a60'];
  const gr = o.createLinearGradient(0, 0, 0, VH);
  gr.addColorStop(0, SEA[0]);
  gr.addColorStop(0.5, SEA[1]);
  gr.addColorStop(1, SEA[2]);
  o.fillStyle = gr;
  o.fillRect(0, 0, VW, VH);
  const R0 = C.mulberry32(77);
  for (let k = 0; k < 9; k++) {
    const x = R0() * VW,
      y = R0() * VH,
      r = 30 + R0() * 90,
      bl = o.createRadialGradient(x, y, 0, x, y, r);
    const warm = k % 3 === 0;
    bl.addColorStop(0, warm ? 'rgba(240,200,190,0.10)' : 'rgba(180,230,220,0.10)');
    bl.addColorStop(1, 'rgba(0,0,0,0)');
    o.fillStyle = bl;
    o.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let y = 3; y < VH; y += 7) {
    o.fillStyle = 'rgba(220,240,235,' + (0.05 + R0() * 0.05).toFixed(3) + ')';
    const x = Math.floor(R0() * VW),
      w = 6 + Math.floor(R0() * 22);
    o.fillRect(x, y, w, 1);
  }
  return c;
}
// obscurité du donjon : cercle de lumière autour du héros, en bandes tramées (style pixel), précalculée par taille d'écran
let DARK = null,
  CGLOW = null;
// light : rayon de la lumière (donjon : selon sa rareté ; nuit : atmo.js)
const DARKS = new Map();
function darkness(light) {
  light = light || DGN.light;
  const key = VW + 'x' + VH + ':' + light;
  if (DARKS.has(key)) return DARKS.get(key);
  const c = document.createElement('canvas');
  c.width = VW * 2;
  c.height = VH * 2;
  const o = c.getContext('2d'),
    im = o.createImageData(c.width, c.height),
    d = im.data;
  const r0 = 80 * light,
    r1 = 210 * light,
    BY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const dd = Math.hypot(x - VW, (y - VH) * 1.5),
        t = clamp((dd - r0) / (r1 - r0), 0, 1),
        q = Math.floor(t * 5 + (BY[((y & 3) << 2) | (x & 3)] / 16 - 0.5) * 0.9 + 0.5) / 5;
      const k = (y * c.width + x) * 4;
      d[k] = 6;
      d[k + 1] = 3;
      d[k + 2] = 14;
      d[k + 3] = Math.round(clamp(q, 0, 1) * 222);
    }
  o.putImageData(im, 0, 0);
  if (DARKS.size > 6) DARKS.clear();
  DARKS.set(key, c);
  return c;
}
function cglow() {
  if (CGLOW) return CGLOW;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const o = c.getContext('2d'),
    h = DGN.c,
    rgbS = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(',');
  const rg = o.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(' + rgbS + ',0.6)');
  rg.addColorStop(0.5, 'rgba(' + rgbS + ',0.18)');
  rg.addColorStop(1, 'rgba(' + rgbS + ',0)');
  o.fillStyle = rg;
  o.fillRect(0, 0, 64, 64);
  return (CGLOW = c);
}
function zoneIndex() {
  if (THEME_LOOK[W.theme]) return THEME_LOOK[W.theme];
  const i = C.ZONES.findIndex(z => z[1] === zone);
  return i < 0 ? 0 : i;
}
function resize() {
  dpr = window.devicePixelRatio || 1;
  const pw = Math.round(innerWidth * dpr),
    ph = Math.round(innerHeight * dpr),
    pm = Math.min(pw, ph);
  const S0 = Math.max(1, Math.round(pm / 240));
  S = Math.max(Math.min(2, S0), S0 - ZOOM);
  SU = Math.max(2, Math.round(pm / 279)); // ~240 px de monde sur la largeur au plus proche, +25 % / +65 % en reculant ; interface ~30 % plus petite qu'à l'origine (pm / 195)
  VW = Math.ceil(pw / S);
  VH = Math.ceil(ph / S);
  UW = Math.ceil(pw / SU);
  UH = Math.ceil(ph / SU);
  K = S / SU;
  const sp = document.getElementById('safe');
  if (sp) {
    const cs = getComputedStyle(sp);
    ST = Math.round((parseFloat(cs.paddingTop || 0) * dpr) / SU);
    SB = Math.round((parseFloat(cs.paddingBottom || 0) * dpr) / SU);
  }
  RQ = Math.min(RQ || S, S);
  cvW.width = VW * RQ;
  cvW.height = VH * RQ;
  cvW.style.width = (VW * S) / dpr + 'px';
  cvW.style.height = (VH * S) / dpr + 'px'; // RQ sous-pixels par pixel de jeu : la caméra glisse finement
  cvU.width = UW;
  cvU.height = UH;
  cvU.style.width = (UW * SU) / dpr + 'px';
  cvU.style.height = (UH * SU) / dpr + 'px';
  g.imageSmoothingEnabled = false;
  u.imageSmoothingEnabled = false;
  GRADES = [];
  BACKDROP = buildBackdrop();
}
window.addEventListener('resize', resize);
resize();
function setZoom(z) {
  z = clamp(z, 0, 2);
  if (z === ZOOM) return;
  ZOOM = z;
  try {
    localStorage.setItem('etheria_zoom', String(z));
  } catch (e) {
    /* ignore */
  }
  RQ = 0;
  resize();
  if (mode === 'play') floatAt(me, 'Vue : ' + ['proche', 'normale', 'éloignée'][z], '#fff2d0');
}
let wheelT = 0;
window.addEventListener(
  'wheel',
  e => {
    if (mode !== 'play' || performance.now() - wheelT < 250) return;
    wheelT = performance.now();
    setZoom(ZOOM + (e.deltaY > 0 ? 1 : -1));
  },
  { passive: true }
);

/* ---------- police pixel 3x5 ---------- */
const FONT = {
  A: '010101111101101',
  B: '110101110101110',
  C: '011100100100011',
  D: '110101101101110',
  E: '111100110100111',
  F: '111100110100100',
  G: '011100101101011',
  H: '101101111101101',
  I: '111010010010111',
  J: '001001001101010',
  K: '101101110101101',
  L: '100100100100111',
  M: '101111111101101',
  N: '110101101101101',
  O: '010101101101010',
  P: '110101110100100',
  Q: '010101101110011',
  R: '110101110101101',
  S: '011100010001110',
  T: '111010010010010',
  U: '101101101101111',
  V: '101101101101010',
  W: '101101111111101',
  X: '101101010101101',
  Y: '101101010010010',
  Z: '111001010100111',
  0: '111101101101111',
  1: '010110010010111',
  2: '110001010100111',
  3: '110001010001110',
  4: '101101111001001',
  5: '111100110001110',
  6: '011100111101111',
  7: '111001010010010',
  8: '111101111101111',
  9: '111101111001110',
  _: '000000000000111',
  '-': '000000111000000',
  '+': '000010111010000',
  '!': '010010010000010',
  '.': '000000000000010',
  ':': '000010000010000',
  '/': '001001010100100',
  '?': '110001010000010',
  "'": '010010000000000',
  ',': '000000000010100',
  '(': '010100100100010',
  ')': '010001001001010',
  '%': '101001010100101',
  '#': '101111101111101',
  '*': '000101010101000',
  '<': '001010100010001',
  '>': '100010001010100',
  '=': '000111000111000'
};
const textCache = new Map();
const clean = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
function textCanvas(str, color, outline) {
  const key = str + '|' + color + '|' + outline;
  let c = textCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = Math.max(1, str.length * 4 + 1);
  c.height = 7;
  const x = c.getContext('2d'),
    pts = [];
  for (let k = 0; k < str.length; k++) {
    const f = FONT[str[k]];
    if (!f) continue;
    for (let b = 0; b < 15; b++) if (f[b] === '1') pts.push([1 + k * 4 + (b % 3), 1 + Math.floor(b / 3)]);
  }
  if (outline) {
    x.fillStyle = outline === true ? '#1a0f1c' : outline;
    for (const [p, q] of pts) x.fillRect(p - 1, q - 1, 3, 3);
  }
  x.fillStyle = color;
  for (const [p, q] of pts) x.fillRect(p, q, 1, 1);
  if (textCache.size > 800) textCache.clear();
  textCache.set(key, c);
  return c;
}
const textW = (s, sc) => (clean(s).length * 4 + 1) * (sc || 1);
function text(ctx, s, x, y, color, align, sc, outline) {
  sc = sc || 1;
  const c = textCanvas(clean(s), color || '#fff', outline === undefined ? true : outline),
    w = c.width * sc;
  const dx = align === 'center' ? x - Math.floor(w / 2) : align === 'right' ? x - w : x;
  ctx.drawImage(c, Math.round(dx), Math.round(y), w, c.height * sc);
}
function wrap(str, max) {
  const words = clean(str).split(' '),
    lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w.slice(0, max);
    } else cur = (cur ? cur + ' ' : '') + w;
  }
  if (cur) lines.push(cur);
  return lines;
}

/* ---------- état ---------- */
let ART = null,
  mode = 'loading',
  time = 0,
  shake = 0,
  camX = 0,
  camY = 0,
  zone = '',
  zoneT = 0,
  online = 1,
  netMode = 'solo';
let lastOX = 0,
  lastOY = 0,
  sendT = 0,
  saveT = 0,
  usedTouch = false,
  movedOnce = false;
let chat = [];
const floats = [],
  parts = [],
  rings = [],
  labels = [],
  motes = [];
let link = null,
  myId = null,
  lastSnap = 0,
  snapDt = 0.1;
const prefs = (() => {
  try {
    return JSON.parse(localStorage.getItem('etheria_prefs') || 'null') || {};
  } catch (e) {
    return {};
  }
})();
const SEED = window.ETHERIA_SEED || null; // progression importée (première ouverture uniquement)
if (!prefs.name && SEED && SEED.prefs) Object.assign(prefs, SEED.prefs);
const look = C.cleanLook(prefs.look || [0, 2, 0, 0, 0]);
const me = {
  name: prefs.name || '',
  x: C.SPAWN.x,
  y: C.SPAWN.y,
  z: 1,
  face: 'front',
  flip: false,
  moving: false,
  anim: 0,
  hp: 60,
  maxhp: 60,
  mp: 30,
  maxmp: 30,
  lvl: 1,
  xp: 0,
  need: 18,
  gold: 0,
  potions: 3,
  dead: 0,
  deadT: 0,
  atkCd: 0,
  skillCd: 0,
  potCd: 0,
  slash: 0,
  slashAng: 0,
  spin: 0,
  hitFlash: 0,
  target: null,
  set: null,
  sent: ''
};
const others = new Map();
const mobs = W.spawns.map((s, k) => {
  const st = C.mobStats(s.type, s.lvl);
  return {
    k,
    type: s.type,
    lvl: s.lvl,
    name: C.MOBDEF[s.type].name,
    x: s.i + 0.5,
    y: s.j + 0.5,
    tx: s.i + 0.5,
    ty: s.j + 0.5,
    z: HT[idx(s.i, s.j)],
    hp: st.maxhp,
    maxhp: st.maxhp,
    alive: true,
    aggro: false,
    moving: false,
    hitFlash: 0,
    lunge: 0,
    phase: Math.random() * TAU,
    flip: false,
    scale: s.type === 'boss' || s.boss ? 1.6 : C.MOBDEF[s.type].sc || 1,
    elite: s.elite ? 1 : 0,
    dgBoss: s.boss ? s.bi : null
  };
});
for (const m of mobs) {
  if (m.dgBoss != null) m.name = C.DG_BOSSES[m.dgBoss].n;
  else if (m.elite) m.name += ' (élite)';
}
const ePx = e => [(e.x - e.y) * 16, (e.x + e.y) * 8 - e.z * 8];
const screenAng = (a, b) => {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  return Math.atan2((dx + dy) * 0.5, dx - dy);
};
function setFacing(e, dx, dy) {
  const sx = dx - dy,
    sy = (dx + dy) * 0.5;
  if (Math.abs(sx) > Math.abs(sy) * 1.3) {
    e.face = 'side';
    e.flip = sx < 0;
  } else e.face = sy < 0 ? 'back' : 'front';
}
