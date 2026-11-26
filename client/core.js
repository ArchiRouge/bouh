/* Pixels Worlds — cœur partagé client / serveur
   Génération déterministe du monde + simulation autoritaire (monstres, combat, progression).
   Utilisé par le serveur Node (require) et par le client en mode solo (window.EtheriaCore). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./content.js'));
  else root.EtheriaCore = factory(root.EtheriaContent);
})(typeof self !== 'undefined' ? self : this, function (K) {
  'use strict';
  // contenu du jeu (content.js) : données des monstres, objets, armes, quêtes, îles et donjons
  const {
    EL_ORDER,
    BEATS,
    EL_STRONG,
    EL_WEAK,
    EL_RESIST,
    EL_SET,
    ZONES,
    ELEMENTS,
    MOBDEF,
    SLOTS,
    SLOT_NAMES,
    RARITY,
    STAT_NAMES,
    BAG_SIZE,
    ITEMS,
    GM_EQUIP,
    GM_BAG,
    LOOT,
    UNIQUE_BOOTS,
    UNIQUE_CHANCE,
    CLASSES,
    FAMS,
    FAM_OF,
    START,
    RES,
    SCARVES,
    RECIPES,
    NPCS,
    QUESTS,
    ISLES,
    FIXED_ISLES,
    DG,
    DG_MYTH,
    DG_BOSSES,
    TITLES,
    DG_ITEM_CH,
    DG_MYTH_IN,
    DG_BOSS_HP
  } = K;
  const VERSION = 7;
  const SEED = 20261121;

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    const xi = Math.floor(x),
      yi = Math.floor(y),
      xf = x - xi,
      yf = y - yi;
    const u = xf * xf * (3 - 2 * xf),
      v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s),
      b = hash(xi + 1, yi, s),
      c = hash(xi, yi + 1, s),
      d = hash(xi + 1, yi + 1, s);
    const t = a + (b - a) * u,
      bo = c + (d - c) * u;
    return t + (bo - t) * v;
  }
  function fbm(x, y, s) {
    return vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15;
  }

  const MW = 56,
    MH = 56,
    CX = 28.5,
    CY = 28.5;
  const SPAWN = { x: 28.5, y: 31.3 };
  // difficulté relevée : PV ×1,7 et attaque ×1,5 par rapport aux débuts du jeu (un héros bien équipé reste à l'aise)
  function mobStats(type, lvl) {
    const D = MOBDEF[type],
      boss = type === 'boss';
    return {
      maxhp: Math.round((18 + lvl * 14) * 1.7 * (boss ? 9 : D.hp || 1)),
      atk: (3 + lvl * 2.4) * 1.5 * (boss ? 1.5 : D.atk || 1),
      xp: Math.round((5 + lvl * 5) * (boss ? 8 : 1) * (0.8 + 0.2 * (D.hp || 1))),
      speed: boss ? 1.7 : (1.25 + lvl * 0.05) * (D.spd || 1),
      aggressive: D.aggr,
      range: boss ? 1.6 : D.sc ? 1.15 : 0.95,
      aggroR: boss ? 4.5 : type === 'champi' ? 2.2 : 3.4,
      respawn: boss ? 60 : 9
    };
  }
  /* ---------------- objets, caractéristiques & équipement ---------------- */
  function itemStats(inst) {
    const T = ITEMS[inst[0]],
      mul = RARITY[inst[1]][2],
      o = {};
    for (const k in T.st) o[k] = Math.max(1, Math.round(T.st[k] * mul));
    return o;
  }
  const itemValue = inst => Math.round((5 + ITEMS[inst[0]].lvl * 4) * RARITY[inst[1]][2]);
  function rollRarity(min) {
    const r = Math.random();
    const v = r < 0.006 ? 3 : r < 0.045 ? 2 : r < 0.22 ? 1 : 0;
    return Math.min(3, Math.max(min || 0, v));
  }
  function cleanInst(a) {
    if (!Array.isArray(a)) return null;
    const t = a[0] | 0,
      r = a[1] | 0;
    if (!(t >= 0 && t < ITEMS.length && r >= 0 && r < RARITY.length)) return null;
    const inst = [t, ITEMS[t].unique ? 4 : Math.min(r, 3)];
    if (ITEMS[t].slot === 'weapon' && Number.isInteger(a[2]) && a[2] >= 0 && a[2] < EL_ORDER.length) inst.push(a[2]); // enchantement
    return inst;
  }
  // élément d'un objet : enchantement (3e case) ou celui du catalogue ; coefficient de dégâts d'un élément contre un autre
  const instEl = inst => (!inst ? null : inst[2] != null ? EL_ORDER[inst[2]] : (ITEMS[inst[0]] && ITEMS[inst[0]].el) || null);
  const elK = (atk, def) => (!atk || !def ? 1 : BEATS[atk] === def ? EL_STRONG : BEATS[def] === atk ? EL_WEAK : 1);
  const MAST_MAX = 20,
    mNeed = l => Math.round(10 * Math.pow(l, 1.7));
  function mTotal(l) {
    let t = 0;
    for (let k = 1; k < l; k++) t += mNeed(k);
    return t;
  }
  const MAST_CAP = mTotal(MAST_MAX);
  function mLevel(total) {
    let lv = 1,
      t = total | 0;
    while (lv < MAST_MAX && t >= mNeed(lv)) {
      t -= mNeed(lv);
      lv++;
    }
    return { lv, cur: t, need: lv < MAST_MAX ? mNeed(lv) : 0 };
  }
  /* ---------------- rangs de compétence : chaque technique progresse en l'utilisant ----------------
     Rang 1 à 10 ; du rang r au rang r+1 : 26 × r^1,6 points (environ 1 200 utilisations utiles pour le rang 10).
     Plafond tenu par le niveau du héros : rang max = 1 + niveau / 5 (rang 10 au niveau 45). Au plafond, l'expérience
     remplit encore le rang suivant (« prête à monter ») et la compétence monte dès le niveau requis.
     Chaque rang : +5 % de puissance (dégâts, soins, durées) et −3 % de recharge (plus l'Intelligence). Paliers aux rangs 4 et 8 (à venir). */
  const SK_MAX = 10,
    skNeed = r => Math.round(26 * Math.pow(r, 1.6));
  function skTotal(r) {
    let t = 0;
    for (let k = 1; k < r; k++) t += skNeed(k);
    return t;
  }
  const skCap = lvl => Math.min(SK_MAX, 1 + Math.floor(Math.max(1, lvl) / 5)),
    skLvlFor = r => 5 * (r - 1);
  function skRank(total, cap) {
    let r = 1;
    while (r < SK_MAX && total >= skTotal(r + 1)) r++;
    return Math.min(r, cap || SK_MAX);
  }
  function skInfo(total, lvl) {
    const cap = skCap(lvl),
      raw = skRank(total),
      r = Math.min(raw, cap),
      next = r < SK_MAX ? skTotal(r + 1) : 0;
    return {
      r,
      cap,
      cur: r < SK_MAX ? total - skTotal(r) : 0,
      need: r < SK_MAX ? skNeed(r) : 0,
      ready: r < SK_MAX && total >= next,
      lvlNext: r < SK_MAX ? skLvlFor(r + 1) : 0
    };
  }
  // temps de recharge d'une technique : −3 % par rang (usage) et jusqu'à −40 % avec l'Intelligence (int / (int + 150))
  const intCdK = intel => Math.min(0.4, Math.max(0, intel || 0) / ((intel || 0) + 150));
  const techCd = (base, rank, intel, minus) =>
    Math.max(0.5, Math.round((base * (1 - 0.03 * (rank - 1)) * (1 - intCdK(intel)) - (minus || 0)) * 10) / 10);
  function weaponFam(equip) {
    const w = equip && equip.weapon,
      T = w && ITEMS[w[0]];
    return T ? FAM_OF[T.icon] || 'sword' : 'none';
  }
  function kitOf(equip, mast, bar, sk, lvl, skc, intel) {
    const fam = weaponFam(equip),
      F = FAMS[fam],
      ml = mLevel((mast || {})[fam] || 0).lv,
      T = F.tech,
      cap = skCap(lvl || 1);
    const ranked = i => {
      const key = fam + ':' + i,
        r = skRank((sk || {})[key] || 0, cap),
        ch = (skc || {})[key] || [],
        M = {},
        Tm = T[i].ms;
      if (Tm)
        for (let j = 0; j < 2; j++)
          if (r >= (j ? 8 : 4) && ch[j] >= 0 && Tm[j][ch[j]]) {
            const mo = Tm[j][ch[j]].mods;
            for (const k in mo) M[k] = typeof mo[k] === 'number' && typeof M[k] === 'number' ? M[k] + mo[k] : mo[k];
          }
      const A = Object.assign({ ti: i, rank: r, pw: 1 + 0.05 * (r - 1) }, T[i]);
      A.mods = M;
      A.pending = Tm ? [0, 1].filter(j => r >= (j ? 8 : 4) && !(ch[j] >= 0)) : [];
      A.cd = techCd(T[i].cd, r, intel, M.cd);
      if (A.r != null || M.r) A.r = (A.r || 0) + (M.r || 0);
      if (A.range != null) A.range += M.range || 0;
      return A;
    };
    const open = T.map((A, i) => i).filter(i => T[i].m <= ml),
      want = (bar && bar[fam]) || [],
      pick = [];
    for (const i of want) if (open.includes(i) && !pick.includes(i) && pick.length < 3) pick.push(i);
    for (const i of open) if (!pick.includes(i) && pick.length < 3) pick.push(i);
    const ab = pick.map(ranked);
    for (let i = 0; i < T.length && ab.length < 3; i++) if (!pick.includes(i)) ab.push(Object.assign({ ti: i, locked: 1 }, T[i]));
    while (ab.length < 3) ab.push({ ti: -1, name: '—', icon: 'slash', m: 99, mp: 0, cd: 1, locked: 1, desc: '' });
    return { fam, F, ml, name: F.name, basic: F.basic, ab };
  }
  const freePts = (lvl, pts) => 3 * (Math.max(1, lvl) - 1) - ((pts.str | 0) + (pts.sta | 0) + (pts.int | 0) + (pts.agi | 0));
  const respecCost = lvl => 25 * lvl;
  function computeStats(lvl, equip, pts) {
    pts = pts && typeof pts === 'object' ? pts : {};
    const s = { str: 5 + (pts.str | 0), sta: 5 + (pts.sta | 0), int: 5 + (pts.int | 0), agi: 5 + (pts.agi | 0), armor: 0 };
    const fam = weaponFam(equip),
      on = sl => equip && equip[sl] && (sl !== 'offhand' || fam === 'sword');
    for (const sl of SLOTS)
      if (on(sl)) {
        const st = itemStats(equip[sl]);
        for (const k in st) s[k] += st[k];
      }
    let speed = 1;
    for (const sl of SLOTS) if (on(sl) && ITEMS[equip[sl][0]].speed) speed += ITEMS[equip[sl][0]].speed;
    for (const k in s) s[k] = Math.floor(s[k]);
    // éléments : celui de l'arme ; chaque pièce d'armure protège de son élément ; 3 pièces assorties = bonus, 5 = aura
    const res = {},
      cnt = {};
    for (const sl of SLOTS) {
      if (sl === 'weapon' || !on(sl)) continue;
      const e = instEl(equip[sl]);
      if (e) {
        res[e] = (res[e] || 0) + EL_RESIST;
        cnt[e] = (cnt[e] || 0) + 1;
      }
    }
    let setEl = null,
      setN = 0;
    for (const e in cnt)
      if (cnt[e] > setN) {
        setN = cnt[e];
        setEl = e;
      }
    const st = FAMS[fam].stat,
      atk = st === 'agi' ? 2 + s.agi * 1.6 + s.str * 0.5 : st === 'int' ? 2 + s.int * 1.6 + s.str * 0.3 : 2 + s.str * 1.5;
    return {
      speed,
      stats: s,
      maxhp: Math.round(20 + s.sta * 10),
      maxmp: Math.round(15 + s.int * 5),
      atk,
      crit: Math.min(0.5, 0.06 + s.agi * 0.006),
      red: s.armor / (s.armor + 60),
      el: on('weapon') ? instEl(equip.weapon) : null,
      res,
      setEl: setN >= EL_SET[0] ? setEl : null,
      setN
    };
  }
  /* ---------------- cueillette, marche réelle & artisanat ---------------- */
  const STEPS_PER_ETHER = 100,
    DAILY_STEP_CAP = 12000,
    DAILY_GIFT = 15,
    ETHER_MAX = 300,
    NODE_CD = 90;
  const gNeed = l => 10 + l * 8;
  const dayKey = () => new Date().toISOString().slice(0, 10);
  // niveau max 50, au moins ~50 h de jeu : environ 1 h pour le niveau 10, 6 h pour le 20, 37 h pour le 40, 60 h et plus pour le 50
  const MAX_LVL = 50,
    xpNeed = l => Math.round(14 * Math.pow(l, 2.5));
  const LOOK_MAX = [3, 7, 7, 3, 4]; // coiffure, couleur cheveux, tenue, peau, chapeau
  /* Apparence de l'équipement (visible en jeu) : tête, torse, jambes, pieds, arme, main gauche → « t.r » par emplacement, « - » si vide. */
  const GEAR_SLOTS = ['head', 'chest', 'legs', 'feet', 'weapon', 'offhand'];
  function gearStr(equip) {
    return GEAR_SLOTS.map(sl => {
      const it = equip && equip[sl];
      return it && ITEMS[it[0]] ? it[0] + '.' + it[1] : '-';
    }).join(',');
  }
  function parseGear(str) {
    const o = {};
    String(str || '')
      .split(',')
      .forEach((v, i) => {
        const m = /^(\d+)\.(\d)$/.exec(v);
        if (m && GEAR_SLOTS[i] && ITEMS[+m[1]] && ITEMS[+m[1]].slot === GEAR_SLOTS[i]) o[GEAR_SLOTS[i]] = [+m[1], +m[2]];
      });
    return o;
  }
  function cleanLook(l) {
    const a = Array.isArray(l) ? l : [];
    return LOOK_MAX.map((m, i) => {
      const v = a[i] | 0;
      return v >= 0 && v < m ? v : 0;
    });
  }
  function cleanName(n) {
    const s = String(n || '')
      .replace(/[^A-Za-z0-9_\- àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ]/g, '')
      .trim()
      .slice(0, 12);
    return s || 'Aventurier';
  }
  const BAD = ['merde', 'pute', 'connard', 'connasse', 'encule', 'enculé', 'salope', 'fuck', 'shit', 'bitch', 'nigger', 'nazi'];
  function cleanChat(t) {
    let s = String(t || '')
      .replace(/[\u0000-\u001f]/g, '')
      .trim()
      .slice(0, 80);
    for (const w of BAD) s = s.replace(new RegExp(w, 'gi'), '*'.repeat(w.length));
    return s;
  }

  /* ---------------- îles et ponts ----------------
     Le Pont d'Éther (violet) tire une île au hasard à chaque passage et coûte de l'Éther (gagné en marchant) ;
     le Pont du Bourg (doré) ramène toujours au Bourg d'Argel. 90 % : une île fixe ; 10 % : une île éphémère. */
  const ETHER_BRIDGE = 3,
    BRIDGE_LEN = 4;
  const ISLE_BIT = { bourg: 1, givre: 2, braise: 4, brume: 8, donjon: 16 };
  // île propre : { k } ; île éphémère : { k, s } ; donjon : { k, s (graine), r (rareté), b (boss), f (île d'où l'on vient) }
  function cleanIsle(o) {
    if (!o || !ISLES[o.k]) return { k: 'bourg' };
    if (o.k === 'donjon') {
      const f = cleanIsle(o.f);
      return {
        k: 'donjon',
        s: o.s >>> 0 || 1,
        r: clampInt(o.r, 0, DG.length - 1),
        b: clampInt(o.b, 0, DG_BOSSES.length - 1),
        f: f.k === 'donjon' || f.k === 'bourg' ? { k: 'givre' } : f
      };
    }
    return ISLES[o.k].eph ? { k: o.k, s: o.s >>> 0 || 1 } : { k: o.k };
  }
  const isleName = i => (i && i.k === 'donjon' ? DG[i.r].name : (ISLES[i && i.k] || ISLES.bourg).name);

  /* ---------------- donjons (docs/design/donjons.md) ----------------
     Une entrée au centre de chaque île du Pont d'Éther ; rareté tirée à chaque arrivée (couleurs des objets).
     Labyrinthe de n×n salles, couloirs de 2 cases ; le boss attend dans la salle la plus éloignée de l'entrée. */
  const dgTier = b => {
    const r = DG_BOSSES[b].r;
    return r === 5 ? DG_MYTH : DG[r];
  };
  // tirage à l'arrivée sur une île : rareté du donjon, puis son boss (souvent du même rang, parfois un cran au-dessus, rarement mythique)
  function rollDungeon() {
    let x = Math.random() * 100,
      r = 0;
    while (r < DG.length - 1 && x >= DG[r].w) {
      x -= DG[r].w;
      r++;
    }
    let br = r;
    if (Math.random() < 1 / DG_MYTH_IN[r]) br = 5;
    else if (r < 4 && Math.random() < 0.12) br = r + 1;
    const pool = DG_BOSSES.map((o, i) => i).filter(i => DG_BOSSES[i].r === br);
    return { s: (Math.random() * 4294967295) >>> 0 || 1, r, b: pool[Math.floor(Math.random() * pool.length)], done: 0 };
  }
  function cleanDg(o) {
    if (!o || typeof o !== 'object') return null;
    return { s: o.s >>> 0 || 1, r: clampInt(o.r, 0, DG.length - 1), b: clampInt(o.b, 0, DG_BOSSES.length - 1), done: o.done ? 1 : 0 };
  }
  function buildDungeon(I) {
    const T = DG[I.r],
      rnd = mulberry32(I.s),
      n = T.size,
      N = 3 * n + 1,
      o0 = Math.floor((MW - N) / 2),
      MN = MW * MH;
    const TY = new Uint8Array(MN).fill(3),
      HT = new Uint8Array(MN).fill(3),
      SOL = new Uint8Array(MN).fill(1);
    const idx = (i, j) => j * MW + i,
      inb = (i, j) => i >= 0 && j >= 0 && i < MW && j < MH;
    const floor = (i, j) => {
      SOL[idx(i, j)] = 0;
      HT[idx(i, j)] = 0;
    };
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++)
        if (i < o0 || j < o0 || i >= o0 + N || j >= o0 + N) {
          TY[idx(i, j)] = 0;
          HT[idx(i, j)] = 0;
        } // hors du labyrinthe : le vide
    const T0 = c => o0 + 3 * c + 1; // première case d'une salle
    const links = new Set(),
      lk = (a, b) => (a < b ? a + ',' + b : b + ',' + a),
      cid = (x, y) => y * n + x;
    const open = (cx, cy) => {
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) floor(T0(cx) + x, T0(cy) + y);
    };
    const join = (ax, ay, bx, by) => {
      links.add(lk(cid(ax, ay), cid(bx, by)));
      for (let k = 0; k < 2; k++) {
        if (bx !== ax) floor(o0 + 3 * Math.max(ax, bx), T0(ay) + k);
        else floor(T0(ax) + k, o0 + 3 * Math.max(ay, by));
      }
    };
    const ADJ = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ],
      inC = (x, y) => x >= 0 && y >= 0 && x < n && y < n;
    // labyrinthe parfait (parcours en profondeur), puis quelques murs ouverts pour créer des boucles
    const start = [n >> 1, n - 1],
      seen = new Uint8Array(n * n),
      st = [start];
    seen[cid(...start)] = 1;
    open(...start);
    while (st.length) {
      const [cx, cy] = st[st.length - 1],
        nb = ADJ.map(([a, b]) => [cx + a, cy + b]).filter(([x, y]) => inC(x, y) && !seen[cid(x, y)]);
      if (!nb.length) {
        st.pop();
        continue;
      }
      const [nx, ny] = nb[Math.floor(rnd() * nb.length)];
      seen[cid(nx, ny)] = 1;
      open(nx, ny);
      join(cx, cy, nx, ny);
      st.push([nx, ny]);
    }
    for (let cy = 0; cy < n; cy++)
      for (let cx = 0; cx < n; cx++)
        for (const [a, b] of [
          [1, 0],
          [0, 1]
        ])
          if (inC(cx + a, cy + b) && rnd() < T.loops) join(cx, cy, cx + a, cy + b);
    const nbs = (cx, cy) => ADJ.map(([a, b]) => [cx + a, cy + b]).filter(([x, y]) => inC(x, y) && links.has(lk(cid(cx, cy), cid(x, y))));
    const dist = new Int32Array(n * n).fill(-1),
      q = [start];
    dist[cid(...start)] = 0;
    for (let h = 0; h < q.length; h++) {
      const [cx, cy] = q[h];
      for (const [x, y] of nbs(cx, cy))
        if (dist[cid(x, y)] < 0) {
          dist[cid(x, y)] = dist[cid(cx, cy)] + 1;
          q.push([x, y]);
        }
    }
    let far = start;
    for (let i = 0; i < n * n; i++) if (dist[i] > dist[cid(...far)]) far = [i % n, (i / n) | 0];
    // salle du boss : 2×2 salles d'un seul tenant
    const bx = Math.min(far[0], n - 2),
      by = Math.min(far[1], n - 3);
    for (let j = T0(by); j <= T0(by) + 4; j++) for (let i = T0(bx); i <= T0(bx) + 4; i++) floor(i, j);
    const inBoss = (cx, cy) => cx >= bx && cx <= bx + 1 && cy >= by && cy <= by + 1;
    const spawn = { x: T0(start[0]) + 1, y: T0(start[1]) + 0.4 },
      portal = { x: T0(start[0]) + 1, y: T0(start[1]) + 1.7 };
    const spawns = [],
      used = new Set();
    const put = (type, cx, cy, o) => {
      const i = T0(cx) + Math.floor(rnd() * 2),
        j = T0(cy) + Math.floor(rnd() * 2);
      used.add(cid(cx, cy));
      spawns.push(Object.assign({ type, lvl: 1, i, j }, o));
    };
    const ends = [];
    for (let cy = 0; cy < n; cy++)
      for (let cx = 0; cx < n; cx++) if (nbs(cx, cy).length === 1 && dist[cid(cx, cy)] > 1 && !inBoss(cx, cy)) ends.push([cx, cy]);
    ends.sort((a, b) => dist[cid(...b)] - dist[cid(...a)]);
    for (const [cx, cy] of ends.slice(0, T.elite)) put(T.mobs[Math.floor(rnd() * T.mobs.length)], cx, cy, { elite: 1 });
    for (let cy = 0; cy < n; cy++)
      for (let cx = 0; cx < n; cx++) {
        const c0 = cid(cx, cy);
        if (used.has(c0) || dist[c0] < 2 || inBoss(cx, cy)) continue;
        if (rnd() < 0.55) put(T.mobs[Math.floor(rnd() * T.mobs.length)], cx, cy);
      }
    const B = DG_BOSSES[I.b],
      bossK = spawns.length;
    spawns.push({ type: B.type, lvl: 1, i: T0(bx) + 2, j: T0(by) + 2, boss: 1, bi: I.b });
    const chest = { x: T0(bx) + 4, y: T0(by) + 1 },
      exit = { x: T0(bx) + 1, y: T0(by) + 4 };
    // pièges à pointes dans les passages entre deux salles (Rare et plus)
    const traps = [],
      pass = [];
    for (const key of links) {
      const [a, b] = key.split(',').map(Number),
        ax = a % n,
        ay = (a / n) | 0,
        bx2 = b % n,
        by2 = (b / n) | 0;
      if (dist[a] < 2 || inBoss(ax, ay) || inBoss(bx2, by2)) continue;
      for (let k = 0; k < 2; k++)
        pass.push(bx2 !== ax ? [o0 + 3 * Math.max(ax, bx2), T0(ay) + k] : [T0(ax) + k, o0 + 3 * Math.max(ay, by2)]);
    }
    for (let k = 0; k < T.trap && pass.length; k++) {
      const [i, j] = pass.splice(Math.floor(rnd() * pass.length), 1)[0];
      traps.push({ i, j, ph: Math.floor(rnd() * 30) / 10 });
    }
    // torches sur les faces visibles des murs, cristaux aux carrefours
    const torches = [],
      crystals = [];
    for (let j = 1; j < MH - 1; j++)
      for (let i = 1; i < MW - 1; i++) {
        const k = idx(i, j);
        if (!SOL[k]) continue;
        const fx = !SOL[idx(i + 1, j)],
          fy = !SOL[idx(i, j + 1)];
        if ((fx || fy) && hash(i, j, 77) < 0.09 && !torches.some(o => Math.abs(o.i - i) + Math.abs(o.j - j) < 4))
          torches.push({ i, j, side: fy ? 'y' : 'x' });
      }
    for (let cy = 0; cy < n; cy++)
      for (let cx = 0; cx < n; cx++) if (nbs(cx, cy).length >= 3 && !inBoss(cx, cy)) crystals.push({ x: T0(cx) + 1, y: T0(cy) + 1 });
    for (const [a, b] of [
      [0, 0],
      [4, 0],
      [0, 4],
      [4, 4]
    ])
      crystals.push({ x: T0(bx) + a + 0.5, y: T0(by) + b + 0.5 });
    const hAt = (x, y) => {
      const i = Math.floor(x),
        j = Math.floor(y);
      return inb(i, j) ? HT[idx(i, j)] : 0;
    };
    return {
      MW,
      MH,
      CX,
      CY,
      TY,
      HT,
      SOL,
      props: [],
      spawns,
      nodes: [],
      idx,
      inb,
      tdist: (i, j) => Math.hypot(i + 0.5 - CX, j + 0.5 - CY),
      walkable: (i, j) => inb(i, j) && !SOL[idx(i, j)],
      hAt,
      zoneOf: () => T.name,
      isle: 'donjon',
      theme: 'donjon',
      bridges: [],
      spawn,
      chest,
      seed: I.s,
      tier: I.r,
      dg: { portal, exit, bossK, traps, torches, crystals, o0, N, n, boss: B }
    };
  }
  function rollIsle(cur) {
    if (Math.random() < 0.1) return { k: 'brume', s: (Math.random() * 4294967295) >>> 0 || 1 };
    const pool = FIXED_ISLES.filter(k => k !== cur);
    return { k: pool[Math.floor(Math.random() * pool.length)] };
  }
  // pont le long d'un axe (« x » : vers le bas-droite de l'écran, « y » : vers le bas-gauche), depuis une rive basse
  function findBridge(TY, HT, SOL, idx, inb, axis, avoid, prefer, okHead) {
    const di = axis === 'x' ? 1 : 0,
      dj = axis === 'x' ? 0 : 1;
    let best = null,
      bs = -1e9;
    for (let j = 1; j < MH - 1; j++)
      for (let i = 1; i < MW - 1; i++) {
        const k = idx(i, j);
        if (SOL[k] || TY[k] === 0 || HT[k] > 1) continue;
        if (okHead && !okHead(i, j)) continue;
        let ok = true;
        for (let s = 1; s <= BRIDGE_LEN + 1 && ok; s++) {
          const a = i + di * s,
            b = j + dj * s;
          if (!inb(a, b) || TY[idx(a, b)] !== 0) ok = false;
          if (ok && s >= 2)
            for (const o of [-1, 1]) {
              const a2 = a + dj * o,
                b2 = b + di * o;
              if (inb(a2, b2) && TY[idx(a2, b2)] !== 0) ok = false;
            }
        }
        if (!ok || (avoid && Math.hypot(i - avoid.i, j - avoid.j) < 8)) continue;
        const sc = i + j - (prefer ? Math.abs((axis === 'x' ? j : i) - prefer) * 3 : 0);
        if (sc > bs) {
          bs = sc;
          best = { i, j };
        }
      }
    if (!best) return null;
    const { i, j } = best;
    return {
      i,
      j,
      di,
      dj,
      L: BRIDGE_LEN,
      hx: i + 0.5,
      hy: j + 0.5,
      ex: i + di * BRIDGE_LEN + 0.5,
      ey: j + dj * BRIDGE_LEN + 0.5,
      ix: i - di + 0.5,
      iy: j - dj + 0.5
    };
  }
  function layDeck(b, SOL, HT, idx) {
    for (let s = 1; s <= b.L; s++) {
      const k = idx(b.i + b.di * s, b.j + b.dj * s);
      SOL[k] = 0;
      HT[k] = 0;
    }
  }
  // îles du voyage : même taille de carte, relief et décor selon le thème, sans village
  function buildIsle(key, seed) {
    const I = ISLES[key],
      rnd = mulberry32(seed),
      N = MW * MH;
    const TY = new Uint8Array(N),
      HT = new Uint8Array(N),
      SOL = new Uint8Array(N);
    const idx = (i, j) => j * MW + i,
      inb = (i, j) => i >= 0 && j >= 0 && i < MW && j < MH,
      tdist = (i, j) => Math.hypot(i + 0.5 - CX, j + 0.5 - CY);
    const s1 = (rnd() * 1000) | 0,
      s2 = (rnd() * 1000) | 0;
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++) {
        const k = idx(i, j),
          d = (tdist(i, j) / (MW / 2)) * 1.08;
        let n = 0.6 * fbm(i / 9, j / 9, s1) + 0.4 * fbm(i / 4.5, j / 4.5, s2);
        n = n * 0.55 + (1 - d) * 0.74 - 0.03;
        if (n < 0.3 || d > 0.97) {
          TY[k] = 0;
          HT[k] = 0;
        } else if (n < 0.36) {
          TY[k] = 1;
          HT[k] = 0;
        } else {
          TY[k] = 2;
          HT[k] = n < 0.5 ? 1 : n < 0.62 ? 2 : 3;
        }
      }
    for (let it = 0; it < 8; it++)
      for (let j = 0; j < MH; j++)
        for (let i = 0; i < MW; i++) {
          const k = idx(i, j);
          if (!TY[k]) continue;
          let m = 9;
          for (const [a, b] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
          ])
            if (inb(i + a, j + b)) m = Math.min(m, HT[idx(i + a, j + b)]);
          if (HT[k] > m + 1) HT[k] = m + 1;
        }
    for (let k = 0; k < N; k++) if (TY[k] === 0) SOL[k] = 1;
    // zone accessible à pied depuis une case (mêmes règles que le héros : pas d'obstacle, marche d'au plus 1 niveau)
    const reachFrom = (i0, j0) => {
      const R = new Uint8Array(N),
        par = new Int32Array(N).fill(-1),
        q = [idx(i0, j0)];
      R[q[0]] = 1;
      for (let h = 0; h < q.length; h++) {
        const k = q[h],
          i = k % MW,
          j = (k / MW) | 0;
        for (const [a, b] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1]
        ]) {
          const x = i + a,
            y = j + b;
          if (!inb(x, y)) continue;
          const k2 = idx(x, y);
          if (R[k2] || SOL[k2] || Math.abs(HT[k2] - HT[k]) > 1) continue;
          R[k2] = 1;
          par[k2] = k;
          q.push(k2);
        }
      }
      return { R, par };
    };
    const inland = (i, j, di, dj) => {
      const a = i - di,
        b = j - dj;
      return inb(a, b) && TY[idx(a, b)] !== 0 && Math.abs(HT[idx(a, b)] - HT[idx(i, j)]) <= 1;
    };
    // arrivée (Pont d'Éther) et Pont du Bourg choisis ensemble : le second doit être atteignable à pied depuis la première,
    // dans une partie de l'île assez grande (on essaie d'autres rives sinon)
    const tried = new Set();
    let eb = null,
      hb = null,
      R0 = null;
    for (let t = 0; t < 16 && !hb; t++) {
      eb = findBridge(TY, HT, SOL, idx, inb, 'x', null, null, (i, j) => inland(i, j, 1, 0) && !tried.has(i + ',' + j));
      if (!eb) break;
      tried.add(eb.i + ',' + eb.j);
      R0 = reachFrom(eb.i - 1, eb.j);
      let size = 0;
      for (let k = 0; k < N; k++) size += R0.R[k];
      if (size >= 200) hb = findBridge(TY, HT, SOL, idx, inb, 'y', eb, null, (i, j) => R0.R[idx(i, j)] && inland(i, j, 0, 1));
    }
    if (!hb) {
      eb = findBridge(TY, HT, SOL, idx, inb, 'x', null, null, (i, j) => inland(i, j, 1, 0));
      R0 = eb ? reachFrom(eb.i - 1, eb.j) : null;
      hb = findBridge(TY, HT, SOL, idx, inb, 'y', eb, null);
    }
    const bridges = [];
    if (eb) {
      eb.kind = 'ether';
      bridges.push(eb);
    }
    const spawn = eb ? { x: eb.ix, y: eb.iy } : { x: CX, y: CY };
    if (hb) {
      hb.kind = 'home';
      bridges.push(hb);
    }
    for (const b of bridges) layDeck(b, SOL, HT, idx);
    const keep = new Uint8Array(N);
    const path = (i0, j0) => {
      if (R0 && R0.R[idx(i0, j0)])
        for (let k = idx(i0, j0); k >= 0; k = R0.par[k]) {
          const i = k % MW,
            j = (k / MW) | 0;
          for (const [a, b] of [
            [0, 0],
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
          ])
            if (inb(i + a, j + b)) keep[idx(i + a, j + b)] = 1;
        }
    };
    if (hb) path(hb.i, hb.j);
    // entrée du donjon : la case la plus proche du centre avec un parvis plat de 5×5 atteignable à pied
    let gate = null;
    if (R0) {
      let bd = 1e9;
      for (let j = 3; j < MH - 3; j++)
        for (let i = 3; i < MW - 3; i++) {
          const d = Math.hypot(i + 0.5 - CX, j + 0.5 - CY);
          if (d >= bd || !R0.R[idx(i, j)]) continue;
          let ok = true;
          for (let b = -2; b <= 2 && ok; b++)
            for (let a = -2; a <= 2 && ok; a++) {
              const k = idx(i + a, j + b);
              if (
                TY[k] !== 2 ||
                SOL[k] ||
                HT[k] !== HT[idx(i, j)] ||
                bridges.some(o => Math.hypot(i + a + 0.5 - o.ix, j + b + 0.5 - o.iy) < 3)
              )
                ok = false;
            }
          if (ok) {
            bd = d;
            gate = { i, j, x: i + 0.5, y: j + 0.5 };
          }
        }
    }
    if (gate) {
      path(gate.i + 1, gate.j + 1);
      for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) keep[idx(gate.i + a, gate.j + b)] = 1;
      SOL[idx(gate.i, gate.j)] = 1;
    }
    const near = (i, j, r) =>
      bridges.some(b => Math.hypot(i + 0.5 - b.ix, j + 0.5 - b.iy) < r || Math.hypot(i + 0.5 - b.hx, j + 0.5 - b.hy) < r) ||
      (gate && Math.hypot(i + 0.5 - gate.x, j + 0.5 - gate.y) < r + 1);
    const props = [];
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++) {
        const k = idx(i, j);
        if (TY[k] !== 2 || SOL[k] || near(i, j, 2.6) || keep[k]) continue;
        const r = rnd();
        if (r < 0.11) {
          const t = I.trees[Math.floor(rnd() * I.trees.length)];
          SOL[k] = 1;
          props.push({ type: t, i, j, v: Math.floor(rnd() * 3), w: 1, h: 1 });
        } else if (r < 0.14) {
          SOL[k] = 1;
          props.push({ type: 'bush', i, j, v: Math.floor(rnd() * 3), w: 1, h: 1 });
        }
      }
    const walkable = (i, j) => inb(i, j) && !SOL[idx(i, j)];
    const R1 = reachFrom(Math.floor(spawn.x), Math.floor(spawn.y)).R; // monstres, cueillette et coffre : seulement là où l'on peut marcher
    const cand = [];
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++)
        if (
          walkable(i, j) &&
          R1[idx(i, j)] &&
          TY[idx(i, j)] === 2 &&
          Math.hypot(i + 0.5 - spawn.x, j + 0.5 - spawn.y) > 5 &&
          !near(i, j, 3)
        )
          cand.push([i, j]);
    for (let i = cand.length - 1; i > 0; i--) {
      const r = Math.floor(rnd() * (i + 1));
      [cand[i], cand[r]] = [cand[r], cand[i]];
    }
    const spawns = [];
    for (const c of cand) {
      if (spawns.every(p => Math.hypot(p.i - c[0], p.j - c[1]) > 2.7))
        spawns.push({ type: I.mobs[Math.floor(rnd() * I.mobs.length)], lvl: 1, i: c[0], j: c[1] });
      if (spawns.length >= 30) break;
    }
    const nodes = [],
      taken = new Set(spawns.map(s => s.i + ',' + s.j));
    for (const [i, j] of cand) {
      if (nodes.length >= 9) break;
      if (taken.has(i + ',' + j) || nodes.some(n => Math.hypot(n.x - i - 0.5, n.y - j - 0.5) < 4)) continue;
      nodes.push({ k: nodes.length, res: I.res[nodes.length % I.res.length], x: i + 0.3 + rnd() * 0.4, y: j + 0.3 + rnd() * 0.4 });
      taken.add(i + ',' + j);
    }
    let chest = null;
    if (I.eph) {
      let bd = -1;
      for (const [i, j] of cand) {
        const d = Math.hypot(i + 0.5 - spawn.x, j + 0.5 - spawn.y);
        if (d > bd && !taken.has(i + ',' + j)) {
          bd = d;
          chest = { x: i + 0.5, y: j + 0.5 };
        }
      }
    }
    const hAt = (x, y) => {
      const i = Math.floor(x),
        j = Math.floor(y);
      return inb(i, j) ? HT[idx(i, j)] : 0;
    };
    return {
      MW,
      MH,
      CX,
      CY,
      TY,
      HT,
      SOL,
      props,
      spawns,
      nodes,
      idx,
      inb,
      tdist,
      walkable,
      hAt,
      zoneOf: () => I.name,
      isle: key,
      theme: I.theme,
      bridges,
      spawn,
      chest,
      gate
    };
  }

  /* ---------------- monde ---------------- */
  // isle : { k, s } (île du voyage) ; sans argument, l'île d'origine (Bourg d'Argel), toujours identique
  function buildWorld(seed, isle) {
    if (isle && isle.k === 'donjon') return buildDungeon(cleanIsle(isle));
    if (isle && isle.k && isle.k !== 'bourg' && ISLES[isle.k]) return buildIsle(isle.k, ISLES[isle.k].eph ? isle.s : ISLES[isle.k].seed);
    const rnd = mulberry32(seed || SEED);
    const N = MW * MH;
    const TY = new Uint8Array(N),
      HT = new Uint8Array(N),
      SOL = new Uint8Array(N);
    const idx = (i, j) => j * MW + i,
      inb = (i, j) => i >= 0 && j >= 0 && i < MW && j < MH;
    const tdist = (i, j) => Math.hypot(i + 0.5 - CX, j + 0.5 - CY);
    // types : 0 eau, 1 sable, 2 herbe, 3 pavés, 4 chemin de terre
    const s1 = (rnd() * 1000) | 0,
      s2 = (rnd() * 1000) | 0;
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++) {
        const k = idx(i, j),
          td = tdist(i, j),
          d = td / (MW / 2);
        let n = 0.6 * fbm(i / 11, j / 11, s1) + 0.4 * fbm(i / 5, j / 5, s2);
        n = n * 0.55 + (1 - d) * 0.72 - 0.03;
        const onAxis = Math.abs(i + 0.5 - CX) < 1.3 || Math.abs(j + 0.5 - CY) < 1.3;
        if (td < 9) {
          HT[k] = 1;
          TY[k] = td < 4.6 || onAxis ? 3 : 2;
        } else if (n < 0.3 || d > 0.97) {
          TY[k] = 0;
          HT[k] = 0;
        } else if (n < 0.36) {
          TY[k] = 1;
          HT[k] = 0;
        } else {
          TY[k] = onAxis && td < 15 ? 4 : 2;
          HT[k] = n < 0.52 ? 1 : n < 0.64 ? 2 : 3;
        }
      }
    for (let it = 0; it < 8; it++)
      for (let j = 0; j < MH; j++)
        for (let i = 0; i < MW; i++) {
          const k = idx(i, j);
          if (!TY[k]) continue;
          let m = 9;
          for (const [a, b] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
          ])
            if (inb(i + a, j + b)) m = Math.min(m, HT[idx(i + a, j + b)]);
          if (HT[k] > m + 1) HT[k] = m + 1;
        }
    for (let k = 0; k < N; k++) if (TY[k] === 0) SOL[k] = 1;

    const props = [];
    const place = (type, i, j, v, w, h) => {
      w = w || 1;
      h = h || 1;
      for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) SOL[idx(i + a, j + b)] = 1;
      props.push({ type, i, j, v: v || 0, w, h });
    };
    place('fountain', 28, 28);
    [
      [22, 22, 0],
      [33, 22, 1],
      [22, 33, 2],
      [33, 33, 3]
    ].forEach(([i, j, v]) => place('house', i, j, v, 2, 2));
    [
      [26, 26],
      [31, 26],
      [26, 31],
      [31, 31],
      [28, 21],
      [21, 28]
    ].forEach(([i, j]) => place('lamp', i, j));
    [
      [24, 22, 0],
      [21, 24, 1],
      [35, 24, 0],
      [32, 35, 1],
      [24, 35, 0],
      [35, 32, 1],
      [25, 22, 1]
    ].forEach(([i, j, v]) => place(v ? 'crate' : 'barrel', i, j));
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++) {
        const k = idx(i, j);
        if (TY[k] !== 2 || SOL[k] || tdist(i, j) < 10.5) continue;
        const td = tdist(i, j),
          r = rnd();
        const dens = td < 15 ? 0.06 : td < 20.5 ? 0.15 : 0.08;
        if (r < dens) {
          const r2 = rnd();
          const kind = HT[k] >= 3 || (td > 20.5 && r2 < 0.5) ? 'pine' : r2 < 0.16 ? 'blossom' : 'oak';
          place(kind, i, j, Math.floor(rnd() * 3));
        } else if (r < dens + 0.02) place('rock', i, j, Math.floor(rnd() * 3));
        else if (r < dens + 0.045) place('bush', i, j, Math.floor(rnd() * 3));
      }
    const walkable = (i, j) => inb(i, j) && !SOL[idx(i, j)];
    // points d'apparition des monstres
    const cand = [];
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++) if (walkable(i, j) && TY[idx(i, j)] === 2 && tdist(i, j) > 10.5) cand.push([i, j]);
    const byDist = cand.slice().sort((a, b) => tdist(b[0], b[1]) - tdist(a[0], a[1]));
    const bossPt =
      byDist.find(([i, j]) =>
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [-1, -1]
        ].every(([a, b]) => walkable(i + a, j + b))
      ) || byDist[0];
    for (let i = cand.length - 1; i > 0; i--) {
      const r = Math.floor(rnd() * (i + 1));
      [cand[i], cand[r]] = [cand[r], cand[i]];
    }
    const spawns = [];
    for (const c of cand) {
      if (Math.hypot(c[0] - bossPt[0], c[1] - bossPt[1]) < 4) continue;
      if (spawns.every(p => Math.hypot(p.i - c[0], p.j - c[1]) > 2.7)) {
        const d = tdist(c[0], c[1]);
        const type = d < 15 ? 'slime' : d < 20.5 ? 'champi' : 'ember';
        const lvl =
          type === 'slime' ? 1 + Math.floor(rnd() * 2) : type === 'champi' ? 3 + Math.floor(rnd() * 3) : 6 + Math.floor(rnd() * 3);
        spawns.push({ type, lvl, i: c[0], j: c[1] });
      }
      if (spawns.length >= 52) break;
    }
    const VAR = {
      slime: [
        ['lapin', 0.25],
        ['abeille', 0.37]
      ],
      champi: [
        ['loup', 0.2],
        ['chauvesouris', 0.35],
        ['souche', 0.47]
      ],
      ember: [
        ['salamandre', 0.25],
        ['golem', 0.4],
        ['spectre', 0.52],
        ['follet', 0.6]
      ]
    };
    for (const sp of spawns) {
      const h = hash(sp.i, sp.j, 901),
        v = VAR[sp.type] && VAR[sp.type].find(o => h < o[1]);
      if (v) sp.type = v[0];
    }
    spawns.push({ type: 'boss', lvl: 12, i: bossPt[0], j: bossPt[1] });
    // points de cueillette (non bloquants)
    const nodes = [],
      taken = new Set(spawns.map(s => s.i + ',' + s.j));
    const want = { herb: 14, wood: 11, quartz: 9 },
      have = { herb: 0, wood: 0, quartz: 0 };
    const pool = cand.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const r = Math.floor(rnd() * (i + 1));
      [pool[i], pool[r]] = [pool[r], pool[i]];
    }
    for (const [i, j] of pool) {
      if (taken.has(i + ',' + j)) continue;
      const d = tdist(i, j),
        res = d < 15 ? 'herb' : d < 20.5 ? 'wood' : 'quartz';
      if (have[res] >= want[res] || nodes.some(n => Math.hypot(n.x - i - 0.5, n.y - j - 0.5) < 3)) continue;
      nodes.push({ k: nodes.length, res, x: i + 0.3 + rnd() * 0.4, y: j + 0.3 + rnd() * 0.4 });
      have[res]++;
      taken.add(i + ',' + j);
    }
    const hAt = (x, y) => {
      const i = Math.floor(x),
        j = Math.floor(y);
      return inb(i, j) ? HT[idx(i, j)] : 0;
    };
    const zoneOf = (x, y) => {
      const d = Math.hypot(x - CX, y - CY);
      for (const z of ZONES) if (d < z[0]) return z[1];
    };
    // Pont d'Éther au bout de la route de l'est (posé après tout le reste : le monde d'origine ne change pas)
    const eb = findBridge(TY, HT, SOL, idx, inb, 'x', null, 28),
      bridges = [];
    if (eb) {
      eb.kind = 'ether';
      bridges.push(eb);
      layDeck(eb, SOL, HT, idx);
    }
    return {
      MW,
      MH,
      CX,
      CY,
      TY,
      HT,
      SOL,
      props,
      spawns,
      nodes,
      idx,
      inb,
      tdist,
      walkable,
      hAt,
      zoneOf,
      isle: 'bourg',
      theme: 'bourg',
      bridges,
      spawn: SPAWN,
      chest: null
    };
  }

  function canStand(W, fx, fy, x, y) {
    const r = 0.22;
    for (const [ax, ay] of [
      [-r, -r],
      [r, -r],
      [-r, r],
      [r, r]
    ])
      if (!W.walkable(Math.floor(x + ax), Math.floor(y + ay))) return false;
    return Math.abs(W.hAt(x, y) - W.hAt(fx, fy)) <= 1;
  }
  function moveBy(W, e, dx, dy) {
    let m = false;
    if (dx && canStand(W, e.x, e.y, e.x + dx, e.y)) {
      e.x += dx;
      m = true;
    }
    if (dy && canStand(W, e.x, e.y, e.x, e.y + dy)) {
      e.y += dy;
      m = true;
    }
    return m;
  }

  const clampInt = (v, a, b) => {
    v = v | 0;
    return v < a ? a : v > b ? b : v;
  };
  const trapUp = (t, ph) => (t + ph) % 3 < 0.9; // pointes sorties 0,9 s toutes les 3 s
  /* ---------------- simulation ---------------- */
  class Sim {
    constructor(W, opts) {
      this.W = W;
      this.t = 0;
      this.players = new Map();
      this.events = [];
      this.bossWarn = 0;
      // îles du voyage : les monstres prennent le niveau du héros qui arrive (±1)
      const DGN = W.isle === 'donjon',
        L0 = W.isle && W.isle !== 'bourg' ? Math.max(1, (opts && opts.lvl) | 0 || 1) + (DGN ? DG[W.tier].lvl : 0) : 0;
      // îles : le donjon du centre (tiré à l'arrivée, ou repris de la sauvegarde en solo) ; donjon : pièges
      this.dg = W.gate ? cleanDg(opts && opts.dg) || rollDungeon() : null;
      this.traps = DGN ? new Map(W.dg.traps.map(o => [W.idx(o.i, o.j), o.ph])) : null;
      this.fx = (ISLES[W.isle] || {}).fx || null;
      this.chestOpen = false;
      this.spawn = W.spawn || SPAWN;
      this.zones = [];
      // îles du voyage : combat entre joueurs, et à la mort le sac reste sur le corps 3 minutes
      this.pvp = !!(W.isle && W.isle !== 'bourg');
      this.corpses = [];
      this.corpseN = 1;
      this.mobs = W.spawns.map((s, k) => {
        const lvl = L0 ? Math.max(1, L0 + Math.floor(Math.random() * 3) - 1) : s.lvl;
        return Object.assign(
          {
            k,
            type: s.type,
            lvl: s.lvl,
            x: s.i + 0.5,
            y: s.j + 0.5,
            hx: s.i + 0.5,
            hy: s.j + 0.5,
            alive: true,
            respawnT: 0,
            target: null,
            returning: false,
            atkCd: 0,
            wt: Math.random() * 3,
            wdx: 0,
            wdy: 0,
            tagged: new Set(),
            moving: false
          },
          mobStats(s.type, lvl),
          { lvl }
        );
      });
      for (const m of this.mobs) {
        const s = W.spawns[m.k];
        if (DGN) {
          m.aggressive = true;
          m.respawn = 1e9;
        }
        if (s.elite) {
          m.elite = 1;
          m.maxhp *= 3;
          m.atk *= 1.3;
          m.xp *= 3;
        }
        if (s.boss) {
          const B = DG_BOSSES[s.bi];
          m.dgBoss = s.bi;
          if (s.type !== 'boss') {
            m.maxhp = (18 + m.lvl * 14) * 1.7 * DG_BOSS_HP[B.r];
            m.atk *= 1.4 + 0.08 * B.r;
            m.range += 0.5;
          }
          m.xp *= 10;
          m.aggroR = 5;
        } // PV selon la rareté du boss, pas selon l'espèce
        m.maxhp = Math.round(m.maxhp);
        m.hp = m.maxhp;
      }
    }
    ev(o) {
      this.events.push(o);
    }
    addPlayer(id, name, look, save, cls) {
      const s = save || {};
      const p = {
        id,
        name: cleanName(name),
        look: cleanLook(look),
        x: this.spawn.x + (Math.random() - 0.5) * (this.spawn === SPAWN ? 1 : 0.3),
        y: this.spawn.y,
        face: 0,
        flip: 0,
        moving: 0,
        lvl: Math.min(MAX_LVL, Math.max(1, s.lvl | 0)),
        xp: Math.max(0, s.xp | 0),
        gold: Math.max(0, s.gold | 0),
        potions: s.potions == null ? 3 : Math.max(0, s.potions | 0),
        dead: false,
        deadT: 0,
        atkCd: 0,
        skillCd: 0,
        potCd: 0,
        lastHit: 99,
        lastMv: this.t,
        chatT: 0,
        q: clampInt(s.q, 0, QUESTS.length),
        qs: clampInt(s.qs, 0, 2),
        qn: clampInt(s.qn, 0, 99)
      };
      const inv = s.inv || {};
      p.inv = { herb: clampInt(inv.herb, 0, 9999), wood: clampInt(inv.wood, 0, 9999), quartz: clampInt(inv.quartz, 0, 9999) };
      p.equip = {};
      p.bag = [];
      if (s.equip) {
        for (const sl of SLOTS) {
          const it = cleanInst(s.equip[sl]);
          p.equip[sl] = it && ITEMS[it[0]].slot === sl ? it : null;
        }
      }
      p.gifts = clampInt(s.gifts, 0, 1 << 20);
      p.cls = clampInt(s.lvl ? s.cls : cls == null ? s.cls : cls, 0, START.length - 1);
      p.abCd = [0, 0, 0];
      p.buffT = 0;
      if (!s.equip) {
        p.equip.weapon = [START[p.cls][0], 0];
        p.equip.chest = [9, 0];
      }
      // maîtrise d'arme ; anciennes sauvegardes (avec classes) : l'arme de l'ancienne classe démarre au niveau du héros
      p.mast = {};
      if (s.mast && typeof s.mast === 'object') {
        for (const f in FAMS) if (f !== 'none' && s.mast[f]) p.mast[f] = clampInt(s.mast[f], 0, MAST_CAP);
      } else if (s.lvl > 1) p.mast[['sword', 'bow', 'staff'][clampInt(s.cls, 0, 2)]] = mTotal(Math.min(MAST_MAX, p.lvl));
      // points de caractéristiques (3 par niveau) ; anciennes sauvegardes : répartis selon l'ancienne classe
      p.pts = { str: 0, sta: 0, int: 0, agi: 0 };
      if (s.pts && typeof s.pts === 'object') {
        for (const k in p.pts) p.pts[k] = clampInt(s.pts[k], 0, 999);
      } else if (p.lvl > 1) {
        const g = CLASSES[clampInt(s.cls, 0, 2)].grow,
          tot = 3 * (p.lvl - 1),
          sum = g.str[1] + g.sta[1] + g.int[1] + g.agi[1];
        let left = tot;
        for (const k of ['int', 'agi', 'sta']) {
          p.pts[k] = Math.round((tot * g[k][1]) / sum);
          left -= p.pts[k];
        }
        p.pts.str = Math.max(0, left);
      }
      if (freePts(p.lvl, p.pts) < 0) p.pts = { str: 0, sta: 0, int: 0, agi: 0 };
      p.bar = {};
      if (s.bar && typeof s.bar === 'object')
        for (const f in FAMS) if (Array.isArray(s.bar[f])) p.bar[f] = s.bar[f].slice(0, 3).map(v => clampInt(v, 0, 9));
      p.fr = s.fr == null ? 1 : clampInt(s.fr, 0, 1); // une réinitialisation gratuite des points
      p.skc = {};
      if (s.skc && typeof s.skc === 'object')
        for (const k in s.skc)
          if (/^[a-z]+:\d$/.test(k) && Array.isArray(s.skc[k]))
            p.skc[k] = [0, 1].map(j => {
              const v = s.skc[k][j];
              return v === 0 || v === 1 ? v : -1;
            });
      p.sk = {};
      if (s.sk && typeof s.sk === 'object')
        for (const k in s.sk) if (/^[a-z]+:(\d|block)$/.test(k)) p.sk[k] = clampInt(s.sk[k], 0, skTotal(SK_MAX));
      // voyage : île actuelle, îles découvertes ; « arr » = on vient de traverser, on apparaît au bout du Pont d'Éther
      p.isle = cleanIsle(s.isle);
      p.isles = clampInt(s.isles, 0, 1 << 20) | 1;
      p.arr = 0;
      if (s.arr === 2 && this.W.gate) {
        p.x = this.W.gate.x + 1.5;
        p.y = this.W.gate.y + 1.5;
      } // sortie du donjon : devant son entrée
      else if (s.arr && this.W.bridges && this.W.bridges.length) {
        const b = this.W.bridges.find(o => o.kind === 'ether') || this.W.bridges[0];
        p.x = b.ix;
        p.y = b.iy;
      }
      // donjon de l'île (celui de la simulation) ; dans un donjon, celui d'où l'on vient ; titres gagnés et titre affiché
      p.dg = this.dg || (this.W.isle === 'donjon' ? cleanDg(s.dg) : null);
      p.ttl = clampInt(s.ttl, 0, 255);
      p.tt = s.tt == null ? -1 : clampInt(s.tt, -1, TITLES.length - 1);
      if (p.tt >= 0 && !(p.ttl & TITLES[p.tt][0])) p.tt = -1;
      for (const a of (s.bag || []).slice(0, BAG_SIZE)) {
        const it = cleanInst(a);
        if (it) p.bag.push(it);
      }
      const gr = s.gear || {};
      if (gr.blade) p.bag.push([2, 1]);
      if (gr.armor) p.bag.push([10, 1]);
      if (gr.charm) p.bag.push([18, 2]);
      p.ether = clampInt(s.ether == null ? DAILY_GIFT : s.ether, 0, ETHER_MAX);
      p.glvl = clampInt(s.glvl || 1, 1, 50);
      p.gxp = clampInt(s.gxp, 0, 99999);
      p.scarves = clampInt(s.scarves == null ? 1 : s.scarves, 1, 7) | 1;
      p.scarf = clampInt(s.scarf, 0, 2);
      if (!(p.scarves & (1 << p.scarf))) p.scarf = 0;
      p.day = s.day || '';
      p.stepsToday = clampInt(s.stepsToday, 0, DAILY_STEP_CAP);
      p.gcd = {};
      this.newDay(p);
      this.recalc(p, true);
      p.lookStr = p.look.join('');
      this.players.set(id, p);
      this.ev({ e: 'ch', s: 1, t: p.name + ' a rejoint Pixels Worlds.' });
      return p;
    }
    removePlayer(id) {
      const p = this.players.get(id);
      if (!p) return;
      this.players.delete(id);
      for (const m of this.mobs) {
        m.tagged.delete(id);
        if (m.target === id) {
          m.target = null;
          m.returning = true;
        }
      }
      this.ev({ e: 'ch', s: 1, t: p.name + ' est parti.' });
    }
    /* Format de sauvegarde : ne JAMAIS renommer ni retirer un champ (les héros existants doivent survivre aux mises à jour).
       Ajouter un champ = lui donner une valeur par défaut dans addPlayer. */
    saveData(p) {
      return {
        gifts: p.gifts,
        cls: p.cls,
        lvl: p.lvl,
        xp: p.xp,
        gold: p.gold,
        potions: p.potions,
        q: p.q,
        qs: p.qs,
        qn: p.qn,
        inv: p.inv,
        equip: p.equip,
        bag: p.bag,
        ether: p.ether,
        glvl: p.glvl,
        gxp: p.gxp,
        scarves: p.scarves,
        scarf: p.scarf,
        day: p.day,
        stepsToday: p.stepsToday,
        mast: p.mast,
        pts: p.pts,
        bar: p.bar,
        fr: p.fr,
        isle: p.isle,
        isles: p.isles,
        arr: p.arr,
        sk: p.sk,
        skc: p.skc,
        dg: p.dg,
        ttl: p.ttl,
        tt: p.tt
      };
    }
    grantFounder(p) {
      if (p.gifts & 1) return false;
      const wpn = [
          [5, 3],
          [23, 3],
          [4, 3],
          [29, 3],
          [31, 3],
          [3, 3]
        ],
        k = p.cls < wpn.length ? p.cls : 0;
      p.equip = { head: [8, 3], chest: [11, 3], legs: [13, 3], feet: [UNIQUE_BOOTS, 4], weapon: wpn[k], trinket: [19, 3], offhand: null };
      for (let c = 0; c < 3; c++) if (c !== k && p.bag.length < BAG_SIZE) p.bag.push(wpn[c].slice());
      if (p.bag.length < BAG_SIZE) p.bag.push([27, 3]);
      p.gifts |= 1;
      this.recalc(p, true);
      this.ev({ e: 'founder', id: p.id });
      return true;
    }
    /* Ensemble unique du Maître du jeu : équipé une seule fois (les pièces remplacées vont au sac ; si le sac est plein,
       la pièce attend la prochaine connexion). Seul le client ou le serveur décide qui est maître du jeu. */
    grantGM(p) {
      const owned = new Set([...Object.values(p.equip).filter(Boolean), ...p.bag].map(i => i[0]));
      let got = 0,
        mage = 0;
      for (const t of GM_EQUIP) {
        if (owned.has(t)) continue;
        const sl = ITEMS[t].slot,
          old = p.equip[sl];
        if (old && p.bag.length >= BAG_SIZE) continue;
        if (old) p.bag.push(old);
        p.equip[sl] = [t, 4];
        got++;
      }
      for (const t of GM_BAG)
        if (!owned.has(t) && p.bag.length < BAG_SIZE) {
          p.bag.push([t, 4]);
          got++;
        }
      if (p.equip.offhand && weaponFam(p.equip) !== 'sword' && p.bag.length < BAG_SIZE) {
        p.bag.push(p.equip.offhand);
        p.equip.offhand = null;
      }
      // une fois : le maître du jeu devient mage (maîtrise du bâton au niveau de celle de l'épée, points en Intelligence)
      if (!(p.gifts & 2)) {
        p.gifts |= 2;
        p.mast.staff = Math.max(p.mast.staff || 0, p.mast.sword || 0);
        const tot = 3 * (p.lvl - 1),
          it = Math.round(tot * 0.6),
          st = Math.round(tot * 0.3);
        p.pts = { str: 0, int: it, sta: st, agi: tot - it - st };
        mage = mLevel(p.mast.staff).lv;
        got++;
      }
      if (got) {
        this.recalc(p, true);
        this.ev({ e: 'gm', id: p.id, n: got, mage });
      }
      return got;
    }
    buffMul(p) {
      return p.buffT > this.t ? 1.4 + (p.buffK || 0) : 1;
    }
    recalc(p, full) {
      const fh = p.maxhp ? p.hp / p.maxhp : 1,
        fm = p.maxmp ? p.mp / p.maxmp : 1;
      Object.assign(p, computeStats(p.lvl, p.equip, p.pts));
      p.hp = full ? p.maxhp : Math.max(1, Math.min(p.maxhp, Math.round(p.maxhp * fh)));
      p.mp = full ? p.maxmp : Math.min(p.maxmp, Math.round(p.maxmp * fm));
    }
    giveItem(p, inst, m) {
      inst = cleanInst(inst);
      if (!inst) return;
      if (p.bag.length >= BAG_SIZE) {
        const v = itemValue(inst);
        p.gold += v;
        this.ev({ e: 'it', id: p.id, t: inst[0], r: inst[1], m: m == null ? -1 : m, sold: v });
        return;
      }
      p.bag.push(inst);
      this.ev({ e: 'it', id: p.id, t: inst[0], r: inst[1], m: m == null ? -1 : m });
    }
    newDay(p) {
      const d = dayKey();
      if (p.day !== d) {
        p.day = d;
        p.stepsToday = 0;
        p.ether = Math.min(ETHER_MAX, p.ether + DAILY_GIFT);
        return true;
      }
      return false;
    }
    handle(id, m) {
      const p = this.players.get(id);
      if (!p || !m || typeof m !== 'object') return;
      const W = this.W;
      switch (m.t) {
        case 'mv': {
          if (p.dead) return;
          const x = +m.x,
            y = +m.y;
          if (!isFinite(x) || !isFinite(y)) return;
          const allowed = 3.6 * (p.speed || 1) * (p.hasteT > this.t ? 1.3 : 1) * (this.t - p.lastMv) + 0.7; // (ralenti : la vitesse permise reste la normale)
          if (Math.hypot(x - p.x, y - p.y) > allowed || !W.walkable(Math.floor(x), Math.floor(y))) {
            this.ev({ e: 'tp', id, x: p.x, y: p.y });
            p.lastMv = this.t;
            return;
          }
          p.x = x;
          p.y = y;
          p.face = (m.f | 0) % 3;
          p.flip = m.fl ? 1 : 0;
          p.moving = m.mv ? 1 : 0;
          p.lastMv = this.t;
          break;
        }
        case 'atk': {
          const mob = m.p != null ? this.foe(p, m.p) : this.mobs[m.m | 0],
            B = kitOf(p.equip, p.mast, p.bar).basic;
          if (p.dead || !mob || mob.dead || mob.alive === false || p.atkCd > 0) return;
          if (Math.hypot(mob.x - p.x, mob.y - p.y) > B.range + (mob.type === 'boss' ? 1.1 : 0.6)) return;
          p.atkCd = B.cd - 0.05;
          let dmg = p.atk * B.mult * (0.85 + Math.random() * 0.3) * this.buffMul(p);
          const crit = Math.random() < p.crit;
          if (crit) dmg *= 1.8;
          if (mob.k == null) {
            this.ev({ e: 'sw', id, m: -1, pv: mob.id, c: p.cls, fx: B.fx });
            this.addMast(p, 1);
            this.hurt(mob, Math.round(dmg), p, true);
            break;
          }
          this.ev({ e: 'sw', id, m: mob.k, c: p.cls, fx: B.fx });
          this.hitMob(mob, Math.round(dmg), p, crit);
          break;
        }
        case 'ab': {
          const K = kitOf(p.equip, p.mast, p.bar, p.sk, p.lvl, p.skc, p.stats && p.stats.int),
            i = m.a | 0,
            A = K.ab[i],
            M = (A && A.mods) || {};
          if (!A || A.locked || p.dead || p.abCd[i] > this.t || p.mp < A.mp) return;
          let tgt = null;
          if (A.kind === 'aoeTarget' || A.kind === 'single' || A.kind === 'charge') {
            tgt = m.p != null ? this.foe(p, m.p) : this.mobs[m.m | 0];
            if (!tgt || tgt.dead || tgt.alive === false || Math.hypot(tgt.x - p.x, tgt.y - p.y) > A.range + 0.8) return;
          }
          p.mp -= A.mp;
          p.abCd[i] = this.t + A.cd - 0.1;
          const pw = A.pw || 1,
            roll = () => (0.9 + Math.random() * 0.2) * this.buffMul(p) * pw * (1 + (M.dmg || 0));
          const around = (cx, cy, r) => this.mobs.filter(o => o.alive && Math.hypot(o.x - cx, o.y - cy) <= r);
          const foes = (cx, cy, r) =>
            this.pvp
              ? around(cx, cy, r).concat([...this.players.values()].filter(o => o !== p && !o.dead && Math.hypot(o.x - cx, o.y - cy) <= r))
              : around(cx, cy, r);
          const fireImm = o => MOBDEF[o.type].el === 'fire';
          let hits = 0,
            kills = 0;
          // effets d'un coup : ralentir, étourdir, saigner, brûler, vulnérabilité, repousser / attirer
          const onHit = o => {
            if (o.k == null) {
              if (o.dead) return;
              if (A.slow || M.slow) o.pslowT = this.t + 2;
              if (A.bleed || M.bleed || M.burn) {
                o.pburnT = this.t + 3;
                o.pburnDps = Math.max(1, p.atk * 0.1 * pw);
                o.pburnBy = p;
              }
              return;
            }
            if (!o.alive) return;
            if (A.slow || M.slow) {
              o.slowT = this.t + (A.slow || 0) * pw + (M.slow || 0);
              o.slowK = M.slowStrong ? 0.3 : 0.5;
            }
            const st = Math.max(A.stun || 0, M.stun || 0);
            if (st) o.stunT = this.t + st * pw;
            if (A.bleed || M.bleed) {
              o.bleedT = this.t + (A.bleed || 0) + (M.bleed || 0);
              o.bleedBy = p.id;
              o.bleedDps = Math.max(1, p.atk * 0.15 * pw * (1 + (M.bleedK || 0)));
            }
            if (M.burn && !fireImm(o)) {
              o.burnT = this.t + M.burn;
              o.burnBy = p.id;
              o.burnDps = Math.max(1, p.atk * 0.15 * pw);
            }
            if (M.vuln) {
              o.vulnT = this.t + M.vuln[1];
              o.vulnK = M.vuln[0];
            }
            if (M.push || M.pull) {
              const dx = o.x - p.x,
                dy = o.y - p.y,
                d = Math.hypot(dx, dy) || 1,
                s0 = M.push ? 1.2 : -Math.max(0, Math.min(1.2, d - 0.9));
              if (s0) moveBy(this.W, o, (dx / d) * s0, (dy / d) * s0);
            }
          };
          const strike = (o, crit) => {
            if (o.k == null) {
              if (o.dead) return;
              const d0 = Math.round(p.atk * A.mult * roll() * (crit ? 1.8 : 1));
              hits++;
              this.addMast(p, 1);
              this.hurt(o, d0, p, true);
              if (o.dead) kills++;
              else onHit(o);
              return;
            }
            if (!o.alive) return;
            let dmg = p.atk * A.mult * roll();
            if (M.execute && o.hp < o.maxhp * 0.3) dmg *= 2;
            if (M.slowBonus && o.slowT > this.t) dmg *= 1 + M.slowBonus;
            const c = !!(crit || M.crit || Math.random() < (M.critAdd || 0));
            if (c) dmg *= 1.8;
            dmg = Math.round(dmg);
            hits++;
            this.hitMob(o, dmg, p, c);
            if (M.lifesteal) p.hp = Math.min(p.maxhp, p.hp + dmg * M.lifesteal);
            if (!o.alive) kills++;
            else onHit(o);
          };
          const chain = (from, n, r) => {
            const others = this.mobs
              .filter(o => o.alive && o !== from && Math.hypot(o.x - from.x, o.y - from.y) <= r)
              .sort((a1, b1) => Math.hypot(a1.x - from.x, a1.y - from.y) - Math.hypot(b1.x - from.x, b1.y - from.y))
              .slice(0, n);
            for (const o of others) strike(o, false);
            return others;
          };
          const rounds = M.twice ? 2 : 1;
          if (A.kind === 'aoeSelf') {
            const L = foes(p.x, p.y, A.r);
            for (let q = 0; q < rounds; q++) for (const o of L) strike(o, false);
          } else if (A.kind === 'aoeTarget') {
            const L = foes(tgt.x, tgt.y, A.r);
            for (let q = 0; q < rounds; q++) for (const o of L) strike(o, false);
            if (M.chain) chain(tgt, M.chain, M.bounce ? 4 : 2.5);
          } else if (A.kind === 'single') {
            strike(tgt, Math.random() < p.crit);
            if (M.chain) chain(tgt, M.chain, 2.5);
          } else if (A.kind === 'charge') {
            const d = Math.hypot(tgt.x - p.x, tgt.y - p.y) || 1,
              nx = tgt.x - ((tgt.x - p.x) / d) * 0.8,
              ny = tgt.y - ((tgt.y - p.y) / d) * 0.8;
            if (this.W.walkable(Math.floor(nx), Math.floor(ny))) {
              p.x = nx;
              p.y = ny;
              p.lastMv = this.t;
              this.ev({ e: 'tp', id, x: p.x, y: p.y, dash: 1 });
            }
            strike(tgt, false);
          } else if (A.kind === 'buff') {
            const until = this.t + (A.dur + (M.buffDur || 0)) * pw;
            p.buffT = until;
            p.buffK = M.buffDmg || 0;
            hits = 1;
            if (M.allies)
              for (const o of this.players.values())
                if (o !== p && !o.dead && Math.hypot(o.x - p.x, o.y - p.y) <= 4) {
                  o.buffT = until;
                  o.buffK = p.buffK;
                }
            if (M.healSelf) {
              const h = Math.round(p.maxhp * M.healSelf);
              p.hp = Math.min(p.maxhp, p.hp + h);
              this.ev({ e: 'heal', id, v: h });
            }
          } else if (A.kind === 'heal') {
            const h = Math.round(p.maxhp * 0.4 * pw);
            if (p.hp < p.maxhp) hits++;
            p.hp = Math.min(p.maxhp, p.hp + h);
            this.ev({ e: 'heal', id, v: h });
            for (const o of this.players.values())
              if (o !== p && !o.dead && Math.hypot(o.x - p.x, o.y - p.y) <= 4 + (M.healRange || 0)) {
                if (o.hp < o.maxhp) hits++;
                const h2 = Math.round(o.maxhp * 0.25 * pw);
                o.hp = Math.min(o.maxhp, o.hp + h2);
                this.ev({ e: 'heal', id: o.id, v: h2, by: id });
              }
            if (M.mana) p.mp = Math.min(p.maxmp, p.mp + p.maxmp * M.mana);
            if (M.shield) {
              p.shieldHP = Math.round(p.maxhp * M.shield);
              hits = Math.max(hits, 1);
            }
            if (M.regen) {
              p.regenT = this.t + M.regen[1];
              p.regenPs = (p.maxhp * M.regen[0]) / M.regen[1];
            }
          }
          // effets d'ensemble : zone d'impact, sol en feu, soin de zone, garde, vitesse, disparition, recharges
          const at = tgt || p;
          if (M.stunArea) for (const o of around(at.x, at.y, M.stunArea)) o.stunT = this.t + 1.5 * pw;
          if (M.zone && tgt) {
            this.zones.push({ x: tgt.x, y: tgt.y, r: 1.3, until: this.t + M.zone, dps: p.atk * 0.25 * pw, by: p.id, acc: 0 });
            this.ev({ e: 'zone', x: +tgt.x.toFixed(2), y: +tgt.y.toFixed(2), r: 1.3, d: M.zone });
          }
          if (M.healZone && tgt)
            for (const o of this.players.values())
              if (!o.dead && Math.hypot(o.x - tgt.x, o.y - tgt.y) <= A.r) {
                const h3 = Math.round(o.maxhp * M.healZone);
                o.hp = Math.min(o.maxhp, o.hp + h3);
                this.ev({ e: 'heal', id: o.id, v: h3, by: id });
              }
          if (M.guard) {
            p.guardT = this.t + M.guard[1];
            p.guardK = M.guard[0];
          }
          if (M.haste) p.hasteT = this.t + M.haste;
          if (M.stealth) {
            p.stealthT = this.t + M.stealth;
            for (const o of this.mobs)
              if (o.target === id) {
                o.target = null;
                o.returning = true;
              }
          }
          if (M.cdPerHit && hits) p.abCd[i] = Math.max(this.t, p.abCd[i] - hits * M.cdPerHit);
          if (M.killRefund && kills) p.abCd[i] = this.t + A.cd * (1 - M.killRefund);
          if (M.killReset && kills) {
            const j = K.ab.findIndex(o => o.name === M.killReset);
            if (j >= 0) p.abCd[j] = 0;
          }
          // expérience de compétence : rien si la technique ne sert à rien (lancée dans le vide, soin à pleine vie)
          if (hits && A.ti >= 0) this.addSk(p, K.fam + ':' + A.ti, A.kind === 'buff' ? 2 : 1 + Math.min(3, hits) + 2 * kills);
          this.ev({
            e: 'ab',
            id,
            c: p.cls,
            a: i,
            m: tgt && tgt.k != null ? tgt.k : -1,
            pv: tgt && tgt.k == null ? tgt.id : undefined,
            fx: A.fx,
            n: A.name,
            r: A.r || 0,
            ar: M.arrows || 0,
            tw: M.twice ? 1 : 0,
            rk: A.rank || 1
          });
          break;
        }
        case 'pot': {
          if (p.dead || p.potCd > 0 || p.potions <= 0 || p.hp >= p.maxhp) return;
          const h = Math.round(p.maxhp * 0.5);
          p.hp = Math.min(p.maxhp, p.hp + h);
          p.potions--;
          p.potCd = 0.9;
          this.ev({ e: 'po', id, v: h });
          break;
        }
        case 'steps': {
          if (this.newDay(p)) this.ev({ e: 'gift', id, v: DAILY_GIFT });
          const n = clampInt(m.n, 0, 50000),
            before = p.stepsToday,
            after = Math.min(DAILY_STEP_CAP, before + n);
          const gain = Math.floor(after / STEPS_PER_ETHER) - Math.floor(before / STEPS_PER_ETHER);
          p.stepsToday = after;
          p.ether = Math.min(ETHER_MAX, p.ether + gain);
          this.ev({ e: 'st', id, n: after - before, v: gain, capped: before + n > DAILY_STEP_CAP ? 1 : 0 });
          break;
        }
        case 'gather': {
          const node = this.W.nodes[m.k | 0];
          if (!node || p.dead) return;
          const R0 = RES[node.res];
          if (Math.hypot(p.x - node.x, p.y - node.y) > 1.7 || p.glvl < R0.req || p.ether < 1 || (p.gcd[node.k] || 0) > this.t) return;
          p.ether -= 1;
          p.gcd[node.k] = this.t + NODE_CD;
          const n = 1 + (Math.random() < Math.min(0.5, (p.glvl - R0.req) * 0.08) ? 1 : 0);
          p.inv[node.res] += n;
          p.gxp += R0.gxp;
          this.ev({ e: 'ga', id, k: node.k, res: node.res, n, g: R0.gxp });
          while (p.gxp >= gNeed(p.glvl)) {
            p.gxp -= gNeed(p.glvl);
            p.glvl++;
            this.ev({ e: 'gl', id, lv: p.glvl });
          }
          break;
        }
        case 'craft': {
          const r = RECIPES[m.r | 0];
          if (!r || p.dead) return;
          const npc = NPCS[r.npc];
          if (Math.hypot(p.x - npc.x, p.y - npc.y) > 2.8 || p.glvl < r.req) return;
          if (r.scarf && p.scarves & (1 << r.scarf)) return;
          if (r.item && p.bag.length >= BAG_SIZE) {
            this.ev({ e: 'msg', id, t: 'Ton sac est plein.' });
            return;
          }
          if (r.enchant && !p.equip.weapon) {
            this.ev({ e: 'msg', id, t: "Prends une arme en main pour l'enchanter." });
            return;
          }
          if (r.enchant && instEl(p.equip.weapon) === r.enchant) {
            this.ev({ e: 'msg', id, t: 'Ton arme est déjà de cet élément.' });
            return;
          }
          for (const k in r.cost) if ((p.inv[k] || 0) < r.cost[k]) return;
          for (const k in r.cost) p.inv[k] -= r.cost[k];
          if (r.enchant) {
            p.equip.weapon = [p.equip.weapon[0], p.equip.weapon[1], EL_ORDER.indexOf(r.enchant)];
            this.recalc(p);
          }
          if (r.potions) p.potions += r.potions;
          if (r.scarf) {
            p.scarves |= 1 << r.scarf;
            p.scarf = r.scarf;
          }
          if (r.item) this.giveItem(p, r.item.slice());
          this.ev({ e: 'cr', id, r: m.r | 0 });
          break;
        }
        case 'equip': {
          const b = m.b | 0,
            inst = p.bag[b];
          if (!inst || p.dead) return;
          const T = ITEMS[inst[0]];
          if (p.lvl < T.lvl) {
            this.ev({ e: 'msg', id, t: 'Niveau ' + T.lvl + ' requis pour ' + T.n + '.' });
            return;
          }
          if (T.slot === 'offhand') {
            if (weaponFam(p.equip) !== 'sword') {
              this.ev({ e: 'msg', id, t: 'Un bouclier se porte avec une épée à une main.' });
              return;
            }
            if (mLevel(p.mast.sword || 0).lv < 5) {
              this.ev({ e: 'msg', id, t: 'Maîtrise Épée à une main 5 requise pour porter un bouclier.' });
              return;
            }
          }
          const dropShield = T.slot === 'weapon' && p.equip.offhand && FAM_OF[T.icon] !== 'sword';
          if (dropShield && (p.equip.weapon ? p.bag.length : p.bag.length - 1) >= BAG_SIZE) {
            this.ev({ e: 'msg', id, t: "Sac plein : range d'abord ton bouclier." });
            return;
          }
          const old = p.equip[T.slot];
          p.equip[T.slot] = inst;
          if (old) p.bag[b] = old;
          else p.bag.splice(b, 1);
          if (dropShield) {
            p.bag.push(p.equip.offhand);
            p.equip.offhand = null;
            this.ev({ e: 'msg', id, t: 'Bouclier rangé : il se porte avec une épée à une main.' });
          }
          this.recalc(p);
          this.ev({ e: 'eq', id, t: inst[0], r: inst[1] });
          break;
        }
        case 'unequip': {
          const sl = String(m.s);
          if (!SLOTS.includes(sl) || !p.equip[sl] || p.dead) return;
          if (p.bag.length >= BAG_SIZE) {
            this.ev({ e: 'msg', id, t: 'Ton sac est plein.' });
            return;
          }
          p.bag.push(p.equip[sl]);
          p.equip[sl] = null;
          this.recalc(p);
          break;
        }
        case 'sell': {
          const b = m.b | 0,
            inst = p.bag[b];
          if (!inst) return;
          if (ITEMS[inst[0]].fx === 'gm') {
            this.ev({ e: 'msg', id, t: 'Cet objet unique ne se vend pas.' });
            return;
          }
          const v = itemValue(inst);
          p.gold += v;
          p.bag.splice(b, 1);
          this.ev({ e: 'sold', id, t: inst[0], r: inst[1], v });
          break;
        }
        case 'scarf': {
          const sc = clampInt(m.s, 0, 2);
          if (p.scarves & (1 << sc)) p.scarf = sc;
          break;
        }
        case 'cross': {
          const b = this.W.bridges && this.W.bridges[m.b | 0];
          if (!b || p.dead || p.trav) return;
          if (Math.hypot(p.x - b.ex, p.y - b.ey) > 1.6) return;
          let to;
          if (b.kind === 'ether') {
            if (p.ether < ETHER_BRIDGE) {
              this.ev({ e: 'msg', id, t: 'Il faut ' + ETHER_BRIDGE + " Éther pour traverser (l'Éther se gagne en marchant)." });
              return;
            }
            p.ether -= ETHER_BRIDGE;
            // traverser ensemble : moins de 10 s après un autre héros parti de cette île, on arrive sur la même île que lui
            if (this.lastCross && this.t - this.lastCross.t < 10) to = this.lastCross.to;
            else this.lastCross = { t: this.t, to: (to = rollIsle(this.W.isle)) };
          } else to = { k: 'bourg' };
          const fresh = !(p.isles & ISLE_BIT[to.k]);
          p.isles |= ISLE_BIT[to.k];
          p.isle = to;
          p.trav = 1;
          p.dg = null;
          p.arr = to.k === 'bourg' ? 0 : 1; // retour au bourg : on réapparaît à la fontaine
          this.ev({ e: 'travel', id, to, via: b.kind, fresh: fresh ? 1 : 0 });
          break;
        }
        case 'dgIn': {
          const G = this.W.gate,
            D = this.dg;
          if (!G || !D || p.dead || p.trav || Math.hypot(p.x - G.x, p.y - G.y) > 2.2) return;
          if (D.done) {
            this.ev({ e: 'msg', id, t: "Ce donjon s'est éteint. Traverse un Pont d'Éther pour en trouver un autre." });
            return;
          }
          const to = { k: 'donjon', s: D.s, r: D.r, b: D.b, f: cleanIsle(p.isle) },
            fresh = !(p.isles & ISLE_BIT.donjon);
          p.isles |= ISLE_BIT.donjon;
          p.isle = to;
          p.dg = D;
          p.trav = 1;
          p.arr = 0;
          this.ev({ e: 'travel', id, to, via: 'dg', fresh: fresh ? 1 : 0 });
          break;
        }
        case 'dgOut': {
          if (this.W.isle !== 'donjon' || p.dead || p.trav) return;
          const Dg = this.W.dg,
            won = !this.mobs[Dg.bossK].alive,
            at = o => Math.hypot(p.x - o.x, p.y - o.y) < 1.4;
          if (!at(Dg.portal) && !(won && at(Dg.exit))) return;
          if (p.dg && p.dg.s === this.W.seed) p.dg.done = 1; // ressortir avant le boss : le donjon est perdu pour cette arrivée
          const to = p.isle.f || { k: 'givre' };
          p.isle = to;
          p.trav = 1;
          p.arr = 2;
          this.ev({ e: 'travel', id, to, via: 'dgout', fresh: 0 });
          break;
        }
        case 'tt': {
          const i = clampInt(m.i, -1, TITLES.length - 1);
          if (i < 0 || p.ttl & TITLES[i][0]) p.tt = i;
          break;
        }
        case 'loot': {
          const cp = this.corpses.find(o => o.id === (m.c | 0));
          if (!cp || p.dead || Math.hypot(p.x - cp.x, p.y - cp.y) > 1.6) return;
          let n = 0;
          while (cp.items.length && p.bag.length < BAG_SIZE) {
            p.bag.push(cp.items.shift());
            n++;
          }
          if (!n) {
            this.ev({ e: 'msg', id, t: 'Ton sac est plein.' });
            return;
          }
          this.ev({ e: 'looted', id, n, of: cp.name, own: cp.name === p.name ? 1 : 0, left: cp.items.length });
          if (!cp.items.length) this.corpses = this.corpses.filter(o => o !== cp);
          break;
        }
        case 'chest': {
          const c = this.W.chest;
          if (!c || this.chestOpen || p.dead || Math.hypot(p.x - c.x, p.y - c.y) > 1.6) return;
          const pool = [...new Set(Object.values(LOOT).flatMap(l => l.items))],
            item = r => this.giveItem(p, [pool[Math.floor(Math.random() * pool.length)], rollRarity(r)]);
          if (this.W.isle === 'donjon') {
            if (this.mobs[this.W.dg.bossK].alive) {
              this.ev({ e: 'msg', id, t: 'Le coffre reste scellé tant que le boss est en vie.' });
              return;
            }
            const r = this.W.tier,
              g = (20 + p.lvl * 12) * (1 + r),
              eth = r ? r + 1 : 0;
            this.chestOpen = true;
            p.gold += g;
            p.ether = Math.min(ETHER_MAX, p.ether + eth);
            for (let k = 0; k < [1, 1, 2, 2, 3][r]; k++) item([0, 1, 2, 3, 3][r]);
            if (r === 4 && Math.random() < 0.01) this.giveItem(p, [UNIQUE_BOOTS, 4]);
            this.ev({ e: 'chest', id, g, eth, dg: 1 });
            break;
          }
          this.chestOpen = true;
          const g = 20 + p.lvl * 12;
          p.gold += g;
          item(2);
          item(1);
          this.ev({ e: 'chest', id, g });
          break;
        }
        case 'pt': {
          const k = String(m.s);
          if (!(k in p.pts) || freePts(p.lvl, p.pts) <= 0) return;
          p.pts[k]++;
          this.recalc(p);
          break;
        }
        case 'skc': {
          const k = String(m.k),
            [f, t] = k.split(':'),
            T = FAMS[f] && FAMS[f].tech[t | 0],
            j = m.j ? 1 : 0,
            c = m.c ? 1 : 0;
          if (!T || !T.ms || String(t | 0) !== t) return;
          if (skRank(p.sk[k] || 0, skCap(p.lvl)) < (j ? 8 : 4)) return;
          const cur = p.skc[k] || [-1, -1];
          if (cur[j] >= 0) return;
          cur[j] = c;
          p.skc[k] = cur;
          this.ev({ e: 'skc', id, k, j, c, n: T.ms[j][c].n });
          break;
        }
        case 'skcReset': {
          const npc = NPCS.elya;
          if (p.dead || Math.hypot(p.x - npc.x, p.y - npc.y) > 2.8) return;
          p.skc = {};
          this.ev({ e: 'msg', id, t: "Tes effets de techniques sont réinitialisés : choisis-les de nouveau dans l'onglet Compétences." });
          break;
        }
        case 'respec': {
          const npc = NPCS.elya;
          if (p.dead || Math.hypot(p.x - npc.x, p.y - npc.y) > 2.8) return;
          const cost = p.fr ? 0 : respecCost(p.lvl);
          if (p.gold < cost) {
            this.ev({ e: 'msg', id, t: 'Il te faut ' + cost + " pièces d'or." });
            return;
          }
          p.gold -= cost;
          if (p.fr) p.fr = 0;
          p.pts = { str: 0, sta: 0, int: 0, agi: 0 };
          this.recalc(p);
          this.ev({ e: 'msg', id, t: 'Points réinitialisés : ' + freePts(p.lvl, p.pts) + ' points à répartir.' });
          break;
        }
        case 'bar': {
          const K = kitOf(p.equip, p.mast, p.bar),
            s0 = clampInt(m.s, 0, 2),
            ti = m.k | 0,
            A = K.F.tech[ti];
          if (!A || A.m > K.ml) return;
          const cur = K.ab.map(a => (a.locked ? -1 : a.ti)),
            j = cur.indexOf(ti);
          if (j >= 0) cur[j] = cur[s0];
          cur[s0] = ti;
          p.bar[K.fam] = cur.filter(v => v >= 0);
          p.abCd = [0, 0, 0];
          break;
        }
        case 'talk': {
          const npc = NPCS[m.npc];
          if (!npc || p.dead) return;
          if (Math.hypot(p.x - npc.x, p.y - npc.y) > 2.8) return;
          const Q = QUESTS[p.q];
          if (!Q || Q.giver !== npc.id) return;
          if (p.qs === 0) {
            p.qs = 1;
            p.qn = 0;
            this.ev({ e: 'qa', id, q: p.q });
          } else if (p.qs === 2) {
            p.gold += Q.gold;
            p.potions += Q.pot || 0;
            if (Q.reward) this.giveItem(p, Q.reward.slice());
            this.ev({ e: 'qr', id, q: p.q, xp: Q.xp, g: Q.gold, pot: Q.pot || 0 });
            const done = p.q;
            p.q++;
            p.qs = 0;
            p.qn = 0;
            this.gainXP(p, Q.xp);
            if (done === QUESTS.length - 1)
              this.ev({ e: 'ch', s: 1, t: p.name + ' a terminé le chapitre 1 : le cristal chante à nouveau !' });
          }
          break;
        }
        case 'chat': {
          if (this.t - p.chatT < 1) return;
          p.chatT = this.t;
          const t = cleanChat(m.text);
          if (t) this.ev({ e: 'ch', id, n: p.name, t });
          break;
        }
      }
    }
    addSk(p, key, v) {
      const cap = skCap(p.lvl),
        before = skRank(p.sk[key] || 0, cap);
      p.sk[key] = Math.min(skTotal(Math.min(SK_MAX, cap + 1)), (p.sk[key] || 0) + v); // réserve : au plus un rang d'avance
      const after = skRank(p.sk[key], cap);
      if (after > before) this.ev({ e: 'skr', id: p.id, k: key, r: after });
    }
    addMast(p, v) {
      const fam = weaponFam(p.equip);
      if (fam === 'none') return;
      const before = mLevel(p.mast[fam] || 0).lv;
      p.mast[fam] = Math.min(MAST_CAP, (p.mast[fam] || 0) + v);
      const after = mLevel(p.mast[fam]).lv;
      if (after > before) this.ev({ e: 'ml', id: p.id, f: fam, lv: after });
    }
    hitMob(m, dmg, p, crit) {
      // élément de l'arme contre celui du monstre ; bonus d'ensemble si l'arme est du même élément que l'armure
      const ek = elK(p.el, MOBDEF[m.type].el);
      dmg = Math.max(1, Math.round(dmg * ek * (p.setEl && p.setEl === p.el ? 1 + EL_SET[1] : 1)));
      if (m.vulnT > this.t) dmg = Math.round(dmg * (1 + m.vulnK));
      if (MOBDEF[m.type].el === 'light') dmg = Math.max(1, Math.round(dmg * 0.8));
      m.hitT = this.t;
      m.hp -= dmg;
      m.tagged.add(p.id);
      this.addMast(p, 1);
      // effet de l'île, sauf sur les créatures du même élément (le feu ne brûle pas une gelée de braise)
      const el = MOBDEF[m.type].el,
        imm = (this.fx === 'slow' && el === 'ice') || (this.fx === 'burn' && el === 'fire');
      if (imm) {
        if (!(m.immT > this.t)) {
          m.immT = this.t + 4;
          this.ev({ e: 'imm', m: m.k, fx: this.fx });
        }
      } else if (this.fx === 'slow') m.slowT = this.t + 2.5;
      else if (this.fx === 'burn') {
        m.burnT = this.t + 3;
        m.burnBy = p.id;
        m.burnDps = Math.max(1, dmg * 0.12);
      }
      if (m.target == null) {
        m.target = p.id;
        m.returning = false;
      }
      const d = Math.hypot(m.x - p.x, m.y - p.y) || 1;
      moveBy(this.W, m, ((m.x - p.x) / d) * 0.12, ((m.y - p.y) / d) * 0.12);
      this.ev({ e: 'hm', m: m.k, v: dmg, c: crit ? 1 : 0, by: p.id, ef: ek > 1 ? 1 : ek < 1 ? -1 : 0 });
      if (m.hp <= 0) this.killMob(m);
    }
    killMob(m) {
      m.alive = false;
      m.respawnT = m.respawn;
      m.target = null;
      m.returning = false;
      this.ev({ e: 'km', m: m.k });
      const group = [...m.tagged].map(id => this.players.get(id)).filter(Boolean);
      const bonus = group.length > 1 ? 1.25 : 1;
      for (const p of group) {
        const xp = Math.round(m.xp * bonus),
          gold = Math.round(m.lvl * 3 * (0.7 + Math.random() * 0.6));
        const pot = Math.random() < (m.type === 'boss' ? 1 : 0.18) ? 1 : 0;
        if (Math.random() < (UNIQUE_CHANCE[m.type] || 0)) {
          this.giveItem(p, [UNIQUE_BOOTS, 4], m.k);
          this.ev({ e: 'ch', s: 1, t: p.name + ' a trouvé les Bottes du Néant (Unique) !' });
        }
        const LT = LOOT[m.type];
        if (LT && Math.random() < (m.elite ? 1 : LT.ch))
          this.giveItem(p, [LT.items[Math.floor(Math.random() * LT.items.length)], rollRarity(m.elite ? 1 : LT.minR)], m.k);
        if (m.dgBoss != null) {
          const B = DG_BOSSES[m.dgBoss];
          if (Math.random() < DG_ITEM_CH[B.r]) {
            this.giveItem(p, [B.item, rollRarity(Math.min(3, B.r))], m.k);
            this.ev({ e: 'ch', s: 1, t: p.name + ' a obtenu ' + ITEMS[B.item].n + ' !' });
          }
          if (B.title && !(p.ttl & B.title)) {
            p.ttl |= B.title;
            p.tt = TITLES.findIndex(o => o[0] === B.title);
            this.ev({ e: 'ttl', id: p.id, n: TITLES[p.tt][1] });
          }
          if (p.dg && p.dg.s === this.W.seed) p.dg.done = 1;
        }
        p.gold += gold;
        p.potions += pot;
        this.ev({ e: 'lt', id: p.id, m: m.k, xp, g: gold, pot, grp: group.length > 1 ? 1 : 0 });
        this.gainXP(p, xp);
        this.addMast(p, m.type === 'boss' || m.dgBoss != null ? 30 : (2 + m.lvl) * (m.elite ? 3 : 1));
        this.questProgress(p, m);
      }
      if (m.dgBoss != null) {
        const B = DG_BOSSES[m.dgBoss];
        if (group.length)
          this.ev({
            e: 'ch',
            s: 1,
            t: B.n + ' (boss ' + dgTier(m.dgBoss).n + ') est vaincu ! Bravo ' + group.map(p => p.name).join(', ') + ' !'
          });
        this.ev({ e: 'dgdone', s: this.W.seed });
      } else if (m.type === 'boss' && group.length)
        this.ev({ e: 'ch', s: 1, t: 'Le Roi Gelée est tombé ! Bravo ' + group.map(p => p.name).join(', ') + ' !' });
      m.tagged.clear();
    }
    questProgress(p, m) {
      const Q = QUESTS[p.q];
      if (!Q || p.qs !== 1 || Q.mob !== m.type) return;
      if (Q.type === 'loot' && Math.random() >= Q.drop) return;
      p.qn = Math.min(Q.n, p.qn + 1);
      this.ev({ e: 'qp', id: p.id, q: p.q, n: p.qn, m: m.k, item: Q.type === 'loot' ? 1 : 0 });
      if (p.qn >= Q.n) {
        p.qs = 2;
        this.ev({ e: 'qc', id: p.id, q: p.q });
      }
    }
    gainXP(p, v) {
      if (p.lvl >= MAX_LVL) {
        p.xp = 0;
        return;
      }
      p.xp += v;
      while (p.lvl < MAX_LVL && p.xp >= xpNeed(p.lvl)) {
        p.xp -= xpNeed(p.lvl);
        p.lvl++;
        this.recalc(p, true);
        this.ev({ e: 'lv', id: p.id, lv: p.lvl });
        // le plafond monte : les compétences « prêtes » passent leur rang
        for (const k in p.sk) {
          const a = skRank(p.sk[k], skCap(p.lvl - 1)),
            b = skRank(p.sk[k], skCap(p.lvl));
          if (b > a) this.ev({ e: 'skr', id: p.id, k, r: b });
        }
      }
      if (p.lvl >= MAX_LVL) p.xp = 0;
    }
    // attaque spéciale d'un boss (DG_BOSSES[].sk) : touche les héros dans le cercle annoncé
    bossSkill(m, c) {
      const S = DG_BOSSES[m.dgBoss].sk,
        fx = new Set(S.fx);
      if (fx.has('saut') && this.W.walkable(Math.floor(c.x), Math.floor(c.y))) {
        m.x = c.x;
        m.y = c.y;
      }
      this.ev({ e: 'bskx', m: m.k, x: +c.x.toFixed(2), y: +c.y.toFixed(2), r: S.r, fx: S.fx });
      for (const p of this.players.values()) {
        if (p.dead || Math.hypot(p.x - c.x, p.y - c.y) > S.r) continue;
        this.hurt(p, m.atk * S.k, m);
        if (p.dead) continue;
        if (fx.has('lent')) p.pslowT = this.t + 3;
        if (fx.has('racines')) p.rootT = this.t + 1.5;
        if (fx.has('brule')) {
          p.pburnT = this.t + 4;
          p.pburnDps = Math.max(1, m.atk * 0.15);
          p.pburnBy = m;
        }
        if (fx.has('attire')) {
          const d = Math.hypot(p.x - m.x, p.y - m.y) || 1,
            nx = m.x + ((p.x - m.x) / d) * 1.1,
            ny = m.y + ((p.y - m.y) / d) * 1.1;
          if (this.W.walkable(Math.floor(nx), Math.floor(ny))) {
            p.x = nx;
            p.y = ny;
            p.lastMv = this.t;
            this.ev({ e: 'tp', id: p.id, x: p.x, y: p.y, dash: 1 });
          }
        }
      }
    }
    // un joueur adverse sur les îles (pvp) ; foe(p, id) : cible valide seulement si le combat entre joueurs est permis
    foe(p, id) {
      const o = this.players.get(String(id));
      return this.pvp && o && o !== p && !o.dead ? o : null;
    }
    // dégâts subis par un héros : src = monstre, ou joueur (îles) ; raw : dégâts déjà tirés au sort
    hurt(p, dmg, m, raw) {
      if (p.dead) return;
      const isMob = m && m.k != null,
        srcEl = isMob ? MOBDEF[m.type].el : m && m.el; // élément du coup : celui du monstre, ou de l'arme du joueur
      dmg = Math.max(
        1,
        Math.round(
          dmg *
            (raw ? 1 : 0.85 + Math.random() * 0.3) *
            (1 - (p.red || 0)) *
            (p.buffT > this.t ? 0.7 : 1) *
            (1 - ((p.res && p.res[srcEl]) || 0))
        )
      );
      const blk =
        p.equip.offhand &&
        weaponFam(p.equip) === 'sword' &&
        mLevel(p.mast.sword || 0).lv >= 8 &&
        Math.random() < 0.25 + 0.01 * (skRank(p.sk['sword:block'] || 0, skCap(p.lvl)) - 1);
      if (blk) this.addSk(p, 'sword:block', 2);
      if (blk) dmg = Math.max(1, Math.round(dmg * 0.25));
      if (p.guardT > this.t) dmg = Math.max(1, Math.round(dmg * (1 - p.guardK)));
      const src = isMob ? { m: m.k } : { m: -1, by: m && m.id };
      if (p.shieldHP > 0) {
        const a0 = Math.min(p.shieldHP, dmg);
        p.shieldHP -= a0;
        dmg -= a0;
        if (!dmg) {
          this.ev(Object.assign({ e: 'hp', id: p.id, v: 0, sh: 1 }, src));
          return;
        }
      }
      p.hp -= dmg;
      p.lastHit = 0;
      // trait de l'élément du monstre
      const el = isMob ? MOBDEF[m.type].el : null;
      if (el === 'fire' && !p.dead) {
        p.pburnT = this.t + 3;
        p.pburnDps = Math.max(1, m.atk * 0.12);
        p.pburnBy = m;
      } else if (el === 'ice') p.pslowT = this.t + 2;
      else if (el === 'dark') m.hp = Math.min(m.maxhp, m.hp + dmg * 0.3);
      this.ev(Object.assign({ e: 'hp', id: p.id, v: dmg, b: blk ? 1 : 0 }, src));
      if (p.hp <= 0) this.die(p, isMob ? null : m);
    }
    die(p, killer) {
      p.hp = 0;
      p.dead = true;
      p.deadT = 5;
      p.moving = 0;
      const loss = Math.floor(p.xp * 0.1);
      p.xp -= loss;
      // îles : tout le sac reste sur le corps (sauf les objets uniques), pillable par n'importe qui pendant 3 minutes
      let drop = 0;
      if (this.pvp) {
        const lost = p.bag.filter(i => !ITEMS[i[0]].unique);
        if (lost.length) {
          this.corpses.push({ id: this.corpseN++, x: p.x, y: p.y, name: p.name, items: lost, until: this.t + 180 });
          drop = lost.length;
        }
        p.bag = p.bag.filter(i => ITEMS[i[0]].unique);
      }
      this.ev({ e: 'die', id: p.id, loss, drop, by: killer ? killer.name : null });
      if (killer) this.ev({ e: 'ch', s: 1, t: killer.name + ' a vaincu ' + p.name + ' !' });
      for (const mm of this.mobs)
        if (mm.target === p.id) {
          mm.target = null;
          mm.returning = true;
        }
    }
    step(dt) {
      this.t += dt;
      const W = this.W;
      if (this.corpses.length) this.corpses = this.corpses.filter(o => o.until > this.t);
      for (const p of this.players.values()) {
        p.atkCd -= dt;
        p.skillCd -= dt;
        p.potCd -= dt;
        p.lastHit += dt;
        if (p.dead) {
          p.deadT -= dt;
          if (p.deadT <= 0) {
            p.dead = false;
            p.x = this.spawn.x;
            p.y = this.spawn.y;
            p.hp = p.maxhp;
            p.mp = p.maxmp;
            p.lastMv = this.t;
            this.ev({ e: 'rs', id: p.id });
            this.ev({ e: 'tp', id: p.id, x: p.x, y: p.y });
          }
          continue;
        }
        if (this.traps && !(p.trapT > this.t)) {
          const ph = this.traps.get(W.idx(Math.floor(p.x), Math.floor(p.y)));
          if (ph != null && trapUp(this.t, ph)) {
            p.trapT = this.t + 1;
            this.hurt(p, p.maxhp * 0.12, null, true);
            if (p.dead) continue;
          }
        }
        if (p.lastHit > 4) p.hp = Math.min(p.maxhp, p.hp + p.maxhp * 0.03 * dt);
        if (p.regenT > this.t) p.hp = Math.min(p.maxhp, p.hp + p.regenPs * dt);
        if (p.pburnT > this.t) {
          p.pburnAcc = (p.pburnAcc || 0) + p.pburnDps * dt;
          if (p.pburnAcc >= Math.max(1, p.pburnDps * 0.6)) {
            const v = Math.round(p.pburnAcc);
            p.pburnAcc = 0;
            p.hp -= v;
            p.lastHit = 0;
            this.ev({ e: 'hp', id: p.id, v, m: p.pburnBy.k != null ? p.pburnBy.k : -1, burn: 1 });
            if (p.hp <= 0) {
              p.hp = 1;
              this.hurt(p, 1, p.pburnBy, true);
              if (p.dead) continue;
            }
          }
        }
        p.mp = Math.min(p.maxmp, p.mp + p.maxmp * 0.04 * dt);
        if (this.t - p.lastMv > 0.5) p.moving = 0;
      }
      for (let z = this.zones.length - 1; z >= 0; z--) {
        const Z = this.zones[z];
        if (Z.until <= this.t) {
          this.zones.splice(z, 1);
          continue;
        }
        Z.acc += dt;
        if (Z.acc < 0.5) continue;
        Z.acc = 0;
        const zp = this.players.get(Z.by);
        if (!zp) continue;
        for (const o of this.mobs)
          if (o.alive && MOBDEF[o.type].el !== 'fire' && Math.hypot(o.x - Z.x, o.y - Z.y) <= Z.r)
            this.hitMob(o, Math.max(1, Math.round(Z.dps * 0.5)), zp, false);
      }
      for (const m of this.mobs) {
        if (!m.alive) {
          m.respawnT -= dt;
          if (m.respawnT <= 0) {
            let near = false;
            for (const p of this.players.values()) if (Math.hypot(p.x - m.hx, p.y - m.hy) < 5) near = true;
            if (near) m.respawnT = 1;
            else {
              m.alive = true;
              m.x = m.hx;
              m.y = m.hy;
              m.hp = m.maxhp;
              m.target = null;
              m.returning = false;
              this.ev({ e: 'mr', m: m.k });
            }
          }
          continue;
        }
        m.atkCd -= dt;
        m.moving = false;
        if (m.burnT > this.t) {
          m.burnAcc = (m.burnAcc || 0) + m.burnDps * dt;
          if (m.burnAcc >= Math.max(1, m.burnDps * 0.6)) {
            const v = Math.round(m.burnAcc);
            m.burnAcc = 0;
            m.hp -= v;
            this.ev({ e: 'hm', m: m.k, v, c: 0, by: m.burnBy, burn: 1 });
            if (m.hp <= 0) {
              this.killMob(m);
              continue;
            }
          }
        }
        if (m.bleedT > this.t) {
          m.bleedAcc = (m.bleedAcc || 0) + m.bleedDps * dt;
          if (m.bleedAcc >= Math.max(1, m.bleedDps * 0.6)) {
            const v = Math.round(m.bleedAcc);
            m.bleedAcc = 0;
            m.hp -= v;
            this.ev({ e: 'hm', m: m.k, v, c: 0, by: m.bleedBy, bleed: 1 });
            if (m.hp <= 0) {
              const bp = this.players.get(m.bleedBy);
              if (bp) m.tagged.add(bp.id);
              this.killMob(m);
              continue;
            }
          }
        }
        if (MOBDEF[m.type].el === 'wood' && !(m.hitT > this.t - 3) && m.hp < m.maxhp) m.hp = Math.min(m.maxhp, m.hp + m.maxhp * 0.02 * dt);
        if (m.stunT > this.t) continue;
        const slow = m.slowT > this.t ? m.slowK || 0.5 : 1;
        let tp = m.target != null ? this.players.get(m.target) : null;
        if (m.target != null && (!tp || tp.dead)) {
          tp = null;
          m.target = null;
          m.returning = true;
        }
        if (!tp && !m.returning && m.aggressive) {
          let best = null,
            bd = m.aggroR;
          for (const p of this.players.values()) {
            if (p.dead || p.stealthT > this.t) continue;
            const d = Math.hypot(p.x - m.x, p.y - m.y);
            if (d < bd) {
              bd = d;
              best = p;
            }
          }
          if (best) {
            tp = best;
            m.target = best.id;
            if (m.type === 'boss' && this.t - this.bossWarn > 30) {
              this.bossWarn = this.t;
              this.ev({ e: 'ch', s: 1, t: 'Le Roi Gelée se réveille ! Appelez du renfort !' });
            }
          }
        }
        const dh = Math.hypot(m.x - m.hx, m.y - m.hy);
        if (tp && (dh > 10 || Math.hypot(tp.x - m.x, tp.y - m.y) > 9)) {
          tp = null;
          m.target = null;
          m.returning = true;
          m.tagged.clear();
        }
        const step = (tx, ty, spd) => {
          const dx = tx - m.x,
            dy = ty - m.y,
            d = Math.hypot(dx, dy);
          if (d < 0.01) return;
          const s = Math.min(d, spd * slow * dt);
          moveBy(W, m, (dx / d) * s, (dy / d) * s);
          m.moving = true;
        };
        // boss de donjon : attaque spéciale annoncée par un cercle au sol, immobile pendant l'annonce
        if (m.dgBoss != null) {
          if (m.cast) {
            if (this.t >= m.cast.at) {
              this.bossSkill(m, m.cast);
              m.cast = null;
            }
            continue;
          }
          if (tp && !m.returning) {
            m.skT = (m.skT == null ? 4 : m.skT) - dt;
            if (m.skT <= 0) {
              const S = DG_BOSSES[m.dgBoss].sk,
                o = S.at === 'soi' ? m : tp;
              m.skT = 7 + Math.random() * 3;
              m.cast = { at: this.t + S.wind, x: o.x, y: o.y };
              this.ev({ e: 'bsk', m: m.k, n: S.n, x: +o.x.toFixed(2), y: +o.y.toFixed(2), r: S.r, d: S.wind });
              continue;
            }
          }
        }
        if (m.returning) {
          step(m.hx, m.hy, m.speed * 1.6);
          m.hp = Math.min(m.maxhp, m.hp + m.maxhp * 0.6 * dt);
          if (dh < 0.4) m.returning = false;
        } else if (tp) {
          const d = Math.hypot(tp.x - m.x, tp.y - m.y);
          if (d > m.range) step(tp.x, tp.y, m.speed);
          else if (m.atkCd <= 0) {
            m.atkCd = m.type === 'boss' ? 1.6 : 1.3;
            this.hurt(tp, m.atk, m);
          }
        } else {
          m.wt -= dt;
          if (m.wt <= 0) {
            if (Math.random() < 0.5) {
              m.wdx = m.wdy = 0;
            } else {
              const a = Math.random() * Math.PI * 2;
              m.wdx = Math.cos(a);
              m.wdy = Math.sin(a);
            }
            m.wt = 1 + Math.random() * 2.5;
          }
          if (m.wdx || m.wdy) {
            if (dh > 3) {
              m.wdx = (m.hx - m.x) / dh;
              m.wdy = (m.hy - m.y) / dh;
            }
            moveBy(W, m, m.wdx * 0.6 * dt, m.wdy * 0.6 * dt);
            m.moving = true;
          }
        }
      }
    }
    publicState() {
      const p = [],
        m = [];
      for (const q of this.players.values())
        p.push([
          q.id,
          q.name,
          q.lookStr,
          +q.x.toFixed(2),
          +q.y.toFixed(2),
          q.face,
          q.flip,
          q.moving,
          Math.ceil(q.hp),
          q.maxhp,
          q.lvl,
          q.dead ? 1 : 0,
          q.scarf,
          q.cls,
          q.equip && q.equip.feet && ITEMS[q.equip.feet[0]].fx === 'void' ? 1 : 0,
          gearStr(q.equip),
          q.tt,
          q.setN >= EL_SET[2] ? q.setEl : 0
        ]);
      for (const q of this.mobs)
        m.push([
          +q.x.toFixed(2),
          +q.y.toFixed(2),
          Math.max(0, Math.ceil(q.hp)),
          q.alive ? 1 : 0,
          q.target != null ? 1 : 0,
          q.moving ? 1 : 0,
          q.stunT > this.t ? 1 : q.burnT > this.t ? 3 : q.bleedT > this.t ? 4 : q.slowT > this.t ? 2 : 0,
          q.maxhp,
          q.lvl
        ]);
      return {
        p,
        m,
        c: this.chestOpen ? 1 : 0,
        cp: this.corpses.map(o => [o.id, +o.x.toFixed(2), +o.y.toFixed(2), o.items.length, o.name, Math.ceil(o.until - this.t)]),
        tm: +this.t.toFixed(2),
        dg: this.dg ? [this.dg.r, this.dg.b, this.dg.done] : 0
      };
    }
    meState(id) {
      const p = this.players.get(id);
      if (!p) return null;
      return {
        hp: Math.ceil(p.hp),
        maxhp: p.maxhp,
        mp: Math.floor(p.mp),
        maxmp: p.maxmp,
        lvl: p.lvl,
        xp: p.xp,
        need: p.lvl >= MAX_LVL ? 0 : xpNeed(p.lvl),
        gold: p.gold,
        potions: p.potions,
        dead: p.dead ? 1 : 0,
        deadT: Math.ceil(p.deadT),
        speed: p.speed * (p.hasteT > this.t ? 1.3 : 1) * (p.pslowT > this.t ? 0.65 : 1) * (p.rootT > this.t ? 0.2 : 1),
        pburn: p.pburnT > this.t ? 1 : 0,
        pslow: p.pslowT > this.t ? 1 : 0,
        cls: p.cls,
        mast: p.mast,
        sk: p.sk,
        skc: p.skc,
        shield: Math.round(p.shieldHP || 0),
        stealth: p.stealthT > this.t ? 1 : 0,
        pts: p.pts,
        free: freePts(p.lvl, p.pts),
        bar: p.bar,
        fr: p.fr,
        rcost: respecCost(p.lvl),
        abCd: p.abCd.map(t => Math.max(0, +(t - this.t).toFixed(1))),
        buff: Math.max(0, +(p.buffT - this.t).toFixed(1)),
        q: p.q,
        qs: p.qs,
        qn: p.qn,
        inv: p.inv,
        equip: p.equip,
        bag: p.bag,
        stats: p.stats,
        crit: p.crit,
        red: p.red,
        ether: p.ether,
        glvl: p.glvl,
        gxp: p.gxp,
        gneed: gNeed(p.glvl),
        scarves: p.scarves,
        scarf: p.scarf,
        stepsToday: p.stepsToday,
        atk: p.atk,
        ttl: p.ttl,
        tt: p.tt,
        el: p.el,
        res: p.res,
        setEl: p.setEl,
        setN: p.setN
      };
    }
  }

  // moteur (+ tout le contenu de content.js, réexporté tel quel)
  return Object.assign({}, K, {
    instEl,
    elK,
    dgTier,
    trapUp,
    isleName,
    MAX_LVL,
    intCdK,
    techCd,
    SK_MAX,
    skNeed,
    skTotal,
    skCap,
    skRank,
    skInfo,
    skLvlFor,
    ETHER_BRIDGE,
    ISLE_BIT,
    cleanIsle,
    MAST_MAX,
    mLevel,
    mTotal,
    weaponFam,
    kitOf,
    freePts,
    respecCost,
    itemStats,
    itemValue,
    computeStats,
    STEPS_PER_ETHER,
    DAILY_STEP_CAP,
    DAILY_GIFT,
    NODE_CD,
    gNeed,
    VERSION,
    SEED,
    MW,
    MH,
    CX,
    CY,
    SPAWN,
    LOOK_MAX,
    mobStats,
    xpNeed,
    buildWorld,
    canStand,
    moveBy,
    Sim,
    hash,
    vnoise,
    fbm,
    mulberry32,
    cleanName,
    cleanLook,
    GEAR_SLOTS,
    gearStr,
    parseGear
  });
});
