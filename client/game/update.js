/* Pixels Worlds — client, update.js : Mise à jour à chaque image : héros, interpolation des monstres et des joueurs, caméra.
   Les fichiers de client/game/ se partagent leurs déclarations (scripts classiques chargés dans l'ordre par persist.js,
   voir GAME_FILES) : une fonction ou une variable d'un fichier sert aux suivants. */
'use strict';
/* ---------- mise à jour ---------- */
// cible la plus proche : monstres et, sur les îles (combat entre joueurs), les autres héros vivants
function nearestFoe(x, y, r) {
  let best = nearestMob(x, y, r),
    bd = best ? Math.hypot(best.x - x, best.y - y) : r;
  if (PVP)
    for (const o of others.values()) {
      if (o.dead) continue;
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
  return best;
}
const foeMsg = t => (t && t.k == null ? { p: t.id } : { m: t ? t.k : -1 });
function nearestMob(x, y, r) {
  let best = null,
    bd = r;
  for (const m of mobs) {
    if (!m.alive) continue;
    const d = Math.hypot(m.x - x, m.y - y);
    if (d < bd) {
      bd = d;
      best = m;
    }
  }
  return best;
}
function updateMe(dt) {
  me.atkCd -= dt;
  me.skillCd -= dt;
  me.potCd -= dt;
  me.slash -= dt;
  me.atkT -= dt;
  me.spin -= dt;
  me.hitFlash -= dt;
  me.moving = false;
  if (me.dead) {
    input.skill = input.pot = false;
    me.anim = 0;
    return;
  }
  const [sx, sy] = inputDir();
  if (sx || sy) {
    let wx = (sx / 16 + sy / 8) / 2,
      wy = (sy / 8 - sx / 16) / 2;
    const l = Math.hypot(wx, wy);
    wx /= l;
    wy /= l;
    C.moveBy(W, me, wx * 3 * (me.speed || 1) * dt, wy * 3 * (me.speed || 1) * dt);
    setFacing(me, wx, wy);
    me.moving = true;
    movedOnce = true;
  }
  const tgt = nearestFoe(me.x, me.y, 6);
  me.target = tgt;
  const atk = input.atkBtn || input.atkKey,
    K0 = CL(),
    B = K0.basic;
  if (atk && tgt) {
    const d = Math.hypot(tgt.x - me.x, tgt.y - me.y),
      reach = B.range + (tgt.type === 'boss' ? 0.6 : 0);
    if (d <= reach) {
      if (me.atkCd <= 0) {
        me.atkCd = B.cd;
        setFacing(me, tgt.x - me.x, tgt.y - me.y);
        basicFx(me, tgt, B.fx);
        link.send(Object.assign({ t: 'atk' }, foeMsg(tgt)));
      }
    } else if (!me.moving) {
      const dx = tgt.x - me.x,
        dy = tgt.y - me.y,
        sp = 3 * (me.speed || 1);
      C.moveBy(W, me, (dx / d) * sp * dt, (dy / d) * sp * dt);
      setFacing(me, dx, dy);
      me.moving = true;
    }
  } else if (atk && me.atkCd <= 0 && B.fx === 'slash') {
    me.atkCd = B.cd;
    me.slash = 0.18;
    me.atkT = ATK_T;
    me.slashAng = me.face === 'side' ? (me.flip ? Math.PI : 0) : me.face === 'front' ? Math.PI / 2 : -Math.PI / 2;
  }
  if (input.ab >= 0) {
    const i = input.ab,
      A = K0.ab[i];
    input.ab = -1;
    if (A.locked) floatAt(me, A.m < 99 ? A.name + ' : maîtrise ' + A.m : 'Pas de technique', '#c8c0d8');
    else if (localAbCd[i] > time || (me.abCd && me.abCd[i] > 0.2)) {
      /* en recharge */
    } else if (me.mp < A.mp) floatAt(me, 'Mana insuffisant', '#7fb2ff');
    else {
      let t2 = null;
      if (A.kind === 'aoeTarget' || A.kind === 'single' || A.kind === 'charge') {
        t2 = nearestFoe(me.x, me.y, A.range + 0.4);
        if (!t2) {
          floatAt(me, 'Aucune cible', '#c8c0d8');
          t2 = false;
        }
      }
      if (t2 !== false) {
        localAbCd[i] = time + A.cd;
        if (t2) setFacing(me, t2.x - me.x, t2.y - me.y);
        link.send(Object.assign({ t: 'ab', a: i }, foeMsg(t2)));
      }
    }
  }
  if (input.pot) {
    input.pot = false;
    if (me.potCd <= 0) {
      if (me.potions <= 0) floatAt(me, 'Plus de potion', '#ff8ac0');
      else if (me.hp >= me.maxhp) floatAt(me, 'Vie pleine', '#8cf07a');
      else {
        me.potCd = 0.9;
        link.send({ t: 'pot' });
      }
    }
  }
  me.anim = me.moving ? me.anim + dt * 13 * (me.speed || 1) : 0;
  me.z += (W.hAt(me.x, me.y) - me.z) * Math.min(1, dt * 15);
  sendT -= dt;
  const st = me.x.toFixed(2) + me.y.toFixed(2) + me.face + me.flip + me.moving;
  if (sendT <= 0 && st !== me.sent) {
    sendT = 0.1;
    me.sent = st;
    link.send({
      t: 'mv',
      x: +me.x.toFixed(2),
      y: +me.y.toFixed(2),
      f: FACES.indexOf(me.face),
      fl: me.flip ? 1 : 0,
      mv: me.moving ? 1 : 0
    });
  }
  nearBridge = null;
  for (const br of W.bridges || []) if (Math.hypot(br.ex - me.x, br.ey - me.y) < 1.3) nearBridge = br;
  nearChest = !!(W.chest && !chestOpen && Math.hypot(W.chest.x - me.x, W.chest.y - me.y) < 1.4);
  nearGate = !!(W.gate && Math.hypot(W.gate.x - me.x, W.gate.y - me.y) < 2.2);
  nearPortal = null;
  if (DGN) {
    if (Math.hypot(W.dg.portal.x - me.x, W.dg.portal.y - me.y) < 0.9) nearPortal = 'out';
    else if (!mobs[W.dg.bossK].alive && Math.hypot(W.dg.exit.x - me.x, W.dg.exit.y - me.y) < 1.4) nearPortal = 'win';
    const i0 = Math.floor(me.x),
      j0 = Math.floor(me.y);
    for (let b = -4; b <= 4; b++)
      for (let a = -4; a <= 4; a++) if (W.inb(i0 + a, j0 + b) && a * a + b * b <= 18) SEEN[idx(i0 + a, j0 + b)] = 1;
    const bm = mobs[W.dg.bossK];
    if (!bossIntroDone && bm.alive && Math.hypot(bm.x - me.x, bm.y - me.y) < 5.5) {
      bossIntroDone = true;
      const T = C.dgTier(bm.dgBoss);
      bossIntro = { t: time, name: bm.name, tier: T.n, col: T.c };
      shake = Math.max(shake, 0.3);
    }
  }
  nearCorpse = null;
  for (const cp of CORPSES) if (Math.hypot(cp.x - me.x, cp.y - me.y) < 1.4) nearCorpse = cp;
  nearNode = null;
  {
    let bd = 1.3;
    for (const n of NODES) {
      const d = Math.hypot(n.x - me.x, n.y - me.y);
      if (d < bd) {
        bd = d;
        nearNode = n;
      }
    }
  }
  nearNpc = null;
  let nd = 2.2;
  for (const n of NPCS) {
    const d = Math.hypot(n.x - me.x, n.y - me.y);
    if (d < 3.5) setFacing(n, me.x - n.x, me.y - n.y);
    else n.face = 'front';
    if (d < nd) {
      nd = d;
      nearNpc = n;
    }
  }
  const z = W.zoneOf(me.x, me.y);
  if (z !== zone) {
    zone = z;
    zoneT = 2.8;
    const zi = zoneIndex();
    if (zi !== gradeTo) {
      gradeFrom = gradeTo;
      gradeTo = zi;
      gradeK = 0;
    }
  }
}
const ZONES = []; // sols en feu (Brasier)
function update(dt) {
  for (let z = ZONES.length - 1; z >= 0; z--) {
    const Z = ZONES[z];
    if (time > Z.until) {
      ZONES.splice(z, 1);
      continue;
    }
    for (let q = 0; q < 5; q++) {
      const a = Math.random() * TAU,
        rr = Math.sqrt(Math.random()) * Z.r,
        P = { x: Z.x + Math.cos(a) * rr, y: Z.y + Math.sin(a) * rr };
      P.z = W.hAt(P.x, P.y);
      const [px, py] = ePx(P);
      parts.push({
        x: px,
        y: py - 1,
        vx: (Math.random() - 0.5) * 6,
        vy: -18 - Math.random() * 16,
        g: 0,
        life: 0.45,
        max: 0.45,
        color: ['#ff9a3c', '#ffd060', '#ff6a2a', '#fff0a0'][Math.floor(Math.random() * 4)]
      });
    }
  }
  time += dt;
  shake -= dt;
  if (gradeK < 1) gradeK = Math.min(1, gradeK + dt / 1.6);
  if (mode === 'play') {
    updateMe(dt);
    zoneT -= dt;
    saveT -= dt;
    if (saveT <= 0) {
      saveT = 5;
      link.saveNow();
    }
  }
  for (const e of [me, ...others.values()]) {
    const [wx, wy] = ePx(e);
    if (e.lwx == null) {
      e.lwx = wx;
      e.lwy = wy;
      e.svx = 0;
      e.svy = 0;
      e.bph = Math.random() * 3;
    }
    if (dt > 0) {
      e.svx += ((wx - e.lwx) / dt - e.svx) * Math.min(1, dt * 6);
      e.svy += ((wy - e.lwy) / dt - e.svy) * Math.min(1, dt * 6);
    }
    e.lwx = wx;
    e.lwy = wy;
  }
  for (const b of BLOSSOMS) {
    const sx = (b.x - b.y) * 16 - camX + VW / 2,
      sy = (b.x + b.y) * 8 - camY + VH / 2;
    if (sx < -30 || sx > VW + 30 || sy < -40 || sy > VH + 40 || Math.random() > dt * 0.9) continue;
    const [x, y] = ePx(b);
    parts.push({
      x: x + (Math.random() - 0.5) * 26,
      y: y - 30 + Math.random() * 14,
      vx: 6 + Math.random() * 8,
      vy: 5 + Math.random() * 5,
      g: 0,
      life: 3.5,
      max: 3.5,
      color: 'petal',
      ph: Math.random() * TAU
    });
  }
  for (const f of FLIES) {
    const far = Math.abs(f.x - camX) > VW * 0.7 || Math.abs(f.y - camY) > VH * 0.7;
    if (!f.init || far) {
      f.init = true;
      f.x = camX + (Math.random() - 0.5) * VW;
      f.y = camY + (Math.random() - 0.5) * VH;
      f.vx = (Math.random() - 0.5) * 16;
      f.vy = (Math.random() - 0.5) * 10;
    }
    f.vx += (Math.random() - 0.5) * 60 * dt;
    f.vy += (Math.random() - 0.5) * 40 * dt;
    f.vx *= 0.98;
    f.vy *= 0.98;
    f.x += f.vx * dt + Math.sin(time * 2 + f.ph) * 0.2;
    f.y += f.vy * dt + Math.sin(time * 3.1 + f.ph) * 0.15;
  }
  for (const o of others.values()) {
    const px = o.x,
      py = o.y,
      uo = o.t0 != null ? Math.min(1, (time - o.t0) / snapDt) : 1;
    o.x = (o.fx ?? o.tx) + (o.tx - (o.fx ?? o.tx)) * uo;
    o.y = (o.fy ?? o.ty) + (o.ty - (o.fy ?? o.ty)) * uo;
    o.slash -= dt;
    o.atkT -= dt;
    o.spin -= dt;
    o.hitFlash -= dt;
    o.anim = o.moving ? o.anim + dt * 13 : 0;
    o.z += (W.hAt(o.x, o.y) - o.z) * Math.min(1, dt * 15);
    void px;
    void py;
  }
  for (const m of mobs) {
    const dx = m.tx - m.x,
      um = m.t0 != null ? Math.min(1, (time - m.t0) / snapDt) : 1;
    m.x = (m.fx ?? m.tx) + (m.tx - (m.fx ?? m.tx)) * um;
    m.y = (m.fy ?? m.ty) + (m.ty - (m.fy ?? m.ty)) * um;
    if (Math.abs(dx) > 0.01) m.flip = dx - (m.ty - m.y) < 0;
    m.hitFlash -= dt;
    m.lunge -= dt;
    m.z += (W.hAt(m.x, m.y) - m.z) * Math.min(1, dt * 12);
  }
  for (const e of [me, ...others.values()]) {
    const vd = e === me ? !!(me.equip && me.equip.feet && C.ITEMS[me.equip.feet[0]].fx === 'void') : e.voidFx;
    if (!vd || !e.moving || (e === me && mode !== 'play')) continue;
    e.footT = (e.footT || 0) - dt;
    if (e.footT <= 0) {
      e.footT = 0.16;
      e.footSide = !e.footSide;
      const sx2 = e.footSide ? 0.12 : -0.12;
      FOOT.push({ kind: 'foot', x: e.x + sx2, y: e.y - sx2, z: e.z, t: 0 });
      const [px, py] = ePx(e);
      parts.push({
        x: px + (Math.random() - 0.5) * 6,
        y: py - 2,
        vx: (Math.random() - 0.5) * 6,
        vy: -14 - Math.random() * 10,
        g: 0,
        life: 0.9,
        max: 0.9,
        color: 'void'
      });
    }
  }
  for (let i = FOOT.length - 1; i >= 0; i--) {
    FOOT[i].t += dt;
    if (FOOT[i].t > 2.6) FOOT.splice(i, 1);
  }
  for (let i = shots.length - 1; i >= 0; i--) {
    shots[i].t += dt;
    if (shots[i].t > shots[i].dur) shots.splice(i, 1);
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    floats[i].t += dt;
    if (floats[i].t > floats[i].dur) floats.splice(i, 1);
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i];
    q.vy += q.g * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.life -= dt;
    if (q.life <= 0) parts.splice(i, 1);
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    rings[i].t += dt;
    if (rings[i].t > rings[i].dur) rings.splice(i, 1);
  }
  // fumée des cheminées
  for (const ch of CHIMNEYS) {
    ch.t -= dt;
    if (ch.t <= 0) {
      ch.t = 0.35 + Math.random() * 0.4;
      const bx = (ch.i - ch.j) * 16 - ch.h.ax + ch.h.chimney[0],
        by = (ch.i + ch.j) * 8 - ch.z * 8 - ch.h.ay + ch.h.chimney[1];
      parts.push({
        x: bx + (Math.random() - 0.5) * 2,
        y: by,
        vx: 4 + Math.random() * 4,
        vy: -10 - Math.random() * 6,
        g: -2,
        life: 2.2,
        max: 2.2,
        color: 'smoke',
        sz: 1
      });
    }
  }
  let tx, ty;
  if (mode !== 'play') {
    const [cx, cy] = ePx({ x: W.CX, y: W.CY, z: 1 });
    tx = cx + Math.cos(time * 0.12) * 70;
    ty = cy + Math.sin(time * 0.12) * 36;
  } else {
    [tx, ty] = ePx(me);
    ty -= 10;
  }
  // caméra : verrouillée au pixel sur le héros (pas de tremblement), glisse seulement sur les grands sauts
  if (mode === 'play' && Math.hypot(tx - camX, ty - camY) < 24) {
    camX = tx;
    camY = ty;
  } else {
    const k = Math.min(1, dt * 8);
    camX += (tx - camX) * k;
    camY += (ty - camY) * k;
  }
}
