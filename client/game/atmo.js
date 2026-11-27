/* Pixels Worlds — client, atmo.js : direction « plus adulte » (formulaire, série 4, docs/design/direction-adulte.md).
   - Décor en glyphes : tout le décor fixe d'une île (sol, arbres, maisons) est peint UNE fois dans une grande image,
     puis converti en caractères de 3×5 pixels colorés ; chaque image du jeu la recopie, et les personnages, monstres et
     objets animés restent en pixel art par-dessus, avec une lueur.
   - Cycle jour et nuit (une journée = 20 minutes réelles, même heure pour tous), pluie et brume par moments,
     effets de sorts en néon, éclair en croix et « glitch » sur les coups critiques.
   Les fichiers de client/game/ se partagent leurs déclarations (scripts classiques chargés dans l'ordre par persist.js). */
'use strict';
// ce qui reste dessiné en direct par-dessus le décor en glyphes (animé, ou qu'on doit voir clairement)
const LIVE_KINDS = new Set(['gate', 'barch', 'dexit', 'chest', 'torch', 'fountain', 'node', 'corpse', 'foot', 'bpost', 'seal', 'sdoor']);
let GD = null, // { cv, x0, y0 } : le décor en glyphes, en coordonnées du monde
  BAKING = false;

/* ---------- glyphes 3×5 : du plus clair au plus dense ---------- */
const GLYPHS = [
  '000000000000010', // .
  '000010000010000', // :
  '000000111000000', // -
  '000111000111000', // =
  '000010111010000', // +
  '000101010101000', // x
  '000111101111000', // o
  '011100010001110', // s
  '101111101111101', // #
  '101001010100101', // %
  '011110010011110', // $
  '111101111101111', // 8
  '111101101100111' //  @
].map(s => [...s].map(Number));

// peint tout le décor fixe dans une image, puis le convertit en glyphes (une fois par île)
function buildGlyphDecor() {
  const x0 = -MH * 16 - 32,
    y0 = -4 * 8 - 96,
    w = (MW + MH) * 16 + 64,
    h = (MW + MH) * 8 + 150;
  const src = document.createElement('canvas');
  src.width = w;
  src.height = h;
  const keepG = g,
    keepW = VW,
    keepH = VH;
  g = src.getContext('2d');
  g.imageSmoothingEnabled = false;
  VW = w;
  VH = h;
  BAKING = true;
  try {
    for (let s = 0; s < NB; s++) {
      if (s <= MW + MH - 2) {
        const i0 = Math.max(0, s - MH + 1),
          i1 = Math.min(MW - 1, s);
        for (let i = i0; i <= i1; i++) drawTile(i, s - i, -x0, -y0, 0);
      }
      for (const e of STATIC[s]) if (!LIVE_KINDS.has(e.kind)) drawEntity(e, -x0, -y0);
    }
  } finally {
    BAKING = false;
    g = keepG;
    VW = keepW;
    VH = keepH;
  }
  const sd = src.getContext('2d').getImageData(0, 0, w, h).data,
    out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const oc = out.getContext('2d'),
    im = oc.createImageData(w, h),
    d = im.data;
  const CW = 4,
    CH = 6;
  for (let cy = 0; cy + CH <= h; cy += CH)
    for (let cx = 0; cx + CW <= w; cx += CW) {
      let r = 0,
        gg = 0,
        b = 0,
        n = 0;
      for (let y = cy; y < cy + CH; y++)
        for (let x = cx; x < cx + CW; x++) {
          const k = (y * w + x) * 4;
          if (sd[k + 3] < 128) continue;
          r += sd[k];
          gg += sd[k + 1];
          b += sd[k + 2];
          n++;
        }
      if (n < (CW * CH) / 3) continue; // presque vide : on laisse voir le fond
      r /= n;
      gg /= n;
      b /= n;
      const lum = (0.3 * r + 0.59 * gg + 0.11 * b) / 255,
        jit = C.hash(cx, cy, 51) * 0.12 - 0.06,
        gi = Math.max(0, Math.min(GLYPHS.length - 1, Math.round((Math.pow(lum, 1.3) * 1.1 + jit) * (GLYPHS.length - 1)))),
        G = GLYPHS[gi];
      // fond de la case : la couleur du décor très assombrie ; le glyphe : la couleur du décor éclaircie
      const br = DGN ? 0.08 + 0.75 * lum : 0.15 + 0.5 * lum, // cases claires : fond clair (sols) ; sombres : fond sombre (murs, ombres)
        hi = 1.3;
      for (let y = 0; y < CH; y++)
        for (let x = 0; x < CW; x++) {
          const k = ((cy + y) * w + cx + x) * 4,
            on = x < 3 && y < 5 && G[y * 3 + x];
          d[k] = on ? Math.min(255, r * hi + 12) : r * br;
          d[k + 1] = on ? Math.min(255, gg * hi + 10) : gg * br;
          d[k + 2] = on ? Math.min(255, b * hi + 16) : b * br + 6;
          d[k + 3] = 255;
        }
    }
  oc.putImageData(im, 0, 0);
  GD = { cv: out, x0, y0 };
}

/* ---------- heure du jour et météo (les mêmes pour tous : elles suivent l'horloge réelle) ---------- */
const DAY_S = 1200; // une journée de jeu = 20 minutes
function dayLight() {
  const ph = ((Date.now() / 1000) % DAY_S) / DAY_S; // 0 minuit, 0,5 midi
  return 0.5 - 0.5 * Math.cos(ph * TAU);
}
const nightK = () => clamp((0.55 - dayLight()) / 0.4, 0, 1);
const duskK = () => {
  const l = dayLight();
  return clamp(1 - Math.abs(l - 0.45) / 0.15, 0, 1);
};
function rainK() {
  if (DGN) return 0;
  const t = Date.now() / 1000 / 240, // fenêtres de 4 minutes
    a = C.hash(Math.floor(t), 7, 3) < 0.4 ? 1 : 0,
    bN = C.hash(Math.floor(t) + 1, 7, 3) < 0.4 ? 1 : 0,
    f = t % 1;
  return f > 0.85 ? a + (bN - a) * ((f - 0.85) / 0.15) : a;
}
const RAIN = Array.from({ length: 160 }, (_, i) => ({
  x: Math.random(),
  y: Math.random(),
  l: 6 + (i % 5) * 2,
  s: 0.9 + Math.random() * 0.5
}));
let FOG = null;
function fog() {
  if (FOG && FOG.width === VW && FOG.height === VH) return FOG;
  const c = document.createElement('canvas');
  c.width = VW;
  c.height = VH;
  const o = c.getContext('2d'),
    gr = o.createLinearGradient(0, 0, 0, VH);
  gr.addColorStop(0, 'rgba(150,160,190,0.10)');
  gr.addColorStop(0.6, 'rgba(150,160,190,0.04)');
  gr.addColorStop(1, 'rgba(170,180,210,0.20)');
  o.fillStyle = gr;
  o.fillRect(0, 0, VW, VH);
  return (FOG = c);
}

/* ---------- lueurs colorées (mises en cache par couleur) ---------- */
const GLOWS = new Map();
function glowOf(col) {
  let c = GLOWS.get(col);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 32;
  const o = c.getContext('2d'),
    rg = o.createRadialGradient(16, 16, 0, 16, 16, 16),
    rgbS = [1, 3, 5].map(i => parseInt(col.slice(i, i + 2), 16)).join(',');
  rg.addColorStop(0, 'rgba(' + rgbS + ',0.55)');
  rg.addColorStop(0.5, 'rgba(' + rgbS + ',0.16)');
  rg.addColorStop(1, 'rgba(' + rgbS + ',0)');
  o.fillStyle = rg;
  o.fillRect(0, 0, 32, 32);
  GLOWS.set(col, c);
  return c;
}
// lueur sous un personnage ou un monstre (dessinée avant son sprite)
function charGlow(sx, sy, col, size) {
  if (!GLYPH) return;
  const n = 0.45 + 0.55 * nightK(),
    s = size || 1;
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.55 * n;
  g.drawImage(glowOf(col), Math.round(sx - 22 * s), Math.round(sy - 34 * s), Math.round(44 * s), Math.round(44 * s));
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

/* ---------- coups critiques : éclair en croix et « glitch » ---------- */
const FLARES = [];
let glitchT = 0;
function critFx(e) {
  const [x, y] = ePx(e);
  FLARES.push({ x, y: y - 10, t: time });
  glitchT = time + 0.12;
}
function drawFlares(ox, oy) {
  g.globalCompositeOperation = 'lighter';
  for (let i = FLARES.length - 1; i >= 0; i--) {
    const F = FLARES[i],
      f = (time - F.t) / 0.28;
    if (f >= 1) {
      FLARES.splice(i, 1);
      continue;
    }
    const a = 1 - f,
      len = 18 + 40 * f,
      x = Math.round(ox + F.x),
      y = Math.round(oy + F.y);
    g.globalAlpha = a;
    g.fillStyle = '#ff3a4a';
    g.fillRect(x - len, y, len * 2, 1);
    g.fillRect(x, y - len * 0.8, 1, len * 1.6);
    g.fillStyle = '#ffffff';
    g.fillRect(x - 3, y, 7, 1);
    g.fillRect(x, y - 3, 1, 7);
    g.globalAlpha = a * 0.6;
    g.drawImage(glowOf('#ff3a4a'), x - 12, y - 12, 24, 24);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}
// quelques bandes de l'écran décalées et une teinte rouge, le temps d'un éclair
function drawGlitch() {
  if (time >= glitchT) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  const w = cvW.width,
    h = cvW.height;
  for (let k = 0; k < 5; k++) {
    const y = Math.floor(Math.random() * h),
      bh = Math.max(2, Math.floor((4 + Math.random() * 18) * RQ)),
      dx = Math.round((Math.random() - 0.5) * 12 * RQ);
    g.drawImage(cvW, 0, y, w, bh, dx, y, w, bh);
  }
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(255,40,60,0.07)';
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
}

/* ---------- nuit, lanternes, pluie : par-dessus l'étalonnage de la zone ---------- */
function drawAtmosphere(ox, oy) {
  if (DGN) return; // les donjons ont leur propre obscurité
  const nk = nightK(),
    dk = duskK();
  g.setTransform(RQ, 0, 0, RQ, 0, 0);
  if (dk > 0.02) {
    g.globalAlpha = dk * 0.22;
    g.fillStyle = '#ff8a5a';
    g.globalCompositeOperation = 'soft-light';
    g.fillRect(0, 0, VW, VH);
    g.globalCompositeOperation = 'source-over';
  }
  if (nk > 0.02) {
    const hx0 = Math.round(ox + (me.x - me.y) * 16),
      hy0 = Math.round(oy + (me.x + me.y) * 8 - me.z * 8 - 14);
    g.globalAlpha = nk * 0.9;
    g.drawImage(darkness(1.25), hx0 - VW, hy0 - VH);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'lighter';
    for (const l of LAMPS) {
      const sx = ox + (l.x - l.y) * 16,
        sy = oy + (l.x + l.y) * 8 - l.z * 8 - 26;
      if (sx < -60 || sx > VW + 60 || sy < -60 || sy > VH + 60) continue;
      g.globalAlpha = nk * (0.8 + Math.sin(time * 7 + l.x) * 0.06);
      g.drawImage(GLOW, sx - 40, sy - 34, 80, 72);
    }
    g.globalCompositeOperation = 'source-over';
  }
  const rk = rainK();
  if (rk > 0.02) {
    g.globalAlpha = rk;
    g.drawImage(fog(), 0, 0);
    g.fillStyle = 'rgba(190,205,235,0.55)';
    for (const d of RAIN) {
      const y = ((d.y * VH + time * 220 * d.s) % (VH + 20)) - 10,
        x = (((d.x * VW - time * 40 * d.s) % VW) + VW) % VW;
      for (let k = 0; k < d.l; k++) g.fillRect(Math.round(x - k * 0.25), Math.round(y + k), 1, 1);
    }
    g.globalAlpha = 1;
  }
}
