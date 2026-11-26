/* Pixels Worlds — client, render.js : Rendu du monde en 2.5D : tuiles, entités, effets, lumière, obscurité des donjons.
   Les fichiers de client/game/ se partagent leurs déclarations (scripts classiques chargés dans l'ordre par persist.js,
   voir GAME_FILES) : une fonction ou une variable d'un fichier sert aux suivants. */
'use strict';
/* ---------- rendu du monde ---------- */
const DYN = Array.from({ length: NB }, () => []);
function drawTile(i, j, ox, oy, wf) {
  const k = idx(i, j),
    h = HT[k],
    x = ox + (i - j) * 16 - 16,
    yb = oy + (i + j) * 8;
  if (x > VW || x < -32 || yb - h * 8 > VH || yb + 26 < 0) return;
  if (TY[k] === 0) {
    if (DGN) return;
    g.drawImage(ART.terrain.water[k][wf], x, yb + 4);
    if (DECK[k]) g.drawImage(ART.deck[DECK[k]], x, yb - 3);
    return;
  }
  if (DGN && h && i + j > me.x + me.y - 0.5 && i + j < me.x + me.y + 4 && Math.abs(i - j - (me.x - me.y)) < 3.5) {
    g.globalAlpha = 0.3;
    g.drawImage(ART.terrain.land[k], x, yb - h * 8);
    g.globalAlpha = 1;
    return;
  } // donjon : on voit le héros à travers les murs devant lui
  g.drawImage(ART.terrain.land[k], x, yb - h * 8);
  if (TRAPS[k] != null) g.drawImage(ART.dgn.spikes[C.trapUp(simNow(), TRAPS[k]) ? 1 : 0], x, yb - 6);
}
const simNow = () => simT + (time - simT0); // horloge de la simulation, extrapolée entre deux états
function drawSlash(cx, cy, ang, prog, r) {
  r = r || 10;
  const n = 12,
    span = 2.4 * Math.min(1, prog * 1.6);
  for (let i = 0; i <= n; i++) {
    const a = ang - 1.2 + (span * i) / n;
    g.fillStyle = '#fffbe0';
    g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.7), 1, 1);
    g.fillStyle = 'rgba(255,210,80,.8)';
    g.fillRect(Math.round(cx + Math.cos(a) * (r + 1)), Math.round(cy + Math.sin(a) * (r + 1) * 0.7), 1, 1);
    g.fillStyle = 'rgba(255,255,255,.5)';
    g.fillRect(Math.round(cx + Math.cos(a) * (r - 1)), Math.round(cy + Math.sin(a) * (r - 1) * 0.7), 1, 1);
  }
}
function drawScarf(e, sx, sy, ck) {
  ck = ck || 1;
  let dx = -(e.svx || 0),
    dy = -(e.svy || 0);
  const sp = Math.hypot(dx, dy);
  if (sp < 6) {
    dx = e.face === 'side' && !e.flip ? -1 : 1;
    dy = 0.15 + Math.sin(time * 1.3 + (e.bph || 0)) * 0.25;
  } else {
    dx /= sp;
    dy /= sp;
  }
  const m = Math.hypot(dx, dy);
  dx /= m;
  dy /= m;
  const side = dx >= 0 ? 1 : -1,
    ny = sy - Math.round(11.5 * ck);
  // nœud autour du cou
  const SCc = C.SCARVES[e.scarf || 0] || C.SCARVES[0];
  if (e.face !== 'back') {
    g.fillStyle = SCc[0];
    g.fillRect(sx - 2 * ck, ny, 4 * ck, 1);
    g.fillStyle = SCc[1];
    g.fillRect(sx - 2 * ck, ny, 2 * ck, 1);
  } else {
    g.fillStyle = SCc[2];
    g.fillRect(sx - 2 * ck, ny, 4 * ck, 1);
  }
  const L = 8 + Math.min(5, sp / 8),
    ax = sx + side * Math.round(3 * ck),
    ay = ny + 1;
  for (let k = 0; k <= L; k++) {
    const wave = Math.sin(time * 9 - k * 0.75 + (e.bph || 0)) * k * 0.14;
    const x = sx + Math.round(ax - sx + dx * k - dy * wave),
      y = sy + Math.round(ay - sy + dy * k * 0.7 + dx * wave * side + k * 0.15);
    g.fillStyle = k > L - 2 ? SCc[2] : SCc[0];
    g.fillRect(x, y, 1, 2);
    if (k % 3 === 0) {
      g.fillStyle = SCc[1];
      g.fillRect(x, y, 1, 1);
    }
    if (e.scarf === 2 && (time * 4 + k) % 5 < 0.4) {
      g.fillStyle = '#ffffff';
      g.fillRect(x, y - 1, 1, 1);
    }
  }
}
function frameOf(e, set) {
  set = set || e.set;
  const f = Math.floor(e.anim) % set.front.length;
  if (e.atkT > 0 && set.atk) {
    const ph = e.atkT > ATK_STRIKE ? 0 : e.atkT > ATK_RECOVER ? 1 : 2;
    return e.face === 'side' ? (e.flip ? set.atk.sideL : set.atk.side)[ph] : set.atk[e.face][ph];
  }
  if (!e.moving && set.blinkF && (time + (e.bph || e.x)) % 3.4 < 0.14) {
    if (e.face === 'front') return set.blinkF;
    if (e.face === 'side') return e.flip ? set.blinkSL : set.blinkS;
  }
  if (e.face === 'side') return (e.flip ? set.sideL : set.side)[f];
  return set[e.face][f];
}
// silhouette blanche d'une image (flash quand on est touché), mise en cache
const WHITE = new WeakMap();
function whiteOf(img) {
  let c = WHITE.get(img);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, c.width, c.height);
  WHITE.set(img, c);
  return c;
}
function drawEntity(e, ox, oy) {
  const fine = e.kind === 'char' || e.kind === 'npc' || e.kind === 'mob',
    snap = v => (fine ? Math.round(v * RQ) / RQ : Math.round(v));
  const sx = snap(ox + (e.x - e.y) * 16),
    sy = snap(oy + (e.x + e.y) * 8 - e.z * 8);
  if (sx < -50 || sx > VW + 50 || sy < -12 || sy > VH + 90) return;
  switch (e.kind) {
    case 'decor': {
      const img = e.anim ? e.anim[Math.floor(time * 1.6 + e.ph) % 2] : e.img;
      g.drawImage(img, sx - (img.width >> 1), sy - img.height + 2);
      return;
    }
    case 'img': {
      if (e.shadow) g.drawImage(SHADOW, sx - 8 * e.shadow, sy - 2 * e.shadow, 16 * e.shadow, 6 * e.shadow);
      if (e.sway) {
        const sw = Math.sin(time * 1.3 + e.x * 0.7 + e.y) > 0.6 ? 1 : 0;
        g.drawImage(
          e.img,
          0,
          0,
          e.img.width,
          e.img.height - 12,
          sx - (e.img.width >> 1) + sw,
          sy - e.img.height + e.dy,
          e.img.width,
          e.img.height - 12
        );
        g.drawImage(e.img, 0, e.img.height - 12, e.img.width, 12, sx - (e.img.width >> 1), sy - 12 + e.dy, e.img.width, 12);
      } else g.drawImage(e.img, sx - (e.img.width >> 1), sy - e.img.height + e.dy);
      return;
    }
    case 'house': {
      const h = e.h,
        ax = Math.round(ox + (e.i - e.j) * 16),
        ay = Math.round(oy + (e.i + e.j) * 8 - e.z * 8);
      g.drawImage(h.img, ax - h.ax, ay - h.ay);
      return;
    }
    case 'foot': {
      const a = 1 - e.t / 2.6;
      g.globalAlpha = Math.min(1, a * 1.4);
      g.fillStyle = '#6a4ab8';
      g.fillRect(sx - 2, sy - 2, 5, 4);
      g.fillStyle = '#0c0618';
      g.fillRect(sx - 1, sy - 1, 3, 2);
      g.fillStyle = '#2a1648';
      g.fillRect(sx - 1, sy - 2, 3, 1);
      if ((e.t * 5 + e.x * 7) % 3 < 0.4) {
        g.fillStyle = '#b08ae8';
        g.fillRect(sx, sy - 1, 1, 1);
      }
      g.globalAlpha = 1;
      return;
    }
    case 'node': {
      const img = ART.nodes[e.res],
        ready = (nodeCd[e.k] || 0) < time,
        ok = me.glvl >= C.RES[e.res].req;
      g.globalAlpha = ready ? 1 : 0.35;
      g.drawImage(SHADOW, sx - 6, sy - 2, 12, 4);
      g.drawImage(img, sx - (img.width >> 1), sy - img.height + 2);
      g.globalAlpha = 1;
      if (ready && mode === 'play' && (time * 2 + e.k * 0.37) % 1.6 < 0.3) {
        g.fillStyle = ok ? '#ffffff' : '#c8c0d8';
        g.fillRect(sx - 4 + ((e.k * 7) % 9), sy - img.height - 1 + ((e.k * 3) % 5), 1, 1);
      }
      return;
    }
    case 'fountain': {
      const f = ART.fountain[Math.floor(time * 5) % 3];
      g.drawImage(SHADOW, sx - 18, sy - 2, 36, 9);
      g.drawImage(f, sx - 20, sy - 30);
      return;
    }
    case 'mob':
      return drawMob(e, sx, sy);
    case 'bpost': {
      // poteau à lanterne + corde vers le poteau précédent (lanterne qui vacille)
      const [c1, c2] = e.glow;
      if (e.prev) {
        const px = Math.round(ox + (e.prev.x - e.prev.y) * 16),
          py = Math.round(oy + (e.prev.x + e.prev.y) * 8);
        for (let t = 1; t < 16; t++) {
          const u2 = t / 16;
          g.fillStyle = e.near ? '#d8c090' : '#a08860';
          g.fillRect(Math.round(px + (sx - px) * u2), Math.round(py + (sy - py) * u2 - 10 + Math.sin(u2 * Math.PI) * 2), 1, 1);
        }
      }
      g.fillStyle = '#5e3820';
      g.fillRect(sx, sy - 12, 1, 10);
      g.fillStyle = e.near ? '#8a5630' : '#3a2014';
      g.fillRect(sx + 1, sy - 12, 1, 10);
      const fl = 0.75 + 0.25 * Math.sin(time * 6 + e.ph);
      g.globalAlpha = 0.35 * fl;
      g.drawImage(GLOW, sx - 6, sy - 20, 13, 13);
      g.globalAlpha = 1;
      g.fillStyle = c2;
      g.fillRect(sx - 1, sy - 16, 4, 3);
      g.fillStyle = c1;
      g.fillRect(sx, sy - 15, 2, 1);
      return;
    }
    case 'barch': {
      const img = e.frames[Math.floor(time * 5) % 4];
      if (e.flip) {
        g.save();
        g.translate(sx, 0);
        g.scale(-1, 1);
        g.drawImage(img, -11, sy - 33);
        g.restore();
      } else g.drawImage(img, sx - 11, sy - 33);
      return;
    }
    case 'corpse': {
      const ic = ART.icons.bag;
      g.drawImage(SHADOW, sx - 7, sy - 3, 14, 5);
      g.drawImage(ic, sx - (ic.width >> 1), sy - ic.height);
      if ((time * 2 + e.id) % 1.6 < 0.3) {
        g.fillStyle = '#fff6c0';
        g.fillRect(sx + 3, sy - ic.height - 2, 1, 1);
      }
      labels.push({ x: sx, y: sy - ic.height - 2, t: 'Corps de ' + e.name, corpse: 1 });
      return;
    }
    case 'torch': {
      const img = ART.dgn.torch[Math.floor(time * 6 + e.ph) % 2];
      g.drawImage(img, e.side === 'x' ? sx + 2 : sx - 9, sy - 22);
      return;
    }
    case 'dexit': {
      if (mobs[W.dg.bossK].alive) return;
      const img = e.frames[Math.floor(time * 5) % 4];
      g.drawImage(img, sx - 11, sy - 33);
      return;
    }
    case 'gate': {
      const d = ISLE_DG,
        off = !d || d[2],
        img = off ? ART.dgn.gateOff : ART.dgn.gate[d[0]][Math.floor(time * 5) % 4];
      g.drawImage(img, sx - 36, sy - 66);
      return;
    }
    case 'chest': {
      g.drawImage(SHADOW, sx - 8, sy - 3, 16, 5);
      g.drawImage(ART.chest[chestOpen ? 1 : 0], sx - 8, sy - 13);
      if (!chestOpen && (time * 2) % 1.4 < 0.3) {
        g.fillStyle = '#fff6c0';
        g.fillRect(sx + 3, sy - 15, 1, 1);
      }
      return;
    }
    default:
      return drawChar(e, sx, sy);
  }
}
// ck = même échelle exprimée comme l'ancien facteur (~1,2) pour les effets placés autour du héros.
// 3 pixels d'écran par pixel de personnage quel que soit le recul de la caméra : le héros et son armure restent lisibles
function charP() {
  return Math.max(1, Math.round((3 * RQ) / S)) / RQ;
}
function drawChar(e, sx, sy) {
  if (!e.set) return;
  const p = charP(),
    ck = p * 2,
    cs = e.set,
    dw = cs.w * p,
    dh = cs.h * p,
    dx0 = sx - cs.cx * p,
    dy0 = sy - cs.foot * p;
  if (e.dead) {
    g.globalAlpha = 0.45;
    g.drawImage(cs.front[0], dx0, dy0, dw, dh);
    g.globalAlpha = 1;
    labels.push({ x: sx, y: sy - 34 * ck, t: e.name, c: '#a8a8b8' });
    return;
  }
  g.drawImage(SHADOW, sx - 7 * ck, sy - 3, 14 * ck, 5);
  const scarf = e.kind !== 'npc';
  const bob = e.moving && Math.floor(e.anim) % 4 === 2 ? -p : 0;
  if (e === me && me.stealth) g.globalAlpha = 0.45;
  {
    const im = frameOf(e, cs);
    g.drawImage(im, dx0, dy0 + bob, dw, dh);
    if (e.hitFlash > 0) {
      g.globalAlpha = Math.min(1, e.hitFlash / 0.18) * 0.7;
      g.drawImage(whiteOf(im), dx0, dy0 + bob, dw, dh);
      g.globalAlpha = 1;
    }
  }
  g.globalAlpha = 1;
  if (e === me && me.pburn)
    for (let k = 0; k < 3; k++) {
      const ph = (time * 2.4 + k * 0.33) % 1;
      g.fillStyle = ph < 0.5 ? '#ffd060' : '#ff7a3a';
      g.fillRect(Math.round(sx - 4 * ck + k * 4 * ck), Math.round(sy - 6 * ck - ph * 12), 1, 2);
    }
  if (e === me && me.pslow && Math.floor(time * 5) % 2) {
    g.fillStyle = '#a8dcff';
    g.fillRect(Math.round(sx - 6 * ck), Math.round(sy - 4), 1, 1);
    g.fillRect(Math.round(sx + 6 * ck), Math.round(sy - 6), 1, 1);
  }
  if (e === me && me.shield > 0)
    for (let k = 0; k < 10; k++) {
      const a = time * 2 + k * 0.63;
      g.fillStyle = k % 2 ? '#bfe6ff' : '#ffffff';
      g.fillRect(Math.round(sx + Math.cos(a) * 10 * ck), Math.round(sy - 12 * ck + Math.sin(a) * 4 * ck), 1, 1);
    }
  if (e.set.glint && (time * 1.7 + (e.x || 0)) % 2.2 < 0.25) {
    const s2 = e.face === 'front' || (e.face === 'side' && e.flip) ? -1 : 1,
      gx = Math.round(sx + s2 * 9 * ck),
      gy = Math.round(sy - 17 * ck + bob);
    g.fillStyle = e.set.glint;
    g.fillRect(gx - 1, gy, 3, 1);
    g.fillRect(gx, gy - 1, 1, 3);
    g.fillStyle = '#ffffff';
    g.fillRect(gx, gy, 1, 1);
  }
  if (scarf && e.set) drawScarf(e, sx, sy + bob, ck);
  if (cs.gm)
    for (let k = 0; k < 3; k++) {
      const a = time * 1.6 + k * 2.09 + (e.x || 0),
        r = 9 * ck,
        y0 = sy - 14 * ck + Math.sin(time * 2.2 + k * 1.7) * 6 * ck;
      g.fillStyle = k === 1 ? '#ffffff' : '#ffe070';
      g.globalAlpha = 0.55 + 0.45 * Math.sin(time * 5 + k);
      g.fillRect(Math.round(sx + Math.cos(a) * r), Math.round(y0), 1, 1);
      g.globalAlpha = 1;
    }
  if (e === me && me.buff > 0)
    for (let k = 0; k < 4; k++) {
      const a = time * 4 + k * 1.57;
      g.fillStyle = k % 2 ? '#ff9a6a' : '#ffd060';
      g.fillRect(Math.round(sx + Math.cos(a) * 8), Math.round(sy - 10 + Math.sin(a) * 4), 1, 1);
    }
  if (e.slash > 0) drawSlash(sx, sy - 11 * ck, e.slashAng, 1 - e.slash / 0.18);
  if (e.spin > 0) {
    const pr = 1 - e.spin / 0.35;
    for (let k = 0; k < 3; k++) drawSlash(sx, sy - 8, time * 18 + k * 2.09, 1, 11 + pr * 14);
  }
  if (e.kind === 'npc') {
    labels.push({ x: sx, y: sy - 35 * ck, t: e.name, c: '#ffe27a', npc: e });
    return;
  }
  const tti = e === me ? me.tt : e.tt;
  labels.push({
    x: sx,
    y: sy - 35 * ck,
    ttl: tti >= 0 && C.TITLES[tti] ? C.TITLES[tti][1] : '',
    t: e === me ? me.name : e.name,
    c: cs.gm ? '#ffe070' : e === me ? '#a8f080' : PVP ? '#ff9a8a' : '#cfe4ff',
    lv: e === me ? null : e.lvl,
    php: PVP && e !== me && e.maxhp ? e.hp / e.maxhp : null,
    tgt: me.target === e
  });
}
function drawMob(m, sx, sy) {
  const sc = m.scale;
  let lx = 0,
    ly = 0;
  if (m.lunge > 0 && mode === 'play') {
    const a = screenAng(m, me),
      k = Math.sin((1 - m.lunge / 0.15) * Math.PI);
    lx = Math.round(Math.cos(a) * 3 * k);
    ly = Math.round(Math.sin(a) * 2 * k);
  }
  if (m.elite || m.dgBoss != null) {
    const col = m.dgBoss != null ? C.dgTier(m.dgBoss).c : DGN ? DGN.c : '#c47cff',
      pu = 0.5 + 0.2 * Math.sin(time * 4 + m.phase);
    g.fillStyle = col;
    for (let a = 0; a < 24; a++) {
      const t = (a / 24) * TAU + time;
      if ((a + Math.floor(time * 6)) % 3 === 0) continue;
      g.globalAlpha = pu;
      g.fillRect(Math.round(sx + Math.cos(t) * 9 * sc), Math.round(sy - 1 + Math.sin(t) * 3.5 * sc), 1, 1);
    }
    g.globalAlpha = 1;
  }
  g.drawImage(SHADOW, sx - 7 * sc, sy - 3 * sc, 14 * sc, 5 * sc);
  const fl = m.hitFlash > 0 ? Math.min(1, m.hitFlash / 0.15) * 0.75 : 0;
  const dImg = (im, ...a) => {
    g.drawImage(im, ...a);
    if (fl) {
      g.globalAlpha = fl;
      g.drawImage(whiteOf(im), ...a);
      g.globalAlpha = 1;
    }
  };
  let top;
  const bi = m.dgBoss != null ? m.dgBoss : m.type === 'boss' ? 0 : -1;
  if (bi >= 0) {
    // boss : dessin propre (2 images, il respire ; immobile et tremblant pendant une attaque annoncée)
    const cast = TELE.find(t => t.m === m.k && t.until > time),
      fr = Math.floor(time * (cast ? 8 : 1.6) + m.phase) % 2,
      img = ART.bosses[bi][fr];
    const w = img.width,
      h = img.height,
      jit = cast ? Math.round(Math.sin(time * 60)) : 0;
    if (m.flip) {
      g.save();
      g.translate(sx + lx + jit, 0);
      g.scale(-1, 1);
      dImg(img, -(w >> 1), sy - h + 2 + ly);
      g.restore();
    } else dImg(img, sx - (w >> 1) + lx + jit, sy - h + 2 + ly);
    top = sy - h;
  } else if (ART.mobs[m.type]) {
    // bestiaire : 2 images (marche ou battement d'ailes), regard vers la cible ; les volants flottent
    const fly = ART.floaters[m.type],
      fr = Math.floor(time * (fly ? 6 : m.moving ? 7 : 1.5) + m.phase) % 2,
      img = ART.mobs[m.type][fr],
      sc2 = m.scale || 1;
    const w = Math.round(img.width * sc2),
      h = Math.round(img.height * sc2),
      bob = fly ? Math.round(Math.sin(time * 3 + m.phase) * 1.5) - 3 : 0;
    if (m.flip) {
      g.save();
      g.translate(sx + lx, 0);
      g.scale(-1, 1);
      dImg(img, -(w >> 1), sy - h + 1 + bob + ly, w, h);
      g.restore();
    } else dImg(img, sx - (w >> 1) + lx, sy - h + 1 + bob + ly, w, h);
    top = sy - h + bob;
    if (m.dgBoss != null) {
      g.drawImage(ART.crown, sx - 9 + lx, top - 10 + ly, 18, 12);
      top -= 10;
    }
  } else if (m.type === 'champi') {
    const img = ART.champi[m.moving ? Math.floor(time * 6) % 2 : 0],
      bob = m.moving ? (Math.abs(Math.sin(time * 9 + m.phase)) * -1.5) | 0 : 0;
    if (m.flip) {
      g.save();
      g.translate(sx + lx, 0);
      g.scale(-1, 1);
      dImg(img, -9, sy - 19 + bob + ly);
      g.restore();
    } else dImg(img, sx - 9 + lx, sy - 19 + bob + ly);
    top = sy - 20;
  } else {
    const img = ART[m.type],
      hop = m.moving ? Math.abs(Math.sin(time * 7 + m.phase)) : 0,
      sq = 1 + Math.sin(time * 6 + m.phase) * 0.08 * (m.moving || m.aggro ? 1.6 : 1) + hop * 0.08;
    ly -= Math.round(hop * 3 * sc);
    const w = Math.round(16 * sc * (2 - sq)),
      h = Math.round(14 * sc * sq);
    dImg(img, sx - (w >> 1) + lx, sy - h + 2 + ly, w, h);
    if (m.type === 'boss') g.drawImage(ART.crown, sx - 9 + lx, sy - h - 8 + ly, 18, 12);
    top = sy - h - (m.type === 'boss' ? 8 : 0);
  }
  if (m.status === 1)
    for (let k = 0; k < 3; k++) {
      const a = time * 5 + k * 2.09;
      g.fillStyle = k % 2 ? '#fff0a0' : '#ffd060';
      g.fillRect(Math.round(sx + Math.cos(a) * 6), Math.round(top - 2 + Math.sin(a) * 2), 1, 1);
    }
  else if (m.status === 4)
    for (let k = 0; k < 2; k++) {
      const ph = (time * 1.6 + k * 0.5) % 1;
      g.fillStyle = '#d02a3a';
      g.fillRect(Math.round(sx - 2 + k * 4), Math.round(sy - 8 + ph * 8), 1, ph < 0.6 ? 2 : 1);
    }
  else if (m.status === 3)
    for (let k = 0; k < 3; k++) {
      const ph = (time * 2.2 + k * 0.33) % 1;
      g.fillStyle = ph < 0.5 ? '#ffd060' : '#ff7a3a';
      g.fillRect(Math.round(sx - 4 + k * 4 + Math.sin(time * 9 + k) * 1), Math.round(sy - 4 - ph * 10), 1, ph < 0.3 ? 2 : 1);
    }
  else if (m.status === 2 && Math.floor(time * 6) % 2) {
    g.fillStyle = '#a8dcff';
    g.fillRect(sx - 4, sy - 3, 1, 1);
    g.fillRect(sx + 3, sy - 5, 1, 1);
  }
  labels.push({ x: sx, y: top - 4, hp: m.hp < m.maxhp ? m.hp / m.maxhp : null, w: 16 * sc, mob: m });
}
function render() {
  labels.length = 0;
  g.setTransform(RQ, 0, 0, RQ, 0, 0);
  g.drawImage(BACKDROP, 0, 0);
  // (reflets de nuages sur la mer retirés : coûteux sur mobile)
  const shx = shake > 0 ? Math.round(Math.sin(time * 55) * shake * 7) : 0,
    shy = shake > 0 ? Math.round(Math.cos(time * 47) * shake * 5) : 0;
  const fx = VW / 2 - camX + shx,
    fy = VH / 2 - camY + shy,
    ox = Math.floor(fx),
    oy = Math.floor(fy);
  lastOX = ox;
  lastOY = oy;
  SUBX = Math.round((fx - ox) * RQ);
  SUBY = Math.round((fy - oy) * RQ);
  g.setTransform(RQ, 0, 0, RQ, SUBX, SUBY);
  g.imageSmoothingEnabled = false;
  for (const b of DYN) b.length = 0;
  const push = e => DYN[clamp(Math.floor(e.x + e.y), 0, NB - 1)].push(e);
  for (const m of mobs)
    if (m.alive) {
      m.kind = 'mob';
      push(m);
    }
  for (const o of others.values()) {
    o.kind = 'char';
    push(o);
  }
  for (const n of NPCS) push(n);
  for (const n of NODES) push(n);
  for (const f of FOOT) push(f);
  for (const cp of CORPSES) push(cp);
  if (mode === 'play') {
    me.kind = 'char';
    push(me);
  }
  const wf = Math.floor(time * 3) % 4;
  for (let s = 0; s < NB; s++) {
    if (s <= MW + MH - 2) {
      const i0 = Math.max(0, s - MH + 1),
        i1 = Math.min(MW - 1, s);
      for (let i = i0; i <= i1; i++) drawTile(i, s - i, ox, oy, wf);
    }
    const st = STATIC[s],
      dy = DYN[s];
    if (!st.length && !dy.length) continue;
    if (dy.length) {
      const all = st.concat(dy).sort((a, b) => a.x + a.y - (b.x + b.y));
      for (const e of all) drawEntity(e, ox, oy);
    } else for (const e of st) drawEntity(e, ox, oy);
  }
  // attaques de boss annoncées : cercle rouge au sol qui se remplit jusqu'au déclenchement
  for (let i = TELE.length - 1; i >= 0; i--) {
    const T = TELE[i];
    if (time > T.until) {
      TELE.splice(i, 1);
      continue;
    }
    const [tx, ty] = ePx({ x: T.x, y: T.y, z: W.hAt(T.x, T.y) }),
      f = 1 - (T.until - time) / T.d,
      n = Math.max(16, Math.floor(T.r * 14));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU;
      g.fillStyle = k % 2 ? '#ff5a4a' : '#ffd0a0';
      g.globalAlpha = 0.6 + 0.4 * Math.sin(time * 14);
      g.fillRect(Math.round(ox + tx + Math.cos(a) * T.r * 16), Math.round(oy + ty + Math.sin(a) * T.r * 8), 1, 1);
    }
    g.globalAlpha = 0.18 + 0.22 * f;
    g.fillStyle = '#e8414a';
    g.beginPath();
    g.ellipse(ox + tx, oy + ty, T.r * 16 * f, T.r * 8 * f, 0, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
  }
  for (const Z of ZONES) {
    const [zx, zy] = ePx({ x: Z.x, y: Z.y, z: W.hAt(Z.x, Z.y) });
    g.globalAlpha = 0.55 + 0.2 * Math.sin(time * 9);
    g.drawImage(GLOW, Math.round(ox + zx - Z.r * 20), Math.round(oy + zy - Z.r * 10), Math.round(Z.r * 40), Math.round(Z.r * 20));
    g.globalAlpha = 1;
  }
  for (const r of rings) {
    const f = r.t / r.dur,
      rad = r.r0 + (r.r1 - r.r0) * f;
    g.fillStyle = r.color;
    g.globalAlpha = 1 - f * 0.6;
    const n = Math.max(12, Math.floor(rad * 5));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      g.fillRect(Math.round(ox + r.x + Math.cos(a) * rad), Math.round(oy + r.y + Math.sin(a) * rad * 0.5), 1, 1);
    }
    g.globalAlpha = 1;
  }
  for (const q of parts) {
    if (q.color === 'void') {
      const f = q.life / q.max;
      g.fillStyle = 'rgba(' + (f > 0.5 ? '176,138,232' : '40,20,70') + ',' + (f * 0.8).toFixed(2) + ')';
      g.fillRect(Math.round(ox + q.x), Math.round(oy + q.y), 1, 1);
      continue;
    }
    if (q.color === 'smoke') {
      const f = 1 - q.life / q.max;
      g.fillStyle = 'rgba(236,232,240,' + (0.55 * (1 - f)).toFixed(2) + ')';
      const s = 1 + Math.floor(f * 3);
      g.fillRect(Math.round(ox + q.x), Math.round(oy + q.y), s, s);
    } else if (q.color === 'petal') {
      const f = q.life / q.max;
      g.fillStyle = f < 0.2 ? 'rgba(255,200,220,' + (f * 5).toFixed(2) + ')' : Math.sin(time * 6 + q.ph) > 0 ? '#ffd2e0' : '#f4a8c4';
      g.fillRect(Math.round(ox + q.x + Math.sin(time * 2 + q.ph) * 3), Math.round(oy + q.y), Math.sin(time * 5 + q.ph) > 0 ? 2 : 1, 1);
    } else {
      g.fillStyle = q.color;
      g.fillRect(Math.round(ox + q.x), Math.round(oy + q.y), 1, 1);
    }
  }
  for (const q of shots) {
    const f = q.t / q.dur,
      x = ox + q.x0 + (q.x1 - q.x0) * f,
      y = oy + q.y0 + (q.y1 - q.y0) * f - Math.sin(f * Math.PI) * (q.kind === 'arrow' ? 6 : 2);
    const ang = Math.atan2(q.y1 - q.y0, q.x1 - q.x0),
      dx = Math.cos(ang),
      dy = Math.sin(ang);
    if (q.kind === 'arrow' || q.kind === 'pierce') {
      g.fillStyle = q.kind === 'pierce' ? '#bfe6ff' : '#f4ead8';
      for (let k = 0; k < (q.kind === 'pierce' ? 6 : 4); k++) g.fillRect(Math.round(x - dx * k), Math.round(y - dy * k), 1, 1);
      g.fillStyle = '#ffffff';
      g.fillRect(Math.round(x + dx), Math.round(y + dy), 1, 1);
    } else if (q.kind === 'bolt') {
      g.fillStyle = '#7ec4ee';
      g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      g.fillStyle = '#ffffff';
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
      g.fillStyle = 'rgba(126,196,238,.5)';
      g.fillRect(Math.round(x - dx * 3), Math.round(y - dy * 3), 1, 1);
    } else if (q.kind === 'fire') {
      g.fillStyle = '#d8402a';
      g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
      g.fillStyle = '#ffd060';
      g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      g.fillStyle = 'rgba(240,138,58,.6)';
      g.fillRect(Math.round(x - dx * 4), Math.round(y - dy * 4), 2, 2);
    }
  }
  // papillons
  for (const f of FLIES) {
    const x = Math.round(f.x - camX + VW / 2),
      y = Math.round(f.y - camY + VH / 2);
    if (x < 0 || y < 0 || x > VW || y > VH) continue;
    const open = Math.sin(time * 22 + f.ph) > 0;
    g.fillStyle = f.col;
    if (open) {
      g.fillRect(x - 1, y, 1, 1);
      g.fillRect(x + 1, y, 1, 1);
      g.fillRect(x - 1, y - 1, 1, 1);
      g.fillRect(x + 1, y - 1, 1, 1);
    } else {
      g.fillRect(x, y - 1, 1, 2);
    }
    g.fillStyle = '#5a4a6a';
    g.fillRect(x, y, 1, 1);
  }
  // ombres de nuages qui dérivent
  const T = 64 * 9;
  if (!CLOUD9) {
    CLOUD9 = document.createElement('canvas');
    CLOUD9.width = CLOUD9.height = T;
    const c9 = CLOUD9.getContext('2d');
    c9.imageSmoothingEnabled = true;
    c9.drawImage(ART.cloud, 0, 0, T, T);
  }
  g.globalAlpha = 0.3;
  const cx = ((((ox + time * 7) % T) + T) % T) - T,
    cy = ((((oy + time * 3.5) % T) + T) % T) - T;
  for (let x = Math.round(cx); x < VW; x += T) for (let y = Math.round(cy); y < VH; y += T) g.drawImage(CLOUD9, x, y);
  g.globalAlpha = 1;
  // halos des lanternes
  g.globalCompositeOperation = 'lighter';
  for (const l of LAMPS) {
    const sx = ox + (l.x - l.y) * 16,
      sy = oy + (l.x + l.y) * 8 - l.z * 8 - 26;
    const fl = 0.85 + Math.sin(time * 7 + l.x) * 0.06;
    g.globalAlpha = fl;
    g.drawImage(GLOW, sx - 24, sy - 24, 48, 48);
  }
  for (const n of NODES) {
    if ((nodeCd[n.k] || 0) >= time) continue;
    const sx = ox + (n.x - n.y) * 16,
      sy = oy + (n.x + n.y) * 8 - n.z * 8;
    if (sx < -20 || sx > VW + 20 || sy < -20 || sy > VH + 20) continue;
    g.globalAlpha = 0.28 + 0.1 * Math.sin(time * 3 + n.k);
    g.drawImage(GLOW, sx - 10, sy - 16, 20, 18);
  }
  if (W.gate && ISLE_DG && !ISLE_DG[2]) {
    // faisceau de lumière au-dessus de l'entrée : visible de loin, plus haut quand le donjon est rare
    const T = C.DG[ISLE_DG[0]],
      gx = ox + (W.gate.x - W.gate.y) * 16 + 7,
      gy = oy + (W.gate.x + W.gate.y) * 8 - HT[idx(W.gate.i, W.gate.j)] * 8 - 44,
      hgt = 50 + ISLE_DG[0] * 28,
      bw = 5 + ISLE_DG[0];
    if (gx > -30 && gx < VW + 30 && gy > -10 && gy - hgt < VH) {
      g.fillStyle = T.c;
      for (let y = 0; y < hgt; y += 2) {
        g.globalAlpha = (0.05 + 0.3 * (1 - y / hgt)) * (0.85 + 0.15 * Math.sin(time * 3 + y * 0.1));
        g.fillRect(gx - bw, gy - y, bw * 2, 2);
      }
      g.fillStyle = '#ffffff';
      for (let y = 0; y < hgt; y += 2) {
        g.globalAlpha = 0.25 * (1 - y / hgt);
        g.fillRect(gx - 1, gy - y, 2, 2);
      }
      g.fillStyle = T.c;
      for (let k = 0; k < 8; k++) {
        const ph = (time * 0.35 + k * 0.13) % 1;
        g.globalAlpha = 1 - ph;
        g.fillRect(Math.round(gx + Math.sin(k * 2.3 + time) * (bw + 4)), Math.round(gy - ph * hgt), 1, 1);
      }
    }
  }
  for (const h of CHIMNEYS) {
    const sx = ox + (h.i - h.j) * 16,
      sy = oy + (h.i + h.j) * 8 - h.z * 8;
    g.globalAlpha = 0.5;
    g.drawImage(GLOW, sx - 36, sy + 6, 40, 30);
  }
  g.globalCompositeOperation = 'source-over';
  for (const l of LAMPS) {
    const sx = ox + (l.x - l.y) * 16,
      sy = oy + (l.x + l.y) * 8 - l.z * 8 - 26;
    for (let k = 0; k < 3; k++) {
      const a = time * (0.7 + k * 0.3) + k * 2.1 + l.x;
      g.globalAlpha = 0.5 + 0.5 * Math.sin(time * 5 + k * 3 + l.y);
      g.fillStyle = '#fff4a8';
      g.fillRect(Math.round(sx + Math.cos(a) * (9 + k * 3)), Math.round(sy + 6 + Math.sin(a * 1.3) * 7), 1, 1);
    }
  }
  g.globalAlpha = 1;
  // étalonnage + vignette : précalculés une fois par taille d'écran (un seul dessin par image)
  g.setTransform(RQ, 0, 0, RQ, 0, 0);
  if (gradeK < 1) {
    g.globalAlpha = 1 - gradeK;
    g.drawImage(zoneGrade(gradeFrom), 0, 0);
    g.globalAlpha = gradeK;
  }
  g.drawImage(zoneGrade(gradeTo), 0, 0);
  g.globalAlpha = 1;
  if (DGN) {
    const hx0 = Math.round(ox + (me.x - me.y) * 16),
      hy0 = Math.round(oy + (me.x + me.y) * 8 - me.z * 8 - 14);
    g.drawImage(darkness(), hx0 - VW, hy0 - VH);
    g.globalCompositeOperation = 'lighter';
    for (const t of TORCHES) {
      const sx = ox + (t.x - t.y) * 16 + (t.side === 'x' ? 5 : -6),
        sy = oy + (t.x + t.y) * 8 - 20;
      if (sx < -40 || sx > VW + 40 || sy < -40 || sy > VH + 40) continue;
      g.globalAlpha = 0.7 + 0.12 * Math.sin(time * 8 + t.ph * 3);
      g.drawImage(GLOW, sx - 30, sy - 26, 60, 52);
    }
    for (const q of CRYSTALS) {
      const sx = ox + (q.x - q.y) * 16,
        sy = oy + (q.x + q.y) * 8 - 8;
      if (sx < -40 || sx > VW + 40 || sy < -40 || sy > VH + 40) continue;
      g.globalAlpha = 0.45 + 0.1 * Math.sin(time * 2 + q.x);
      g.drawImage(cglow(), sx - 20, sy - 16, 40, 32);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
  g.imageSmoothingEnabled = false;
  // pollen
  for (const m of motes) {
    m.x += Math.sin(time * 0.6 + m.ph) * 0.15 + 0.08;
    m.y -= m.sp * 0.016;
    const x = ((((m.x - camX * 0.3) % (VW + 20)) + VW + 20) % (VW + 20)) - 10,
      y = ((((m.y - camY * 0.3) % (VH + 20)) + VH + 20) % (VH + 20)) - 10;
    const zi = gradeTo,
      mc = ZONE_LOOK[zi].mote,
      tw = Math.sin(time * (zi === 2 ? 3.2 : 2) + m.ph),
      al = zi === 2 ? Math.max(0, tw) * 0.9 : 0.35 + 0.35 * tw;
    if (zi === 3) m.y -= m.sp * 0.03; // les braises montent plus vite
    g.fillStyle = 'rgba(' + mc[0] + ',' + mc[1] + ',' + mc[2] + ',' + al.toFixed(2) + ')';
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
    if (zi === 2 && al > 0.6) {
      g.globalAlpha = 0.25;
      g.fillRect(Math.round(x) - 1, Math.round(y), 3, 1);
      g.fillRect(Math.round(x), Math.round(y) - 1, 1, 3);
      g.globalAlpha = 1;
    }
  }
}

let hudWalk = null;
function npcMark(n) {
  const Q = C.QUESTS[me.q];
  if (!Q || Q.giver !== n.id) return null;
  return me.qs === 0 ? '!' : me.qs === 2 ? '?' : '…';
}
