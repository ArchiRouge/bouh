/* Pixels Worlds — client (rendu, interface, entrées, réseau) */
(function () {
  'use strict';
  const C = window.EtheriaCore, ARTAPI = window.EtheriaArt;
  // île où se trouve le héros (voyage par les ponts) : lue dans la sauvegarde avant de construire le monde
  const ISLE = (() => { try { const sv = JSON.parse(localStorage.getItem('etheria_solo') || 'null') || (window.ETHERIA_SEED && window.ETHERIA_SEED.solo); return C.cleanIsle(sv && sv.isle); } catch (e) { return { k: 'bourg' }; } })();
  const W = C.buildWorld(C.SEED, ISLE), ISLE_INFO = C.ISLES[W.isle] || C.ISLES.bourg;
  const { MW, MH, TY, HT, idx } = W;
  const NB = MW + MH;
  const TAU = Math.PI * 2, FACES = ['front', 'back', 'side'];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  // recul de la caméra : 0 proche, 1 normal (par défaut), 2 loin — un cran = un pixel d'écran de moins par pixel de jeu (reste net)
  let ZOOM = (() => { try { const v = localStorage.getItem('etheria_zoom'); return v == null ? 1 : clamp(v | 0, 0, 2); } catch (e) { return 1; } })();
  const $ = id => document.getElementById(id);

  /* ---------- canvases : monde (pixels fins) + interface (pixels plus gros) ---------- */
  const cvW = $('world'), cvU = $('ui'), g = cvW.getContext('2d'), u = cvU.getContext('2d');
  let ST = 0, SB = 0, S = 4, SU = 6, VW = 300, VH = 600, UW = 200, UH = 400, K = S / SU, dpr = 1, GRADES = [], BACKDROP = null, gradeFrom = 0, gradeTo = 0, gradeK = 1, SUBX = 0, SUBY = 0, RQ = 0;
  /* ---------- ambiance « aquarelle » : tout est précalculé, un seul dessin par image ---------- */
  // 0 bourg (aube chaude), 1 prairies (or et jade), 2 bois (brume bleu-violet + rais de lumière), 3 terres sauvages (braise corail)
  const ZONE_LOOK = [
    { lt: 'rgba(255,214,170,0.22)', dk: 'rgba(122,88,170,0.16)', vg: 'rgba(42,24,64,0.22)', mote: [255, 228, 190] },
    { lt: 'rgba(255,238,178,0.20)', dk: 'rgba(70,150,150,0.14)', vg: 'rgba(20,48,64,0.18)', mote: [255, 246, 200] },
    { lt: 'rgba(170,230,220,0.18)', dk: 'rgba(56,36,130,0.30)', vg: 'rgba(14,18,52,0.34)', mote: [190, 255, 170], rays: 1, haze: 'rgba(170,200,220,0.12)' },
    { lt: 'rgba(255,170,110,0.28)', dk: 'rgba(140,40,64,0.28)', vg: 'rgba(52,16,28,0.30)', mote: [255, 150, 90], haze: 'rgba(255,190,150,0.08)' },
    // îles du voyage : 4 givre (bleu glacé), 5 braises (rougeoiement), 6 brume (violet laiteux)
    { lt: 'rgba(230,245,255,0.24)', dk: 'rgba(60,90,160,0.24)', vg: 'rgba(20,30,70,0.30)', mote: [255, 255, 255], haze: 'rgba(220,235,255,0.14)' },
    { lt: 'rgba(255,140,60,0.30)', dk: 'rgba(120,20,30,0.30)', vg: 'rgba(40,8,12,0.38)', mote: [255, 160, 70], haze: 'rgba(255,120,60,0.12)' },
    { lt: 'rgba(220,200,255,0.22)', dk: 'rgba(80,60,150,0.28)', vg: 'rgba(24,16,50,0.36)', mote: [230, 210, 255], rays: 1, haze: 'rgba(200,190,240,0.20)' }
  ];
  const THEME_LOOK = { givre: 4, braise: 5, brume: 6 };
  function zoneGrade(i) {
    if (GRADES[i]) return GRADES[i];
    const L = ZONE_LOOK[i] || ZONE_LOOK[0], c = document.createElement('canvas'); c.width = VW; c.height = VH; const o = c.getContext('2d');
    let gr = o.createLinearGradient(0, 0, VW * 0.6, VH); gr.addColorStop(0, L.lt); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, L.dk); o.fillStyle = gr; o.fillRect(0, 0, VW, VH);
    if (L.rays) for (let k = 0; k < 4; k++) { const x0 = VW * (0.05 + k * 0.22), w = VW * (0.06 + (k % 2) * 0.05); const rg = o.createLinearGradient(0, 0, 0, VH * 0.8); rg.addColorStop(0, 'rgba(230,255,240,0.20)'); rg.addColorStop(1, 'rgba(230,255,235,0)'); o.fillStyle = rg; o.beginPath(); o.moveTo(x0, 0); o.lineTo(x0 + w, 0); o.lineTo(x0 + w + VH * 0.35, VH * 0.8); o.lineTo(x0 + VH * 0.35 - w * 0.3, VH * 0.8); o.closePath(); o.fill(); }
    if (L.haze) { const hz = o.createLinearGradient(0, VH * 0.55, 0, VH); hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(1, L.haze); o.fillStyle = hz; o.fillRect(0, VH * 0.55, VW, VH * 0.45); }
    const vg = o.createRadialGradient(VW / 2, VH * 0.46, Math.min(VW, VH) * 0.32, VW / 2, VH / 2, Math.max(VW, VH) * 0.72); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, L.vg); o.fillStyle = vg; o.fillRect(0, 0, VW, VH);
    return (GRADES[i] = c);
  }
  // mer peinte : dégradé profond, auréoles d'aquarelle et fines lignes de houle (précalculé par taille d'écran)
  function buildBackdrop() {
    const c = document.createElement('canvas'); c.width = VW; c.height = VH; const o = c.getContext('2d');
    const SEA = { givre: ['#5a9ab4', '#2e6a8e', '#1c4468'], braise: ['#7a2a2a', '#4a1424', '#26081a'], brume: ['#5a5486', '#38345e', '#201c40'] }[W.theme] || ['#3a7a92', '#26567a', '#1b3a60'];
    const gr = o.createLinearGradient(0, 0, 0, VH); gr.addColorStop(0, SEA[0]); gr.addColorStop(0.5, SEA[1]); gr.addColorStop(1, SEA[2]); o.fillStyle = gr; o.fillRect(0, 0, VW, VH);
    const R0 = C.mulberry32(77);
    for (let k = 0; k < 9; k++) { const x = R0() * VW, y = R0() * VH, r = 30 + R0() * 90, bl = o.createRadialGradient(x, y, 0, x, y, r); const warm = k % 3 === 0; bl.addColorStop(0, warm ? 'rgba(240,200,190,0.10)' : 'rgba(180,230,220,0.10)'); bl.addColorStop(1, 'rgba(0,0,0,0)'); o.fillStyle = bl; o.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let y = 3; y < VH; y += 7) { o.fillStyle = 'rgba(220,240,235,' + (0.05 + R0() * 0.05).toFixed(3) + ')'; const x = Math.floor(R0() * VW), w = 6 + Math.floor(R0() * 22); o.fillRect(x, y, w, 1); }
    return c;
  }
  function zoneIndex() { if (THEME_LOOK[W.theme]) return THEME_LOOK[W.theme]; const i = C.ZONES.findIndex(z => z[1] === zone); return i < 0 ? 0 : i; }
  function resize() {
    dpr = window.devicePixelRatio || 1;
    const pw = Math.round(innerWidth * dpr), ph = Math.round(innerHeight * dpr), pm = Math.min(pw, ph);
    const S0 = Math.max(1, Math.round(pm / 240)); S = Math.max(Math.min(2, S0), S0 - ZOOM); SU = Math.max(2, Math.round(pm / 279)); // ~240 px de monde sur la largeur au plus proche, +25 % / +65 % en reculant ; interface ~30 % plus petite qu'à l'origine (pm / 195)
    VW = Math.ceil(pw / S); VH = Math.ceil(ph / S); UW = Math.ceil(pw / SU); UH = Math.ceil(ph / SU); K = S / SU;
    const sp = document.getElementById('safe'); if (sp) { const cs = getComputedStyle(sp); ST = Math.round(parseFloat(cs.paddingTop || 0) * dpr / SU); SB = Math.round(parseFloat(cs.paddingBottom || 0) * dpr / SU); }
    RQ = Math.min(RQ || S, S); cvW.width = VW * RQ; cvW.height = VH * RQ; cvW.style.width = VW * S / dpr + 'px'; cvW.style.height = VH * S / dpr + 'px'; // RQ sous-pixels par pixel de jeu : la caméra glisse finement
    cvU.width = UW; cvU.height = UH; cvU.style.width = UW * SU / dpr + 'px'; cvU.style.height = UH * SU / dpr + 'px';
    g.imageSmoothingEnabled = false; u.imageSmoothingEnabled = false;
    GRADES = []; BACKDROP = buildBackdrop();
  }
  window.addEventListener('resize', resize); resize();
  function setZoom(z) {
    z = clamp(z, 0, 2); if (z === ZOOM) return; ZOOM = z; try { localStorage.setItem('etheria_zoom', String(z)); } catch (e) { /* ignore */ }
    RQ = 0; resize(); if (mode === 'play') floatAt(me, 'Vue : ' + ['proche', 'normale', 'éloignée'][z], '#fff2d0');
  }
  let wheelT = 0; window.addEventListener('wheel', e => { if (mode !== 'play' || performance.now() - wheelT < 250) return; wheelT = performance.now(); setZoom(ZOOM + (e.deltaY > 0 ? 1 : -1)); }, { passive: true });

  /* ---------- police pixel 3x5 ---------- */
  const FONT = { A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110', '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001110', '_': '000000000000111', '-': '000000111000000', '+': '000010111010000', '!': '010010010000010', '.': '000000000000010', ':': '000010000010000', '/': '001001010100100', '?': '110001010000010', "'": '010010000000000', ',': '000000000010100', '(': '010100100100010', ')': '010001001001010', '%': '101001010100101', '#': '101111101111101', '*': '000101010101000', '<': '001010100010001', '>': '100010001010100', '=': '000111000111000' };
  const textCache = new Map();
  const clean = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  function textCanvas(str, color, outline) {
    const key = str + '|' + color + '|' + outline; let c = textCache.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = Math.max(1, str.length * 4 + 1); c.height = 7;
    const x = c.getContext('2d'), pts = [];
    for (let k = 0; k < str.length; k++) { const f = FONT[str[k]]; if (!f) continue; for (let b = 0; b < 15; b++) if (f[b] === '1') pts.push([1 + k * 4 + b % 3, 1 + Math.floor(b / 3)]); }
    if (outline) { x.fillStyle = outline === true ? '#1a0f1c' : outline; for (const [p, q] of pts) x.fillRect(p - 1, q - 1, 3, 3); }
    x.fillStyle = color; for (const [p, q] of pts) x.fillRect(p, q, 1, 1);
    if (textCache.size > 800) textCache.clear(); textCache.set(key, c); return c;
  }
  const textW = (s, sc) => (clean(s).length * 4 + 1) * (sc || 1);
  function text(ctx, s, x, y, color, align, sc, outline) {
    sc = sc || 1; const c = textCanvas(clean(s), color || '#fff', outline === undefined ? true : outline), w = c.width * sc;
    const dx = align === 'center' ? x - Math.floor(w / 2) : align === 'right' ? x - w : x;
    ctx.drawImage(c, Math.round(dx), Math.round(y), w, c.height * sc);
  }
  function wrap(str, max) { const words = clean(str).split(' '), lines = []; let cur = ''; for (const w of words) { if ((cur + ' ' + w).trim().length > max) { if (cur) lines.push(cur); cur = w.slice(0, max); } else cur = (cur ? cur + ' ' : '') + w; } if (cur) lines.push(cur); return lines; }

  /* ---------- état ---------- */
  let ART = null, mode = 'loading', time = 0, shake = 0, camX = 0, camY = 0, zone = '', zoneT = 0, online = 1, netMode = 'solo';
  let lastOX = 0, lastOY = 0, sendT = 0, saveT = 0, usedTouch = false, movedOnce = false;
  let chat = [];
  const floats = [], parts = [], rings = [], labels = [], motes = [];
  let link = null, myId = null;
  const prefs = (() => { try { return JSON.parse(localStorage.getItem('etheria_prefs') || 'null') || {}; } catch (e) { return {}; } })();
  const SEED = window.ETHERIA_SEED || null; // progression importée (première ouverture uniquement)
  if (!prefs.name && SEED && SEED.prefs) Object.assign(prefs, SEED.prefs);
  const look = C.cleanLook(prefs.look || [0, 2, 0, 0, 0]);
  const me = { name: prefs.name || '', x: C.SPAWN.x, y: C.SPAWN.y, z: 1, face: 'front', flip: false, moving: false, anim: 0, hp: 60, maxhp: 60, mp: 30, maxmp: 30, lvl: 1, xp: 0, need: 18, gold: 0, potions: 3, dead: 0, deadT: 0, atkCd: 0, skillCd: 0, potCd: 0, slash: 0, slashAng: 0, spin: 0, hitFlash: 0, target: null, set: null, sent: '' };
  const others = new Map();
  const mobs = W.spawns.map((s, k) => { const st = C.mobStats(s.type, s.lvl); return { k, type: s.type, lvl: s.lvl, name: C.MOBDEF[s.type].name, x: s.i + .5, y: s.j + .5, tx: s.i + .5, ty: s.j + .5, z: HT[idx(s.i, s.j)], hp: st.maxhp, maxhp: st.maxhp, alive: true, aggro: false, moving: false, hitFlash: 0, lunge: 0, phase: Math.random() * TAU, flip: false, scale: s.type === 'boss' ? 2 : 1 }; });
  const ePx = e => [(e.x - e.y) * 16, (e.x + e.y) * 8 - e.z * 8];
  const screenAng = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y; return Math.atan2((dx + dy) * 0.5, dx - dy); };
  function setFacing(e, dx, dy) { const sx = dx - dy, sy = (dx + dy) * 0.5; if (Math.abs(sx) > Math.abs(sy) * 1.3) { e.face = 'side'; e.flip = sx < 0; } else e.face = sy < 0 ? 'back' : 'front'; }

  /* ---------- décor statique trié par diagonale ---------- */
  const STATIC = Array.from({ length: NB }, () => []), LAMPS = [], CHIMNEYS = [], BLOSSOMS = [], FLIES = [];
  let SHADOW = null, GLOW = null, MINICOL = null, CLOUD9 = null, miniT = 0;
  const NPCS = [];
  // tuiles de tablier des ponts (planches dessinées par-dessus l'eau) : 'x' ou 'y' selon l'axe du pont
  const DECK = {}; for (const br of W.bridges || []) for (let a = 1; a <= br.L; a++) DECK[idx(br.i + br.di * a, br.j + br.dj * a)] = br.di ? 'x' : 'y';
  let nearBridge = null, nearChest = false, chestOpen = false, travel = null;
  let nearNpc = null, nearNode = null, talkRect = null;
  const NODES = W.nodes.map(n => ({ kind: 'node', k: n.k, res: n.res, x: n.x, y: n.y, z: W.hAt(n.x, n.y) })), nodeCd = {};
  const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  function buildScene() {
    if (W.isle === 'bourg') for (const n of Object.values(C.NPCS)) NPCS.push({ kind: 'npc', id: n.id, name: n.name, role: n.role, x: n.x, y: n.y, z: W.hAt(n.x, n.y), set: ARTAPI.charSet(n.look), face: 'front', flip: false, anim: 0, moving: false });
    const add = o => STATIC[clamp(Math.floor(o.x + o.y), 0, NB - 1)].push(o);
    for (const p of W.props) {
      const z = HT[idx(p.i, p.j)];
      if (p.type === 'house') { const h = ART.houses[p.v]; add({ kind: 'house', x: p.i + 1.98, y: p.j + 1.98, z, i: p.i, j: p.j, h }); CHIMNEYS.push({ i: p.i, j: p.j, z, h, t: Math.random() * 2 }); }
      else if (p.type === 'lamp') { const o = { kind: 'img', img: ART.lamp, x: p.i + .5, y: p.j + .5, z, dy: 2 }; add(o); LAMPS.push(o); }
      else if (p.type === 'fountain') add({ kind: 'fountain', x: p.i + .5, y: p.j + .5, z });
      else if (p.type === 'barrel' || p.type === 'crate') add({ kind: 'img', img: ART[p.type], x: p.i + .5, y: p.j + .5, z, dy: 2, shadow: 1 });
      else if (ART.trees[p.type]) { if (p.type === 'blossom') BLOSSOMS.push({ x: p.i + .5, y: p.j + .5, z }); const zd = W.tdist(p.i, p.j), zk = W.theme === 'givre' ? '_g' : W.theme === 'braise' ? '_3' : W.theme === 'brume' ? '_2' : zd < 15 ? '' : zd < 20.5 ? '_2' : '_3', set = ART.trees[p.type + zk] || ART.trees[p.type]; add({ kind: 'img', img: set[p.v % 3], x: p.i + .5, y: p.j + .5, z, dy: p.type === 'rock' || p.type === 'bush' ? 3 : 2, shadow: p.type === 'rock' ? 1 : p.type === 'bush' ? 1.4 : 2.2, sway: p.type !== 'rock' }); }
    }
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
      const k = idx(i, j); if (TY[k] !== 2 || W.SOL[k]) continue;
      const r = C.hash(i, j, 600), n = r < 0.42 ? 1 : r < 0.6 ? 2 : 0, td = W.tdist(i, j);
      for (let q = 0; q < n; q++) {
        const t = C.hash(i, j, 610 + q), du = 0.15 + C.hash(i, j, 620 + q) * 0.7, dv = 0.15 + C.hash(i, j, 630 + q) * 0.7;
        let img, anim = null;
        const shroom = td > 15 && td < 20.5 ? 0.25 : 0.05;
        if (W.theme === 'givre' || W.theme === 'braise') { if (t < 0.6) continue; img = ART.pebble[q % 2]; }
        else if (t < 0.5) anim = ART.tuft; else if (t < 0.75) img = ART.flowers[Math.floor(C.hash(i, j, 640 + q) * 6)]; else if (t < 0.75 + shroom) img = ART.mini; else img = ART.pebble[q % 2];
        add({ kind: 'decor', img, anim, x: i + du, y: j + dv, z: HT[k], ph: C.hash(i, j, 650 + q) * 4 });
      }
    }
    for (const br of W.bridges || []) {
      const Wd = 0.42, at = (a, b) => br.di ? { x: br.i + 1 + a, y: br.j + 0.5 + b } : { x: br.i + 0.5 + b, y: br.j + 1 + a };
      for (const side of [-1, 1]) for (let a = 0; a <= br.L; a++) { const p0 = at(a, side * Wd), pv = a ? at(a - 1, side * Wd) : null; add({ kind: 'bpost', x: p0.x, y: p0.y, z: 0, prev: pv, glow: br.kind === 'ether' ? ['#c89cff', '#7a4ad8'] : ['#ffd878', '#e89a30'], near: side > 0, ph: a * 0.7 + side }); }
      const e0 = at(br.L - 0.05, 0); add({ kind: 'barch', x: e0.x, y: e0.y, z: 0, frames: ART.arch[br.kind], flip: !br.di });
    }
    if (W.chest) add({ kind: 'chest', x: W.chest.x, y: W.chest.y, z: W.hAt(W.chest.x, W.chest.y) });
    for (const b of STATIC) b.sort((a, c) => (a.x + a.y) - (c.x + c.y));
    for (let i = 0; i < 14; i++) FLIES.push({ x: 0, y: 0, ph: Math.random() * TAU, col: pick(['#ffd6e6', '#fff2a8', '#cfe6ff', '#ffffff', '#ffc9a8']), init: false });
    // ombre portée douce
    SHADOW = document.createElement('canvas'); SHADOW.width = 16; SHADOW.height = 6; const sg = SHADOW.getContext('2d');
    for (let y = 0; y < 6; y++) for (let x = 0; x < 16; x++) { const d = ((x + .5 - 8) / 8) ** 2 + ((y + .5 - 3) / 3) ** 2; if (d <= 1) { sg.fillStyle = d < 0.45 ? 'rgba(24,16,48,.34)' : 'rgba(24,16,48,.18)'; sg.fillRect(x, y, 1, 1); } }
    GLOW = document.createElement('canvas'); GLOW.width = GLOW.height = 64; const gg = GLOW.getContext('2d'); const rg = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,214,120,0.55)'); rg.addColorStop(0.4, 'rgba(255,170,80,0.18)'); rg.addColorStop(1, 'rgba(255,140,60,0)'); gg.fillStyle = rg; gg.fillRect(0, 0, 64, 64);
    // couleurs de la mini-carte
    const hx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    MINICOL = new Array(MW * MH);
    const solidCol = {}; for (const p of W.props) for (let a = 0; a < p.w; a++) for (let b = 0; b < p.h; b++) solidCol[idx(p.i + a, p.j + b)] = p.type === 'house' ? hx('#b0503a') : (p.type === 'oak' || p.type === 'pine' || p.type === 'bush') ? hx('#2e6234') : p.type === 'blossom' ? hx('#e08aa4') : hx('#8a8a9a');
    for (let k = 0; k < MW * MH; k++) {
      const t = TY[k], h = HT[k];
      const MP = { givre: ['#3a7ab4', '#c4d4e8', ['#9ab0cc', '#c8d8ec', '#e4eef8', '#ffffff']], braise: ['#7a2a2a', '#6a4838', ['#3a2424', '#54302c', '#6e3c34', '#8a5040']], brume: ['#3a3870', '#a49ab4', ['#5e5c88', '#7a789e', '#9a98b8', '#bcbad2']] }[W.theme];
      MINICOL[k] = DECK[k] ? hx('#b07a44') : solidCol[k] || (MP ? (t === 0 ? hx(MP[0]) : t === 1 ? hx(MP[1]) : hx(MP[2][Math.min(3, h)])) : t === 0 ? hx('#2e7ee0') : t === 1 ? hx('#e0c890') : t === 3 ? hx('#b4b2c4') : t === 4 ? hx('#b8946a') : hx(['#2f9a46', '#45b84c', '#6cd256', '#9ee46a'][Math.min(3, h)]));
    }
    for (let i = 0; i < 46; i++) motes.push({ x: Math.random() * 400, y: Math.random() * 700, ph: Math.random() * TAU, sp: 2 + Math.random() * 4 });
  }

  /* ---------- effets ---------- */
  function floatAt(e, txt, color, big) { const [x, y] = ePx(e); floats.push({ x, y: y - 26 * (e.scale || 1), text: String(txt), color, t: 0, dur: big ? 1.2 : 0.95, vx: (Math.random() - .5) * 14, big }); }
  function burst(e, color, n, up) { const [x, y] = ePx(e); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = 20 + Math.random() * 40; parts.push({ x, y: y - 8, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 30 - (up || 0), g: 90, life: 0.5 + Math.random() * 0.4, max: 0.9, color }); } }
  function ring(e, r1, color, dur) { const [x, y] = ePx(e); rings.push({ x, y, r0: 2, r1: r1 * 16, t: 0, dur: dur || 0.4, color }); }
  function say(t, color) { const max = Math.floor((Math.min(170, UW - 64) - 4) / 4); for (const l of wrap(t, max)) chat.push({ text: l, color: color || '#ece6f4', t: time }); if (chat.length > 60) chat = chat.slice(-60); }
  const sys = t => say(t, '#ffd75a');

  /* ---------- effets des armes et techniques ---------- */
  const shots = [], FOOT = [];
  function shoot(from, to, kind, dur) { const [x0, y0] = ePx(from), [x1, y1] = ePx(to); shots.push({ x0, y0: y0 - 12, x1, y1: y1 - 6, t: 0, dur: dur || 0.18, kind }); }
  // animation d'attaque : l'arme est armée puis frappe (ATK_T secondes en tout, la frappe sur les ATK_STRIKE dernières)
  const ATK_T = 0.26, ATK_STRIKE = 0.16;
  function basicFx(e, tgt, fx) {
    fx = fx || 'slash'; e.atkT = ATK_T;
    if (fx === 'slash') { e.slash = 0.18; e.slashAng = screenAng(e, tgt); }
    else if (fx === 'thrust') shoot(e, tgt, 'pierce', 0.1);
    else shoot(e, tgt, fx, fx === 'arrow' ? 0.16 : 0.22);
  }
  function abilityFx(e, ev, mb) {
    const A = { fx: ev.fx, name: ev.n || '', r: ev.r || 2 }; e.atkT = ATK_T + 0.04;
    if (e === me && A.name) { floatAt(me, A.name, '#ffe9b0'); }
    switch (A.fx) {
      case 'slashx': if (mb) { e.slash = 0.25; e.slashAng = screenAng(e, mb); burst(mb, '#fff0c0', 12, 14); } break;
      case 'spin': e.spin = 0.35; ring(e, A.r, '#ffe27a', 0.35); break;
      case 'charge': if (mb) { burst(mb, '#ffd060', 12, 10); } break;
      case 'shout': ring(e, 2.2, '#ff7a5a', 0.5); burst(e, '#ff9a6a', 18, 40); break;
      case 'volley': if (mb) { for (let k = 0; k < 6; k++) setTimeout(() => { const off = { x: mb.x + (Math.random() - .5) * 2.5, y: mb.y + (Math.random() - .5) * 2.5, z: mb.z }; shoot(e, off, 'arrow', 0.2); }, k * 50); ring(mb, A.r, '#d8f0b0', 0.4); } break;
      case 'pierce': if (mb) { shoot(e, mb, 'pierce', 0.14); burst(mb, '#a8dcff', 10, 10); } break;
      case 'rain': if (mb) { ring(mb, A.r, '#bfe6ff', 0.7); for (let k = 0; k < 26; k++) setTimeout(() => { const [x, y] = ePx(mb); parts.push({ x: x + (Math.random() - .5) * A.r * 32, y: y - 60 + (Math.random() - .5) * A.r * 16, vx: -8, vy: 120, g: 0, life: 0.45, max: 0.45, color: '#e8f8ff' }); }, k * 25); } break;
      case 'frost': ring(e, A.r, '#a8dcff', 0.5); for (let k = 0; k < 24; k++) { const a2 = k / 24 * TAU, [x, y] = ePx(e); parts.push({ x: x + Math.cos(a2) * 10, y: y - 6 + Math.sin(a2) * 5, vx: Math.cos(a2) * 50, vy: Math.sin(a2) * 25, g: 0, life: 0.5, max: 0.5, color: k % 3 ? '#cfefff' : '#ffffff' }); } break;
      case 'fire': if (mb) { shoot(e, mb, 'fire', 0.28); setTimeout(() => { ring(mb, A.r, '#ff9a3c', 0.4); burst(mb, '#ff8a3a', 20, 30); burst(mb, '#ffd060', 10, 40); }, 280); } break;
      case 'heal': ring(e, 4, '#9cf07a', 0.6); break;
    }
  }

  /* ---------- entrées ---------- */
  const input = { atkBtn: false, atkKey: false, ab: -1, pot: false };
  const CL = () => C.kitOf(me.equip, me.mast, me.bar); // arme en main → attaque de base + 3 techniques
  const localAbCd = [0, 0, 0];
  const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 }, keys = {}, pointers = new Map(), btnDown = {};
  function btns() { const b = UH - 12 - SB, K0 = CL(); return { atk: { x: UW - 27, y: b - 18, r: 18, icon: 'a_' + K0.basic.icon }, s0: { x: UW - 62, y: b - 6, r: 12, icon: 'a_' + K0.ab[0].icon, ab: 0 }, s1: { x: UW - 59, y: b - 38, r: 12, icon: 'a_' + K0.ab[1].icon, ab: 1 }, s2: { x: UW - 31, y: b - 57, r: 12, icon: 'a_' + K0.ab[2].icon, ab: 2 }, pot: { x: UW - 91, y: b - 4, r: 10, icon: 'potion' }, chat: { x: UW - 64, y: 16 + ST, r: 9, icon: 'chat' }, bag: { x: UW - 64, y: 38 + ST, r: 9, icon: 'bag' }, zoom: { x: UW - 64, y: 60 + ST, r: 9, icon: 'zoom' } }; }
  const toU = e => ({ x: e.clientX * dpr / SU, y: e.clientY * dpr / SU });
  function hitBtn(p) { const B = btns(); for (const k in B) { const b = B[k]; if (Math.hypot(p.x - b.x, p.y - b.y) <= b.r + 4) return k; } return null; }
  function pressBtn(k, down) { btnDown[k] = down; if (k === 'atk') input.atkBtn = down; else if (down) { if (k[0] === 's' && k.length === 2) input.ab = +k[1]; if (k === 'pot') input.pot = true; if (k === 'chat') openChat(); if (k === 'bag') openChar(); if (k === 'zoom') setZoom((ZOOM + 1) % 3); } }
  cvU.addEventListener('pointerdown', e => {
    e.preventDefault(); if (e.pointerType === 'touch') usedTouch = true;
    if (mode !== 'play') return;
    const p = toU(e);
    if (Math.hypot(p.x - (UW - 27), p.y - (27 + ST)) < 25) { showFps = !showFps; return; } // mini-carte → compteur d'images/s
    if (p.x >= 3 && p.x <= 3 + Math.min(104, UW - 64) && p.y >= ST + 3 && p.y <= ST + 36) { openChar(); return; } // portrait → page personnage
    if (hudWalk && p.x >= hudWalk.x && p.x <= hudWalk.x + hudWalk.w && p.y >= hudWalk.y - 3 && p.y <= hudWalk.y + hudWalk.h + 3) { openWalk(); return; }
    if (talkRect && p.x >= talkRect.x - 3 && p.x <= talkRect.x + talkRect.w + 3 && p.y >= talkRect.y - 4 && p.y <= talkRect.y + talkRect.h + 4) { interact(); return; }
    const b = hitBtn(p);
    if (b) { pointers.set(e.pointerId, { type: 'btn', b }); pressBtn(b, true); return; }
    if (!joy.active && p.x < UW * 0.62) { joy.active = true; joy.id = e.pointerId; joy.ox = joy.x = p.x; joy.oy = joy.y = p.y; pointers.set(e.pointerId, { type: 'joy' }); }
    try { cvU.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  cvU.addEventListener('pointermove', e => { if (joy.active && e.pointerId === joy.id) { const p = toU(e); joy.x = p.x; joy.y = p.y; } });
  function release(e) { const p = pointers.get(e.pointerId); if (!p) return; pointers.delete(e.pointerId); if (p.type === 'btn') pressBtn(p.b, false); if (p.type === 'joy') { joy.active = false; joy.id = null; } }
  cvU.addEventListener('pointerup', release); cvU.addEventListener('pointercancel', release);
  document.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('keydown', e => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    keys[e.code] = true; if (mode !== 'play') return;
    if (e.code === 'Space') { input.atkKey = true; e.preventDefault(); }
    if (e.code === 'KeyE' || e.code === 'Digit1') input.ab = 0; if (e.code === 'Digit2') input.ab = 1; if (e.code === 'Digit3') input.ab = 2; if (e.code === 'KeyR') input.pot = true;
    if (e.code === 'Enter') { e.preventDefault(); openChat(); }
    if (e.code === 'KeyF') interact();
    if (e.code === 'KeyI' || e.code === 'KeyC') openChar();
  });
  addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Space') input.atkKey = false; });
  function inputDir() {
    if (joy.active) { const dx = joy.x - joy.ox, dy = joy.y - joy.oy, m = Math.hypot(dx, dy); if (m > 3) return [dx / m, dy / m]; }
    const x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), y = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    if (x || y) { const m = Math.hypot(x, y); return [x / m, y / m]; } return [0, 0];
  }
  // dialogues avec les personnages
  const dlg = $('dialog'), dport = $('dport'), dpx = dport.getContext('2d');
  let dlgAction = null;
  function openNpc(n) {
    if (!n || me.dead) return;
    input.atkBtn = false; joy.active = false;
    const Q = C.QUESTS[me.q], N = C.NPCS[n.id];
    let txt, obj = '', rew = '', ok = 'Au revoir', act = null, later = false;
    if (!Q) txt = "Pixels Worlds te doit beaucoup, gardien. Reviens nous voir quand la suite de l'histoire s'écrira.";
    else if (Q.giver !== n.id) txt = N.idle[Math.floor(Math.random() * N.idle.length)] + (me.qs === 0 ? ' ' + C.NPCS[Q.giver].name + ' te cherchait, je crois.' : '');
    else if (me.qs === 0) { txt = Q.intro; obj = Q.obj; rew = Q.xp + ' XP · ' + Q.gold + ' PO' + (Q.pot ? ' · ' + Q.pot + ' potion' + (Q.pot > 1 ? 's' : '') : '') + (Q.reward ? ' · ' + C.ITEMS[Q.reward[0]].n + ' (' + C.RARITY[Q.reward[1]][0].toLowerCase() + ')' : ''); ok = 'Accepter'; act = 'talk'; later = true; }
    else if (me.qs === 1) { txt = Q.wait; obj = Q.short + ' : ' + me.qn + ' / ' + Q.n; ok = "J'y retourne"; }
    else { txt = Q.done; rew = Q.xp + ' XP · ' + Q.gold + ' PO' + (Q.pot ? ' · ' + Q.pot + ' potion' + (Q.pot > 1 ? 's' : '') : '') + (Q.reward ? ' · ' + C.ITEMS[Q.reward[0]].n + ' (' + C.RARITY[Q.reward[1]][0].toLowerCase() + ')' : ''); ok = 'Terminer la quête'; act = 'talk'; }
    $('dname').textContent = n.name; $('drole').textContent = N.role; $('dtitle').textContent = Q && Q.giver === n.id ? Q.title : ''; $('dtitle').hidden = !(Q && Q.giver === n.id);
    $('dtext').textContent = txt; $('dobj').textContent = obj ? 'Objectif : ' + obj : ''; $('dobj').hidden = !obj; $('drew').textContent = rew ? 'Récompense : ' + rew : ''; $('drew').hidden = !rew;
    $('dok').textContent = ok; $('dno').hidden = !later; dlgAction = act ? n.id : null; dlgNpc = n.id;
    $('dcraft').hidden = !C.RECIPES.some(r => r.npc === n.id); $('dcraft').textContent = n.id === 'bran' ? 'Forge' : 'Atelier';
    $('dresp').hidden = n.id !== 'elya'; $('dresp').textContent = 'Réinitialiser mes points (' + (me.fr ? 'gratuit' : fmt(me.rcost || 0) + ' PO') + ')';
    dpx.clearRect(0, 0, 32, 36); dpx.drawImage(n.set.front[0], 13, 8, 32, 36, 0, 0, 32, 36);
    dlg.hidden = false;
  }
  function closeDlg() { dlg.hidden = true; }
  let dlgNpc = null, craftNpc = null, craftSig = '', walkSig = '';
  function interact() {
    if (me.dead || mode !== 'play' || travel) return;
    if (nearBridge) {
      if (nearBridge.kind === 'ether' && me.ether < C.ETHER_BRIDGE) { floatAt(me, 'Il faut ' + C.ETHER_BRIDGE + ' Éther', '#bfe6ff'); openWalk(); return; }
      if (netMode === 'online') { sys("Les ponts d'Éther arrivent bientôt dans le monde partagé."); return; }
      link.send({ t: 'cross', b: W.bridges.indexOf(nearBridge) }); return;
    }
    if (nearChest) { link.send({ t: 'chest' }); return; }
    if (nearNpc) return openNpc(nearNpc);
    if (!nearNode) return;
    const R0 = C.RES[nearNode.res];
    if (me.glvl < R0.req) { floatAt(me, 'Cueillette nv' + R0.req + ' requise', '#c8c0d8'); return; }
    if ((nodeCd[nearNode.k] || 0) >= time) { floatAt(me, 'Pas encore repoussé', '#c8c0d8'); return; }
    if (me.ether < 1) { floatAt(me, "Pas assez d'Éther", '#bfe6ff'); openWalk(); return; }
    nodeCd[nearNode.k] = time + 1.5; link.send({ t: 'gather', k: nearNode.k });
  }
  const resLine = () => ['herb', 'wood', 'quartz'].map(k => C.RES[k].plural + ' ' + ((me.inv && me.inv[k]) || 0)).join(' · ');
  function openCraft(id) { craftNpc = id; craftSig = ''; dlg.hidden = true; renderCraft(); $('craft').hidden = false; }
  function renderCraft() {
    if (!craftNpc) return;
    const sig = JSON.stringify([me.inv, me.bag && me.bag.length, me.scarves, me.scarf, me.glvl]); if (sig === craftSig) return; craftSig = sig;
    $('ctitle').textContent = craftNpc === 'bran' ? 'Forge de Bran' : 'Atelier de Mira';
    $('cinv').textContent = 'Inventaire : ' + resLine() + ' · Cueillette nv' + me.glvl;
    $('clist').innerHTML = C.RECIPES.map((r, i) => {
      if (r.npc !== craftNpc) return '';
      const locked = me.glvl < r.req, owned = r.scarf && (me.scarves & (1 << r.scarf));
      const cost = Object.keys(r.cost).map(k => { const have = (me.inv && me.inv[k]) || 0; return `<span class="${have >= r.cost[k] ? 'ok' : 'no'}">${r.cost[k]} ${C.RES[k].plural} (${have})</span>`; }).join(', ');
      const can = !locked && !owned && Object.keys(r.cost).every(k => ((me.inv && me.inv[k]) || 0) >= r.cost[k]);
      let btn;
      if (owned && r.scarf) btn = me.scarf === r.scarf ? '<button type="button" disabled>Portée</button>' : `<button type="button" data-scarf="${r.scarf}">Porter</button>`;
      else if (owned) btn = '<button type="button" disabled>Équipé</button>';
      else btn = `<button type="button" data-r="${i}" ${can ? '' : 'disabled'}>${locked ? 'Nv' + r.req : 'Fabriquer'}</button>`;
      const ic = r.item ? `<img class="ic r${r.item[1]}" src="${iconURL(r.item[0])}" alt="">` : '';
      return `<li>${ic}<div><b${r.item ? ' style="color:' + C.RARITY[r.item[1]][1] + '"' : ''}>${r.name}</b><small>${r.item ? statLine(r.item) : r.desc}</small><small>${locked ? 'Cueillette nv' + r.req + ' requise · ' : ''}${cost}</small></div>${btn}</li>`;
    }).join('');
  }
  $('clist').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled || !link) return; if (b.dataset.r != null) link.send({ t: 'craft', r: +b.dataset.r }); if (b.dataset.scarf != null) link.send({ t: 'scarf', s: +b.dataset.scarf }); });
  $('cclose').addEventListener('click', () => { $('craft').hidden = true; craftNpc = null; });
  $('dcraft').addEventListener('click', () => openCraft(dlgNpc));
  $('dresp').addEventListener('click', () => { if (link) link.send({ t: 'respec' }); closeDlg(); });
  /* ---------- page personnage : équipement, essayage, stats, sac, compétences ---------- */
  const iconCache2 = new Map();
  function iconURL(t) { let u0 = iconCache2.get(t); if (!u0) { const T = C.ITEMS[t]; u0 = ARTAPI.itemIcon(T.icon, T.c).toDataURL(); iconCache2.set(t, u0); } return u0; }
  function statLine(inst) { const st = C.itemStats(inst); return Object.keys(st).map(k => '+' + st[k] + ' ' + C.STAT_NAMES[k]).join(' · '); }
  let charSig = '', sel = null, charTab = 'stats', bagFilter = 'all', sellArm = false, prevDir = 0, prevSet = null; // sel = { from: 'bag', i } | { slot }
  const ARMOR = ['head', 'chest', 'legs', 'feet', 'offhand'];
  function openChar() { if (mode !== 'play') return; charSig = ''; sel = null; sellArm = false; renderChar(); $('char').hidden = false; input.atkBtn = false; joy.active = false; }
  function slotHTML(sl) {
    const it = me.equip && me.equip[sl];
    return it ? `<button type="button" class="slot r${it[1]}${sel && sel.slot === sl ? ' sel' : ''}" data-slot="${sl}" aria-label="${C.ITEMS[it[0]].n}"><img src="${iconURL(it[0])}" alt=""></button><span>${C.SLOT_NAMES[sl]}</span>`
      : `<button type="button" class="slot empty" data-slot="${sl}" aria-label="${C.SLOT_NAMES[sl]} vide"></button><span>${C.SLOT_NAMES[sl]}</span>`;
  }
  // équipement « essayé » : celui du héros avec l'objet sélectionné du sac à la place (ou l'emplacement vidé)
  function trialEquip() {
    if (!sel || !me.equip) return null;
    const e = Object.assign({}, me.equip);
    if (sel.from === 'bag') { const inst = (me.bag || [])[sel.i]; if (!inst) return null; e[C.ITEMS[inst[0]].slot] = inst; return e; }
    if (sel.slot) { e[sel.slot] = null; return e; }
    return null;
  }
  function tipHTML(inst, equipped) {
    const T = C.ITEMS[inst[0]], R0 = C.RARITY[inst[1]], st = C.itemStats(inst), cur = !equipped && me.equip && me.equip[T.slot] ? C.itemStats(me.equip[T.slot]) : null;
    const keys = [...new Set([...Object.keys(st), ...(cur ? Object.keys(cur) : [])])];
    const lines0 = keys.map(k => { const v = st[k] || 0, d = cur ? v - (cur[k] || 0) : 0; return `<li>${v ? '+' + v : '–'} ${C.STAT_NAMES[k]}${cur && d ? ` <em class="${d > 0 ? 'up' : 'down'}">(${d > 0 ? '+' : ''}${d})</em>` : ''}</li>`; }).join('');
    const fam = T.slot === 'weapon' ? C.FAMS[C.FAM_OF[T.icon]] : null, sm = C.mLevel((me.mast || {}).sword || 0).lv;
    const need = T.slot === 'offhand' ? (C.weaponFam(me.equip) !== 'sword' ? '<li class="no">Se porte avec une épée à une main.</li>' : sm < 5 ? '<li class="no">Maîtrise Épée à une main 5 requise (actuelle : ' + sm + ').</li>' : '') : '';
    const tooLow = me.lvl < T.lvl, lines = (fam ? `<li>Arme : ${fam.name} · attaque « ${fam.basic.name} »</li>` : '') + need + lines0 + (T.speed ? `<li>+${Math.round(T.speed * 100)} % vitesse de déplacement</li>` : '') + (T.fx === 'void' ? '<li class="lore">Laisse des empreintes de néant.</li>' : '') + (T.lore ? `<li class="lore">« ${T.lore} »</li>` : '');
    const sellBtn = `<button type="button" data-act="sell" class="sell">${sellArm ? 'Confirmer la vente' : 'Vendre ' + C.itemValue(inst) + ' PO'}</button>`;
    return `<b style="color:${R0[1]}">${T.n}</b><small>${R0[0]} · ${C.SLOT_NAMES[T.slot]} · <span class="${tooLow ? 'no' : ''}">Niveau ${T.lvl}${tooLow ? ' requis' : ''}</span></small><ul>${lines}</ul>${cur ? '<small>Comparé à ton objet équipé · stats ci-dessous avec cet objet</small>' : ''}
      <div class="tipb">${equipped ? `<button type="button" data-act="unequip">Retirer</button>` : `<button type="button" data-act="equip" ${tooLow ? 'disabled' : ''}>Équiper</button>${sellBtn}`}</div>`;
  }
  function statRows(rows) { return rows.map(([k, v, d, unit]) => `<div><span>${k}</span><b>${v == null ? '–' : v + (unit || '')}${d ? `<em class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}${unit || ''}</em>` : ''}</b></div>`).join(''); }
  function renderChar() {
    const sig = JSON.stringify([me.equip, me.bag, me.lvl, me.xp, me.gold, sel, charTab, bagFilter, sellArm, me.mast, me.pts, me.bar, me.free, me.fr]); if (sig === charSig) return; charSig = sig;
    const K0 = CL(), bag = me.bag || [];
    $('chtitle').textContent = me.name; $('chsub').textContent = 'Niveau ' + me.lvl + ' · ' + K0.name + ' (maîtrise ' + K0.ml + ') · ' + fmt(me.gold || 0) + ' PO';
    const xpf = me.need ? Math.min(1, (me.xp || 0) / me.need) : 0; $('chxp').style.width = (xpf * 100).toFixed(1) + '%'; $('chxpt').textContent = 'XP ' + fmt(me.xp || 0) + ' / ' + fmt(me.need || 0);
    $('slotsL').innerHTML = ['head', 'chest', 'legs', 'feet'].map(slotHTML).join('');
    $('slotsR').innerHTML = ['weapon', 'offhand', 'trinket'].map(slotHTML).join('');
    // stats actuelles, et différence si un objet est essayé
    const now = C.computeStats(me.lvl, me.equip, me.pts), te = trialEquip(), tr = te ? C.computeStats(me.lvl, te, me.pts) : null;
    const dv = (a, b) => tr ? Math.round(b) - Math.round(a) : 0, S2 = now.stats, T2 = tr ? tr.stats : S2;
    $('chattr').innerHTML = statRows([['Force', S2.str, dv(S2.str, T2.str)], ['Endurance', S2.sta, dv(S2.sta, T2.sta)], ['Intelligence', S2.int, dv(S2.int, T2.int)], ['Agilité', S2.agi, dv(S2.agi, T2.agi)], ['Armure', S2.armor, dv(S2.armor, T2.armor)]]);
    const P = (x) => Math.round(x * 100);
    $('chstats').innerHTML = statRows([['Attaque', Math.round(now.atk), tr ? dv(now.atk, tr.atk) : 0], ['Points de vie', now.maxhp, tr ? dv(now.maxhp, tr.maxhp) : 0], ['Points de mana', now.maxmp, tr ? dv(now.maxmp, tr.maxmp) : 0], ['Critique', P(now.crit), tr ? P(tr.crit) - P(now.crit) : 0, ' %'], ['Réduction', P(now.red), tr ? P(tr.red) - P(now.red) : 0, ' %'], ['Vitesse', P(now.speed), tr ? P(tr.speed) - P(now.speed) : 0, ' %']]);
    // points de caractéristiques (3 par niveau) ; réinitialisation chez Elya
    const free = me.free | 0, PN = { str: 'Force', sta: 'Endurance', int: 'Intelligence', agi: 'Agilité' };
    $('chpts').innerHTML = (free > 0 ? `<p class="ptsn">${free} point${free > 1 ? 's' : ''} à répartir</p><div class="ptsb">${Object.keys(PN).map(k => `<button type="button" data-pt="${k}">+ ${PN[k]}</button>`).join('')}</div>` : '')
      + `<p class="muted small">Chaque niveau donne 3 points. Elya, à la fontaine, les réinitialise (${me.fr ? 'gratuit la première fois' : fmt(me.rcost || 0) + ' PO'}).</p>`;
    // compétences : celles de l'arme en main, débloquées par sa maîtrise ; 3 cases dans la barre
    const M0 = C.mLevel(((me.mast || {})[K0.fam]) || 0), inBar = K0.ab.map(a => a.locked ? -1 : a.ti), ico = n => (ART.icons['a_' + n] || ART.icons.a_slash).toDataURL();
    const mbar = K0.fam === 'none' ? '<p class="muted">Équipe une arme pour débloquer des techniques.</p>' : `<div class="mast"><b>${K0.name} · maîtrise ${M0.lv}${M0.lv >= C.MAST_MAX ? ' (max)' : ''}</b><div class="xp"><i style="width:${M0.need ? (M0.cur / M0.need * 100).toFixed(1) : 100}%"></i><span>${M0.need ? M0.cur + ' / ' + M0.need : 'Maîtrise complète'}</span></div><small>Elle monte en te battant avec cette arme.</small></div>`;
    const techs = K0.F.tech.map((A, i) => { const lock = A.m > K0.ml, slot = inBar.indexOf(i);
      return `<li class="${lock ? 'lock' : ''}"><img src="${ico(A.icon)}" alt=""><div><b>${A.name}${slot >= 0 ? ' <span class="inbar">case ' + (slot + 1) + '</span>' : ''}</b><small>${lock ? 'Maîtrise ' + A.m + ' · ' : ''}${A.mp} PM · recharge ${A.cd} s · ${A.desc}</small>${lock ? '' : `<span class="barb">${[0, 1, 2].map(s0 => `<button type="button" data-bs="${s0}" data-bk="${i}" class="${slot === s0 ? 'on' : ''}" aria-label="Mettre en case ${s0 + 1}">${s0 + 1}</button>`).join('')}</span>`}</div></li>`; }).join('');
    const caps = (K0.F.caps || []).map(A => `<li class="${A.m > K0.ml ? 'lock' : ''}"><img src="${ico(A.m === 5 ? 'charge' : 'shout')}" alt=""><div><b>${A.name}</b><small>${A.m > K0.ml ? 'Maîtrise ' + A.m + ' · ' : ''}${A.desc}</small></div></li>`).join('');
    const others0 = Object.keys(C.FAMS).filter(f => f !== 'none' && f !== K0.fam && (me.mast || {})[f]).map(f => C.FAMS[f].name + ' ' + C.mLevel(me.mast[f]).lv).join(' · ');
    $('abil').innerHTML = mbar + `<ul class="abil"><li><img src="${ico(K0.basic.icon)}" alt=""><div><b>${K0.basic.name}</b><small>Attaque de base · recharge ${K0.basic.cd} s · portée ${K0.basic.range}</small></div></li>${techs}${caps}</ul>` + (others0 ? `<p class="muted small">Autres maîtrises : ${others0}</p>` : '');
    $('bagn').textContent = bag.length + '/' + C.BAG_SIZE;
    const pass = it => { const sl = C.ITEMS[it[0]].slot; return bagFilter === 'all' || (bagFilter === 'armor' ? ARMOR.includes(sl) : sl === bagFilter); };
    let cells = ''; for (let i = 0; i < C.BAG_SIZE; i++) { const it = bag[i]; cells += it ? `<button type="button" class="slot r${it[1]}${sel && sel.from === 'bag' && sel.i === i ? ' sel' : ''}${pass(it) ? '' : ' dim'}${me.lvl < C.ITEMS[it[0]].lvl ? ' low' : ''}" data-bag="${i}" aria-label="${C.ITEMS[it[0]].n}"><img src="${iconURL(it[0])}" alt=""></button>` : '<span class="slot empty"></span>'; }
    $('bag').innerHTML = cells;
    for (const b of $('bagf').children) b.classList.toggle('on', b.dataset.f === bagFilter);
    for (const b of document.querySelectorAll('#char .tabs button')) { const on = b.dataset.tab === charTab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); $('tab-' + b.dataset.tab).hidden = !on; }
    let inst = null, equipped = false;
    if (sel && sel.from === 'bag') inst = bag[sel.i]; else if (sel && sel.slot) { inst = me.equip && me.equip[sel.slot]; equipped = true; }
    $('tip').hidden = !inst; if (inst) $('tip').innerHTML = tipHTML(inst, equipped);
    // aperçu : le héros porte l'objet essayé
    prevSet = te && sel.from === 'bag' ? ARTAPI.charSet(look, C.gearStr(te)) : null;
    $('trying').textContent = prevSet ? 'Essayage' : '';
  }
  $('char').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'chclose') { $('char').hidden = true; sel = null; prevSet = null; return; }
    if (b.id === 'rotl' || b.id === 'rotr') { prevDir = (prevDir + (b.id === 'rotr' ? 1 : 3)) % 4; return; }
    if (b.dataset.tab) { charTab = b.dataset.tab; renderChar(); return; }
    if (b.dataset.pt && link) { link.send({ t: 'pt', s: b.dataset.pt }); return; }
    if (b.dataset.bs != null && link) { link.send({ t: 'bar', s: +b.dataset.bs, k: +b.dataset.bk }); return; }
    if (b.dataset.f) { bagFilter = b.dataset.f; renderChar(); return; }
    if (b.dataset.bag != null) { const i = +b.dataset.bag; sel = sel && sel.from === 'bag' && sel.i === i ? null : { from: 'bag', i }; sellArm = false; renderChar(); return; }
    if (b.dataset.slot != null) { const sl = b.dataset.slot; sel = me.equip && me.equip[sl] && !(sel && sel.slot === sl) ? { slot: sl } : null; sellArm = false; if (!sel && !(me.equip && me.equip[sl])) { charTab = 'bag'; bagFilter = sl === 'weapon' ? 'weapon' : sl === 'trinket' ? 'trinket' : 'armor'; } renderChar(); return; }
    if (b.dataset.act && link && sel) {
      if (b.dataset.act === 'sell') { const inst = (me.bag || [])[sel.i]; if (inst && inst[1] >= 2 && !sellArm) { sellArm = true; renderChar(); return; } link.send({ t: 'sell', b: sel.i }); }
      if (b.dataset.act === 'equip') link.send({ t: 'equip', b: sel.i });
      if (b.dataset.act === 'unequip') link.send({ t: 'unequip', s: sel.slot });
      sel = null; sellArm = false; prevSet = null; charSig = '';
    }
  });
  const chp = $('chprev').getContext('2d'); chp.imageSmoothingEnabled = false;
  function drawCharPreview() {
    if ($('char').hidden || !me.set) return;
    const set = (prevSet || me.set).hd, d = ['front', 'side', 'back', 'sideL'][prevDir], fr = Math.floor(time * 5) % 4;
    const img = d === 'sideL' ? set.sideL[fr] : d === 'side' ? set.side[fr] : set[d][Math.floor(time * 2) % 4 === 0 && d === 'front' ? 0 : fr];
    chp.clearRect(0, 0, 64, 68); chp.fillStyle = 'rgba(10,12,40,.35)'; chp.fillRect(20, 62, 24, 4); chp.drawImage(img, 3, 9);
  }
  const STEPS = window.EtheriaSteps || { native: false, collect: async () => 0 };
  function openWalk() { walkSig = ''; renderWalk(); $('walk').hidden = false; input.atkBtn = false; joy.active = false; }
  function renderWalk() {
    const sig = JSON.stringify([me.stepsToday, me.ether, me.glvl, me.gxp, me.inv, me.scarves, me.scarf]); if (sig === walkSig) return; walkSig = sig;
    const st = me.stepsToday || 0;
    $('wsteps').textContent = fmt(st) + ' / ' + fmt(C.DAILY_STEP_CAP) + ' pas'; $('wbar').style.width = Math.min(100, st / C.DAILY_STEP_CAP * 100) + '%';
    $('wether').textContent = (me.ether || 0) + ' Éther';
    $('wglvl').textContent = 'Cueillette niveau ' + (me.glvl || 1); $('wgbar').style.width = Math.min(100, (me.gxp || 0) / (me.gneed || 1) * 100) + '%';
    $('winv').textContent = resLine();
    $('wsync').textContent = STEPS.native ? 'Synchroniser mes pas' : 'Simuler une balade (+1 000 pas)';
    $('wnote').textContent = STEPS.native ? 'Tes pas sont lus par le capteur de mouvement de ton iPhone.' : "Mode test : dans le navigateur, le jeu n'a pas accès à tes pas. Sur l'app iPhone, ce sont tes vrais pas qui comptent.";
    $('wscarves').innerHTML = C.SCARVES.map((c, i) => (me.scarves & (1 << i)) ? `<button type="button" data-s="${i}" class="sw${me.scarf === i ? ' on' : ''}" style="background:${c[0]}" aria-label="Écharpe ${c[3]}"></button>` : '').join('');
  }
  $('wscarves').addEventListener('click', e => { const b = e.target.closest('button'); if (b && link) link.send({ t: 'scarf', s: +b.dataset.s }); });
  $('wsync').addEventListener('click', async () => { if (!link) return; if (STEPS.native) await syncSteps(true); else link.send({ t: 'steps', n: 1000 }); });
  $('wclose').addEventListener('click', () => { $('walk').hidden = true; });
  let syncing = false;
  async function syncSteps(manual) {
    if (!link || !STEPS.native || syncing) return; syncing = true;
    try { const n = await STEPS.collect(); if (n > 0) link.send({ t: 'steps', n }); else if (manual) sys('Aucun nouveau pas depuis la dernière synchronisation.'); }
    catch (e) { if (manual) sys('Impossible de lire tes pas (autorisation Mouvement & forme ?).'); }
    syncing = false;
  }
  setInterval(() => { if (mode === 'play') syncSteps(false); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && mode === 'play') syncSteps(false); });
  $('dok').addEventListener('click', () => { if (dlgAction && link) link.send({ t: 'talk', npc: dlgAction }); closeDlg(); });
  $('dno').addEventListener('click', closeDlg);
  // tchat
  const chatbox = $('chatbox'), chatin = $('chatin');
  function openChat() { chatbox.hidden = false; chatin.value = ''; setTimeout(() => chatin.focus(), 30); }
  const ignored = new Set((() => { try { return JSON.parse(localStorage.getItem('etheria_ignore') || '[]'); } catch (e) { return []; } })());
  function sendChat() {
    const t = chatin.value.trim(); chatbox.hidden = true; chatin.blur(); if (!t) return;
    const m = t.match(/^\/(ignorer|ignore|retablir)\s+(.+)$/i);
    if (m) { const n = m[2].trim().toLowerCase(); if (/^r/i.test(m[1])) { ignored.delete(n); sys('Tu vois de nouveau les messages de ' + m[2] + '.'); } else { ignored.add(n); sys(m[2] + ' est ignoré. /retablir ' + m[2] + ' pour annuler.'); } try { localStorage.setItem('etheria_ignore', JSON.stringify([...ignored])); } catch (e) { /* ignore */ } return; }
    if (link) link.send({ t: 'chat', text: t });
  }
  chatin.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } if (e.key === 'Escape') { chatbox.hidden = true; chatin.blur(); } });
  $('chatsend').addEventListener('click', sendChat);
  $('chatclose').addEventListener('click', () => { chatbox.hidden = true; });

  /* ---------- réseau ---------- */
  class LocalLink {
    constructor(onmsg) { this.onmsg = onmsg; this.sim = new C.Sim(W); }
    connect(hello) {
      let save = null; try { save = JSON.parse(localStorage.getItem('etheria_solo') || 'null'); } catch (e) { /* ignore */ } if (!save) save = restoredSolo; if (!save && SEED && SEED.solo) save = SEED.solo;
      this.sim = new C.Sim(W, { lvl: save && save.lvl });
      this.sim.mobs.forEach((sm, k) => { if (mobs[k]) { mobs[k].lvl = sm.lvl; mobs[k].maxhp = sm.maxhp; mobs[k].hp = sm.hp; } });
      const p = this.sim.addPlayer('me', hello.name, hello.look, save, hello.cls);
      this.sim.events.length = 0;
      if (Cloud.owner || (window.ETHERIA_CONFIG && window.ETHERIA_CONFIG.founder)) this.sim.grantFounder(p);
      // maître du jeu : le propriétaire de la page de test, ou le héros Archi404 dans l'app quand config.gm est activé
      if (Cloud.owner || (window.ETHERIA_CONFIG && window.ETHERIA_CONFIG.gm && p.name === 'Archi404')) this.sim.grantGM(p);
      setTimeout(() => this.onmsg({ t: 'welcome', id: 'me', x: p.x, y: p.y }), 0);
      this.iv = setInterval(() => { this.sim.step(0.1); const ev = this.sim.events.splice(0); this.onmsg(Object.assign({ t: 's', me: this.sim.meState('me'), ev, n: 1 }, this.sim.publicState())); }, 100);
      return Promise.resolve();
    }
    send(m) { this.sim.handle('me', m); }
    saveNow() { const p = this.sim.players.get('me'); if (!p) return; const sd = this.sim.saveData(p); try { localStorage.setItem('etheria_solo', JSON.stringify(sd)); localStorage.setItem('etheria_saved_at', String(Date.now())); } catch (e) { /* ignore */ } Cloud.save(sd); }
  }
  class WsLink {
    constructor(url, onmsg) { this.url = url; this.onmsg = onmsg; this.ws = null; }
    connect(hello) {
      return new Promise((res, rej) => {
        let ok = false; const ws = new WebSocket(this.url); this.ws = ws;
        const to = setTimeout(() => { if (!ok) { try { ws.close(); } catch (e) { /* ignore */ } rej(new Error('timeout')); } }, 5000);
        ws.onopen = () => ws.send(JSON.stringify(Object.assign({ t: 'hello', v: C.VERSION }, hello)));
        ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (m.t === 'welcome' && !ok) { ok = true; clearTimeout(to); res(); } this.onmsg(m); };
        ws.onclose = () => { clearTimeout(to); if (!ok) rej(new Error('closed')); else this.onmsg({ t: 'closed' }); };
        ws.onerror = () => { };
      });
    }
    send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
    saveNow() { }
  }
  function serverUrl() {
    const cfg = (window.ETHERIA_CONFIG && window.ETHERIA_CONFIG.server) || null;
    const q = new URLSearchParams(location.search).get('server'); if (q) return q;
    if (cfg === 'auto') return /^https?:$/.test(location.protocol) ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws' : null;
    return cfg;
  }
  function token() { let t = null; try { t = localStorage.getItem('etheria_token'); if (!t) { t = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('etheria_token', t); } } catch (e) { t = 'anon' + Math.random(); } return t; }

  function onMsg(m) {
    if (m.t === 'welcome') {
      myId = m.id; me.x = m.x; me.y = m.y; me.z = W.hAt(me.x, me.y); mode = 'play'; $('menu').hidden = true;
      me.gear = C.gearStr(me.equip); me.set = ARTAPI.charSet(look, me.gear);
      sys(netMode === 'online' ? 'Connecté au monde partagé.' : 'Mode solo : aucun serveur configuré.');
      setTimeout(() => say(usedTouch ? 'Astuce : glisse à gauche pour bouger, maintiens l\'épée pour attaquer.' : 'Astuce : ZQSD pour bouger, ESPACE attaque, E tourbillon, R potion, F parler, ENTRÉE tchat.', '#9fe0ff'), 1200);
      if (me.q === 0 && me.qs === 0) setTimeout(() => say('Elya t\'attend près de la fontaine (marqueur !).', '#ffe27a'), 2600);
      setTimeout(() => say("Les plantes lumineuses se récoltent avec de l'Éther. Marche dans la vraie vie pour en gagner (touche l'icône bleue).", '#bfe6ff'), 5200);
      setTimeout(() => syncSteps(false), 1500);
      return;
    }
    if (m.t === 'closed') { sys('Connexion perdue. Recharge la page pour revenir.'); return; }
    if (m.t === 'err') { sys(m.msg || 'Erreur serveur'); return; }
    if (m.t !== 's') return;
    online = m.n || 1;
    const seen = new Set();
    for (const a of m.p) {
      const [id, name, lk, x, y, f, fl, mv, hp, mh, lv, dead, sc, cl, vd, gr] = a; if (id === myId) continue; seen.add(id);
      let o = others.get(id);
      if (!o) { o = { id, x, y, z: W.hAt(x, y), anim: 0, hitFlash: 0, slash: 0, slashAng: 0, spin: 0 }; others.set(id, o); }
      o.name = name; if (o.lk !== lk || o.gr !== gr) { o.lk = lk; o.gr = gr; o.set = ARTAPI.charSet(lk.split('').map(Number), gr || ''); }
      o.tx = x; o.ty = y; o.face = FACES[f] || 'front'; o.flip = !!fl; o.moving = !!mv; o.hp = hp; o.maxhp = mh; o.lvl = lv; o.dead = !!dead; o.scarf = sc | 0; o.cls = cl | 0; o.voidFx = !!vd;
    }
    for (const id of [...others.keys()]) if (!seen.has(id)) others.delete(id);
    m.m.forEach((a, k) => { const mb = mobs[k]; if (!mb) return; const [x, y, hp, al, ag, mv, st] = a; mb.status = st | 0; if (!mb.alive && al) { mb.x = x; mb.y = y; } mb.tx = x; mb.ty = y; mb.hp = hp; mb.alive = !!al; mb.aggro = !!ag; mb.moving = !!mv; });
    if (m.me) { const wasDead = me.dead; Object.assign(me, m.me); { const gs = C.gearStr(me.equip); if (gs !== me.gear) { me.gear = gs; me.set = ARTAPI.charSet(look, gs); } } if (!$('craft').hidden) renderCraft(); if (!$('walk').hidden) renderWalk(); if (!$('char').hidden) renderChar(); if (me.lvl !== prefs.lvl) { prefs.lvl = me.lvl; try { localStorage.setItem('etheria_prefs', JSON.stringify({ name: me.name, look, lvl: me.lvl })); } catch (e) { /* ignore */ } } if (!wasDead && me.dead) { joy.active = false; } }
    if (m.c != null) chestOpen = !!m.c;
    for (const ev of m.ev || []) handleEvent(ev);
  }
  const ent = id => id === myId ? me : others.get(id);
  function handleEvent(ev) {
    switch (ev.e) {
      case 'hm': { const mb = mobs[ev.m]; if (!mb) break; mb.hitFlash = 0.15; const mine = ev.by === myId; floatAt(mb, ev.v, ev.burn ? '#ff9a3c' : mine ? (ev.c ? '#ffd23f' : '#ffffff') : '#b8c4e0', ev.c && mine); burst(mb, ART.slimeLight[mb.type], ev.c ? 9 : 4); break; }
      case 'km': { const mb = mobs[ev.m]; if (!mb) break; burst(mb, ART.slimeLight[mb.type], 18, 20); burst(mb, '#ffffff', 6, 30); mb.alive = false; break; }
      case 'lt': if (ev.id === myId) { const mb = mobs[ev.m]; setTimeout(() => floatAt(mb, '+' + ev.xp + ' XP', '#8cf07a'), 150); setTimeout(() => floatAt(mb, '+' + ev.g + ' PO', '#ffd23f'), 450); if (ev.pot) setTimeout(() => floatAt(mb, '+1 potion', '#ff8ac0'), 750); if (ev.grp) setTimeout(() => floatAt(mb, 'Bonus groupe', '#9fe0ff'), 1000); } break;
      case 'hp': { const t = ent(ev.id), mb = mobs[ev.m]; if (mb) mb.lunge = 0.15; if (!t) break; t.hitFlash = 0.25; if (t === me) { floatAt(me, '-' + ev.v, '#ff5a5a'); shake = 0.15; } if (ev.b) { floatAt(t, 'Bloqué !', '#bfe6ff'); ring(t, 1.2, '#bfe6ff', 0.25); } break; }
      case 'lv': { const t = ent(ev.id); if (!t) break; ring(t, 2.5, '#ffe27a', 0.6); burst(t, '#ffe27a', 24, 60); floatAt(t, 'Niveau ' + ev.lv + ' !', '#ffe27a', true); if (t === me) { sys('Niveau ' + ev.lv + ' atteint ! +3 points de caractéristiques à répartir (page personnage).'); } else say(t.name + ' passe niveau ' + ev.lv + ' !', '#9fe0ff'); break; }
      case 'die': if (ev.id === myId) sys('Vous êtes mort... -' + ev.loss + ' XP'); break;
      case 'rs': { const t = ent(ev.id); if (t) ring(t, 1.8, '#8fd4ff', 0.5); if (ev.id === myId) sys('Retour au Bourg d\'Argel.'); break; }
      case 'tp': if (ev.dash) { const t = ent(ev.id); if (t) burst(t, '#ffd060', 10, 10); } if (ev.id === myId) { me.x = ev.x; me.y = ev.y; me.z = W.hAt(me.x, me.y); } else { const o = others.get(ev.id); if (o) { o.x = o.tx = ev.x; o.y = o.ty = ev.y; } } break;
      case 'ch': if (ev.s) sys(ev.t); else if (!ignored.has(String(ev.n).toLowerCase())) say(ev.n + ': ' + ev.t, ev.id === myId ? '#b8f0a0' : '#ece6f4'); break;
      case 'ab': { const t = ent(ev.id); if (t) abilityFx(t, ev, mobs[ev.m]); break; }
      case 'ml': if (ev.id === myId) {
        const F = C.FAMS[ev.f]; if (!F) break; sys('Maîtrise ' + F.name + ' ' + ev.lv + ' !'); floatAt(me, 'Maîtrise ' + ev.lv, '#9fe0ff', true); ring(me, 2, '#9fe0ff', 0.5);
        for (const A of F.tech) if (A.m === ev.lv) setTimeout(() => { sys('Nouvelle technique : ' + A.name + ' — ' + A.desc); floatAt(me, A.name, '#ffe27a', true); }, 600);
        for (const A of F.caps || []) if (A.m === ev.lv) setTimeout(() => { sys('Nouvelle capacité : ' + A.name + ' — ' + A.desc); }, 900);
      } break;
      case 'heal': { const t = ent(ev.id); if (t) { burst(t, '#9cf07a', 14, 30); if (t === me) floatAt(me, '+' + ev.v + (ev.by && ev.by !== myId ? ' (soin)' : ''), '#9cf07a'); } break; }
      case 'gm': if (ev.id === myId) { sys(ev.mage ? 'Te voilà mage : le Sceptre du Maître du jeu tire à distance. Maîtrise Bâton ' + ev.mage + ', points passés en Intelligence (réinitialisables chez Elya).' : 'Ton armure de Maître du jeu est équipée. Elle est unique.'); floatAt(me, 'Maître du jeu', '#ffe070', true); ring(me, 3, '#ffe070', 0.9); burst(me, '#ffe070', 40, 60); burst(me, '#ffffff', 16, 50); } break;
      case 'travel': if (ev.id === myId && !travel) {
        const I = C.ISLES[ev.to.k] || C.ISLES.bourg; travel = { t: time, name: I.name, col: ev.via === 'ether' ? [120, 80, 200] : [230, 170, 70] };
        joy.active = false; input.atkBtn = false;
        try { sessionStorage.setItem('etheria_autoplay', '1'); sessionStorage.setItem('etheria_arrive', JSON.stringify({ name: I.name, desc: I.desc || '', fresh: ev.fresh, col: travel.col })); } catch (e) { /* ignore */ }
        setTimeout(() => { if (link) link.saveNow(); setTimeout(() => location.reload(), 150); }, 1300);
      } break;
      case 'chest': if (ev.id === myId) { chestOpen = true; sys('Coffre de brume : +' + ev.g + ' PO et deux objets !'); floatAt(me, 'Trésor !', '#ffe27a', true); burst(me, '#ffe27a', 30, 50); } break;
      case 'founder': if (ev.id === myId) { sys('Cadeau du fondateur : les Bottes du Néant (Unique) et un ensemble épique sont équipés !'); floatAt(me, 'Bottes du Néant', '#ff9a3c', true); ring(me, 2.6, '#ff9a3c', 0.8); burst(me, '#b08ae8', 30, 50); } break;
      case 'sw': if (ev.id !== myId) { const o = others.get(ev.id), mb = mobs[ev.m]; if (o && mb) { basicFx(o, mb, ev.fx); setFacing(o, mb.x - o.x, mb.y - o.y); } } break;
      case 'sk': if (ev.id !== myId) { const o = others.get(ev.id); if (o) { o.spin = 0.35; ring(o, 2.4, '#ffe27a', 0.35); } } break;
      case 'po': { const t = ent(ev.id); if (t) { burst(t, '#8cf07a', 12, 20); if (t === me) floatAt(me, '+' + ev.v, '#8cf07a'); } break; }
      case 'ga': if (ev.id === myId) { nodeCd[ev.k] = time + C.NODE_CD; const n = W.nodes[ev.k], pos = { x: n.x, y: n.y, z: W.hAt(n.x, n.y) }; floatAt(pos, '+' + ev.n + ' ' + C.RES[ev.res].name, '#bfe6ff'); burst(pos, ev.res === 'herb' ? '#bfe6ff' : ev.res === 'wood' ? '#ffd060' : '#ffb0d4', 12, 20); setTimeout(() => floatAt(me, '+' + ev.g + ' cueillette', '#c8c0d8'), 400); } break;
      case 'gl': if (ev.id === myId) { sys('Cueillette niveau ' + ev.lv + ' !'); floatAt(me, 'Cueillette nv' + ev.lv, '#bfe6ff', true); ring(me, 2, '#bfe6ff', 0.6);
        for (const k in C.RES) if (C.RES[k].req === ev.lv) sys('Tu peux maintenant récolter : ' + C.RES[k].name + '.');
        for (const r of C.RECIPES) if (r.req === ev.lv) sys('Nouvelle recette chez ' + C.NPCS[r.npc].name + ' : ' + r.name + '.'); } break;
      case 'st': if (ev.id === myId) { if (ev.n > 0) { sys('Marche : +' + fmt(ev.n) + ' pas → +' + ev.v + ' Éther'); if (ev.v > 0) floatAt(me, '+' + ev.v + ' Éther', '#bfe6ff', true); } if (ev.capped) sys('Plafond de ' + fmt(C.DAILY_STEP_CAP) + ' pas atteint pour aujourd\'hui.'); } break;
      case 'gift': if (ev.id === myId) sys('Cadeau du jour : +' + ev.v + ' Éther.'); break;
      case 'it': if (ev.id === myId) { const T = C.ITEMS[ev.t], R0 = C.RARITY[ev.r]; say((ev.sold ? 'Sac plein, vendu : ' : 'Butin : ') + T.n + ' (' + R0[0] + ')' + (ev.sold ? ' +' + ev.sold + ' PO' : ''), R0[1]); const pos = ev.m >= 0 ? mobs[ev.m] : me; setTimeout(() => floatAt(pos, T.n, R0[1], ev.r >= 2), ev.m >= 0 ? 900 : 300); if (ev.r >= 2) setTimeout(() => ring(pos, 1.6, R0[1], 0.6), 900); } break;
      case 'eq': if (ev.id === myId) { const T = C.ITEMS[ev.t]; sys('Équipé : ' + T.n); burst(me, C.RARITY[ev.r][1], 10, 20); } break;
      case 'sold': if (ev.id === myId) sys('Vendu : ' + C.ITEMS[ev.t].n + ' (+' + ev.v + ' PO)'); break;
      case 'msg': if (ev.id === myId) sys(ev.t); break;
      case 'cr': if (ev.id === myId) { const r = C.RECIPES[ev.r]; sys('Fabriqué : ' + r.name + ' (' + r.desc + ')'); floatAt(me, r.name, '#ffe27a', true); burst(me, '#ffe27a', 16, 40); } break;
      case 'qa': if (ev.id === myId) { const Q = C.QUESTS[ev.q]; sys('Nouvelle quête : ' + Q.title); floatAt(me, 'Nouvelle quête', '#ffe27a', true); } break;
      case 'qp': if (ev.id === myId) { const Q = C.QUESTS[ev.q], mb = mobs[ev.m] || me; setTimeout(() => floatAt(mb, ev.item ? '+1 ' + Q.item : Q.short + ' ' + ev.n + '/' + Q.n, '#ffe9b0'), ev.item ? 1250 : 1100); } break;
      case 'qc': if (ev.id === myId) { const Q = C.QUESTS[ev.q]; setTimeout(() => { floatAt(me, 'Objectif accompli !', '#9cf07a', true); ring(me, 2, '#9cf07a', 0.5); }, 1400); sys('Objectif accompli ! Retourne voir ' + C.NPCS[Q.giver].name + '.'); } break;
      case 'qr': if (ev.id === myId) { const Q = C.QUESTS[ev.q]; sys('Quête terminée : ' + Q.title + ' (+' + ev.xp + ' XP, +' + ev.g + ' PO' + (ev.pot ? ', +' + ev.pot + ' potions' : '') + ')'); floatAt(me, 'Quête terminée !', '#ffe27a', true); burst(me, '#ffe27a', 20, 50); ring(me, 2.4, '#ffe27a', 0.6); } break;
      case 'mr': { const mb = mobs[ev.m]; if (mb) { mb.x = mb.tx; mb.y = mb.ty; ring(mb, 1, ART.slimeLight[mb.type], 0.4); } break; }
    }
  }

  /* ---------- mise à jour ---------- */
  function nearestMob(x, y, r) { let best = null, bd = r; for (const m of mobs) { if (!m.alive) continue; const d = Math.hypot(m.x - x, m.y - y); if (d < bd) { bd = d; best = m; } } return best; }
  function updateMe(dt) {
    me.atkCd -= dt; me.skillCd -= dt; me.potCd -= dt; me.slash -= dt; me.atkT -= dt; me.spin -= dt; me.hitFlash -= dt; me.moving = false;
    if (me.dead) { input.skill = input.pot = false; me.anim = 0; return; }
    const [sx, sy] = inputDir();
    if (sx || sy) { let wx = (sx / 16 + sy / 8) / 2, wy = (sy / 8 - sx / 16) / 2; const l = Math.hypot(wx, wy); wx /= l; wy /= l; C.moveBy(W, me, wx * 3 * (me.speed || 1) * dt, wy * 3 * (me.speed || 1) * dt); setFacing(me, wx, wy); me.moving = true; movedOnce = true; }
    const tgt = nearestMob(me.x, me.y, 6); me.target = tgt;
    const atk = input.atkBtn || input.atkKey, K0 = CL(), B = K0.basic;
    if (atk && tgt) {
      const d = Math.hypot(tgt.x - me.x, tgt.y - me.y), reach = B.range + (tgt.type === 'boss' ? 0.6 : 0);
      if (d <= reach) { if (me.atkCd <= 0) { me.atkCd = B.cd; setFacing(me, tgt.x - me.x, tgt.y - me.y); basicFx(me, tgt, B.fx); link.send({ t: 'atk', m: tgt.k }); } }
      else if (!me.moving) { const dx = tgt.x - me.x, dy = tgt.y - me.y, sp = 3 * (me.speed || 1); C.moveBy(W, me, dx / d * sp * dt, dy / d * sp * dt); setFacing(me, dx, dy); me.moving = true; }
    } else if (atk && me.atkCd <= 0 && B.fx === 'slash') { me.atkCd = B.cd; me.slash = 0.18; me.atkT = ATK_T; me.slashAng = me.face === 'side' ? (me.flip ? Math.PI : 0) : me.face === 'front' ? Math.PI / 2 : -Math.PI / 2; }
    if (input.ab >= 0) {
      const i = input.ab, A = K0.ab[i]; input.ab = -1;
      if (A.locked) floatAt(me, A.m < 99 ? A.name + ' : maîtrise ' + A.m : 'Pas de technique', '#c8c0d8');
      else if (localAbCd[i] > time || (me.abCd && me.abCd[i] > 0.2)) { /* en recharge */ }
      else if (me.mp < A.mp) floatAt(me, 'Mana insuffisant', '#7fb2ff');
      else {
        let t2 = null;
        if (A.kind === 'aoeTarget' || A.kind === 'single' || A.kind === 'charge') { t2 = nearestMob(me.x, me.y, A.range + 0.4); if (!t2) { floatAt(me, 'Aucune cible', '#c8c0d8'); t2 = false; } }
        if (t2 !== false) { localAbCd[i] = time + A.cd; if (t2) setFacing(me, t2.x - me.x, t2.y - me.y); link.send({ t: 'ab', a: i, m: t2 ? t2.k : -1 }); }
      }
    }
    if (input.pot) { input.pot = false; if (me.potCd <= 0) { if (me.potions <= 0) floatAt(me, 'Plus de potion', '#ff8ac0'); else if (me.hp >= me.maxhp) floatAt(me, 'Vie pleine', '#8cf07a'); else { me.potCd = 0.9; link.send({ t: 'pot' }); } } }
    me.anim = me.moving ? me.anim + dt * 8 : 0; me.z += (W.hAt(me.x, me.y) - me.z) * Math.min(1, dt * 15);
    sendT -= dt;
    const st = me.x.toFixed(2) + me.y.toFixed(2) + me.face + me.flip + me.moving;
    if (sendT <= 0 && st !== me.sent) { sendT = 0.1; me.sent = st; link.send({ t: 'mv', x: +me.x.toFixed(2), y: +me.y.toFixed(2), f: FACES.indexOf(me.face), fl: me.flip ? 1 : 0, mv: me.moving ? 1 : 0 }); }
    nearBridge = null; for (const br of W.bridges || []) if (Math.hypot(br.ex - me.x, br.ey - me.y) < 1.3) nearBridge = br;
    nearChest = !!(W.chest && !chestOpen && Math.hypot(W.chest.x - me.x, W.chest.y - me.y) < 1.4);
    nearNode = null; { let bd = 1.3; for (const n of NODES) { const d = Math.hypot(n.x - me.x, n.y - me.y); if (d < bd) { bd = d; nearNode = n; } } }
    nearNpc = null; let nd = 2.2;
    for (const n of NPCS) { const d = Math.hypot(n.x - me.x, n.y - me.y); if (d < 3.5) setFacing(n, me.x - n.x, me.y - n.y); else n.face = 'front'; if (d < nd) { nd = d; nearNpc = n; } }
    const z = W.zoneOf(me.x, me.y); if (z !== zone) { zone = z; zoneT = 2.8; const zi = zoneIndex(); if (zi !== gradeTo) { gradeFrom = gradeTo; gradeTo = zi; gradeK = 0; } }
  }
  function update(dt) {
    time += dt; shake -= dt; if (gradeK < 1) gradeK = Math.min(1, gradeK + dt / 1.6);
    if (mode === 'play') {
      updateMe(dt); zoneT -= dt;
      saveT -= dt; if (saveT <= 0) { saveT = 5; link.saveNow(); }
    }
    for (const e of [me, ...others.values()]) {
      const [wx, wy] = ePx(e); if (e.lwx == null) { e.lwx = wx; e.lwy = wy; e.svx = 0; e.svy = 0; e.bph = Math.random() * 3; }
      if (dt > 0) { e.svx += ((wx - e.lwx) / dt - e.svx) * Math.min(1, dt * 6); e.svy += ((wy - e.lwy) / dt - e.svy) * Math.min(1, dt * 6); }
      e.lwx = wx; e.lwy = wy;
    }
    for (const b of BLOSSOMS) {
      const sx = (b.x - b.y) * 16 - camX + VW / 2, sy = (b.x + b.y) * 8 - camY + VH / 2;
      if (sx < -30 || sx > VW + 30 || sy < -40 || sy > VH + 40 || Math.random() > dt * 0.9) continue;
      const [x, y] = ePx(b); parts.push({ x: x + (Math.random() - .5) * 26, y: y - 30 + Math.random() * 14, vx: 6 + Math.random() * 8, vy: 5 + Math.random() * 5, g: 0, life: 3.5, max: 3.5, color: 'petal', ph: Math.random() * TAU });
    }
    for (const f of FLIES) {
      const far = Math.abs(f.x - camX) > VW * 0.7 || Math.abs(f.y - camY) > VH * 0.7;
      if (!f.init || far) { f.init = true; f.x = camX + (Math.random() - .5) * VW; f.y = camY + (Math.random() - .5) * VH; f.vx = (Math.random() - .5) * 16; f.vy = (Math.random() - .5) * 10; }
      f.vx += (Math.random() - .5) * 60 * dt; f.vy += (Math.random() - .5) * 40 * dt; f.vx *= 0.98; f.vy *= 0.98;
      f.x += f.vx * dt + Math.sin(time * 2 + f.ph) * 0.2; f.y += f.vy * dt + Math.sin(time * 3.1 + f.ph) * 0.15;
    }
    for (const o of others.values()) {
      const px = o.x, py = o.y; o.x += (o.tx - o.x) * Math.min(1, dt * 10); o.y += (o.ty - o.y) * Math.min(1, dt * 10);
      o.slash -= dt; o.atkT -= dt; o.spin -= dt; o.hitFlash -= dt; o.anim = o.moving ? o.anim + dt * 8 : 0; o.z += (W.hAt(o.x, o.y) - o.z) * Math.min(1, dt * 15); void px; void py;
    }
    for (const m of mobs) {
      const dx = m.tx - m.x; m.x += (m.tx - m.x) * Math.min(1, dt * 8); m.y += (m.ty - m.y) * Math.min(1, dt * 8);
      if (Math.abs(dx) > 0.01) m.flip = (dx - (m.ty - m.y)) < 0;
      m.hitFlash -= dt; m.lunge -= dt; m.z += (W.hAt(m.x, m.y) - m.z) * Math.min(1, dt * 12);
    }
    for (const e of [me, ...others.values()]) {
      const vd = e === me ? !!(me.equip && me.equip.feet && C.ITEMS[me.equip.feet[0]].fx === 'void') : e.voidFx;
      if (!vd || !e.moving || (e === me && mode !== 'play')) continue;
      e.footT = (e.footT || 0) - dt;
      if (e.footT <= 0) { e.footT = 0.16; e.footSide = !e.footSide; const sx2 = e.footSide ? 0.12 : -0.12; FOOT.push({ kind: 'foot', x: e.x + sx2, y: e.y - sx2, z: e.z, t: 0 }); const [px, py] = ePx(e); parts.push({ x: px + (Math.random() - .5) * 6, y: py - 2, vx: (Math.random() - .5) * 6, vy: -14 - Math.random() * 10, g: 0, life: 0.9, max: 0.9, color: 'void' }); }
    }
    for (let i = FOOT.length - 1; i >= 0; i--) { FOOT[i].t += dt; if (FOOT[i].t > 2.6) FOOT.splice(i, 1); }
    for (let i = shots.length - 1; i >= 0; i--) { shots[i].t += dt; if (shots[i].t > shots[i].dur) shots.splice(i, 1); }
    for (let i = floats.length - 1; i >= 0; i--) { floats[i].t += dt; if (floats[i].t > floats[i].dur) floats.splice(i, 1); }
    for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; if (q.life <= 0) parts.splice(i, 1); }
    for (let i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > rings[i].dur) rings.splice(i, 1); }
    // fumée des cheminées
    for (const ch of CHIMNEYS) { ch.t -= dt; if (ch.t <= 0) { ch.t = 0.35 + Math.random() * 0.4; const bx = (ch.i - ch.j) * 16 - ch.h.ax + ch.h.chimney[0], by = (ch.i + ch.j) * 8 - ch.z * 8 - ch.h.ay + ch.h.chimney[1]; parts.push({ x: bx + (Math.random() - .5) * 2, y: by, vx: 4 + Math.random() * 4, vy: -10 - Math.random() * 6, g: -2, life: 2.2, max: 2.2, color: 'smoke', sz: 1 }); } }
    let tx, ty;
    if (mode !== 'play') { const [cx, cy] = ePx({ x: W.CX, y: W.CY, z: 1 }); tx = cx + Math.cos(time * 0.12) * 70; ty = cy + Math.sin(time * 0.12) * 36; }
    else { [tx, ty] = ePx(me); ty -= 10; }
    // caméra : verrouillée au pixel sur le héros (pas de tremblement), glisse seulement sur les grands sauts
    if (mode === 'play' && Math.hypot(tx - camX, ty - camY) < 24) { camX = tx; camY = ty; }
    else { const k = Math.min(1, dt * 8); camX += (tx - camX) * k; camY += (ty - camY) * k; }
  }

  /* ---------- rendu du monde ---------- */
  const DYN = Array.from({ length: NB }, () => []);
  function drawTile(i, j, ox, oy, wf) {
    const k = idx(i, j), h = HT[k], x = ox + (i - j) * 16 - 16, yb = oy + (i + j) * 8;
    if (x > VW || x < -32 || yb - h * 8 > VH || yb + 26 < 0) return;
    if (TY[k] === 0) { g.drawImage(ART.terrain.water[k][wf], x, yb + 4); if (DECK[k]) g.drawImage(ART.deck[DECK[k]], x, yb - 3); return; }
    g.drawImage(ART.terrain.land[k], x, yb - h * 8);
  }
  function drawSlash(cx, cy, ang, prog, r) {
    r = r || 10; const n = 12, span = 2.4 * Math.min(1, prog * 1.6);
    for (let i = 0; i <= n; i++) { const a = ang - 1.2 + span * i / n; g.fillStyle = '#fffbe0'; g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.7), 1, 1); g.fillStyle = 'rgba(255,210,80,.8)'; g.fillRect(Math.round(cx + Math.cos(a) * (r + 1)), Math.round(cy + Math.sin(a) * (r + 1) * 0.7), 1, 1); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(Math.round(cx + Math.cos(a) * (r - 1)), Math.round(cy + Math.sin(a) * (r - 1) * 0.7), 1, 1); }
  }
  function drawScarf(e, sx, sy, ck) {
    ck = ck || 1;
    let dx = -(e.svx || 0), dy = -(e.svy || 0); const sp = Math.hypot(dx, dy);
    if (sp < 6) { dx = e.face === 'side' && !e.flip ? -1 : 1; dy = 0.15 + Math.sin(time * 1.3 + (e.bph || 0)) * 0.25; } else { dx /= sp; dy /= sp; }
    const m = Math.hypot(dx, dy); dx /= m; dy /= m;
    const side = dx >= 0 ? 1 : -1, ny = sy - Math.round(11.5 * ck);
    // nœud autour du cou
    const SCc = C.SCARVES[e.scarf || 0] || C.SCARVES[0];
    if (e.face !== 'back') { g.fillStyle = SCc[0]; g.fillRect(sx - 2 * ck, ny, 4 * ck, 1); g.fillStyle = SCc[1]; g.fillRect(sx - 2 * ck, ny, 2 * ck, 1); }
    else { g.fillStyle = SCc[2]; g.fillRect(sx - 2 * ck, ny, 4 * ck, 1); }
    const L = 8 + Math.min(5, sp / 8), ax = sx + side * Math.round(3 * ck), ay = ny + 1;
    for (let k = 0; k <= L; k++) {
      const wave = Math.sin(time * 9 - k * 0.75 + (e.bph || 0)) * k * 0.14;
      const x = sx + Math.round(ax - sx + dx * k - dy * wave), y = sy + Math.round(ay - sy + dy * k * 0.7 + dx * wave * side + k * 0.15);
      g.fillStyle = k > L - 2 ? SCc[2] : SCc[0]; g.fillRect(x, y, 1, 2);
      if (k % 3 === 0) { g.fillStyle = SCc[1]; g.fillRect(x, y, 1, 1); }
      if (e.scarf === 2 && ((time * 4 + k) % 5) < 0.4) { g.fillStyle = '#ffffff'; g.fillRect(x, y - 1, 1, 1); }
    }
  }
  function frameOf(e, set) { set = set || e.set; const f = Math.floor(e.anim) % 4;
    if (e.atkT > 0 && set.atk) { const ph = e.atkT > ATK_STRIKE ? 0 : 1; return e.face === 'side' ? (e.flip ? set.atk.sideL : set.atk.side)[ph] : set.atk[e.face][ph]; } if (!e.moving && set.blinkF && ((time + (e.bph || e.x)) % 3.4) < 0.14) { if (e.face === 'front') return set.blinkF; if (e.face === 'side') return e.flip ? set.blinkSL : set.blinkS; } if (e.face === 'side') return (e.flip ? set.sideL : set.side)[f]; return set[e.face][f]; }
  function drawEntity(e, ox, oy) {
    const fine = e.kind === 'char' || e.kind === 'npc' || e.kind === 'mob', snap = v => fine ? Math.round(v * RQ) / RQ : Math.round(v);
    const sx = snap(ox + (e.x - e.y) * 16), sy = snap(oy + (e.x + e.y) * 8 - e.z * 8);
    if (sx < -50 || sx > VW + 50 || sy < -12 || sy > VH + 90) return;
    switch (e.kind) {
      case 'decor': { const img = e.anim ? e.anim[Math.floor(time * 1.6 + e.ph) % 2] : e.img; g.drawImage(img, sx - (img.width >> 1), sy - img.height + 2); return; }
      case 'img': {
        if (e.shadow) g.drawImage(SHADOW, sx - 8 * e.shadow, sy - 2 * e.shadow, 16 * e.shadow, 6 * e.shadow);
        if (e.sway) { const sw = Math.sin(time * 1.3 + e.x * 0.7 + e.y) > 0.6 ? 1 : 0; g.drawImage(e.img, 0, 0, e.img.width, e.img.height - 12, sx - (e.img.width >> 1) + sw, sy - e.img.height + e.dy, e.img.width, e.img.height - 12); g.drawImage(e.img, 0, e.img.height - 12, e.img.width, 12, sx - (e.img.width >> 1), sy - 12 + e.dy, e.img.width, 12); }
        else g.drawImage(e.img, sx - (e.img.width >> 1), sy - e.img.height + e.dy);
        return;
      }
      case 'house': { const h = e.h, ax = Math.round(ox + (e.i - e.j) * 16), ay = Math.round(oy + (e.i + e.j) * 8 - e.z * 8); g.drawImage(h.img, ax - h.ax, ay - h.ay); return; }
      case 'foot': { const a = 1 - e.t / 2.6; g.globalAlpha = Math.min(1, a * 1.4); g.fillStyle = '#6a4ab8'; g.fillRect(sx - 2, sy - 2, 5, 4); g.fillStyle = '#0c0618'; g.fillRect(sx - 1, sy - 1, 3, 2); g.fillStyle = '#2a1648'; g.fillRect(sx - 1, sy - 2, 3, 1); if (((e.t * 5 + e.x * 7) % 3) < 0.4) { g.fillStyle = '#b08ae8'; g.fillRect(sx, sy - 1, 1, 1); } g.globalAlpha = 1; return; }
      case 'node': {
        const img = ART.nodes[e.res], ready = (nodeCd[e.k] || 0) < time, ok = me.glvl >= C.RES[e.res].req;
        g.globalAlpha = ready ? 1 : 0.35; g.drawImage(SHADOW, sx - 6, sy - 2, 12, 4); g.drawImage(img, sx - (img.width >> 1), sy - img.height + 2); g.globalAlpha = 1;
        if (ready && mode === 'play' && ((time * 2 + e.k * 0.37) % 1.6) < 0.3) { g.fillStyle = ok ? '#ffffff' : '#c8c0d8'; g.fillRect(sx - 4 + (e.k * 7) % 9, sy - img.height - 1 + (e.k * 3) % 5, 1, 1); }
        return;
      }
      case 'fountain': { const f = ART.fountain[Math.floor(time * 5) % 3]; g.drawImage(SHADOW, sx - 18, sy - 2, 36, 9); g.drawImage(f, sx - 20, sy - 30); return; }
      case 'mob': return drawMob(e, sx, sy);
      case 'bpost': {
        // poteau à lanterne + corde vers le poteau précédent (lanterne qui vacille)
        const [c1, c2] = e.glow;
        if (e.prev) { const px = Math.round(ox + (e.prev.x - e.prev.y) * 16), py = Math.round(oy + (e.prev.x + e.prev.y) * 8); for (let t = 1; t < 16; t++) { const u2 = t / 16; g.fillStyle = e.near ? '#d8c090' : '#a08860'; g.fillRect(Math.round(px + (sx - px) * u2), Math.round(py + (sy - py) * u2 - 10 + Math.sin(u2 * Math.PI) * 2), 1, 1); } }
        g.fillStyle = '#5e3820'; g.fillRect(sx, sy - 12, 1, 10); g.fillStyle = e.near ? '#8a5630' : '#3a2014'; g.fillRect(sx + 1, sy - 12, 1, 10);
        const fl = 0.75 + 0.25 * Math.sin(time * 6 + e.ph); g.globalAlpha = 0.35 * fl; g.drawImage(GLOW, sx - 6, sy - 20, 13, 13); g.globalAlpha = 1;
        g.fillStyle = c2; g.fillRect(sx - 1, sy - 16, 4, 3); g.fillStyle = c1; g.fillRect(sx, sy - 15, 2, 1); return;
      }
      case 'barch': { const img = e.frames[Math.floor(time * 5) % 4]; if (e.flip) { g.save(); g.translate(sx, 0); g.scale(-1, 1); g.drawImage(img, -11, sy - 33); g.restore(); } else g.drawImage(img, sx - 11, sy - 33); return; }
      case 'chest': { g.drawImage(SHADOW, sx - 8, sy - 3, 16, 5); g.drawImage(ART.chest[chestOpen ? 1 : 0], sx - 8, sy - 13); if (!chestOpen && ((time * 2) % 1.4) < 0.3) { g.fillStyle = '#fff6c0'; g.fillRect(sx + 3, sy - 15, 1, 1); } return; }
      default: return drawChar(e, sx, sy);
    }
  }
  // taille d'un pixel de personnage en pixels de jeu : ~0,6, arrondie pour tomber sur un nombre entier de pixels d'écran
  // (grille nette). ck = même échelle exprimée comme l'ancien facteur (~1,2) pour les effets placés autour du héros.
  function charP() { return RQ >= 2 ? Math.max(1, Math.round(RQ * 0.6)) / RQ : 0.5; }
  function charK() { return charP() * 2; }
  function drawChar(e, sx, sy) {
    if (!e.set) return;
    const p = charP(), ck = p * 2, cs = e.set, dw = cs.w * p, dh = cs.h * p, dx0 = sx - cs.cx * p, dy0 = sy - cs.foot * p;
    if (e.dead) { g.globalAlpha = 0.45; g.drawImage(cs.front[0], dx0, dy0, dw, dh); g.globalAlpha = 1; labels.push({ x: sx, y: sy - 34 * ck, t: e.name, c: '#a8a8b8' }); return; }
    g.drawImage(SHADOW, sx - 7 * ck, sy - 3, 14 * ck, 5);
    const scarf = e.kind !== 'npc';
    const bob = e.moving && Math.floor(e.anim) % 2 === 1 ? -1 : 0;
    if (!(e.hitFlash > 0 && Math.floor(time * 30) % 2)) g.drawImage(frameOf(e, cs), dx0, dy0 + bob, dw, dh);
    if (e.set.glint && ((time * 1.7 + (e.x || 0)) % 2.2) < 0.25) { const s2 = e.face === 'front' || (e.face === 'side' && e.flip) ? -1 : 1, gx = Math.round(sx + s2 * 9 * ck), gy = Math.round(sy - 17 * ck + bob); g.fillStyle = e.set.glint; g.fillRect(gx - 1, gy, 3, 1); g.fillRect(gx, gy - 1, 1, 3); g.fillStyle = '#ffffff'; g.fillRect(gx, gy, 1, 1); }
    if (scarf && e.set) drawScarf(e, sx, sy + bob, ck);
    if (cs.gm) for (let k = 0; k < 3; k++) { const a = time * 1.6 + k * 2.09 + (e.x || 0), r = 9 * ck, y0 = sy - 14 * ck + Math.sin(time * 2.2 + k * 1.7) * 6 * ck; g.fillStyle = k === 1 ? '#ffffff' : '#ffe070'; g.globalAlpha = 0.55 + 0.45 * Math.sin(time * 5 + k); g.fillRect(Math.round(sx + Math.cos(a) * r), Math.round(y0), 1, 1); g.globalAlpha = 1; }
    if (e === me && me.buff > 0) for (let k = 0; k < 4; k++) { const a = time * 4 + k * 1.57; g.fillStyle = k % 2 ? '#ff9a6a' : '#ffd060'; g.fillRect(Math.round(sx + Math.cos(a) * 8), Math.round(sy - 10 + Math.sin(a) * 4), 1, 1); }
    if (e.slash > 0) drawSlash(sx, sy - 11 * ck, e.slashAng, 1 - e.slash / 0.18);
    if (e.spin > 0) { const pr = 1 - e.spin / 0.35; for (let k = 0; k < 3; k++) drawSlash(sx, sy - 8, time * 18 + k * 2.09, 1, 11 + pr * 14); }
    if (e.kind === 'npc') { labels.push({ x: sx, y: sy - 35 * ck, t: e.name, c: '#ffe27a', npc: e }); return; }
    labels.push({ x: sx, y: sy - 35 * ck, t: e === me ? me.name : e.name, c: cs.gm ? '#ffe070' : e === me ? '#a8f080' : '#cfe4ff', lv: e === me ? null : e.lvl });
  }
  function drawMob(m, sx, sy) {
    const sc = m.scale; let lx = 0, ly = 0;
    if (m.lunge > 0 && mode === 'play') { const a = screenAng(m, me); lx = Math.round(Math.cos(a) * 3); ly = Math.round(Math.sin(a) * 2); }
    g.drawImage(SHADOW, sx - 7 * sc, sy - 3 * sc, 14 * sc, 5 * sc);
    const blink = m.hitFlash > 0 && Math.floor(time * 30) % 2;
    let top;
    if (m.type === 'champi') {
      const img = ART.champi[m.moving ? Math.floor(time * 6) % 2 : 0], bob = m.moving ? Math.abs(Math.sin(time * 9 + m.phase)) * -1.5 | 0 : 0;
      if (!blink) { if (m.flip) { g.save(); g.translate(sx + lx, 0); g.scale(-1, 1); g.drawImage(img, -9, sy - 19 + bob + ly); g.restore(); } else g.drawImage(img, sx - 9 + lx, sy - 19 + bob + ly); }
      top = sy - 20;
    } else {
      const img = ART[m.type], hop = m.moving ? Math.abs(Math.sin(time * 7 + m.phase)) : 0, sq = 1 + Math.sin(time * 6 + m.phase) * 0.08 * (m.moving || m.aggro ? 1.6 : 1) + hop * 0.08;
      ly -= Math.round(hop * 3 * sc);
      const w = Math.round(16 * sc * (2 - sq)), h = Math.round(14 * sc * sq);
      if (!blink) g.drawImage(img, sx - (w >> 1) + lx, sy - h + 2 + ly, w, h);
      if (m.type === 'boss') g.drawImage(ART.crown, sx - 9 + lx, sy - h - 8 + ly, 18, 12);
      top = sy - h - (m.type === 'boss' ? 8 : 0);
    }
    if (m.status === 1) for (let k = 0; k < 3; k++) { const a = time * 5 + k * 2.09; g.fillStyle = k % 2 ? '#fff0a0' : '#ffd060'; g.fillRect(Math.round(sx + Math.cos(a) * 6), Math.round(top - 2 + Math.sin(a) * 2), 1, 1); }
    else if (m.status === 3) for (let k = 0; k < 3; k++) { const ph = (time * 2.2 + k * 0.33) % 1; g.fillStyle = ph < 0.5 ? '#ffd060' : '#ff7a3a'; g.fillRect(Math.round(sx - 4 + k * 4 + Math.sin(time * 9 + k) * 1), Math.round(sy - 4 - ph * 10), 1, ph < 0.3 ? 2 : 1); }
    else if (m.status === 2 && Math.floor(time * 6) % 2) { g.fillStyle = '#a8dcff'; g.fillRect(sx - 4, sy - 3, 1, 1); g.fillRect(sx + 3, sy - 5, 1, 1); }
    labels.push({ x: sx, y: top - 4, hp: m.hp < m.maxhp ? m.hp / m.maxhp : null, w: 16 * sc, mob: m });
  }
  function render() {
    labels.length = 0;
    g.setTransform(RQ, 0, 0, RQ, 0, 0); g.drawImage(BACKDROP, 0, 0);
    // (reflets de nuages sur la mer retirés : coûteux sur mobile)
    const shx = shake > 0 ? Math.round((Math.random() - .5) * 3) : 0, shy = shake > 0 ? Math.round((Math.random() - .5) * 3) : 0;
    const fx = VW / 2 - camX + shx, fy = VH / 2 - camY + shy, ox = Math.floor(fx), oy = Math.floor(fy); lastOX = ox; lastOY = oy;
    SUBX = Math.round((fx - ox) * RQ); SUBY = Math.round((fy - oy) * RQ); g.setTransform(RQ, 0, 0, RQ, SUBX, SUBY); g.imageSmoothingEnabled = false;
    for (const b of DYN) b.length = 0;
    const push = e => DYN[clamp(Math.floor(e.x + e.y), 0, NB - 1)].push(e);
    for (const m of mobs) if (m.alive) { m.kind = 'mob'; push(m); }
    for (const o of others.values()) { o.kind = 'char'; push(o); }
    for (const n of NPCS) push(n);
    for (const n of NODES) push(n);
    for (const f of FOOT) push(f);
    if (mode === 'play') { me.kind = 'char'; push(me); }
    const wf = Math.floor(time * 3) % 4;
    const sMin = Math.max(0, Math.floor((-ox - 60) / 16 + (-oy - 40) / 8) - 4);
    for (let s = 0; s < NB; s++) {
      if (s <= MW + MH - 2) { const i0 = Math.max(0, s - MH + 1), i1 = Math.min(MW - 1, s); for (let i = i0; i <= i1; i++) drawTile(i, s - i, ox, oy, wf); }
      const st = STATIC[s], dy = DYN[s];
      if (!st.length && !dy.length) continue;
      if (dy.length) { const all = st.concat(dy).sort((a, b) => (a.x + a.y) - (b.x + b.y)); for (const e of all) drawEntity(e, ox, oy); }
      else for (const e of st) drawEntity(e, ox, oy);
    }
    void sMin;
    for (const r of rings) { const f = r.t / r.dur, rad = r.r0 + (r.r1 - r.r0) * f; g.fillStyle = r.color; g.globalAlpha = 1 - f * 0.6; const n = Math.max(12, Math.floor(rad * 5)); for (let i = 0; i < n; i++) { const a = i / n * TAU; g.fillRect(Math.round(ox + r.x + Math.cos(a) * rad), Math.round(oy + r.y + Math.sin(a) * rad * 0.5), 1, 1); } g.globalAlpha = 1; }
    for (const q of parts) {
      if (q.color === 'void') { const f = q.life / q.max; g.fillStyle = 'rgba(' + (f > 0.5 ? '176,138,232' : '40,20,70') + ',' + (f * 0.8).toFixed(2) + ')'; g.fillRect(Math.round(ox + q.x), Math.round(oy + q.y), 1, 1); continue; }
      if (q.color === 'smoke') { const f = 1 - q.life / q.max; g.fillStyle = 'rgba(236,232,240,' + (0.55 * (1 - f)).toFixed(2) + ')'; const s = 1 + Math.floor(f * 3); g.fillRect(Math.round(ox + q.x), Math.round(oy + q.y), s, s); }
      else if (q.color === 'petal') { const f = q.life / q.max; g.fillStyle = f < 0.2 ? 'rgba(255,200,220,' + (f * 5).toFixed(2) + ')' : (Math.sin(time * 6 + q.ph) > 0 ? '#ffd2e0' : '#f4a8c4'); g.fillRect(Math.round(ox + q.x + Math.sin(time * 2 + q.ph) * 3), Math.round(oy + q.y), Math.sin(time * 5 + q.ph) > 0 ? 2 : 1, 1); }
      else { g.fillStyle = q.color; g.fillRect(Math.round(ox + q.x), Math.round(oy + q.y), 1, 1); }
    }
    for (const q of shots) {
      const f = q.t / q.dur, x = ox + q.x0 + (q.x1 - q.x0) * f, y = oy + q.y0 + (q.y1 - q.y0) * f - Math.sin(f * Math.PI) * (q.kind === 'arrow' ? 6 : 2);
      const ang = Math.atan2(q.y1 - q.y0, q.x1 - q.x0), dx = Math.cos(ang), dy = Math.sin(ang);
      if (q.kind === 'arrow' || q.kind === 'pierce') { g.fillStyle = q.kind === 'pierce' ? '#bfe6ff' : '#f4ead8'; for (let k = 0; k < (q.kind === 'pierce' ? 6 : 4); k++) g.fillRect(Math.round(x - dx * k), Math.round(y - dy * k), 1, 1); g.fillStyle = '#ffffff'; g.fillRect(Math.round(x + dx), Math.round(y + dy), 1, 1); }
      else if (q.kind === 'bolt') { g.fillStyle = '#7ec4ee'; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); g.fillStyle = '#ffffff'; g.fillRect(Math.round(x), Math.round(y), 1, 1); g.fillStyle = 'rgba(126,196,238,.5)'; g.fillRect(Math.round(x - dx * 3), Math.round(y - dy * 3), 1, 1); }
      else if (q.kind === 'fire') { g.fillStyle = '#d8402a'; g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4); g.fillStyle = '#ffd060'; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2); g.fillStyle = 'rgba(240,138,58,.6)'; g.fillRect(Math.round(x - dx * 4), Math.round(y - dy * 4), 2, 2); }
    }
    // papillons
    for (const f of FLIES) { const x = Math.round(f.x - camX + VW / 2), y = Math.round(f.y - camY + VH / 2); if (x < 0 || y < 0 || x > VW || y > VH) continue; const open = Math.sin(time * 22 + f.ph) > 0; g.fillStyle = f.col; if (open) { g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x - 1, y - 1, 1, 1); g.fillRect(x + 1, y - 1, 1, 1); } else { g.fillRect(x, y - 1, 1, 2); } g.fillStyle = '#5a4a6a'; g.fillRect(x, y, 1, 1); }
    // ombres de nuages qui dérivent
    const T = 64 * 9; if (!CLOUD9) { CLOUD9 = document.createElement('canvas'); CLOUD9.width = CLOUD9.height = T; const c9 = CLOUD9.getContext('2d'); c9.imageSmoothingEnabled = true; c9.drawImage(ART.cloud, 0, 0, T, T); } g.globalAlpha = 0.3;
    const cx = ((ox + time * 7) % T + T) % T - T, cy = ((oy + time * 3.5) % T + T) % T - T;
    for (let x = Math.round(cx); x < VW; x += T) for (let y = Math.round(cy); y < VH; y += T) g.drawImage(CLOUD9, x, y);
    g.globalAlpha = 1;
    // halos des lanternes
    g.globalCompositeOperation = 'lighter';
    for (const l of LAMPS) { const sx = ox + (l.x - l.y) * 16, sy = oy + (l.x + l.y) * 8 - l.z * 8 - 26; const fl = 0.85 + Math.sin(time * 7 + l.x) * 0.06; g.globalAlpha = fl; g.drawImage(GLOW, sx - 24, sy - 24, 48, 48); }
    for (const n of NODES) { if ((nodeCd[n.k] || 0) >= time) continue; const sx = ox + (n.x - n.y) * 16, sy = oy + (n.x + n.y) * 8 - n.z * 8; if (sx < -20 || sx > VW + 20 || sy < -20 || sy > VH + 20) continue; g.globalAlpha = 0.28 + 0.1 * Math.sin(time * 3 + n.k); g.drawImage(GLOW, sx - 10, sy - 16, 20, 18); }
    for (const h of CHIMNEYS) { const sx = ox + (h.i - h.j) * 16, sy = oy + (h.i + h.j) * 8 - h.z * 8; g.globalAlpha = 0.5; g.drawImage(GLOW, sx - 36, sy + 6, 40, 30); }
    g.globalCompositeOperation = 'source-over';
    for (const l of LAMPS) { const sx = ox + (l.x - l.y) * 16, sy = oy + (l.x + l.y) * 8 - l.z * 8 - 26; for (let k = 0; k < 3; k++) { const a = time * (0.7 + k * 0.3) + k * 2.1 + l.x; g.globalAlpha = 0.5 + 0.5 * Math.sin(time * 5 + k * 3 + l.y); g.fillStyle = '#fff4a8'; g.fillRect(Math.round(sx + Math.cos(a) * (9 + k * 3)), Math.round(sy + 6 + Math.sin(a * 1.3) * 7), 1, 1); } }
    g.globalAlpha = 1;
    // étalonnage + vignette : précalculés une fois par taille d'écran (un seul dessin par image)
    g.setTransform(RQ, 0, 0, RQ, 0, 0);
    if (gradeK < 1) { g.globalAlpha = 1 - gradeK; g.drawImage(zoneGrade(gradeFrom), 0, 0); g.globalAlpha = gradeK; }
    g.drawImage(zoneGrade(gradeTo), 0, 0); g.globalAlpha = 1;
    g.imageSmoothingEnabled = false;
    // pollen
    for (const m of motes) {
      m.x += Math.sin(time * 0.6 + m.ph) * 0.15 + 0.08; m.y -= m.sp * 0.016;
      const x = ((m.x - camX * 0.3) % (VW + 20) + VW + 20) % (VW + 20) - 10, y = ((m.y - camY * 0.3) % (VH + 20) + VH + 20) % (VH + 20) - 10;
      const zi = gradeTo, mc = ZONE_LOOK[zi].mote, tw = Math.sin(time * (zi === 2 ? 3.2 : 2) + m.ph), al = zi === 2 ? Math.max(0, tw) * 0.9 : 0.35 + 0.35 * tw;
      if (zi === 3) m.y -= m.sp * 0.03; // les braises montent plus vite
      g.fillStyle = 'rgba(' + mc[0] + ',' + mc[1] + ',' + mc[2] + ',' + al.toFixed(2) + ')'; g.fillRect(Math.round(x), Math.round(y), 1, 1);
      if (zi === 2 && al > 0.6) { g.globalAlpha = 0.25; g.fillRect(Math.round(x) - 1, Math.round(y), 3, 1); g.fillRect(Math.round(x), Math.round(y) - 1, 1, 3); g.globalAlpha = 1; }
    }
  }

  let hudWalk = null;
  function npcMark(n) { const Q = C.QUESTS[me.q]; if (!Q || Q.giver !== n.id) return null; return me.qs === 0 ? '!' : me.qs === 2 ? '?' : '…'; }
  /* ---------- interface ---------- */
  function panel(x, y, w, h) { /* encre indigo, filet crème intérieur, coins dorés */ u.fillStyle = '#0c0a1c'; u.fillRect(x - 1, y, w + 2, h); u.fillRect(x, y - 1, w, h + 2); u.fillStyle = 'rgba(22,22,46,.84)'; u.fillRect(x, y, w, h); u.fillStyle = 'rgba(239,227,200,.55)'; u.fillRect(x + 2, y + 1, w - 4, 1); u.fillRect(x + 2, y + h - 2, w - 4, 1); u.fillRect(x + 1, y + 2, 1, h - 4); u.fillRect(x + w - 2, y + 2, 1, h - 4); u.fillStyle = '#e8c37a'; for (const [a, b] of [[x + 1, y + 1], [x + w - 2, y + 1], [x + 1, y + h - 2], [x + w - 2, y + h - 2]]) u.fillRect(a, b, 1, 1); }
  function bar(x, y, w, h, f, c1, c2, bg) { u.fillStyle = '#1a0f1c'; u.fillRect(x - 1, y - 1, w + 2, h + 2); u.fillStyle = bg; u.fillRect(x, y, w, h); const fw = Math.round(w * clamp(f, 0, 1)); u.fillStyle = c1; u.fillRect(x, y, fw, h); u.fillStyle = c2; u.fillRect(x, y + h - Math.max(1, h >> 1), fw, Math.max(1, h >> 1)); u.fillStyle = 'rgba(255,255,255,.4)'; u.fillRect(x, y, fw, 1); }
  function pcircle(cx, cy, r, col, yMax) { u.fillStyle = col; for (let y = -r; y <= Math.min(r, yMax == null ? 99 : yMax); y++) { const w = Math.floor(Math.sqrt(r * r - y * y)); u.fillRect(cx - w, cy + y, w * 2 + 1, 1); } }
  function pring(cx, cy, r, col) { u.fillStyle = col; const n = Math.max(16, Math.floor(r * 6)); for (let i = 0; i < n; i++) { const a = i / n * TAU; u.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1); } }
  const mini = document.createElement('canvas'); mini.width = mini.height = 46; const mg = mini.getContext('2d'), mimg = mg.createImageData(46, 46);
  function drawMinimap(cx, cy) {
    const d = mimg.data, Q = 5;
    if (time - miniT > 0.1 || time < miniT) { miniT = time;
    for (let my = 0; my < 46; my++) for (let mx = 0; mx < 46; mx++) {
      const dx = mx - 23, dy = my - 23, k = (my * 46 + mx) * 4;
      if (dx * dx + dy * dy > 22 * 22) { d[k + 3] = 0; continue; }
      const sx = dx * Q, sy = dy * Q, wx = me.x + (sx / 16 + sy / 8) / 2, wy = me.y + (sy / 8 - sx / 16) / 2, i = Math.floor(wx), j = Math.floor(wy);
      const c = W.inb(i, j) ? MINICOL[idx(i, j)] : [36, 98, 160];
      d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
    }
    mg.putImageData(mimg, 0, 0); }
    pcircle(cx, cy, 24, '#1a0f1c'); u.drawImage(mini, cx - 23, cy - 23); pring(cx, cy, 23, 'rgba(239,227,200,.85)'); pring(cx, cy, 24, '#0c0a1c'); u.fillStyle = '#e8c37a'; u.fillRect(cx - 1, cy - 25, 3, 1); u.fillRect(cx, cy - 26, 1, 3);
    const toMini = (x, y) => { const ddx = x - me.x, ddy = y - me.y, sx = (ddx - ddy) * 16 / Q, sy = (ddx + ddy) * 8 / Q; return [Math.round(cx + sx), Math.round(cy + sy)]; };
    for (const m of mobs) { if (!m.alive) continue; const [x, y] = toMini(m.x, m.y); if ((x - cx) ** 2 + (y - cy) ** 2 > 21 * 21) continue; u.fillStyle = m.type === 'boss' ? '#c890ff' : m.aggro ? '#ff5a5a' : '#ffb04a'; u.fillRect(x, y, m.type === 'boss' ? 2 : 1, m.type === 'boss' ? 2 : 1); }
    for (const n of NODES) { if ((nodeCd[n.k] || 0) >= time) continue; const [x, y] = toMini(n.x, n.y); if ((x - cx) ** 2 + (y - cy) ** 2 > 21 * 21) continue; u.fillStyle = n.res === 'herb' ? '#bfe6ff' : n.res === 'wood' ? '#ffcf70' : '#ffb0d4'; u.fillRect(x, y, 1, 1); }
    for (const n of NPCS) { const [x, y] = toMini(n.x, n.y); if ((x - cx) ** 2 + (y - cy) ** 2 > 21 * 21) continue; const mk = npcMark(n); u.fillStyle = mk === '!' || mk === '?' ? '#ffe27a' : '#f4ead8'; u.fillRect(x - 1, y - 1, mk === '!' || mk === '?' ? 3 : 2, mk === '!' || mk === '?' ? 3 : 2); }
    for (const o of others.values()) { const [x, y] = toMini(o.x, o.y); if ((x - cx) ** 2 + (y - cy) ** 2 > 21 * 21) continue; u.fillStyle = '#9fe0ff'; u.fillRect(x - 1, y, 3, 1); u.fillRect(x, y - 1, 1, 3); }
    u.fillStyle = '#fff6a0'; u.fillRect(cx - 1, cy - 1, 3, 3); u.fillStyle = '#1a0f1c'; u.fillRect(cx, cy, 1, 1);
  }
  function drawButton(k, b) {
    const down = btnDown[k];
    pcircle(b.x, b.y, b.r + 2, 'rgba(12,10,28,.85)'); pring(b.x, b.y, b.r + 1, k === 'atk' ? '#e8c37a' : 'rgba(239,227,200,.8)');
    pcircle(b.x, b.y, b.r, down ? 'rgba(10,10,24,.9)' : k === 'atk' ? 'rgba(84,34,56,.88)' : b.ab != null ? 'rgba(34,52,72,.86)' : k === 'pot' ? 'rgba(70,34,66,.86)' : 'rgba(30,32,62,.86)');
    pcircle(b.x, b.y - 1, b.r - 3, down ? 'rgba(255,255,255,0)' : 'rgba(255,240,220,.08)', -Math.floor(b.r * 0.35));
    const ic = ART.icons[b.icon] || ART.icons.sword; u.drawImage(ic, b.x - (ic.width >> 1), b.y - (ic.height >> 1) + (down ? 1 : 0));
    let cd = 0;
    if (k === 'atk') cd = me.atkCd / CL().basic.cd; else if (k === 'pot') cd = me.potCd / 0.9;
    else if (b.ab != null) { const A = CL().ab[b.ab]; cd = Math.max(localAbCd[b.ab] - time, (me.abCd && me.abCd[b.ab]) || 0) / A.cd; }
    if (cd > 0) pcircle(b.x, b.y, b.r, 'rgba(10,5,20,.6)', -b.r + Math.round(2 * b.r * clamp(cd, 0, 1)));
    if (b.ab != null) { const A = CL().ab[b.ab]; if (A.locked) { pcircle(b.x, b.y, b.r, 'rgba(10,5,20,.72)'); text(u, A.m < 99 ? 'M' + A.m : '-', b.x, b.y - 3, '#c8c0d8', 'center'); } else if (me.mp < A.mp) pcircle(b.x, b.y, b.r, 'rgba(20,30,80,.45)'); }
    if (k === 'pot') { pcircle(b.x + b.r - 2, b.y + b.r - 3, 4, '#1a0f1c'); text(u, String(me.potions), b.x + b.r - 2, b.y + b.r - 6, '#ffe27a', 'center', 1, false); }
  }
  function drawVeil(f, col, top, name) {
    if (f <= 0) return;
    u.fillStyle = 'rgba(' + col.join(',') + ',' + (0.92 * f).toFixed(3) + ')'; u.fillRect(0, 0, UW, UH);
    for (let k = 0; k < 40; k++) { const a = time * (0.6 + (k % 5) * 0.15) + k * 2.4, r = 20 + (k * 37) % (UW * 0.6); u.fillStyle = k % 3 ? 'rgba(255,255,255,' + (0.5 * f).toFixed(2) + ')' : 'rgba(255,240,200,' + (0.7 * f).toFixed(2) + ')'; u.fillRect(Math.round(UW / 2 + Math.cos(a) * r), Math.round(UH * 0.45 + Math.sin(a) * r * 0.6), 1, 1); }
    if (f > 0.45) { u.globalAlpha = clamp((f - 0.45) / 0.3, 0, 1); if (top) text(u, top, UW >> 1, Math.round(UH * 0.38), '#fff2d0', 'center', 1); text(u, name, UW >> 1, Math.round(UH * 0.43), '#ffffff', 'center', 2); u.globalAlpha = 1; }
  }
  function drawUI() {
    u.clearRect(0, 0, UW, UH);
    const ox = lastOX, oy = lastOY;
    // étiquettes du monde
    for (const l of labels) {
      const x = Math.round((l.x + SUBX / RQ) * K), y = Math.round((l.y + SUBY / RQ) * K);
      if (l.npc) {
        text(u, l.t, x, y - 6, l.c, 'center');
        const mk = npcMark(l.npc);
        if (mk && mode === 'play') { const b = Math.round(Math.sin(time * 4) * 1.5); text(u, mk === '…' ? '?' : mk, x, y - 22 + b, mk === '…' ? '#a8a0b8' : '#ffe27a', 'center', 2); }
        continue;
      }
      if (l.mob) {
        const m = l.mob; let yy = y;
        if (l.hp != null) { const w = Math.round(l.w * K) + 4; bar(x - (w >> 1), yy - 2, w, 2, l.hp, '#e8414a', '#b02a34', '#3a1018'); yy -= 4; }
        if (me.target === m && mode === 'play' && !me.dead) {
          const diff = m.lvl - me.lvl, col = diff >= 3 ? '#ff7a6a' : diff <= -3 ? '#a8a8b8' : '#ffffff';
          text(u, m.name + ' nv' + m.lvl, x, yy - 9, col, 'center');
          const b = Math.floor(time * 4) % 2; u.fillStyle = '#ffd23f'; u.fillRect(x - 2, yy - 15 - b, 5, 1); u.fillRect(x - 1, yy - 14 - b, 3, 1); u.fillRect(x, yy - 13 - b, 1, 1);
        }
        continue;
      }
      if (mode === 'play' || l.t) text(u, l.t + (l.lv ? ' ' + l.lv : ''), x, y - 6, l.c, 'center');
    }
    for (const f of floats) { const e = f.t / f.dur; u.globalAlpha = e > 0.75 ? (1 - e) * 4 : 1; text(u, f.text, (ox + SUBX / RQ + f.x + f.vx * f.t) * K, (oy + SUBY / RQ + f.y - Math.sqrt(e) * 22) * K, f.color, 'center', f.big ? 2 : 1); u.globalAlpha = 1; }
    if (mode !== 'play') return;
    u.save(); u.translate(0, ST);
    // panneau de statut
    const pw = Math.min(104, UW - 64);
    panel(3, 3, pw, 33);
    u.fillStyle = 'rgba(239,227,200,.8)'; u.fillRect(6, 6, 22, 22); u.fillStyle = '#2e4a5c'; u.fillRect(7, 7, 20, 20); u.fillStyle = '#243a4c'; u.fillRect(7, 17, 20, 10);
    if (me.set) { u.imageSmoothingEnabled = true; u.drawImage(me.set.front[0], 13, 8, 32, 38, 9, 8, 16, 19); u.imageSmoothingEnabled = false; }
    u.fillStyle = '#e8c37a'; u.fillRect(6, 26, 22, 8); text(u, 'NV' + me.lvl, 17, 27, '#2a1a10', 'center', 1, false);
    text(u, me.name, 32, 5, '#fff2d0');
    const bw = pw - 34;
    bar(32, 13, bw, 7, me.hp / me.maxhp, '#dc6a68', '#a8465a', '#2e1424'); text(u, Math.ceil(me.hp) + '/' + me.maxhp, 32 + (bw >> 1), 13, '#ffffff', 'center');
    bar(32, 23, bw, 4, me.mp / me.maxmp, '#78a8dc', '#4f78b0', '#161a3a');
    bar(32, 30, bw, 2, me.xp / me.need, '#b2d896', '#7aa870', '#1a2a20');
    u.drawImage(ART.icons.coin, 5, 40); text(u, String(me.gold), 12, 39, '#ffd23f');
    { const xe = 18 + textW(String(me.gold)); u.drawImage(ART.icons.ether, xe, 40); text(u, String(me.ether || 0), xe + 7, 39, '#bfe6ff'); const xg = xe + 12 + textW(String(me.ether || 0)); text(u, 'Cueil. nv' + (me.glvl || 1), xg, 39, '#c8c0d8'); hudWalk = { x: 3, y: 37 + ST, w: xg + textW('Cueil. nv' + (me.glvl || 1)), h: 10 }; }
    // tchat
    const Q = C.QUESTS[me.q];
    let y0 = 50;
    { const tw = Math.min(150, UW - 64); panel(3, 48, tw, 18); u.fillStyle = '#ffe27a'; u.fillRect(6, 52, 2, 2);
      if (Q) { text(u, Q.title, 11, 50, '#ffe9b0'); const g2 = C.NPCS[Q.giver].name; text(u, me.qs === 0 ? 'Parler à ' + g2 : me.qs === 2 ? 'Retourner voir ' + g2 : Q.short + ' ' + me.qn + '/' + Q.n, 11, 58, me.qs === 2 ? '#9cf07a' : '#d8d0e8'); }
      else { text(u, 'Chapitre 1 terminé', 11, 50, '#ffe9b0'); text(u, 'Suite bientôt...', 11, 58, '#d8d0e8'); }
      y0 = 70; }
    const lines = chat.slice(-5), cw = Math.min(170, UW - 64);
    if (lines.length) { u.fillStyle = 'rgba(18,16,38,.5)'; u.fillRect(3, y0, cw, lines.length * 7 + 3); lines.forEach((l, i) => text(u, l.text, 5, y0 + 1 + i * 7, l.color)); }
    // mini-carte et statut réseau
    drawMinimap(UW - 27, 27);
    if (showFps) text(u, fpsShown + ' i/s Q' + RQ, UW - 27, 61, fpsShown >= 50 ? '#9cf07a' : fpsShown >= 30 ? '#ffd23f' : '#ff7a6a', 'center');
    text(u, netMode === 'online' ? online + ' en ligne' : 'Solo', UW - 27, 53, netMode === 'online' ? '#9cf07a' : '#c8c0d8', 'center');
    u.restore();
    // bannière de zone
    if (zoneT > 0 && zone) { const a = zoneT > 2.4 ? (2.8 - zoneT) / 0.4 : zoneT < 0.6 ? zoneT / 0.6 : 1; u.globalAlpha = clamp(a, 0, 1); const sc = textW(zone, 2) < UW - 20 ? 2 : 1, y = Math.round(UH * 0.2), w = textW(zone, sc); const bx = (UW - w >> 1) - 14, bw = w + 28; u.fillStyle = 'rgba(18,16,38,.72)'; u.fillRect(bx, y - 5, bw, 7 * sc + 10); u.fillStyle = 'rgba(239,227,200,.7)'; u.fillRect(bx + 6, y - 3, bw - 12, 1); u.fillRect(bx + 6, y + 7 * sc + 2, bw - 12, 1); u.fillStyle = '#e8c37a'; for (const ex of [bx + 3, bx + bw - 4]) { u.fillRect(ex, y + (7 * sc >> 1) - 1, 1, 3); u.fillRect(ex - 1, y + (7 * sc >> 1), 3, 1); } text(u, zone, UW >> 1, y, '#f6eedc', 'center', sc); u.globalAlpha = 1; }
    const B = btns(); for (const k in B) drawButton(k, B[k]);
    talkRect = null;
    const panelsClosed = $('dialog').hidden && $('craft').hidden && $('walk').hidden && $('char').hidden;
    if ((nearNpc || nearNode || nearBridge || nearChest) && !me.dead && panelsClosed && !travel) {
      let label, hot;
      if (nearBridge) { label = nearBridge.kind === 'ether' ? "Traverser le Pont d'Éther (" + C.ETHER_BRIDGE + ' Éther)' : 'Rentrer au Bourg d\'Argel'; hot = true; }
      else if (nearChest) { label = 'Ouvrir le coffre'; hot = true; }
      else if (nearNpc) { const mk = npcMark(nearNpc); label = 'Parler à ' + nearNpc.name; hot = mk === '!' || mk === '?'; }
      else { const R0 = C.RES[nearNode.res], ready = (nodeCd[nearNode.k] || 0) < time; label = me.glvl < R0.req ? 'Cueillette nv' + R0.req + ' requise' : !ready ? 'Repousse dans ' + Math.ceil(nodeCd[nearNode.k] - time) + 's' : me.ether < 1 ? "Pas assez d'Éther" : 'Récolter ' + R0.name; hot = me.glvl >= R0.req && ready && me.ether >= 1; }
      const w = textW(label) + 16, h = 15, x = (UW - w) >> 1, y = UH - 66 - SB;
      talkRect = { x, y, w, h };
      u.fillStyle = '#0c0a1c'; u.fillRect(x - 1, y - 1, w + 2, h + 2); u.fillStyle = hot ? (nearNpc ? '#e8c37a' : '#8cc4c0') : 'rgba(22,22,46,.9)'; u.fillRect(x, y, w, h); u.fillStyle = hot ? 'rgba(255,250,235,.45)' : 'rgba(239,227,200,.5)'; u.fillRect(x + 1, y + 1, w - 2, 1);
      text(u, label, UW >> 1, y + 4, hot ? '#1a1420' : '#fff2d0', 'center', 1, false);
    }
    if (joy.active) { pring(joy.ox, joy.oy, 18, 'rgba(255,240,210,.6)'); pring(joy.ox, joy.oy, 17, 'rgba(255,240,210,.3)'); let dx = joy.x - joy.ox, dy = joy.y - joy.oy; const m = Math.hypot(dx, dy); if (m > 14) { dx = dx / m * 14; dy = dy / m * 14; } pcircle(Math.round(joy.ox + dx), Math.round(joy.oy + dy), 7, 'rgba(255,240,210,.55)'); }
    else if (usedTouch && !movedOnce) { const x = 32, y = UH - 38 - SB; pring(x, y, 18, 'rgba(255,240,210,' + (0.35 + 0.25 * Math.sin(time * 4)).toFixed(2) + ')'); text(u, 'Bouger', x, y - 3, '#fff', 'center'); }
    // traversée d'un pont : la brume monte (départ), puis se dissipe à l'arrivée sur la nouvelle île
    if (travel) drawVeil(clamp((time - travel.t) / 1.1, 0, 1), travel.col, 'Traversée…', travel.name);
    else if (arrive) { if (arrive.t0 == null) arrive.t0 = time; const f = 1 - clamp((time - arrive.t0 - 0.3) / 1.4, 0, 1); drawVeil(f, arrive.col, '', arrive.name); if (f <= 0) arrive = null; }
    if (me.dead) { u.fillStyle = 'rgba(30,0,16,.55)'; u.fillRect(0, 0, UW, UH); text(u, 'Vous êtes mort', UW >> 1, Math.round(UH * 0.4), '#ff7a7a', 'center', 2); text(u, 'Retour au bourg dans ' + me.deadT, UW >> 1, Math.round(UH * 0.4) + 20, '#fff', 'center'); }
  }

  /* ---------- menu de création ---------- */
  const preview = $('preview'), pctx = preview.getContext('2d'); pctx.imageSmoothingEnabled = false;
  const LOOK_LABELS = ['Coiffure', 'Cheveux', 'Tenue', 'Peau', 'Chapeau'];
  me.cls = C.START[prefs.cls | 0] ? prefs.cls | 0 : 0;
  const LOOK_NAMES = [['Courte', 'Longue', 'Épis'], ['Châtain', 'Roux', 'Blond', 'Argent', 'Nuit', 'Sylve', 'Rose'], ['Azur', 'Carmin', 'Forêt', 'Ocre', 'Améthyste', 'Ardoise', 'Lagon'], ['Claire', 'Dorée', 'Brune'], ['Aucun', 'Mage', 'Bandeau', 'Pousse']];
  function buildMenu() {
    { let sv = null; try { sv = JSON.parse(localStorage.getItem('etheria_solo') || 'null'); } catch (e) { /* ignore */ } if (!sv) sv = restoredSolo || (SEED && SEED.solo); if (sv && sv.equip && prefs.name) { me.equip = sv.equip; me.gear = C.gearStr(sv.equip); } }
    const box = $('looks'); box.innerHTML = `<div class="row cls"><span>Arme</span><button type="button" data-c="-1" aria-label="Arme précédente">‹</button><b id="lvc"></b><button type="button" data-c="1" aria-label="Arme suivante">›</button></div><p id="clsdesc" class="clsdesc"></p>` + LOOK_LABELS.map((l, i) => `<div class="row"><span>${l}</span><button type="button" data-i="${i}" data-d="-1" aria-label="${l} précédent">‹</button><b id="lv${i}"></b><button type="button" data-i="${i}" data-d="1" aria-label="${l} suivant">›</button></div>`).join('');
    box.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.c) { me.cls = (me.cls + +b.dataset.c + C.START.length) % C.START.length; refreshLook(); return; } const i = +b.dataset.i, d = +b.dataset.d; look[i] = (look[i] + d + C.LOOK_MAX[i]) % C.LOOK_MAX[i]; refreshLook(); });
    $('name').value = me.name; refreshLook();
    $('form').addEventListener('submit', e => { e.preventDefault(); play(); });
    // héros déjà créé : écran « Continuer » au lieu de la création
    const setResume = on => {
      $('resume').hidden = !on; $('namebox').hidden = on; $('looks').hidden = on; $('edit').hidden = !on;
      $('play').textContent = on ? 'Continuer l\'aventure' : 'Entrer dans Pixels Worlds';
    };
    if (prefs.name) {
      let lvl = 0; try { const s = JSON.parse(localStorage.getItem('etheria_solo') || 'null'); if (s && s.lvl) lvl = s.lvl; } catch (e) { /* ignore */ }
      lvl = Math.max(lvl, prefs.lvl || 0);
      $('rname').textContent = prefs.name; $('rlvl').textContent = (lvl ? 'Niveau ' + lvl + ' · ' : '') + C.FAMS[C.weaponFam(me.equip)].name;
      setResume(true);
    }
    $('edit').addEventListener('click', () => setResume(false));
    const url = serverUrl(); $('status').textContent = url ? 'Serveur : ' + url.replace(/^wss?:\/\//, '') : 'Mode solo : aucun serveur configuré';
  }
  function refreshLook() { const st = C.START[me.cls] || C.START[0], F = C.FAMS[st[1]]; $('lvc').textContent = F.name; $('clsdesc').textContent = 'Pas de classe : ton arme définit tes attaques. Attaque « ' + F.basic.name + ' », puis ' + F.tech.map(a => a.name).join(', ') + ' en gagnant de la maîtrise. Tu peux changer d\'arme à tout moment.'; LOOK_LABELS.forEach((l, i) => { $('lv' + i).textContent = LOOK_NAMES[i][look[i]]; }); me.set = ARTAPI.charSet(look, me.gear || C.gearStr({ weapon: [st[0], 0], chest: [9, 0] })); }
  function drawPreview() {
    if (!me.set) return; pctx.clearRect(0, 0, preview.width, preview.height);
    const dirs = ['front', 'side', 'back', 'side'], k = Math.floor(time / 1.2) % 4, fr = Math.floor(time * 6) % 4;
    const img = dirs[k] === 'side' ? (k === 3 ? me.set.sideL : me.set.side)[fr] : me.set[dirs[k]][fr];
    pctx.fillStyle = 'rgba(24,16,48,.3)'; pctx.fillRect(20, 59, 24, 4);
    pctx.drawImage(img, 3, 6);
  }
  async function play() {
    if (mode === 'connecting') return;
    me.name = C.cleanName($('name').value); $('name').value = me.name;
    prefs.name = me.name; prefs.cls = me.cls; try { localStorage.setItem('etheria_prefs', JSON.stringify({ name: me.name, look, lvl: prefs.lvl || 0, cls: me.cls })); } catch (e) { /* ignore */ }
    const hello = { name: me.name, look, cls: me.cls, token: token() };
    const url = serverUrl(); mode = 'connecting'; $('play').disabled = true;
    if (url) {
      $('status').textContent = 'Connexion au serveur…';
      try { netMode = 'online'; link = new WsLink(url, onMsg); await link.connect(hello); return; }
      catch (e) { $('status').textContent = 'Serveur injoignable, passage en solo.'; }
    }
    netMode = 'solo'; link = new LocalLink(onMsg); await link.connect(hello);
  }

  /* ---------- boucle ---------- */
  let last = performance.now();
  // qualité adaptative : si le téléphone ne tient pas ~50 images/s, on divise la résolution du monde (pleine → moitié → pixel de jeu)
  let perfN = 0, perfT = 0, perfGrace = 2, showFps = false, fpsN = 0, fpsT = 0, fpsShown = 0;
  function adaptQuality(ms) {
    if (mode !== 'play' || document.hidden || ms > 250) return;
    perfN++; perfT += ms; if (perfT < 2000) return;
    const avg = perfT / perfN; perfN = 0; perfT = 0;
    if (perfGrace > 0) { perfGrace--; return; }
    if (avg > 20 && RQ > 1) { RQ = Math.max(1, Math.floor(RQ / 2)); resize(); perfGrace = 1; }
  }
  function loop(now) {
    adaptQuality(now - last); fpsN++; fpsT += now - last; if (fpsT >= 500) { fpsShown = Math.round(fpsN * 1000 / fpsT); fpsN = 0; fpsT = 0; }
    const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
    update(dt); render(); drawUI(); if (mode !== 'play') drawPreview(); else drawCharPreview();
    requestAnimationFrame(loop);
  }
  /* ---------- sauvegarde dans le compte Claude (survit aux mises à jour du jeu) ---------- */
  const Cloud = {
    ref: null, owner: false, last: '', pending: null, writing: false,
    async init() {
      try {
        if (!window.claude || typeof window.claude.use !== 'function') return false;
        const to = new Promise(r => setTimeout(() => r(null), 6000));
        const [db, user] = await Promise.race([Promise.all([window.claude.use('db'), window.claude.use('user')]), to.then(() => [null, null])]);
        if (!db || !user) return false;
        const id = await Promise.race([user.id(), to]); if (!id) return false;
        this.ref = db.doc('data/users/' + id + '/save'); try { this.owner = !!(await Promise.race([user.isOwner(), to])); } catch (e) { this.owner = false; } return true;
      } catch (e) { return false; }
    },
    async load() {
      if (!this.ref) return null;
      try { const snap = await Promise.race([this.ref.get(), new Promise((_, j) => setTimeout(() => j(new Error('timeout')), 8000))]); return snap.exists ? snap.data() : null; } catch (e) { return null; }
    },
    save(solo) {
      if (!this.ref) return;
      const body = { v: 1, prefs: { name: me.name, look: look.slice(), lvl: prefs.lvl || 0, cls: me.cls | 0 }, solo };
      const j = JSON.stringify(body); if (j === this.last) return;
      this.pending = body; this.flush();
    },
    async flush() {
      if (this.writing || !this.pending) return;
      this.writing = true; const body = this.pending; this.pending = null;
      try { await this.ref.set(Object.assign({ savedAt: Date.now() }, body)); this.last = JSON.stringify(body); } catch (e) { /* hors ligne : on réessaiera à la prochaine sauvegarde */ }
      this.writing = false; if (this.pending) this.flush();
    }
  };
  async function restoreCloud() {
    if (!(await Cloud.init())) return;
    $('loading').textContent = 'Récupération de ta sauvegarde…';
    const c = await Cloud.load(); if (!c || !c.solo) return;
    let localAt = 0; try { localAt = +localStorage.getItem('etheria_saved_at') || 0; } catch (e) { /* ignore */ }
    if ((c.savedAt || 0) < localAt) return; // la copie locale est plus récente
    try { localStorage.setItem('etheria_solo', JSON.stringify(c.solo)); localStorage.setItem('etheria_saved_at', String(c.savedAt || Date.now())); } catch (e) { /* ignore */ }
    if (c.prefs) {
      Object.assign(prefs, c.prefs); me.name = prefs.name || me.name; me.cls = prefs.cls | 0; look.splice(0, look.length, ...C.cleanLook(prefs.look));
      try { localStorage.setItem('etheria_prefs', JSON.stringify(prefs)); } catch (e) { /* ignore */ }
    }
    restoredSolo = c.solo;
    const ci = C.cleanIsle(c.solo.isle); if (ci.k !== ISLE.k || ci.s !== ISLE.s) { try { sessionStorage.setItem('etheria_autoplay', '0'); } catch (e) { /* ignore */ } location.reload(); await new Promise(() => {}); }
  }
  let restoredSolo = null, arrive = null;
  function boot() {
    setTimeout(async () => {
      ART = ARTAPI.buildAll(W); buildScene();
      await restoreCloud();
      buildMenu();
      $('loading').hidden = true; $('menu').hidden = false; mode = 'menu';
      requestAnimationFrame(loop);
      let auto = null; try { auto = sessionStorage.getItem('etheria_autoplay'); sessionStorage.removeItem('etheria_autoplay'); } catch (e) { /* ignore */ }
      if (auto === '1' && prefs.name) {
        let arr = null; try { arr = JSON.parse(sessionStorage.getItem('etheria_arrive') || 'null'); sessionStorage.removeItem('etheria_arrive'); } catch (e) { /* ignore */ }
        if (arr) arrive = { t: 0, name: arr.name, col: arr.col || [120, 80, 200] };
        await play();
        if (arr) setTimeout(() => { if (arr.fresh) sys('Nouvelle île découverte : ' + arr.name + ' !'); if (arr.desc) sys(arr.desc); }, 700);
      }
    }, 30);
  }
  const saveOnLeave = () => { if (link) link.saveNow(); };
  addEventListener('pagehide', saveOnLeave); document.addEventListener('visibilitychange', () => { if (document.hidden) saveOnLeave(); });
  window.__etheria = { get cam() { return [camX, camY, lastOX, lastOY, VW, VH, RQ, lastOX * RQ + SUBX, lastOY * RQ + SUBY]; }, me, mobs, others, get link() { return link; }, get mode() { return mode; }, play, input, W, get ART() { return ART; } };
  boot();
})();
