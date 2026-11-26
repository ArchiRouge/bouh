/* Pixels Worlds — direction artistique procédurale
   « Aquarelle 16 bits » : la lisibilité d'un Zelda de cartouche (tuiles nettes, silhouettes claires, contours),
   la palette pastel harmonisée et l'atmosphère d'un livre d'aquarelles (ombres décalées vers le violet et le
   bleu-vert, lumières crème, couleur propre à chaque zone), des héros chibi dont l'équipement se voit. */
(function () {
  'use strict';
  const C = window.EtheriaCore;
  const { hash, vnoise, fbm, mulberry32 } = C;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const R = a => a.map(rgb);
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mul = (a, f) => [a[0] * f, a[1] * f, a[2] * f];
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16 - 0.5);
  function ramp(arr, v, x, y, dz) {
    const n = arr.length;
    const f = clamp(v, 0, 1) * (n - 1) + BAYER[((y & 3) << 2) | (x & 3)] * (dz == null ? 0.55 : dz * 0.65);
    return arr[clamp(Math.round(f), 0, n - 1)];
  }

  class Pix {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.c = document.createElement('canvas');
      this.c.width = w;
      this.c.height = h;
      this.g = this.c.getContext('2d');
      this.im = this.g.createImageData(w, h);
      this.d = this.im.data;
    }
    set(x, y, c, a) {
      x |= 0;
      y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
      const k = (y * this.w + x) * 4;
      this.d[k] = c[0];
      this.d[k + 1] = c[1];
      this.d[k + 2] = c[2];
      this.d[k + 3] = a == null ? 255 : a;
    }
    a(x, y) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
      return this.d[(y * this.w + x) * 4 + 3];
    }
    col(x, y) {
      const k = (y * this.w + x) * 4;
      return [this.d[k], this.d[k + 1], this.d[k + 2]];
    }
    clr(x, y) {
      if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[(y * this.w + x) * 4 + 3] = 0;
    }
    outline(f, tint) {
      f = f == null ? 0.5 : f;
      tint = tint || [44, 26, 58];
      const add = [];
      for (let y = 0; y < this.h; y++)
        for (let x = 0; x < this.w; x++) {
          if (this.a(x, y) > 0) continue;
          for (const [a, b] of [
            [0, 1],
            [0, -1],
            [1, 0],
            [-1, 0]
          ])
            if (this.a(x + a, y + b) > 100) {
              add.push([x, y, mix(mul(this.col(x + a, y + b), f * 0.7), tint, 0.55)]);
              break;
            }
        }
      for (const [x, y, c] of add) this.set(x, y, c);
      return this;
    }
    done() {
      this.g.putImageData(this.im, 0, 0);
      return this.c;
    }
  }
  function fillPoly(P, pts, fn) {
    let y0 = Infinity,
      y1 = -Infinity;
    for (const p of pts) {
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yc = y + 0.5,
        xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i],
          b = pts[(i + 1) % pts.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      if (xs.length < 2) continue;
      const xa = Math.min(...xs),
        xb = Math.max(...xs);
      for (let x = Math.ceil(xa - 0.5); x <= Math.floor(xb - 0.5); x++) {
        const c = fn(x, y);
        if (c) P.set(x, y, c);
      }
    }
  }
  function fillEllipse(P, cx, cy, rx, ry, fn) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const nx = (x + 0.5 - cx) / rx,
          ny = (y + 0.5 - cy) / ry;
        const d = nx * nx + ny * ny;
        if (d <= 1) {
          const c = fn(x, y, nx, ny, d);
          if (c) P.set(x, y, c);
        }
      }
  }

  /* ---------- palettes ---------- */
  let GRASS = R(['#2e5260', '#357468', '#47967a', '#66b088', '#90c896', '#bce0a4', '#e8f2c4']);
  let SAND = R(['#b98f86', '#d2a894', '#e6c3a4', '#f3dcbc', '#fbefd8']);
  let STONE = R(['#5f5c7e', '#7a7798', '#9693b2', '#b5b1cc', '#d8d3e6']);
  const PATHC = R(['#8c6a6e', '#a8807a', '#c39c8c', '#dab9a2', '#eed6bd']);
  let CLIFF = R(['#3a2c4c', '#523b5e', '#6e4e6c', '#8c6478', '#ab8088', '#c9a09c']);
  let MOSS = R(['#2c4a5a', '#356460', '#4a8068', '#6a9e74']);
  const SANDC = R(['#6e4e62', '#8a6670', '#a8807e', '#c49c8e']);
  let STONEC = R(['#3c3a5c', '#504e70', '#666486', '#7e7c9c']);
  let WATER = R(['#1e3f66', '#26567a', '#2f6f8a', '#3f8a98', '#62a8aa', '#96c8bc', '#d0e8d8']);
  let FOAM = rgb('#f4f0e0');
  C.ART_WATER_BG = '#26567a';

  /* ---------- couleur propre à chaque zone (bourg, prairies, bois, terres sauvages) ---------- */
  const ZT1 = rgb('#d8d27a'),
    ZT2 = rgb('#3e6a96'),
    ZT3 = rgb('#b8744a');
  const smooth = (v, a, b) => {
    const t = clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  function zoneW(i, j) {
    const d = Math.hypot(i + 0.5 - C.CX, j + 0.5 - C.CY),
      a = smooth(d, 8, 10),
      b = smooth(d, 14, 16),
      c = smooth(d, 19.5, 21.5);
    return [1 - a, a * (1 - b), b * (1 - c), c];
  }
  /* ---------- palettes des îles du voyage (le Bourg garde les siennes) ---------- */
  const BASE_PAL = { GRASS, SAND, CLIFF, MOSS, WATER, FOAM };
  const ISLE_PAL = {
    givre: {
      GRASS: R(['#5a6a92', '#7a8cb4', '#9aaed0', '#bcd0e6', '#d8e6f4', '#eef4fc', '#ffffff']),
      SAND: R(['#8a94b0', '#a4b0c8', '#c0cade', '#dce4f0', '#f2f6fc']),
      CLIFF: R(['#2c3058', '#3c4470', '#506088', '#6a80a4', '#8aa0c0', '#aac0d8']),
      MOSS: R(['#4a6a90', '#6a8eb4', '#8eb4d4', '#b4d8ec']),
      WATER: R(['#183a5a', '#1e5278', '#2a6c90', '#4a90aa', '#78b4c4', '#aad4dc', '#e0f2f4']),
      FOAM: rgb('#ffffff')
    },
    braise: {
      GRASS: R(['#1e1418', '#2e1e22', '#42282a', '#5a3430', '#764438', '#9a5a40', '#c27a4a']),
      SAND: R(['#3a2622', '#54342c', '#704638', '#8c5a44', '#a87050']),
      CLIFF: R(['#1a1018', '#2a1820', '#3e222a', '#542e30', '#6c3c38', '#8a4e42']),
      MOSS: R(['#6a1a10', '#a8301a', '#e0602a', '#ffa040']),
      WATER: R(['#2a0e1a', '#3e1424', '#561c2a', '#742a30', '#9a4034', '#c8663e', '#f0a060']),
      FOAM: rgb('#ffd080')
    },
    brume: {
      GRASS: R(['#3a3458', '#4a4670', '#5e5c88', '#7a789e', '#9a98b8', '#bcbad2', '#e0def0']),
      SAND: R(['#8a809a', '#a49ab4', '#bcb4cc', '#d6d0e2', '#eeeaf6']),
      CLIFF: R(['#241e3c', '#342c50', '#463c64', '#5a4e78', '#72648e', '#8e80a6']),
      MOSS: R(['#3a3a66', '#4e5080', '#666a98', '#8288b0']),
      WATER: R(['#1a1838', '#24224a', '#302e5e', '#424276', '#5e5e92', '#8a88b4', '#c4c2dc']),
      FOAM: rgb('#e8e4ff')
    }
  };
  // donjons : une pierre par rareté (Caveau, Racines, Grotte de cristal, Catacombes d'Éther, Salle dorée)
  const DG_STONE = [
    ['#2e293e', '#4a4360', '#6a6282', '#8c84a4', '#b4acc8', '#d8d0e4'],
    ['#24302a', '#3a4c3c', '#566e52', '#76906a', '#9cb088', '#c4d0a8'],
    ['#1e2844', '#2e4262', '#46628a', '#6488aa', '#8eb0c8', '#c4dcec'],
    ['#271a44', '#3c2a62', '#584288', '#7a62a8', '#a08cc8', '#cec0e8'],
    ['#36261e', '#56402c', '#7c5e3a', '#a6824c', '#ccaa64', '#ecd49a']
  ].map(R);
  let THEME = 'bourg',
    DGT = 0;
  /* ---------- terrain ---------- */
  function buildTerrain(W) {
    THEME = W.theme || 'bourg';
    const PAL = ISLE_PAL[THEME] || BASE_PAL;
    if (THEME === 'donjon') {
      DGT = W.tier | 0;
      const D = DG_STONE[DGT];
      STONE = D.slice(1);
      STONEC = D.slice(0, 4);
    }
    GRASS = PAL.GRASS;
    SAND = PAL.SAND;
    CLIFF = PAL.CLIFF;
    MOSS = PAL.MOSS;
    WATER = PAL.WATER;
    FOAM = PAL.FOAM;
    const { MW, MH, TY, HT, idx, inb } = W;
    const N = MW * MH,
      DIST = new Float32Array(N).fill(99),
      q = [];
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++)
        if (TY[idx(i, j)] !== 0) {
          DIST[idx(i, j)] = 0;
          q.push([i, j]);
        }
    for (let h = 0; h < q.length; h++) {
      const [i, j] = q[h],
        d = DIST[idx(i, j)] + 1;
      for (const [a, b] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ]) {
        const x = i + a,
          y = j + b;
        if (inb(x, y) && DIST[idx(x, y)] > d) {
          DIST[idx(x, y)] = d;
          q.push([x, y]);
        }
      }
    }
    const land = new Array(N),
      water = new Array(N);
    const nh = (a, b) => (inb(a, b) ? (TY[idx(a, b)] === 0 ? -1 : HT[idx(a, b)]) : -1);
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++) {
        const k = idx(i, j),
          t = TY[k];
        if (t === 0) {
          water[k] = paintWater(i, j, DIST[k], nh);
          continue;
        }
        land[k] = paintLand(i, j, t, HT[k], nh);
      }
    return { land, water };
  }
  function paintLand(i, j, t, h, nh) {
    const depth = 8 * h + 8,
      P = new Pix(32, 16 + depth + 1);
    const gx0 = (i - j) * 16 - 16,
      gy0 = (i + j) * 8;
    const hL = nh(i - 1, j),
      hR = nh(i, j - 1),
      hBR = nh(i + 1, j),
      hBL = nh(i, j + 1);
    const top = t === 1 ? SAND : t === 3 ? STONE : t === 4 ? PATHC : GRASS;
    for (let x = 0; x < 32; x++) {
      const dd = x < 16 ? x : 31 - x,
        hh = dd >> 1,
        t0 = 7 - hh,
        t1 = 8 + hh;
      for (let y = t0; y <= t1; y++) {
        const sx = x - 16 + 0.5,
          sy = y + 0.5,
          du = (sx / 16 + sy / 8) / 2,
          dv = (sy / 8 - sx / 16) / 2;
        const gx = gx0 + x,
          gy = gy0 + y;
        let v = 0.5,
          c = null;
        if (t === 2) {
          const n = fbm(gx / 46, gy / 23, 11),
            s = vnoise(gx * 0.45, gy * 0.9, 5);
          v = 0.26 + 0.46 * n + 0.2 * (s - 0.5) + h * 0.05;
          const r = hash(gx, gy, 77);
          if (r < 0.004) c = rgb(['#fff6e0', '#ffe066', '#ff9ec0', '#a8c8ff'][Math.floor(hash(gx, gy, 78) * 4)]);
          else if (r < 0.03) v += 0.18;
        } else if (t === 1) {
          v = 0.5 + 0.3 * (fbm(gx / 20, gy / 10, 4) - 0.5) + 0.08 * Math.sin(gx * 0.35 + gy * 0.25);
          if (hash(gx, gy, 41) < 0.02) v -= 0.3;
        } else if (t === 4) {
          v = 0.5 + 0.35 * (fbm(gx / 9, gy / 5, 23) - 0.5);
          const r = hash(gx, gy, 43);
          if (r < 0.03) v += 0.35;
          else if (r < 0.06) v -= 0.3;
        } else if (t === 3 && THEME === 'donjon' && h === 0) {
          // sol de donjon : grandes dalles claires (2×2 par case), joints sombres, fissures
          const su = (du * 2) % 1,
            sv = (dv * 2) % 1,
            fl = Math.floor(du * 2) + Math.floor(dv * 2) * 2;
          v =
            su < 0.07 || sv < 0.07
              ? 0.3
              : 0.62 +
                [0, -0.07, 0.05, -0.03][fl & 3] +
                (hash(i * 4 + fl, j, 61) - 0.5) * 0.12 +
                (su > 0.9 || sv > 0.9 ? -0.1 : su < 0.2 || sv < 0.2 ? 0.08 : 0);
          if (hash(gx, gy, 62) < 0.012) v -= 0.25;
        } else if (t === 3) {
          const row = Math.floor(gy / 4),
            off = (row & 1) * 4,
            col = Math.floor((gx + off) / 8);
          const lx = (((gx + off) % 8) + 8) % 8,
            ly = ((gy % 4) + 4) % 4;
          if (lx === 0 || ly === 0) v = 0.08;
          else v = 0.48 + 0.34 * (hash(col, row, 9) - 0.5) + (ly === 1 ? 0.14 : 0) - (lx === 7 ? 0.1 : 0) + (hash(gx, gy, 3) - 0.5) * 0.1;
        }
        if (THEME === 'donjon' && h > 0) v = 0.04 + v * 0.22; // dessus des murs : sombre, le sol reste clair
        if (hL > h) v -= 0.32 * Math.max(0, 1 - du / 0.32);
        if (hR > h) v -= 0.32 * Math.max(0, 1 - dv / 0.32);
        if (hL >= 0 && hL < h && du < 0.05) v += 0.15;
        if (hR >= 0 && hR < h && dv < 0.05) v += 0.15;
        let col = c || ramp(top, v, gx, gy);
        if ((hBR < h && 1 - du < 0.06) || (hBL < h && 1 - dv < 0.06)) col = top[top.length - 1];
        if (t === 2 && THEME === 'bourg') {
          const zw = zoneW(i, j);
          if (zw[1]) col = mix(col, ZT1, 0.12 * zw[1]);
          if (zw[2]) col = mix(col, ZT2, 0.3 * zw[2]);
          if (zw[3]) col = mix(col, ZT3, 0.3 * zw[3]);
          col = col.map(Math.round);
        }
        P.set(x, y, col);
      }
      const left = x < 16,
        gx = gx0 + x;
      const drip = t === 2 ? 1 + Math.floor(hash(gx, 0, 31) * 2.2) + (hash(gx, 1, 31) < 0.18 ? 2 : 0) : 0;
      for (let yy = 0; yy < depth; yy++) {
        const y = t1 + 1 + yy,
          Z = gy0 - h * 8 + y;
        let c;
        if (yy < drip) c = ramp(MOSS, (left ? 0.75 : 0.4) - yy * 0.12, gx, Z);
        else if (t === 3) {
          const row = Math.floor(yy / 3),
            lx = (((gx + (row & 1) * 3) % 6) + 6) % 6;
          const v =
            (left ? 0.72 : 0.42) +
            (hash(Math.floor((gx + (row & 1) * 3) / 6), row, 5) - 0.5) * 0.25 -
            (yy % 3 === 0 || lx === 0 ? 0.3 : 0) -
            (yy / depth) * 0.25;
          c = ramp(STONEC, v, gx, Z);
        } else {
          const band = vnoise(gx * 0.07, Z * 0.42, 21),
            RR = t === 1 ? SANDC : CLIFF;
          let v = (left ? 0.66 : 0.38) + 0.28 * (band - 0.5) - 0.32 * (yy / depth) + ((yy - drip) % 8 === 7 ? -0.1 : 0);
          if (hash(gx, Z, 55) < 0.035) v -= 0.25;
          if (hash(gx, Z, 56) < 0.02) v += 0.2;
          c = ramp(RR, v, gx, Z);
        }
        P.set(x, y, c);
      }
    }
    return P.done();
  }
  function paintWater(i, j, dist, nh) {
    const frames = [];
    const gx0 = (i - j) * 16 - 16,
      gy0 = (i + j) * 8;
    const eL = nh(i - 1, j) >= 0,
      eR = nh(i, j - 1) >= 0,
      eBR = nh(i + 1, j) >= 0,
      eBL = nh(i, j + 1) >= 0;
    const cTL = nh(i - 1, j - 1) >= 0,
      cBR = nh(i + 1, j + 1) >= 0,
      cTR = nh(i + 1, j - 1) >= 0,
      cBL = nh(i - 1, j + 1) >= 0;
    for (let f = 0; f < 4; f++) {
      const P = new Pix(32, 16);
      for (let x = 0; x < 32; x++) {
        const dd = x < 16 ? x : 31 - x,
          hh = dd >> 1;
        for (let y = 7 - hh; y <= 8 + hh; y++) {
          const sx = x - 16 + 0.5,
            sy = y + 0.5,
            du = (sx / 16 + sy / 8) / 2,
            dv = (sy / 8 - sx / 16) / 2;
          const gx = gx0 + x,
            gy = gy0 + y;
          let prox = 0;
          const pe = d => Math.max(0, 1 - d / 0.7);
          if (eL) prox = Math.max(prox, pe(du));
          if (eR) prox = Math.max(prox, pe(dv));
          if (eBR) prox = Math.max(prox, pe(1 - du));
          if (eBL) prox = Math.max(prox, pe(1 - dv));
          if (cTL) prox = Math.max(prox, pe(Math.hypot(du, dv)));
          if (cBR) prox = Math.max(prox, pe(Math.hypot(1 - du, 1 - dv)));
          if (cTR) prox = Math.max(prox, pe(Math.hypot(1 - du, dv)));
          if (cBL) prox = Math.max(prox, pe(Math.hypot(du, 1 - dv)));
          const deep = clamp(1 - (dist - 1) / 4, 0, 1);
          const shallow = deep * 0.45 + prox * 0.5;
          const wave = Math.sin(gx * 0.22 + gy * 0.55 + (f * Math.PI) / 2) * 0.5 + Math.sin(gx * 0.11 - gy * 0.3 - (f * Math.PI) / 2) * 0.5;
          let v = 1 / 6 + shallow * 0.78 + wave * 0.06 * (0.3 + shallow);
          let c = ramp(WATER, v, gx, gy);
          const foamEdge = 0.9 + 0.05 * Math.sin(gx * 0.5 + (f * Math.PI) / 2);
          if (prox > foamEdge) c = FOAM;
          else if (prox > 0.62 && prox < 0.69 && (((gx + f * 2) % 6) + 6) % 6 < 3) c = mix(FOAM, WATER[5], 0.4);
          if (hash(gx, gy, 300 + f) < 0.005 + 0.01 * prox) c = FOAM;
          const fade = prox > 0 ? 1 : clamp(1 - (dist - 1.2) / 2.6, 0, 1);
          P.set(x, y, c, Math.round(fade * 255));
        }
      }
      frames.push(P.done());
    }
    return frames;
  }

  /* ---------- ombres de nuages (texture périodique) ---------- */
  function cloudTexture() {
    const S = 64,
      P = new Pix(S, S),
      per = 8;
    const pn = (x, y, s) => {
      const xi = Math.floor(x),
        yi = Math.floor(y),
        xf = x - xi,
        yf = y - yi,
        u = xf * xf * (3 - 2 * xf),
        v = yf * yf * (3 - 2 * yf);
      const H = (a, b) => hash(((a % per) + per) % per, ((b % per) + per) % per, s);
      const t = H(xi, yi) + (H(xi + 1, yi) - H(xi, yi)) * u,
        b = H(xi, yi + 1) + (H(xi + 1, yi + 1) - H(xi, yi + 1)) * u;
      return t + (b - t) * v;
    };
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const n = pn(x / 8, y / 8, 1) * 0.65 + pn(x / 4, y / 4, 2) * 0.35;
        const a = clamp((n - 0.52) / 0.18, 0, 1);
        P.set(x, y, [46, 36, 92], Math.round(a * 255));
      }
    return P.done();
  }

  /* ---------- personnages (l'équipement porté est dessiné sur le sprite) ---------- */
  const SKINS = [
    ['#ffe4c8', '#f6c49c', '#d8946e'],
    ['#f0c08e', '#d89c68', '#b0704a'],
    ['#b8784c', '#94583a', '#6a3a26']
  ].map(R);
  const HAIRS = [
    ['#3a1e14', '#5e3420', '#88502e', '#b47846'],
    ['#7a1e12', '#b0301c', '#e2522c', '#ff8c56'],
    ['#a86a12', '#dc9a1e', '#ffcc3a', '#fff19a'],
    ['#6e74a0', '#a2a8cc', '#d4d8f0', '#ffffff'],
    ['#1c1e5a', '#2c3a96', '#4664cc', '#80a4ff'],
    ['#145a2e', '#1f8a3e', '#3cbc4e', '#86ec78'],
    ['#8a1e62', '#c4348a', '#f05cb4', '#ffa6dc']
  ].map(R);
  const TUNICS = [
    ['#16307a', '#1e50b8', '#3a7cf0', '#7cb4ff'],
    ['#6a1018', '#a8202a', '#e0402e', '#ff8462'],
    ['#0f5226', '#1a7e34', '#34b24a', '#7ee06a'],
    ['#6a3a08', '#a86010', '#e09a1e', '#ffd05a'],
    ['#3e1262', '#6420a0', '#9a3ede', '#cc86ff'],
    ['#24242e', '#3a3a4c', '#5a5a74', '#8e8eaa'],
    ['#0a4250', '#107080', '#1aa8b4', '#62e0e2']
  ].map(R);
  const GOLD = rgb('#ffd23f'),
    EYE = rgb('#1a1030'),
    WHITE = rgb('#ffffff'),
    BLUSH = rgb('#ff8c8c');
  /* Les personnages sont peints par sprites.js (pixel art posé à la main, en couches) ; ici on les met en cache
     sous forme de canvas : 8 images de marche par direction, 3 poses d'attaque, clignement des yeux, profil gauche = miroir. */
  const SPR = window.EtheriaSprites;
  function sprCanvas(im) {
    const c = document.createElement('canvas');
    c.width = im.w;
    c.height = im.h;
    const o = c.getContext('2d'),
      d = o.createImageData(im.w, im.h);
    d.data.set(im.data);
    o.putImageData(d, 0, 0);
    return c;
  }
  const charCache = new Map();
  function flip(src) {
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext('2d');
    g.translate(src.width, 0);
    g.scale(-1, 1);
    g.drawImage(src, 0, 0);
    return c;
  }
  /* look : apparence choisie à la création ; gear : chaîne C.gearStr(équipement) (facultative) */
  function charSet(look, gear) {
    const key = look.join('') + '|' + (gear || '');
    let s = charCache.get(key);
    if (s) return s;
    const L = C.cleanLook(look),
      G = C.parseGear(gear),
      GE = {};
    for (const sl of Object.keys(G)) {
      const it = C.ITEMS[G[sl][0]];
      if (it) GE[sl] = { icon: it.icon, c: it.c, rar: G[sl][1], fx: it.fx };
    }
    const pc = (d, fr, bl, pose) => sprCanvas(SPR.paint(L, GE, d, fr, bl, pose));
    const F8 = [0, 1, 2, 3, 4, 5, 6, 7],
      f = F8.map(fr => pc('front', fr)),
      b = F8.map(fr => pc('back', fr)),
      sd = F8.map(fr => pc('side', fr));
    const bs = pc('side', 0, true);
    const wp = G.weapon ? G.weapon[1] : -1;
    s = {
      front: f,
      back: b,
      side: sd,
      sideL: sd.map(flip),
      blinkF: pc('front', 0, true),
      blinkS: bs,
      blinkSL: flip(bs),
      glint: GE.chest && GE.chest.fx === 'gm' ? '#ffffff' : wp >= 3 ? (wp === 4 ? '#ffb060' : '#d8a8ff') : null,
      gm: !!(GE.chest && GE.chest.fx === 'gm'),
      w: SPR.W,
      h: SPR.H,
      cx: SPR.CX,
      foot: SPR.FOOT_Y
    };
    // attaque : [arme armée, frappe, retour] ; de dos l'arme reste dans le dos (on garde la pose de repos)
    const af = [1, 2, 3].map(q => pc('front', 0, false, q)),
      as = [1, 2, 3].map(q => pc('side', 0, false, q));
    s.atk = { front: af, back: [b[0], b[0], b[0]], side: as, sideL: as.map(flip) };
    if (charCache.size > 300) charCache.clear();
    charCache.set(key, s);
    return s;
  }

  /* ---------- monstres ---------- */
  const SLIMES = {
    slime: R(['#1a5226', '#2a8236', '#44ac46', '#72d064', '#ace892', '#e6ffd4']),
    ember: R(['#5e1610', '#9a2c1a', '#d05028', '#ee8636', '#ffbc6a', '#fff0c4']),
    boss: R(['#341656', '#542886', '#7a42b6', '#a068d6', '#caa0ee', '#f2e4ff']),
    frost: R(['#1c3a6a', '#2c5c96', '#4a88c4', '#7ab4e4', '#b4dcf6', '#f0faff'])
  };
  function paintSlime(rp) {
    const P = new Pix(16, 14);
    fillEllipse(P, 8, 8.2, 7.4, 5.8, (x, y, nx, ny) => {
      if (y > 12) return null;
      const l = -(nx * 0.55 + ny * 0.83),
        core = Math.max(0, 1 - Math.hypot(nx, ny + 0.4) * 1.4);
      return ramp(rp, 0.48 + 0.4 * l - core * 0.2, x, y, 0.7);
    });
    for (let x = 2; x <= 13; x++) if (P.a(x, 12)) P.set(x, 13, rp[0]);
    P.set(4, 5, rp[5]);
    P.set(5, 5, rp[5]);
    P.set(4, 6, rp[5]);
    P.set(6, 4, rp[4]);
    P.set(11, 10, rp[4]);
    P.set(5, 8, EYE);
    P.set(5, 9, EYE);
    P.set(10, 8, EYE);
    P.set(10, 9, EYE);
    P.set(5, 8, [70, 60, 90]);
    P.set(7, 10, mul(rp[0], 0.8));
    P.set(8, 10, mul(rp[0], 0.8));
    P.outline(0.45);
    // transparence gélatineuse
    for (let k = 3; k < P.d.length; k += 4)
      if (P.d[k] === 255) {
        const y = Math.floor(k / 4 / P.w);
        if (y > 3 && y < 12) P.d[k] = 236;
      }
    return P.done();
  }
  const CAP = R(['#5e2412', '#8e361a', '#c05226', '#e27a36', '#f6a456', '#ffd28a']);
  const STEM = R(['#b4946c', '#d8bc94', '#f0dcb8', '#fff2da']);
  function paintChampi(fr) {
    const P = new Pix(18, 20);
    for (let y = 10; y <= 16; y++) for (let x = 6; x <= 11; x++) P.set(x, y, ramp(STEM, 0.75 - (x - 6) * 0.1 - (y - 10) * 0.03, x, y, 0.5));
    const f1 = fr === 1 ? 1 : 0;
    for (const [x, y] of [
      [6, 17 - f1],
      [7, 17 - f1],
      [10, 17 - (1 - f1) * (fr ? 0 : 0)],
      [11, 17]
    ])
      P.set(x, y, STEM[0]);
    fillEllipse(P, 9, 6.6, 8.3, 5.4, (x, y, nx, ny) => {
      if (y > 9) return null;
      const l = -(nx * 0.5 + ny * 0.86);
      return ramp(CAP, 0.5 + 0.45 * l, x, y, 0.7);
    });
    for (let x = 2; x <= 15; x++) {
      P.set(x, 10, rgb('#c9a67a'));
      if (x > 3 && x < 14) P.set(x, 10, x % 2 ? rgb('#a8865e') : rgb('#c9a67a'));
    }
    for (const [sx, sy, r] of [
      [5, 4.5, 1.4],
      [11.5, 3.2, 1.6],
      [13.6, 6.6, 1.1],
      [7.5, 7.5, 1.0]
    ])
      fillEllipse(P, sx, sy, r, r * 0.85, (x, y, nx, ny) => (ny < 0 ? rgb('#fffaf0') : rgb('#f0dcc4')));
    P.set(7, 12, EYE);
    P.set(7, 13, EYE);
    P.set(10, 12, EYE);
    P.set(10, 13, EYE);
    P.set(6, 14, BLUSH);
    P.set(11, 14, BLUSH);
    P.outline(0.42);
    return P.done();
  }
  const CROWN = (() => {
    const P = new Pix(9, 6);
    const g = R(['#a87818', '#f2c94c', '#fff0a0']);
    for (let x = 0; x < 9; x++) {
      P.set(x, 4, g[1]);
      P.set(x, 5, g[0]);
    }
    for (const x of [0, 4, 8]) {
      P.set(x, 1, g[2]);
      P.set(x, 2, g[1]);
      P.set(x, 3, g[1]);
    }
    for (const x of [2, 6]) {
      P.set(x, 3, g[1]);
    }
    P.set(4, 4, rgb('#e8414a'));
    P.set(1, 4, rgb('#4aa0f0'));
    P.set(7, 4, rgb('#4aa0f0'));
    P.outline(0.4);
    return P.done();
  })();

  /* ---------- arbres et végétation ---------- */
  const LEAF = R(['#1f3550', '#24505a', '#2f6c62', '#468a6a', '#6aa874', '#9cc884']);
  const LEAF_BOIS = R(['#1c2048', '#26305e', '#2f4a72', '#3f6a86', '#5a8c9a', '#8ab4b0']);
  const LEAF_TERRES = R(['#3a1c2c', '#5e2a32', '#8a3c34', '#b45a3a', '#d8824a', '#f0b070']);
  const PINE_BOIS = R(['#161a40', '#1e2a52', '#263e62', '#30546e', '#44707a']);
  const PINE_TERRES = R(['#2a1a2a', '#422430', '#5e3236', '#7c4a3e', '#9a6650']);
  const LEAF_GIVRE = R(['#2a3c62', '#3e5a82', '#6a88aa', '#9ab4cc', '#cadcec', '#f4faff']),
    PINE_GIVRE = R(['#1e2c4c', '#2a4262', '#4a6a88', '#8aa8c4', '#e0ecf8']);
  const PINE = R(['#1c2e4a', '#223f52', '#2c5458', '#3a6a5e', '#548466']);
  const BLOSSOM = R(['#8a4a78', '#b0658e', '#d088a6', '#e8aabe', '#f6cbd6', '#fff0f2']);
  const BARK = R(['#2e2238', '#463246', '#5e4450', '#7a5a5c', '#987468']);
  function paintRoundTree(seed, pal) {
    const r = mulberry32(seed),
      Wd = 36,
      Ht = 44,
      P = new Pix(Wd, Ht),
      c = Wd / 2;
    const tb = Ht - 1;
    for (let y = 26; y <= tb; y++) {
      const flare = y > tb - 3 ? y - (tb - 3) : 0;
      for (let x = c - 2 - flare; x <= c + 1 + flare; x++) {
        const l = (c + 1 + flare - x) / (4 + 2 * flare);
        P.set(x, y, ramp(BARK, 0.25 + l * 0.6 + (hash(x, y, seed) - 0.5) * 0.2, x, y, 0.6));
      }
    }
    const blobs = [{ x: c, y: 15, r: 10.5 }];
    for (let k = 0; k < 6; k++) {
      const a = r() * Math.PI * 2,
        d = 5 + r() * 5;
      blobs.push({ x: c + Math.cos(a) * d * 1.15, y: 15 + Math.sin(a) * d * 0.8, r: 5.5 + r() * 3.5 });
    }
    blobs.push({ x: c - 6, y: 22, r: 6 }, { x: c + 6, y: 22, r: 6 });
    for (let y = 0; y < Ht - 8; y++)
      for (let x = 0; x < Wd; x++) {
        let best = null,
          bz = -9;
        for (const b of blobs) {
          const dx = (x + 0.5 - b.x) / b.r,
            dy = (y + 0.5 - b.y) / b.r,
            d = dx * dx + dy * dy;
          if (d <= 1) {
            const z = b.y * 0.2 + Math.sqrt(1 - d) * 2;
            if (z > bz) {
              bz = z;
              best = [dx, dy, d];
            }
          }
        }
        if (!best) continue;
        const [dx, dy, d] = best,
          l = -(dx * 0.6 + dy * 0.8);
        let v = 0.42 + 0.42 * l + (vnoise(x * 0.7, y * 0.7, seed) - 0.5) * 0.3 - (y / Ht) * 0.25;
        if (d > 0.82) v -= 0.18;
        P.set(x, y, ramp(pal, v, x, y));
      }
    if (pal === BLOSSOM) for (let k = 0; k < 14; k++) P.set(4 + r() * (Wd - 8), 4 + r() * 24, BLOSSOM[5]);
    else
      for (let k = 0; k < 4; k++) {
        const x = (6 + r() * (Wd - 12)) | 0,
          y = (8 + r() * 16) | 0;
        if (P.a(x, y)) P.set(x, y, rgb('#e8583a'));
      }
    P.outline(0.45);
    return P.done();
  }
  function paintPine(seed, pal) {
    pal = pal || PINE;
    const r = mulberry32(seed),
      Wd = 26,
      Ht = 46,
      P = new Pix(Wd, Ht),
      c = 13;
    for (let y = 36; y < Ht; y++) for (let x = c - 1; x <= c + 1; x++) P.set(x, y, BARK[x === c - 1 ? 3 : 1]);
    const tiers = [
      [2, 14, 5],
      [9, 23, 8],
      [17, 32, 10.5],
      [25, 40, 12]
    ];
    for (const [y0, y1, w] of tiers) {
      for (let y = y0; y <= y1; y++) {
        const t = (y - y0) / (y1 - y0),
          hw = 1 + t * w;
        for (let x = Math.round(c - hw); x <= Math.round(c + hw); x++) {
          if (y === y1 && hash(x, y, seed) < 0.5) continue;
          const lx = (x - c) / hw;
          let v = 0.55 - lx * 0.35 + (1 - t) * 0.2 - (y / Ht) * 0.15 + (hash(x, y, seed + 1) - 0.5) * 0.18;
          P.set(x, y, ramp(pal, v, x, y));
        }
      }
    }
    void r;
    P.outline(0.45);
    return P.done();
  }
  function paintBush(seed, berries, pal) {
    pal = pal || LEAF;
    const r = mulberry32(seed),
      P = new Pix(20, 14);
    const blobs = [
      { x: 10, y: 8, r: 6 },
      { x: 5, y: 9, r: 4.5 },
      { x: 15, y: 9, r: 4.5 },
      { x: 8 + r() * 4, y: 5, r: 4 }
    ];
    for (let y = 0; y < 14; y++)
      for (let x = 0; x < 20; x++) {
        let best = null,
          bz = -9;
        for (const b of blobs) {
          const dx = (x + 0.5 - b.x) / b.r,
            dy = (y + 0.5 - b.y) / b.r,
            d = dx * dx + dy * dy;
          if (d <= 1 && y < 13) {
            const z = b.y * 0.2 + Math.sqrt(1 - d);
            if (z > bz) {
              bz = z;
              best = [dx, dy, d];
            }
          }
        }
        if (!best) continue;
        const [dx, dy, d] = best;
        let v = 0.42 + 0.4 * -(dx * 0.6 + dy * 0.8) + (hash(x, y, seed) - 0.5) * 0.25;
        if (d > 0.8) v -= 0.15;
        P.set(x, y, ramp(pal, v, x, y));
      }
    if (berries)
      for (let k = 0; k < 5; k++) {
        const x = (3 + r() * 14) | 0,
          y = (4 + r() * 7) | 0;
        if (P.a(x, y)) {
          P.set(x, y, rgb('#e83a5a'));
          P.set(x - 1, y - 1, rgb('#ff9aa8'));
        }
      }
    P.outline(0.45);
    return P.done();
  }
  const ROCKR = R(['#4e4a6a', '#646080', '#7c7896', '#9894ae', '#b4b0c6', '#d2cee0']);
  function paintRock(seed) {
    const r = mulberry32(seed),
      P = new Pix(18, 13);
    fillEllipse(P, 9, 7.5, 8, 5.4, (x, y, nx, ny) => {
      const facet = Math.floor((nx + 1) * 2.2 + r() * 0.01);
      const l = -(nx * 0.55 + ny * 0.84);
      return ramp(ROCKR, 0.45 + 0.45 * l + (facet % 2 ? 0.06 : -0.04) + (hash(x, y, seed) - 0.5) * 0.15, x, y, 0.7);
    });
    for (let x = 3; x < 15; x++)
      for (let y = 2; y < 6; y++)
        if (P.a(x, y) && P.a(x, y - 1) === 0 && hash(x, y, seed + 9) < 0.7) {
          P.set(x, y, MOSS[2]);
          if (hash(x, y, seed + 3) < 0.5) P.set(x, y + 1, MOSS[1]);
        }
    P.outline(0.45);
    return P.done();
  }
  function paintTuft(fr, seed) {
    const P = new Pix(9, 8);
    const blades = [
      [1, 5],
      [3, 7],
      [5, 6],
      [7, 4],
      [4, 4]
    ];
    for (const [bx, h] of blades)
      for (let k = 0; k < h; k++) {
        const lean = fr ? Math.floor(k / 3) : -Math.floor(k / 4);
        P.set(bx + lean, 7 - k, k > h - 2 ? GRASS[6] : GRASS[3 + (k % 2)]);
      }
    void seed;
    return P.done();
  }
  function paintFlowers(seed) {
    const r = mulberry32(seed),
      P = new Pix(8, 6);
    const cols = R(
      [
        ['#fff8ec', '#ffe066'],
        ['#ff9ec0', '#ffd6e4'],
        ['#9ec4ff', '#e0ecff'],
        ['#ffd34e', '#fff3b0']
      ][Math.floor(r() * 4)]
    );
    for (let k = 0; k < 4; k++) {
      const x = (1 + r() * 6) | 0,
        y = (1 + r() * 3) | 0;
      P.set(x, y + 1, GRASS[2]);
      P.set(x, y + 2, GRASS[1]);
      P.set(x, y, cols[0]);
      if (r() < 0.5) P.set(x + 1, y, cols[1]);
    }
    return P.done();
  }
  function paintMiniShroom() {
    const P = new Pix(5, 5);
    P.set(1, 1, CAP[3]);
    P.set(2, 0, CAP[4]);
    P.set(2, 1, CAP[2]);
    P.set(3, 1, CAP[2]);
    P.set(2, 2, STEM[2]);
    P.set(2, 3, STEM[1]);
    P.set(2, 1, rgb('#fff8f0'));
    P.outline(0.45);
    return P.done();
  }
  function paintPebble(seed) {
    const P = new Pix(5, 3);
    P.set(1, 1, ROCKR[3]);
    P.set(2, 1, ROCKR[2]);
    P.set(2, 0, ROCKR[4]);
    if (seed % 2) P.set(3, 1, ROCKR[2]);
    P.outline(0.5);
    return P.done();
  }

  /* ---------- maisons à colombages ---------- */
  const ROOFS = [
    R(['#5a2a3a', '#7e3a44', '#a4504e', '#c46e60', '#de9478']),
    R(['#22344e', '#2c4a62', '#3c6478', '#56828e', '#7ea4a8']),
    R(['#2c3e3a', '#3a5648', '#4e7058', '#6a8c68', '#8eaa80']),
    R(['#3e2a40', '#563a52', '#704e62', '#8c6676', '#a8828a'])
  ];
  const PLASTER = R(['#b39a8a', '#cdb4a0', '#e2ccb4', '#f2e2cc', '#fdf3e2']);
  const TIMBER = R(['#2c1a24', '#45283a', '#5e3a48']);
  function paintHouse(v) {
    const Hw = 24,
      Hr = 20,
      o = 0.2,
      ox = 40,
      oy = 42,
      P = new Pix(80, 78);
    const pr = (x, y, z) => [ox + (x - y) * 16, oy + (x + y) * 8 - z];
    const roof = ROOFS[v % 4];
    const wallTex = (u, z, lit, side) => {
      if (z < 3.2) {
        const row = Math.floor(z / 1.6),
          col = Math.floor(u * 10 + (row % 2) * 0.5);
        const vv = (lit ? 0.6 : 0.35) + (hash(col, row, 7 + side) - 0.5) * 0.3 - (z % 1.6 < 0.5 ? 0.25 : 0);
        return ramp(STONE, vv, Math.floor(u * 32), Math.floor(z));
      }
      const fu = u % 1;
      if (z > Hw - 1.6 || fu < 0.06 || fu > 0.94 || Math.abs(z - Hw * 0.55) < 0.55 || z < 4.2) return TIMBER[lit ? 2 : 1];
      const t = (z - 4.2) / (Hw * 0.55 - 4.6);
      if (t > 0 && t < 1 && Math.abs(fu - 0.06 - t * 0.88) < 0.045 && side === 1) return TIMBER[lit ? 2 : 1];
      return ramp(
        PLASTER,
        (lit ? 0.66 : 0.4) + (hash(Math.floor(u * 32), Math.floor(z), 3) - 0.5) * 0.12 - (z < 6 ? 0.1 : 0),
        Math.floor(u * 32),
        Math.floor(z),
        0.5
      );
    };
    const windowAt = (u, z, u0) => {
      if (Math.abs(u - u0) < 0.22 && z > 10 && z < 18) {
        if (Math.abs(u - u0) > 0.17 || z < 10.8 || z > 17.2) return TIMBER[0];
        if (Math.abs(u - u0) < 0.03 || Math.abs(z - 14) < 0.5) return TIMBER[1];
        return z > 15 ? rgb('#ffe9a8') : rgb('#ffc870');
      }
      return null;
    };
    // pan de toit arrière
    const B = (Hr + 2) / (1 + o),
      A2 = Hw - 2 + o * B;
    fillPoly(P, [pr(-o, -o, Hw - 2), pr(2 + o, -o, Hw - 2), pr(2 + o, 1, Hw + Hr), pr(-o, 1, Hw + Hr)], (x, y) => {
      const a = (x + 0.5 - ox) / 16,
        yy = (y + 0.5 - oy - 8 * a + A2) / (16 - B),
        xx = a + yy,
        s = (yy + o) / (1 + o);
      const row = Math.floor(s * 7),
        f = s * 7 - row,
        col = Math.floor(xx * 6 + (row % 2) * 0.5);
      return ramp(roof, 0.42 + (hash(col, row, v) - 0.5) * 0.25 - (f < 0.2 ? 0.22 : 0) + s * 0.1, x, y, 0.6);
    });
    // mur droit (x = 2) + pignon
    fillPoly(P, [pr(2, 0, 0), pr(2, 2, 0), pr(2, 2, Hw), pr(2, 1, Hw + Hr - 1), pr(2, 0, Hw)], (x, y) => {
      const a = (x + 0.5 - ox) / 16,
        yy = 2 - a,
        z = oy + (2 + yy) * 8 - (y + 0.5);
      if (z > Hw) {
        const fu = yy;
        if (Math.abs(fu - 1) < 0.05 || z > Hw + Hr - 4) return TIMBER[1];
        return ramp(PLASTER, 0.42, x, y, 0.5);
      }
      return windowAt(yy, z, 1) || wallTex(yy, z, false, 0);
    });
    // mur gauche (y = 2) avec porte
    fillPoly(P, [pr(0, 2, 0), pr(2, 2, 0), pr(2, 2, Hw), pr(0, 2, Hw)], (x, y) => {
      const a = (x + 0.5 - ox) / 16,
        xx = a + 2,
        z = oy + (xx + 2) * 8 - (y + 0.5);
      if (xx > 0.4 && xx < 0.78 && z < 14) {
        if (xx < 0.45 || xx > 0.73 || z > 12.8) return TIMBER[0];
        if (Math.abs(xx - 0.67) < 0.02 && Math.abs(z - 6.5) < 0.6) return GOLD;
        return ramp(R(['#4a2a16', '#6a3e22', '#8a5430']), (xx * 32) % 3 < 1 ? 0.2 : 0.7, x, y, 0.4);
      }
      return windowAt(xx, z, 1.45) || wallTex(xx, z, true, 1);
    });
    // pan de toit avant
    const A = Hw - 2 + (2 + o) * B;
    fillPoly(P, [pr(-o, 2 + o, Hw - 2), pr(2 + o, 2 + o, Hw - 2), pr(2 + o, 1, Hw + Hr), pr(-o, 1, Hw + Hr)], (x, y) => {
      const a = (x + 0.5 - ox) / 16,
        yy = (y + 0.5 - oy - 8 * a + A) / (16 + B),
        xx = a + yy,
        s = (2 + o - yy) / (1 + o);
      if (s > 0.94) return roof[4];
      if (s < 0.05) return roof[0];
      const row = Math.floor(s * 8),
        f = s * 8 - row,
        col = Math.floor(xx * 7 + (row % 2) * 0.5);
      return ramp(
        roof,
        0.6 + (hash(col, row, v + 5) - 0.5) * 0.28 - (f < 0.22 ? 0.26 : 0) + s * 0.12 - (xx < 0 || xx > 2 ? 0.1 : 0),
        x,
        y,
        0.6
      );
    });
    // cheminée
    const cx0 = pr(1.45, 0.55, Hw + Hr - 4);
    for (let y = -9; y <= 0; y++) for (let x = 0; x < 5; x++) P.set(cx0[0] + x, cx0[1] + y, ramp(STONE, x < 2 ? 0.7 : 0.35, x, y, 0.4));
    for (let x = -1; x < 6; x++) P.set(cx0[0] + x, cx0[1] - 10, STONE[1]);
    P.outline(0.4);
    return { img: P.done(), ax: ox, ay: oy, chimney: [cx0[0] + 2, cx0[1] - 12] };
  }
  function paintLamp() {
    const P = new Pix(11, 32),
      iron = R(['#1e1a26', '#2e2a3a', '#4a4458']);
    for (let y = 9; y < 30; y++) {
      P.set(5, y, iron[2]);
      P.set(6, y, iron[0]);
    }
    for (let x = 3; x <= 8; x++) {
      P.set(x, 30, iron[x < 6 ? 2 : 1]);
      P.set(x, 31, iron[0]);
    }
    for (let x = 4; x <= 7; x++) P.set(x, 29, iron[1]);
    for (let x = 2; x <= 9; x++) {
      P.set(x, 2, iron[1]);
      P.set(x, 8, iron[1]);
    }
    for (let x = 3; x <= 8; x++) P.set(x, 1, iron[2]);
    P.set(5, 0, iron[2]);
    P.set(6, 0, iron[1]);
    for (let y = 3; y <= 7; y++)
      for (let x = 2; x <= 9; x++)
        P.set(x, y, x === 2 || x === 9 ? iron[1] : x >= 4 && x <= 7 && y >= 4 && y <= 6 ? rgb('#fff6d0') : rgb('#ffd070'));
    P.outline(0.5);
    return P.done();
  }
  function paintBarrel() {
    const P = new Pix(12, 15),
      wood = R(['#4a2a16', '#6a3e22', '#8a5430', '#a86c40']),
      band = R(['#2a2630', '#4a4656']);
    for (let y = 3; y <= 13; y++) {
      const bulge = y > 4 && y < 12 ? 1 : 0;
      for (let x = 1 - bulge; x <= 10 + bulge; x++) {
        const l = 1 - Math.abs(x - 4) / 7;
        let c = ramp(wood, l, x, y, 0.5);
        if (y === 5 || y === 11) c = band[x < 5 ? 1 : 0];
        if (x % 3 === 0 && y !== 5 && y !== 11) c = mul(c, 0.85);
        P.set(x, y, c);
      }
    }
    fillEllipse(P, 6, 3, 5, 2, (x, y) => ramp(wood, 0.8, x, y, 0.4));
    P.outline(0.45);
    return P.done();
  }
  function paintCrate() {
    const P = new Pix(18, 22),
      wood = R(['#5a3a1e', '#7c5230', '#9c6c40', '#bc8a56']);
    const pr = (x, y, z) => [9 + (x - y) * 8, 11 + (x + y) * 4 - z];
    const s = 10;
    fillPoly(P, [pr(0, 1, 0), pr(1, 1, 0), pr(1, 1, s), pr(0, 1, s)], (x, y) => ramp(wood, x % 4 === 0 ? 0.35 : 0.7, x, y, 0.4));
    fillPoly(P, [pr(1, 0, 0), pr(1, 1, 0), pr(1, 1, s), pr(1, 0, s)], (x, y) => ramp(wood, x % 4 === 0 ? 0.15 : 0.42, x, y, 0.4));
    fillPoly(P, [pr(0, 0, s), pr(1, 0, s), pr(1, 1, s), pr(0, 1, s)], (x, y) => ramp(wood, 0.9, x, y, 0.4));
    P.outline(0.45);
    return P.done();
  }
  function paintFountain(fr) {
    const P = new Pix(40, 36),
      stone = STONE;
    const cx = 20,
      cy = 24;
    for (let dz = 6; dz >= 0; dz--)
      fillEllipse(P, cx, cy + dz, 17, 8.5, (x, y, nx) =>
        dz === 0 ? null : ramp(stone, 0.55 - nx * 0.3 - dz * 0.03 - (dz === 6 ? 0.2 : 0), x, y, 0.6)
      );
    fillEllipse(P, cx, cy, 17, 8.5, (x, y, nx, ny, d) => (d > 0.62 ? ramp(stone, 0.85 - nx * 0.2, x, y, 0.5) : null));
    fillEllipse(P, cx, cy + 0.5, 13.4, 6.2, (x, y, nx, ny, d) => {
      const ring = Math.sin(Math.sqrt(d) * 12 - fr * 2.1);
      return ramp(WATER, 0.62 + ring * 0.12 + (ny < 0 ? -0.1 : 0.05), x, y, 0.8);
    });
    for (let y = 9; y <= 24; y++) for (let x = 18; x <= 21; x++) P.set(x, y, ramp(stone, x < 20 ? 0.8 : 0.4, x, y, 0.4));
    fillEllipse(P, 20, 10, 6, 2.4, (x, y, nx) => ramp(stone, 0.75 - nx * 0.3, x, y, 0.4));
    fillEllipse(P, 20, 9.6, 4.4, 1.4, (x, y) => WATER[5]);
    const drops = [
      [20, 4 - (fr % 2)],
      [20, 5],
      [19, 6],
      [21, 6],
      [20, 7]
    ];
    for (const [x, y] of drops) P.set(x, y, rgb('#c8f0ff'));
    for (let k = 0; k < 5; k++) {
      const t = (k + fr * 0.7) % 5;
      P.set(13 - Math.round(t * 0.6), 11 + Math.round(t * 2.2), rgb('#b4e8ff'));
      P.set(27 + Math.round(t * 0.6), 11 + Math.round(t * 2.2), rgb('#b4e8ff'));
    }
    P.outline(0.45);
    return P.done();
  }

  /* ---------- points de cueillette ---------- */
  function paintHerbNode() {
    const P = new Pix(14, 12),
      lf = R(['#2e5a5e', '#3e7e66', '#5aa06c', '#86c47a']);
    for (const [x0, h, lean] of [
      [3, 6, -1],
      [6, 8, 0],
      [9, 7, 1],
      [11, 5, 1],
      [5, 4, -1]
    ])
      for (let k = 0; k < h; k++) P.set(x0 + Math.round((lean * k) / 4), 11 - k, lf[k > h - 3 ? 3 : 1 + (k % 2)]);
    for (let x = 2; x <= 11; x++) P.set(x, 11, lf[0]);
    const glow = R(['#6aa8e0', '#a8dcff', '#eaf8ff']);
    for (const [cx, cy] of [
      [6, 3],
      [9, 4],
      [3, 5],
      [11, 6]
    ]) {
      P.set(cx, cy, glow[2]);
      P.set(cx - 1, cy, glow[1]);
      P.set(cx + 1, cy, glow[1]);
      P.set(cx, cy - 1, glow[1]);
      P.set(cx, cy + 1, glow[0]);
    }
    P.outline(0.5);
    return P.done();
  }
  function paintWoodNode() {
    const P = new Pix(18, 11),
      bark = R(['#3a2e48', '#504050', '#6a5458', '#846a62', '#a08470']),
      ring = R(['#c49a6a', '#e0bc88', '#f4dcae']);
    for (let y = 3; y <= 9; y++)
      for (let x = 2; x <= 14; x++) {
        const l = 1 - (y - 3) / 7;
        P.set(x, y, ramp(bark, 0.25 + l * 0.6 + (hash(x, y, 77) - 0.5) * 0.2, x, y, 0.6));
      }
    fillEllipse(P, 15, 6, 2.4, 3.6, (x, y, nx, ny, d) => (d > 0.55 ? bark[3] : d > 0.25 ? ring[0] : ring[2]));
    for (let x = 3; x <= 13; x++)
      if (hash(x, 1, 5) < 0.6) {
        P.set(x, 2, MOSS[2]);
        if (hash(x, 2, 5) < 0.4) P.set(x, 3, MOSS[1]);
      }
    const sap = R(['#e8a030', '#ffd060', '#fff4b0']);
    for (const [x, y] of [
      [5, 6],
      [6, 5],
      [9, 7],
      [10, 6],
      [12, 5]
    ])
      P.set(x, y, sap[(x + y) % 3]);
    P.set(7, 1, rgb('#86c47a'));
    P.set(8, 0, rgb('#a8dc8a'));
    P.outline(0.5);
    return P.done();
  }
  function paintQuartzNode() {
    const P = new Pix(15, 15),
      q = R(['#8a4a7e', '#b8649a', '#e08ab8', '#f6b8d4', '#ffe4f0']);
    const prism = (cx, base, h, w) => {
      for (let y = base - h; y <= base; y++) {
        const top = y < base - h + w;
        const hw = top ? Math.max(0, y - (base - h)) : w;
        for (let x = cx - hw; x <= cx + hw; x++) P.set(x, y, q[x < cx ? 3 : x === cx ? 4 : 1 + (y % 2)]);
      }
    };
    prism(7, 13, 11, 2);
    prism(3, 13, 6, 1);
    prism(11, 13, 8, 2);
    for (let x = 1; x <= 13; x++) P.set(x, 14, rgb('#7c7896'));
    P.set(6, 4, q[4]);
    P.set(6, 5, q[4]);
    P.set(10, 8, q[4]);
    P.outline(0.5);
    return P.done();
  }

  /* ---------- icônes d'objets (teintées par objet) ---------- */
  const ICON_SHAPES = {
    sword: [
      '..........ll',
      '.........lcl',
      '........lcl.',
      '.......lcl..',
      '......lcl...',
      '..g..lcl....',
      '...glcl.....',
      '....gl......',
      '...bgg......',
      '..bb..g.....',
      '.bb.........',
      '.b..........'
    ],
    staff: [
      '........lll.',
      '.......lcccl',
      '.......ccccc',
      '.......cccc.',
      '........cc..',
      '.......b....',
      '......b.....',
      '.....b......',
      '....b.......',
      '...b........',
      '..b.........',
      '.b..........'
    ],
    axe: [
      '....lccc....',
      '...lcccccc..',
      '...lcc.ccc..',
      '....ccccc...',
      '......b.....',
      '.....b......',
      '.....b......',
      '....b.......',
      '....b.......',
      '...b........',
      '...b........',
      '..b.........'
    ],
    hood: [
      '....dddd....',
      '...dccccd...',
      '..dcllcccd..',
      '..dcl..ccd..',
      '.dcl.ss.ccd.',
      '.dc.ssss.cd.',
      '.dc.ssss.cd.',
      '.dcc....ccd.',
      '..dccccccd..',
      '...dddddd...'
    ],
    helm: [
      '....dddd....',
      '...dlllcd...',
      '..dllcccdd..',
      '..dlcccccd..',
      '..dcccccdd..',
      '.dwwwwwwwwd.',
      '..dc.dd.cd..',
      '..dc....cd..',
      '..dd....dd..'
    ],
    crown: ['.g...g...g..', '.gg.ggg.gg..', '.ggggggggg..', '.gcgglggcg..', '.ggggggggg..', '.lccccccccl.', '.cccccccccc.', '..cccccccc..'],
    tunic: [
      '..dd....dd..',
      '.dccd..dccd.',
      'dcccddddcccd',
      'dcllcccccccd',
      '.dcllccccd..',
      '..dclcccd...',
      '..dccgccd...',
      '..dcccccd...',
      '..dcccccd...',
      '..ddddddd...'
    ],
    plate: [
      '..dd....dd..',
      '.dwwd..dwwd.',
      'dcccddddcccd',
      'dcwwcccccccd',
      '.dcwwccccd..',
      '..dcwcccd...',
      '..dccgccd...',
      '..dwwwwwd...',
      '..dcccccd...',
      '..ddddddd...'
    ],
    pants: [
      '...dddddd...',
      '...dlcccd...',
      '...dlccccd..',
      '...dcccccd..',
      '...dcd.dcd..',
      '...dcd.dcd..',
      '...dcd.dcd..',
      '...dcd.dcd..',
      '..dddd.dddd.'
    ],
    boots: ['....ddd.....', '....dld.....', '....dcd.....', '....dlcd....', '....dccd....', '...dcccdd...', '..dccccccd..', '..dddddddd..'],
    spore: ['....dddd....', '...dlllcd...', '..dlwlcccd..', '..dllccccd..', '..dccclccd..', '..dcccccld..', '...dcccdd...', '....dddd....'],
    amulet: [
      '..dddddd....',
      '.d......d...',
      '.d......d...',
      '..d....d....',
      '...d..d.....',
      '....gg......',
      '...gllg.....',
      '...glccg....',
      '...gcccg....',
      '....ggg.....'
    ],
    bow: [
      '...bb.......',
      '..b..bl.....',
      '.b....l.....',
      'b.....l.....',
      'b..wwwwwwwy.',
      'b.....l.....',
      '.b....l.....',
      '..b..bl.....',
      '...bb.......'
    ],
    gmhelm: [
      'l.........l.',
      'll..l.l..ll.',
      '.lc.lcl.lc..',
      '.lccccccccl.',
      '..cccccccc..',
      '.dccgwgccd..',
      '.dcd....dcd.',
      '.dcd....dcd.',
      '..d......d..'
    ],
    tome: [
      '........ww..',
      '.......wllw.',
      '.......wllw.',
      '........ww..',
      'ddddddd.....',
      'dcccccdw....',
      'dcgggcdw....',
      'dcglgcdw....',
      'dcgggcdw....',
      'dcccccdw....',
      'ddddddd.....'
    ],
    shield: [
      '...dddddd...',
      '..dlllcccd..',
      '.dllcgcccdd.',
      '.dlcgggcccd.',
      '.dccgwgcccd.',
      '.dcccgccccd.',
      '.dcccccccdd.',
      '..dccccccd..',
      '...dccccd...',
      '....dddd....'
    ],
    dagger: [
      '..........l.',
      '.........lc.',
      '........lcl.',
      '.......lcl..',
      '......lcl...',
      '...g.lcl....',
      '....gcl.....',
      '....bg......',
      '...b..g.....',
      '..b.........'
    ],
    spear: [
      '..........ll',
      '.........lcl',
      '........lcc.',
      '.......gcl..',
      '......b.....',
      '.....b......',
      '....b.......',
      '...b........',
      '..b.........',
      '.b..........'
    ],
    great: [
      '.........lll',
      '........lccl',
      '.......lccl.',
      '......lccl..',
      '.....lccl...',
      '..g.lccl....',
      '...gccl.....',
      '...ggg......',
      '..bbg.g.....',
      '.bb.........',
      'bb..........'
    ],
    shard: [
      '.....l......',
      '....lcd.....',
      '....lcd.....',
      '...lccd.....',
      '...lccdd....',
      '..lcccccd...',
      '..lccccd....',
      '...lccd.....',
      '....dd......',
      '..gggggg....'
    ]
  };
  const iconCache = new Map();
  function itemIcon(kind, color) {
    const key = kind + color;
    let c = iconCache.get(key);
    if (c) return c;
    const base = rgb(color),
      pal = {
        c: base,
        l: mix(base, [255, 255, 255], 0.5),
        d: mul(base, 0.55),
        w: rgb('#e8e8f0'),
        g: rgb('#f2c94c'),
        b: rgb('#7a5030'),
        s: rgb('#3a2e48')
      };
    const rows = ICON_SHAPES[kind] || ICON_SHAPES.sword,
      P = new Pix(14, 14);
    rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) {
        const col = pal[r[x]];
        if (col) P.set(x + 1, y + 1 + Math.floor((12 - rows.length) / 2), col);
      }
    });
    P.outline(0.45);
    c = P.done();
    iconCache.set(key, c);
    return c;
  }

  /* ---------- icônes UI ---------- */
  function icon(rows, pal) {
    const h = rows.length,
      w = rows[0].length,
      P = new Pix(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const c = pal[rows[y][x]];
        if (c) P.set(x, y, rgb(c));
      }
    return P.done();
  }
  const ICONS = {
    sword: icon(
      [
        '..........ww',
        '.........wWw',
        '........wWw.',
        '.......wWw..',
        '......wWw...',
        '..b..wWw....',
        '...bwWw.....',
        '....bw......',
        '...gbb......',
        '..gg..b.....',
        '.gg.........',
        '.g..........'
      ],
      { w: '#8a90a8', W: '#eef2ff', b: '#6a4428', g: '#f2c94c' }
    ),
    spin: icon(
      [
        '....yyyy....',
        '..yy....yY..',
        '.y.......YY.',
        'y.........Y.',
        'y...ww......',
        'y..wWWw.....',
        '...wWWw..y..',
        '....ww...y..',
        '.Y.......y..',
        '.YY.....y...',
        '..Yy..yy....',
        '....yyy.....'
      ],
      { y: '#f2c94c', Y: '#fff0a0', w: '#8a90a8', W: '#eef2ff' }
    ),
    potion: icon(
      [
        '....kk....',
        '....cc....',
        '....cc....',
        '...rrrr...',
        '..rRRrrr..',
        '.rRrrrrrr.',
        '.rrrrrrrr.',
        '.rrrrrrrd.',
        '..rrrrrd..',
        '...dddd...'
      ],
      { k: '#8a5430', c: '#d8e0f0', r: '#e8414a', R: '#ffb0b8', d: '#9a1a2a' }
    ),
    coin: icon(['.yyy.', 'yYyyd', 'yyYyd', 'yyyyd', '.ddd.'], { y: '#f2c94c', Y: '#fff0a0', d: '#a87818' }),
    ether: icon(['..w..', '.wbb.', 'wWbbd', 'wbbbd', '.ddd.'], { w: '#a8dcff', W: '#ffffff', b: '#6aa8e0', d: '#3a6ab0' }),
    bag: icon(['...ddd...', '..d...d..', '.dccccccd', 'dcllccccd', 'dclcccccd', 'dcccggccd', 'dcccggccd', 'dcccccccd', '.ddddddd.'], {
      c: '#c08a52',
      l: '#e8b878',
      d: '#6a4428',
      g: '#f2c94c'
    }),
    a_slash: icon(
      [
        '.........ww',
        '........wWw',
        '.......wWw.',
        '......wWw..',
        '.y...wWw...',
        '..y.wWw....',
        '...yWw.....',
        '...byy.....',
        '..bb..y....',
        '.bb........',
        'b..........'
      ],
      { w: '#b8c0d8', W: '#ffffff', y: '#f2c94c', b: '#7a5030' }
    ),
    a_spin: icon(
      [
        '....yyyy....',
        '..yy....yY..',
        '.y.......YY.',
        'y.........Y.',
        'y...ww......',
        'y..wWWw.....',
        '...wWWw..y..',
        '....ww...y..',
        '.Y.......y..',
        '.YY.....y...',
        '..Yy..yy....',
        '....yyy.....'
      ],
      { y: '#f2c94c', Y: '#fff0a0', w: '#8a90a8', W: '#eef2ff' }
    ),
    a_charge: icon(['......yy....', '.......yy...', 'ww.yyyyyyy..', '...yyyyyyyy.', 'ww.yyyyyyy..', '.......yy...', '......yy....'], {
      y: '#ffd060',
      w: '#fff4c0'
    }),
    a_shout: icon(['.r.....w....', 'rrr...w..w..', 'rrRr.w..w..w', 'rrRr.w..w..w', 'rrr...w..w..', '.r.....w....'], {
      r: '#e8504a',
      R: '#ffb0a0',
      w: '#fff0c0'
    }),
    a_bow: icon(['..bb.......', '.b..l......', 'b...l......', 'b..ywwwwwW.', 'b...l......', '.b..l......', '..bb.......'], {
      b: '#ffd08a',
      l: '#ffffff',
      w: '#f4ead8',
      W: '#ffffff',
      y: '#b4f090'
    }),
    a_volley: icon(['W....W....W', '.w....w....w', '..w....w....', '...y....y...', 'W....W....W.', '.w....w.....', '..y....y....'], {
      w: '#d8d0c0',
      W: '#ffffff',
      y: '#9ad07a'
    }),
    a_pierce: icon(['............', 'c..........W', 'cc.wwwwwwwWW', 'c..........W', '............'], {
      w: '#ffffff',
      W: '#ffffff',
      c: '#a8e0ff'
    }),
    a_rain: icon(['..cccccc....', '.cCCCcccc...', 'cccccccccc..', '.cccccccc...', '..W..W..W...', '.W..W..W....', 'W..W..W.....'], {
      c: '#7a8ab8',
      C: '#c8d4f0',
      W: '#bfe6ff'
    }),
    a_bolt: icon(['....cc....', '...cWWc...', '..cWWWWc..', '..cWWWWc..', '...cWWc...', '..c.cc.c..', '.c......c.'], {
      c: '#7ec4ee',
      W: '#e8f8ff'
    }),
    a_frost: icon(
      [
        '.....w.....',
        '..w..w..w..',
        '...w.w.w...',
        '....www....',
        'wwwwwWwwwww',
        '....www....',
        '...w.w.w...',
        '..w..w..w..',
        '.....w.....'
      ],
      { w: '#a8dcff', W: '#ffffff' }
    ),
    a_fire: icon(
      ['....r.....', '...rr..r..', '..rrr.rr..', '..royrrr..', '.rooyyor..', '.royyyyor.', '.royWWyor.', '..ryWWyr..', '...rrrr...'],
      { r: '#d8402a', o: '#f08a3a', y: '#ffd060', W: '#fff4c0' }
    ),
    a_heal: icon(['...gggg...', '...gWWg...', 'ggggWWgggg', 'gWWWWWWWWg', 'gWWWWWWWWg', 'ggggWWgggg', '...gWWg...', '...gggg...'], {
      g: '#4aa04a',
      W: '#c8f0a0'
    }),
    zoom: icon(['.www.....', 'w...w....', 'w.W.w....', 'w...w....', '.www.....', '....ww...', '.....ww..', '......ww.', '.......w.'], {
      w: '#f4ead8',
      W: '#bfe6ff'
    }),
    chat: icon(['.wwwwwww.', 'wwwwwwwww', 'w.w.w.w.w', 'wwwwwwwww', '.wwwwwww.', '..ww.....', '.w.......'], { w: '#f4ead8' })
  };

  /* ---------- ponts du voyage ---------- */
  const WOOD = R(['#3a2014', '#5e3820', '#8a5630', '#b07a44', '#d8a868']);
  // planches d'une tuile de tablier, posées 3 px au-dessus de l'eau ; axe « x » (vers le bas-droite) ou « y » (vers le bas-gauche)
  function paintDeck(axis) {
    const P = new Pix(32, 21),
      Wd = 0.42;
    for (let y = 0; y < 21; y++)
      for (let x = 0; x < 32; x++) {
        const sx = x - 16 + 0.5,
          sy = y + 0.5,
          du = (sx / 16 + sy / 8) / 2,
          dv = (sy / 8 - sx / 16) / 2;
        const a = axis === 'x' ? du : dv,
          b = (axis === 'x' ? dv : du) - 0.5;
        if (a >= 0 && a <= 1 && Math.abs(b) <= Wd) {
          const seam = (a * 5) % 1 < 0.17,
            pl = Math.floor(a * 5) % 2;
          let t = seam ? 1 : b < -0.12 ? 3 + pl : 2 + pl;
          if (Math.abs(b) > Wd - 0.08) t = 1;
          P.set(x, y, WOOD[Math.min(4, t)]);
        }
      }
    // épaisseur visible du tablier (bord avant)
    for (let x = 0; x < 32; x++)
      for (let y = 20; y >= 1; y--)
        if (P.a(x, y - 1) && !P.a(x, y)) {
          P.set(x, y, WOOD[0]);
          if (y + 1 < 21) P.set(x, y + 1, rgb('#2a1610'));
          break;
        }
    return P.done();
  }
  // arche au bout du pont : brume d'éther violette (pont aléatoire) ou lumière dorée (retour au bourg), 4 images
  function paintArch(kind) {
    const fr = [],
      glow = rgb(kind === 'ether' ? '#c89cff' : '#ffd878'),
      glow2 = rgb(kind === 'ether' ? '#7a4ad8' : '#e89a30'),
      deep = rgb(kind === 'ether' ? '#3a2470' : '#a05a18');
    for (let f = 0; f < 4; f++) {
      const P = new Pix(22, 32);
      for (let y = 0; y < 32; y++)
        for (let x = 0; x < 22; x++) {
          const nx = (x + 0.5 - 11) / 8.2,
            ny = (y + 0.5 - 15) / 14.5,
            d = nx * nx + ny * ny;
          if (d <= 1 && d > 0.74) P.set(x, y, nx < -0.2 ? STONE[3] : nx < 0.3 ? STONE[2] : STONE[1]);
          else if (d <= 0.74) {
            const sw = Math.sin(Math.atan2(ny, nx) * 3 + d * 9 - (f * Math.PI) / 2);
            P.set(x, y, sw > 0.3 ? glow : sw > -0.4 ? glow2 : deep, d < 0.6 ? 235 : 160);
          }
        }
      for (let x = 6; x < 16; x++) {
        P.set(x, 30, STONE[1]);
        P.set(x, 31, STONE[0]);
      }
      fr.push(P.done());
    }
    return fr;
  }
  function paintChest(open) {
    const P = new Pix(16, 14),
      wood = WOOD,
      gold = R(['#a87818', '#f2c94c', '#fff0a0']);
    for (let y = open ? 6 : 3; y < 13; y++)
      for (let x = 1; x < 15; x++) P.set(x, y, y === (open ? 6 : 3) ? wood[4] : x < 4 ? wood[3] : x > 12 ? wood[1] : wood[2]);
    for (let x = 1; x < 15; x++) {
      P.set(x, open ? 8 : 7, gold[1]);
      P.set(x, 12, wood[0]);
    }
    if (open) {
      for (let x = 2; x < 14; x++) {
        P.set(x, 1, wood[3]);
        P.set(x, 2, wood[2]);
      }
      for (let x = 3; x < 13; x++) P.set(x, 7, rgb('#fff6c0'));
    } else {
      P.set(7, 6, gold[2]);
      P.set(8, 6, gold[1]);
      P.set(7, 8, gold[0]);
      P.set(8, 8, gold[0]);
    }
    P.outline(0.4);
    return P.done();
  }

  /* ---------- donjons : torche, cristal, pointes, entrée au centre des îles ---------- */
  const tierRamp = h => SPR.ramp5(h);
  function paintTorch(f) {
    const P = new Pix(7, 13),
      fl = R(['#a0301a', '#ff7a2a', '#ffc048', '#fff4c0']);
    for (let y = 8; y < 13; y++) P.set(3, y, rgb('#4a2c1c'));
    P.set(2, 8, rgb('#6a4028'));
    P.set(4, 8, rgb('#6a4028'));
    const h = f
      ? [
          [3, 1],
          [2, 2],
          [3, 2],
          [4, 3],
          [2, 3],
          [3, 3],
          [2, 4],
          [3, 4],
          [4, 4],
          [2, 5],
          [3, 5],
          [4, 5],
          [3, 6],
          [3, 7]
        ]
      : [
          [3, 0],
          [3, 1],
          [4, 2],
          [3, 2],
          [2, 3],
          [3, 3],
          [4, 3],
          [2, 4],
          [3, 4],
          [4, 4],
          [2, 5],
          [3, 5],
          [4, 5],
          [3, 6],
          [3, 7]
        ];
    for (const [x, y] of h) P.set(x, y, fl[y < 2 ? 1 : y > 5 ? 0 : 2]);
    P.set(3, 4, fl[3]);
    P.set(3, 5, fl[3]);
    return P.done();
  }
  function paintCrystal(col) {
    const P = new Pix(9, 16),
      r = tierRamp(col);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 9; x++) {
        const w = y < 8 ? y * 0.55 : (16 - y) * 0.3;
        if (Math.abs(x - 4) <= w) P.set(x, y, x < 4 ? r[3] : x === 4 ? r[4] : r[1]);
      }
    P.set(3, 4, WHITE);
    P.outline(0.4);
    return P.done();
  }
  const inDia = (x, y) => Math.abs(x + 0.5 - 16) / 16 + Math.abs(y + 0.5 - 8) / 8 <= 1;
  function paintSpikes(up) {
    const P = new Pix(32, 22),
      pit = R(['#120c1c', '#241a30']);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 32; x++)
        if (inDia(x, y) && Math.abs(x + 0.5 - 16) / 16 + Math.abs(y + 0.5 - 8) / 8 < 0.62)
          P.set(x, y + 6, (x + y) % 4 === 0 ? pit[0] : pit[1]);
    for (const [cx, cy] of [
      [11, 14],
      [16, 11],
      [21, 14],
      [16, 17],
      [13, 14],
      [19, 14]
    ])
      for (let k = 0; k < (up ? 6 : 1); k++) {
        P.set(cx, cy - k, rgb(k > 3 ? '#e8ecf4' : '#9aa0b8'));
        if (k < 2) P.set(cx + 1, cy - k, rgb('#5a6078'));
      }
    return P.done();
  }
  // entrée de donjon : portique sur une plateforme, escalier vers un tourbillon de la couleur de la rareté (4 images), ou éteinte
  function paintGate(col, f, off) {
    const tr = off ? R(['#2a2436', '#3a3248', '#4a4258', '#5a526a', '#6a6278']) : tierRamp(col),
      W0 = 72,
      H0 = 84,
      P = new Pix(W0, H0),
      cx = 36,
      base = 62,
      gold = tierRamp('#ffd04a'),
      legend = col === '#ffb43a';
    const ST = R(['#3c3a5c', '#504e70', '#666486', '#7e7c9c', '#9a98b6', '#c0bdd6']);
    if (!off)
      for (let y = base - 14; y < base + 22; y++)
        for (let x = 0; x < W0; x++) {
          const e = Math.abs(x + 0.5 - cx) / 35 + Math.abs(y + 0.5 - base - 4) / 17.5;
          if (e > 0.86 && e <= 1 && (x + y + f) % 3 !== 0) P.set(x, y, tr[e > 0.93 ? 1 : 2], 200);
        }
    for (let y = 0; y < H0; y++)
      for (let x = 0; x < W0; x++) {
        const sx = x + 0.5 - cx,
          syT = y + 0.5 - (base - 4),
          eT = Math.abs(sx) / 28 + Math.abs(syT) / 14;
        if (eT <= 1) {
          P.set(
            x,
            y,
            ramp(
              ST,
              0.55 + ((Math.floor((sx / 28 + syT / 14) * 3) + Math.floor((syT / 14 - sx / 28) * 3)) & 1) * 0.15 - (eT > 0.9 ? 0.2 : 0),
              x,
              y
            )
          );
          continue;
        }
        const syB = y + 0.5 - base,
          eB = Math.abs(sx) / 28 + Math.abs(syB) / 14;
        if (eB <= 1 && syB > -2 && y > base - 4 + 14 * (1 - Math.abs(sx) / 28) - 0.5) P.set(x, y, sx < 0 ? ST[2] : ST[1]);
      }
    for (let k = 0; k < 5; k++)
      for (let x = cx - 11 + k; x <= cx + 11 - k; x++) {
        const y = base - 6 - k * 2;
        P.set(x, y, k < 2 ? ST[3 - k] : [24 - k * 3, 16 - k * 2, 40 - k * 4]);
        P.set(x, y + 1, k < 2 ? ST[1] : [14, 8, 26]);
      }
    for (let y = base - 34; y < base - 14; y++)
      for (let x = cx - 11; x <= cx + 11; x++) {
        const nx = (x + 0.5 - cx) / 11,
          ny = (y + 0.5 - (base - 22)) / 12;
        if (nx * nx + ny * ny > 1 && y < base - 22) continue;
        const a = Math.atan2(ny, nx),
          d = Math.hypot(nx, ny),
          sw = off ? -1 : Math.sin(a * 3 + d * 8 - (f * Math.PI) / 2);
        P.set(x, y, sw > 0.35 ? tr[3] : sw > -0.3 ? tr[1] : [18, 10, 34]);
      }
    const pil = px => {
      for (let y = base - 40; y < base - 6; y++)
        for (let x = px - 3; x <= px + 3; x++) {
          P.set(x, y, x === px - 3 || x === px + 3 ? ST[0] : x < px ? ST[4] : x === px ? ST[3] : ST[2]);
          if ((y - base) % 7 === 0) P.set(x, y, ST[1]);
        }
      for (let x = px - 4; x <= px + 4; x++) {
        P.set(x, base - 41, ST[4]);
        P.set(x, base - 40, ST[2]);
        P.set(x, base - 7, ST[2]);
      }
    };
    pil(cx - 15);
    pil(cx + 15);
    for (let x = cx - 18; x <= cx + 18; x++) {
      P.set(x, base - 44, ST[5]);
      P.set(x, base - 43, ST[4]);
      P.set(x, base - 42, ST[3]);
      P.set(x, base - 41, ST[2]);
    }
    for (const px of [cx - 15, cx + 15]) for (let k = 0; k < 4; k++) P.set(px, base - 34 + k * 7, tr[4 - ((k + f) % 2)]);
    if (legend && !off) {
      for (let x = cx - 18; x <= cx + 18; x += 2) P.set(x, base - 44, gold[3]);
      for (const px of [cx - 15, cx + 15])
        for (let y = base - 40; y < base - 6; y += 3) {
          P.set(px - 3, y, gold[2]);
          P.set(px + 3, y, gold[1]);
        }
    }
    for (const [x, y, k] of [
      [cx, base - 49, 4],
      [cx - 1, base - 48, 3],
      [cx, base - 48, 4],
      [cx + 1, base - 48, 2],
      [cx - 2, base - 47, 3],
      [cx - 1, base - 47, 3],
      [cx, base - 47, 2],
      [cx + 1, base - 47, 1],
      [cx + 2, base - 47, 1],
      [cx - 1, base - 46, 2],
      [cx, base - 46, 1],
      [cx + 1, base - 46, 1],
      [cx, base - 45, 0]
    ])
      P.set(x, y, tr[k]);
    P.outline(0.45);
    return P.done();
  }
  function dungeonArt(tierCols) {
    return {
      torch: [paintTorch(0), paintTorch(1)],
      spikes: [paintSpikes(false), paintSpikes(true)],
      crystal: tierCols.map(paintCrystal),
      gate: tierCols.map(col => [0, 1, 2, 3].map(f => paintGate(col, f, false))),
      gateOff: paintGate('#808080', 0, true)
    };
  }

  /* ---------- boss de donjon : un dessin propre à chacun (regard vers la droite, 2 images) ----------
     Pixels placés par formes (ellipses, polygones) puis ombrés : même lumière que le bestiaire (haut gauche). */
  const GOLDR = R(['#6a4410', '#a87818', '#e8b83a', '#ffe070', '#fff6c8']);
  function crownOn(P, cx, base, w, gems) {
    const x0 = Math.round(cx - w / 2),
      x1 = x0 + w - 1,
      pts = w >= 14 ? 5 : 3;
    for (let x = x0; x <= x1; x++) {
      P.set(x, base, GOLDR[1]);
      P.set(x, base - 1, GOLDR[2]);
      P.set(x, base - 2, GOLDR[3]);
    }
    for (let k = 0; k < pts; k++) {
      const x = Math.round(x0 + (k * (w - 1)) / (pts - 1)),
        hgt = k % 2 ? 3 : 5;
      for (let y = 0; y < hgt; y++) {
        P.set(x, base - 3 - y, GOLDR[y === hgt - 1 ? 4 : 2]);
        if (k % 2 === 0 && y < hgt - 2) P.set(x + (x < cx ? 1 : -1), base - 3 - y, GOLDR[1]);
      }
    }
    const g = gems || ['#e8414a', '#4aa0f0'];
    P.set(Math.round(cx), base - 1, rgb(g[0]));
    P.set(Math.round(cx) - 1, base - 1, rgb(g[0]));
    P.set(x0 + 2, base - 1, rgb(g[1]));
    P.set(x1 - 2, base - 1, rgb(g[1]));
  }
  const glowEye = (P, x, y, c, h) => {
    for (let k = 0; k < (h || 2); k++) {
      P.set(x, y + k, c);
      P.set(x + 1, y + k, c);
    }
    P.set(x, y, mix(c, [255, 255, 255], 0.6));
  };
  const BOSS_PAL = {
    bark: R(['#2a1c14', '#46301e', '#66472a', '#8a6438', '#b0874c', '#d4ac70']),
    ring: R(['#7a5a34', '#a8824e', '#d0aa70', '#ecd2a0']),
    leaf: R(['#1f5a2a', '#2e8a3a', '#5ab84a', '#9ae070']),
    wolf: R(['#1e1c34', '#2e2c4c', '#46446c', '#6a6890', '#9a98b8', '#d0d0e4']),
    mist: R(['#8aa0c8', '#b8c8e4', '#e4ecf8']),
    bee: R(['#5a3a06', '#9a6a10', '#d8a020', '#f8d050', '#fff0a0']),
    beeD: R(['#1a1420', '#2a2030', '#3e3046']),
    wing: rgb('#e8f4ff'),
    crys: R(['#2a3e60', '#3e6a94', '#5e98c4', '#8ac8ea', '#c4ecff', '#ffffff']),
    stone: R(['#2e2c40', '#44425a', '#5e5c76', '#7c7a92', '#a09eb4']),
    sala: R(['#4a0e0c', '#801c14', '#c0361c', '#e86428', '#ffa040', '#ffe080']),
    flame: R(['#c0301a', '#ff6a1a', '#ffb040', '#fff0a0']),
    robe: R(['#120c22', '#221a3c', '#36295a', '#4e3c7c', '#6e5aa0']),
    ghost: R(['#4a3a78', '#7a68a8', '#b4a8d8', '#e8e0ff']),
    chain: R(['#3a3a4c', '#6a6a80', '#a4a4b8']),
    rock: R(['#140c10', '#241618', '#3a2420', '#54342a', '#704634']),
    lava: R(['#a8200e', '#ff5a14', '#ffa030', '#fff0a0']),
    ice: R(['#1a2e5a', '#2a4a86', '#4a78b4', '#7aaed8', '#b8dcf4', '#f0faff']),
    bone: R(['#8a8a94', '#b4b4be', '#dcdce4', '#ffffff']),
    void: R(['#06020e', '#140824', '#24103e', '#3a1a5e', '#5a2a86']),
    teeth: R(['#c8c0d8', '#f4f0ff'])
  };
  // 0 Roi Gelée : grande gelée royale, un trésor englouti dans le ventre
  function bossRoi(fr) {
    const P = new Pix(48, 46),
      S = SLIMES.boss,
      q = fr ? 1 : 0;
    fillEllipse(P, 24, 30 + q * 0.6, 20.5 + q * 0.8, 14.5 - q * 0.6, (x, y, nx, ny) => {
      if (y > 43) return null;
      const core = Math.max(0, 1 - Math.hypot(nx, ny + 0.3) * 1.25);
      return ramp(S, 0.5 + 0.4 * -(nx * 0.5 + ny * 0.85) - core * 0.16, x, y, 0.7);
    });
    for (let x = 4; x < 44; x++) if (P.a(x, 43)) P.set(x, 44, S[0]);
    for (let t = 0; t < 12; t++) P.set(12 + t, Math.round(38 - t * 0.55), t < 3 ? rgb('#6a4a20') : mix(S[1], [210, 220, 240], 0.5));
    for (const [x, y] of [
      [30, 38],
      [33, 39],
      [35, 37],
      [31, 40]
    ]) {
      P.set(x, y, mix(S[2], GOLDR[3], 0.65));
      P.set(x + 1, y, mix(S[2], GOLDR[2], 0.6));
    }
    for (const [x, y, k] of [
      [11, 24, 5],
      [12, 23, 5],
      [13, 23, 5],
      [11, 25, 4],
      [10, 27, 4],
      [37, 35, 4],
      [14, 22, 4]
    ])
      P.set(x, y, S[k]);
    for (const ex of [19, 28]) {
      for (let y = 0; y < 4; y++) {
        P.set(ex, 26 + y + q, EYE);
        P.set(ex + 1, 26 + y + q, EYE);
      }
      P.set(ex, 26 + q, WHITE);
    }
    for (let x = 21; x < 28; x++) P.set(x, 33 + q, mul(S[0], 0.8));
    P.set(21, 32 + q, mul(S[0], 0.8));
    P.set(27, 32 + q, mul(S[0], 0.8));
    crownOn(P, 24, 17 + q, 16);
    P.outline(0.45);
    for (let k = 3; k < P.d.length; k += 4)
      if (P.d[k] === 255) {
        const y = Math.floor(k / 4 / P.w);
        if (y > 19 && y < 42) P.d[k] = 240;
      }
    return P.done();
  }
  // 1 Souche ancestrale : vieux tronc qui marche sur ses racines, une pousse sur la tête, yeux d'ambre
  function bossSouche(fr) {
    const P = new Pix(48, 48),
      B = BOSS_PAL.bark,
      L = BOSS_PAL.leaf,
      b = fr ? 1 : 0;
    for (const [x0, dir, ph] of [
      [14, -1, 0],
      [19, -1, 1],
      [29, 1, 1],
      [34, 1, 0]
    ])
      for (let t = 0; t < 7; t++) {
        const lift = (fr + ph) % 2 && t > 4 ? -1 : 0,
          x = Math.round(x0 + dir * t * 0.75),
          y = Math.round(40 + t * 0.85) + lift;
        P.set(x, y, B[1]);
        P.set(x + 1, y, B[2]);
      }
    for (let y = 15 + b; y < 43; y++)
      for (let x = 12; x < 36; x++) {
        const nx = (x + 0.5 - 24) / 11.5,
          ny = (y + 0.5 - 29) / 14;
        if (Math.abs(nx) > 1 || (Math.abs(nx) > 0.85 && Math.abs(ny) > 0.85)) continue;
        const grain = (x * 3 + (y >> 2)) % 6 === 0 ? -0.14 : 0;
        P.set(x, y, ramp(B, 0.6 - nx * 0.32 + grain + (hash(x, y, 9) - 0.5) * 0.08, x, y, 0.5));
      }
    fillEllipse(P, 24, 16 + b, 11.5, 3.2, (x, y, nx, ny, d) =>
      ramp(BOSS_PAL.ring, 0.75 - d * 0.35 - (Math.round(Math.sqrt(d) * 4) % 2) * 0.22, x, y, 0.3)
    );
    for (let x = 12; x < 36; x++)
      if (hash(x, 3, 5) < 0.55) {
        P.set(x, 18 + b, L[1 + (x % 2)]);
        if (hash(x, 4, 5) < 0.4) P.set(x, 19 + b, L[1]);
      }
    for (let t = 0; t < 7; t++) P.set(27, 15 + b - t, B[3]);
    for (const [x, y] of [
      [24, 10],
      [25, 9],
      [26, 9],
      [28, 9],
      [29, 10],
      [25, 8],
      [28, 8],
      [27, 7],
      [26, 7],
      [30, 9],
      [23, 10]
    ])
      P.set(x, y + b, L[((x + y) % 3) + 1]);
    // bras-branches
    for (let t = 0; t < 10; t++) {
      P.set(12 - t, 27 - Math.round(t * 0.6) + (t > 6 ? b : 0), B[2]);
      P.set(12 - t, 28 - Math.round(t * 0.6) + (t > 6 ? b : 0), B[1]);
    }
    for (let t = 0; t < 9; t++) {
      P.set(35 + t, 26 - Math.round(t * 0.4) - (t > 5 ? b : 0), B[3]);
      P.set(35 + t, 27 - Math.round(t * 0.4) - (t > 5 ? b : 0), B[1]);
    }
    for (const [x, y] of [
      [4, 21],
      [3, 22],
      [5, 20],
      [43, 22],
      [44, 21],
      [42, 21]
    ])
      P.set(x, y, L[2]);
    for (const ex of [19, 27]) {
      P.set(ex, 26 + b, rgb('#ffe070'));
      P.set(ex + 1, 26 + b, rgb('#ffd040'));
      P.set(ex, 27 + b, rgb('#c07020'));
      P.set(ex + 1, 27 + b, rgb('#c07020'));
    }
    for (let x = 20; x < 29; x++) P.set(x, 33 + b + (x % 2), B[0]);
    P.outline(0.45);
    return P.done();
  }
  // 2 Grand Loup des brumes : loup immense, crinière de brume, yeux bleu glacé
  function bossLoup(fr) {
    const P = new Pix(52, 40),
      M = BOSS_PAL.wolf,
      b = fr ? 1 : 0;
    for (const [lx, ph] of [
      [13, 0],
      [18, 1],
      [33, 0],
      [38, 1]
    ]) {
      const lift = (fr + ph) % 2;
      for (let y = 29 - lift; y < 38 - lift; y++) {
        P.set(lx, y, M[1]);
        P.set(lx + 1, y, M[2]);
        P.set(lx + 2, y, M[1]);
      }
      P.set(lx + 3, 37 - lift, M[1]);
    }
    for (let t = 0; t < 10; t++) {
      const y = Math.round(22 - t * 0.9 + (fr ? 1 : 0) * (t > 5 ? 1 : 0));
      P.set(5 - Math.round(t * 0.25), y, M[2]);
      P.set(6 - Math.round(t * 0.25), y, M[3]);
    }
    fillEllipse(P, 24, 25, 15, 8, (x, y, nx, ny) => lit(M, nx, ny, x, y));
    fillEllipse(P, 41, 17 + b * 0.5, 7, 6.2, (x, y, nx, ny) => lit(M, nx, ny, x, y, 0.58));
    fillPoly(
      P,
      [
        [44, 18 + b],
        [51, 20 + b],
        [50, 23 + b],
        [44, 23 + b]
      ],
      (x, y) => ramp(M, 0.5 - (y - 18) * 0.05, x, y, 0.4)
    );
    for (const ex of [37, 42]) {
      for (let y = 0; y < 5; y++) {
        P.set(ex, 7 + y + b, M[y < 2 ? 3 : 2]);
        P.set(ex + 1, 8 + y + b, M[2]);
      }
    }
    glowEye(P, 44, 15 + b, rgb('#7af0ff'));
    P.set(51, 20 + b, EYE);
    for (let x = 45; x < 50; x++) if (x % 2) P.set(x, 23 + b, WHITE);
    // crinière de brume
    for (let k = 0; k < 90; k++) {
      const a = hash(k, 1, 3) * Math.PI * 2,
        r = 5 + hash(k, 2, 3) * 8,
        x = Math.round(33 + Math.cos(a) * r * 1.2 + (fr ? 1 : 0) * (k % 3 === 0 ? 1 : 0)),
        y = Math.round(18 + Math.sin(a) * r * 0.8);
      if (!P.a(x, y) || y < 17) P.set(x, y, BOSS_PAL.mist[k % 3], 220);
    }
    P.outline(0.42);
    return P.done();
  }
  // 3 Reine des abeilles : abdomen rayé, quatre ailes, couronne et sceptre de miel
  function bossReine(fr) {
    const P = new Pix(48, 46),
      Y = BOSS_PAL.bee,
      D = BOSS_PAL.beeD,
      b = fr ? 1 : 0;
    for (const [cx, cy, rx, ry] of [
      [16, 12 - b, 9, 6],
      [26, 10 - b, 8, 5],
      [14, 20 + b, 7, 4],
      [23, 19 + b, 6, 3.5]
    ])
      fillEllipse(P, cx, cy, rx, ry, (x, y, nx, ny) =>
        nx * nx + ny * ny > 0.7 ? mix(BOSS_PAL.wing, [160, 190, 230], 0.4) : BOSS_PAL.wing
      );
    for (let k = 3; k < P.d.length; k += 4) if (P.d[k]) P.d[k] = 170;
    fillEllipse(P, 15, 31, 11, 8.5, (x, y, nx, ny) => {
      const band = Math.floor((x - 4) / 4) % 2;
      return band ? ramp(D, 0.5 - ny * 0.4, x, y, 0.4) : lit(Y, nx, ny, x, y);
    });
    for (let t = 0; t < 4; t++) P.set(3 - Math.min(t, 2), 31 + t, D[0]);
    fillEllipse(P, 29, 27, 6.5, 6, (x, y, nx, ny) => ramp(D, 0.55 - ny * 0.35 - nx * 0.2, x, y, 0.4));
    for (let k = 0; k < 14; k++) P.set(24 + (k % 7), 23 + ((k >> 1) % 3), Y[3]);
    fillEllipse(P, 38, 22, 6, 5.5, (x, y, nx, ny) => lit(Y, nx, ny, x, y, 0.6));
    glowEye(P, 40, 20, EYE, 3);
    P.set(40, 20, WHITE);
    for (let t = 0; t < 5; t++) {
      P.set(36 + t, 15 - t, D[1]);
      P.set(41 + t, 16 - t, D[1]);
    }
    crownOn(P, 38, 16, 9, ['#e8414a', '#ff9a3c']);
    for (const lx of [25, 29, 33]) for (let y = 32; y < 39 + ((lx + fr) % 2); y++) P.set(lx, y, D[0]);
    for (let y = 22; y < 40; y++) P.set(45, y, rgb('#8a5a20'));
    fillEllipse(P, 45, 21, 2.6, 2.6, (x, y, nx, ny) => lit(R(['#a86010', '#f0a020', '#ffd060', '#fff0a0']), nx, ny, x, y));
    for (let y = 38; y < 43; y++) P.set(16, y + b, Y[2]);
    P.outline(0.42);
    return P.done();
  }
  // 4 Golem de cristal ancien : pierre couverte de mousse, cristaux qui poussent des épaules, cœur lumineux
  function bossGolem(fr) {
    const P = new Pix(52, 52),
      S = BOSS_PAL.stone,
      Q = BOSS_PAL.crys,
      b = fr ? 1 : 0;
    for (const lx of [16, 29])
      for (let y = 40; y < 51; y++)
        for (let x = lx; x < lx + 7; x++) P.set(x, y, ramp(S, 0.55 - (x - lx) * 0.06 - (y - 40) * 0.02, x, y, 0.4));
    for (let y = 17 + b; y < 42; y++)
      for (let x = 10; x < 42; x++) {
        const nx = (x + 0.5 - 26) / 16,
          ny = (y + 0.5 - 29) / 13;
        if (Math.abs(nx) > 1 || (Math.abs(nx) > 0.75 && Math.abs(ny) > 0.75)) continue;
        const crack = hash(x >> 1, y >> 1, 21) < 0.07 ? -0.25 : 0;
        P.set(x, y, ramp(S, 0.55 + 0.4 * -(nx * 0.55 + ny * 0.6) + crack, x, y, 0.5));
      }
    for (const s of [-1, 1])
      for (let y = 21 + b; y < 41 + (s > 0 ? 1 - b : b); y++)
        for (let k = 0; k < 6; k++) {
          const x = s < 0 ? 3 + k : 43 + k;
          P.set(x, y, ramp(S, (s < 0 ? 0.7 : 0.35) - k * 0.03 - (y - 21) * 0.008, x, y, 0.4));
        }
    for (const s of [-1, 1]) fillEllipse(P, s < 0 ? 6 : 46, 42, 4, 3.4, (x, y, nx, ny) => lit(S, nx, ny, x, y, 0.45));
    fillEllipse(P, 26, 13 + b, 7, 6, (x, y, nx, ny) => lit(S, nx, ny, x, y, 0.6));
    glowEye(P, 23, 12 + b, rgb('#bfefff'));
    glowEye(P, 28, 12 + b, rgb('#bfefff'));
    const shard = (x0, y0, h, w, lean) => {
      for (let t = 0; t < h; t++) {
        const ww = Math.max(0, Math.round(w * (1 - t / h)));
        for (let k = -ww; k <= ww; k++) P.set(Math.round(x0 + k + lean * t), y0 - t, Q[k < 0 ? 4 : k === 0 ? 5 : 2]);
      }
    };
    shard(12, 20 + b, 11, 2, -0.35);
    shard(16, 18 + b, 8, 1.5, -0.1);
    shard(39, 20 + b, 12, 2, 0.35);
    shard(35, 18 + b, 7, 1.5, 0.1);
    shard(44, 22 + b, 6, 1, 0.5);
    fillEllipse(P, 26, 29 + b, 4.5, 4.5, (x, y, nx, ny, d) => Q[Math.max(1, 5 - Math.round(d * 4))]);
    for (let x = 12; x < 40; x++)
      if (hash(x, 9, 4) < 0.5) P.set(x, 18 + b + (hash(x, 8, 4) < 0.3 ? 1 : 0), rgb(['#3e6a4a', '#5a8a5a'][x % 2]));
    crownOn(P, 26, 7 + b, 9, ['#7af0ff', '#c4ecff']);
    P.outline(0.42);
    return P.done();
  }
  // 5 Salamandre-reine : longue salamandre, collerette et crête de flammes, queue qui brûle
  function bossSala(fr) {
    const P = new Pix(56, 36),
      M = BOSS_PAL.sala,
      F = BOSS_PAL.flame,
      b = fr ? 1 : 0;
    for (let t = 0; t < 16; t++) {
      const x = 18 - t,
        y = Math.round(24 + Math.sin(t * 0.45 + fr * 1.5) * 2.2),
        r = 3.2 - t * 0.17;
      fillEllipse(P, x, y, Math.max(0.8, r), Math.max(0.8, r * 0.8), (xx, yy, nx, ny) => lit(M, nx, ny, xx, yy));
    }
    for (let k = 0; k < 8; k++) P.set(2 + (k % 3), 20 - k + (fr ? k % 2 : 0), F[k % 4]);
    for (const [lx, ph] of [
      [18, 0],
      [24, 1],
      [34, 0],
      [40, 1]
    ]) {
      const lift = (fr + ph) % 2;
      for (let y = 27 - lift; y < 33 - lift; y++) {
        P.set(lx, y, M[1]);
        P.set(lx + 1, y, M[2]);
      }
      P.set(lx + 2, 32 - lift, M[1]);
      P.set(lx - 1, 32 - lift, M[1]);
    }
    fillEllipse(P, 29, 24, 13, 6.5, (x, y, nx, ny) => (ny > 0.45 ? ramp(M, 0.85, x, y, 0.3) : lit(M, nx, ny, x, y)));
    for (let x = 18; x < 41; x++)
      if ((x + b) % 3 === 0) {
        const h = 3 + ((x * 7) % 3);
        for (let k = 0; k < h; k++) P.set(x, 17 - k + (k === h - 1 ? 0 : 0), F[Math.min(3, k)]);
      }
    fillEllipse(P, 46, 20 + b * 0.5, 7, 5.2, (x, y, nx, ny) => lit(M, nx, ny, x, y, 0.6));
    for (let k = 0; k < 9; k++) {
      const a = -2.4 + k * 0.45,
        x = Math.round(42 + Math.cos(a) * 8),
        y = Math.round(20 + b + Math.sin(a) * 7);
      P.set(x, y, F[(k % 3) + 1]);
      P.set(x + (x < 42 ? 1 : 0), y + 1, F[1]);
    }
    glowEye(P, 48, 18 + b, rgb('#fff060'));
    P.set(52, 22 + b, EYE);
    for (let x = 47; x < 53; x++) P.set(x, 23 + b, M[0]);
    crownOn(P, 45, 14 + b, 9, ['#ffe060', '#ff7a2a']);
    P.outline(0.4);
    return P.done();
  }
  // 6 Spectre couronné : robe de brume en lambeaux, chaînes, lanterne d'âmes
  function bossSpectre(fr) {
    const P = new Pix(48, 52),
      Rb = BOSS_PAL.robe,
      G = BOSS_PAL.ghost,
      Ch = BOSS_PAL.chain,
      b = fr ? 1 : 0;
    fillEllipse(P, 24, 16 + b, 9, 9, (x, y, nx, ny) => lit(Rb, nx, ny, x, y, 0.55));
    for (let y = 18 + b; y < 48; y++) {
      const w = 8 + (y - 18) * 0.38,
        sway = Math.sin(y * 0.35 + fr * Math.PI) * 1.5;
      for (let x = Math.round(24 - w + sway); x <= Math.round(24 + w + sway); x++) {
        const nx = (x - 24 - sway) / w;
        P.set(x, y, ramp(Rb, 0.55 - nx * 0.35 - (y - 18) * 0.006, x, y, 0.5));
      }
    }
    for (let x = 8; x < 42; x++) {
      const cut = Math.round(2 + 2 * Math.sin(x * 1.3 + fr * 2));
      for (let y = 48 - cut; y < 52; y++) P.clr(x, y);
      for (let y = 46 - cut; y < 48 - cut; y++) if (P.a(x, y)) P.set(x, y, G[0]);
    }
    fillEllipse(P, 24, 17 + b, 5.5, 5.5, (x, y, nx, ny) => ramp(R(['#05020a', '#0e0818']), 0.4 + ny * 0.2, x, y, 0.3));
    glowEye(P, 21, 16 + b, rgb('#7af0ff'));
    glowEye(P, 26, 16 + b, rgb('#7af0ff'));
    for (let t = 0; t < 16; t++) {
      const x = 12 + t * 1.6,
        y = 30 + Math.round(Math.sin(t * 0.7) * 2) + b;
      P.set(Math.round(x), y, Ch[t % 2 ? 1 : 2]);
      P.set(Math.round(x), y + 1, Ch[0]);
    }
    for (let y = 22 + b; y < 34; y++) P.set(41, y, Ch[1]);
    fillEllipse(P, 41, 36 + b * 0.5, 3.2, 3.8, (x, y, nx, ny, d) => (d < 0.4 ? rgb('#c8fff4') : d < 0.75 ? rgb('#5ae0d0') : Ch[2]));
    crownOn(P, 24, 8 + b, 13, ['#7af0ff', '#b08ae8']);
    P.outline(0.42);
    for (let k = 3; k < P.d.length; k += 4)
      if (P.d[k] === 255) {
        const y = Math.floor(k / 4 / P.w);
        if (y > 38) P.d[k] = 200;
      }
    return P.done();
  }
  // 7 Colosse de magma : géant de roche, fissures de lave, poings en fusion
  function bossColosse(fr) {
    const P = new Pix(56, 56),
      Rk = BOSS_PAL.rock,
      L = BOSS_PAL.lava,
      b = fr ? 1 : 0;
    for (const lx of [17, 31])
      for (let y = 42; y < 55; y++) for (let x = lx; x < lx + 8; x++) P.set(x, y, ramp(Rk, 0.6 - (x - lx) * 0.05, x, y, 0.4));
    fillPoly(
      P,
      [
        [12, 20 + b],
        [44, 20 + b],
        [40, 44],
        [16, 44]
      ],
      (x, y) => {
        const nx = (x - 28) / 16,
          ny = (y - 32) / 12;
        return ramp(Rk, 0.55 + 0.4 * -(nx * 0.6 + ny * 0.5), x, y, 0.5);
      }
    );
    fillEllipse(P, 28, 21 + b, 17, 5, (x, y, nx, ny) => lit(Rk, nx, ny, x, y, 0.6));
    for (const s of [-1, 1]) {
      for (let y = 22 + b; y < 40; y++)
        for (let k = 0; k < 7; k++) {
          const x = s < 0 ? 4 + k : 45 + k;
          P.set(x, y, ramp(Rk, (s < 0 ? 0.65 : 0.35) - (y - 22) * 0.01, x, y, 0.4));
        }
      fillEllipse(P, s < 0 ? 7.5 : 48.5, 43 + (s < 0 ? b : 1 - b), 5.5, 5, (x, y, nx, ny, d) => (d < 0.35 ? L[3] : d < 0.7 ? L[2] : L[1]));
    }
    const crack = pts => {
      for (let i = 0; i + 1 < pts.length; i++) {
        const [x0, y0] = pts[i],
          [x1, y1] = pts[i + 1],
          n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let t = 0; t <= n; t++) {
          const x = Math.round(x0 + ((x1 - x0) * t) / n),
            y = Math.round(y0 + ((y1 - y0) * t) / n) + b;
          if (P.a(x, y)) {
            P.set(x, y, L[(t + fr) % 3 === 0 ? 2 : 1]);
          }
        }
      }
    };
    crack([
      [18, 24],
      [22, 30],
      [20, 36],
      [24, 42]
    ]);
    crack([
      [34, 23],
      [31, 29],
      [35, 34],
      [33, 40]
    ]);
    crack([
      [26, 30],
      [29, 33],
      [27, 37]
    ]);
    crack([
      [6, 28],
      [8, 33]
    ]);
    crack([
      [49, 27],
      [47, 32]
    ]);
    fillEllipse(P, 28, 13 + b, 6.5, 5.5, (x, y, nx, ny) => lit(Rk, nx, ny, x, y, 0.55));
    for (const ex of [25, 30]) {
      P.set(ex, 13 + b, L[3]);
      P.set(ex + 1, 13 + b, L[2]);
      P.set(ex, 14 + b, L[1]);
      P.set(ex + 1, 14 + b, L[1]);
    }
    for (let k = 0; k < 5; k++) P.set(24 + k * 2, 8 + b - (k % 2) * 2, L[k % 2 ? 3 : 2]);
    crownOn(P, 28, 9 + b, 11, ['#fff0a0', '#ff5a14']);
    P.outline(0.4);
    return P.done();
  }
  // 8 Liche de Givre : crâne couronné de glace, robe de givre, bâton à orbe gelée
  function bossLiche(fr) {
    const P = new Pix(48, 54),
      I = BOSS_PAL.ice,
      Bn = BOSS_PAL.bone,
      b = fr ? 1 : 0;
    for (let y = 18 + b; y < 50; y++) {
      const w = 6 + (y - 18) * 0.42,
        sway = Math.sin(y * 0.3 + fr * Math.PI) * 1;
      for (let x = Math.round(22 - w + sway); x <= Math.round(22 + w + sway); x++) {
        const nx = (x - 22 - sway) / w;
        P.set(x, y, ramp(I, 0.5 - nx * 0.35 - (y - 18) * 0.005 + ((x + y) % 7 === 0 ? 0.2 : 0), x, y, 0.5));
      }
    }
    for (let x = 6; x < 40; x++) {
      const c = Math.round(1.5 + 1.5 * Math.sin(x * 1.7));
      for (let y = 50 - c; y < 54; y++) P.clr(x, y);
    }
    for (let y = 20 + b; y < 46; y++) P.set(22, y, I[5]);
    fillEllipse(P, 22, 14 + b, 6.5, 6.5, (x, y, nx, ny) => lit(Bn, nx, ny, x, y, 0.62));
    for (const ex of [19, 24]) {
      P.set(ex, 13 + b, EYE);
      P.set(ex + 1, 13 + b, EYE);
      P.set(ex, 14 + b, EYE);
      P.set(ex + 1, 14 + b, EYE);
      P.set(ex, 13 + b, rgb('#7ad8ff'));
    }
    for (let x = 19; x < 26; x++) if (x % 2) P.set(x, 18 + b, EYE);
    for (let k = 0; k < 7; k++) {
      const x = 16 + k * 2,
        h = k % 2 ? 4 : 7;
      for (let y = 0; y < h; y++) P.set(x, 8 + b - y, I[y > h - 2 ? 5 : 3]);
    }
    for (let y = 6; y < 50; y++) P.set(38, y + (y > 40 ? 0 : b), rgb(y % 6 === 0 ? '#c8dcf0' : '#5a6a8a'));
    for (let t = 0; t < 6; t++) {
      P.set(29 + t, 27 + b, Bn[2]);
    }
    P.set(36, 26 + b, Bn[3]);
    P.set(37, 27 + b, Bn[2]);
    fillEllipse(P, 38, 5 + b, 4, 4, (x, y, nx, ny, d) => (d < 0.3 ? I[5] : lit(I, nx, ny, x, y, 0.75)));
    for (let k = 0; k < 6; k++) {
      const a = k + fr * 0.5;
      P.set(Math.round(38 + Math.cos(a) * 6), Math.round(5 + b + Math.sin(a) * 6), I[5]);
    }
    P.outline(0.42);
    return P.done();
  }
  // 9 Le Dévoreur d'Éther (mythique) : bouche du vide, yeux multiples, tentacules, liseré prismatique
  function bossDevoreur(fr) {
    const P = new Pix(60, 56),
      V = BOSS_PAL.void,
      T = BOSS_PAL.teeth,
      b = fr ? 1 : 0;
    const prism = ['#ff4a7a', '#ffb43a', '#5ee870', '#5aa8ff', '#c47cff'].map(rgb);
    for (let k = 0; k < 7; k++) {
      const a0 = -0.4 + k * 0.6;
      for (let t = 0; t < 18; t++) {
        const a = a0 + Math.sin(t * 0.35 + k + fr * 1.4) * 0.25,
          r = 14 + t,
          x = Math.round(30 + Math.cos(a + Math.PI / 2) * r * 0.9),
          y = Math.round(28 + Math.sin(a + Math.PI / 2) * r * 0.55);
        if (y >= 56) continue;
        P.set(x, y, V[t > 12 ? 2 : 3]);
        if (t < 12) P.set(x + 1, y, V[2]);
        if (t === 17) P.set(x, y, prism[k % 5]);
      }
    }
    fillEllipse(P, 30, 26 + b * 0.5, 20, 18, (x, y, nx, ny, d) =>
      d > 0.86 ? prism[Math.floor(((Math.atan2(ny, nx) + Math.PI) / (Math.PI * 2)) * 15 + fr) % 5] : lit(V, nx, ny, x, y, 0.45)
    );
    fillEllipse(P, 32, 31 + b * 0.5, 11, 6.5 + b, (x, y, nx, ny, d) => (d > 0.72 ? V[0] : rgb('#0a0412')));
    for (let k = 0; k < 9; k++) {
      const x = 23 + k * 2.2,
        up = k % 2;
      for (let t = 0; t < 3; t++) {
        P.set(Math.round(x), Math.round(25 + b * 0.5 + t), T[t ? 0 : 1]);
        P.set(Math.round(x + 0.6), Math.round(37 + b - t), T[t ? 0 : 1]);
      }
      void up;
    }
    for (const [ex, ey, s] of [
      [22, 16, 2],
      [33, 13, 3],
      [42, 18, 2],
      [16, 24, 1],
      [45, 26, 1],
      [28, 19, 1]
    ]) {
      fillEllipse(P, ex, ey + b * 0.5, s + 0.6, s + 0.3, (x, y, nx, ny, d) =>
        d < 0.35 ? rgb('#ff4a7a') : d < 0.7 ? rgb('#ffd0e0') : rgb('#fff6fa')
      );
      P.set(ex, ey + b * 0.5, EYE);
    }
    crownOn(P, 30, 9 + b, 15, ['#ff4a7a', '#5aa8ff']);
    P.outline(0.35, [20, 6, 30]);
    return P.done();
  }
  // icônes des éléments (9×9, avec contour) : Feu, Eau, Bois, Lumière, Ténèbres
  const EL_ICON = {
    fire: ['....a....', '...aa....', '...aba...', '..abba.a.', '..abcba..', '.abccba..', '.abccba..', '..abba...', '...aa....'],
    ice: ['....a....', '...aba...', '...aba...', '..abbba..', '..abcba..', '.abcccba.', '.abcccba.', '..abbba..', '...aaa...'],
    wood: ['......aa.', '....aabb.', '...abbbb.', '..abbcbb.', '..abcbba.', '.abcbba..', '.acbba...', 'ac.aa....', 'a........'],
    light: ['....a....', '.a..a..a.', '..abbba..', '..bcccb..', 'aabcccbaa', '..bcccb..', '..abbba..', '.a..a..a.', '....a....'],
    dark: ['...aaa...', '..aab....', '.aab.....', '.abb.....', '.abb.....', '.abbb....', '..abbbaa.', '...aaaa..', '.........']
  };
  const EL_COL = {
    fire: ['#c0361c', '#ff8a3a', '#ffe070'],
    ice: ['#2a6cc0', '#6ab4ff', '#e0f4ff'],
    wood: ['#2e7a34', '#6ad060', '#d0f4a0'],
    light: ['#c8a020', '#ffe070', '#fffbe0'],
    dark: ['#4a2a7a', '#9a6ae0', '#e0c8ff']
  };
  function elIcons() {
    const o = {};
    for (const k in EL_ICON) {
      const P = new Pix(11, 11);
      EL_ICON[k].forEach((row, j) =>
        [...row].forEach((ch, i) => {
          if (ch !== '.') P.set(i + 1, j + 1, rgb(EL_COL[k]['abc'.indexOf(ch)]));
        })
      );
      P.outline(0.3);
      o[k] = P.done();
    }
    return o;
  }
  function bossArt() {
    const two = f => [f(0), f(1)];
    return [bossRoi, bossSouche, bossLoup, bossReine, bossGolem, bossSala, bossSpectre, bossColosse, bossLiche, bossDevoreur].map(two);
  }

  /* ---------- bestiaire : six silhouettes déclinées par élément (2 images chacune, regard vers la droite) ---------- */
  const MP = {
    lapin: { body: R(['#7a5a4a', '#a8806a', '#d0aa8a', '#ecd2b4', '#fff2e0']), acc: rgb('#ffb0c0') },
    abeille: { body: R(['#6a4a08', '#b0801a', '#e8b830', '#ffe070', '#fff6c0']), acc: rgb('#2a2030'), wing: rgb('#e8f4ff') },
    loup: { body: R(['#26223a', '#3c3858', '#5a5880', '#8a88aa', '#c0c0d8']), acc: rgb('#ff5a7a') },
    chauvesouris: { body: R(['#1e1430', '#34224e', '#4e3672', '#7a5aa0', '#a888c8']), acc: rgb('#ff4a6a'), wing: rgb('#5a3a80') },
    souche: {
      body: R(['#3a2414', '#5e3a20', '#8a5a30', '#b07a44', '#d4a46a']),
      acc: rgb('#7ad070'),
      leaf: R(['#1f5a2a', '#2e8a3a', '#5ab84a', '#9ae070'])
    },
    salamandre: { body: R(['#5a1610', '#9a2c18', '#d8502a', '#f08a3a', '#ffc070']), acc: rgb('#ffe070') },
    golem: { body: R(['#3a5070', '#5a80a8', '#88b4d8', '#bce0f4', '#f0fcff']), acc: rgb('#fff6a0') },
    follet: { body: R(['#c8902a', '#f0c040', '#ffe070', '#fff4b0', '#ffffff']), acc: rgb('#7a4a10') },
    spectre: { body: R(['#1a1430', '#2e2450', '#4a3a78', '#7a68a8', '#b4a8d8']), acc: rgb('#7af0ff') },
    pingouin: {
      body: R(['#141a30', '#1e2a48', '#2e4068', '#4a6090', '#7a90b8']),
      acc: rgb('#ffa040'),
      belly: R(['#c8d4e8', '#e8eef8', '#ffffff'])
    },
    loupneige: { body: R(['#6a7898', '#9aaac8', '#c4d2ea', '#e6eef8', '#ffffff']), acc: rgb('#4a9aff') },
    esprit: { body: R(['#2a6aa8', '#4a98d8', '#8ac8f4', '#c8ecff', '#ffffff']), acc: rgb('#1a3060') },
    magma: {
      body: R(['#1a1014', '#2e1a1c', '#4a2a26', '#6a3a30', '#8a4c3a']),
      acc: rgb('#ff8a2a'),
      glow: R(['#c03a10', '#ff6a1a', '#ffb040', '#fff0a0'])
    },
    cendre: { body: R(['#2a2020', '#4a3836', '#6e524c', '#947068', '#b89488']), acc: rgb('#ffb040'), wing: rgb('#ff7a2a') }
  };
  const lit = (pal, nx, ny, x, y, base) => ramp(pal, (base == null ? 0.52 : base) + 0.42 * -(nx * 0.55 + ny * 0.83), x, y, 0.6);
  function eyes(P, pts, big) {
    for (const [x, y] of pts) {
      P.set(x, y, EYE);
      P.set(x, y + 1, EYE);
      if (big) {
        P.set(x + 1, y, EYE);
        P.set(x + 1, y + 1, EYE);
      }
      P.set(x, y, WHITE);
    }
  }
  // quadrupède : lapin, loups
  function paintBeast(k, fr, small) {
    const M = MP[k],
      W0 = small ? 16 : 22,
      H0 = small ? 15 : 17,
      P = new Pix(W0, H0),
      sc = small ? 0.7 : 1;
    const bx = W0 * 0.45,
      by = H0 - 7 * sc,
      hx = W0 - 5 * sc,
      hy = H0 - 10.5 * sc;
    const legs = small
      ? [
          [4, 0],
          [9, 1]
        ]
      : [
          [5, 0],
          [8, 1],
          [13, 0],
          [16, 1]
        ];
    for (const [lx, ph] of legs) {
      const lift = (fr + ph) % 2;
      for (let y = H0 - 4 - lift; y < H0 - lift; y++) {
        P.set(lx, y, M.body[1]);
        P.set(lx + 1, y, M.body[ph ? 1 : 2]);
      }
    }
    if (!small) {
      for (let t = 0; t < 5; t++) P.set((1 + t * 0.6) | 0, (by - 2 - t * 0.6 + (fr ? 1 : 0)) | 0, M.body[2]);
    } else fillEllipse(P, 2.2, by - 0.5, 1.8, 1.6, () => M.body[4]);
    fillEllipse(P, bx, by, 7.5 * sc, 4.6 * sc, (x, y, nx, ny) => lit(M.body, nx, ny, x, y));
    fillEllipse(P, hx, hy, 4.2 * sc, 3.8 * sc, (x, y, nx, ny) => lit(M.body, nx, ny, x, y, 0.58));
    if (small) {
      for (let y = 0; y < 6; y++) {
        P.set(hx - 2, hy - 4 - y, M.body[y < 2 ? 2 : 3]);
        P.set(hx - 1, hy - 4 - y, M.body[3]);
        P.set(hx + 1, hy - 4 - y + (fr ? 1 : 0), M.body[2]);
      }
      P.set(hx - 1, hy - 6, M.acc);
    } else {
      for (const ex of [-2, 1]) {
        P.set(hx + ex, hy - 4, M.body[3]);
        P.set(hx + ex, hy - 5, M.body[2]);
        P.set(hx + ex + 1, hy - 4, M.body[2]);
      }
      fillEllipse(P, hx + 3, hy + 1, 2, 1.4, (x, y) => M.body[4]);
    }
    P.set(hx + 1, hy - 1, EYE);
    P.set(hx + 1, hy, EYE);
    P.set(hx + 2, hy - 1, M.acc === rgb('#ffb0c0') ? EYE : M.acc);
    P.set(hx + 1, hy - 1, WHITE);
    P.set(Math.round(hx + 4 * sc), Math.round(hy + 0.5), EYE);
    P.outline(0.42);
    return P.done();
  }
  // volant : abeille, chauves-souris (ailes haut / bas)
  function paintFlyer(k, fr) {
    const M = MP[k],
      P = new Pix(20, 17),
      up = fr === 0;
    for (const s of [-1, 1])
      for (let t = 0; t < 6; t++)
        for (let u = 0; u <= (k === 'abeille' ? 2 : 3) - (t >> 1); u++)
          P.set(
            10 + s * (4 + t),
            (up ? 6 - t + u : 9 + (t >> 1) + u) | 0,
            k === 'abeille' ? (u ? M.wing : rgb('#b8d8f0')) : u ? M.wing : M.body[0]
          );
    fillEllipse(P, 10, 9.5, 5.2, 4.8, (x, y, nx, ny) => {
      let c = lit(M.body, nx, ny, x, y);
      if (k === 'abeille' && (y === 9 || y === 11)) c = M.acc;
      return c;
    });
    if (k !== 'abeille')
      for (const s of [-1, 1]) {
        P.set(10 + s * 3, 4, M.body[2]);
        P.set(10 + s * 3, 5, M.body[3]);
        P.set(10 + s * 2, 5, M.body[2]);
      }
    else {
      P.set(8, 4, M.acc);
      P.set(12, 4, M.acc);
      P.set(7, 3, M.acc);
      P.set(13, 3, M.acc);
      P.set(15, 11, M.acc);
      P.set(16, 11, M.acc);
    }
    eyes(
      P,
      [
        [8, 8],
        [11, 8]
      ],
      false
    );
    if (k !== 'abeille') {
      P.set(9, 8, M.acc);
      P.set(12, 8, M.acc);
    }
    if (k === 'cendre') {
      P.set(4, up ? 3 : 12, M.acc);
      P.set(16, up ? 3 : 12, M.acc);
    }
    P.outline(0.42);
    return P.done();
  }
  // golems : souche (bois), cristal (lumière), magma (feu)
  function paintGolem(k, fr) {
    const M = MP[k],
      P = new Pix(22, 24),
      b = fr ? 1 : 0;
    for (const lx of [7, 13])
      for (let y = 19; y < 24; y++) {
        P.set(lx, y, M.body[1]);
        P.set(lx + 1, y, M.body[2]);
        P.set(lx + 2, y, M.body[1]);
      }
    for (let y = 7 + b; y < 20; y++)
      for (let x = 5; x < 17; x++) {
        const nx = (x + 0.5 - 11) / 6,
          ny = (y + 0.5 - 13) / 6.5;
        if (Math.abs(nx) > 1 || (Math.abs(nx) > 0.8 && Math.abs(ny) > 0.8)) continue;
        P.set(x, y, lit(M.body, nx, ny, x, y));
      }
    for (const s of [-1, 1])
      for (let y = 9 + b; y < 18 + (s > 0 ? 1 - b : b); y++) {
        const x0 = s < 0 ? 2 : 17;
        P.set(x0, y, M.body[s < 0 ? 3 : 1]);
        P.set(x0 + 1, y, M.body[2]);
        P.set(x0 + 2, y, M.body[s < 0 ? 2 : 1]);
      }
    fillEllipse(P, 11, 5 + b, 4, 3.4, (x, y, nx, ny) => lit(M.body, nx, ny, x, y, 0.6));
    for (const ex of [9, 12]) {
      P.set(ex, 5 + b, M.acc);
      P.set(ex + 1, 5 + b, M.acc);
    }
    if (k === 'golem') {
      for (const [x, y] of [
        [8, 9],
        [9, 8],
        [13, 10],
        [12, 14],
        [7, 15]
      ])
        P.set(x, y + b, M.body[4]);
      P.set(11, 1 + b, M.body[4]);
      P.set(10, 2 + b, M.body[3]);
      P.set(12, 2 + b, M.body[3]);
    }
    if (k === 'souche') {
      for (let x = 6; x < 17; x++) P.set(x, 7 + b, M.body[0]);
      for (const [x, y] of [
        [7, 0],
        [8, 1],
        [13, 0],
        [14, 1],
        [11, 0]
      ]) {
        P.set(x, y + b, M.leaf[2]);
        P.set(x, y + b + 1, M.leaf[1]);
      }
      for (let y = 10; y < 18; y += 3) {
        P.set(8, y + b, M.body[0]);
        P.set(14, y + 1 + b, M.body[0]);
      }
    }
    if (k === 'magma')
      for (const [x, y, l] of [
        [8, 10, 6],
        [13, 9, 5],
        [10, 15, 4],
        [6, 13, 3],
        [15, 14, 3]
      ])
        for (let t = 0; t < l; t++) P.set(x + (t % 2), (y + t * 0.5 + b) | 0, M.glow[(t + fr) % 4]);
    P.outline(0.42);
    return P.done();
  }
  // esprits : follet (lumière), spectre (ténèbres), esprit de givre (eau)
  function paintWisp(k, fr) {
    const M = MP[k],
      P = new Pix(16, 20);
    fillEllipse(P, 8, 7, 5.6, 5.4, (x, y, nx, ny) => lit(M.body, nx, ny, x, y, 0.6));
    for (let y = 11; y < 19; y++) {
      const w = Math.max(0, 5 - (y - 11) * 0.7),
        sway = Math.sin(y * 0.8 + fr * Math.PI) * 1.4;
      for (let x = Math.round(8 - w + sway); x <= Math.round(8 + w + sway); x++) P.set(x, y, M.body[y > 15 ? 1 : 2]);
    }
    if (k === 'follet') for (let y = -1; y < 3; y++) P.set(8 + (y % 2), y + 1, M.body[4]);
    if (k === 'spectre') {
      for (const [x, y] of [
        [4, 9],
        [12, 9]
      ]) {
        P.set(x, y, M.body[1]);
        P.set(x - (x < 8 ? 1 : -1), y + 1, M.body[1]);
      }
    }
    P.set(6, 6, M.acc);
    P.set(6, 7, M.acc);
    P.set(10, 6, M.acc);
    P.set(10, 7, M.acc);
    if (k !== 'spectre') {
      P.set(6, 6, WHITE);
      P.set(10, 6, WHITE);
      P.set(8, 9, M.acc);
    }
    P.outline(k === 'follet' ? 0.6 : 0.42);
    return P.done();
  }
  function paintLizard(k, fr) {
    const M = MP[k],
      P = new Pix(26, 13);
    for (const [lx, ph] of [
      [8, 0],
      [11, 1],
      [16, 0],
      [19, 1]
    ]) {
      const f = (fr + ph) % 2;
      P.set(lx - f, 11, M.body[1]);
      P.set(lx, 12, M.body[0]);
      P.set(lx + 1, 12, M.body[1]);
      P.set(lx, 10, M.body[1]);
    }
    for (let t = 0; t < 8; t++) P.set(t, 8 + Math.round(Math.sin(t * 0.7 + fr * 2) * 0.8), M.body[t < 3 ? 1 : 2]);
    fillEllipse(P, 14, 8, 8, 3, (x, y, nx, ny) => {
      const c = lit(M.body, nx, ny, x, y);
      return (x + y) % 4 === 0 && ny < 0 ? M.acc : c;
    });
    fillEllipse(P, 22, 7, 3.6, 2.8, (x, y, nx, ny) => lit(M.body, nx, ny, x, y, 0.6));
    P.set(23, 6, EYE);
    P.set(23, 5, WHITE);
    P.set(25, 8, M.body[0]);
    P.outline(0.42);
    return P.done();
  }
  function paintPenguin(k, fr) {
    const M = MP[k],
      P = new Pix(16, 18),
      b = fr ? 1 : 0;
    P.set(5, 17, M.acc);
    P.set(6, 17, M.acc);
    P.set(9, 17, M.acc);
    P.set(10, 17, M.acc);
    fillEllipse(P, 8, 10, 6, 7, (x, y, nx, ny) => lit(M.body, nx, ny, x, y));
    fillEllipse(P, 8.5, 11.5, 3.8, 5, (x, y, nx, ny) => ramp(M.belly, 0.6 - ny * 0.3, x, y, 0.4));
    for (const s of [-1, 1])
      for (let t = 0; t < 4; t++) P.set(s < 0 ? 2 - (t > 1 && b ? 1 : 0) : 13 + (t > 1 && b ? 1 : 0), 9 + t, M.body[1]);
    eyes(
      P,
      [
        [6, 6],
        [10, 6]
      ],
      false
    );
    P.set(8, 8, M.acc);
    P.set(9, 8, M.acc);
    P.set(8, 9, rgb('#d07020'));
    P.outline(0.42);
    return P.done();
  }
  function bestiary() {
    const A = {},
      two = f => [f(0), f(1)];
    A.lapin = two(fr => paintBeast('lapin', fr, true));
    A.loup = two(fr => paintBeast('loup', fr));
    A.loupneige = two(fr => paintBeast('loupneige', fr));
    A.abeille = two(fr => paintFlyer('abeille', fr));
    A.chauvesouris = two(fr => paintFlyer('chauvesouris', fr));
    A.cendre = two(fr => paintFlyer('cendre', fr));
    A.souche = two(fr => paintGolem('souche', fr));
    A.golem = two(fr => paintGolem('golem', fr));
    A.magma = two(fr => paintGolem('magma', fr));
    A.follet = two(fr => paintWisp('follet', fr));
    A.spectre = two(fr => paintWisp('spectre', fr));
    A.esprit = two(fr => paintWisp('esprit', fr));
    A.salamandre = two(fr => paintLizard('salamandre', fr));
    A.pingouin = two(fr => paintPenguin('pingouin', fr));
    return A;
  }
  const FLOATERS = { abeille: 1, chauvesouris: 1, cendre: 1, follet: 1, spectre: 1, esprit: 1 };
  function buildAll(W) {
    const t0 = performance.now();
    const terrain = buildTerrain(W);
    const trees = {
      oak: [11, 12, 13].map(s => paintRoundTree(s, LEAF)),
      blossom: [21, 22, 23].map(s => paintRoundTree(s, BLOSSOM)),
      pine: [31, 32, 33].map(s => paintPine(s)),
      oak_2: [11, 12, 13].map(s => paintRoundTree(s, LEAF_BOIS)),
      pine_2: [31, 32, 33].map(s => paintPine(s, PINE_BOIS)),
      bush_2: [41, 42, 43].map((s, i) => paintBush(s, i === 1, LEAF_BOIS)),
      oak_3: [11, 12, 13].map(s => paintRoundTree(s, LEAF_TERRES)),
      pine_3: [31, 32, 33].map(s => paintPine(s, PINE_TERRES)),
      bush_3: [41, 42, 43].map((s, i) => paintBush(s, i === 1, LEAF_TERRES)),
      bush: [41, 42, 43].map((s, i) => paintBush(s, i === 1)),
      rock: [51, 52, 53].map(s => paintRock(s)),
      oak_g: [11, 12, 13].map(s => paintRoundTree(s, LEAF_GIVRE)),
      pine_g: [31, 32, 33].map(s => paintPine(s, PINE_GIVRE)),
      bush_g: [41, 42, 43].map((s, i) => paintBush(s, false, LEAF_GIVRE))
    };
    const art = {
      terrain,
      trees,
      cloud: cloudTexture(),
      slime: paintSlime(SLIMES.slime),
      ember: paintSlime(SLIMES.ember),
      boss: paintSlime(SLIMES.boss),
      frost: paintSlime(SLIMES.frost),
      deck: { x: paintDeck('x'), y: paintDeck('y') },
      arch: { ether: paintArch('ether'), home: paintArch('home') },
      chest: [paintChest(false), paintChest(true)],
      champi: [paintChampi(0), paintChampi(1)],
      crown: CROWN,
      mobs: bestiary(),
      floaters: FLOATERS,
      houses: [0, 1, 2, 3].map(paintHouse),
      lamp: paintLamp(),
      barrel: paintBarrel(),
      crate: paintCrate(),
      fountain: [0, 1, 2].map(paintFountain),
      tuft: [paintTuft(0), paintTuft(1)],
      flowers: [1, 2, 3, 4, 5, 6].map(paintFlowers),
      mini: paintMiniShroom(),
      pebble: [paintPebble(1), paintPebble(2)],
      dgn: dungeonArt(C.DG.map(o => o.c)),
      bosses: bossArt(),
      elIcons: elIcons(),
      icons: ICONS,
      charSet,
      nodes: { herb: paintHerbNode(), wood: paintWoodNode(), quartz: paintQuartzNode() },
      slimeLight: Object.assign(
        { slime: SLIMES.slime[4], ember: SLIMES.ember[4], boss: SLIMES.boss[4], champi: CAP[4], frost: SLIMES.frost[4] },
        Object.fromEntries(Object.keys(MP).map(k => [k, MP[k].body[3]]))
      )
    };
    art.buildMs = Math.round(performance.now() - t0);
    return art;
  }
  window.EtheriaArt = { buildAll, itemIcon, charSet, TUNICS, HAIRS, SKINS };
})();
