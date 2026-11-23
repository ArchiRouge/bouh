/* Etheria Online — cœur partagé client / serveur
   Génération déterministe du monde + simulation autoritaire (monstres, combat, progression).
   Utilisé par le serveur Node (require) et par le client en mode solo (window.EtheriaCore). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EtheriaCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = 6;
  const SEED = 20261121;

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hash(x, y, s) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    const t = a + (b - a) * u, bo = c + (d - c) * u; return t + (bo - t) * v;
  }
  function fbm(x, y, s) { return vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15; }

  const MW = 56, MH = 56, CX = 28.5, CY = 28.5;
  const SPAWN = { x: 28.5, y: 31.3 };
  const ZONES = [[9, "Bourg d'Argel"], [15, 'Prairies de Lumen'], [20.5, 'Bois des Champis'], [99, 'Terres sauvages']];
  const MOBDEF = {
    slime: { name: 'Gelée verte', aggr: false },
    champi: { name: 'Champi des bois', aggr: true },
    ember: { name: 'Gelée de braise', aggr: true },
    boss: { name: 'Roi Gelée', aggr: true, boss: true }
  };
  function mobStats(type, lvl) {
    const boss = type === 'boss';
    return {
      maxhp: Math.round((18 + lvl * 14) * (boss ? 9 : 1)), atk: (3 + lvl * 2.4) * (boss ? 1.5 : 1),
      xp: Math.round((5 + lvl * 5) * (boss ? 8 : 1)), speed: boss ? 1.7 : 1.25 + lvl * 0.05,
      aggressive: MOBDEF[type].aggr, range: boss ? 1.6 : 0.95, aggroR: boss ? 4.5 : type === 'champi' ? 2.2 : 3.2, respawn: boss ? 60 : 9
    };
  }
  /* ---------------- objets, caractéristiques & équipement ---------------- */
  const SLOTS = ['head', 'chest', 'legs', 'feet', 'weapon', 'trinket'];
  const SLOT_NAMES = { head: 'Tête', chest: 'Torse', legs: 'Jambes', feet: 'Pieds', weapon: 'Arme', trinket: 'Bijou' };
  const RARITY = [['Commun', '#ece8f4', 1], ['Inhabituel', '#5ee870', 1.3], ['Rare', '#5aa8ff', 1.7], ['Épique', '#c47cff', 2.2], ['Unique', '#ff9a3c', 2.6]];
  const STAT_NAMES = { str: 'Force', sta: 'Endurance', int: 'Intelligence', agi: 'Agilité', armor: 'Armure' };
  const BAG_SIZE = 16;
  const ITEMS = [
    { n: 'Épée rouillée', slot: 'weapon', lvl: 1, icon: 'sword', c: '#b4acbc', st: { str: 2 } },
    { n: 'Bâton de saule', slot: 'weapon', lvl: 2, icon: 'staff', c: '#7ec4ee', st: { int: 3, sta: 1 } },
    { n: 'Lame de saule', slot: 'weapon', lvl: 3, icon: 'sword', c: '#9ad07a', st: { str: 4, agi: 1 } },
    { n: 'Hache de braise', slot: 'weapon', lvl: 6, icon: 'axe', c: '#f08a3a', st: { str: 6, sta: 2 } },
    { n: 'Sceptre de quartz', slot: 'weapon', lvl: 6, icon: 'staff', c: '#f0a0c8', st: { int: 6, sta: 2 } },
    { n: 'Croc du Roi Gelée', slot: 'weapon', lvl: 10, icon: 'sword', c: '#b08ae8', st: { str: 9, agi: 4, sta: 3 } },
    { n: 'Capuche de lin', slot: 'head', lvl: 1, icon: 'hood', c: '#c8b490', st: { sta: 1, int: 1, armor: 2 } },
    { n: 'Casque de saule', slot: 'head', lvl: 4, icon: 'helm', c: '#a07a52', st: { sta: 3, armor: 6 } },
    { n: 'Couronne gélatineuse', slot: 'head', lvl: 10, icon: 'crown', c: '#b08ae8', st: { sta: 5, int: 5, armor: 8 } },
    { n: 'Tunique de lin', slot: 'chest', lvl: 1, icon: 'tunic', c: '#c8b490', st: { sta: 1, armor: 4 } },
    { n: 'Tunique tressée', slot: 'chest', lvl: 4, icon: 'tunic', c: '#6aa070', st: { sta: 4, armor: 10 } },
    { n: 'Plastron de braise', slot: 'chest', lvl: 7, icon: 'plate', c: '#e0703a', st: { sta: 5, str: 2, armor: 16 } },
    { n: 'Braies usées', slot: 'legs', lvl: 1, icon: 'pants', c: '#8a7a6a', st: { armor: 3 } },
    { n: 'Jambières de champi', slot: 'legs', lvl: 4, icon: 'pants', c: '#e08a4a', st: { sta: 2, agi: 2, armor: 6 } },
    { n: 'Sandales', slot: 'feet', lvl: 1, icon: 'boots', c: '#a08060', st: { agi: 1, armor: 1 } },
    { n: 'Bottes de mousse', slot: 'feet', lvl: 3, icon: 'boots', c: '#5a9a6a', st: { agi: 2, armor: 3 } },
    { n: 'Bottes de braise', slot: 'feet', lvl: 7, icon: 'boots', c: '#e0703a', st: { agi: 3, sta: 2, armor: 6 } },
    { n: 'Spore porte-bonheur', slot: 'trinket', lvl: 4, icon: 'spore', c: '#bfe6ff', st: { agi: 3 } },
    { n: 'Talisman de quartz', slot: 'trinket', lvl: 6, icon: 'amulet', c: '#f0a0c8', st: { int: 3, str: 2 } },
    { n: "Éclat d'Éther serti", slot: 'trinket', lvl: 8, icon: 'shard', c: '#a8dcff', st: { int: 4, sta: 3, str: 2 } },
    { n: 'Arc court', slot: 'weapon', lvl: 1, icon: 'bow', c: '#c09a6a', st: { agi: 2 } },
    { n: 'Arc de saule', slot: 'weapon', lvl: 3, icon: 'bow', c: '#9ad07a', st: { agi: 4, str: 1 } },
    { n: 'Arc de braise', slot: 'weapon', lvl: 6, icon: 'bow', c: '#f08a3a', st: { agi: 6, sta: 2 } },
    { n: 'Arc du Roi Gelée', slot: 'weapon', lvl: 10, icon: 'bow', c: '#b08ae8', st: { agi: 9, sta: 3, str: 2 } },
    { n: 'Bottes du Néant', slot: 'feet', lvl: 1, icon: 'boots', c: '#7a5ad0', st: { agi: 3, sta: 2, armor: 3 }, speed: 0.4, fx: 'void', unique: 1, lore: 'Chaque pas creuse un peu de vide dans le monde.' }
  ];
  const LOOT = { slime: { ch: 0.12, items: [0, 1, 6, 9, 12, 14, 20] }, champi: { ch: 0.12, items: [7, 13, 15, 17, 1, 21] }, ember: { ch: 0.14, items: [3, 4, 11, 16, 22] }, boss: { ch: 1, items: [5, 8, 23], minR: 2 } };
  function itemStats(inst) { const T = ITEMS[inst[0]], mul = RARITY[inst[1]][2], o = {}; for (const k in T.st) o[k] = Math.max(1, Math.round(T.st[k] * mul)); return o; }
  const itemValue = inst => Math.round((5 + ITEMS[inst[0]].lvl * 4) * RARITY[inst[1]][2]);
  function rollRarity(min) { const r = Math.random(); const v = r < 0.02 ? 3 : r < 0.12 ? 2 : r < 0.4 ? 1 : 0; return Math.min(3, Math.max(min || 0, v)); }
  const UNIQUE_BOOTS = 24, UNIQUE_CHANCE = { boss: 0.05, ember: 0.002, champi: 0.001, slime: 0.0005 };
  function cleanInst(a) { if (!Array.isArray(a)) return null; const t = a[0] | 0, r = a[1] | 0; if (!(t >= 0 && t < ITEMS.length && r >= 0 && r < RARITY.length)) return null; return [t, ITEMS[t].unique ? 4 : Math.min(r, 3)]; }
  /* ---------------- classes & compétences ---------------- */
  const CLASSES = [
    { id: 'war', name: 'Guerrier', desc: 'Combat au corps à corps, robuste et protecteur.', main: 'str', grow: { str: [3, 1.5], sta: [3, 1.3], int: [2, 0.5], agi: [2, 0.6] },
      basic: { name: 'Frappe', icon: 'slash', range: 1.3, cd: 0.45, mult: 1, fx: 'slash' }, start: 0,
      ab: [
        { name: 'Tourbillon', icon: 'spin', lvl: 2, mp: 15, cd: 3, kind: 'aoeSelf', r: 2.4, mult: 1.5, fx: 'spin', desc: 'Frappe tous les ennemis autour de toi.' },
        { name: 'Charge', icon: 'charge', lvl: 5, mp: 12, cd: 7, kind: 'charge', range: 6, mult: 1.4, stun: 1.5, fx: 'charge', desc: "Fonce sur un ennemi et l'étourdit 1,5 s." },
        { name: 'Cri de guerre', icon: 'shout', lvl: 8, mp: 20, cd: 20, kind: 'buff', dur: 8, fx: 'shout', desc: '+40 % de dégâts et -30 % de dégâts subis pendant 8 s.' }] },
    { id: 'arc', name: 'Archer', desc: 'Attaque à distance, précis et rapide.', main: 'agi', grow: { str: [2, 0.7], sta: [3, 1.0], int: [2, 0.6], agi: [3, 1.5] },
      basic: { name: 'Tir', icon: 'bow', range: 5, cd: 0.6, mult: 0.9, fx: 'arrow' }, start: 20,
      ab: [
        { name: 'Volée', icon: 'volley', lvl: 2, mp: 15, cd: 4, kind: 'aoeTarget', range: 5, r: 2, mult: 1.0, fx: 'volley', desc: 'Une pluie de flèches touche la cible et ses voisins.' },
        { name: 'Flèche perçante', icon: 'pierce', lvl: 5, mp: 14, cd: 6, kind: 'single', range: 5.5, mult: 2.4, slow: 4, fx: 'pierce', desc: 'Gros dégâts et ralentit la cible 4 s.' },
        { name: "Pluie d'Éther", icon: 'rain', lvl: 8, mp: 25, cd: 12, kind: 'aoeTarget', range: 5, r: 3.2, mult: 1.6, fx: 'rain', desc: 'Déluge de flèches lumineuses sur une grande zone.' }] },
    { id: 'mage', name: 'Mage', desc: "Maîtrise l'Éther : dégâts de zone et soins.", main: 'int', grow: { str: [2, 0.4], sta: [3, 0.9], int: [3, 1.6], agi: [2, 0.6] },
      basic: { name: "Trait d'Éther", icon: 'bolt', range: 4.5, cd: 0.7, mult: 1, fx: 'bolt' }, start: 1,
      ab: [
        { name: 'Nova de givre', icon: 'frost', lvl: 2, mp: 18, cd: 6, kind: 'aoeSelf', r: 2.5, mult: 1.1, stun: 2, fx: 'frost', desc: 'Gèle les ennemis proches pendant 2 s.' },
        { name: 'Boule de feu', icon: 'fire', lvl: 5, mp: 16, cd: 4, kind: 'aoeTarget', range: 5, r: 1.3, mult: 2.2, fx: 'fire', desc: 'Explose sur la cible et brûle les ennemis voisins.' },
        { name: 'Soin lumineux', icon: 'heal', lvl: 8, mp: 25, cd: 12, kind: 'heal', fx: 'heal', desc: 'Rend 40 % de tes PV et 25 % aux alliés proches.' }] }
  ];
  function computeStats(lvl, equip, cls) {
    const C0 = CLASSES[cls | 0] || CLASSES[0], g = C0.grow;
    const s = { str: g.str[0] + lvl * g.str[1], sta: g.sta[0] + lvl * g.sta[1], int: g.int[0] + lvl * g.int[1], agi: g.agi[0] + lvl * g.agi[1], armor: 0 };
    for (const sl of SLOTS) { const it = equip && equip[sl]; if (it) { const st = itemStats(it); for (const k in st) s[k] += st[k]; } }
    let speed = 1; for (const sl of SLOTS) { const it = equip && equip[sl]; if (it && ITEMS[it[0]].speed) speed += ITEMS[it[0]].speed; }
    for (const k in s) s[k] = Math.floor(s[k]);
    const atk = C0.main === 'agi' ? 2 + s.agi * 1.6 + s.str * 0.5 : C0.main === 'int' ? 2 + s.int * 1.6 + s.str * 0.3 : 2 + s.str * 1.5;
    return { speed, stats: s, maxhp: Math.round(20 + s.sta * 10), maxmp: Math.round(15 + s.int * 5), atk, crit: Math.min(0.5, 0.06 + s.agi * 0.006), red: s.armor / (s.armor + 60) };
  }
  function playerStats(lvl) { const c = computeStats(lvl, null); return { maxhp: c.maxhp, maxmp: c.maxmp, atk: c.atk }; }
  /* ---------------- cueillette, marche réelle & artisanat ---------------- */
  const STEPS_PER_ETHER = 100, DAILY_STEP_CAP = 12000, DAILY_GIFT = 15, ETHER_MAX = 300, NODE_CD = 90;
  const RES = {
    herb: { name: 'Herbe lumineuse', plural: 'Herbes', req: 1, gxp: 4 },
    wood: { name: "Bois d'Éther", plural: 'Bois', req: 3, gxp: 6 },
    quartz: { name: 'Quartz rose', plural: 'Quartz', req: 5, gxp: 9 }
  };
  const gNeed = l => 10 + l * 8;
  const SCARVES = [['#ee7a86', '#ffc0c0', '#c0506a', 'Corail'], ['#7ec4ee', '#d4f0ff', '#4a86c0', 'Ciel'], ['#b08ae8', '#e8d4ff', '#7650b8', "d'Éther"]];
  const RECIPES = [
    { id: 'potion', npc: 'mira', name: "Potions d'herbes", desc: '+2 potions', req: 1, cost: { herb: 3 }, potions: 2 },
    { id: 'scarf1', npc: 'mira', name: 'Écharpe ciel', desc: 'Nouvelle couleur d\'écharpe', req: 2, cost: { herb: 6 }, scarf: 1 },
    { id: 'blade', npc: 'bran', name: 'Lame de saule', desc: 'Arme inhabituelle (nv3)', req: 3, cost: { wood: 6, herb: 2 }, item: [2, 1] },
    { id: 'armor', npc: 'bran', name: 'Tunique tressée', desc: 'Torse inhabituel (nv4)', req: 4, cost: { wood: 8, quartz: 2 }, item: [10, 1] },
    { id: 'scarf2', npc: 'mira', name: "Écharpe d'Éther", desc: 'Écharpe violette scintillante', req: 5, cost: { quartz: 4, herb: 4 }, scarf: 2 },
    { id: 'charm', npc: 'bran', name: 'Talisman de quartz', desc: 'Bijou rare (nv6)', req: 6, cost: { quartz: 6, wood: 4 }, item: [18, 2] },
    { id: 'bow', npc: 'bran', name: 'Arc de saule', desc: 'Arc inhabituel (nv3)', req: 3, cost: { wood: 6, herb: 2 }, item: [21, 1] }
  ];
  const dayKey = () => new Date().toISOString().slice(0, 10);
  const xpNeed = l => Math.floor(18 * Math.pow(l, 1.6));
  const LOOK_MAX = [3, 7, 7, 3, 4]; // coiffure, couleur cheveux, tenue, peau, chapeau
  /* Apparence de l'équipement (visible en jeu) : tête, torse, jambes, pieds, arme → « t.r » par emplacement, « - » si vide. */
  const GEAR_SLOTS = ['head', 'chest', 'legs', 'feet', 'weapon'];
  function gearStr(equip) { return GEAR_SLOTS.map(sl => { const it = equip && equip[sl]; return it && ITEMS[it[0]] ? it[0] + '.' + it[1] : '-'; }).join(','); }
  function parseGear(str) { const o = {}; String(str || '').split(',').forEach((v, i) => { const m = /^(\d+)\.(\d)$/.exec(v); if (m && GEAR_SLOTS[i] && ITEMS[+m[1]] && ITEMS[+m[1]].slot === GEAR_SLOTS[i]) o[GEAR_SLOTS[i]] = [+m[1], +m[2]]; }); return o; }
  function cleanLook(l) { const a = Array.isArray(l) ? l : []; return LOOK_MAX.map((m, i) => { const v = a[i] | 0; return v >= 0 && v < m ? v : 0; }); }
  function cleanName(n) { const s = String(n || '').replace(/[^A-Za-z0-9_\- àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ]/g, '').trim().slice(0, 12); return s || 'Aventurier'; }
  const BAD = ['merde', 'pute', 'connard', 'connasse', 'encule', 'enculé', 'salope', 'fuck', 'shit', 'bitch', 'nigger', 'nazi'];
  function cleanChat(t) {
    let s = String(t || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80);
    for (const w of BAD) s = s.replace(new RegExp(w, 'gi'), '*'.repeat(w.length));
    return s;
  }

  /* ---------------- histoire & quêtes ---------------- */
  const NPCS = {
    elya: { id: 'elya', name: 'Elya', role: 'Gardienne de la fontaine', x: 27.25, y: 29.75, look: [1, 3, 6, 0, 1], idle: ["Le cristal brillait autrefois au-dessus de la fontaine… J'entends encore son chant.", "Prends soin de toi, voyageur."] },
    mira: { id: 'mira', name: 'Mira', role: 'Herboriste', x: 32.5, y: 27.4, look: [0, 6, 2, 1, 3], idle: ["Ces herbes ? Elles soignent presque tout. Presque.", "Les gelées sentent la menthe, tu savais ?"] },
    bran: { id: 'bran', name: 'Bran', role: 'Forgeron', x: 24.6, y: 25.0, look: [2, 1, 1, 2, 2], idle: ["Une lame bien entretenue, c'est la moitié du combat.", "Mon enclume s'ennuie depuis que les apprentis ont peur du bois."] }
  };
  const QUESTS = [
    { giver: 'elya', reward: [6, 1], title: 'Premiers pas', type: 'kill', mob: 'slime', n: 5, short: 'Gelées vertes', obj: 'Vaincre 5 Gelées vertes dans les Prairies de Lumen', xp: 40, gold: 20, pot: 2,
      intro: "Ah, te voilà enfin réveillé ! La nuit de l'Éclat, le Cristal d'Éther qui veillait sur notre île s'est brisé. Depuis, les gelées pullulent dans les prairies. Montre-moi ce que tu vaux : chasses-en cinq.",
      wait: "Les gelées vertes rôdent juste après le bourg, dans les prairies. Elles ne t'attaqueront pas les premières.",
      done: "Bien joué ! Tu as l'étoffe d'un gardien. Mira l'herboriste, près des maisons à l'est de la fontaine, aura besoin de toi." },
    { giver: 'mira', title: 'Gelée en bocal', type: 'loot', mob: 'slime', item: 'Gelée visqueuse', drop: 0.6, n: 4, short: 'Gelées visqueuses', obj: 'Récupérer 4 Gelées visqueuses sur les Gelées vertes', xp: 55, gold: 25, pot: 2,
      intro: "Bonjour, toi ! Ces gelées ont absorbé un peu de l'Éther du cristal. Avec quatre Gelées visqueuses, je peux préparer des potions pour tout le bourg.",
      wait: "Toutes les gelées n'en lâchent pas. Persévère !",
      done: "Merveilleux, elles brillent encore ! Voilà des potions pour toi. Bran, le forgeron, cherche quelqu'un d'assez courageux pour le Bois des Champis." },
    { giver: 'bran', reward: [13, 1], title: 'Le Bois des Champis', type: 'kill', mob: 'champi', n: 6, short: 'Champis des bois', obj: 'Vaincre 6 Champis des bois au-delà des prairies', xp: 110, gold: 45, pot: 1,
      intro: "Hm. C'est toi, le nouveau ? Depuis l'Éclat, les Champis du bois sont devenus enragés. Ils mordent mes apprentis ! Va en calmer six. Attention : eux, ils attaquent à vue.",
      wait: "Six Champis. Pas cinq, six. Et reviens entier.",
      done: "Pas mal du tout. Mira voudra sûrement voir ce que ces Champis transportent… elle est passée me demander." },
    { giver: 'mira', title: 'Spores lumineuses', type: 'loot', mob: 'champi', item: 'Spore lumineuse', drop: 0.5, n: 5, short: 'Spores lumineuses', obj: 'Récupérer 5 Spores lumineuses sur les Champis des bois', xp: 140, gold: 50, pot: 2,
      intro: "Les Champis brillent la nuit, maintenant. Leurs spores sont imprégnées d'Éther ! Rapporte-m'en cinq, je veux comprendre où va l'énergie du cristal.",
      wait: "Les spores sont fragiles, ramasse-les avec douceur.",
      done: "Elles pointent toutes dans la même direction… vers les Terres sauvages. Elya doit le savoir, mais d'abord, Bran voudra t'y préparer." },
    { giver: 'bran', reward: [16, 2], title: 'Braises errantes', type: 'kill', mob: 'ember', n: 6, short: 'Gelées de braise', obj: 'Vaincre 6 Gelées de braise dans les Terres sauvages', xp: 220, gold: 80, pot: 2,
      intro: "Les Terres sauvages, c'est autre chose. Les Gelées de braise y brûlent tout ce qui bouge. Si tu en abats six, je saurai que tu es prêt pour la suite.",
      wait: "Ne te bats pas seul là-bas si tu peux l'éviter. À plusieurs, on gagne plus d'expérience.",
      done: "Tu reviens avec des cheveux, c'est bon signe ! Va voir Elya, elle a une dernière chose à te demander." },
    { giver: 'elya', title: "Éclats d'Éther", type: 'loot', mob: 'ember', item: "Éclat d'Éther", drop: 0.4, n: 3, short: "Éclats d'Éther", obj: "Récupérer 3 Éclats d'Éther sur les Gelées de braise", xp: 260, gold: 90, pot: 2,
      intro: "Les spores de Mira avaient raison : les éclats du cristal ont été avalés par les Gelées de braise. Rapporte-m'en trois. Si je les réunis, ils nous diront ce qui s'est passé cette nuit-là.",
      wait: "Les éclats sont chauds au toucher. Tu les reconnaîtras.",
      done: "Les éclats murmurent un nom… le Roi Gelée. C'est lui qui a brisé le cristal pour se nourrir de son Éther." },
    { giver: 'elya', reward: [19, 3], title: 'Le Roi Gelée', type: 'kill', mob: 'boss', n: 1, short: 'Roi Gelée', obj: 'Vaincre le Roi Gelée au bout de l\'île (en groupe !)', xp: 600, gold: 250, pot: 5,
      intro: "Il dort au bout de l'île, gorgé d'Éther. Seul, tu n'as aucune chance : rassemble d'autres aventuriers et terrassez-le ensemble. Chaque héros qui le frappe sera récompensé.",
      wait: "Appelle à l'aide dans le tchat. Etheria se défend à plusieurs.",
      done: "Le cristal… il recommence à chanter ! Grâce à toi et à tes compagnons, Etheria respire de nouveau. Merci, gardien. Ce n'est que le début de l'histoire." }
  ];

  /* ---------------- monde ---------------- */
  function buildWorld(seed) {
    const rnd = mulberry32(seed || SEED);
    const N = MW * MH;
    const TY = new Uint8Array(N), HT = new Uint8Array(N), SOL = new Uint8Array(N);
    const idx = (i, j) => j * MW + i, inb = (i, j) => i >= 0 && j >= 0 && i < MW && j < MH;
    const tdist = (i, j) => Math.hypot(i + .5 - CX, j + .5 - CY);
    // types : 0 eau, 1 sable, 2 herbe, 3 pavés, 4 chemin de terre
    const s1 = rnd() * 1000 | 0, s2 = rnd() * 1000 | 0;
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
      const k = idx(i, j), td = tdist(i, j), d = td / (MW / 2);
      let n = 0.6 * fbm(i / 11, j / 11, s1) + 0.4 * fbm(i / 5, j / 5, s2);
      n = n * 0.55 + (1 - d) * 0.72 - 0.03;
      const onAxis = Math.abs(i + .5 - CX) < 1.3 || Math.abs(j + .5 - CY) < 1.3;
      if (td < 9) { HT[k] = 1; TY[k] = (td < 4.6 || onAxis) ? 3 : 2; }
      else if (n < 0.3 || d > 0.97) { TY[k] = 0; HT[k] = 0; }
      else if (n < 0.36) { TY[k] = 1; HT[k] = 0; }
      else { TY[k] = onAxis && td < 15 ? 4 : 2; HT[k] = n < 0.52 ? 1 : n < 0.64 ? 2 : 3; }
    }
    for (let it = 0; it < 8; it++) for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
      const k = idx(i, j); if (!TY[k]) continue; let m = 9;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inb(i + a, j + b)) m = Math.min(m, HT[idx(i + a, j + b)]);
      if (HT[k] > m + 1) HT[k] = m + 1;
    }
    for (let k = 0; k < N; k++) if (TY[k] === 0) SOL[k] = 1;

    const props = [];
    const place = (type, i, j, v, w, h) => {
      w = w || 1; h = h || 1;
      for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) SOL[idx(i + a, j + b)] = 1;
      props.push({ type, i, j, v: v || 0, w, h });
    };
    place('fountain', 28, 28);
    [[22, 22, 0], [33, 22, 1], [22, 33, 2], [33, 33, 3]].forEach(([i, j, v]) => place('house', i, j, v, 2, 2));
    [[26, 26], [31, 26], [26, 31], [31, 31], [28, 21], [21, 28]].forEach(([i, j]) => place('lamp', i, j));
    [[24, 22, 0], [21, 24, 1], [35, 24, 0], [32, 35, 1], [24, 35, 0], [35, 32, 1], [25, 22, 1]].forEach(([i, j, v]) => place(v ? 'crate' : 'barrel', i, j));
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
      const k = idx(i, j); if (TY[k] !== 2 || SOL[k] || tdist(i, j) < 10.5) continue;
      const td = tdist(i, j), r = rnd();
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
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) if (walkable(i, j) && TY[idx(i, j)] === 2 && tdist(i, j) > 10.5) cand.push([i, j]);
    const byDist = cand.slice().sort((a, b) => tdist(b[0], b[1]) - tdist(a[0], a[1]));
    const bossPt = byDist.find(([i, j]) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]].every(([a, b]) => walkable(i + a, j + b))) || byDist[0];
    for (let i = cand.length - 1; i > 0; i--) { const r = Math.floor(rnd() * (i + 1)); [cand[i], cand[r]] = [cand[r], cand[i]]; }
    const spawns = [];
    for (const c of cand) {
      if (Math.hypot(c[0] - bossPt[0], c[1] - bossPt[1]) < 4) continue;
      if (spawns.every(p => Math.hypot(p.i - c[0], p.j - c[1]) > 2.7)) {
        const d = tdist(c[0], c[1]);
        const type = d < 15 ? 'slime' : d < 20.5 ? 'champi' : 'ember';
        const lvl = type === 'slime' ? 1 + Math.floor(rnd() * 2) : type === 'champi' ? 3 + Math.floor(rnd() * 3) : 6 + Math.floor(rnd() * 3);
        spawns.push({ type, lvl, i: c[0], j: c[1] });
      }
      if (spawns.length >= 52) break;
    }
    spawns.push({ type: 'boss', lvl: 12, i: bossPt[0], j: bossPt[1] });
    // points de cueillette (non bloquants)
    const nodes = [], taken = new Set(spawns.map(s => s.i + ',' + s.j));
    const want = { herb: 14, wood: 11, quartz: 9 }, have = { herb: 0, wood: 0, quartz: 0 };
    const pool = cand.slice(); for (let i = pool.length - 1; i > 0; i--) { const r = Math.floor(rnd() * (i + 1)); [pool[i], pool[r]] = [pool[r], pool[i]]; }
    for (const [i, j] of pool) {
      if (taken.has(i + ',' + j)) continue;
      const d = tdist(i, j), res = d < 15 ? 'herb' : d < 20.5 ? 'wood' : 'quartz';
      if (have[res] >= want[res] || nodes.some(n => Math.hypot(n.x - i - .5, n.y - j - .5) < 3)) continue;
      nodes.push({ k: nodes.length, res, x: i + 0.3 + rnd() * 0.4, y: j + 0.3 + rnd() * 0.4 }); have[res]++; taken.add(i + ',' + j);
    }
    const hAt = (x, y) => { const i = Math.floor(x), j = Math.floor(y); return inb(i, j) ? HT[idx(i, j)] : 0; };
    const zoneOf = (x, y) => { const d = Math.hypot(x - CX, y - CY); for (const z of ZONES) if (d < z[0]) return z[1]; };
    return { MW, MH, CX, CY, TY, HT, SOL, props, spawns, nodes, idx, inb, tdist, walkable, hAt, zoneOf };
  }

  function canStand(W, fx, fy, x, y) {
    const r = 0.22;
    for (const [ax, ay] of [[-r, -r], [r, -r], [-r, r], [r, r]]) if (!W.walkable(Math.floor(x + ax), Math.floor(y + ay))) return false;
    return Math.abs(W.hAt(x, y) - W.hAt(fx, fy)) <= 1;
  }
  function moveBy(W, e, dx, dy) {
    let m = false;
    if (dx && canStand(W, e.x, e.y, e.x + dx, e.y)) { e.x += dx; m = true; }
    if (dy && canStand(W, e.x, e.y, e.x, e.y + dy)) { e.y += dy; m = true; }
    return m;
  }

  const clampInt = (v, a, b) => { v = v | 0; return v < a ? a : v > b ? b : v; };
  /* ---------------- simulation ---------------- */
  class Sim {
    constructor(W) {
      this.W = W; this.t = 0; this.players = new Map(); this.events = []; this.bossWarn = 0;
      this.mobs = W.spawns.map((s, k) => Object.assign({
        k, type: s.type, lvl: s.lvl, x: s.i + .5, y: s.j + .5, hx: s.i + .5, hy: s.j + .5, alive: true, respawnT: 0,
        target: null, returning: false, atkCd: 0, wt: Math.random() * 3, wdx: 0, wdy: 0, tagged: new Set(), moving: false
      }, mobStats(s.type, s.lvl)));
      for (const m of this.mobs) m.hp = m.maxhp;
    }
    ev(o) { this.events.push(o); }
    addPlayer(id, name, look, save, cls) {
      const s = save || {};
      const p = {
        id, name: cleanName(name), look: cleanLook(look), x: SPAWN.x + (Math.random() - .5), y: SPAWN.y, face: 0, flip: 0, moving: 0,
        lvl: Math.max(1, s.lvl | 0), xp: Math.max(0, s.xp | 0), gold: Math.max(0, s.gold | 0), potions: s.potions == null ? 3 : Math.max(0, s.potions | 0),
        dead: false, deadT: 0, atkCd: 0, skillCd: 0, potCd: 0, lastHit: 99, lastMv: this.t, chatT: 0,
        q: clampInt(s.q, 0, QUESTS.length), qs: clampInt(s.qs, 0, 2), qn: clampInt(s.qn, 0, 99)
      };
      const inv = s.inv || {}; p.inv = { herb: clampInt(inv.herb, 0, 9999), wood: clampInt(inv.wood, 0, 9999), quartz: clampInt(inv.quartz, 0, 9999) };
      p.equip = {}; p.bag = [];
      if (s.equip) { for (const sl of SLOTS) { const it = cleanInst(s.equip[sl]); p.equip[sl] = it && ITEMS[it[0]].slot === sl ? it : null; } }
      p.gifts = clampInt(s.gifts, 0, 1 << 20); p.cls = clampInt(cls == null ? s.cls : cls, 0, CLASSES.length - 1); p.abCd = [0, 0, 0]; p.buffT = 0;
      if (!s.equip) { p.equip.weapon = [CLASSES[p.cls].start, 0]; p.equip.chest = [9, 0]; }
      for (const a of (s.bag || []).slice(0, BAG_SIZE)) { const it = cleanInst(a); if (it) p.bag.push(it); }
      const gr = s.gear || {}; if (gr.blade) p.bag.push([2, 1]); if (gr.armor) p.bag.push([10, 1]); if (gr.charm) p.bag.push([18, 2]);
      p.ether = clampInt(s.ether == null ? DAILY_GIFT : s.ether, 0, ETHER_MAX); p.glvl = clampInt(s.glvl || 1, 1, 50); p.gxp = clampInt(s.gxp, 0, 99999);
      p.scarves = clampInt(s.scarves == null ? 1 : s.scarves, 1, 7) | 1; p.scarf = clampInt(s.scarf, 0, 2); if (!(p.scarves & (1 << p.scarf))) p.scarf = 0;
      p.day = s.day || ''; p.stepsToday = clampInt(s.stepsToday, 0, DAILY_STEP_CAP); p.gcd = {};
      this.newDay(p);
      this.recalc(p, true); p.lookStr = p.look.join('');
      this.players.set(id, p);
      this.ev({ e: 'ch', s: 1, t: p.name + ' a rejoint Etheria.' });
      return p;
    }
    removePlayer(id) {
      const p = this.players.get(id); if (!p) return;
      this.players.delete(id);
      for (const m of this.mobs) { m.tagged.delete(id); if (m.target === id) { m.target = null; m.returning = true; } }
      this.ev({ e: 'ch', s: 1, t: p.name + ' est parti.' });
    }
    /* Format de sauvegarde : ne JAMAIS renommer ni retirer un champ (les héros existants doivent survivre aux mises à jour).
       Ajouter un champ = lui donner une valeur par défaut dans addPlayer. */
    saveData(p) { return { gifts: p.gifts, cls: p.cls, lvl: p.lvl, xp: p.xp, gold: p.gold, potions: p.potions, q: p.q, qs: p.qs, qn: p.qn, inv: p.inv, equip: p.equip, bag: p.bag, ether: p.ether, glvl: p.glvl, gxp: p.gxp, scarves: p.scarves, scarf: p.scarf, day: p.day, stepsToday: p.stepsToday }; }
    grantFounder(p) {
      if (p.gifts & 1) return false;
      const wpn = [[5, 3], [23, 3], [4, 3]];
      p.equip = { head: [8, 3], chest: [11, 3], legs: [13, 3], feet: [UNIQUE_BOOTS, 4], weapon: wpn[p.cls], trinket: [19, 3] };
      for (let c = 0; c < 3; c++) if (c !== p.cls && p.bag.length < BAG_SIZE) p.bag.push(wpn[c].slice());
      p.gifts |= 1; this.recalc(p, true);
      this.ev({ e: 'founder', id: p.id });
      return true;
    }
    buffMul(p) { return p.buffT > this.t ? 1.4 : 1; }
    recalc(p, full) {
      const fh = p.maxhp ? p.hp / p.maxhp : 1, fm = p.maxmp ? p.mp / p.maxmp : 1;
      Object.assign(p, computeStats(p.lvl, p.equip, p.cls));
      p.hp = full ? p.maxhp : Math.max(1, Math.min(p.maxhp, Math.round(p.maxhp * fh))); p.mp = full ? p.maxmp : Math.min(p.maxmp, Math.round(p.maxmp * fm));
    }
    giveItem(p, inst, m) {
      inst = cleanInst(inst); if (!inst) return;
      if (p.bag.length >= BAG_SIZE) { const v = itemValue(inst); p.gold += v; this.ev({ e: 'it', id: p.id, t: inst[0], r: inst[1], m: m == null ? -1 : m, sold: v }); return; }
      p.bag.push(inst); this.ev({ e: 'it', id: p.id, t: inst[0], r: inst[1], m: m == null ? -1 : m });
    }
    newDay(p) { const d = dayKey(); if (p.day !== d) { p.day = d; p.stepsToday = 0; p.ether = Math.min(ETHER_MAX, p.ether + DAILY_GIFT); return true; } return false; }
    handle(id, m) {
      const p = this.players.get(id); if (!p || !m || typeof m !== 'object') return;
      const W = this.W;
      switch (m.t) {
        case 'mv': {
          if (p.dead) return;
          const x = +m.x, y = +m.y; if (!isFinite(x) || !isFinite(y)) return;
          const allowed = 3.6 * (p.speed || 1) * (this.t - p.lastMv) + 0.7;
          if (Math.hypot(x - p.x, y - p.y) > allowed || !W.walkable(Math.floor(x), Math.floor(y))) { this.ev({ e: 'tp', id, x: p.x, y: p.y }); p.lastMv = this.t; return; }
          p.x = x; p.y = y; p.face = (m.f | 0) % 3; p.flip = m.fl ? 1 : 0; p.moving = m.mv ? 1 : 0; p.lastMv = this.t;
          break;
        }
        case 'atk': {
          const mob = this.mobs[m.m | 0], B = CLASSES[p.cls].basic;
          if (p.dead || !mob || !mob.alive || p.atkCd > 0) return;
          if (Math.hypot(mob.x - p.x, mob.y - p.y) > B.range + (mob.type === 'boss' ? 1.1 : 0.6)) return;
          p.atkCd = B.cd - 0.05;
          let dmg = p.atk * B.mult * (0.85 + Math.random() * 0.3) * this.buffMul(p); const crit = Math.random() < p.crit; if (crit) dmg *= 1.8;
          this.ev({ e: 'sw', id, m: mob.k, c: p.cls });
          this.hitMob(mob, Math.round(dmg), p, crit);
          break;
        }
        case 'ab': {
          const i = m.a | 0, A = CLASSES[p.cls].ab[i];
          if (!A || p.dead || p.lvl < A.lvl || p.abCd[i] > this.t || p.mp < A.mp) return;
          let tgt = null;
          if (A.kind === 'aoeTarget' || A.kind === 'single' || A.kind === 'charge') {
            tgt = this.mobs[m.m | 0];
            if (!tgt || !tgt.alive || Math.hypot(tgt.x - p.x, tgt.y - p.y) > A.range + 0.8) return;
          }
          p.mp -= A.mp; p.abCd[i] = this.t + A.cd - 0.1;
          const roll = () => (0.9 + Math.random() * 0.2) * this.buffMul(p);
          const around = (cx, cy, r) => this.mobs.filter(o => o.alive && Math.hypot(o.x - cx, o.y - cy) <= r);
          if (A.kind === 'aoeSelf') for (const o of around(p.x, p.y, A.r)) { this.hitMob(o, Math.round(p.atk * A.mult * roll()), p, false); if (A.stun && o.alive) o.stunT = this.t + A.stun; }
          else if (A.kind === 'aoeTarget') for (const o of around(tgt.x, tgt.y, A.r)) this.hitMob(o, Math.round(p.atk * A.mult * roll()), p, false);
          else if (A.kind === 'single') { this.hitMob(tgt, Math.round(p.atk * A.mult * roll()), p, Math.random() < p.crit); if (A.slow && tgt.alive) tgt.slowT = this.t + A.slow; }
          else if (A.kind === 'charge') {
            const d = Math.hypot(tgt.x - p.x, tgt.y - p.y) || 1, nx = tgt.x - (tgt.x - p.x) / d * 0.8, ny = tgt.y - (tgt.y - p.y) / d * 0.8;
            if (this.W.walkable(Math.floor(nx), Math.floor(ny))) { p.x = nx; p.y = ny; p.lastMv = this.t; this.ev({ e: 'tp', id, x: p.x, y: p.y, dash: 1 }); }
            this.hitMob(tgt, Math.round(p.atk * A.mult * roll()), p, false); if (tgt.alive) tgt.stunT = this.t + A.stun;
          }
          else if (A.kind === 'buff') p.buffT = this.t + A.dur;
          else if (A.kind === 'heal') {
            const h = Math.round(p.maxhp * 0.4); p.hp = Math.min(p.maxhp, p.hp + h); this.ev({ e: 'heal', id, v: h });
            for (const o of this.players.values()) if (o !== p && !o.dead && Math.hypot(o.x - p.x, o.y - p.y) <= 4) { const h2 = Math.round(o.maxhp * 0.25); o.hp = Math.min(o.maxhp, o.hp + h2); this.ev({ e: 'heal', id: o.id, v: h2, by: id }); }
          }
          this.ev({ e: 'ab', id, c: p.cls, a: i, m: tgt ? tgt.k : -1 });
          break;
        }
        case 'pot': {
          if (p.dead || p.potCd > 0 || p.potions <= 0 || p.hp >= p.maxhp) return;
          const h = Math.round(p.maxhp * 0.5); p.hp = Math.min(p.maxhp, p.hp + h); p.potions--; p.potCd = 0.9;
          this.ev({ e: 'po', id, v: h });
          break;
        }
        case 'steps': {
          if (this.newDay(p)) this.ev({ e: 'gift', id, v: DAILY_GIFT });
          const n = clampInt(m.n, 0, 50000), before = p.stepsToday, after = Math.min(DAILY_STEP_CAP, before + n);
          const gain = Math.floor(after / STEPS_PER_ETHER) - Math.floor(before / STEPS_PER_ETHER);
          p.stepsToday = after; p.ether = Math.min(ETHER_MAX, p.ether + gain);
          this.ev({ e: 'st', id, n: after - before, v: gain, capped: before + n > DAILY_STEP_CAP ? 1 : 0 });
          break;
        }
        case 'gather': {
          const node = this.W.nodes[m.k | 0]; if (!node || p.dead) return;
          const R0 = RES[node.res];
          if (Math.hypot(p.x - node.x, p.y - node.y) > 1.7 || p.glvl < R0.req || p.ether < 1 || (p.gcd[node.k] || 0) > this.t) return;
          p.ether -= 1; p.gcd[node.k] = this.t + NODE_CD;
          const n = 1 + (Math.random() < Math.min(0.5, (p.glvl - R0.req) * 0.08) ? 1 : 0);
          p.inv[node.res] += n; p.gxp += R0.gxp;
          this.ev({ e: 'ga', id, k: node.k, res: node.res, n, g: R0.gxp });
          while (p.gxp >= gNeed(p.glvl)) { p.gxp -= gNeed(p.glvl); p.glvl++; this.ev({ e: 'gl', id, lv: p.glvl }); }
          break;
        }
        case 'craft': {
          const r = RECIPES[m.r | 0]; if (!r || p.dead) return;
          const npc = NPCS[r.npc]; if (Math.hypot(p.x - npc.x, p.y - npc.y) > 2.8 || p.glvl < r.req) return;
          if (r.scarf && (p.scarves & (1 << r.scarf))) return;
          if (r.item && p.bag.length >= BAG_SIZE) { this.ev({ e: 'msg', id, t: 'Ton sac est plein.' }); return; }
          for (const k in r.cost) if ((p.inv[k] || 0) < r.cost[k]) return;
          for (const k in r.cost) p.inv[k] -= r.cost[k];
          if (r.potions) p.potions += r.potions;
          if (r.scarf) { p.scarves |= 1 << r.scarf; p.scarf = r.scarf; }
          if (r.item) this.giveItem(p, r.item.slice());
          this.ev({ e: 'cr', id, r: m.r | 0 });
          break;
        }
        case 'equip': {
          const b = m.b | 0, inst = p.bag[b]; if (!inst || p.dead) return;
          const T = ITEMS[inst[0]]; if (p.lvl < T.lvl) { this.ev({ e: 'msg', id, t: 'Niveau ' + T.lvl + ' requis pour ' + T.n + '.' }); return; }
          const old = p.equip[T.slot]; p.equip[T.slot] = inst; if (old) p.bag[b] = old; else p.bag.splice(b, 1);
          this.recalc(p); this.ev({ e: 'eq', id, t: inst[0], r: inst[1] }); break;
        }
        case 'unequip': {
          const sl = String(m.s); if (!SLOTS.includes(sl) || !p.equip[sl] || p.dead) return;
          if (p.bag.length >= BAG_SIZE) { this.ev({ e: 'msg', id, t: 'Ton sac est plein.' }); return; }
          p.bag.push(p.equip[sl]); p.equip[sl] = null; this.recalc(p); break;
        }
        case 'sell': {
          const b = m.b | 0, inst = p.bag[b]; if (!inst) return;
          const v = itemValue(inst); p.gold += v; p.bag.splice(b, 1); this.ev({ e: 'sold', id, t: inst[0], r: inst[1], v }); break;
        }
        case 'scarf': { const sc = clampInt(m.s, 0, 2); if (p.scarves & (1 << sc)) p.scarf = sc; break; }
        case 'talk': {
          const npc = NPCS[m.npc]; if (!npc || p.dead) return;
          if (Math.hypot(p.x - npc.x, p.y - npc.y) > 2.8) return;
          const Q = QUESTS[p.q]; if (!Q || Q.giver !== npc.id) return;
          if (p.qs === 0) { p.qs = 1; p.qn = 0; this.ev({ e: 'qa', id, q: p.q }); }
          else if (p.qs === 2) {
            p.gold += Q.gold; p.potions += Q.pot || 0; if (Q.reward) this.giveItem(p, Q.reward.slice());
            this.ev({ e: 'qr', id, q: p.q, xp: Q.xp, g: Q.gold, pot: Q.pot || 0 });
            const done = p.q; p.q++; p.qs = 0; p.qn = 0;
            this.gainXP(p, Q.xp);
            if (done === QUESTS.length - 1) this.ev({ e: 'ch', s: 1, t: p.name + ' a terminé le chapitre 1 : le cristal chante à nouveau !' });
          }
          break;
        }
        case 'chat': {
          if (this.t - p.chatT < 1) return; p.chatT = this.t;
          const t = cleanChat(m.text); if (t) this.ev({ e: 'ch', id, n: p.name, t });
          break;
        }
      }
    }
    hitMob(m, dmg, p, crit) {
      m.hp -= dmg; m.tagged.add(p.id);
      if (m.target == null) { m.target = p.id; m.returning = false; }
      const d = Math.hypot(m.x - p.x, m.y - p.y) || 1; moveBy(this.W, m, (m.x - p.x) / d * 0.12, (m.y - p.y) / d * 0.12);
      this.ev({ e: 'hm', m: m.k, v: dmg, c: crit ? 1 : 0, by: p.id });
      if (m.hp <= 0) this.killMob(m);
    }
    killMob(m) {
      m.alive = false; m.respawnT = m.respawn; m.target = null; m.returning = false;
      this.ev({ e: 'km', m: m.k });
      const group = [...m.tagged].map(id => this.players.get(id)).filter(Boolean);
      const bonus = group.length > 1 ? 1.25 : 1;
      for (const p of group) {
        const xp = Math.round(m.xp * bonus), gold = Math.round(m.lvl * 3 * (0.7 + Math.random() * 0.6));
        const pot = Math.random() < (m.type === 'boss' ? 1 : 0.18) ? 1 : 0;
        if (Math.random() < (UNIQUE_CHANCE[m.type] || 0)) { this.giveItem(p, [UNIQUE_BOOTS, 4], m.k); this.ev({ e: 'ch', s: 1, t: p.name + ' a trouvé les Bottes du Néant (Unique) !' }); }
        const LT = LOOT[m.type]; if (LT && Math.random() < LT.ch) this.giveItem(p, [LT.items[Math.floor(Math.random() * LT.items.length)], rollRarity(LT.minR)], m.k);
        p.gold += gold; p.potions += pot;
        this.ev({ e: 'lt', id: p.id, m: m.k, xp, g: gold, pot, grp: group.length > 1 ? 1 : 0 });
        this.gainXP(p, xp);
        this.questProgress(p, m);
      }
      if (m.type === 'boss' && group.length) this.ev({ e: 'ch', s: 1, t: 'Le Roi Gelée est tombé ! Bravo ' + group.map(p => p.name).join(', ') + ' !' });
      m.tagged.clear();
    }
    questProgress(p, m) {
      const Q = QUESTS[p.q];
      if (!Q || p.qs !== 1 || Q.mob !== m.type) return;
      if (Q.type === 'loot' && Math.random() >= Q.drop) return;
      p.qn = Math.min(Q.n, p.qn + 1);
      this.ev({ e: 'qp', id: p.id, q: p.q, n: p.qn, m: m.k, item: Q.type === 'loot' ? 1 : 0 });
      if (p.qn >= Q.n) { p.qs = 2; this.ev({ e: 'qc', id: p.id, q: p.q }); }
    }
    gainXP(p, v) {
      p.xp += v;
      while (p.xp >= xpNeed(p.lvl)) {
        p.xp -= xpNeed(p.lvl); p.lvl++; this.recalc(p, true);
        this.ev({ e: 'lv', id: p.id, lv: p.lvl });
      }
    }
    hurt(p, dmg, m) {
      if (p.dead) return;
      dmg = Math.max(1, Math.round(dmg * (0.85 + Math.random() * 0.3) * (1 - (p.red || 0)) * (p.buffT > this.t ? 0.7 : 1)));
      p.hp -= dmg; p.lastHit = 0;
      this.ev({ e: 'hp', id: p.id, v: dmg, m: m.k });
      if (p.hp <= 0) {
        p.hp = 0; p.dead = true; p.deadT = 5; p.moving = 0;
        const loss = Math.floor(p.xp * 0.1); p.xp -= loss;
        this.ev({ e: 'die', id: p.id, loss });
        for (const mm of this.mobs) if (mm.target === p.id) { mm.target = null; mm.returning = true; }
      }
    }
    step(dt) {
      this.t += dt; const W = this.W;
      for (const p of this.players.values()) {
        p.atkCd -= dt; p.skillCd -= dt; p.potCd -= dt; p.lastHit += dt;
        if (p.dead) {
          p.deadT -= dt;
          if (p.deadT <= 0) { p.dead = false; p.x = SPAWN.x; p.y = SPAWN.y; p.hp = p.maxhp; p.mp = p.maxmp; p.lastMv = this.t; this.ev({ e: 'rs', id: p.id }); this.ev({ e: 'tp', id: p.id, x: p.x, y: p.y }); }
          continue;
        }
        if (p.lastHit > 4) p.hp = Math.min(p.maxhp, p.hp + p.maxhp * 0.03 * dt);
        p.mp = Math.min(p.maxmp, p.mp + p.maxmp * 0.04 * dt);
        if (this.t - p.lastMv > 0.5) p.moving = 0;
      }
      for (const m of this.mobs) {
        if (!m.alive) {
          m.respawnT -= dt;
          if (m.respawnT <= 0) {
            let near = false; for (const p of this.players.values()) if (Math.hypot(p.x - m.hx, p.y - m.hy) < 5) near = true;
            if (near) m.respawnT = 1;
            else { m.alive = true; m.x = m.hx; m.y = m.hy; m.hp = m.maxhp; m.target = null; m.returning = false; this.ev({ e: 'mr', m: m.k }); }
          }
          continue;
        }
        m.atkCd -= dt; m.moving = false;
        if (m.stunT > this.t) continue;
        const slow = m.slowT > this.t ? 0.5 : 1;
        let tp = m.target != null ? this.players.get(m.target) : null;
        if (m.target != null && (!tp || tp.dead)) { tp = null; m.target = null; m.returning = true; }
        if (!tp && !m.returning && m.aggressive) {
          let best = null, bd = m.aggroR;
          for (const p of this.players.values()) { if (p.dead) continue; const d = Math.hypot(p.x - m.x, p.y - m.y); if (d < bd) { bd = d; best = p; } }
          if (best) { tp = best; m.target = best.id; if (m.type === 'boss' && this.t - this.bossWarn > 30) { this.bossWarn = this.t; this.ev({ e: 'ch', s: 1, t: 'Le Roi Gelée se réveille ! Appelez du renfort !' }); } }
        }
        const dh = Math.hypot(m.x - m.hx, m.y - m.hy);
        if (tp && (dh > 10 || Math.hypot(tp.x - m.x, tp.y - m.y) > 9)) { tp = null; m.target = null; m.returning = true; m.tagged.clear(); }
        const step = (tx, ty, spd) => { const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy); if (d < 0.01) return; const s = Math.min(d, spd * slow * dt); moveBy(W, m, dx / d * s, dy / d * s); m.moving = true; };
        if (m.returning) { step(m.hx, m.hy, m.speed * 1.6); m.hp = Math.min(m.maxhp, m.hp + m.maxhp * 0.6 * dt); if (dh < 0.4) m.returning = false; }
        else if (tp) {
          const d = Math.hypot(tp.x - m.x, tp.y - m.y);
          if (d > m.range) step(tp.x, tp.y, m.speed);
          else if (m.atkCd <= 0) { m.atkCd = m.type === 'boss' ? 1.6 : 1.3; this.hurt(tp, m.atk, m); }
        } else {
          m.wt -= dt;
          if (m.wt <= 0) { if (Math.random() < 0.5) { m.wdx = m.wdy = 0; } else { const a = Math.random() * Math.PI * 2; m.wdx = Math.cos(a); m.wdy = Math.sin(a); } m.wt = 1 + Math.random() * 2.5; }
          if (m.wdx || m.wdy) { if (dh > 3) { m.wdx = (m.hx - m.x) / dh; m.wdy = (m.hy - m.y) / dh; } moveBy(W, m, m.wdx * 0.6 * dt, m.wdy * 0.6 * dt); m.moving = true; }
        }
      }
    }
    publicState() {
      const p = [], m = [];
      for (const q of this.players.values()) p.push([q.id, q.name, q.lookStr, +q.x.toFixed(2), +q.y.toFixed(2), q.face, q.flip, q.moving, Math.ceil(q.hp), q.maxhp, q.lvl, q.dead ? 1 : 0, q.scarf, q.cls, q.equip && q.equip.feet && ITEMS[q.equip.feet[0]].fx === 'void' ? 1 : 0, gearStr(q.equip)]);
      for (const q of this.mobs) m.push([+q.x.toFixed(2), +q.y.toFixed(2), Math.max(0, Math.ceil(q.hp)), q.alive ? 1 : 0, q.target != null ? 1 : 0, q.moving ? 1 : 0, q.stunT > this.t ? 1 : q.slowT > this.t ? 2 : 0]);
      return { p, m };
    }
    meState(id) {
      const p = this.players.get(id); if (!p) return null;
      return { hp: Math.ceil(p.hp), maxhp: p.maxhp, mp: Math.floor(p.mp), maxmp: p.maxmp, lvl: p.lvl, xp: p.xp, need: xpNeed(p.lvl), gold: p.gold, potions: p.potions, dead: p.dead ? 1 : 0, deadT: Math.ceil(p.deadT), speed: p.speed, cls: p.cls, abCd: p.abCd.map(t => Math.max(0, +(t - this.t).toFixed(1))), buff: Math.max(0, +(p.buffT - this.t).toFixed(1)), q: p.q, qs: p.qs, qn: p.qn, inv: p.inv, equip: p.equip, bag: p.bag, stats: p.stats, crit: p.crit, red: p.red, ether: p.ether, glvl: p.glvl, gxp: p.gxp, gneed: gNeed(p.glvl), scarves: p.scarves, scarf: p.scarf, stepsToday: p.stepsToday, atk: p.atk };
    }
  }

  return { CLASSES, SLOTS, SLOT_NAMES, RARITY, STAT_NAMES, ITEMS, BAG_SIZE, itemStats, itemValue, computeStats, RES, RECIPES, SCARVES, STEPS_PER_ETHER, DAILY_STEP_CAP, DAILY_GIFT, NODE_CD, gNeed, NPCS, QUESTS, VERSION, SEED, MW, MH, CX, CY, SPAWN, ZONES, MOBDEF, LOOK_MAX, mobStats, playerStats, xpNeed, buildWorld, canStand, moveBy, Sim, hash, vnoise, fbm, mulberry32, cleanName, cleanLook, GEAR_SLOTS, gearStr, parseGear };
});
