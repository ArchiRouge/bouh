/* Pixels Worlds — client, hud.js : Interface dessinée sur le canevas : étiquettes, statut, mini-carte, boutons, invites, voiles.
   Les fichiers de client/game/ se partagent leurs déclarations (scripts classiques chargés dans l'ordre par persist.js,
   voir GAME_FILES) : une fonction ou une variable d'un fichier sert aux suivants. */
'use strict';
/* ---------- interface ---------- */
function panel(x, y, w, h) {
  /* encre indigo, filet crème intérieur, coins dorés */ u.fillStyle = '#0c0a1c';
  u.fillRect(x - 1, y, w + 2, h);
  u.fillRect(x, y - 1, w, h + 2);
  u.fillStyle = 'rgba(22,22,46,.84)';
  u.fillRect(x, y, w, h);
  u.fillStyle = 'rgba(239,227,200,.55)';
  u.fillRect(x + 2, y + 1, w - 4, 1);
  u.fillRect(x + 2, y + h - 2, w - 4, 1);
  u.fillRect(x + 1, y + 2, 1, h - 4);
  u.fillRect(x + w - 2, y + 2, 1, h - 4);
  u.fillStyle = '#e8c37a';
  for (const [a, b] of [
    [x + 1, y + 1],
    [x + w - 2, y + 1],
    [x + 1, y + h - 2],
    [x + w - 2, y + h - 2]
  ])
    u.fillRect(a, b, 1, 1);
}
function bar(x, y, w, h, f, c1, c2, bg) {
  u.fillStyle = '#1a0f1c';
  u.fillRect(x - 1, y - 1, w + 2, h + 2);
  u.fillStyle = bg;
  u.fillRect(x, y, w, h);
  const fw = Math.round(w * clamp(f, 0, 1));
  u.fillStyle = c1;
  u.fillRect(x, y, fw, h);
  u.fillStyle = c2;
  u.fillRect(x, y + h - Math.max(1, h >> 1), fw, Math.max(1, h >> 1));
  u.fillStyle = 'rgba(255,255,255,.4)';
  u.fillRect(x, y, fw, 1);
}
function pcircle(cx, cy, r, col, yMax) {
  u.fillStyle = col;
  for (let y = -r; y <= Math.min(r, yMax == null ? 99 : yMax); y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y));
    u.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}
function pring(cx, cy, r, col) {
  u.fillStyle = col;
  const n = Math.max(16, Math.floor(r * 6));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    u.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
  }
}
const mini = document.createElement('canvas');
mini.width = mini.height = 46;
const mg = mini.getContext('2d'),
  mimg = mg.createImageData(46, 46);
function drawMinimap(cx, cy) {
  const d = mimg.data,
    Q = 5;
  if (time - miniT > 0.1 || time < miniT) {
    miniT = time;
    for (let my = 0; my < 46; my++)
      for (let mx = 0; mx < 46; mx++) {
        const dx = mx - 23,
          dy = my - 23,
          k = (my * 46 + mx) * 4;
        if (dx * dx + dy * dy > 22 * 22) {
          d[k + 3] = 0;
          continue;
        }
        const sx = dx * Q,
          sy = dy * Q,
          wx = me.x + (sx / 16 + sy / 8) / 2,
          wy = me.y + (sy / 8 - sx / 16) / 2,
          i = Math.floor(wx),
          j = Math.floor(wy);
        const c = W.inb(i, j) ? (SEEN && !SEEN[idx(i, j)] ? [10, 6, 20] : MINICOL[idx(i, j)]) : DGN ? [10, 6, 20] : [36, 98, 160];
        d[k] = c[0];
        d[k + 1] = c[1];
        d[k + 2] = c[2];
        d[k + 3] = 255;
      }
    mg.putImageData(mimg, 0, 0);
  }
  pcircle(cx, cy, 24, '#1a0f1c');
  u.drawImage(mini, cx - 23, cy - 23);
  pring(cx, cy, 23, 'rgba(239,227,200,.85)');
  pring(cx, cy, 24, '#0c0a1c');
  u.fillStyle = '#e8c37a';
  u.fillRect(cx - 1, cy - 25, 3, 1);
  u.fillRect(cx, cy - 26, 1, 3);
  const toMini = (x, y) => {
    const ddx = x - me.x,
      ddy = y - me.y,
      sx = ((ddx - ddy) * 16) / Q,
      sy = ((ddx + ddy) * 8) / Q;
    return [Math.round(cx + sx), Math.round(cy + sy)];
  };
  if (DGN)
    for (const o of [W.dg.portal, W.dg.exit]) {
      const [x, y] = toMini(o.x, o.y);
      if ((x - cx) ** 2 + (y - cy) ** 2 <= 21 * 21 && SEEN[idx(Math.floor(o.x), Math.floor(o.y))]) {
        u.fillStyle = o === W.dg.exit ? '#ffd23f' : '#b08ae8';
        u.fillRect(x - 1, y - 1, 3, 3);
      }
    }
  if (W.gate && ISLE_DG) {
    const [x, y] = toMini(W.gate.x, W.gate.y);
    if ((x - cx) ** 2 + (y - cy) ** 2 <= 21 * 21) {
      u.fillStyle = '#0c0a1c';
      u.fillRect(x - 2, y - 2, 5, 5);
      u.fillStyle = ISLE_DG[2] ? '#6a6278' : C.DG[ISLE_DG[0]].c;
      u.fillRect(x - 1, y - 1, 3, 3);
    }
  }
  for (const m of mobs) {
    if (!m.alive || (SEEN && !SEEN[idx(Math.floor(m.x), Math.floor(m.y))])) continue;
    const [x, y] = toMini(m.x, m.y);
    if ((x - cx) ** 2 + (y - cy) ** 2 > 21 * 21) continue;
    u.fillStyle = m.type === 'boss' ? '#c890ff' : m.aggro ? '#ff5a5a' : '#ffb04a';
    u.fillRect(x, y, m.type === 'boss' ? 2 : 1, m.type === 'boss' ? 2 : 1);
  }
  for (const n of NODES) {
    if ((nodeCd[n.k] || 0) >= time) continue;
    const [x, y] = toMini(n.x, n.y);
    if ((x - cx) ** 2 + (y - cy) ** 2 > 21 * 21) continue;
    u.fillStyle = n.res === 'herb' ? '#bfe6ff' : n.res === 'wood' ? '#ffcf70' : '#ffb0d4';
    u.fillRect(x, y, 1, 1);
  }
  for (const n of NPCS) {
    const [x, y] = toMini(n.x, n.y);
    if ((x - cx) ** 2 + (y - cy) ** 2 > 21 * 21) continue;
    const mk = npcMark(n);
    u.fillStyle = mk === '!' || mk === '?' ? '#ffe27a' : '#f4ead8';
    u.fillRect(x - 1, y - 1, mk === '!' || mk === '?' ? 3 : 2, mk === '!' || mk === '?' ? 3 : 2);
  }
  for (const o of others.values()) {
    const [x, y] = toMini(o.x, o.y);
    if ((x - cx) ** 2 + (y - cy) ** 2 > 21 * 21) continue;
    u.fillStyle = '#9fe0ff';
    u.fillRect(x - 1, y, 3, 1);
    u.fillRect(x, y - 1, 1, 3);
  }
  u.fillStyle = '#fff6a0';
  u.fillRect(cx - 1, cy - 1, 3, 3);
  u.fillStyle = '#1a0f1c';
  u.fillRect(cx, cy, 1, 1);
}
function drawButton(k, b) {
  const down = btnDown[k];
  pcircle(b.x, b.y, b.r + 2, 'rgba(12,10,28,.85)');
  pring(b.x, b.y, b.r + 1, k === 'atk' ? '#e8c37a' : 'rgba(239,227,200,.8)');
  pcircle(
    b.x,
    b.y,
    b.r,
    down
      ? 'rgba(10,10,24,.9)'
      : k === 'atk'
        ? 'rgba(84,34,56,.88)'
        : b.ab != null
          ? 'rgba(34,52,72,.86)'
          : k === 'pot'
            ? 'rgba(70,34,66,.86)'
            : 'rgba(30,32,62,.86)'
  );
  pcircle(b.x, b.y - 1, b.r - 3, down ? 'rgba(255,255,255,0)' : 'rgba(255,240,220,.08)', -Math.floor(b.r * 0.35));
  const ic = ART.icons[b.icon] || ART.icons.sword;
  u.drawImage(ic, b.x - (ic.width >> 1), b.y - (ic.height >> 1) + (down ? 1 : 0));
  let cd = 0;
  if (k === 'atk') cd = me.atkCd / CL().basic.cd;
  else if (k === 'pot') cd = me.potCd / 0.9;
  else if (b.ab != null) {
    const A = CL().ab[b.ab];
    cd = Math.max(localAbCd[b.ab] - time, (me.abCd && me.abCd[b.ab]) || 0) / A.cd;
  }
  if (cd > 0) pcircle(b.x, b.y, b.r, 'rgba(10,5,20,.6)', -b.r + Math.round(2 * b.r * clamp(cd, 0, 1)));
  if (b.ab != null) {
    const A = CL().ab[b.ab];
    if (A.locked) {
      pcircle(b.x, b.y, b.r, 'rgba(10,5,20,.72)');
      text(u, A.m < 99 ? 'M' + A.m : '-', b.x, b.y - 3, '#c8c0d8', 'center');
    } else if (me.mp < A.mp) pcircle(b.x, b.y, b.r, 'rgba(20,30,80,.45)');
  }
  if (b.ab != null) {
    const A = CL().ab[b.ab];
    if (!A.locked && A.rank) {
      if (A.rank >= C.SK_MAX) pring(b.x, b.y, b.r + 1, '#ffd23f');
      const pend = A.pending && A.pending.length;
      pcircle(b.x + b.r - 2, b.y + b.r - 3, 4, pend ? '#e8c37a' : '#1a0f1c');
      text(
        u,
        pend ? '!' : String(A.rank),
        b.x + b.r - 2,
        b.y + b.r - 6,
        pend ? '#1a1420' : A.rank >= C.SK_MAX ? '#ffd23f' : '#bfe6ff',
        'center',
        1,
        false
      );
    }
  }
  if (k === 'pot') {
    pcircle(b.x + b.r - 2, b.y + b.r - 3, 4, '#1a0f1c');
    text(u, String(me.potions), b.x + b.r - 2, b.y + b.r - 6, '#ffe27a', 'center', 1, false);
  }
}
function drawVeil(f, col, top, name) {
  if (f <= 0) return;
  u.fillStyle = 'rgba(' + col.join(',') + ',' + (0.92 * f).toFixed(3) + ')';
  u.fillRect(0, 0, UW, UH);
  for (let k = 0; k < 40; k++) {
    const a = time * (0.6 + (k % 5) * 0.15) + k * 2.4,
      r = 20 + ((k * 37) % (UW * 0.6));
    u.fillStyle = k % 3 ? 'rgba(255,255,255,' + (0.5 * f).toFixed(2) + ')' : 'rgba(255,240,200,' + (0.7 * f).toFixed(2) + ')';
    u.fillRect(Math.round(UW / 2 + Math.cos(a) * r), Math.round(UH * 0.45 + Math.sin(a) * r * 0.6), 1, 1);
  }
  if (f > 0.45) {
    u.globalAlpha = clamp((f - 0.45) / 0.3, 0, 1);
    if (top) text(u, top, UW >> 1, Math.round(UH * 0.38), '#fff2d0', 'center', 1);
    text(u, name, UW >> 1, Math.round(UH * 0.43), '#ffffff', 'center', 2);
    u.globalAlpha = 1;
  }
}
function drawUI() {
  u.clearRect(0, 0, UW, UH);
  const ox = lastOX,
    oy = lastOY;
  // étiquettes du monde
  for (const l of labels) {
    const x = Math.round((l.x + SUBX / RQ) * K),
      y = Math.round((l.y + SUBY / RQ) * K);
    if (l.npc) {
      text(u, l.t, x, y - 6, l.c, 'center');
      const mk = npcMark(l.npc);
      if (mk && mode === 'play') {
        const b = Math.round(Math.sin(time * 4) * 1.5);
        text(u, mk === '…' ? '?' : mk, x, y - 22 + b, mk === '…' ? '#a8a0b8' : '#ffe27a', 'center', 2);
      }
      continue;
    }
    if (l.mob) {
      const m = l.mob;
      let yy = y;
      if (l.hp != null) {
        const w = Math.round(l.w * K) + 4;
        bar(x - (w >> 1), yy - 2, w, 2, l.hp, '#e8414a', '#b02a34', '#3a1018');
        yy -= 4;
      }
      if (me.target === m && mode === 'play' && !me.dead) {
        const diff = m.lvl - me.lvl,
          col = diff >= 3 ? '#ff7a6a' : diff <= -3 ? '#a8a8b8' : '#ffffff';
        text(u, m.name + ' nv' + m.lvl, x + 3, yy - 9, col, 'center');
        {
          const E0 = C.ELEMENTS[(C.MOBDEF[m.type] || {}).el];
          if (E0) {
            const tw = textW(m.name + ' nv' + m.lvl);
            u.fillStyle = '#1a0f1c';
            u.fillRect(x + 3 - (tw >> 1) - 7, yy - 9, 6, 6);
            u.fillStyle = E0[1];
            u.fillRect(x + 3 - (tw >> 1) - 6, yy - 8, 4, 4);
          }
        }
        const b = Math.floor(time * 4) % 2;
        u.fillStyle = '#ffd23f';
        u.fillRect(x - 2, yy - 15 - b, 5, 1);
        u.fillRect(x - 1, yy - 14 - b, 3, 1);
        u.fillRect(x, yy - 13 - b, 1, 1);
      }
      continue;
    }
    if (l.php != null) {
      const w = 18;
      bar(x - (w >> 1), y - 9, w, 2, l.php, '#e8414a', '#b02a34', '#3a1018');
      if (l.tgt) {
        const b0 = Math.floor(time * 4) % 2;
        u.fillStyle = '#ff7a6a';
        u.fillRect(x - 2, y - 19 - b0, 5, 1);
        u.fillRect(x - 1, y - 18 - b0, 3, 1);
      }
    }
    if (l.corpse) {
      text(u, l.t, x, y - 6, '#e8d8c0', 'center');
      continue;
    }
    if (mode === 'play' || l.t) text(u, l.t + (l.lv ? ' ' + l.lv : ''), x, y - 6, l.c, 'center');
    if (l.ttl) text(u, l.ttl, x, y - 13, '#ffd23f', 'center');
  }
  for (const f of floats) {
    const e = f.t / f.dur;
    u.globalAlpha = e > 0.75 ? (1 - e) * 4 : 1;
    text(
      u,
      f.text,
      (ox + SUBX / RQ + f.x + f.vx * f.t) * K,
      (oy + SUBY / RQ + f.y - Math.sqrt(e) * 22) * K,
      f.color,
      'center',
      f.big ? 2 : 1
    );
    u.globalAlpha = 1;
  }
  if (mode !== 'play') return;
  u.save();
  u.translate(0, ST);
  // panneau de statut
  const pw = Math.min(104, UW - 64);
  panel(3, 3, pw, 33);
  u.fillStyle = 'rgba(239,227,200,.8)';
  u.fillRect(6, 6, 22, 22);
  u.fillStyle = '#2e4a5c';
  u.fillRect(7, 7, 20, 20);
  u.fillStyle = '#243a4c';
  u.fillRect(7, 17, 20, 10);
  if (me.set) {
    u.imageSmoothingEnabled = true;
    u.drawImage(me.set.front[0], 13, 8, 32, 38, 9, 8, 16, 19);
    u.imageSmoothingEnabled = false;
  }
  u.fillStyle = '#e8c37a';
  u.fillRect(6, 26, 22, 8);
  text(u, 'NV' + me.lvl, 17, 27, '#2a1a10', 'center', 1, false);
  text(u, me.name, 32, 5, '#fff2d0');
  const bw = pw - 34;
  bar(32, 13, bw, 7, me.hp / me.maxhp, '#dc6a68', '#a8465a', '#2e1424');
  text(u, Math.ceil(me.hp) + '/' + me.maxhp, 32 + (bw >> 1), 13, '#ffffff', 'center');
  bar(32, 23, bw, 4, me.mp / me.maxmp, '#78a8dc', '#4f78b0', '#161a3a');
  bar(32, 30, bw, 2, me.need ? me.xp / me.need : 1, '#b2d896', '#7aa870', '#1a2a20');
  u.drawImage(ART.icons.coin, 5, 40);
  text(u, String(me.gold), 12, 39, '#ffd23f');
  {
    const xe = 18 + textW(String(me.gold));
    u.drawImage(ART.icons.ether, xe, 40);
    text(u, String(me.ether || 0), xe + 7, 39, '#bfe6ff');
    const xg = xe + 12 + textW(String(me.ether || 0));
    text(u, 'Cueil. nv' + (me.glvl || 1), xg, 39, '#c8c0d8');
    hudWalk = { x: 3, y: 37 + ST, w: xg + textW('Cueil. nv' + (me.glvl || 1)), h: 10 };
  }
  // tchat
  const Q = C.QUESTS[me.q];
  let y0 = 50;
  {
    const tw = Math.min(150, UW - 64);
    panel(3, 48, tw, 18);
    u.fillStyle = '#ffe27a';
    u.fillRect(6, 52, 2, 2);
    if (Q) {
      text(u, Q.title, 11, 50, '#ffe9b0');
      const g2 = C.NPCS[Q.giver].name;
      text(
        u,
        me.qs === 0 ? 'Parler à ' + g2 : me.qs === 2 ? 'Retourner voir ' + g2 : Q.short + ' ' + me.qn + '/' + Q.n,
        11,
        58,
        me.qs === 2 ? '#9cf07a' : '#d8d0e8'
      );
    } else {
      text(u, 'Chapitre 1 terminé', 11, 50, '#ffe9b0');
      text(u, 'Suite bientôt...', 11, 58, '#d8d0e8');
    }
    y0 = 70;
  }
  const lines = chat.slice(-5),
    cw = Math.min(170, UW - 64);
  if (lines.length) {
    u.fillStyle = 'rgba(18,16,38,.5)';
    u.fillRect(3, y0, cw, lines.length * 7 + 3);
    lines.forEach((l, i) => text(u, l.text, 5, y0 + 1 + i * 7, l.color));
  }
  // boss du donjon : barre de vie en haut, cadre à la couleur de sa rareté
  if (DGN) {
    const bm = mobs[W.dg.bossK];
    if (bm.alive && (bm.aggro || Math.hypot(bm.x - me.x, bm.y - me.y) < 7)) {
      const T = C.dgTier(bm.dgBoss),
        w = Math.min(150, UW - 80),
        x = (UW - w) >> 1,
        y = 6;
      u.fillStyle = '#0c0a1c';
      u.fillRect(x - 3, y - 2, w + 6, 19);
      u.fillStyle = T.c;
      u.fillRect(x - 2, y - 1, w + 4, 17);
      u.fillStyle = '#16122a';
      u.fillRect(x - 1, y, w + 2, 15);
      text(u, bm.name + ' - ' + T.n, UW >> 1, y + 1, T.c, 'center');
      bar(x + 2, y + 9, w - 4, 4, bm.hp / bm.maxhp, '#e8414a', '#b02a34', '#3a1018');
    }
  }
  // mini-carte et statut réseau
  drawMinimap(UW - 27, 27);
  if (showFps)
    text(u, fpsShown + ' i/s Q' + RQ, UW - 27, 61, fpsShown >= 50 ? '#9cf07a' : fpsShown >= 30 ? '#ffd23f' : '#ff7a6a', 'center');
  text(u, netMode === 'online' ? online + ' en ligne' : 'Solo', UW - 27, 53, netMode === 'online' ? '#9cf07a' : '#c8c0d8', 'center');
  u.restore();
  // flèche vers le Pont du Bourg quand il est hors de l'écran (îles du voyage)
  {
    const hb = !DGN && mode === 'play' && (W.bridges || []).find(b => b.kind === 'home');
    if (hb && !me.dead && !travel) {
      const bx = (lastOX + SUBX / RQ + (hb.hx - hb.hy) * 16) * K,
        by = (lastOY + SUBY / RQ + (hb.hx + hb.hy) * 8) * K;
      const m = 18;
      if (bx < m || bx > UW - m || by < m + ST || by > UH - m - SB) {
        const cx = UW / 2,
          cy = UH / 2,
          dx = bx - cx,
          dy = by - cy,
          k = Math.min((UW / 2 - 30) / Math.abs(dx || 1e-6), (UH / 2 - 60) / Math.abs(dy || 1e-6));
        const ax = Math.round(cx + dx * k),
          ay = Math.round(cy + dy * k),
          a = Math.atan2(dy, dx),
          ca = Math.cos(a),
          sa = Math.sin(a),
          pul = 0.75 + 0.25 * Math.sin(time * 4);
        const tri = (s, col) => {
          u.fillStyle = col;
          u.beginPath();
          u.moveTo(ax + ca * 7 * s, ay + sa * 7 * s);
          u.lineTo(ax - ca * 4 * s - sa * 5 * s, ay - sa * 4 * s + ca * 5 * s);
          u.lineTo(ax - ca * 4 * s + sa * 5 * s, ay - sa * 4 * s - ca * 5 * s);
          u.closePath();
          u.fill();
        };
        u.globalAlpha = pul;
        tri(1.35, '#1a0f1c');
        tri(1, '#ffd23f');
        u.globalAlpha = 1;
        text(u, 'Pont', ax - Math.round(ca * 12), ay - Math.round(sa * 12) - 3, '#ffe9b0', 'center');
      }
    }
  }
  // bannière de zone
  if (zoneT > 0 && zone) {
    const a = zoneT > 2.4 ? (2.8 - zoneT) / 0.4 : zoneT < 0.6 ? zoneT / 0.6 : 1;
    u.globalAlpha = clamp(a, 0, 1);
    const sc = textW(zone, 2) < UW - 20 ? 2 : 1,
      y = Math.round(UH * 0.2),
      w = textW(zone, sc);
    const bx = ((UW - w) >> 1) - 14,
      bw = w + 28;
    u.fillStyle = 'rgba(18,16,38,.72)';
    u.fillRect(bx, y - 5, bw, 7 * sc + 10);
    u.fillStyle = 'rgba(239,227,200,.7)';
    u.fillRect(bx + 6, y - 3, bw - 12, 1);
    u.fillRect(bx + 6, y + 7 * sc + 2, bw - 12, 1);
    u.fillStyle = '#e8c37a';
    for (const ex of [bx + 3, bx + bw - 4]) {
      u.fillRect(ex, y + ((7 * sc) >> 1) - 1, 1, 3);
      u.fillRect(ex - 1, y + ((7 * sc) >> 1), 3, 1);
    }
    text(u, zone, UW >> 1, y, '#f6eedc', 'center', sc);
    u.globalAlpha = 1;
  }
  const B = btns();
  for (const k in B) drawButton(k, B[k]);
  talkRect = null;
  const panelsClosed = $('dialog').hidden && $('craft').hidden && $('walk').hidden && $('char').hidden;
  if ((nearNpc || nearNode || nearBridge || nearChest || nearCorpse || nearGate || nearPortal) && !me.dead && panelsClosed && !travel) {
    let label, hot;
    if (nearPortal) {
      label =
        nearPortal === 'win'
          ? 'Sortir du donjon (victoire !)'
          : mobs[W.dg.bossK].alive
            ? 'Sortir (le donjon sera perdu)'
            : 'Sortir du donjon';
      hot = true;
    } else if (nearGate) {
      const d = ISLE_DG;
      label = !d || d[2] ? "Donjon éteint : traverse un Pont d'Éther" : 'Entrer : donjon ' + C.DG[d[0]].n + ' (' + C.DG[d[0]].name + ')';
      hot = !!(d && !d[2]);
    } else if (nearBridge) {
      label = nearBridge.kind === 'ether' ? "Traverser le Pont d'Éther (" + C.ETHER_BRIDGE + ' Éther)' : "Rentrer au Bourg d'Argel";
      hot = true;
    } else if (nearCorpse) {
      label = 'Piller le corps de ' + nearCorpse.name + ' (' + nearCorpse.n + ')';
      hot = true;
    } else if (nearChest) {
      label = 'Ouvrir le coffre';
      hot = true;
    } else if (nearNpc) {
      const mk = npcMark(nearNpc);
      label = 'Parler à ' + nearNpc.name;
      hot = mk === '!' || mk === '?';
    } else {
      const R0 = C.RES[nearNode.res],
        ready = (nodeCd[nearNode.k] || 0) < time;
      label =
        me.glvl < R0.req
          ? 'Cueillette nv' + R0.req + ' requise'
          : !ready
            ? 'Repousse dans ' + Math.ceil(nodeCd[nearNode.k] - time) + 's'
            : me.ether < 1
              ? "Pas assez d'Éther"
              : 'Récolter ' + R0.name;
      hot = me.glvl >= R0.req && ready && me.ether >= 1;
    }
    const w = textW(label) + 16,
      h = 15,
      x = (UW - w) >> 1,
      y = UH - 66 - SB;
    talkRect = { x, y, w, h };
    u.fillStyle = '#0c0a1c';
    u.fillRect(x - 1, y - 1, w + 2, h + 2);
    u.fillStyle = hot ? (nearNpc ? '#e8c37a' : '#8cc4c0') : 'rgba(22,22,46,.9)';
    u.fillRect(x, y, w, h);
    u.fillStyle = hot ? 'rgba(255,250,235,.45)' : 'rgba(239,227,200,.5)';
    u.fillRect(x + 1, y + 1, w - 2, 1);
    text(u, label, UW >> 1, y + 4, hot ? '#1a1420' : '#fff2d0', 'center', 1, false);
  }
  if (joy.active) {
    pring(joy.ox, joy.oy, 18, 'rgba(255,240,210,.6)');
    pring(joy.ox, joy.oy, 17, 'rgba(255,240,210,.3)');
    let dx = joy.x - joy.ox,
      dy = joy.y - joy.oy;
    const m = Math.hypot(dx, dy);
    if (m > 14) {
      dx = (dx / m) * 14;
      dy = (dy / m) * 14;
    }
    pcircle(Math.round(joy.ox + dx), Math.round(joy.oy + dy), 7, 'rgba(255,240,210,.55)');
  } else if (usedTouch && !movedOnce) {
    const x = 32,
      y = UH - 38 - SB;
    pring(x, y, 18, 'rgba(255,240,210,' + (0.35 + 0.25 * Math.sin(time * 4)).toFixed(2) + ')');
    text(u, 'Bouger', x, y - 3, '#fff', 'center');
  }
  // présentation du boss à l'entrée de sa salle : nom et rareté en grand
  if (bossIntro) {
    const f = (time - bossIntro.t) / 2.6;
    if (f >= 1) bossIntro = null;
    else {
      const a = f < 0.15 ? f / 0.15 : f > 0.75 ? (1 - f) / 0.25 : 1,
        y = Math.round(UH * 0.3);
      u.globalAlpha = a * 0.75;
      u.fillStyle = '#0c0a1c';
      u.fillRect(0, y - 8, UW, 46);
      u.globalAlpha = a;
      u.fillStyle = bossIntro.col;
      u.fillRect(0, y - 8, UW, 1);
      u.fillRect(0, y + 37, UW, 1);
      text(u, bossIntro.name, UW >> 1, y, '#fff2d0', 'center', textW(bossIntro.name, 3) < UW - 16 ? 3 : 2);
      text(u, 'Boss ' + bossIntro.tier, UW >> 1, y + 24, bossIntro.col, 'center', 1);
      u.globalAlpha = 1;
    }
  }
  // traversée d'un pont : la brume monte (départ), puis se dissipe à l'arrivée sur la nouvelle île
  if (travel) drawVeil(clamp((time - travel.t) / 1.1, 0, 1), travel.col, 'Traversée…', travel.name);
  else if (arrive) {
    if (arrive.t0 == null) arrive.t0 = time;
    const f = 1 - clamp((time - arrive.t0 - 0.3) / 1.4, 0, 1);
    drawVeil(f, arrive.col, '', arrive.name);
    if (f <= 0) arrive = null;
  }
  if (me.dead) {
    u.fillStyle = 'rgba(30,0,16,.55)';
    u.fillRect(0, 0, UW, UH);
    text(u, 'Vous êtes mort', UW >> 1, Math.round(UH * 0.4), '#ff7a7a', 'center', 2);
    text(
      u,
      (DGN ? "Retour à l'entrée du donjon dans " : PVP ? 'Réapparition au pont dans ' : 'Retour au bourg dans ') + me.deadT,
      UW >> 1,
      Math.round(UH * 0.4) + 20,
      '#fff',
      'center'
    );
  }
}
