/* Pixels Worlds — client, scene.js : Décor statique trié par diagonale, effets (textes flottants, éclats), effets des armes et techniques.
   Les fichiers de client/game/ se partagent leurs déclarations (scripts classiques chargés dans l'ordre par persist.js,
   voir GAME_FILES) : une fonction ou une variable d'un fichier sert aux suivants. */
'use strict';
/* ---------- décor statique trié par diagonale ---------- */
const STATIC = Array.from({ length: NB }, () => []),
  LAMPS = [],
  CHIMNEYS = [],
  BLOSSOMS = [],
  FLIES = [],
  TORCHES = [],
  CRYSTALS = [];
const SEEN = DGN ? new Uint8Array(W.MW * W.MH) : null,
  TRAPS = {}; // donjon : cases déjà vues (mini-carte)
let SHADOW = null,
  GLOW = null,
  MINICOL = null,
  CLOUD9 = null,
  miniT = 0;
const NPCS = [];
// tuiles de tablier des ponts (planches dessinées par-dessus l'eau) : 'x' ou 'y' selon l'axe du pont
const DECK = {},
  DECKK = {};
for (const br of W.bridges || [])
  for (let a = 0; a <= br.L; a++) {
    const k = idx(br.i + br.di * a, br.j + br.dj * a);
    if (a) DECK[k] = br.di ? 'x' : 'y';
    DECKK[k] = br.kind;
  }
let nearGate = false,
  nearPortal = null,
  nearBridge = null,
  nearChest = false,
  chestOpen = false,
  travel = null,
  nearCorpse = null,
  CORPSES = [];
let nearNpc = null,
  nearNode = null,
  talkRect = null;
const NODES = W.nodes.map(n => ({ kind: 'node', k: n.k, res: n.res, x: n.x, y: n.y, z: W.hAt(n.x, n.y) })),
  nodeCd = {};
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
function buildScene() {
  if (W.isle === 'bourg')
    for (const n of Object.values(C.NPCS))
      NPCS.push({
        kind: 'npc',
        id: n.id,
        name: n.name,
        role: n.role,
        x: n.x,
        y: n.y,
        z: W.hAt(n.x, n.y),
        set: ARTAPI.charSet(n.look),
        face: 'front',
        flip: false,
        anim: 0,
        moving: false
      });
  const add = o => STATIC[clamp(Math.floor(o.x + o.y), 0, NB - 1)].push(o);
  for (const p of W.props) {
    const z = HT[idx(p.i, p.j)];
    if (p.type === 'house') {
      const h = ART.houses[p.v];
      add({ kind: 'house', x: p.i + 1.98, y: p.j + 1.98, z, i: p.i, j: p.j, h });
      CHIMNEYS.push({ i: p.i, j: p.j, z, h, t: Math.random() * 2 });
    } else if (p.type === 'lamp') {
      const o = { kind: 'img', img: ART.lamp, x: p.i + 0.5, y: p.j + 0.5, z, dy: 2 };
      add(o);
      LAMPS.push(o);
    } else if (p.type === 'fountain') add({ kind: 'fountain', x: p.i + 0.5, y: p.j + 0.5, z });
    else if (p.type === 'barrel' || p.type === 'crate')
      add({ kind: 'img', img: ART[p.type], x: p.i + 0.5, y: p.j + 0.5, z, dy: 2, shadow: 1 });
    else if (ART.trees[p.type]) {
      if (p.type === 'blossom') BLOSSOMS.push({ x: p.i + 0.5, y: p.j + 0.5, z });
      const zd = W.tdist(p.i, p.j),
        zk = W.theme === 'givre' ? '_g' : W.theme === 'braise' ? '_3' : W.theme === 'brume' ? '_2' : zd < 15 ? '' : zd < 20.5 ? '_2' : '_3',
        set = ART.trees[p.type + zk] || ART.trees[p.type];
      add({
        kind: 'img',
        img: set[p.v % 3],
        x: p.i + 0.5,
        y: p.j + 0.5,
        z,
        dy: p.type === 'rock' || p.type === 'bush' ? 3 : 2,
        shadow: p.type === 'rock' ? 1 : p.type === 'bush' ? 1.4 : 2.2,
        sway: p.type !== 'rock'
      });
    }
  }
  for (let j = 0; j < MH; j++)
    for (let i = 0; i < MW; i++) {
      const k = idx(i, j);
      if (TY[k] !== 2 || W.SOL[k]) continue;
      const r = C.hash(i, j, 600),
        n = r < 0.42 ? 1 : r < 0.6 ? 2 : 0,
        td = W.tdist(i, j);
      for (let q = 0; q < n; q++) {
        const t = C.hash(i, j, 610 + q),
          du = 0.15 + C.hash(i, j, 620 + q) * 0.7,
          dv = 0.15 + C.hash(i, j, 630 + q) * 0.7;
        let img,
          anim = null;
        const shroom = td > 15 && td < 20.5 ? 0.25 : 0.05;
        if (W.theme === 'givre' || W.theme === 'braise') {
          if (t < 0.6) continue;
          img = ART.pebble[q % 2];
        } else if (t < 0.5) anim = ART.tuft;
        else if (t < 0.75) img = ART.flowers[Math.floor(C.hash(i, j, 640 + q) * 6)];
        else if (t < 0.75 + shroom) img = ART.mini;
        else img = ART.pebble[q % 2];
        add({ kind: 'decor', img, anim, x: i + du, y: j + dv, z: HT[k], ph: C.hash(i, j, 650 + q) * 4 });
      }
    }
  for (const br of W.bridges || []) {
    const Wd = 0.42,
      at = (a, b) => (br.di ? { x: br.i + 1 + a, y: br.j + 0.5 + b } : { x: br.i + 0.5 + b, y: br.j + 1 + a });
    for (const side of [-1, 1])
      for (let a = 0; a <= br.L; a++) {
        const p0 = at(a, side * Wd),
          pv = a ? at(a - 1, side * Wd) : null;
        add({
          kind: 'bpost',
          x: p0.x,
          y: p0.y,
          z: 0,
          prev: pv,
          glow: br.kind === 'ether' ? ['#c89cff', '#7a4ad8'] : ['#ffd878', '#e89a30'],
          near: side > 0,
          ph: a * 0.7 + side
        });
      }
    const e0 = at(br.L - 0.05, 0);
    add({ kind: 'barch', x: e0.x, y: e0.y, z: 0, frames: ART.arch[br.kind], flip: !br.di });
  }
  if (W.chest) add({ kind: 'chest', x: W.chest.x, y: W.chest.y, z: W.hAt(W.chest.x, W.chest.y) });
  if (W.gate) add({ kind: 'gate', x: W.gate.x + 0.45, y: W.gate.y + 0.45, z: HT[idx(W.gate.i, W.gate.j)] });
  if (DGN) {
    const D = W.dg,
      ci = C.DG.indexOf(DGN);
    for (const t of D.torches) {
      const o = {
        kind: 'torch',
        x: t.i + (t.side === 'x' ? 1.02 : 0.5),
        y: t.j + (t.side === 'y' ? 1.02 : 0.5),
        z: 0,
        side: t.side,
        ph: Math.random() * 3
      };
      add(o);
      TORCHES.push(o);
    }
    for (const q of D.crystals) {
      const o = { kind: 'img', img: ART.dgn.crystal[ci], x: q.x, y: q.y, z: 0, dy: 2, shadow: 1 };
      add(o);
      CRYSTALS.push(o);
    }
    for (const t of D.traps) TRAPS[idx(t.i, t.j)] = t.ph;
    add({ kind: 'barch', x: D.portal.x, y: D.portal.y + 0.4, z: 0, frames: ART.arch.ether, flip: false });
    add({ kind: 'dexit', x: D.exit.x, y: D.exit.y + 0.4, z: 0, frames: ART.arch.home });
    D.seals.forEach((o, k) => add({ kind: 'seal', k, x: o.x, y: o.y, z: 0 }));
    for (const k of D.door) add({ kind: 'sdoor', x: (k % MW) + 0.5, y: ((k / MW) | 0) + 0.5, z: 0, ph: k % 7 });
  }
  for (const b of STATIC) b.sort((a, c) => a.x + a.y - (c.x + c.y));
  for (let i = 0; i < 14; i++)
    FLIES.push({ x: 0, y: 0, ph: Math.random() * TAU, col: pick(['#ffd6e6', '#fff2a8', '#cfe6ff', '#ffffff', '#ffc9a8']), init: false });
  // ombre portée douce
  SHADOW = document.createElement('canvas');
  SHADOW.width = 16;
  SHADOW.height = 6;
  const sg = SHADOW.getContext('2d');
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 16; x++) {
      const d = ((x + 0.5 - 8) / 8) ** 2 + ((y + 0.5 - 3) / 3) ** 2;
      if (d <= 1) {
        sg.fillStyle = d < 0.45 ? 'rgba(24,16,48,.34)' : 'rgba(24,16,48,.18)';
        sg.fillRect(x, y, 1, 1);
      }
    }
  GLOW = document.createElement('canvas');
  GLOW.width = GLOW.height = 64;
  const gg = GLOW.getContext('2d');
  const rg = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,214,120,0.55)');
  rg.addColorStop(0.4, 'rgba(255,170,80,0.18)');
  rg.addColorStop(1, 'rgba(255,140,60,0)');
  gg.fillStyle = rg;
  gg.fillRect(0, 0, 64, 64);
  // couleurs de la mini-carte
  const hx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  MINICOL = new Array(MW * MH);
  const solidCol = {};
  for (const p of W.props)
    for (let a = 0; a < p.w; a++)
      for (let b = 0; b < p.h; b++)
        solidCol[idx(p.i + a, p.j + b)] =
          p.type === 'house'
            ? hx('#b0503a')
            : p.type === 'oak' || p.type === 'pine' || p.type === 'bush'
              ? hx('#2e6234')
              : p.type === 'blossom'
                ? hx('#e08aa4')
                : hx('#8a8a9a');
  for (let k = 0; k < MW * MH; k++) {
    const t = TY[k],
      h = HT[k];
    const MP = {
      givre: ['#3a7ab4', '#c4d4e8', ['#9ab0cc', '#c8d8ec', '#e4eef8', '#ffffff']],
      braise: ['#7a2a2a', '#6a4838', ['#3a2424', '#54302c', '#6e3c34', '#8a5040']],
      brume: ['#3a3870', '#a49ab4', ['#5e5c88', '#7a789e', '#9a98b8', '#bcbad2']]
    }[W.theme];
    if (DGN) {
      MINICOL[k] = W.SOL[k] ? [40, 28, 60] : hx('#b8acd8');
      continue;
    }
    MINICOL[k] =
      DECKK[k] === 'home'
        ? hx('#ffd23f')
        : DECKK[k] === 'ether'
          ? hx('#b08ae8')
          : solidCol[k] ||
            (MP
              ? t === 0
                ? hx(MP[0])
                : t === 1
                  ? hx(MP[1])
                  : hx(MP[2][Math.min(3, h)])
              : t === 0
                ? hx('#2e7ee0')
                : t === 1
                  ? hx('#e0c890')
                  : t === 3
                    ? hx('#b4b2c4')
                    : t === 4
                      ? hx('#b8946a')
                      : hx(['#2f9a46', '#45b84c', '#6cd256', '#9ee46a'][Math.min(3, h)]));
  }
  for (let i = 0; i < 46; i++)
    motes.push({ x: Math.random() * 400, y: Math.random() * 700, ph: Math.random() * TAU, sp: 2 + Math.random() * 4 });
}

/* ---------- effets ---------- */
function floatAt(e, txt, color, big) {
  const [x, y] = ePx(e);
  floats.push({
    x,
    y: y - 26 * (e.scale || 1),
    text: String(txt),
    color,
    t: 0,
    dur: big ? 1.2 : 0.95,
    vx: (Math.random() - 0.5) * 14,
    big
  });
}
function burst(e, color, n, up) {
  const [x, y] = ePx(e);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU,
      s = 20 + Math.random() * 40;
    parts.push({
      x,
      y: y - 8,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s * 0.6 - 30 - (up || 0),
      g: 90,
      life: 0.5 + Math.random() * 0.4,
      max: 0.9,
      color
    });
  }
}
function ring(e, r1, color, dur) {
  const [x, y] = ePx(e);
  rings.push({ x, y, r0: 2, r1: r1 * 16, t: 0, dur: dur || 0.4, color });
}
function say(t, color) {
  const max = Math.floor((Math.min(170, UW - 64) - 4) / 4);
  for (const l of wrap(t, max)) chat.push({ text: l, color: color || '#ece6f4', t: time });
  if (chat.length > 60) chat = chat.slice(-60);
}
const sys = t => say(t, '#ffd75a');

/* ---------- effets des armes et techniques ---------- */
const shots = [],
  FOOT = [];
function shoot(from, to, kind, dur) {
  const [x0, y0] = ePx(from),
    [x1, y1] = ePx(to);
  shots.push({ x0, y0: y0 - 12, x1, y1: y1 - 6, t: 0, dur: dur || 0.18, kind });
}
// animation d'attaque : l'arme est armée puis frappe (ATK_T secondes en tout, la frappe sur les ATK_STRIKE dernières)
const ATK_T = 0.3,
  ATK_STRIKE = 0.21,
  ATK_RECOVER = 0.09; // armer 0,09 s · frapper 0,12 s · retour 0,09 s
function basicFx(e, tgt, fx) {
  fx = fx || 'slash';
  e.atkT = ATK_T;
  if (fx === 'slash') {
    e.slash = 0.18;
    e.slashAng = screenAng(e, tgt);
  } else if (fx === 'thrust') shoot(e, tgt, 'pierce', 0.1);
  else shoot(e, tgt, fx, fx === 'arrow' ? 0.16 : 0.22);
}
function abilityFx(e, ev, mb) {
  const A = { fx: ev.fx, name: ev.n || '', r: ev.r || 2, ar: ev.ar || 0 };
  e.atkT = ATK_T + 0.04;
  if (ev.tw)
    setTimeout(() => {
      e.atkT = ATK_T;
      if (A.fx === 'spin') {
        e.spin = 0.35;
        ring(e, A.r, '#ffe27a', 0.35);
      }
    }, 380);
  if (e === me && A.name) {
    floatAt(me, A.name, ev.rk >= C.SK_MAX ? '#ffd23f' : '#ffe9b0');
  }
  // rang 10 : la technique est plus grande et dorée
  if (ev.rk >= C.SK_MAX) {
    A.r *= 1.25;
    ring(e, A.r + 0.6, '#ffd23f', 0.6);
    burst(e, '#ffd23f', 22, 40);
    burst(e, '#fff6c0', 10, 60);
  }
  switch (A.fx) {
    case 'slashx':
      if (mb) {
        e.slash = 0.25;
        e.slashAng = screenAng(e, mb);
        burst(mb, '#fff0c0', 12, 14);
      }
      break;
    case 'spin':
      e.spin = 0.35;
      ring(e, A.r, '#ffe27a', 0.35);
      break;
    case 'charge':
      if (mb) {
        burst(mb, '#ffd060', 12, 10);
      }
      break;
    case 'shout':
      ring(e, 2.2, '#ff7a5a', 0.5);
      burst(e, '#ff9a6a', 18, 40);
      break;
    case 'volley':
      if (mb) {
        for (let k = 0; k < 6 + A.ar * 2; k++)
          setTimeout(() => {
            const off = { x: mb.x + (Math.random() - 0.5) * 2.5, y: mb.y + (Math.random() - 0.5) * 2.5, z: mb.z };
            shoot(e, off, 'arrow', 0.2);
          }, k * 50);
        ring(mb, A.r, '#d8f0b0', 0.4);
      }
      break;
    case 'pierce':
      if (mb) {
        shoot(e, mb, 'pierce', 0.14);
        burst(mb, '#a8dcff', 10, 10);
      }
      break;
    case 'rain':
      if (mb) {
        ring(mb, A.r, '#bfe6ff', 0.7);
        for (let k = 0; k < 26; k++)
          setTimeout(() => {
            const [x, y] = ePx(mb);
            parts.push({
              x: x + (Math.random() - 0.5) * A.r * 32,
              y: y - 60 + (Math.random() - 0.5) * A.r * 16,
              vx: -8,
              vy: 120,
              g: 0,
              life: 0.45,
              max: 0.45,
              color: '#e8f8ff'
            });
          }, k * 25);
      }
      break;
    case 'frost':
      ring(e, A.r, '#a8dcff', 0.5);
      for (let k = 0; k < 24; k++) {
        const a2 = (k / 24) * TAU,
          [x, y] = ePx(e);
        parts.push({
          x: x + Math.cos(a2) * 10,
          y: y - 6 + Math.sin(a2) * 5,
          vx: Math.cos(a2) * 50,
          vy: Math.sin(a2) * 25,
          g: 0,
          life: 0.5,
          max: 0.5,
          color: k % 3 ? '#cfefff' : '#ffffff'
        });
      }
      break;
    case 'fire':
      if (mb) {
        shoot(e, mb, 'fire', 0.28);
        setTimeout(() => {
          ring(mb, A.r, '#ff9a3c', 0.4);
          burst(mb, '#ff8a3a', 20, 30);
          burst(mb, '#ffd060', 10, 40);
        }, 280);
      }
      break;
    case 'heal':
      ring(e, 4, '#9cf07a', 0.6);
      break;
  }
}
