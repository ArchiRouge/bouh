/* Pixels Worlds — cœur partagé client / serveur
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
  /* Éléments des monstres : chacun a un trait en combat.
     Feu : ses coups brûlent · Eau : ses coups ralentissent · Bois : se régénère · Lumière : encaisse 20 % de moins · Ténèbres : draine la vie */
  const ELEMENTS = { fire: ['Feu', '#ff8a4a'], ice: ['Eau', '#7ab4ff'], wood: ['Bois', '#7ad070'], light: ['Lumière', '#fff0a0'], dark: ['Ténèbres', '#b88ae8'] };
  // hp / atk / spd : multiplicateurs ; sc : taille d'affichage
  const MOBDEF = {
    slime: { name: 'Gelée verte', aggr: false, el: 'wood' },
    champi: { name: 'Champi des bois', aggr: true, el: 'wood' },
    ember: { name: 'Gelée de braise', aggr: true, el: 'fire' },
    frost: { name: 'Gelée de givre', aggr: false, el: 'ice' },
    boss: { name: 'Roi Gelée', aggr: true, boss: true, el: 'dark' },
    lapin: { name: 'Lapin des prés', aggr: false, el: 'wood', hp: 0.8, spd: 1.3 },
    abeille: { name: 'Abeille dorée', aggr: true, el: 'light', hp: 0.6, atk: 0.9, spd: 1.2 },
    loup: { name: 'Loup des brumes', aggr: true, el: 'dark', hp: 1.1, atk: 1.25, spd: 1.35 },
    chauvesouris: { name: 'Chauve-souris', aggr: true, el: 'dark', hp: 0.7, atk: 0.9, spd: 1.4 },
    souche: { name: 'Souche grincheuse', aggr: false, el: 'wood', hp: 1.8, atk: 1.1, spd: 0.7 },
    salamandre: { name: 'Salamandre', aggr: true, el: 'fire', hp: 1, atk: 1.15, spd: 1.2 },
    golem: { name: 'Golem de cristal', aggr: false, el: 'light', hp: 2.4, atk: 1.4, spd: 0.6, sc: 1.2 },
    follet: { name: 'Feu follet', aggr: true, el: 'light', hp: 0.7, atk: 1.1, spd: 1.3 },
    spectre: { name: 'Spectre', aggr: true, el: 'dark', hp: 1.2, atk: 1.3, spd: 1.1 },
    pingouin: { name: 'Pingouin-boule', aggr: false, el: 'ice', hp: 1.1, spd: 0.9 },
    loupneige: { name: 'Loup des neiges', aggr: true, el: 'ice', hp: 1.2, atk: 1.25, spd: 1.35 },
    esprit: { name: 'Esprit de givre', aggr: true, el: 'ice', hp: 0.9, atk: 1.2, spd: 1.1 },
    magma: { name: 'Golem de magma', aggr: true, el: 'fire', hp: 2.2, atk: 1.5, spd: 0.65, sc: 1.2 },
    cendre: { name: 'Chauve-souris de cendre', aggr: true, el: 'fire', hp: 0.8, atk: 1, spd: 1.45 }
  };
  // difficulté relevée : PV ×1,7 et attaque ×1,5 par rapport aux débuts du jeu (un héros bien équipé reste à l'aise)
  function mobStats(type, lvl) {
    const D = MOBDEF[type], boss = type === 'boss';
    return {
      maxhp: Math.round((18 + lvl * 14) * 1.7 * (boss ? 9 : D.hp || 1)), atk: (3 + lvl * 2.4) * 1.5 * (boss ? 1.5 : D.atk || 1),
      xp: Math.round((5 + lvl * 5) * (boss ? 8 : 1) * (0.8 + 0.2 * (D.hp || 1))), speed: boss ? 1.7 : (1.25 + lvl * 0.05) * (D.spd || 1),
      aggressive: D.aggr, range: boss ? 1.6 : (D.sc ? 1.15 : 0.95), aggroR: boss ? 4.5 : type === 'champi' ? 2.2 : 3.4, respawn: boss ? 60 : 9
    };
  }
  /* ---------------- objets, caractéristiques & équipement ---------------- */
  const SLOTS = ['head', 'chest', 'legs', 'feet', 'weapon', 'trinket', 'offhand'];
  const SLOT_NAMES = { head: 'Tête', chest: 'Torse', legs: 'Jambes', feet: 'Pieds', weapon: 'Arme', trinket: 'Bijou', offhand: 'Main gauche' };
  const RARITY = [['Commun', '#ece8f4', 1], ['Inhabituel', '#5ee870', 1.3], ['Rare', '#5aa8ff', 1.7], ['Épique', '#c47cff', 2.2], ['Unique', '#ff9a3c', 2.6]];
  const STAT_NAMES = { str: 'Force', sta: 'Endurance', int: 'Intelligence', agi: 'Agilité', armor: 'Armure' };
  const BAG_SIZE = 24;
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
    { n: 'Bottes du Néant', slot: 'feet', lvl: 1, icon: 'boots', c: '#7a5ad0', st: { agi: 3, sta: 2, armor: 3 }, speed: 0.4, fx: 'void', unique: 1, lore: 'Chaque pas creuse un peu de vide dans le monde.' },
    // (ne jamais réordonner : les sauvegardes stockent l'indice des objets)
    { n: 'Bouclier de bois', slot: 'offhand', lvl: 1, icon: 'shield', c: '#a07a52', st: { armor: 4, sta: 1 } },
    { n: 'Écu de braise', slot: 'offhand', lvl: 6, icon: 'shield', c: '#e0703a', st: { armor: 9, sta: 3 } },
    { n: 'Pavois du Roi Gelée', slot: 'offhand', lvl: 10, icon: 'shield', c: '#b08ae8', st: { armor: 14, sta: 5, str: 2 } },
    { n: 'Dague ébréchée', slot: 'weapon', lvl: 1, icon: 'dagger', c: '#b4acbc', st: { agi: 2 } },
    { n: 'Dagues de champi', slot: 'weapon', lvl: 4, icon: 'dagger', c: '#e08a4a', st: { agi: 5, str: 1 } },
    { n: 'Lance de frêne', slot: 'weapon', lvl: 1, icon: 'spear', c: '#c09a6a', st: { str: 2, agi: 1 } },
    { n: 'Pique de braise', slot: 'weapon', lvl: 6, icon: 'spear', c: '#f08a3a', st: { str: 6, agi: 2 } },
    { n: 'Espadon rouillé', slot: 'weapon', lvl: 1, icon: 'great', c: '#b4acbc', st: { str: 3 } },
    // ensemble du Maître du jeu : unique, jamais dans le butin, ni vendable
    { n: 'Diadème du Maître du jeu', slot: 'head', lvl: 1, icon: 'gmhelm', c: '#f0c040', st: { sta: 6, int: 6, armor: 12 }, fx: 'gm', unique: 1, lore: "Forgé pour le maître du jeu. Il n'en existe qu'un." },
    { n: 'Armure du Maître du jeu', slot: 'chest', lvl: 1, icon: 'plate', c: '#f0c040', st: { sta: 9, str: 5, armor: 24 }, fx: 'gm', unique: 1, lore: "L'or garde la mémoire de chaque monde créé." },
    { n: 'Jambières du Maître du jeu', slot: 'legs', lvl: 1, icon: 'pants', c: '#f0c040', st: { sta: 4, agi: 3, armor: 10 }, fx: 'gm', unique: 1 },
    { n: 'Solerets du Maître du jeu', slot: 'feet', lvl: 1, icon: 'boots', c: '#f0c040', st: { agi: 4, armor: 8 }, speed: 0.4, fx: 'gm', unique: 1 },
    { n: 'Lame du Maître du jeu', slot: 'weapon', lvl: 1, icon: 'sword', c: '#f0c040', st: { str: 11, agi: 5, sta: 4 }, fx: 'gm', unique: 1 },
    { n: 'Égide du Maître du jeu', slot: 'offhand', lvl: 1, icon: 'shield', c: '#f0c040', st: { armor: 16, sta: 6, str: 2 }, fx: 'gm', unique: 1 },
    { n: 'Grimoire du Maître du jeu', slot: 'weapon', lvl: 1, icon: 'tome', c: '#f0c040', st: { int: 12, sta: 4, agi: 3 }, fx: 'gm', unique: 1, lore: "Le livre où le monde a été écrit ; l'orbe obéit à sa voix." },
    { n: "Grimoire d'apprenti", slot: 'weapon', lvl: 2, icon: 'tome', c: '#6a4ab0', st: { int: 4, sta: 1 } },
    // butin des nouveaux monstres (41 et suivants)
    { n: 'Capuche de lapin', slot: 'head', lvl: 2, icon: 'hood', c: '#e8d8c8', st: { agi: 2, armor: 2 } },
    { n: 'Dard doré', slot: 'weapon', lvl: 2, icon: 'dagger', c: '#f0c850', st: { agi: 3 } },
    { n: 'Pelisse de loup', slot: 'chest', lvl: 5, icon: 'tunic', c: '#5a5878', st: { sta: 4, agi: 2, armor: 8 } },
    { n: 'Croc de loup', slot: 'weapon', lvl: 5, icon: 'dagger', c: '#c8c0d8', st: { agi: 6 } },
    { n: 'Ailes de nuit', slot: 'trinket', lvl: 4, icon: 'amulet', c: '#5a3a7a', st: { agi: 3, int: 2 } },
    { n: 'Écorce vive', slot: 'offhand', lvl: 5, icon: 'shield', c: '#7a5a32', st: { armor: 9, sta: 3 } },
    { n: 'Bâton de souche', slot: 'weapon', lvl: 5, icon: 'staff', c: '#8a6a3a', st: { int: 6, sta: 2 } },
    { n: 'Écailles de salamandre', slot: 'chest', lvl: 7, icon: 'plate', c: '#d0502a', st: { sta: 6, armor: 14 } },
    { n: 'Bottes de salamandre', slot: 'feet', lvl: 7, icon: 'boots', c: '#e06a3a', st: { agi: 4, armor: 5 } },
    { n: 'Cœur de cristal', slot: 'trinket', lvl: 8, icon: 'shard', c: '#c8f0ff', st: { int: 5, sta: 4 } },
    { n: 'Espadon de cristal', slot: 'weapon', lvl: 8, icon: 'great', c: '#a8e0f0', st: { str: 10 } },
    { n: 'Lanterne du follet', slot: 'trinket', lvl: 6, icon: 'spore', c: '#fff0a0', st: { int: 4, agi: 2 } },
    { n: 'Voile du spectre', slot: 'head', lvl: 8, icon: 'hood', c: '#3a3050', st: { int: 6, armor: 6 } },
    { n: 'Grimoire des ombres', slot: 'weapon', lvl: 8, icon: 'tome', c: '#4a2a6a', st: { int: 9, sta: 2 } },
    { n: 'Bonnet de pingouin', slot: 'head', lvl: 5, icon: 'hood', c: '#3a4a6a', st: { sta: 3, armor: 4 } },
    { n: 'Fourrure des neiges', slot: 'chest', lvl: 6, icon: 'tunic', c: '#e8eef8', st: { sta: 6, armor: 10 } },
    { n: 'Lance de glace', slot: 'weapon', lvl: 6, icon: 'spear', c: '#a8d8f0', st: { str: 7, agi: 2 } },
    { n: 'Grimoire de givre', slot: 'weapon', lvl: 6, icon: 'tome', c: '#7ab4e4', st: { int: 7, sta: 2 } },
    { n: 'Plastron de magma', slot: 'chest', lvl: 8, icon: 'plate', c: '#a83a1a', st: { sta: 8, str: 3, armor: 18 } },
    { n: 'Hache de magma', slot: 'weapon', lvl: 8, icon: 'axe', c: '#e0502a', st: { str: 11, sta: 2 } },
    { n: 'Ailes de cendre', slot: 'trinket', lvl: 6, icon: 'amulet', c: '#6a4a4a', st: { agi: 4, str: 2 } },
    { n: 'Jambières de cendre', slot: 'legs', lvl: 6, icon: 'pants', c: '#5a3a3a', st: { agi: 3, armor: 7 } }
  ];
  const GM_EQUIP = [33, 34, 35, 36, 39], GM_BAG = [37, 38]; // le maître du jeu est mage : sceptre en main, lame et égide au sac
  // butin : un objet tombe rarement (≈ 3 %), dans la liste propre au monstre ; le Roi Gelée donne toujours quelque chose
  const LOOT = { slime: { ch: 0.03, items: [0, 1, 6, 9, 12, 14, 20, 25, 28, 30, 32, 40] }, champi: { ch: 0.03, items: [7, 13, 15, 17, 1, 21, 25, 29] },
    ember: { ch: 0.035, items: [3, 4, 11, 16, 22, 26, 31] }, frost: { ch: 0.035, items: [7, 13, 15, 26, 29, 31, 1, 21, 40] }, boss: { ch: 1, items: [5, 8, 23, 27], minR: 2 },
    lapin: { ch: 0.03, items: [41, 12, 14] }, abeille: { ch: 0.03, items: [42, 41] }, loup: { ch: 0.035, items: [43, 44, 13] }, chauvesouris: { ch: 0.03, items: [45, 44] },
    souche: { ch: 0.04, items: [46, 47, 10] }, salamandre: { ch: 0.035, items: [48, 49, 16] }, golem: { ch: 0.05, items: [50, 51, 18] }, follet: { ch: 0.035, items: [52, 54] },
    spectre: { ch: 0.04, items: [53, 54] }, pingouin: { ch: 0.03, items: [55, 56] }, loupneige: { ch: 0.035, items: [56, 57, 43] }, esprit: { ch: 0.035, items: [58, 26] },
    magma: { ch: 0.05, items: [59, 60] }, cendre: { ch: 0.035, items: [61, 62] } };
  function itemStats(inst) { const T = ITEMS[inst[0]], mul = RARITY[inst[1]][2], o = {}; for (const k in T.st) o[k] = Math.max(1, Math.round(T.st[k] * mul)); return o; }
  const itemValue = inst => Math.round((5 + ITEMS[inst[0]].lvl * 4) * RARITY[inst[1]][2]);
  function rollRarity(min) { const r = Math.random(); const v = r < 0.006 ? 3 : r < 0.045 ? 2 : r < 0.22 ? 1 : 0; return Math.min(3, Math.max(min || 0, v)); }
  const UNIQUE_BOOTS = 24, UNIQUE_CHANCE = { frost: 0.001, boss: 0.05, ember: 0.002, champi: 0.001, slime: 0.0005 };
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
  /* ---------------- armes : pas de classes, l'arme en main définit les attaques ----------------
     Chaque famille a une attaque de base et des techniques débloquées par sa maîtrise (1 à 20), gagnée en se battant avec.
     La barre d'actions porte 3 techniques au choix parmi celles débloquées pour l'arme en main. */
  const FAMS = {
    sword: { name: 'Épée à une main', stat: 'str', basic: { name: 'Frappe', icon: 'slash', range: 1.3, cd: 0.45, mult: 1, fx: 'slash' },
      tech: [
        { name: 'Tourbillon', icon: 'spin', m: 2, mp: 15, cd: 3, kind: 'aoeSelf', r: 2.4, mult: 1.5, fx: 'spin', desc: 'Frappe tous les ennemis autour de toi.' },
        { name: 'Taillade', icon: 'slash', m: 3, mp: 10, cd: 4, kind: 'single', range: 1.7, mult: 2.2, fx: 'slashx', desc: 'Un coup puissant sur une seule cible.' },
        { name: 'Charge', icon: 'charge', m: 6, mp: 12, cd: 7, kind: 'charge', range: 6, mult: 1.4, stun: 1.5, fx: 'charge', desc: "Fonce sur un ennemi et l'étourdit 1,5 s." },
        { name: 'Cri de guerre', icon: 'shout', m: 10, mp: 20, cd: 20, kind: 'buff', dur: 8, fx: 'shout', desc: '+40 % de dégâts et -30 % de dégâts subis pendant 8 s.' }],
      caps: [{ m: 5, name: 'Port du bouclier', desc: 'Tu peux tenir un bouclier en main gauche.' }, { m: 8, name: 'Blocage', desc: 'Avec un bouclier : 25 % de chances de bloquer 75 % des dégâts.' }] },
    great: { name: 'Arme à deux mains', stat: 'str', basic: { name: 'Coup lourd', icon: 'slash', range: 1.5, cd: 0.8, mult: 1.7, fx: 'slash' },
      tech: [
        { name: 'Moulinet', icon: 'spin', m: 2, mp: 18, cd: 4, kind: 'aoeSelf', r: 2.8, mult: 1.8, fx: 'spin', desc: 'Grand cercle qui frappe tout autour de toi.' },
        { name: 'Fendoir', icon: 'slash', m: 4, mp: 14, cd: 6, kind: 'single', range: 1.8, mult: 3, fx: 'slashx', desc: 'Un coup écrasant sur une seule cible.' },
        { name: 'Brise-garde', icon: 'charge', m: 7, mp: 16, cd: 9, kind: 'single', range: 1.8, mult: 1.6, stun: 2, fx: 'slashx', desc: 'Étourdit la cible 2 s.' },
        { name: 'Cri de guerre', icon: 'shout', m: 10, mp: 20, cd: 20, kind: 'buff', dur: 8, fx: 'shout', desc: '+40 % de dégâts et -30 % de dégâts subis pendant 8 s.' }] },
    dagger: { name: 'Dagues', stat: 'agi', basic: { name: 'Coups rapides', icon: 'slash', range: 1.1, cd: 0.28, mult: 0.6, fx: 'slash' },
      tech: [
        { name: 'Saignement', icon: 'slash', m: 2, mp: 10, cd: 4, kind: 'single', range: 1.4, mult: 2, slow: 3, fx: 'slashx', desc: 'Entaille profonde qui ralentit la cible 3 s.' },
        { name: "Pas de l'ombre", icon: 'charge', m: 4, mp: 12, cd: 6, kind: 'charge', range: 5, mult: 1.8, stun: 0.8, fx: 'charge', desc: 'Surgit derrière un ennemi et frappe.' },
        { name: 'Danse des lames', icon: 'spin', m: 7, mp: 16, cd: 5, kind: 'aoeSelf', r: 2, mult: 1.7, fx: 'spin', desc: 'Tourbillon de lames autour de toi.' },
        { name: 'Coup dans le dos', icon: 'pierce', m: 11, mp: 18, cd: 8, kind: 'single', range: 1.4, mult: 3.6, fx: 'slashx', desc: 'Énormes dégâts sur une seule cible.' }] },
    bow: { name: 'Arc', stat: 'agi', basic: { name: 'Tir', icon: 'bow', range: 5, cd: 0.6, mult: 0.9, fx: 'arrow' },
      tech: [
        { name: 'Volée', icon: 'volley', m: 2, mp: 15, cd: 4, kind: 'aoeTarget', range: 5, r: 2, mult: 1.0, fx: 'volley', desc: 'Une pluie de flèches touche la cible et ses voisins.' },
        { name: 'Flèche perçante', icon: 'pierce', m: 5, mp: 14, cd: 6, kind: 'single', range: 5.5, mult: 2.4, slow: 4, fx: 'pierce', desc: 'Gros dégâts et ralentit la cible 4 s.' },
        { name: "Pluie d'Éther", icon: 'rain', m: 8, mp: 25, cd: 12, kind: 'aoeTarget', range: 5, r: 3.2, mult: 1.6, fx: 'rain', desc: 'Déluge de flèches lumineuses sur une grande zone.' }] },
    staff: { name: 'Bâton', stat: 'int', basic: { name: "Trait d'Éther", icon: 'bolt', range: 4.5, cd: 0.7, mult: 1, fx: 'bolt' },
      tech: [
        { name: 'Nova de givre', icon: 'frost', m: 2, mp: 18, cd: 6, kind: 'aoeSelf', r: 2.5, mult: 1.1, stun: 2, fx: 'frost', desc: 'Gèle les ennemis proches pendant 2 s.' },
        { name: 'Boule de feu', icon: 'fire', m: 5, mp: 16, cd: 4, kind: 'aoeTarget', range: 5, r: 1.3, mult: 2.2, fx: 'fire', desc: 'Explose sur la cible et brûle les ennemis voisins.' },
        { name: 'Soin lumineux', icon: 'heal', m: 8, mp: 25, cd: 12, kind: 'heal', fx: 'heal', desc: 'Rend 40 % de tes PV et 25 % aux alliés proches.' }] },
    spear: { name: 'Lance', stat: 'str', basic: { name: 'Estoc', icon: 'pierce', range: 2, cd: 0.55, mult: 1.05, fx: 'thrust' },
      tech: [
        { name: 'Balayage', icon: 'spin', m: 2, mp: 15, cd: 4, kind: 'aoeSelf', r: 2.6, mult: 1.3, fx: 'spin', desc: 'Fauche les ennemis autour de toi.' },
        { name: 'Saut', icon: 'charge', m: 4, mp: 14, cd: 7, kind: 'charge', range: 5, mult: 1.6, stun: 1, fx: 'charge', desc: 'Bondit sur un ennemi et l\'étourdit 1 s.' },
        { name: 'Empalement', icon: 'pierce', m: 7, mp: 16, cd: 6, kind: 'single', range: 2.3, mult: 2.6, slow: 4, fx: 'pierce', desc: 'Transperce la cible et la ralentit 4 s.' }] },
    none: { name: 'Mains nues', stat: 'str', basic: { name: 'Coup de poing', icon: 'slash', range: 1.1, cd: 0.5, mult: 0.6, fx: 'slash' }, tech: [] }
  };
  /* Paliers des compétences : au rang 4 puis au rang 8, on choisit un effet parmi deux (modificateurs génériques
     appliqués au lancer : r rayon, range portée, cd recharge, dmg dégâts, bleed / burn durées, stun, slow, chain…). */
  const O = (id, n, d, mods) => ({ id, n, d, mods });
  const CRI = [[O('long', 'Prolongé', 'Dure 3 s de plus.', { buffDur: 3 }), O('rage', 'Rageur', '+15 % de dégâts en plus.', { buffDmg: 0.15 })],
    [O('ban', 'Bannière', 'Profite aussi aux alliés proches.', { allies: 1 }), O('souffle', 'Second souffle', 'Rend 15 % de tes PV.', { healSelf: 0.15 })]];
  const MS = {
    'sword:Tourbillon': [[O('large', 'Large', 'Rayon +0,6.', { r: 0.6 }), O('tranchant', 'Tranchant', 'Fait saigner 3 s.', { bleed: 3 })], [O('aimant', 'Aimant', 'Attire les ennemis vers toi.', { pull: 1 }), O('double', 'Double', 'Frappe deux fois.', { twice: 1 })]],
    'sword:Taillade': [[O('hemo', 'Hémorragie', 'Fait saigner 4 s.', { bleed: 4 }), O('ecras', 'Écrasante', '+25 % de dégâts.', { dmg: 0.25 })], [O('exec', 'Exécution', 'Dégâts ×2 sur une cible sous 30 % de PV.', { execute: 1 }), O('garde', 'Garde', 'Tu subis 20 % de dégâts en moins pendant 3 s.', { guard: [0.2, 3] })]],
    'sword:Charge': [[O('longue', 'Longue', 'Portée +2.', { range: 2 }), O('rapide', 'Rapide', 'Recharge −2 s.', { cd: 2 })], [O('onde', 'Onde de choc', "Étourdit aussi les ennemis autour de l'impact.", { stunArea: 1.8 }), O('elan', 'Élan', '+30 % de vitesse pendant 3 s.', { haste: 3 })]],
    'sword:Cri de guerre': CRI, 'great:Cri de guerre': CRI,
    'great:Moulinet': [[O('large', 'Large', 'Rayon +0,6.', { r: 0.6 }), O('lourd', 'Lourd', '+25 % de dégâts.', { dmg: 0.25 })], [O('tornade', 'Tornade', 'Deux tours.', { twice: 1 }), O('repousse', 'Repousser', 'Écarte les ennemis.', { push: 1 })]],
    'great:Fendoir': [[O('trav', 'Traversant', "Touche aussi l'ennemi juste derrière.", { chain: 1 }), O('brutal', 'Brutal', '+25 % de dégâts.', { dmg: 0.25 })], [O('bourreau', 'Bourreau', 'Si la cible meurt, la moitié de la recharge est rendue.', { killRefund: 0.5 }), O('fracas', 'Fracas', 'Étourdit 1 s.', { stun: 1 })]],
    'great:Brise-garde': [[O('long', 'Long', 'Étourdit 3 s.', { stun: 3 }), O('vuln', 'Vulnérable', 'La cible subit +20 % de dégâts pendant 3 s.', { vuln: [0.2, 3] })], [O('zone', 'Zone', 'Étourdit aussi les voisins.', { stunArea: 1.8 }), O('rapide', 'Rapide', 'Recharge −3 s.', { cd: 3 })]],
    'dagger:Saignement': [[O('profond', 'Profond', 'Le saignement dure 2 s de plus.', { bleed: 2 }), O('venin', 'Venin', 'Le saignement fait +50 % de dégâts.', { bleedK: 0.5 })], [O('contagion', 'Contagion', 'Se propage à un ennemi voisin.', { chain: 1 }), O('saignee', 'Saignée', 'Te soigne de 30 % des dégâts.', { lifesteal: 0.3 })]],
    "dagger:Pas de l'ombre": [[O('vif', 'Vif', 'Recharge −2 s.', { cd: 2 }), O('long', 'Long', 'Portée +2.', { range: 2 })], [O('dispa', 'Disparition', 'Les monstres perdent ta trace 2 s.', { stealth: 2 }), O('embu', 'Embuscade', 'Coup critique garanti.', { crit: 1 })]],
    'dagger:Danse des lames': [[O('large', 'Large', 'Rayon +0,5.', { r: 0.5 }), O('affutee', 'Affûtée', '+25 % de dégâts.', { dmg: 0.25 })], [O('tempo', 'Tempo', 'Chaque ennemi touché réduit la recharge de 0,5 s.', { cdPerHit: 0.5 }), O('esquive', 'Esquive', 'Tu subis 30 % de dégâts en moins pendant 2 s.', { guard: [0.3, 2] })]],
    'dagger:Coup dans le dos': [[O('precis', 'Précis', '+20 % de chances de critique.', { critAdd: 0.2 }), O('perfo', 'Perforant', '+25 % de dégâts.', { dmg: 0.25 })], [O('enchain', 'Enchaînement', "Recharge Pas de l'ombre si la cible meurt.", { killReset: "Pas de l'ombre" }), O('marque', 'Marque', 'La cible subit +15 % de dégâts pendant 4 s.', { vuln: [0.15, 4] })]],
    'bow:Volée': [[O('nourrie', 'Nourrie', 'Deux flèches de plus (+30 % de dégâts).', { dmg: 0.3, arrows: 2 }), O('large', 'Large', 'Rayon +0,5.', { r: 0.5 })], [O('glu', 'Glu', 'Ralentit les ennemis touchés.', { slow: 2.5 }), O('feu', 'Feu', 'Enflamme 2 s.', { burn: 2 })]],
    'bow:Flèche perçante': [[O('transp', 'Transperçante', 'Traverse deux ennemis de plus.', { chain: 2 }), O('lourde', 'Lourde', '+25 % de dégâts.', { dmg: 0.25 })], [O('entrave', 'Entrave', 'Ralentissement bien plus fort.', { slowStrong: 1 }), O('recul', 'Recul', 'Repousse la cible.', { push: 1 })]],
    "bow:Pluie d'Éther": [[O('double', 'Double', 'Frappe deux fois.', { twice: 1 }), O('large', 'Large', 'Rayon +0,6.', { r: 0.6 })], [O('benie', 'Bénie', 'Soigne les alliés dans la zone.', { healZone: 0.1 }), O('orage', 'Orage', 'Étourdit 0,5 s.', { stun: 0.5 })]],
    'staff:Nova de givre': [[O('large', 'Large', 'Rayon +0,5.', { r: 0.5 }), O('mord', 'Mordante', '+25 % de dégâts.', { dmg: 0.25 })], [O('glac', 'Glaciale', 'Gel prolongé d’1 s.', { stun: 3 }), O('eclats', 'Éclats', 'Les ennemis gelés subissent +20 % de dégâts.', { vuln: [0.2, 4] })]],
    'staff:Boule de feu': [[O('brasier', 'Brasier', 'Laisse un feu au sol pendant 3 s.', { zone: 3 }), O('comete', 'Comète', 'Rayon +0,6.', { r: 0.6 })], [O('rebond', 'Rebond', 'Rebondit sur une deuxième cible.', { chain: 1, bounce: 1 }), O('combu', 'Combustion', 'Enflamme 4 s.', { burn: 4 })]],
    'staff:Soin lumineux': [[O('clarte', 'Clarté', 'Rend aussi 20 % de ton mana.', { mana: 0.2 }), O('ample', 'Ample', 'Soigne les alliés jusqu’à 2 cases plus loin.', { healRange: 2 })], [O('egide', 'Égide', 'Bouclier qui absorbe 15 % de tes PV.', { shield: 0.15 }), O('renouv', 'Renouveau', 'Soigne encore 20 % de tes PV en 4 s.', { regen: [0.2, 4] })]],
    'spear:Balayage': [[O('repousse', 'Repousser', 'Écarte les ennemis.', { push: 1 }), O('large', 'Large', 'Rayon +0,6.', { r: 0.6 })], [O('fauch', 'Faucheuse', '+30 % de dégâts aux ennemis ralentis.', { slowBonus: 0.3 }), O('riposte', 'Riposte', 'Tu subis 20 % de dégâts en moins pendant 3 s.', { guard: [0.2, 3] })]],
    'spear:Saut': [[O('long', 'Long', 'Portée +2.', { range: 2 }), O('vif', 'Vif', 'Recharge −2 s.', { cd: 2 })], [O('impact', 'Impact', "Étourdit tout autour de l'impact.", { stunArea: 2 }), O('ecras', 'Écrasant', 'Étourdit 2 s.', { stun: 2 })]],
    'spear:Empalement': [[O('trav', 'Traversant', 'Traverse un ennemi de plus.', { chain: 1 }), O('profond', 'Profond', '+25 % de dégâts.', { dmg: 0.25 })], [O('clouer', 'Clouer', 'Étourdit 1 s.', { stun: 1 }), O('hemo', 'Hémorragie', 'Fait saigner 4 s.', { bleed: 4 })]]
  };
  for (const f in FAMS) for (const T of FAMS[f].tech) T.ms = MS[f + ':' + T.name] || null;
  FAMS.dagger.tech[0].bleed = 3; FAMS.dagger.tech[0].desc = 'Entaille profonde : saigne 3 s et ralentit la cible.';
  const FAM_OF = { sword: 'sword', axe: 'great', great: 'great', dagger: 'dagger', bow: 'bow', staff: 'staff', tome: 'staff', spear: 'spear' };
  // armes de départ proposées à la création (l'ancien champ « cls » des sauvegardes garde ce sens : 0 épée, 1 arc, 2 bâton)
  const START = [[0, 'sword'], [20, 'bow'], [1, 'staff'], [28, 'dagger'], [30, 'spear'], [32, 'great']];
  const MAST_MAX = 20, mNeed = l => Math.round(10 * Math.pow(l, 1.7));
  function mTotal(l) { let t = 0; for (let k = 1; k < l; k++) t += mNeed(k); return t; }
  const MAST_CAP = mTotal(MAST_MAX);
  function mLevel(total) { let lv = 1, t = total | 0; while (lv < MAST_MAX && t >= mNeed(lv)) { t -= mNeed(lv); lv++; } return { lv, cur: t, need: lv < MAST_MAX ? mNeed(lv) : 0 }; }
  /* ---------------- rangs de compétence : chaque technique progresse en l'utilisant ----------------
     Rang 1 à 10 ; du rang r au rang r+1 : 26 × r^1,6 points (environ 1 200 utilisations utiles pour le rang 10).
     Plafond tenu par le niveau du héros : rang max = 1 + niveau / 5 (rang 10 au niveau 45). Au plafond, l'expérience
     remplit encore le rang suivant (« prête à monter ») et la compétence monte dès le niveau requis.
     Chaque rang : +5 % de puissance (dégâts, soins, durées) et −3 % de recharge (plus l'Intelligence). Paliers aux rangs 4 et 8 (à venir). */
  const SK_MAX = 10, skNeed = r => Math.round(26 * Math.pow(r, 1.6));
  function skTotal(r) { let t = 0; for (let k = 1; k < r; k++) t += skNeed(k); return t; }
  const skCap = lvl => Math.min(SK_MAX, 1 + Math.floor(Math.max(1, lvl) / 5)), skLvlFor = r => 5 * (r - 1);
  function skRank(total, cap) { let r = 1; while (r < SK_MAX && total >= skTotal(r + 1)) r++; return Math.min(r, cap || SK_MAX); }
  function skInfo(total, lvl) {
    const cap = skCap(lvl), raw = skRank(total), r = Math.min(raw, cap), next = r < SK_MAX ? skTotal(r + 1) : 0;
    return { r, cap, cur: r < SK_MAX ? total - skTotal(r) : 0, need: r < SK_MAX ? skNeed(r) : 0, ready: r < SK_MAX && total >= next, lvlNext: r < SK_MAX ? skLvlFor(r + 1) : 0 };
  }
  // temps de recharge d'une technique : −3 % par rang (usage) et jusqu'à −40 % avec l'Intelligence (int / (int + 150))
  const intCdK = intel => Math.min(0.4, Math.max(0, intel || 0) / ((intel || 0) + 150));
  const techCd = (base, rank, intel, minus) => Math.max(0.5, Math.round((base * (1 - 0.03 * (rank - 1)) * (1 - intCdK(intel)) - (minus || 0)) * 10) / 10);
  function weaponFam(equip) { const w = equip && equip.weapon, T = w && ITEMS[w[0]]; return T ? (FAM_OF[T.icon] || 'sword') : 'none'; }
  function kitOf(equip, mast, bar, sk, lvl, skc, intel) {
    const fam = weaponFam(equip), F = FAMS[fam], ml = mLevel((mast || {})[fam] || 0).lv, T = F.tech, cap = skCap(lvl || 1);
    const ranked = i => {
      const key = fam + ':' + i, r = skRank(((sk || {})[key]) || 0, cap), ch = ((skc || {})[key]) || [], M = {}, Tm = T[i].ms;
      if (Tm) for (let j = 0; j < 2; j++) if (r >= (j ? 8 : 4) && ch[j] >= 0 && Tm[j][ch[j]]) { const mo = Tm[j][ch[j]].mods; for (const k in mo) M[k] = typeof mo[k] === 'number' && typeof M[k] === 'number' ? M[k] + mo[k] : mo[k]; }
      const A = Object.assign({ ti: i, rank: r, pw: 1 + 0.05 * (r - 1) }, T[i]);
      A.mods = M; A.pending = Tm ? [0, 1].filter(j => r >= (j ? 8 : 4) && !(ch[j] >= 0)) : [];
      A.cd = techCd(T[i].cd, r, intel, M.cd);
      if (A.r != null || M.r) A.r = (A.r || 0) + (M.r || 0); if (A.range != null) A.range += M.range || 0;
      return A;
    };
    const open = T.map((A, i) => i).filter(i => T[i].m <= ml), want = (bar && bar[fam]) || [], pick = [];
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
    const fam = weaponFam(equip), on = sl => equip && equip[sl] && (sl !== 'offhand' || fam === 'sword');
    for (const sl of SLOTS) if (on(sl)) { const st = itemStats(equip[sl]); for (const k in st) s[k] += st[k]; }
    let speed = 1; for (const sl of SLOTS) if (on(sl) && ITEMS[equip[sl][0]].speed) speed += ITEMS[equip[sl][0]].speed;
    for (const k in s) s[k] = Math.floor(s[k]);
    const st = FAMS[fam].stat, atk = st === 'agi' ? 2 + s.agi * 1.6 + s.str * 0.5 : st === 'int' ? 2 + s.int * 1.6 + s.str * 0.3 : 2 + s.str * 1.5;
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
    { id: 'bow', npc: 'bran', name: 'Arc de saule', desc: 'Arc inhabituel (nv3)', req: 3, cost: { wood: 6, herb: 2 }, item: [21, 1] },
    { id: 'shield', npc: 'bran', name: 'Bouclier de bois', desc: 'Bouclier inhabituel (main gauche)', req: 2, cost: { wood: 5 }, item: [25, 1] },
    { id: 'spear', npc: 'bran', name: 'Lance de frêne', desc: 'Lance inhabituelle (nv1)', req: 2, cost: { wood: 5, herb: 2 }, item: [30, 1] }
  ];
  const dayKey = () => new Date().toISOString().slice(0, 10);
  // niveau max 50, au moins ~50 h de jeu : environ 1 h pour le niveau 10, 6 h pour le 20, 37 h pour le 40, 60 h et plus pour le 50
  const MAX_LVL = 50, xpNeed = l => Math.round(14 * Math.pow(l, 2.5));
  const LOOK_MAX = [3, 7, 7, 3, 4]; // coiffure, couleur cheveux, tenue, peau, chapeau
  /* Apparence de l'équipement (visible en jeu) : tête, torse, jambes, pieds, arme, main gauche → « t.r » par emplacement, « - » si vide. */
  const GEAR_SLOTS = ['head', 'chest', 'legs', 'feet', 'weapon', 'offhand'];
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
      wait: "Appelle à l'aide dans le tchat. Pixels Worlds se défend à plusieurs.",
      done: "Le cristal… il recommence à chanter ! Grâce à toi et à tes compagnons, Pixels Worlds respire de nouveau. Merci, gardien. Ce n'est que le début de l'histoire." }
  ];

  /* ---------------- îles et ponts ----------------
     Le Pont d'Éther (violet) tire une île au hasard à chaque passage et coûte de l'Éther (gagné en marchant) ;
     le Pont du Bourg (doré) ramène toujours au Bourg d'Argel. 90 % : une île fixe ; 10 % : une île éphémère. */
  const ISLES = {
    bourg: { name: "Bourg d'Argel", theme: 'bourg' },
    givre: { name: 'Île Givrée', theme: 'givre', seed: 7101, fx: 'slow', mobs: ['frost', 'frost', 'pingouin', 'loupneige', 'esprit', 'champi', 'slime'], res: ['quartz', 'wood'], trees: ['pine', 'pine', 'pine', 'oak', 'rock'], desc: 'Le froid mord : tes coups ralentissent les ennemis (sauf les créatures de givre).' },
    braise: { name: 'Île des Braises', theme: 'braise', seed: 7202, fx: 'burn', mobs: ['ember', 'salamandre', 'magma', 'cendre', 'ember', 'champi', 'slime'], res: ['quartz', 'herb'], trees: ['rock', 'rock', 'pine', 'bush', 'oak'], desc: 'La terre brûle : tes coups enflamment les ennemis (sauf les créatures de feu).' },
    brume: { name: 'Île de Brume', theme: 'brume', eph: 1, mobs: ['follet', 'spectre', 'loup', 'chauvesouris', 'souche', 'slime', 'champi', 'frost'], res: ['herb', 'wood', 'quartz'], trees: ['oak', 'pine', 'blossom', 'bush'], desc: "Île éphémère : un coffre rare t'attend. Elle disparaîtra quand tu partiras." }
  };
  const FIXED_ISLES = ['givre', 'braise'], ETHER_BRIDGE = 3, BRIDGE_LEN = 4;
  const ISLE_BIT = { bourg: 1, givre: 2, braise: 4, brume: 8 };
  function cleanIsle(o) { if (!o || !ISLES[o.k]) return { k: 'bourg' }; return ISLES[o.k].eph ? { k: o.k, s: (o.s >>> 0) || 1 } : { k: o.k }; }
  function rollIsle(cur) {
    if (Math.random() < 0.1) return { k: 'brume', s: (Math.random() * 4294967295) >>> 0 || 1 };
    const pool = FIXED_ISLES.filter(k => k !== cur); return { k: pool[Math.floor(Math.random() * pool.length)] };
  }
  // pont le long d'un axe (« x » : vers le bas-droite de l'écran, « y » : vers le bas-gauche), depuis une rive basse
  function findBridge(TY, HT, SOL, idx, inb, axis, avoid, prefer, okHead) {
    const di = axis === 'x' ? 1 : 0, dj = axis === 'x' ? 0 : 1; let best = null, bs = -1e9;
    for (let j = 1; j < MH - 1; j++) for (let i = 1; i < MW - 1; i++) {
      const k = idx(i, j); if (SOL[k] || TY[k] === 0 || HT[k] > 1) continue;
      if (okHead && !okHead(i, j)) continue;
      let ok = true;
      for (let s = 1; s <= BRIDGE_LEN + 1 && ok; s++) { const a = i + di * s, b = j + dj * s; if (!inb(a, b) || TY[idx(a, b)] !== 0) ok = false;
        if (ok && s >= 2) for (const o of [-1, 1]) { const a2 = a + dj * o, b2 = b + di * o; if (inb(a2, b2) && TY[idx(a2, b2)] !== 0) ok = false; } }
      if (!ok || (avoid && Math.hypot(i - avoid.i, j - avoid.j) < 8)) continue;
      const sc = i + j - (prefer ? Math.abs((axis === 'x' ? j : i) - prefer) * 3 : 0);
      if (sc > bs) { bs = sc; best = { i, j }; }
    }
    if (!best) return null;
    const { i, j } = best;
    return { i, j, di, dj, L: BRIDGE_LEN, hx: i + .5, hy: j + .5, ex: i + di * BRIDGE_LEN + .5, ey: j + dj * BRIDGE_LEN + .5, ix: i - di + .5, iy: j - dj + .5 };
  }
  function layDeck(b, SOL, HT, idx) { for (let s = 1; s <= b.L; s++) { const k = idx(b.i + b.di * s, b.j + b.dj * s); SOL[k] = 0; HT[k] = 0; } }
  // îles du voyage : même taille de carte, relief et décor selon le thème, sans village
  function buildIsle(key, seed) {
    const I = ISLES[key], rnd = mulberry32(seed), N = MW * MH;
    const TY = new Uint8Array(N), HT = new Uint8Array(N), SOL = new Uint8Array(N);
    const idx = (i, j) => j * MW + i, inb = (i, j) => i >= 0 && j >= 0 && i < MW && j < MH, tdist = (i, j) => Math.hypot(i + .5 - CX, j + .5 - CY);
    const s1 = rnd() * 1000 | 0, s2 = rnd() * 1000 | 0;
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
      const k = idx(i, j), d = tdist(i, j) / (MW / 2) * 1.08;
      let n = 0.6 * fbm(i / 9, j / 9, s1) + 0.4 * fbm(i / 4.5, j / 4.5, s2); n = n * 0.55 + (1 - d) * 0.74 - 0.03;
      if (n < 0.3 || d > 0.97) { TY[k] = 0; HT[k] = 0; } else if (n < 0.36) { TY[k] = 1; HT[k] = 0; } else { TY[k] = 2; HT[k] = n < 0.5 ? 1 : n < 0.62 ? 2 : 3; }
    }
    for (let it = 0; it < 8; it++) for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
      const k = idx(i, j); if (!TY[k]) continue; let m = 9;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inb(i + a, j + b)) m = Math.min(m, HT[idx(i + a, j + b)]);
      if (HT[k] > m + 1) HT[k] = m + 1;
    }
    for (let k = 0; k < N; k++) if (TY[k] === 0) SOL[k] = 1;
    // zone accessible à pied depuis une case (mêmes règles que le héros : pas d'obstacle, marche d'au plus 1 niveau)
    const reachFrom = (i0, j0) => { const R = new Uint8Array(N), par = new Int32Array(N).fill(-1), q = [idx(i0, j0)]; R[q[0]] = 1;
      for (let h = 0; h < q.length; h++) { const k = q[h], i = k % MW, j = (k / MW) | 0;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = i + a, y = j + b; if (!inb(x, y)) continue; const k2 = idx(x, y); if (R[k2] || SOL[k2] || Math.abs(HT[k2] - HT[k]) > 1) continue; R[k2] = 1; par[k2] = k; q.push(k2); } }
      return { R, par }; };
    const inland = (i, j, di, dj) => { const a = i - di, b = j - dj; return inb(a, b) && TY[idx(a, b)] !== 0 && Math.abs(HT[idx(a, b)] - HT[idx(i, j)]) <= 1; };
    // arrivée (Pont d'Éther) et Pont du Bourg choisis ensemble : le second doit être atteignable à pied depuis la première,
    // dans une partie de l'île assez grande (on essaie d'autres rives sinon)
    const tried = new Set(); let eb = null, hb = null, R0 = null;
    for (let t = 0; t < 16 && !hb; t++) {
      eb = findBridge(TY, HT, SOL, idx, inb, 'x', null, null, (i, j) => inland(i, j, 1, 0) && !tried.has(i + ',' + j)); if (!eb) break;
      tried.add(eb.i + ',' + eb.j); R0 = reachFrom(eb.i - 1, eb.j);
      let size = 0; for (let k = 0; k < N; k++) size += R0.R[k];
      if (size >= 200) hb = findBridge(TY, HT, SOL, idx, inb, 'y', eb, null, (i, j) => R0.R[idx(i, j)] && inland(i, j, 0, 1));
    }
    if (!hb) { eb = findBridge(TY, HT, SOL, idx, inb, 'x', null, null, (i, j) => inland(i, j, 1, 0)); R0 = eb ? reachFrom(eb.i - 1, eb.j) : null; hb = findBridge(TY, HT, SOL, idx, inb, 'y', eb, null); }
    const bridges = []; if (eb) { eb.kind = 'ether'; bridges.push(eb); }
    const spawn = eb ? { x: eb.ix, y: eb.iy } : { x: CX, y: CY };
    if (hb) { hb.kind = 'home'; bridges.push(hb); }
    for (const b of bridges) layDeck(b, SOL, HT, idx);
    const keep = new Uint8Array(N);
    if (hb && R0 && R0.R[idx(hb.i, hb.j)]) for (let k = idx(hb.i, hb.j); k >= 0; k = R0.par[k]) { const i = k % MW, j = (k / MW) | 0; for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (inb(i + a, j + b)) keep[idx(i + a, j + b)] = 1; }
    const near = (i, j, r) => bridges.some(b => Math.hypot(i + .5 - b.ix, j + .5 - b.iy) < r || Math.hypot(i + .5 - b.hx, j + .5 - b.hy) < r);
    const props = [];
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
      const k = idx(i, j); if (TY[k] !== 2 || SOL[k] || near(i, j, 2.6) || keep[k]) continue;
      const r = rnd(); if (r < 0.11) { const t = I.trees[Math.floor(rnd() * I.trees.length)]; SOL[k] = 1; props.push({ type: t, i, j, v: Math.floor(rnd() * 3), w: 1, h: 1 }); }
      else if (r < 0.14) { SOL[k] = 1; props.push({ type: 'bush', i, j, v: Math.floor(rnd() * 3), w: 1, h: 1 }); }
    }
    const walkable = (i, j) => inb(i, j) && !SOL[idx(i, j)];
    const R1 = reachFrom(Math.floor(spawn.x), Math.floor(spawn.y)).R; // monstres, cueillette et coffre : seulement là où l'on peut marcher
    const cand = []; for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) if (walkable(i, j) && R1[idx(i, j)] && TY[idx(i, j)] === 2 && Math.hypot(i + .5 - spawn.x, j + .5 - spawn.y) > 5 && !near(i, j, 3)) cand.push([i, j]);
    for (let i = cand.length - 1; i > 0; i--) { const r = Math.floor(rnd() * (i + 1)); [cand[i], cand[r]] = [cand[r], cand[i]]; }
    const spawns = [];
    for (const c of cand) { if (spawns.every(p => Math.hypot(p.i - c[0], p.j - c[1]) > 2.7)) spawns.push({ type: I.mobs[Math.floor(rnd() * I.mobs.length)], lvl: 1, i: c[0], j: c[1] }); if (spawns.length >= 30) break; }
    const nodes = [], taken = new Set(spawns.map(s => s.i + ',' + s.j));
    for (const [i, j] of cand) { if (nodes.length >= 9) break; if (taken.has(i + ',' + j) || nodes.some(n => Math.hypot(n.x - i - .5, n.y - j - .5) < 4)) continue; nodes.push({ k: nodes.length, res: I.res[nodes.length % I.res.length], x: i + 0.3 + rnd() * 0.4, y: j + 0.3 + rnd() * 0.4 }); taken.add(i + ',' + j); }
    let chest = null; if (I.eph) { let bd = -1; for (const [i, j] of cand) { const d = Math.hypot(i + .5 - spawn.x, j + .5 - spawn.y); if (d > bd && !taken.has(i + ',' + j)) { bd = d; chest = { x: i + .5, y: j + .5 }; } } }
    const hAt = (x, y) => { const i = Math.floor(x), j = Math.floor(y); return inb(i, j) ? HT[idx(i, j)] : 0; };
    return { MW, MH, CX, CY, TY, HT, SOL, props, spawns, nodes, idx, inb, tdist, walkable, hAt, zoneOf: () => I.name, isle: key, theme: I.theme, bridges, spawn, chest };
  }

  /* ---------------- monde ---------------- */
  // isle : { k, s } (île du voyage) ; sans argument, l'île d'origine (Bourg d'Argel), toujours identique
  function buildWorld(seed, isle) {
    if (isle && isle.k && isle.k !== 'bourg' && ISLES[isle.k]) return buildIsle(isle.k, ISLES[isle.k].eph ? isle.s : ISLES[isle.k].seed);
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
    const VAR = { slime: [['lapin', 0.25], ['abeille', 0.37]], champi: [['loup', 0.2], ['chauvesouris', 0.35], ['souche', 0.47]], ember: [['salamandre', 0.25], ['golem', 0.4], ['spectre', 0.52], ['follet', 0.6]] };
    for (const sp of spawns) { const h = hash(sp.i, sp.j, 901), v = VAR[sp.type] && VAR[sp.type].find(o => h < o[1]); if (v) sp.type = v[0]; }
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
    // Pont d'Éther au bout de la route de l'est (posé après tout le reste : le monde d'origine ne change pas)
    const eb = findBridge(TY, HT, SOL, idx, inb, 'x', null, 28), bridges = []; if (eb) { eb.kind = 'ether'; bridges.push(eb); layDeck(eb, SOL, HT, idx); }
    return { MW, MH, CX, CY, TY, HT, SOL, props, spawns, nodes, idx, inb, tdist, walkable, hAt, zoneOf, isle: 'bourg', theme: 'bourg', bridges, spawn: SPAWN, chest: null };
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
    constructor(W, opts) {
      this.W = W; this.t = 0; this.players = new Map(); this.events = []; this.bossWarn = 0;
      // îles du voyage : les monstres prennent le niveau du héros qui arrive (±1)
      const L0 = W.isle && W.isle !== 'bourg' ? Math.max(1, (opts && opts.lvl) | 0 || 1) : 0;
      this.fx = (ISLES[W.isle] || {}).fx || null; this.chestOpen = false; this.spawn = W.spawn || SPAWN; this.zones = [];
      // îles du voyage : combat entre joueurs, et à la mort le sac reste sur le corps 3 minutes
      this.pvp = !!(W.isle && W.isle !== 'bourg'); this.corpses = []; this.corpseN = 1;
      this.mobs = W.spawns.map((s, k) => { const lvl = L0 ? Math.max(1, L0 + Math.floor(Math.random() * 3) - 1) : s.lvl; return Object.assign({
        k, type: s.type, lvl: s.lvl, x: s.i + .5, y: s.j + .5, hx: s.i + .5, hy: s.j + .5, alive: true, respawnT: 0,
        target: null, returning: false, atkCd: 0, wt: Math.random() * 3, wdx: 0, wdy: 0, tagged: new Set(), moving: false
      }, mobStats(s.type, lvl), { lvl }); });
      for (const m of this.mobs) m.hp = m.maxhp;
    }
    ev(o) { this.events.push(o); }
    addPlayer(id, name, look, save, cls) {
      const s = save || {};
      const p = {
        id, name: cleanName(name), look: cleanLook(look), x: this.spawn.x + (Math.random() - .5) * (this.spawn === SPAWN ? 1 : 0.3), y: this.spawn.y, face: 0, flip: 0, moving: 0,
        lvl: Math.min(MAX_LVL, Math.max(1, s.lvl | 0)), xp: Math.max(0, s.xp | 0), gold: Math.max(0, s.gold | 0), potions: s.potions == null ? 3 : Math.max(0, s.potions | 0),
        dead: false, deadT: 0, atkCd: 0, skillCd: 0, potCd: 0, lastHit: 99, lastMv: this.t, chatT: 0,
        q: clampInt(s.q, 0, QUESTS.length), qs: clampInt(s.qs, 0, 2), qn: clampInt(s.qn, 0, 99)
      };
      const inv = s.inv || {}; p.inv = { herb: clampInt(inv.herb, 0, 9999), wood: clampInt(inv.wood, 0, 9999), quartz: clampInt(inv.quartz, 0, 9999) };
      p.equip = {}; p.bag = [];
      if (s.equip) { for (const sl of SLOTS) { const it = cleanInst(s.equip[sl]); p.equip[sl] = it && ITEMS[it[0]].slot === sl ? it : null; } }
      p.gifts = clampInt(s.gifts, 0, 1 << 20); p.cls = clampInt(s.lvl ? s.cls : cls == null ? s.cls : cls, 0, START.length - 1); p.abCd = [0, 0, 0]; p.buffT = 0;
      if (!s.equip) { p.equip.weapon = [START[p.cls][0], 0]; p.equip.chest = [9, 0]; }
      // maîtrise d'arme ; anciennes sauvegardes (avec classes) : l'arme de l'ancienne classe démarre au niveau du héros
      p.mast = {};
      if (s.mast && typeof s.mast === 'object') { for (const f in FAMS) if (f !== 'none' && s.mast[f]) p.mast[f] = clampInt(s.mast[f], 0, MAST_CAP); }
      else if (s.lvl > 1) p.mast[['sword', 'bow', 'staff'][clampInt(s.cls, 0, 2)]] = mTotal(Math.min(MAST_MAX, p.lvl));
      // points de caractéristiques (3 par niveau) ; anciennes sauvegardes : répartis selon l'ancienne classe
      p.pts = { str: 0, sta: 0, int: 0, agi: 0 };
      if (s.pts && typeof s.pts === 'object') { for (const k in p.pts) p.pts[k] = clampInt(s.pts[k], 0, 999); }
      else if (p.lvl > 1) { const g = CLASSES[clampInt(s.cls, 0, 2)].grow, tot = 3 * (p.lvl - 1), sum = g.str[1] + g.sta[1] + g.int[1] + g.agi[1]; let left = tot; for (const k of ['int', 'agi', 'sta']) { p.pts[k] = Math.round(tot * g[k][1] / sum); left -= p.pts[k]; } p.pts.str = Math.max(0, left); }
      if (freePts(p.lvl, p.pts) < 0) p.pts = { str: 0, sta: 0, int: 0, agi: 0 };
      p.bar = {}; if (s.bar && typeof s.bar === 'object') for (const f in FAMS) if (Array.isArray(s.bar[f])) p.bar[f] = s.bar[f].slice(0, 3).map(v => clampInt(v, 0, 9));
      p.fr = s.fr == null ? 1 : clampInt(s.fr, 0, 1); // une réinitialisation gratuite des points
      p.skc = {}; if (s.skc && typeof s.skc === 'object') for (const k in s.skc) if (/^[a-z]+:\d$/.test(k) && Array.isArray(s.skc[k])) p.skc[k] = [0, 1].map(j => { const v = s.skc[k][j]; return v === 0 || v === 1 ? v : -1; });
      p.sk = {}; if (s.sk && typeof s.sk === 'object') for (const k in s.sk) if (/^[a-z]+:(\d|block)$/.test(k)) p.sk[k] = clampInt(s.sk[k], 0, skTotal(SK_MAX));
      // voyage : île actuelle, îles découvertes ; « arr » = on vient de traverser, on apparaît au bout du Pont d'Éther
      p.isle = cleanIsle(s.isle); p.isles = clampInt(s.isles, 0, 1 << 20) | 1; p.arr = 0;
      if (s.arr && this.W.bridges) { const b = this.W.bridges.find(o => o.kind === 'ether') || this.W.bridges[0]; if (b) { p.x = b.ix; p.y = b.iy; } }
      for (const a of (s.bag || []).slice(0, BAG_SIZE)) { const it = cleanInst(a); if (it) p.bag.push(it); }
      const gr = s.gear || {}; if (gr.blade) p.bag.push([2, 1]); if (gr.armor) p.bag.push([10, 1]); if (gr.charm) p.bag.push([18, 2]);
      p.ether = clampInt(s.ether == null ? DAILY_GIFT : s.ether, 0, ETHER_MAX); p.glvl = clampInt(s.glvl || 1, 1, 50); p.gxp = clampInt(s.gxp, 0, 99999);
      p.scarves = clampInt(s.scarves == null ? 1 : s.scarves, 1, 7) | 1; p.scarf = clampInt(s.scarf, 0, 2); if (!(p.scarves & (1 << p.scarf))) p.scarf = 0;
      p.day = s.day || ''; p.stepsToday = clampInt(s.stepsToday, 0, DAILY_STEP_CAP); p.gcd = {};
      this.newDay(p);
      this.recalc(p, true); p.lookStr = p.look.join('');
      this.players.set(id, p);
      this.ev({ e: 'ch', s: 1, t: p.name + ' a rejoint Pixels Worlds.' });
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
    saveData(p) { return { gifts: p.gifts, cls: p.cls, lvl: p.lvl, xp: p.xp, gold: p.gold, potions: p.potions, q: p.q, qs: p.qs, qn: p.qn, inv: p.inv, equip: p.equip, bag: p.bag, ether: p.ether, glvl: p.glvl, gxp: p.gxp, scarves: p.scarves, scarf: p.scarf, day: p.day, stepsToday: p.stepsToday, mast: p.mast, pts: p.pts, bar: p.bar, fr: p.fr, isle: p.isle, isles: p.isles, arr: p.arr, sk: p.sk, skc: p.skc }; }
    grantFounder(p) {
      if (p.gifts & 1) return false;
      const wpn = [[5, 3], [23, 3], [4, 3], [29, 3], [31, 3], [3, 3]], k = p.cls < wpn.length ? p.cls : 0;
      p.equip = { head: [8, 3], chest: [11, 3], legs: [13, 3], feet: [UNIQUE_BOOTS, 4], weapon: wpn[k], trinket: [19, 3], offhand: null };
      for (let c = 0; c < 3; c++) if (c !== k && p.bag.length < BAG_SIZE) p.bag.push(wpn[c].slice());
      if (p.bag.length < BAG_SIZE) p.bag.push([27, 3]);
      p.gifts |= 1; this.recalc(p, true);
      this.ev({ e: 'founder', id: p.id });
      return true;
    }
    /* Ensemble unique du Maître du jeu : équipé une seule fois (les pièces remplacées vont au sac ; si le sac est plein,
       la pièce attend la prochaine connexion). Seul le client ou le serveur décide qui est maître du jeu. */
    grantGM(p) {
      const owned = new Set([...Object.values(p.equip).filter(Boolean), ...p.bag].map(i => i[0])); let got = 0, mage = 0;
      for (const t of GM_EQUIP) {
        if (owned.has(t)) continue;
        const sl = ITEMS[t].slot, old = p.equip[sl];
        if (old && p.bag.length >= BAG_SIZE) continue;
        if (old) p.bag.push(old); p.equip[sl] = [t, 4]; got++;
      }
      for (const t of GM_BAG) if (!owned.has(t) && p.bag.length < BAG_SIZE) { p.bag.push([t, 4]); got++; }
      if (p.equip.offhand && weaponFam(p.equip) !== 'sword' && p.bag.length < BAG_SIZE) { p.bag.push(p.equip.offhand); p.equip.offhand = null; }
      // une fois : le maître du jeu devient mage (maîtrise du bâton au niveau de celle de l'épée, points en Intelligence)
      if (!(p.gifts & 2)) {
        p.gifts |= 2; p.mast.staff = Math.max(p.mast.staff || 0, p.mast.sword || 0);
        const tot = 3 * (p.lvl - 1), it = Math.round(tot * 0.6), st = Math.round(tot * 0.3); p.pts = { str: 0, int: it, sta: st, agi: tot - it - st };
        mage = mLevel(p.mast.staff).lv; got++;
      }
      if (got) { this.recalc(p, true); this.ev({ e: 'gm', id: p.id, n: got, mage }); }
      return got;
    }
    buffMul(p) { return p.buffT > this.t ? 1.4 + (p.buffK || 0) : 1; }
    recalc(p, full) {
      const fh = p.maxhp ? p.hp / p.maxhp : 1, fm = p.maxmp ? p.mp / p.maxmp : 1;
      Object.assign(p, computeStats(p.lvl, p.equip, p.pts));
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
          const allowed = 3.6 * (p.speed || 1) * (p.hasteT > this.t ? 1.3 : 1) * (this.t - p.lastMv) + 0.7; // (ralenti : la vitesse permise reste la normale)
          if (Math.hypot(x - p.x, y - p.y) > allowed || !W.walkable(Math.floor(x), Math.floor(y))) { this.ev({ e: 'tp', id, x: p.x, y: p.y }); p.lastMv = this.t; return; }
          p.x = x; p.y = y; p.face = (m.f | 0) % 3; p.flip = m.fl ? 1 : 0; p.moving = m.mv ? 1 : 0; p.lastMv = this.t;
          break;
        }
        case 'atk': {
          const mob = m.p != null ? this.foe(p, m.p) : this.mobs[m.m | 0], B = kitOf(p.equip, p.mast, p.bar).basic;
          if (p.dead || !mob || mob.dead || mob.alive === false || p.atkCd > 0) return;
          if (Math.hypot(mob.x - p.x, mob.y - p.y) > B.range + (mob.type === 'boss' ? 1.1 : 0.6)) return;
          p.atkCd = B.cd - 0.05;
          let dmg = p.atk * B.mult * (0.85 + Math.random() * 0.3) * this.buffMul(p); const crit = Math.random() < p.crit; if (crit) dmg *= 1.8;
          if (mob.k == null) { this.ev({ e: 'sw', id, m: -1, pv: mob.id, c: p.cls, fx: B.fx }); this.addMast(p, 1); this.hurt(mob, Math.round(dmg), p, true); break; }
          this.ev({ e: 'sw', id, m: mob.k, c: p.cls, fx: B.fx });
          this.hitMob(mob, Math.round(dmg), p, crit);
          break;
        }
        case 'ab': {
          const K = kitOf(p.equip, p.mast, p.bar, p.sk, p.lvl, p.skc, p.stats && p.stats.int), i = m.a | 0, A = K.ab[i], M = (A && A.mods) || {};
          if (!A || A.locked || p.dead || p.abCd[i] > this.t || p.mp < A.mp) return;
          let tgt = null;
          if (A.kind === 'aoeTarget' || A.kind === 'single' || A.kind === 'charge') {
            tgt = m.p != null ? this.foe(p, m.p) : this.mobs[m.m | 0];
            if (!tgt || tgt.dead || tgt.alive === false || Math.hypot(tgt.x - p.x, tgt.y - p.y) > A.range + 0.8) return;
          }
          p.mp -= A.mp; p.abCd[i] = this.t + A.cd - 0.1;
          const pw = A.pw || 1, roll = () => (0.9 + Math.random() * 0.2) * this.buffMul(p) * pw * (1 + (M.dmg || 0));
          const around = (cx, cy, r) => this.mobs.filter(o => o.alive && Math.hypot(o.x - cx, o.y - cy) <= r);
          const foes = (cx, cy, r) => this.pvp ? around(cx, cy, r).concat([...this.players.values()].filter(o => o !== p && !o.dead && Math.hypot(o.x - cx, o.y - cy) <= r)) : around(cx, cy, r);
          const fireImm = o => MOBDEF[o.type].el === 'fire';
          let hits = 0, kills = 0;
          // effets d'un coup : ralentir, étourdir, saigner, brûler, vulnérabilité, repousser / attirer
          const onHit = o => {
            if (o.k == null) { if (o.dead) return; if (A.slow || M.slow) o.pslowT = this.t + 2; if (A.bleed || M.bleed || M.burn) { o.pburnT = this.t + 3; o.pburnDps = Math.max(1, p.atk * 0.1 * pw); o.pburnBy = p; } return; }
            if (!o.alive) return;
            if (A.slow || M.slow) { o.slowT = this.t + (A.slow || 0) * pw + (M.slow || 0); o.slowK = M.slowStrong ? 0.3 : 0.5; }
            const st = Math.max(A.stun || 0, M.stun || 0); if (st) o.stunT = this.t + st * pw;
            if (A.bleed || M.bleed) { o.bleedT = this.t + (A.bleed || 0) + (M.bleed || 0); o.bleedBy = p.id; o.bleedDps = Math.max(1, p.atk * 0.15 * pw * (1 + (M.bleedK || 0))); }
            if (M.burn && !fireImm(o)) { o.burnT = this.t + M.burn; o.burnBy = p.id; o.burnDps = Math.max(1, p.atk * 0.15 * pw); }
            if (M.vuln) { o.vulnT = this.t + M.vuln[1]; o.vulnK = M.vuln[0]; }
            if (M.push || M.pull) { const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy) || 1, s0 = M.push ? 1.2 : -Math.max(0, Math.min(1.2, d - 0.9)); if (s0) moveBy(this.W, o, dx / d * s0, dy / d * s0); }
          };
          const strike = (o, crit) => {
            if (o.k == null) { if (o.dead) return; const d0 = Math.round(p.atk * A.mult * roll() * (crit ? 1.8 : 1)); hits++; this.addMast(p, 1); this.hurt(o, d0, p, true); if (o.dead) kills++; else onHit(o); return; }
            if (!o.alive) return;
            let dmg = p.atk * A.mult * roll();
            if (M.execute && o.hp < o.maxhp * 0.3) dmg *= 2;
            if (M.slowBonus && o.slowT > this.t) dmg *= 1 + M.slowBonus;
            const c = !!(crit || M.crit || Math.random() < (M.critAdd || 0)); if (c) dmg *= 1.8;
            dmg = Math.round(dmg); hits++; this.hitMob(o, dmg, p, c);
            if (M.lifesteal) p.hp = Math.min(p.maxhp, p.hp + dmg * M.lifesteal);
            if (!o.alive) kills++; else onHit(o);
          };
          const chain = (from, n, r) => { const others = this.mobs.filter(o => o.alive && o !== from && Math.hypot(o.x - from.x, o.y - from.y) <= r).sort((a1, b1) => Math.hypot(a1.x - from.x, a1.y - from.y) - Math.hypot(b1.x - from.x, b1.y - from.y)).slice(0, n); for (const o of others) strike(o, false); return others; };
          const rounds = M.twice ? 2 : 1;
          if (A.kind === 'aoeSelf') { const L = foes(p.x, p.y, A.r); for (let q = 0; q < rounds; q++) for (const o of L) strike(o, false); }
          else if (A.kind === 'aoeTarget') { const L = foes(tgt.x, tgt.y, A.r); for (let q = 0; q < rounds; q++) for (const o of L) strike(o, false); if (M.chain) chain(tgt, M.chain, M.bounce ? 4 : 2.5); }
          else if (A.kind === 'single') { strike(tgt, Math.random() < p.crit); if (M.chain) chain(tgt, M.chain, 2.5); }
          else if (A.kind === 'charge') {
            const d = Math.hypot(tgt.x - p.x, tgt.y - p.y) || 1, nx = tgt.x - (tgt.x - p.x) / d * 0.8, ny = tgt.y - (tgt.y - p.y) / d * 0.8;
            if (this.W.walkable(Math.floor(nx), Math.floor(ny))) { p.x = nx; p.y = ny; p.lastMv = this.t; this.ev({ e: 'tp', id, x: p.x, y: p.y, dash: 1 }); }
            strike(tgt, false);
          }
          else if (A.kind === 'buff') {
            const until = this.t + (A.dur + (M.buffDur || 0)) * pw; p.buffT = until; p.buffK = M.buffDmg || 0; hits = 1;
            if (M.allies) for (const o of this.players.values()) if (o !== p && !o.dead && Math.hypot(o.x - p.x, o.y - p.y) <= 4) { o.buffT = until; o.buffK = p.buffK; }
            if (M.healSelf) { const h = Math.round(p.maxhp * M.healSelf); p.hp = Math.min(p.maxhp, p.hp + h); this.ev({ e: 'heal', id, v: h }); }
          }
          else if (A.kind === 'heal') {
            const h = Math.round(p.maxhp * 0.4 * pw); if (p.hp < p.maxhp) hits++; p.hp = Math.min(p.maxhp, p.hp + h); this.ev({ e: 'heal', id, v: h });
            for (const o of this.players.values()) if (o !== p && !o.dead && Math.hypot(o.x - p.x, o.y - p.y) <= 4 + (M.healRange || 0)) { if (o.hp < o.maxhp) hits++; const h2 = Math.round(o.maxhp * 0.25 * pw); o.hp = Math.min(o.maxhp, o.hp + h2); this.ev({ e: 'heal', id: o.id, v: h2, by: id }); }
            if (M.mana) p.mp = Math.min(p.maxmp, p.mp + p.maxmp * M.mana);
            if (M.shield) { p.shieldHP = Math.round(p.maxhp * M.shield); hits = Math.max(hits, 1); }
            if (M.regen) { p.regenT = this.t + M.regen[1]; p.regenPs = p.maxhp * M.regen[0] / M.regen[1]; }
          }
          // effets d'ensemble : zone d'impact, sol en feu, soin de zone, garde, vitesse, disparition, recharges
          const at = tgt || p;
          if (M.stunArea) for (const o of around(at.x, at.y, M.stunArea)) o.stunT = this.t + 1.5 * pw;
          if (M.zone && tgt) { this.zones.push({ x: tgt.x, y: tgt.y, r: 1.3, until: this.t + M.zone, dps: p.atk * 0.25 * pw, by: p.id, acc: 0 }); this.ev({ e: 'zone', x: +tgt.x.toFixed(2), y: +tgt.y.toFixed(2), r: 1.3, d: M.zone }); }
          if (M.healZone && tgt) for (const o of this.players.values()) if (!o.dead && Math.hypot(o.x - tgt.x, o.y - tgt.y) <= A.r) { const h3 = Math.round(o.maxhp * M.healZone); o.hp = Math.min(o.maxhp, o.hp + h3); this.ev({ e: 'heal', id: o.id, v: h3, by: id }); }
          if (M.guard) { p.guardT = this.t + M.guard[1]; p.guardK = M.guard[0]; }
          if (M.haste) p.hasteT = this.t + M.haste;
          if (M.stealth) { p.stealthT = this.t + M.stealth; for (const o of this.mobs) if (o.target === id) { o.target = null; o.returning = true; } }
          if (M.cdPerHit && hits) p.abCd[i] = Math.max(this.t, p.abCd[i] - hits * M.cdPerHit);
          if (M.killRefund && kills) p.abCd[i] = this.t + A.cd * (1 - M.killRefund);
          if (M.killReset && kills) { const j = K.ab.findIndex(o => o.name === M.killReset); if (j >= 0) p.abCd[j] = 0; }
          // expérience de compétence : rien si la technique ne sert à rien (lancée dans le vide, soin à pleine vie)
          if (hits && A.ti >= 0) this.addSk(p, K.fam + ':' + A.ti, A.kind === 'buff' ? 2 : 1 + Math.min(3, hits) + 2 * kills);
          this.ev({ e: 'ab', id, c: p.cls, a: i, m: tgt && tgt.k != null ? tgt.k : -1, pv: tgt && tgt.k == null ? tgt.id : undefined, fx: A.fx, n: A.name, r: A.r || 0, ar: M.arrows || 0, tw: M.twice ? 1 : 0 });
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
          if (T.slot === 'offhand') {
            if (weaponFam(p.equip) !== 'sword') { this.ev({ e: 'msg', id, t: 'Un bouclier se porte avec une épée à une main.' }); return; }
            if (mLevel(p.mast.sword || 0).lv < 5) { this.ev({ e: 'msg', id, t: 'Maîtrise Épée à une main 5 requise pour porter un bouclier.' }); return; }
          }
          const dropShield = T.slot === 'weapon' && p.equip.offhand && FAM_OF[T.icon] !== 'sword';
          if (dropShield && (p.equip.weapon ? p.bag.length : p.bag.length - 1) >= BAG_SIZE) { this.ev({ e: 'msg', id, t: 'Sac plein : range d\'abord ton bouclier.' }); return; }
          const old = p.equip[T.slot]; p.equip[T.slot] = inst; if (old) p.bag[b] = old; else p.bag.splice(b, 1);
          if (dropShield) { p.bag.push(p.equip.offhand); p.equip.offhand = null; this.ev({ e: 'msg', id, t: 'Bouclier rangé : il se porte avec une épée à une main.' }); }
          this.recalc(p); this.ev({ e: 'eq', id, t: inst[0], r: inst[1] }); break;
        }
        case 'unequip': {
          const sl = String(m.s); if (!SLOTS.includes(sl) || !p.equip[sl] || p.dead) return;
          if (p.bag.length >= BAG_SIZE) { this.ev({ e: 'msg', id, t: 'Ton sac est plein.' }); return; }
          p.bag.push(p.equip[sl]); p.equip[sl] = null; this.recalc(p); break;
        }
        case 'sell': {
          const b = m.b | 0, inst = p.bag[b]; if (!inst) return;
          if (ITEMS[inst[0]].fx === 'gm') { this.ev({ e: 'msg', id, t: 'Cet objet unique ne se vend pas.' }); return; }
          const v = itemValue(inst); p.gold += v; p.bag.splice(b, 1); this.ev({ e: 'sold', id, t: inst[0], r: inst[1], v }); break;
        }
        case 'scarf': { const sc = clampInt(m.s, 0, 2); if (p.scarves & (1 << sc)) p.scarf = sc; break; }
        case 'cross': {
          const b = this.W.bridges && this.W.bridges[m.b | 0]; if (!b || p.dead || p.trav) return;
          if (Math.hypot(p.x - b.ex, p.y - b.ey) > 1.6) return;
          let to;
          if (b.kind === 'ether') {
            if (p.ether < ETHER_BRIDGE) { this.ev({ e: 'msg', id, t: 'Il faut ' + ETHER_BRIDGE + " Éther pour traverser (l'Éther se gagne en marchant)." }); return; }
            p.ether -= ETHER_BRIDGE; to = rollIsle(this.W.isle);
          } else to = { k: 'bourg' };
          const fresh = !(p.isles & ISLE_BIT[to.k]); p.isles |= ISLE_BIT[to.k]; p.isle = to; p.trav = 1;
          p.arr = to.k === 'bourg' ? 0 : 1; // retour au bourg : on réapparaît à la fontaine
          this.ev({ e: 'travel', id, to, via: b.kind, fresh: fresh ? 1 : 0 }); break;
        }
        case 'loot': {
          const cp = this.corpses.find(o => o.id === (m.c | 0)); if (!cp || p.dead || Math.hypot(p.x - cp.x, p.y - cp.y) > 1.6) return;
          let n = 0; while (cp.items.length && p.bag.length < BAG_SIZE) { p.bag.push(cp.items.shift()); n++; }
          if (!n) { this.ev({ e: 'msg', id, t: 'Ton sac est plein.' }); return; }
          this.ev({ e: 'looted', id, n, of: cp.name, own: cp.name === p.name ? 1 : 0, left: cp.items.length });
          if (!cp.items.length) this.corpses = this.corpses.filter(o => o !== cp);
          break;
        }
        case 'chest': {
          const c = this.W.chest; if (!c || this.chestOpen || p.dead || Math.hypot(p.x - c.x, p.y - c.y) > 1.6) return;
          this.chestOpen = true; const pool = [...new Set(Object.values(LOOT).flatMap(l => l.items))], g = 20 + p.lvl * 12;
          p.gold += g; this.giveItem(p, [pool[Math.floor(Math.random() * pool.length)], rollRarity(2)]); this.giveItem(p, [pool[Math.floor(Math.random() * pool.length)], rollRarity(1)]);
          this.ev({ e: 'chest', id, g }); break;
        }
        case 'pt': { const k = String(m.s); if (!(k in p.pts) || freePts(p.lvl, p.pts) <= 0) return; p.pts[k]++; this.recalc(p); break; }
        case 'skc': {
          const k = String(m.k), [f, t] = k.split(':'), T = FAMS[f] && FAMS[f].tech[t | 0], j = m.j ? 1 : 0, c = m.c ? 1 : 0;
          if (!T || !T.ms || String(t | 0) !== t) return;
          if (skRank(p.sk[k] || 0, skCap(p.lvl)) < (j ? 8 : 4)) return;
          const cur = p.skc[k] || [-1, -1]; if (cur[j] >= 0) return; cur[j] = c; p.skc[k] = cur;
          this.ev({ e: 'skc', id, k, j, c, n: T.ms[j][c].n }); break;
        }
        case 'skcReset': {
          const npc = NPCS.elya; if (p.dead || Math.hypot(p.x - npc.x, p.y - npc.y) > 2.8) return;
          p.skc = {}; this.ev({ e: 'msg', id, t: 'Tes effets de techniques sont réinitialisés : choisis-les de nouveau dans l\'onglet Compétences.' }); break;
        }
        case 'respec': {
          const npc = NPCS.elya; if (p.dead || Math.hypot(p.x - npc.x, p.y - npc.y) > 2.8) return;
          const cost = p.fr ? 0 : respecCost(p.lvl); if (p.gold < cost) { this.ev({ e: 'msg', id, t: 'Il te faut ' + cost + ' pièces d\'or.' }); return; }
          p.gold -= cost; if (p.fr) p.fr = 0; p.pts = { str: 0, sta: 0, int: 0, agi: 0 }; this.recalc(p);
          this.ev({ e: 'msg', id, t: 'Points réinitialisés : ' + freePts(p.lvl, p.pts) + ' points à répartir.' }); break;
        }
        case 'bar': {
          const K = kitOf(p.equip, p.mast, p.bar), s0 = clampInt(m.s, 0, 2), ti = m.k | 0, A = K.F.tech[ti];
          if (!A || A.m > K.ml) return;
          const cur = K.ab.map(a => a.locked ? -1 : a.ti), j = cur.indexOf(ti);
          if (j >= 0) cur[j] = cur[s0]; cur[s0] = ti; p.bar[K.fam] = cur.filter(v => v >= 0); p.abCd = [0, 0, 0];
          break;
        }
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
    addSk(p, key, v) {
      const cap = skCap(p.lvl), before = skRank(p.sk[key] || 0, cap);
      p.sk[key] = Math.min(skTotal(Math.min(SK_MAX, cap + 1)), (p.sk[key] || 0) + v); // réserve : au plus un rang d'avance
      const after = skRank(p.sk[key], cap); if (after > before) this.ev({ e: 'skr', id: p.id, k: key, r: after });
    }
    addMast(p, v) {
      const fam = weaponFam(p.equip); if (fam === 'none') return;
      const before = mLevel(p.mast[fam] || 0).lv; p.mast[fam] = Math.min(MAST_CAP, (p.mast[fam] || 0) + v);
      const after = mLevel(p.mast[fam]).lv; if (after > before) this.ev({ e: 'ml', id: p.id, f: fam, lv: after });
    }
    hitMob(m, dmg, p, crit) {
      if (m.vulnT > this.t) dmg = Math.round(dmg * (1 + m.vulnK));
      if (MOBDEF[m.type].el === 'light') dmg = Math.max(1, Math.round(dmg * 0.8));
      m.hitT = this.t;
      m.hp -= dmg; m.tagged.add(p.id); this.addMast(p, 1);
      // effet de l'île, sauf sur les créatures du même élément (le feu ne brûle pas une gelée de braise)
      const el = MOBDEF[m.type].el, imm = (this.fx === 'slow' && el === 'ice') || (this.fx === 'burn' && el === 'fire');
      if (imm) { if (!(m.immT > this.t)) { m.immT = this.t + 4; this.ev({ e: 'imm', m: m.k, fx: this.fx }); } }
      else if (this.fx === 'slow') m.slowT = this.t + 2.5;
      else if (this.fx === 'burn') { m.burnT = this.t + 3; m.burnBy = p.id; m.burnDps = Math.max(1, dmg * 0.12); }
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
        this.gainXP(p, xp); this.addMast(p, m.type === 'boss' ? 30 : 2 + m.lvl);
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
      if (p.lvl >= MAX_LVL) { p.xp = 0; return; }
      p.xp += v;
      while (p.lvl < MAX_LVL && p.xp >= xpNeed(p.lvl)) {
        p.xp -= xpNeed(p.lvl); p.lvl++; this.recalc(p, true);
        this.ev({ e: 'lv', id: p.id, lv: p.lvl });
        // le plafond monte : les compétences « prêtes » passent leur rang
        for (const k in p.sk) { const a = skRank(p.sk[k], skCap(p.lvl - 1)), b = skRank(p.sk[k], skCap(p.lvl)); if (b > a) this.ev({ e: 'skr', id: p.id, k, r: b }); }
      }
      if (p.lvl >= MAX_LVL) p.xp = 0;
    }
    // un joueur adverse sur les îles (pvp) ; foe(p, id) : cible valide seulement si le combat entre joueurs est permis
    foe(p, id) { const o = this.players.get(String(id)); return this.pvp && o && o !== p && !o.dead ? o : null; }
    // dégâts subis par un héros : src = monstre, ou joueur (îles) ; raw : dégâts déjà tirés au sort
    hurt(p, dmg, m, raw) {
      if (p.dead) return;
      const isMob = m && m.k != null;
      dmg = Math.max(1, Math.round(dmg * (raw ? 1 : 0.85 + Math.random() * 0.3) * (1 - (p.red || 0)) * (p.buffT > this.t ? 0.7 : 1)));
      const blk = p.equip.offhand && weaponFam(p.equip) === 'sword' && mLevel(p.mast.sword || 0).lv >= 8 && Math.random() < 0.25 + 0.01 * (skRank(p.sk['sword:block'] || 0, skCap(p.lvl)) - 1);
      if (blk) this.addSk(p, 'sword:block', 2);
      if (blk) dmg = Math.max(1, Math.round(dmg * 0.25));
      if (p.guardT > this.t) dmg = Math.max(1, Math.round(dmg * (1 - p.guardK)));
      const src = isMob ? { m: m.k } : { m: -1, by: m && m.id };
      if (p.shieldHP > 0) { const a0 = Math.min(p.shieldHP, dmg); p.shieldHP -= a0; dmg -= a0; if (!dmg) { this.ev(Object.assign({ e: 'hp', id: p.id, v: 0, sh: 1 }, src)); return; } }
      p.hp -= dmg; p.lastHit = 0;
      // trait de l'élément du monstre
      const el = isMob ? MOBDEF[m.type].el : null;
      if (el === 'fire' && !p.dead) { p.pburnT = this.t + 3; p.pburnDps = Math.max(1, m.atk * 0.12); p.pburnBy = m; }
      else if (el === 'ice') p.pslowT = this.t + 2;
      else if (el === 'dark') m.hp = Math.min(m.maxhp, m.hp + dmg * 0.3);
      this.ev(Object.assign({ e: 'hp', id: p.id, v: dmg, b: blk ? 1 : 0 }, src));
      if (p.hp <= 0) this.die(p, isMob ? null : m);
    }
    die(p, killer) {
      p.hp = 0; p.dead = true; p.deadT = 5; p.moving = 0;
      const loss = Math.floor(p.xp * 0.1); p.xp -= loss;
      // îles : tout le sac reste sur le corps (sauf les objets uniques), pillable par n'importe qui pendant 3 minutes
      let drop = 0;
      if (this.pvp) {
        const lost = p.bag.filter(i => !ITEMS[i[0]].unique);
        if (lost.length) { this.corpses.push({ id: this.corpseN++, x: p.x, y: p.y, name: p.name, items: lost, until: this.t + 180 }); drop = lost.length; }
        p.bag = p.bag.filter(i => ITEMS[i[0]].unique);
      }
      this.ev({ e: 'die', id: p.id, loss, drop, by: killer ? killer.name : null });
      if (killer) this.ev({ e: 'ch', s: 1, t: killer.name + ' a vaincu ' + p.name + ' !' });
      for (const mm of this.mobs) if (mm.target === p.id) { mm.target = null; mm.returning = true; }
    }
    step(dt) {
      this.t += dt; const W = this.W;
      if (this.corpses.length) this.corpses = this.corpses.filter(o => o.until > this.t);
      for (const p of this.players.values()) {
        p.atkCd -= dt; p.skillCd -= dt; p.potCd -= dt; p.lastHit += dt;
        if (p.dead) {
          p.deadT -= dt;
          if (p.deadT <= 0) { p.dead = false; p.x = this.spawn.x; p.y = this.spawn.y; p.hp = p.maxhp; p.mp = p.maxmp; p.lastMv = this.t; this.ev({ e: 'rs', id: p.id }); this.ev({ e: 'tp', id: p.id, x: p.x, y: p.y }); }
          continue;
        }
        if (p.lastHit > 4) p.hp = Math.min(p.maxhp, p.hp + p.maxhp * 0.03 * dt);
        if (p.regenT > this.t) p.hp = Math.min(p.maxhp, p.hp + p.regenPs * dt);
        if (p.pburnT > this.t) { p.pburnAcc = (p.pburnAcc || 0) + p.pburnDps * dt; if (p.pburnAcc >= Math.max(1, p.pburnDps * 0.6)) { const v = Math.round(p.pburnAcc); p.pburnAcc = 0; p.hp -= v; p.lastHit = 0; this.ev({ e: 'hp', id: p.id, v, m: p.pburnBy.k != null ? p.pburnBy.k : -1, burn: 1 }); if (p.hp <= 0) { p.hp = 1; this.hurt(p, 1, p.pburnBy, true); if (p.dead) continue; } } }
        p.mp = Math.min(p.maxmp, p.mp + p.maxmp * 0.04 * dt);
        if (this.t - p.lastMv > 0.5) p.moving = 0;
      }
      for (let z = this.zones.length - 1; z >= 0; z--) {
        const Z = this.zones[z]; if (Z.until <= this.t) { this.zones.splice(z, 1); continue; }
        Z.acc += dt; if (Z.acc < 0.5) continue; Z.acc = 0; const zp = this.players.get(Z.by); if (!zp) continue;
        for (const o of this.mobs) if (o.alive && MOBDEF[o.type].el !== 'fire' && Math.hypot(o.x - Z.x, o.y - Z.y) <= Z.r) this.hitMob(o, Math.max(1, Math.round(Z.dps * 0.5)), zp, false);
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
        if (m.burnT > this.t) { m.burnAcc = (m.burnAcc || 0) + m.burnDps * dt; if (m.burnAcc >= Math.max(1, m.burnDps * 0.6)) { const v = Math.round(m.burnAcc); m.burnAcc = 0; m.hp -= v; this.ev({ e: 'hm', m: m.k, v, c: 0, by: m.burnBy, burn: 1 }); if (m.hp <= 0) { this.killMob(m); continue; } } }
        if (m.bleedT > this.t) { m.bleedAcc = (m.bleedAcc || 0) + m.bleedDps * dt; if (m.bleedAcc >= Math.max(1, m.bleedDps * 0.6)) { const v = Math.round(m.bleedAcc); m.bleedAcc = 0; m.hp -= v; this.ev({ e: 'hm', m: m.k, v, c: 0, by: m.bleedBy, bleed: 1 }); if (m.hp <= 0) { const bp = this.players.get(m.bleedBy); if (bp) m.tagged.add(bp.id); this.killMob(m); continue; } } }
        if (MOBDEF[m.type].el === 'wood' && !(m.hitT > this.t - 3) && m.hp < m.maxhp) m.hp = Math.min(m.maxhp, m.hp + m.maxhp * 0.02 * dt);
        if (m.stunT > this.t) continue;
        const slow = m.slowT > this.t ? (m.slowK || 0.5) : 1;
        let tp = m.target != null ? this.players.get(m.target) : null;
        if (m.target != null && (!tp || tp.dead)) { tp = null; m.target = null; m.returning = true; }
        if (!tp && !m.returning && m.aggressive) {
          let best = null, bd = m.aggroR;
          for (const p of this.players.values()) { if (p.dead || p.stealthT > this.t) continue; const d = Math.hypot(p.x - m.x, p.y - m.y); if (d < bd) { bd = d; best = p; } }
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
      for (const q of this.mobs) m.push([+q.x.toFixed(2), +q.y.toFixed(2), Math.max(0, Math.ceil(q.hp)), q.alive ? 1 : 0, q.target != null ? 1 : 0, q.moving ? 1 : 0, q.stunT > this.t ? 1 : q.burnT > this.t ? 3 : q.bleedT > this.t ? 4 : q.slowT > this.t ? 2 : 0]);
      return { p, m, c: this.chestOpen ? 1 : 0, cp: this.corpses.map(o => [o.id, +o.x.toFixed(2), +o.y.toFixed(2), o.items.length, o.name, Math.ceil(o.until - this.t)]) };
    }
    meState(id) {
      const p = this.players.get(id); if (!p) return null;
      return { hp: Math.ceil(p.hp), maxhp: p.maxhp, mp: Math.floor(p.mp), maxmp: p.maxmp, lvl: p.lvl, xp: p.xp, need: p.lvl >= MAX_LVL ? 0 : xpNeed(p.lvl), gold: p.gold, potions: p.potions, dead: p.dead ? 1 : 0, deadT: Math.ceil(p.deadT), speed: p.speed * (p.hasteT > this.t ? 1.3 : 1) * (p.pslowT > this.t ? 0.65 : 1), pburn: p.pburnT > this.t ? 1 : 0, pslow: p.pslowT > this.t ? 1 : 0, cls: p.cls, mast: p.mast, sk: p.sk, skc: p.skc, shield: Math.round(p.shieldHP || 0), stealth: p.stealthT > this.t ? 1 : 0, pts: p.pts, free: freePts(p.lvl, p.pts), bar: p.bar, fr: p.fr, rcost: respecCost(p.lvl), abCd: p.abCd.map(t => Math.max(0, +(t - this.t).toFixed(1))), buff: Math.max(0, +(p.buffT - this.t).toFixed(1)), q: p.q, qs: p.qs, qn: p.qn, inv: p.inv, equip: p.equip, bag: p.bag, stats: p.stats, crit: p.crit, red: p.red, ether: p.ether, glvl: p.glvl, gxp: p.gxp, gneed: gNeed(p.glvl), scarves: p.scarves, scarf: p.scarf, stepsToday: p.stepsToday, atk: p.atk };
    }
  }

  return { MAX_LVL, intCdK, techCd, ELEMENTS, SK_MAX, skNeed, skTotal, skCap, skRank, skInfo, skLvlFor, ISLES, FIXED_ISLES, ETHER_BRIDGE, ISLE_BIT, cleanIsle, CLASSES, FAMS, FAM_OF, START, MAST_MAX, mLevel, mTotal, weaponFam, kitOf, freePts, respecCost, SLOTS, SLOT_NAMES, RARITY, STAT_NAMES, ITEMS, BAG_SIZE, itemStats, itemValue, computeStats, RES, RECIPES, SCARVES, STEPS_PER_ETHER, DAILY_STEP_CAP, DAILY_GIFT, NODE_CD, gNeed, NPCS, QUESTS, VERSION, SEED, MW, MH, CX, CY, SPAWN, ZONES, MOBDEF, LOOK_MAX, mobStats, playerStats, xpNeed, buildWorld, canStand, moveBy, Sim, hash, vnoise, fbm, mulberry32, cleanName, cleanLook, GEAR_SLOTS, gearStr, parseGear };
});
