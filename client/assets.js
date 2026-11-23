/* Etheria Online — direction artistique procédurale
   Pixel art "peint" : rampes de couleurs + tramage Bayer, lumière venant du haut-gauche,
   contours sélectifs teintés, inspirations Tree of Savior (tons chauds, chibi, colombages). */
(function () {
  'use strict';
  const C = window.EtheriaCore;
  const { hash, vnoise, fbm, mulberry32 } = C;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const R = a => a.map(rgb);
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mul = (a, f) => [a[0] * f, a[1] * f, a[2] * f];
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16 - 0.5);
  function ramp(arr, v, x, y, dz) { const n = arr.length; const f = clamp(v, 0, 1) * (n - 1) + BAYER[((y & 3) << 2) | (x & 3)] * (dz == null ? 0.9 : dz); return arr[clamp(Math.round(f), 0, n - 1)]; }

  class Pix {
    constructor(w, h) { this.w = w; this.h = h; this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h; this.g = this.c.getContext('2d'); this.im = this.g.createImageData(w, h); this.d = this.im.data; }
    set(x, y, c, a) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return; const k = (y * this.w + x) * 4; this.d[k] = c[0]; this.d[k + 1] = c[1]; this.d[k + 2] = c[2]; this.d[k + 3] = a == null ? 255 : a; }
    a(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0; return this.d[(y * this.w + x) * 4 + 3]; }
    col(x, y) { const k = (y * this.w + x) * 4; return [this.d[k], this.d[k + 1], this.d[k + 2]]; }
    outline(f, tint) {
      f = f == null ? 0.5 : f; tint = tint || [64, 42, 96];
      const add = [];
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (this.a(x, y) > 0) continue;
        for (const [a, b] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (this.a(x + a, y + b) > 100) { add.push([x, y, mix(mul(this.col(x + a, y + b), f), tint, 0.45)]); break; }
      }
      for (const [x, y, c] of add) this.set(x, y, c);
      return this;
    }
    done() { this.g.putImageData(this.im, 0, 0); return this.c; }
  }
  function fillPoly(P, pts, fn) {
    let y0 = Infinity, y1 = -Infinity; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
      if (xs.length < 2) continue;
      const xa = Math.min(...xs), xb = Math.max(...xs);
      for (let x = Math.ceil(xa - 0.5); x <= Math.floor(xb - 0.5); x++) { const c = fn(x, y); if (c) P.set(x, y, c); }
    }
  }
  function fillEllipse(P, cx, cy, rx, ry, fn) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry; const d = nx * nx + ny * ny;
      if (d <= 1) { const c = fn(x, y, nx, ny, d); if (c) P.set(x, y, c); }
    }
  }

  /* ---------- palettes ---------- */
  const GRASS = R(['#38587a', '#3a7480', '#44947a', '#5cb276', '#86cc7a', '#b4e28c', '#e2f4ac']);
  const SAND = R(['#b0968e', '#c8ae98', '#dcc4a6', '#ecd9ba', '#f8eed4']);
  const STONE = R(['#68668c', '#8280a4', '#9c9abc', '#b8b4d2', '#d6d2e6']);
  const PATHC = R(['#866a72', '#a0827e', '#b89a8c', '#cfb29e', '#e2cab2']);
  const CLIFF = R(['#3c3254', '#524466', '#6a5672', '#846c7e', '#a0868e', '#bea4a2']);
  const MOSS = R(['#3a5670', '#466e74', '#5a8a76', '#74a67c']);
  const SANDC = R(['#806a7a', '#9a8288', '#b29a96', '#c8b2a6']);
  const STONEC = R(['#403e60', '#545274', '#6a688a', '#8280a0']);
  const WATER = R(['#3c5aa0', '#4870b4', '#5688c4', '#68a2d0', '#82bcd8', '#a6d4e0', '#d2ecea']);
  const FOAM = rgb('#eafcff');
  C.ART_WATER_BG = '#4870b4';

  /* ---------- terrain ---------- */
  function buildTerrain(W) {
    const { MW, MH, TY, HT, idx, inb } = W;
    const N = MW * MH, DIST = new Float32Array(N).fill(99), q = [];
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) if (TY[idx(i, j)] !== 0) { DIST[idx(i, j)] = 0; q.push([i, j]); }
    for (let h = 0; h < q.length; h++) { const [i, j] = q[h], d = DIST[idx(i, j)] + 1; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = i + a, y = j + b; if (inb(x, y) && DIST[idx(x, y)] > d) { DIST[idx(x, y)] = d; q.push([x, y]); } } }
    const land = new Array(N), water = new Array(N);
    const nh = (a, b) => inb(a, b) ? (TY[idx(a, b)] === 0 ? -1 : HT[idx(a, b)]) : -1;
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
      const k = idx(i, j), t = TY[k];
      if (t === 0) { water[k] = paintWater(i, j, DIST[k], nh); continue; }
      land[k] = paintLand(i, j, t, HT[k], nh);
    }
    return { land, water };
  }
  function paintLand(i, j, t, h, nh) {
    const depth = 8 * h + 8, P = new Pix(32, 16 + depth + 1);
    const gx0 = (i - j) * 16 - 16, gy0 = (i + j) * 8;
    const hL = nh(i - 1, j), hR = nh(i, j - 1), hBR = nh(i + 1, j), hBL = nh(i, j + 1);
    const top = t === 1 ? SAND : t === 3 ? STONE : t === 4 ? PATHC : GRASS;
    for (let x = 0; x < 32; x++) {
      const dd = x < 16 ? x : 31 - x, hh = dd >> 1, t0 = 7 - hh, t1 = 8 + hh;
      for (let y = t0; y <= t1; y++) {
        const sx = x - 16 + 0.5, sy = y + 0.5, du = (sx / 16 + sy / 8) / 2, dv = (sy / 8 - sx / 16) / 2;
        const gx = gx0 + x, gy = gy0 + y;
        let v = 0.5, c = null;
        if (t === 2) {
          const n = fbm(gx / 46, gy / 23, 11), s = vnoise(gx * 0.45, gy * 0.9, 5);
          v = 0.26 + 0.46 * n + 0.2 * (s - 0.5) + h * 0.05;
          const r = hash(gx, gy, 77);
          if (r < 0.004) c = rgb(['#fff6e0', '#ffe066', '#ff9ec0', '#a8c8ff'][Math.floor(hash(gx, gy, 78) * 4)]);
          else if (r < 0.03) v += 0.18;
          // transition vers le chemin / le sable
          const tl = (b) => b === 4 || b === 1;
          void tl;
        } else if (t === 1) {
          v = 0.5 + 0.3 * (fbm(gx / 20, gy / 10, 4) - 0.5) + 0.08 * Math.sin(gx * 0.35 + gy * 0.25);
          if (hash(gx, gy, 41) < 0.02) v -= 0.3;
        } else if (t === 4) {
          v = 0.5 + 0.35 * (fbm(gx / 9, gy / 5, 23) - 0.5);
          const r = hash(gx, gy, 43); if (r < 0.03) v += 0.35; else if (r < 0.06) v -= 0.3;
        } else if (t === 3) {
          const row = Math.floor(gy / 4), off = (row & 1) * 4, col = Math.floor((gx + off) / 8);
          const lx = ((gx + off) % 8 + 8) % 8, ly = ((gy % 4) + 4) % 4;
          if (lx === 0 || ly === 0) v = 0.08;
          else v = 0.48 + 0.34 * (hash(col, row, 9) - 0.5) + (ly === 1 ? 0.14 : 0) - (lx === 7 ? 0.1 : 0) + (hash(gx, gy, 3) - 0.5) * 0.1;
        }
        if (hL > h) v -= 0.32 * Math.max(0, 1 - du / 0.32);
        if (hR > h) v -= 0.32 * Math.max(0, 1 - dv / 0.32);
        if (hL >= 0 && hL < h && du < 0.05) v += 0.15;
        if (hR >= 0 && hR < h && dv < 0.05) v += 0.15;
        let col = c || ramp(top, v, gx, gy);
        if ((hBR < h && 1 - du < 0.06) || (hBL < h && 1 - dv < 0.06)) col = top[top.length - 1];
        P.set(x, y, col);
      }
      const left = x < 16, gx = gx0 + x;
      const drip = t === 2 ? 1 + Math.floor(hash(gx, 0, 31) * 2.2) + (hash(gx, 1, 31) < 0.18 ? 2 : 0) : 0;
      for (let yy = 0; yy < depth; yy++) {
        const y = t1 + 1 + yy, Z = gy0 - h * 8 + y;
        let c;
        if (yy < drip) c = ramp(MOSS, (left ? 0.75 : 0.4) - yy * 0.12, gx, Z);
        else if (t === 3) {
          const row = Math.floor(yy / 3), lx = ((gx + (row & 1) * 3) % 6 + 6) % 6;
          const v = (left ? 0.72 : 0.42) + (hash(Math.floor((gx + (row & 1) * 3) / 6), row, 5) - 0.5) * 0.25 - (yy % 3 === 0 || lx === 0 ? 0.3 : 0) - yy / depth * 0.25;
          c = ramp(STONEC, v, gx, Z);
        } else {
          const band = vnoise(gx * 0.07, Z * 0.42, 21), RR = t === 1 ? SANDC : CLIFF;
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
    const gx0 = (i - j) * 16 - 16, gy0 = (i + j) * 8;
    const eL = nh(i - 1, j) >= 0, eR = nh(i, j - 1) >= 0, eBR = nh(i + 1, j) >= 0, eBL = nh(i, j + 1) >= 0;
    const cTL = nh(i - 1, j - 1) >= 0, cBR = nh(i + 1, j + 1) >= 0, cTR = nh(i + 1, j - 1) >= 0, cBL = nh(i - 1, j + 1) >= 0;
    for (let f = 0; f < 4; f++) {
      const P = new Pix(32, 16);
      for (let x = 0; x < 32; x++) {
        const dd = x < 16 ? x : 31 - x, hh = dd >> 1;
        for (let y = 7 - hh; y <= 8 + hh; y++) {
          const sx = x - 16 + 0.5, sy = y + 0.5, du = (sx / 16 + sy / 8) / 2, dv = (sy / 8 - sx / 16) / 2;
          const gx = gx0 + x, gy = gy0 + y;
          let prox = 0; const pe = (d) => Math.max(0, 1 - d / 0.7);
          if (eL) prox = Math.max(prox, pe(du)); if (eR) prox = Math.max(prox, pe(dv));
          if (eBR) prox = Math.max(prox, pe(1 - du)); if (eBL) prox = Math.max(prox, pe(1 - dv));
          if (cTL) prox = Math.max(prox, pe(Math.hypot(du, dv))); if (cBR) prox = Math.max(prox, pe(Math.hypot(1 - du, 1 - dv)));
          if (cTR) prox = Math.max(prox, pe(Math.hypot(1 - du, dv))); if (cBL) prox = Math.max(prox, pe(Math.hypot(du, 1 - dv)));
          const deep = clamp(1 - (dist - 1) / 4, 0, 1);
          const shallow = deep * 0.45 + prox * 0.5;
          const wave = Math.sin(gx * 0.22 + gy * 0.55 + f * Math.PI / 2) * 0.5 + Math.sin(gx * 0.11 - gy * 0.3 - f * Math.PI / 2) * 0.5;
          let v = 1 / 6 + shallow * 0.78 + wave * 0.06 * (0.3 + shallow);
          let c = ramp(WATER, v, gx, gy);
          const foamEdge = 0.9 + 0.05 * Math.sin(gx * 0.5 + f * Math.PI / 2);
          if (prox > foamEdge) c = FOAM;
          else if (prox > 0.62 && prox < 0.69 && ((gx + f * 2) % 6 + 6) % 6 < 3) c = mix(FOAM, WATER[5], 0.4);
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
    const S = 64, P = new Pix(S, S), per = 8;
    const pn = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const H = (a, b) => hash(((a % per) + per) % per, ((b % per) + per) % per, s); const t = H(xi, yi) + (H(xi + 1, yi) - H(xi, yi)) * u, b = H(xi, yi + 1) + (H(xi + 1, yi + 1) - H(xi, yi + 1)) * u; return t + (b - t) * v; };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = pn(x / 8, y / 8, 1) * 0.65 + pn(x / 4, y / 4, 2) * 0.35;
      const a = clamp((n - 0.52) / 0.18, 0, 1);
      P.set(x, y, [24, 30, 70], Math.round(a * 255));
    }
    return P.done();
  }

  /* ---------- personnages chibi ---------- */
  const SKINS = [['#fbe0c4', '#f0c4a0', '#d49c7a'], ['#ecc094', '#d6a074', '#b07a52'], ['#b47a52', '#93603e', '#6e4228']].map(R);
  const HAIRS = [['#2e1c14', '#4e3020', '#6e4830', '#9a6c48'], ['#6e2416', '#9e3a22', '#cc5a34', '#f0905e'], ['#9c6e22', '#c89632', '#ecc24e', '#fff0a4'], ['#7a7a98', '#a8a8c4', '#d4d4e8', '#ffffff'], ['#22224a', '#34346e', '#5050a0', '#8484d0'], ['#1e4a30', '#2e6a40', '#4a9858', '#80cc80'], ['#7a2e5e', '#a8407e', '#d466a6', '#ffa0d0']].map(R);
  const TUNICS = [['#1e2e62', '#2c4a92', '#4670c4', '#78a0e8'], ['#601a20', '#922a2c', '#c24636', '#e8785a'], ['#1a4426', '#2a6436', '#449446', '#78c46a'], ['#56360e', '#865618', '#bc8628', '#e6b658'], ['#361a56', '#542a86', '#843ebc', '#b47ce6'], ['#26262e', '#3c3c48', '#58586a', '#86869a'], ['#103640', '#1a5662', '#2a8692', '#58b6be']].map(R);
  const PANTS = R(['#2a2234', '#3a3048', '#4e4462']), BOOT = R(['#341f14', '#53341f', '#74502f']);
  const BELT = rgb('#4a2c18'), GOLD = rgb('#f2c94c'), EYE = rgb('#2a1c38'), WHITE = rgb('#ffffff'), BLUSH = rgb('#f49a96');
  const IRIS = rgb('#4a68c8'), IRIS2 = rgb('#2e3e8a');
  function paintChibi(L, dir, fr, blink) {
    const P = new Pix(16, 27);
    const sk = SKINS[L[3]], hc = HAIRS[L[1]], tc = TUNICS[L[2]], style = L[0], hat = L[4];
    const step = fr === 1 ? -1 : fr === 3 ? 1 : 0;
    if (dir !== 'side') {
      const leg = (x0, lift) => {
        for (let y = 22 - lift; y <= 24 - lift; y++) for (let x = x0; x < x0 + 2; x++) P.set(x, y, x === x0 ? PANTS[2] : PANTS[1]);
        for (let y = 25 - lift; y <= 26 - lift; y++) for (let x = x0 - (x0 < 8 ? 1 : 0); x < x0 + 2 + (x0 > 8 ? 1 : 0); x++) P.set(x, y, y === 25 - lift ? BOOT[2] : BOOT[1]);
      };
      leg(5, step === -1 ? 1 : 0); leg(9, step === 1 ? 1 : 0);
      for (let y = 17; y <= 21; y++) {
        const x0 = y === 21 ? 4 : 5, x1 = y === 21 ? 11 : 10;
        for (let x = x0; x <= x1; x++) {
          let c = tc[1]; if (x === x0) c = tc[2]; if (x === x1) c = tc[0]; if (y === 17 && x > x0 && x < x1) c = tc[2]; if (y === 21) c = x === x0 ? tc[1] : tc[0];
          if (y === 20) c = (x === 7 || x === 8) && dir === 'front' ? GOLD : BELT;
          P.set(x, y, c);
        }
      }
      if (dir === 'front') { P.set(7, 17, sk[1]); P.set(8, 17, sk[2]); }
      const arm = (x, sw, lit) => { for (let y = 17; y <= 19; y++) P.set(x, y + sw, lit ? tc[2] : tc[0]); P.set(x, 20 + sw, sk[lit ? 0 : 2]); };
      arm(4, step, true); arm(11, -step, false);
      if (dir === 'back') { for (let y = 17; y <= 23; y++) for (let x = 5; x <= 10; x++) { if (y > 21 && (x === 5 || x === 10)) continue; P.set(x, y, ramp(tc, 0.55 - (x - 5) * 0.08 - (y - 17) * 0.03, x, y, 0.6)); } }
    } else {
      const legS = (x0, back, lift) => { for (let y = 22 - lift; y <= 24 - lift; y++) for (let x = x0; x < x0 + 2; x++) P.set(x, y, back ? PANTS[0] : PANTS[1 + (x === x0 ? 1 : 0)]); for (let x = x0; x < x0 + 3; x++) { P.set(x, 25 - lift, back ? BOOT[1] : BOOT[2]); P.set(x, 26 - lift, BOOT[back ? 0 : 1]); } };
      if (step === 0) { legS(6, true, 0); legS(8, false, 0); }
      else if (step === -1) { legS(4, true, 0); legS(10, false, 1); }
      else { legS(10, true, 1); legS(4, false, 0); }
      for (let y = 17; y <= 21; y++) { const x0 = y === 21 ? 5 : 6, x1 = y === 21 ? 11 : 10; for (let x = x0; x <= x1; x++) { let c = x <= 7 ? tc[0] : x >= 10 ? tc[2] : tc[1]; if (y === 20) c = BELT; P.set(x, y, c); } }
      const ax = 8 + step; for (let y = 17; y <= 19; y++) { P.set(ax, y, tc[2]); P.set(ax + 1, y, tc[1]); } P.set(ax, 20, sk[0]); P.set(ax + 1, 20, sk[1]);
    }
    // tête
    const cx = 8, cy = 11.5;
    fillEllipse(P, cx, cy, 6.4, 6, (x, y, nx, ny) => { const l = -(nx * 0.6 + ny * 0.8); return l > 0.5 ? sk[0] : l < -0.55 ? sk[2] : sk[1]; });
    const hairAt = (x, y) => {
      const nx = (x + 0.5 - cx) / 7.2, ny = (y + 0.5 - (cy - 0.6)) / 6.8, inside = nx * nx + ny * ny <= 1;
      if (dir === 'back') { if (inside) return true; if (style === 1 && y >= 15 && y <= 22 && x >= 3 && x <= 12) return true; return false; }
      if (dir === 'side') {
        if (inside && (y <= 9 || x <= 7)) return true;
        if (inside && y === 10 && (x === 9 || x === 10 || x === 12)) return true;
        if (style === 1 && y >= 10 && y <= 20 && x >= 2 && x <= 6) return true;
        return false;
      }
      if (inside && y <= 9) return true;
      if (inside && y <= 13 && (x <= 2 || x >= 13)) return true;
      if (inside && y === 10 && [2, 3, 5, 6, 9, 10, 12, 13].includes(x)) return true;
      if (style === 1 && y >= 10 && y <= 20 && (x === 1 || x === 2 || x === 13 || x === 14)) return true;
      return false;
    };
    for (let y = 2; y < 24; y++) for (let x = 0; x < 16; x++) {
      if (!hairAt(x, y)) continue;
      const nx = (x + 0.5 - cx) / 7, ny = (y + 0.5 - cy) / 7, l = -(nx * 0.6 + ny * 0.8);
      let c = l > 0.45 ? hc[2] : l < -0.35 ? hc[0] : hc[1];
      if (dir !== 'side' ? (y === 6 && x >= 4 && x <= 6) || (y === 7 && x >= 3 && x <= 4) : (y === 6 && x >= 5 && x <= 8)) c = hc[3];
      if (y >= 15) c = (x + y) % 3 === 0 ? hc[0] : hc[1];
      P.set(x, y, c);
    }
    if (style === 2) { const sp = dir === 'side' ? [[4, 4], [7, 3], [10, 4]] : [[4, 4], [8, 3], [11, 4]]; for (const [x, y] of sp) { P.set(x, y, hc[1]); P.set(x, y - 1, hc[2]); } }
    // visage
    const eye = (x0) => { if (blink) { P.set(x0, 12, EYE); P.set(x0 + 1, 12, EYE); return; } P.set(x0, 11, EYE); P.set(x0 + 1, 11, EYE); P.set(x0, 12, WHITE); P.set(x0 + 1, 12, IRIS); P.set(x0, 13, IRIS); P.set(x0 + 1, 13, IRIS2); };
    if (dir === 'front') { eye(4); eye(10); P.set(3, 14, BLUSH); P.set(12, 14, BLUSH); P.set(8, 15, mul(sk[2], 0.85)); }
    else if (dir === 'side') { eye(10); P.set(12, 14, BLUSH); P.set(13, 15, mul(sk[2], 0.85)); }
    // chapeaux
    if (hat === 1) {
      const hcol = R(['#2a1a40', '#3e2a62', '#5a4090', '#7e62b8']);
      for (let y = -4; y <= 5; y++) { const w = Math.max(0, Math.floor((y + 4) * 0.6)); const ax = 9 - Math.floor((y + 4) * 0.12); for (let x = ax - w; x <= ax + w; x++) P.set(x, y + 4, hcol[x < ax ? 2 : 1]); }
      for (let x = 1; x <= 14; x++) { P.set(x, 9, hcol[x < 6 ? 2 : 1]); P.set(x, 10, hcol[0]); }
      for (let x = 5; x <= 11; x++) P.set(x, 8, GOLD);
    } else if (hat === 2) { for (let x = 2; x <= 13; x++) P.set(x, 8, x % 4 === 0 ? rgb('#f07060') : rgb('#c83a3a')); if (dir !== 'front') { P.set(2, 9, rgb('#c83a3a')); P.set(1, 10, rgb('#a82a2a')); } }
    else if (hat === 3) { P.set(8, 3, rgb('#4a9a4a')); P.set(9, 2, rgb('#7ac46a')); P.set(10, 2, rgb('#9ee07a')); P.set(10, 1, rgb('#7ac46a')); P.set(7, 3, rgb('#336a36')); }
    P.outline();
    return P.done();
  }
  const charCache = new Map();
  function flip(src) { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const g = c.getContext('2d'); g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); return c; }
  function charSet(look) {
    const key = look.join('');
    let s = charCache.get(key); if (s) return s;
    const L = C.cleanLook(look);
    const f = [0, 1, 2, 3].map(fr => paintChibi(L, 'front', fr)), b = [0, 1, 2, 3].map(fr => paintChibi(L, 'back', fr)), sd = [0, 1, 2, 3].map(fr => paintChibi(L, 'side', fr));
    const bs = paintChibi(L, 'side', 0, true);
    s = { front: f, back: b, side: sd, sideL: sd.map(flip), blinkF: paintChibi(L, 'front', 0, true), blinkS: bs, blinkSL: flip(bs) };
    charCache.set(key, s); return s;
  }

  /* ---------- monstres ---------- */
  const SLIMES = {
    slime: R(['#1a5226', '#2a8236', '#44ac46', '#72d064', '#ace892', '#e6ffd4']),
    ember: R(['#5e1610', '#9a2c1a', '#d05028', '#ee8636', '#ffbc6a', '#fff0c4']),
    boss: R(['#341656', '#542886', '#7a42b6', '#a068d6', '#caa0ee', '#f2e4ff'])
  };
  function paintSlime(rp) {
    const P = new Pix(16, 14);
    fillEllipse(P, 8, 8.2, 7.4, 5.8, (x, y, nx, ny) => {
      if (y > 12) return null;
      const l = -(nx * 0.55 + ny * 0.83), core = Math.max(0, 1 - Math.hypot(nx, ny + 0.4) * 1.4);
      return ramp(rp, 0.48 + 0.4 * l - core * 0.2, x, y, 0.7);
    });
    for (let x = 2; x <= 13; x++) if (P.a(x, 12)) P.set(x, 13, rp[0]);
    P.set(4, 5, rp[5]); P.set(5, 5, rp[5]); P.set(4, 6, rp[5]); P.set(6, 4, rp[4]); P.set(11, 10, rp[4]);
    P.set(5, 8, EYE); P.set(5, 9, EYE); P.set(10, 8, EYE); P.set(10, 9, EYE); P.set(5, 8, [70, 60, 90]);
    P.set(7, 10, mul(rp[0], 0.8)); P.set(8, 10, mul(rp[0], 0.8));
    P.outline(0.45);
    // transparence gélatineuse
    for (let k = 3; k < P.d.length; k += 4) if (P.d[k] === 255) { const y = Math.floor(k / 4 / P.w); if (y > 3 && y < 12) P.d[k] = 236; }
    return P.done();
  }
  const CAP = R(['#5e2412', '#8e361a', '#c05226', '#e27a36', '#f6a456', '#ffd28a']);
  const STEM = R(['#b4946c', '#d8bc94', '#f0dcb8', '#fff2da']);
  function paintChampi(fr) {
    const P = new Pix(18, 20);
    for (let y = 10; y <= 16; y++) for (let x = 6; x <= 11; x++) P.set(x, y, ramp(STEM, 0.75 - (x - 6) * 0.1 - (y - 10) * 0.03, x, y, 0.5));
    const f1 = fr === 1 ? 1 : 0;
    for (const [x, y] of [[6, 17 - f1], [7, 17 - f1], [10, 17 - (1 - f1) * (fr ? 0 : 0)], [11, 17]]) P.set(x, y, STEM[0]);
    fillEllipse(P, 9, 6.6, 8.3, 5.4, (x, y, nx, ny) => { if (y > 9) return null; const l = -(nx * 0.5 + ny * 0.86); return ramp(CAP, 0.5 + 0.45 * l, x, y, 0.7); });
    for (let x = 2; x <= 15; x++) { P.set(x, 10, rgb('#c9a67a')); if (x > 3 && x < 14) P.set(x, 10, x % 2 ? rgb('#a8865e') : rgb('#c9a67a')); }
    for (const [sx, sy, r] of [[5, 4.5, 1.4], [11.5, 3.2, 1.6], [13.6, 6.6, 1.1], [7.5, 7.5, 1.0]]) fillEllipse(P, sx, sy, r, r * 0.85, (x, y, nx, ny) => ny < 0 ? rgb('#fffaf0') : rgb('#f0dcc4'));
    P.set(7, 12, EYE); P.set(7, 13, EYE); P.set(10, 12, EYE); P.set(10, 13, EYE); P.set(6, 14, BLUSH); P.set(11, 14, BLUSH);
    P.outline(0.42);
    return P.done();
  }
  const CROWN = (() => { const P = new Pix(9, 6); const g = R(['#a87818', '#f2c94c', '#fff0a0']); for (let x = 0; x < 9; x++) { P.set(x, 4, g[1]); P.set(x, 5, g[0]); } for (const x of [0, 4, 8]) { P.set(x, 1, g[2]); P.set(x, 2, g[1]); P.set(x, 3, g[1]); } for (const x of [2, 6]) { P.set(x, 3, g[1]); } P.set(4, 4, rgb('#e8414a')); P.set(1, 4, rgb('#4aa0f0')); P.set(7, 4, rgb('#4aa0f0')); P.outline(0.4); return P.done(); })();

  /* ---------- arbres et végétation ---------- */
  const LEAF = R(['#2c4668', '#2e6266', '#3a8062', '#56a064', '#82be6c', '#b2da84']);
  const PINE = R(['#2a3e62', '#304e64', '#3c6666', '#507e6a', '#6c9a72']);
  const BLOSSOM = R(['#8e5a86', '#b47498', '#d494b0', '#ecb4c6', '#fcd2dc', '#fff2f4']);
  const BARK = R(['#3a2e48', '#504050', '#6a5458', '#846a62', '#a08470']);
  function paintRoundTree(seed, pal) {
    const r = mulberry32(seed), Wd = 36, Ht = 44, P = new Pix(Wd, Ht), c = Wd / 2;
    const tb = Ht - 1;
    for (let y = 26; y <= tb; y++) {
      const flare = y > tb - 3 ? (y - (tb - 3)) : 0;
      for (let x = c - 2 - flare; x <= c + 1 + flare; x++) { const l = (c + 1 + flare - x) / (4 + 2 * flare); P.set(x, y, ramp(BARK, 0.25 + l * 0.6 + (hash(x, y, seed) - 0.5) * 0.2, x, y, 0.6)); }
    }
    const blobs = [{ x: c, y: 15, r: 10.5 }];
    for (let k = 0; k < 6; k++) { const a = r() * Math.PI * 2, d = 5 + r() * 5; blobs.push({ x: c + Math.cos(a) * d * 1.15, y: 15 + Math.sin(a) * d * 0.8, r: 5.5 + r() * 3.5 }); }
    blobs.push({ x: c - 6, y: 22, r: 6 }, { x: c + 6, y: 22, r: 6 });
    for (let y = 0; y < Ht - 8; y++) for (let x = 0; x < Wd; x++) {
      let best = null, bz = -9;
      for (const b of blobs) { const dx = (x + 0.5 - b.x) / b.r, dy = (y + 0.5 - b.y) / b.r, d = dx * dx + dy * dy; if (d <= 1) { const z = b.y * 0.2 + Math.sqrt(1 - d) * 2; if (z > bz) { bz = z; best = [dx, dy, d]; } } }
      if (!best) continue;
      const [dx, dy, d] = best, l = -(dx * 0.6 + dy * 0.8);
      let v = 0.42 + 0.42 * l + (vnoise(x * 0.7, y * 0.7, seed) - 0.5) * 0.3 - (y / Ht) * 0.25;
      if (d > 0.82) v -= 0.18;
      P.set(x, y, ramp(pal, v, x, y));
    }
    if (pal === BLOSSOM) for (let k = 0; k < 14; k++) P.set(4 + r() * (Wd - 8), 4 + r() * 24, BLOSSOM[5]);
    else for (let k = 0; k < 4; k++) { const x = 6 + r() * (Wd - 12) | 0, y = 8 + r() * 16 | 0; if (P.a(x, y)) P.set(x, y, rgb('#e8583a')); }
    P.outline(0.45);
    return P.done();
  }
  function paintPine(seed) {
    const r = mulberry32(seed), Wd = 26, Ht = 46, P = new Pix(Wd, Ht), c = 13;
    for (let y = 36; y < Ht; y++) for (let x = c - 1; x <= c + 1; x++) P.set(x, y, BARK[x === c - 1 ? 3 : 1]);
    const tiers = [[2, 14, 5], [9, 23, 8], [17, 32, 10.5], [25, 40, 12]];
    for (const [y0, y1, w] of tiers) {
      for (let y = y0; y <= y1; y++) {
        const t = (y - y0) / (y1 - y0), hw = 1 + t * w;
        for (let x = Math.round(c - hw); x <= Math.round(c + hw); x++) {
          if (y === y1 && hash(x, y, seed) < 0.5) continue;
          const lx = (x - c) / hw; let v = 0.55 - lx * 0.35 + (1 - t) * 0.2 - (y / Ht) * 0.15 + (hash(x, y, seed + 1) - 0.5) * 0.18;
          P.set(x, y, ramp(PINE, v, x, y));
        }
      }
    }
    void r;
    P.outline(0.45);
    return P.done();
  }
  function paintBush(seed, berries) {
    const r = mulberry32(seed), P = new Pix(20, 14);
    const blobs = [{ x: 10, y: 8, r: 6 }, { x: 5, y: 9, r: 4.5 }, { x: 15, y: 9, r: 4.5 }, { x: 8 + r() * 4, y: 5, r: 4 }];
    for (let y = 0; y < 14; y++) for (let x = 0; x < 20; x++) {
      let best = null, bz = -9; for (const b of blobs) { const dx = (x + .5 - b.x) / b.r, dy = (y + .5 - b.y) / b.r, d = dx * dx + dy * dy; if (d <= 1 && y < 13) { const z = b.y * 0.2 + Math.sqrt(1 - d); if (z > bz) { bz = z; best = [dx, dy, d]; } } }
      if (!best) continue; const [dx, dy, d] = best; let v = 0.42 + 0.4 * -(dx * 0.6 + dy * 0.8) + (hash(x, y, seed) - 0.5) * 0.25; if (d > 0.8) v -= 0.15;
      P.set(x, y, ramp(LEAF, v, x, y));
    }
    if (berries) for (let k = 0; k < 5; k++) { const x = 3 + r() * 14 | 0, y = 4 + r() * 7 | 0; if (P.a(x, y)) { P.set(x, y, rgb('#e83a5a')); P.set(x - 1, y - 1, rgb('#ff9aa8')); } }
    P.outline(0.45);
    return P.done();
  }
  const ROCKR = R(['#4e4a6a', '#646080', '#7c7896', '#9894ae', '#b4b0c6', '#d2cee0']);
  function paintRock(seed) {
    const r = mulberry32(seed), P = new Pix(18, 13);
    fillEllipse(P, 9, 7.5, 8, 5.4, (x, y, nx, ny) => { const facet = Math.floor((nx + 1) * 2.2 + r() * 0.01); const l = -(nx * 0.55 + ny * 0.84); return ramp(ROCKR, 0.45 + 0.45 * l + (facet % 2 ? 0.06 : -0.04) + (hash(x, y, seed) - 0.5) * 0.15, x, y, 0.7); });
    for (let x = 3; x < 15; x++) for (let y = 2; y < 6; y++) if (P.a(x, y) && P.a(x, y - 1) === 0 && hash(x, y, seed + 9) < 0.7) { P.set(x, y, MOSS[2]); if (hash(x, y, seed + 3) < 0.5) P.set(x, y + 1, MOSS[1]); }
    P.outline(0.45);
    return P.done();
  }
  function paintTuft(fr, seed) {
    const P = new Pix(9, 8);
    const blades = [[1, 5], [3, 7], [5, 6], [7, 4], [4, 4]];
    for (const [bx, h] of blades) for (let k = 0; k < h; k++) { const lean = fr ? Math.floor(k / 3) : -Math.floor(k / 4); P.set(bx + lean, 7 - k, k > h - 2 ? GRASS[6] : GRASS[3 + (k % 2)]); }
    void seed;
    return P.done();
  }
  function paintFlowers(seed) {
    const r = mulberry32(seed), P = new Pix(8, 6);
    const cols = R([['#fff8ec', '#ffe066'], ['#ff9ec0', '#ffd6e4'], ['#9ec4ff', '#e0ecff'], ['#ffd34e', '#fff3b0']][Math.floor(r() * 4)]);
    for (let k = 0; k < 4; k++) { const x = 1 + r() * 6 | 0, y = 1 + r() * 3 | 0; P.set(x, y + 1, GRASS[2]); P.set(x, y + 2, GRASS[1]); P.set(x, y, cols[0]); if (r() < 0.5) P.set(x + 1, y, cols[1]); }
    return P.done();
  }
  function paintMiniShroom() { const P = new Pix(5, 5); P.set(1, 1, CAP[3]); P.set(2, 0, CAP[4]); P.set(2, 1, CAP[2]); P.set(3, 1, CAP[2]); P.set(2, 2, STEM[2]); P.set(2, 3, STEM[1]); P.set(2, 1, rgb('#fff8f0')); P.outline(0.45); return P.done(); }
  function paintPebble(seed) { const P = new Pix(5, 3); P.set(1, 1, ROCKR[3]); P.set(2, 1, ROCKR[2]); P.set(2, 0, ROCKR[4]); if (seed % 2) P.set(3, 1, ROCKR[2]); P.outline(0.5); return P.done(); }

  /* ---------- maisons à colombages ---------- */
  const ROOFS = [R(['#5c2018', '#842e22', '#a84430', '#c66244', '#de865a']), R(['#22305a', '#2e4478', '#405e9c', '#5a7cbc', '#7ea0d6']), R(['#283e26', '#36583a', '#4a7448', '#669456', '#88b26c']), R(['#4a2c1c', '#643c26', '#805234', '#9c6a44', '#b88656'])];
  const PLASTER = R(['#b8a07a', '#d2bc94', '#e6d4ae', '#f4e6c6', '#fff4dc']);
  const TIMBER = R(['#2e1a10', '#4a2c1a', '#664024']);
  function paintHouse(v) {
    const Hw = 24, Hr = 20, o = 0.2, ox = 40, oy = 42, P = new Pix(80, 78);
    const pr = (x, y, z) => [ox + (x - y) * 16, oy + (x + y) * 8 - z];
    const roof = ROOFS[v % 4];
    const wallTex = (u, z, lit, side) => {
      if (z < 3.2) { const row = Math.floor(z / 1.6), col = Math.floor(u * 10 + (row % 2) * 0.5); const vv = (lit ? 0.6 : 0.35) + (hash(col, row, 7 + side) - 0.5) * 0.3 - ((z % 1.6) < 0.5 ? 0.25 : 0); return ramp(STONE, vv, Math.floor(u * 32), Math.floor(z)); }
      const fu = u % 1;
      if (z > Hw - 1.6 || fu < 0.06 || fu > 0.94 || Math.abs(z - Hw * 0.55) < 0.55 || z < 4.2) return TIMBER[lit ? 2 : 1];
      const t = (z - 4.2) / (Hw * 0.55 - 4.6);
      if (t > 0 && t < 1 && Math.abs(fu - 0.06 - t * 0.88) < 0.045 && side === 1) return TIMBER[lit ? 2 : 1];
      return ramp(PLASTER, (lit ? 0.66 : 0.4) + (hash(Math.floor(u * 32), Math.floor(z), 3) - 0.5) * 0.12 - (z < 6 ? 0.1 : 0), Math.floor(u * 32), Math.floor(z), 0.5);
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
    const B = (Hr + 2) / (1 + o), A2 = Hw - 2 + o * B;
    fillPoly(P, [pr(-o, -o, Hw - 2), pr(2 + o, -o, Hw - 2), pr(2 + o, 1, Hw + Hr), pr(-o, 1, Hw + Hr)], (x, y) => {
      const a = (x + 0.5 - ox) / 16, yy = (y + 0.5 - oy - 8 * a + A2) / (16 - B), xx = a + yy, s = (yy + o) / (1 + o);
      const row = Math.floor(s * 7), f = s * 7 - row, col = Math.floor(xx * 6 + (row % 2) * 0.5);
      return ramp(roof, 0.42 + (hash(col, row, v) - 0.5) * 0.25 - (f < 0.2 ? 0.22 : 0) + s * 0.1, x, y, 0.6);
    });
    // mur droit (x = 2) + pignon
    fillPoly(P, [pr(2, 0, 0), pr(2, 2, 0), pr(2, 2, Hw), pr(2, 1, Hw + Hr - 1), pr(2, 0, Hw)], (x, y) => {
      const a = (x + 0.5 - ox) / 16, yy = 2 - a, z = oy + (2 + yy) * 8 - (y + 0.5);
      if (z > Hw) { const fu = yy; if (Math.abs(fu - 1) < 0.05 || z > Hw + Hr - 4) return TIMBER[1]; return ramp(PLASTER, 0.42, x, y, 0.5); }
      return windowAt(yy, z, 1) || wallTex(yy, z, false, 0);
    });
    // mur gauche (y = 2) avec porte
    fillPoly(P, [pr(0, 2, 0), pr(2, 2, 0), pr(2, 2, Hw), pr(0, 2, Hw)], (x, y) => {
      const a = (x + 0.5 - ox) / 16, xx = a + 2, z = oy + (xx + 2) * 8 - (y + 0.5);
      if (xx > 0.4 && xx < 0.78 && z < 14) {
        if (xx < 0.45 || xx > 0.73 || (z > 12.8)) return TIMBER[0];
        if (Math.abs(xx - 0.67) < 0.02 && Math.abs(z - 6.5) < 0.6) return GOLD;
        return ramp(R(['#4a2a16', '#6a3e22', '#8a5430']), ((xx * 32) % 3 < 1 ? 0.2 : 0.7), x, y, 0.4);
      }
      return windowAt(xx, z, 1.45) || wallTex(xx, z, true, 1);
    });
    // pan de toit avant
    const A = (Hw - 2) + (2 + o) * B;
    fillPoly(P, [pr(-o, 2 + o, Hw - 2), pr(2 + o, 2 + o, Hw - 2), pr(2 + o, 1, Hw + Hr), pr(-o, 1, Hw + Hr)], (x, y) => {
      const a = (x + 0.5 - ox) / 16, yy = (y + 0.5 - oy - 8 * a + A) / (16 + B), xx = a + yy, s = (2 + o - yy) / (1 + o);
      if (s > 0.94) return roof[4];
      if (s < 0.05) return roof[0];
      const row = Math.floor(s * 8), f = s * 8 - row, col = Math.floor(xx * 7 + (row % 2) * 0.5);
      return ramp(roof, 0.6 + (hash(col, row, v + 5) - 0.5) * 0.28 - (f < 0.22 ? 0.26 : 0) + s * 0.12 - (xx < 0 || xx > 2 ? 0.1 : 0), x, y, 0.6);
    });
    // cheminée
    const cx0 = pr(1.45, 0.55, Hw + Hr - 4);
    for (let y = -9; y <= 0; y++) for (let x = 0; x < 5; x++) P.set(cx0[0] + x, cx0[1] + y, ramp(STONE, x < 2 ? 0.7 : 0.35, x, y, 0.4));
    for (let x = -1; x < 6; x++) P.set(cx0[0] + x, cx0[1] - 10, STONE[1]);
    P.outline(0.4);
    return { img: P.done(), ax: ox, ay: oy, chimney: [cx0[0] + 2, cx0[1] - 12] };
  }
  function paintLamp() {
    const P = new Pix(11, 32), iron = R(['#1e1a26', '#2e2a3a', '#4a4458']);
    for (let y = 9; y < 30; y++) { P.set(5, y, iron[2]); P.set(6, y, iron[0]); }
    for (let x = 3; x <= 8; x++) { P.set(x, 30, iron[x < 6 ? 2 : 1]); P.set(x, 31, iron[0]); }
    for (let x = 4; x <= 7; x++) P.set(x, 29, iron[1]);
    for (let x = 2; x <= 9; x++) { P.set(x, 2, iron[1]); P.set(x, 8, iron[1]); }
    for (let x = 3; x <= 8; x++) P.set(x, 1, iron[2]); P.set(5, 0, iron[2]); P.set(6, 0, iron[1]);
    for (let y = 3; y <= 7; y++) for (let x = 2; x <= 9; x++) P.set(x, y, x === 2 || x === 9 ? iron[1] : (x >= 4 && x <= 7 && y >= 4 && y <= 6) ? rgb('#fff6d0') : rgb('#ffd070'));
    P.outline(0.5);
    return P.done();
  }
  function paintBarrel() {
    const P = new Pix(12, 15), wood = R(['#4a2a16', '#6a3e22', '#8a5430', '#a86c40']), band = R(['#2a2630', '#4a4656']);
    for (let y = 3; y <= 13; y++) { const bulge = (y > 4 && y < 12) ? 1 : 0; for (let x = 1 - bulge; x <= 10 + bulge; x++) { const l = 1 - Math.abs(x - 4) / 7; let c = ramp(wood, l, x, y, 0.5); if (y === 5 || y === 11) c = band[x < 5 ? 1 : 0]; if (x % 3 === 0 && y !== 5 && y !== 11) c = mul(c, 0.85); P.set(x, y, c); } }
    fillEllipse(P, 6, 3, 5, 2, (x, y) => ramp(wood, 0.8, x, y, 0.4));
    P.outline(0.45); return P.done();
  }
  function paintCrate() {
    const P = new Pix(18, 22), wood = R(['#5a3a1e', '#7c5230', '#9c6c40', '#bc8a56']);
    const pr = (x, y, z) => [9 + (x - y) * 8, 11 + (x + y) * 4 - z];
    const s = 10;
    fillPoly(P, [pr(0, 1, 0), pr(1, 1, 0), pr(1, 1, s), pr(0, 1, s)], (x, y) => ramp(wood, (x % 4 === 0 ? 0.35 : 0.7), x, y, 0.4));
    fillPoly(P, [pr(1, 0, 0), pr(1, 1, 0), pr(1, 1, s), pr(1, 0, s)], (x, y) => ramp(wood, (x % 4 === 0 ? 0.15 : 0.42), x, y, 0.4));
    fillPoly(P, [pr(0, 0, s), pr(1, 0, s), pr(1, 1, s), pr(0, 1, s)], (x, y) => ramp(wood, 0.9, x, y, 0.4));
    P.outline(0.45); return P.done();
  }
  function paintFountain(fr) {
    const P = new Pix(40, 36), stone = STONE;
    const cx = 20, cy = 24;
    for (let dz = 6; dz >= 0; dz--) fillEllipse(P, cx, cy + dz, 17, 8.5, (x, y, nx) => dz === 0 ? null : ramp(stone, 0.55 - nx * 0.3 - dz * 0.03 - (dz === 6 ? 0.2 : 0), x, y, 0.6));
    fillEllipse(P, cx, cy, 17, 8.5, (x, y, nx, ny, d) => d > 0.62 ? ramp(stone, 0.85 - nx * 0.2, x, y, 0.5) : null);
    fillEllipse(P, cx, cy + 0.5, 13.4, 6.2, (x, y, nx, ny, d) => { const ring = Math.sin(Math.sqrt(d) * 12 - fr * 2.1); return ramp(WATER, 0.62 + ring * 0.12 + (ny < 0 ? -0.1 : 0.05), x, y, 0.8); });
    for (let y = 9; y <= 24; y++) for (let x = 18; x <= 21; x++) P.set(x, y, ramp(stone, x < 20 ? 0.8 : 0.4, x, y, 0.4));
    fillEllipse(P, 20, 10, 6, 2.4, (x, y, nx) => ramp(stone, 0.75 - nx * 0.3, x, y, 0.4));
    fillEllipse(P, 20, 9.6, 4.4, 1.4, (x, y) => WATER[5]);
    const drops = [[20, 4 - (fr % 2)], [20, 5], [19, 6], [21, 6], [20, 7]];
    for (const [x, y] of drops) P.set(x, y, rgb('#c8f0ff'));
    for (let k = 0; k < 5; k++) { const t = (k + fr * 0.7) % 5; P.set(13 - Math.round(t * 0.6), 11 + Math.round(t * 2.2), rgb('#b4e8ff')); P.set(27 + Math.round(t * 0.6), 11 + Math.round(t * 2.2), rgb('#b4e8ff')); }
    P.outline(0.45);
    return P.done();
  }

  /* ---------- points de cueillette ---------- */
  function paintHerbNode() {
    const P = new Pix(14, 12), lf = R(['#2e5a5e', '#3e7e66', '#5aa06c', '#86c47a']);
    for (const [x0, h, lean] of [[3, 6, -1], [6, 8, 0], [9, 7, 1], [11, 5, 1], [5, 4, -1]]) for (let k = 0; k < h; k++) P.set(x0 + Math.round(lean * k / 4), 11 - k, lf[k > h - 3 ? 3 : 1 + (k % 2)]);
    for (let x = 2; x <= 11; x++) P.set(x, 11, lf[0]);
    const glow = R(['#6aa8e0', '#a8dcff', '#eaf8ff']);
    for (const [cx, cy] of [[6, 3], [9, 4], [3, 5], [11, 6]]) { P.set(cx, cy, glow[2]); P.set(cx - 1, cy, glow[1]); P.set(cx + 1, cy, glow[1]); P.set(cx, cy - 1, glow[1]); P.set(cx, cy + 1, glow[0]); }
    P.outline(0.5); return P.done();
  }
  function paintWoodNode() {
    const P = new Pix(18, 11), bark = R(['#3a2e48', '#504050', '#6a5458', '#846a62', '#a08470']), ring = R(['#c49a6a', '#e0bc88', '#f4dcae']);
    for (let y = 3; y <= 9; y++) for (let x = 2; x <= 14; x++) { const l = 1 - (y - 3) / 7; P.set(x, y, ramp(bark, 0.25 + l * 0.6 + (hash(x, y, 77) - 0.5) * 0.2, x, y, 0.6)); }
    fillEllipse(P, 15, 6, 2.4, 3.6, (x, y, nx, ny, d) => d > 0.55 ? bark[3] : d > 0.25 ? ring[0] : ring[2]);
    for (let x = 3; x <= 13; x++) if (hash(x, 1, 5) < 0.6) { P.set(x, 2, MOSS[2]); if (hash(x, 2, 5) < 0.4) P.set(x, 3, MOSS[1]); }
    const sap = R(['#e8a030', '#ffd060', '#fff4b0']);
    for (const [x, y] of [[5, 6], [6, 5], [9, 7], [10, 6], [12, 5]]) P.set(x, y, sap[(x + y) % 3]);
    P.set(7, 1, rgb('#86c47a')); P.set(8, 0, rgb('#a8dc8a'));
    P.outline(0.5); return P.done();
  }
  function paintQuartzNode() {
    const P = new Pix(15, 15), q = R(['#8a4a7e', '#b8649a', '#e08ab8', '#f6b8d4', '#ffe4f0']);
    const prism = (cx, base, h, w) => { for (let y = base - h; y <= base; y++) { const top = y < base - h + w; const hw = top ? Math.max(0, y - (base - h)) : w; for (let x = cx - hw; x <= cx + hw; x++) P.set(x, y, q[x < cx ? 3 : x === cx ? 4 : 1 + (y % 2)]); } };
    prism(7, 13, 11, 2); prism(3, 13, 6, 1); prism(11, 13, 8, 2);
    for (let x = 1; x <= 13; x++) P.set(x, 14, rgb('#7c7896'));
    P.set(6, 4, q[4]); P.set(6, 5, q[4]); P.set(10, 8, q[4]);
    P.outline(0.5); return P.done();
  }

  /* ---------- icônes d'objets (teintées par objet) ---------- */
  const ICON_SHAPES = {
    sword: ['..........ll', '.........lcl', '........lcl.', '.......lcl..', '......lcl...', '..g..lcl....', '...glcl.....', '....gl......', '...bgg......', '..bb..g.....', '.bb.........', '.b..........'],
    staff: ['........lll.', '.......lcccl', '.......ccccc', '.......cccc.', '........cc..', '.......b....', '......b.....', '.....b......', '....b.......', '...b........', '..b.........', '.b..........'],
    axe: ['....lccc....', '...lcccccc..', '...lcc.ccc..', '....ccccc...', '......b.....', '.....b......', '.....b......', '....b.......', '....b.......', '...b........', '...b........', '..b.........'],
    hood: ['....dddd....', '...dccccd...', '..dcllcccd..', '..dcl..ccd..', '.dcl.ss.ccd.', '.dc.ssss.cd.', '.dc.ssss.cd.', '.dcc....ccd.', '..dccccccd..', '...dddddd...'],
    helm: ['....dddd....', '...dlllcd...', '..dllcccdd..', '..dlcccccd..', '..dcccccdd..', '.dwwwwwwwwd.', '..dc.dd.cd..', '..dc....cd..', '..dd....dd..'],
    crown: ['.g...g...g..', '.gg.ggg.gg..', '.ggggggggg..', '.gcgglggcg..', '.ggggggggg..', '.lccccccccl.', '.cccccccccc.', '..cccccccc..'],
    tunic: ['..dd....dd..', '.dccd..dccd.', 'dcccddddcccd', 'dcllcccccccd', '.dcllccccd..', '..dclcccd...', '..dccgccd...', '..dcccccd...', '..dcccccd...', '..ddddddd...'],
    plate: ['..dd....dd..', '.dwwd..dwwd.', 'dcccddddcccd', 'dcwwcccccccd', '.dcwwccccd..', '..dcwcccd...', '..dccgccd...', '..dwwwwwd...', '..dcccccd...', '..ddddddd...'],
    pants: ['...dddddd...', '...dlcccd...', '...dlccccd..', '...dcccccd..', '...dcd.dcd..', '...dcd.dcd..', '...dcd.dcd..', '...dcd.dcd..', '..dddd.dddd.'],
    boots: ['....ddd.....', '....dld.....', '....dcd.....', '....dlcd....', '....dccd....', '...dcccdd...', '..dccccccd..', '..dddddddd..'],
    spore: ['....dddd....', '...dlllcd...', '..dlwlcccd..', '..dllccccd..', '..dccclccd..', '..dcccccld..', '...dcccdd...', '....dddd....'],
    amulet: ['..dddddd....', '.d......d...', '.d......d...', '..d....d....', '...d..d.....', '....gg......', '...gllg.....', '...glccg....', '...gcccg....', '....ggg.....'],
    bow: ['...bb.......', '..b..bl.....', '.b....l.....', 'b.....l.....', 'b..wwwwwwwy.', 'b.....l.....', '.b....l.....', '..b..bl.....', '...bb.......'],
    shard: ['.....l......', '....lcd.....', '....lcd.....', '...lccd.....', '...lccdd....', '..lcccccd...', '..lccccd....', '...lccd.....', '....dd......', '..gggggg....']
  };
  const iconCache = new Map();
  function itemIcon(kind, color) {
    const key = kind + color; let c = iconCache.get(key); if (c) return c;
    const base = rgb(color), pal = { c: base, l: mix(base, [255, 255, 255], 0.5), d: mul(base, 0.55), w: rgb('#e8e8f0'), g: rgb('#f2c94c'), b: rgb('#7a5030'), s: rgb('#3a2e48') };
    const rows = ICON_SHAPES[kind] || ICON_SHAPES.sword, P = new Pix(14, 14);
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const col = pal[r[x]]; if (col) P.set(x + 1, y + 1 + Math.floor((12 - rows.length) / 2), col); } });
    P.outline(0.45);
    c = P.done(); iconCache.set(key, c); return c;
  }

  /* ---------- icônes UI ---------- */
  function icon(rows, pal) { const h = rows.length, w = rows[0].length, P = new Pix(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = pal[rows[y][x]]; if (c) P.set(x, y, rgb(c)); } return P.done(); }
  const ICONS = {
    sword: icon(['..........ww', '.........wWw', '........wWw.', '.......wWw..', '......wWw...', '..b..wWw....', '...bwWw.....', '....bw......', '...gbb......', '..gg..b.....', '.gg.........', '.g..........'], { w: '#8a90a8', W: '#eef2ff', b: '#6a4428', g: '#f2c94c' }),
    spin: icon(['....yyyy....', '..yy....yY..', '.y.......YY.', 'y.........Y.', 'y...ww......', 'y..wWWw.....', '...wWWw..y..', '....ww...y..', '.Y.......y..', '.YY.....y...', '..Yy..yy....', '....yyy.....'], { y: '#f2c94c', Y: '#fff0a0', w: '#8a90a8', W: '#eef2ff' }),
    potion: icon(['....kk....', '....cc....', '....cc....', '...rrrr...', '..rRRrrr..', '.rRrrrrrr.', '.rrrrrrrr.', '.rrrrrrrd.', '..rrrrrd..', '...dddd...'], { k: '#8a5430', c: '#d8e0f0', r: '#e8414a', R: '#ffb0b8', d: '#9a1a2a' }),
    coin: icon(['.yyy.', 'yYyyd', 'yyYyd', 'yyyyd', '.ddd.'], { y: '#f2c94c', Y: '#fff0a0', d: '#a87818' }),
    ether: icon(['..w..', '.wbb.', 'wWbbd', 'wbbbd', '.ddd.'], { w: '#a8dcff', W: '#ffffff', b: '#6aa8e0', d: '#3a6ab0' }),
    bag: icon(['...ddd...', '..d...d..', '.dccccccd', 'dcllccccd', 'dclcccccd', 'dcccggccd', 'dcccggccd', 'dcccccccd', '.ddddddd.'], { c: '#c08a52', l: '#e8b878', d: '#6a4428', g: '#f2c94c' }),
    a_slash: icon(['.........ww', '........wWw', '.......wWw.', '......wWw..', '.y...wWw...', '..y.wWw....', '...yWw.....', '...byy.....', '..bb..y....', '.bb........', 'b..........'], { w: '#b8c0d8', W: '#ffffff', y: '#f2c94c', b: '#7a5030' }),
    a_spin: icon(['....yyyy....', '..yy....yY..', '.y.......YY.', 'y.........Y.', 'y...ww......', 'y..wWWw.....', '...wWWw..y..', '....ww...y..', '.Y.......y..', '.YY.....y...', '..Yy..yy....', '....yyy.....'], { y: '#f2c94c', Y: '#fff0a0', w: '#8a90a8', W: '#eef2ff' }),
    a_charge: icon(['......yy....', '.......yy...', 'ww.yyyyyyy..', '...yyyyyyyy.', 'ww.yyyyyyy..', '.......yy...', '......yy....'], { y: '#ffd060', w: '#fff4c0' }),
    a_shout: icon(['.r.....w....', 'rrr...w..w..', 'rrRr.w..w..w', 'rrRr.w..w..w', 'rrr...w..w..', '.r.....w....'], { r: '#e8504a', R: '#ffb0a0', w: '#fff0c0' }),
    a_bow: icon(['..bb.......', '.b..l......', 'b...l......', 'b..ywwwwwW.', 'b...l......', '.b..l......', '..bb.......'], { b: '#ffd08a', l: '#ffffff', w: '#f4ead8', W: '#ffffff', y: '#b4f090' }),
    a_volley: icon(['W....W....W', '.w....w....w', '..w....w....', '...y....y...', 'W....W....W.', '.w....w.....', '..y....y....'], { w: '#d8d0c0', W: '#ffffff', y: '#9ad07a' }),
    a_pierce: icon(['............', 'c..........W', 'cc.wwwwwwwWW', 'c..........W', '............'], { w: '#ffffff', W: '#ffffff', c: '#a8e0ff' }),
    a_rain: icon(['..cccccc....', '.cCCCcccc...', 'cccccccccc..', '.cccccccc...', '..W..W..W...', '.W..W..W....', 'W..W..W.....'], { c: '#7a8ab8', C: '#c8d4f0', W: '#bfe6ff' }),
    a_bolt: icon(['....cc....', '...cWWc...', '..cWWWWc..', '..cWWWWc..', '...cWWc...', '..c.cc.c..', '.c......c.'], { c: '#7ec4ee', W: '#e8f8ff' }),
    a_frost: icon(['.....w.....', '..w..w..w..', '...w.w.w...', '....www....', 'wwwwwWwwwww', '....www....', '...w.w.w...', '..w..w..w..', '.....w.....'], { w: '#a8dcff', W: '#ffffff' }),
    a_fire: icon(['....r.....', '...rr..r..', '..rrr.rr..', '..royrrr..', '.rooyyor..', '.royyyyor.', '.royWWyor.', '..ryWWyr..', '...rrrr...'], { r: '#d8402a', o: '#f08a3a', y: '#ffd060', W: '#fff4c0' }),
    a_heal: icon(['...gggg...', '...gWWg...', 'ggggWWgggg', 'gWWWWWWWWg', 'gWWWWWWWWg', 'ggggWWgggg', '...gWWg...', '...gggg...'], { g: '#4aa04a', W: '#c8f0a0' }),
    chat: icon(['.wwwwwww.', 'wwwwwwwww', 'w.w.w.w.w', 'wwwwwwwww', '.wwwwwww.', '..ww.....', '.w.......'], { w: '#f4ead8' })
  };

  function buildAll(W) {
    const t0 = performance.now();
    const terrain = buildTerrain(W);
    const trees = {
      oak: [11, 12, 13].map(s => paintRoundTree(s, LEAF)),
      blossom: [21, 22, 23].map(s => paintRoundTree(s, BLOSSOM)),
      pine: [31, 32, 33].map(s => paintPine(s)),
      bush: [41, 42, 43].map((s, i) => paintBush(s, i === 1)),
      rock: [51, 52, 53].map(s => paintRock(s))
    };
    const art = {
      terrain, trees, cloud: cloudTexture(),
      slime: paintSlime(SLIMES.slime), ember: paintSlime(SLIMES.ember), boss: paintSlime(SLIMES.boss),
      champi: [paintChampi(0), paintChampi(1)], crown: CROWN,
      houses: [0, 1, 2, 3].map(paintHouse), lamp: paintLamp(), barrel: paintBarrel(), crate: paintCrate(),
      fountain: [0, 1, 2].map(paintFountain),
      tuft: [paintTuft(0), paintTuft(1)], flowers: [1, 2, 3, 4, 5, 6].map(paintFlowers), mini: paintMiniShroom(), pebble: [paintPebble(1), paintPebble(2)],
      icons: ICONS, charSet, nodes: { herb: paintHerbNode(), wood: paintWoodNode(), quartz: paintQuartzNode() },
      slimeLight: { slime: SLIMES.slime[4], ember: SLIMES.ember[4], boss: SLIMES.boss[4], champi: CAP[4] }
    };
    art.buildMs = Math.round(performance.now() - t0);
    return art;
  }
  window.EtheriaArt = { buildAll, itemIcon, charSet, paintChibi, TUNICS, HAIRS, SKINS };
})();
