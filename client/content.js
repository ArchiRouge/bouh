/* Pixels Worlds — contenu du jeu : des données seulement, aucune logique.
   Monstres, objets et butin, armes et techniques, artisanat, PNJ et quêtes, îles, donjons et boss.
   Partagé par le client et le serveur, comme core.js (le moteur), qui le lit et le réexporte (C.ITEMS, C.MOBDEF…).
   Règle des sauvegardes : ne jamais retirer ni réordonner une entrée de ITEMS (les sacs gardent les numéros d'objets) ;
   on ajoute à la fin. Les dessins correspondants sont dans assets.js (monstres, icônes) et sprites.js (équipement porté). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EtheriaContent = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const ZONES = [
    [9, "Bourg d'Argel"],
    [15, 'Prairies de Lumen'],
    [20.5, 'Bois des Champis'],
    [99, 'Terres sauvages']
  ];
  /* Éléments des monstres : chacun a un trait en combat.
     Feu : ses coups brûlent · Eau : ses coups ralentissent · Bois : se régénère · Lumière : encaisse 20 % de moins · Ténèbres : draine la vie */
  const ELEMENTS = {
    fire: ['Feu', '#ff8a4a'],
    ice: ['Eau', '#7ab4ff'],
    wood: ['Bois', '#7ad070'],
    light: ['Lumière', '#fff0a0'],
    dark: ['Ténèbres', '#b88ae8']
  };
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
  const SLOTS = ['head', 'chest', 'legs', 'feet', 'weapon', 'trinket', 'offhand'];
  const SLOT_NAMES = {
    head: 'Tête',
    chest: 'Torse',
    legs: 'Jambes',
    feet: 'Pieds',
    weapon: 'Arme',
    trinket: 'Bijou',
    offhand: 'Main gauche'
  };
  const RARITY = [
    ['Commun', '#ece8f4', 1],
    ['Inhabituel', '#5ee870', 1.3],
    ['Rare', '#5aa8ff', 1.7],
    ['Épique', '#c47cff', 2.2],
    ['Unique', '#ff9a3c', 2.6]
  ];
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
    {
      n: 'Bottes du Néant',
      slot: 'feet',
      lvl: 1,
      icon: 'boots',
      c: '#7a5ad0',
      st: { agi: 3, sta: 2, armor: 3 },
      speed: 0.4,
      fx: 'void',
      unique: 1,
      lore: 'Chaque pas creuse un peu de vide dans le monde.'
    },
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
    {
      n: 'Diadème du Maître du jeu',
      slot: 'head',
      lvl: 1,
      icon: 'gmhelm',
      c: '#f0c040',
      st: { sta: 6, int: 6, armor: 12 },
      fx: 'gm',
      unique: 1,
      lore: "Forgé pour le maître du jeu. Il n'en existe qu'un."
    },
    {
      n: 'Armure du Maître du jeu',
      slot: 'chest',
      lvl: 1,
      icon: 'plate',
      c: '#f0c040',
      st: { sta: 9, str: 5, armor: 24 },
      fx: 'gm',
      unique: 1,
      lore: "L'or garde la mémoire de chaque monde créé."
    },
    {
      n: 'Jambières du Maître du jeu',
      slot: 'legs',
      lvl: 1,
      icon: 'pants',
      c: '#f0c040',
      st: { sta: 4, agi: 3, armor: 10 },
      fx: 'gm',
      unique: 1
    },
    {
      n: 'Solerets du Maître du jeu',
      slot: 'feet',
      lvl: 1,
      icon: 'boots',
      c: '#f0c040',
      st: { agi: 4, armor: 8 },
      speed: 0.4,
      fx: 'gm',
      unique: 1
    },
    {
      n: 'Lame du Maître du jeu',
      slot: 'weapon',
      lvl: 1,
      icon: 'sword',
      c: '#f0c040',
      st: { str: 11, agi: 5, sta: 4 },
      fx: 'gm',
      unique: 1
    },
    {
      n: 'Égide du Maître du jeu',
      slot: 'offhand',
      lvl: 1,
      icon: 'shield',
      c: '#f0c040',
      st: { armor: 16, sta: 6, str: 2 },
      fx: 'gm',
      unique: 1
    },
    {
      n: 'Grimoire du Maître du jeu',
      slot: 'weapon',
      lvl: 1,
      icon: 'tome',
      c: '#f0c040',
      st: { int: 12, sta: 4, agi: 3 },
      fx: 'gm',
      unique: 1,
      lore: "Le livre où le monde a été écrit ; l'orbe obéit à sa voix."
    },
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
    { n: 'Jambières de cendre', slot: 'legs', lvl: 6, icon: 'pants', c: '#5a3a3a', st: { agi: 3, armor: 7 } },
    // butin propre aux boss de donjon (63 à 72)
    { n: 'Couronne gluante', slot: 'head', lvl: 5, icon: 'crown', c: '#9ad07a', st: { sta: 3, int: 2, armor: 4 } },
    { n: 'Bâton noueux', slot: 'weapon', lvl: 5, icon: 'staff', c: '#8a6a3a', st: { int: 7, sta: 3 } },
    { n: 'Cape de brume', slot: 'chest', lvl: 10, icon: 'tunic', c: '#8a88aa', st: { agi: 5, sta: 4, armor: 11 } },
    { n: "Dard d'or", slot: 'weapon', lvl: 10, icon: 'dagger', c: '#ffd04a', st: { agi: 10, str: 3 } },
    { n: 'Masse de quartz', slot: 'weapon', lvl: 15, icon: 'great', c: '#f0a0c8', st: { str: 15, sta: 4 } },
    { n: 'Écailles de braise', slot: 'chest', lvl: 20, icon: 'plate', c: '#e0602a', st: { sta: 10, str: 5, armor: 24 } },
    { n: "Linceul d'ombre", slot: 'chest', lvl: 20, icon: 'tunic', c: '#3a2e5a', st: { int: 9, agi: 5, armor: 14 } },
    { n: 'Cœur de lave', slot: 'trinket', lvl: 25, icon: 'amulet', c: '#ff6a1a', st: { str: 8, sta: 8 } },
    { n: 'Sceptre glacial', slot: 'weapon', lvl: 25, icon: 'staff', c: '#8ad8ff', st: { int: 17, sta: 5 } },
    {
      n: 'Couronne du Dévoreur',
      slot: 'head',
      lvl: 1,
      icon: 'crown',
      c: '#ff4a7a',
      st: { str: 8, int: 8, sta: 8, armor: 12 },
      unique: 1,
      lore: "Arrachée au Dévoreur d'Éther. Elle bat comme un cœur."
    }
  ];
  const GM_EQUIP = [33, 34, 35, 36, 39],
    GM_BAG = [37, 38]; // le maître du jeu est mage : sceptre en main, lame et égide au sac
  // butin : un objet tombe rarement (≈ 3 %), dans la liste propre au monstre ; le Roi Gelée donne toujours quelque chose
  const LOOT = {
    slime: { ch: 0.03, items: [0, 1, 6, 9, 12, 14, 20, 25, 28, 30, 32, 40] },
    champi: { ch: 0.03, items: [7, 13, 15, 17, 1, 21, 25, 29] },
    ember: { ch: 0.035, items: [3, 4, 11, 16, 22, 26, 31] },
    frost: { ch: 0.035, items: [7, 13, 15, 26, 29, 31, 1, 21, 40] },
    boss: { ch: 1, items: [5, 8, 23, 27], minR: 2 },
    lapin: { ch: 0.03, items: [41, 12, 14] },
    abeille: { ch: 0.03, items: [42, 41] },
    loup: { ch: 0.035, items: [43, 44, 13] },
    chauvesouris: { ch: 0.03, items: [45, 44] },
    souche: { ch: 0.04, items: [46, 47, 10] },
    salamandre: { ch: 0.035, items: [48, 49, 16] },
    golem: { ch: 0.05, items: [50, 51, 18] },
    follet: { ch: 0.035, items: [52, 54] },
    spectre: { ch: 0.04, items: [53, 54] },
    pingouin: { ch: 0.03, items: [55, 56] },
    loupneige: { ch: 0.035, items: [56, 57, 43] },
    esprit: { ch: 0.035, items: [58, 26] },
    magma: { ch: 0.05, items: [59, 60] },
    cendre: { ch: 0.035, items: [61, 62] }
  };
  const UNIQUE_BOOTS = 24,
    UNIQUE_CHANCE = { frost: 0.001, boss: 0.05, ember: 0.002, champi: 0.001, slime: 0.0005 };
  /* ---------------- classes & compétences ---------------- */
  const CLASSES = [
    {
      id: 'war',
      name: 'Guerrier',
      desc: 'Combat au corps à corps, robuste et protecteur.',
      main: 'str',
      grow: { str: [3, 1.5], sta: [3, 1.3], int: [2, 0.5], agi: [2, 0.6] },
      basic: { name: 'Frappe', icon: 'slash', range: 1.3, cd: 0.45, mult: 1, fx: 'slash' },
      start: 0,
      ab: [
        {
          name: 'Tourbillon',
          icon: 'spin',
          lvl: 2,
          mp: 15,
          cd: 3,
          kind: 'aoeSelf',
          r: 2.4,
          mult: 1.5,
          fx: 'spin',
          desc: 'Frappe tous les ennemis autour de toi.'
        },
        {
          name: 'Charge',
          icon: 'charge',
          lvl: 5,
          mp: 12,
          cd: 7,
          kind: 'charge',
          range: 6,
          mult: 1.4,
          stun: 1.5,
          fx: 'charge',
          desc: "Fonce sur un ennemi et l'étourdit 1,5 s."
        },
        {
          name: 'Cri de guerre',
          icon: 'shout',
          lvl: 8,
          mp: 20,
          cd: 20,
          kind: 'buff',
          dur: 8,
          fx: 'shout',
          desc: '+40 % de dégâts et -30 % de dégâts subis pendant 8 s.'
        }
      ]
    },
    {
      id: 'arc',
      name: 'Archer',
      desc: 'Attaque à distance, précis et rapide.',
      main: 'agi',
      grow: { str: [2, 0.7], sta: [3, 1.0], int: [2, 0.6], agi: [3, 1.5] },
      basic: { name: 'Tir', icon: 'bow', range: 5, cd: 0.6, mult: 0.9, fx: 'arrow' },
      start: 20,
      ab: [
        {
          name: 'Volée',
          icon: 'volley',
          lvl: 2,
          mp: 15,
          cd: 4,
          kind: 'aoeTarget',
          range: 5,
          r: 2,
          mult: 1.0,
          fx: 'volley',
          desc: 'Une pluie de flèches touche la cible et ses voisins.'
        },
        {
          name: 'Flèche perçante',
          icon: 'pierce',
          lvl: 5,
          mp: 14,
          cd: 6,
          kind: 'single',
          range: 5.5,
          mult: 2.4,
          slow: 4,
          fx: 'pierce',
          desc: 'Gros dégâts et ralentit la cible 4 s.'
        },
        {
          name: "Pluie d'Éther",
          icon: 'rain',
          lvl: 8,
          mp: 25,
          cd: 12,
          kind: 'aoeTarget',
          range: 5,
          r: 3.2,
          mult: 1.6,
          fx: 'rain',
          desc: 'Déluge de flèches lumineuses sur une grande zone.'
        }
      ]
    },
    {
      id: 'mage',
      name: 'Mage',
      desc: "Maîtrise l'Éther : dégâts de zone et soins.",
      main: 'int',
      grow: { str: [2, 0.4], sta: [3, 0.9], int: [3, 1.6], agi: [2, 0.6] },
      basic: { name: "Trait d'Éther", icon: 'bolt', range: 4.5, cd: 0.7, mult: 1, fx: 'bolt' },
      start: 1,
      ab: [
        {
          name: 'Nova de givre',
          icon: 'frost',
          lvl: 2,
          mp: 18,
          cd: 6,
          kind: 'aoeSelf',
          r: 2.5,
          mult: 1.1,
          stun: 2,
          fx: 'frost',
          desc: 'Gèle les ennemis proches pendant 2 s.'
        },
        {
          name: 'Boule de feu',
          icon: 'fire',
          lvl: 5,
          mp: 16,
          cd: 4,
          kind: 'aoeTarget',
          range: 5,
          r: 1.3,
          mult: 2.2,
          fx: 'fire',
          desc: 'Explose sur la cible et brûle les ennemis voisins.'
        },
        {
          name: 'Soin lumineux',
          icon: 'heal',
          lvl: 8,
          mp: 25,
          cd: 12,
          kind: 'heal',
          fx: 'heal',
          desc: 'Rend 40 % de tes PV et 25 % aux alliés proches.'
        }
      ]
    }
  ];
  /* ---------------- armes : pas de classes, l'arme en main définit les attaques ----------------
     Chaque famille a une attaque de base et des techniques débloquées par sa maîtrise (1 à 20), gagnée en se battant avec.
     La barre d'actions porte 3 techniques au choix parmi celles débloquées pour l'arme en main. */
  const FAMS = {
    sword: {
      name: 'Épée à une main',
      stat: 'str',
      basic: { name: 'Frappe', icon: 'slash', range: 1.3, cd: 0.45, mult: 1, fx: 'slash' },
      tech: [
        {
          name: 'Tourbillon',
          icon: 'spin',
          m: 2,
          mp: 15,
          cd: 3,
          kind: 'aoeSelf',
          r: 2.4,
          mult: 1.5,
          fx: 'spin',
          desc: 'Frappe tous les ennemis autour de toi.'
        },
        {
          name: 'Taillade',
          icon: 'slash',
          m: 3,
          mp: 10,
          cd: 4,
          kind: 'single',
          range: 1.7,
          mult: 2.2,
          fx: 'slashx',
          desc: 'Un coup puissant sur une seule cible.'
        },
        {
          name: 'Charge',
          icon: 'charge',
          m: 6,
          mp: 12,
          cd: 7,
          kind: 'charge',
          range: 6,
          mult: 1.4,
          stun: 1.5,
          fx: 'charge',
          desc: "Fonce sur un ennemi et l'étourdit 1,5 s."
        },
        {
          name: 'Cri de guerre',
          icon: 'shout',
          m: 10,
          mp: 20,
          cd: 20,
          kind: 'buff',
          dur: 8,
          fx: 'shout',
          desc: '+40 % de dégâts et -30 % de dégâts subis pendant 8 s.'
        }
      ],
      caps: [
        { m: 5, name: 'Port du bouclier', desc: 'Tu peux tenir un bouclier en main gauche.' },
        { m: 8, name: 'Blocage', desc: 'Avec un bouclier : 25 % de chances de bloquer 75 % des dégâts.' }
      ]
    },
    great: {
      name: 'Arme à deux mains',
      stat: 'str',
      basic: { name: 'Coup lourd', icon: 'slash', range: 1.5, cd: 0.8, mult: 1.7, fx: 'slash' },
      tech: [
        {
          name: 'Moulinet',
          icon: 'spin',
          m: 2,
          mp: 18,
          cd: 4,
          kind: 'aoeSelf',
          r: 2.8,
          mult: 1.8,
          fx: 'spin',
          desc: 'Grand cercle qui frappe tout autour de toi.'
        },
        {
          name: 'Fendoir',
          icon: 'slash',
          m: 4,
          mp: 14,
          cd: 6,
          kind: 'single',
          range: 1.8,
          mult: 3,
          fx: 'slashx',
          desc: 'Un coup écrasant sur une seule cible.'
        },
        {
          name: 'Brise-garde',
          icon: 'charge',
          m: 7,
          mp: 16,
          cd: 9,
          kind: 'single',
          range: 1.8,
          mult: 1.6,
          stun: 2,
          fx: 'slashx',
          desc: 'Étourdit la cible 2 s.'
        },
        {
          name: 'Cri de guerre',
          icon: 'shout',
          m: 10,
          mp: 20,
          cd: 20,
          kind: 'buff',
          dur: 8,
          fx: 'shout',
          desc: '+40 % de dégâts et -30 % de dégâts subis pendant 8 s.'
        }
      ]
    },
    dagger: {
      name: 'Dagues',
      stat: 'agi',
      basic: { name: 'Coups rapides', icon: 'slash', range: 1.1, cd: 0.28, mult: 0.6, fx: 'slash' },
      tech: [
        {
          name: 'Saignement',
          icon: 'slash',
          m: 2,
          mp: 10,
          cd: 4,
          kind: 'single',
          range: 1.4,
          mult: 2,
          slow: 3,
          fx: 'slashx',
          desc: 'Entaille profonde qui ralentit la cible 3 s.'
        },
        {
          name: "Pas de l'ombre",
          icon: 'charge',
          m: 4,
          mp: 12,
          cd: 6,
          kind: 'charge',
          range: 5,
          mult: 1.8,
          stun: 0.8,
          fx: 'charge',
          desc: 'Surgit derrière un ennemi et frappe.'
        },
        {
          name: 'Danse des lames',
          icon: 'spin',
          m: 7,
          mp: 16,
          cd: 5,
          kind: 'aoeSelf',
          r: 2,
          mult: 1.7,
          fx: 'spin',
          desc: 'Tourbillon de lames autour de toi.'
        },
        {
          name: 'Coup dans le dos',
          icon: 'pierce',
          m: 11,
          mp: 18,
          cd: 8,
          kind: 'single',
          range: 1.4,
          mult: 3.6,
          fx: 'slashx',
          desc: 'Énormes dégâts sur une seule cible.'
        }
      ]
    },
    bow: {
      name: 'Arc',
      stat: 'agi',
      basic: { name: 'Tir', icon: 'bow', range: 5, cd: 0.6, mult: 0.9, fx: 'arrow' },
      tech: [
        {
          name: 'Volée',
          icon: 'volley',
          m: 2,
          mp: 15,
          cd: 4,
          kind: 'aoeTarget',
          range: 5,
          r: 2,
          mult: 1.0,
          fx: 'volley',
          desc: 'Une pluie de flèches touche la cible et ses voisins.'
        },
        {
          name: 'Flèche perçante',
          icon: 'pierce',
          m: 5,
          mp: 14,
          cd: 6,
          kind: 'single',
          range: 5.5,
          mult: 2.4,
          slow: 4,
          fx: 'pierce',
          desc: 'Gros dégâts et ralentit la cible 4 s.'
        },
        {
          name: "Pluie d'Éther",
          icon: 'rain',
          m: 8,
          mp: 25,
          cd: 12,
          kind: 'aoeTarget',
          range: 5,
          r: 3.2,
          mult: 1.6,
          fx: 'rain',
          desc: 'Déluge de flèches lumineuses sur une grande zone.'
        }
      ]
    },
    staff: {
      name: 'Bâton',
      stat: 'int',
      basic: { name: "Trait d'Éther", icon: 'bolt', range: 4.5, cd: 0.7, mult: 1, fx: 'bolt' },
      tech: [
        {
          name: 'Nova de givre',
          icon: 'frost',
          m: 2,
          mp: 18,
          cd: 6,
          kind: 'aoeSelf',
          r: 2.5,
          mult: 1.1,
          stun: 2,
          fx: 'frost',
          desc: 'Gèle les ennemis proches pendant 2 s.'
        },
        {
          name: 'Boule de feu',
          icon: 'fire',
          m: 5,
          mp: 16,
          cd: 4,
          kind: 'aoeTarget',
          range: 5,
          r: 1.3,
          mult: 2.2,
          fx: 'fire',
          desc: 'Explose sur la cible et brûle les ennemis voisins.'
        },
        {
          name: 'Soin lumineux',
          icon: 'heal',
          m: 8,
          mp: 25,
          cd: 12,
          kind: 'heal',
          fx: 'heal',
          desc: 'Rend 40 % de tes PV et 25 % aux alliés proches.'
        }
      ]
    },
    spear: {
      name: 'Lance',
      stat: 'str',
      basic: { name: 'Estoc', icon: 'pierce', range: 2, cd: 0.55, mult: 1.05, fx: 'thrust' },
      tech: [
        {
          name: 'Balayage',
          icon: 'spin',
          m: 2,
          mp: 15,
          cd: 4,
          kind: 'aoeSelf',
          r: 2.6,
          mult: 1.3,
          fx: 'spin',
          desc: 'Fauche les ennemis autour de toi.'
        },
        {
          name: 'Saut',
          icon: 'charge',
          m: 4,
          mp: 14,
          cd: 7,
          kind: 'charge',
          range: 5,
          mult: 1.6,
          stun: 1,
          fx: 'charge',
          desc: "Bondit sur un ennemi et l'étourdit 1 s."
        },
        {
          name: 'Empalement',
          icon: 'pierce',
          m: 7,
          mp: 16,
          cd: 6,
          kind: 'single',
          range: 2.3,
          mult: 2.6,
          slow: 4,
          fx: 'pierce',
          desc: 'Transperce la cible et la ralentit 4 s.'
        }
      ]
    },
    none: {
      name: 'Mains nues',
      stat: 'str',
      basic: { name: 'Coup de poing', icon: 'slash', range: 1.1, cd: 0.5, mult: 0.6, fx: 'slash' },
      tech: []
    }
  };
  /* Paliers des compétences : au rang 4 puis au rang 8, on choisit un effet parmi deux (modificateurs génériques
     appliqués au lancer : r rayon, range portée, cd recharge, dmg dégâts, bleed / burn durées, stun, slow, chain…). */
  const O = (id, n, d, mods) => ({ id, n, d, mods });
  const CRI = [
    [O('long', 'Prolongé', 'Dure 3 s de plus.', { buffDur: 3 }), O('rage', 'Rageur', '+15 % de dégâts en plus.', { buffDmg: 0.15 })],
    [
      O('ban', 'Bannière', 'Profite aussi aux alliés proches.', { allies: 1 }),
      O('souffle', 'Second souffle', 'Rend 15 % de tes PV.', { healSelf: 0.15 })
    ]
  ];
  const MS = {
    'sword:Tourbillon': [
      [O('large', 'Large', 'Rayon +0,6.', { r: 0.6 }), O('tranchant', 'Tranchant', 'Fait saigner 3 s.', { bleed: 3 })],
      [O('aimant', 'Aimant', 'Attire les ennemis vers toi.', { pull: 1 }), O('double', 'Double', 'Frappe deux fois.', { twice: 1 })]
    ],
    'sword:Taillade': [
      [O('hemo', 'Hémorragie', 'Fait saigner 4 s.', { bleed: 4 }), O('ecras', 'Écrasante', '+25 % de dégâts.', { dmg: 0.25 })],
      [
        O('exec', 'Exécution', 'Dégâts ×2 sur une cible sous 30 % de PV.', { execute: 1 }),
        O('garde', 'Garde', 'Tu subis 20 % de dégâts en moins pendant 3 s.', { guard: [0.2, 3] })
      ]
    ],
    'sword:Charge': [
      [O('longue', 'Longue', 'Portée +2.', { range: 2 }), O('rapide', 'Rapide', 'Recharge −2 s.', { cd: 2 })],
      [
        O('onde', 'Onde de choc', "Étourdit aussi les ennemis autour de l'impact.", { stunArea: 1.8 }),
        O('elan', 'Élan', '+30 % de vitesse pendant 3 s.', { haste: 3 })
      ]
    ],
    'sword:Cri de guerre': CRI,
    'great:Cri de guerre': CRI,
    'great:Moulinet': [
      [O('large', 'Large', 'Rayon +0,6.', { r: 0.6 }), O('lourd', 'Lourd', '+25 % de dégâts.', { dmg: 0.25 })],
      [O('tornade', 'Tornade', 'Deux tours.', { twice: 1 }), O('repousse', 'Repousser', 'Écarte les ennemis.', { push: 1 })]
    ],
    'great:Fendoir': [
      [
        O('trav', 'Traversant', "Touche aussi l'ennemi juste derrière.", { chain: 1 }),
        O('brutal', 'Brutal', '+25 % de dégâts.', { dmg: 0.25 })
      ],
      [
        O('bourreau', 'Bourreau', 'Si la cible meurt, la moitié de la recharge est rendue.', { killRefund: 0.5 }),
        O('fracas', 'Fracas', 'Étourdit 1 s.', { stun: 1 })
      ]
    ],
    'great:Brise-garde': [
      [
        O('long', 'Long', 'Étourdit 3 s.', { stun: 3 }),
        O('vuln', 'Vulnérable', 'La cible subit +20 % de dégâts pendant 3 s.', { vuln: [0.2, 3] })
      ],
      [O('zone', 'Zone', 'Étourdit aussi les voisins.', { stunArea: 1.8 }), O('rapide', 'Rapide', 'Recharge −3 s.', { cd: 3 })]
    ],
    'dagger:Saignement': [
      [
        O('profond', 'Profond', 'Le saignement dure 2 s de plus.', { bleed: 2 }),
        O('venin', 'Venin', 'Le saignement fait +50 % de dégâts.', { bleedK: 0.5 })
      ],
      [
        O('contagion', 'Contagion', 'Se propage à un ennemi voisin.', { chain: 1 }),
        O('saignee', 'Saignée', 'Te soigne de 30 % des dégâts.', { lifesteal: 0.3 })
      ]
    ],
    "dagger:Pas de l'ombre": [
      [O('vif', 'Vif', 'Recharge −2 s.', { cd: 2 }), O('long', 'Long', 'Portée +2.', { range: 2 })],
      [
        O('dispa', 'Disparition', 'Les monstres perdent ta trace 2 s.', { stealth: 2 }),
        O('embu', 'Embuscade', 'Coup critique garanti.', { crit: 1 })
      ]
    ],
    'dagger:Danse des lames': [
      [O('large', 'Large', 'Rayon +0,5.', { r: 0.5 }), O('affutee', 'Affûtée', '+25 % de dégâts.', { dmg: 0.25 })],
      [
        O('tempo', 'Tempo', 'Chaque ennemi touché réduit la recharge de 0,5 s.', { cdPerHit: 0.5 }),
        O('esquive', 'Esquive', 'Tu subis 30 % de dégâts en moins pendant 2 s.', { guard: [0.3, 2] })
      ]
    ],
    'dagger:Coup dans le dos': [
      [
        O('precis', 'Précis', '+20 % de chances de critique.', { critAdd: 0.2 }),
        O('perfo', 'Perforant', '+25 % de dégâts.', { dmg: 0.25 })
      ],
      [
        O('enchain', 'Enchaînement', "Recharge Pas de l'ombre si la cible meurt.", { killReset: "Pas de l'ombre" }),
        O('marque', 'Marque', 'La cible subit +15 % de dégâts pendant 4 s.', { vuln: [0.15, 4] })
      ]
    ],
    'bow:Volée': [
      [
        O('nourrie', 'Nourrie', 'Deux flèches de plus (+30 % de dégâts).', { dmg: 0.3, arrows: 2 }),
        O('large', 'Large', 'Rayon +0,5.', { r: 0.5 })
      ],
      [O('glu', 'Glu', 'Ralentit les ennemis touchés.', { slow: 2.5 }), O('feu', 'Feu', 'Enflamme 2 s.', { burn: 2 })]
    ],
    'bow:Flèche perçante': [
      [
        O('transp', 'Transperçante', 'Traverse deux ennemis de plus.', { chain: 2 }),
        O('lourde', 'Lourde', '+25 % de dégâts.', { dmg: 0.25 })
      ],
      [O('entrave', 'Entrave', 'Ralentissement bien plus fort.', { slowStrong: 1 }), O('recul', 'Recul', 'Repousse la cible.', { push: 1 })]
    ],
    "bow:Pluie d'Éther": [
      [O('double', 'Double', 'Frappe deux fois.', { twice: 1 }), O('large', 'Large', 'Rayon +0,6.', { r: 0.6 })],
      [O('benie', 'Bénie', 'Soigne les alliés dans la zone.', { healZone: 0.1 }), O('orage', 'Orage', 'Étourdit 0,5 s.', { stun: 0.5 })]
    ],
    'staff:Nova de givre': [
      [O('large', 'Large', 'Rayon +0,5.', { r: 0.5 }), O('mord', 'Mordante', '+25 % de dégâts.', { dmg: 0.25 })],
      [
        O('glac', 'Glaciale', 'Gel prolongé d’1 s.', { stun: 3 }),
        O('eclats', 'Éclats', 'Les ennemis gelés subissent +20 % de dégâts.', { vuln: [0.2, 4] })
      ]
    ],
    'staff:Boule de feu': [
      [O('brasier', 'Brasier', 'Laisse un feu au sol pendant 3 s.', { zone: 3 }), O('comete', 'Comète', 'Rayon +0,6.', { r: 0.6 })],
      [
        O('rebond', 'Rebond', 'Rebondit sur une deuxième cible.', { chain: 1, bounce: 1 }),
        O('combu', 'Combustion', 'Enflamme 4 s.', { burn: 4 })
      ]
    ],
    'staff:Soin lumineux': [
      [
        O('clarte', 'Clarté', 'Rend aussi 20 % de ton mana.', { mana: 0.2 }),
        O('ample', 'Ample', 'Soigne les alliés jusqu’à 2 cases plus loin.', { healRange: 2 })
      ],
      [
        O('egide', 'Égide', 'Bouclier qui absorbe 15 % de tes PV.', { shield: 0.15 }),
        O('renouv', 'Renouveau', 'Soigne encore 20 % de tes PV en 4 s.', { regen: [0.2, 4] })
      ]
    ],
    'spear:Balayage': [
      [O('repousse', 'Repousser', 'Écarte les ennemis.', { push: 1 }), O('large', 'Large', 'Rayon +0,6.', { r: 0.6 })],
      [
        O('fauch', 'Faucheuse', '+30 % de dégâts aux ennemis ralentis.', { slowBonus: 0.3 }),
        O('riposte', 'Riposte', 'Tu subis 20 % de dégâts en moins pendant 3 s.', { guard: [0.2, 3] })
      ]
    ],
    'spear:Saut': [
      [O('long', 'Long', 'Portée +2.', { range: 2 }), O('vif', 'Vif', 'Recharge −2 s.', { cd: 2 })],
      [O('impact', 'Impact', "Étourdit tout autour de l'impact.", { stunArea: 2 }), O('ecras', 'Écrasant', 'Étourdit 2 s.', { stun: 2 })]
    ],
    'spear:Empalement': [
      [O('trav', 'Traversant', 'Traverse un ennemi de plus.', { chain: 1 }), O('profond', 'Profond', '+25 % de dégâts.', { dmg: 0.25 })],
      [O('clouer', 'Clouer', 'Étourdit 1 s.', { stun: 1 }), O('hemo', 'Hémorragie', 'Fait saigner 4 s.', { bleed: 4 })]
    ]
  };
  for (const f in FAMS) for (const T of FAMS[f].tech) T.ms = MS[f + ':' + T.name] || null;
  FAMS.dagger.tech[0].bleed = 3;
  FAMS.dagger.tech[0].desc = 'Entaille profonde : saigne 3 s et ralentit la cible.';
  const FAM_OF = {
    sword: 'sword',
    axe: 'great',
    great: 'great',
    dagger: 'dagger',
    bow: 'bow',
    staff: 'staff',
    tome: 'staff',
    spear: 'spear'
  };
  // armes de départ proposées à la création (l'ancien champ « cls » des sauvegardes garde ce sens : 0 épée, 1 arc, 2 bâton)
  const START = [
    [0, 'sword'],
    [20, 'bow'],
    [1, 'staff'],
    [28, 'dagger'],
    [30, 'spear'],
    [32, 'great']
  ];
  const RES = {
    herb: { name: 'Herbe lumineuse', plural: 'Herbes', req: 1, gxp: 4 },
    wood: { name: "Bois d'Éther", plural: 'Bois', req: 3, gxp: 6 },
    quartz: { name: 'Quartz rose', plural: 'Quartz', req: 5, gxp: 9 }
  };
  const SCARVES = [
    ['#ee7a86', '#ffc0c0', '#c0506a', 'Corail'],
    ['#7ec4ee', '#d4f0ff', '#4a86c0', 'Ciel'],
    ['#b08ae8', '#e8d4ff', '#7650b8', "d'Éther"]
  ];
  const RECIPES = [
    { id: 'potion', npc: 'mira', name: "Potions d'herbes", desc: '+2 potions', req: 1, cost: { herb: 3 }, potions: 2 },
    { id: 'scarf1', npc: 'mira', name: 'Écharpe ciel', desc: "Nouvelle couleur d'écharpe", req: 2, cost: { herb: 6 }, scarf: 1 },
    { id: 'blade', npc: 'bran', name: 'Lame de saule', desc: 'Arme inhabituelle (nv3)', req: 3, cost: { wood: 6, herb: 2 }, item: [2, 1] },
    {
      id: 'armor',
      npc: 'bran',
      name: 'Tunique tressée',
      desc: 'Torse inhabituel (nv4)',
      req: 4,
      cost: { wood: 8, quartz: 2 },
      item: [10, 1]
    },
    {
      id: 'scarf2',
      npc: 'mira',
      name: "Écharpe d'Éther",
      desc: 'Écharpe violette scintillante',
      req: 5,
      cost: { quartz: 4, herb: 4 },
      scarf: 2
    },
    { id: 'charm', npc: 'bran', name: 'Talisman de quartz', desc: 'Bijou rare (nv6)', req: 6, cost: { quartz: 6, wood: 4 }, item: [18, 2] },
    { id: 'bow', npc: 'bran', name: 'Arc de saule', desc: 'Arc inhabituel (nv3)', req: 3, cost: { wood: 6, herb: 2 }, item: [21, 1] },
    {
      id: 'shield',
      npc: 'bran',
      name: 'Bouclier de bois',
      desc: 'Bouclier inhabituel (main gauche)',
      req: 2,
      cost: { wood: 5 },
      item: [25, 1]
    },
    {
      id: 'spear',
      npc: 'bran',
      name: 'Lance de frêne',
      desc: 'Lance inhabituelle (nv1)',
      req: 2,
      cost: { wood: 5, herb: 2 },
      item: [30, 1]
    }
  ];
  /* ---------------- histoire & quêtes ---------------- */
  const NPCS = {
    elya: {
      id: 'elya',
      name: 'Elya',
      role: 'Gardienne de la fontaine',
      x: 27.25,
      y: 29.75,
      look: [1, 3, 6, 0, 1],
      idle: ["Le cristal brillait autrefois au-dessus de la fontaine… J'entends encore son chant.", 'Prends soin de toi, voyageur.']
    },
    mira: {
      id: 'mira',
      name: 'Mira',
      role: 'Herboriste',
      x: 32.5,
      y: 27.4,
      look: [0, 6, 2, 1, 3],
      idle: ['Ces herbes ? Elles soignent presque tout. Presque.', 'Les gelées sentent la menthe, tu savais ?']
    },
    bran: {
      id: 'bran',
      name: 'Bran',
      role: 'Forgeron',
      x: 24.6,
      y: 25.0,
      look: [2, 1, 1, 2, 2],
      idle: ["Une lame bien entretenue, c'est la moitié du combat.", "Mon enclume s'ennuie depuis que les apprentis ont peur du bois."]
    }
  };
  const QUESTS = [
    {
      giver: 'elya',
      reward: [6, 1],
      title: 'Premiers pas',
      type: 'kill',
      mob: 'slime',
      n: 5,
      short: 'Gelées vertes',
      obj: 'Vaincre 5 Gelées vertes dans les Prairies de Lumen',
      xp: 40,
      gold: 20,
      pot: 2,
      intro:
        "Ah, te voilà enfin réveillé ! La nuit de l'Éclat, le Cristal d'Éther qui veillait sur notre île s'est brisé. Depuis, les gelées pullulent dans les prairies. Montre-moi ce que tu vaux : chasses-en cinq.",
      wait: "Les gelées vertes rôdent juste après le bourg, dans les prairies. Elles ne t'attaqueront pas les premières.",
      done: "Bien joué ! Tu as l'étoffe d'un gardien. Mira l'herboriste, près des maisons à l'est de la fontaine, aura besoin de toi."
    },
    {
      giver: 'mira',
      title: 'Gelée en bocal',
      type: 'loot',
      mob: 'slime',
      item: 'Gelée visqueuse',
      drop: 0.6,
      n: 4,
      short: 'Gelées visqueuses',
      obj: 'Récupérer 4 Gelées visqueuses sur les Gelées vertes',
      xp: 55,
      gold: 25,
      pot: 2,
      intro:
        "Bonjour, toi ! Ces gelées ont absorbé un peu de l'Éther du cristal. Avec quatre Gelées visqueuses, je peux préparer des potions pour tout le bourg.",
      wait: "Toutes les gelées n'en lâchent pas. Persévère !",
      done: "Merveilleux, elles brillent encore ! Voilà des potions pour toi. Bran, le forgeron, cherche quelqu'un d'assez courageux pour le Bois des Champis."
    },
    {
      giver: 'bran',
      reward: [13, 1],
      title: 'Le Bois des Champis',
      type: 'kill',
      mob: 'champi',
      n: 6,
      short: 'Champis des bois',
      obj: 'Vaincre 6 Champis des bois au-delà des prairies',
      xp: 110,
      gold: 45,
      pot: 1,
      intro:
        "Hm. C'est toi, le nouveau ? Depuis l'Éclat, les Champis du bois sont devenus enragés. Ils mordent mes apprentis ! Va en calmer six. Attention : eux, ils attaquent à vue.",
      wait: 'Six Champis. Pas cinq, six. Et reviens entier.',
      done: 'Pas mal du tout. Mira voudra sûrement voir ce que ces Champis transportent… elle est passée me demander.'
    },
    {
      giver: 'mira',
      title: 'Spores lumineuses',
      type: 'loot',
      mob: 'champi',
      item: 'Spore lumineuse',
      drop: 0.5,
      n: 5,
      short: 'Spores lumineuses',
      obj: 'Récupérer 5 Spores lumineuses sur les Champis des bois',
      xp: 140,
      gold: 50,
      pot: 2,
      intro:
        "Les Champis brillent la nuit, maintenant. Leurs spores sont imprégnées d'Éther ! Rapporte-m'en cinq, je veux comprendre où va l'énergie du cristal.",
      wait: 'Les spores sont fragiles, ramasse-les avec douceur.',
      done: "Elles pointent toutes dans la même direction… vers les Terres sauvages. Elya doit le savoir, mais d'abord, Bran voudra t'y préparer."
    },
    {
      giver: 'bran',
      reward: [16, 2],
      title: 'Braises errantes',
      type: 'kill',
      mob: 'ember',
      n: 6,
      short: 'Gelées de braise',
      obj: 'Vaincre 6 Gelées de braise dans les Terres sauvages',
      xp: 220,
      gold: 80,
      pot: 2,
      intro:
        "Les Terres sauvages, c'est autre chose. Les Gelées de braise y brûlent tout ce qui bouge. Si tu en abats six, je saurai que tu es prêt pour la suite.",
      wait: "Ne te bats pas seul là-bas si tu peux l'éviter. À plusieurs, on gagne plus d'expérience.",
      done: "Tu reviens avec des cheveux, c'est bon signe ! Va voir Elya, elle a une dernière chose à te demander."
    },
    {
      giver: 'elya',
      title: "Éclats d'Éther",
      type: 'loot',
      mob: 'ember',
      item: "Éclat d'Éther",
      drop: 0.4,
      n: 3,
      short: "Éclats d'Éther",
      obj: "Récupérer 3 Éclats d'Éther sur les Gelées de braise",
      xp: 260,
      gold: 90,
      pot: 2,
      intro:
        "Les spores de Mira avaient raison : les éclats du cristal ont été avalés par les Gelées de braise. Rapporte-m'en trois. Si je les réunis, ils nous diront ce qui s'est passé cette nuit-là.",
      wait: 'Les éclats sont chauds au toucher. Tu les reconnaîtras.',
      done: "Les éclats murmurent un nom… le Roi Gelée. C'est lui qui a brisé le cristal pour se nourrir de son Éther."
    },
    {
      giver: 'elya',
      reward: [19, 3],
      title: 'Le Roi Gelée',
      type: 'kill',
      mob: 'boss',
      n: 1,
      short: 'Roi Gelée',
      obj: "Vaincre le Roi Gelée au bout de l'île (en groupe !)",
      xp: 600,
      gold: 250,
      pot: 5,
      intro:
        "Il dort au bout de l'île, gorgé d'Éther. Seul, tu n'as aucune chance : rassemble d'autres aventuriers et terrassez-le ensemble. Chaque héros qui le frappe sera récompensé.",
      wait: "Appelle à l'aide dans le tchat. Pixels Worlds se défend à plusieurs.",
      done: "Le cristal… il recommence à chanter ! Grâce à toi et à tes compagnons, Pixels Worlds respire de nouveau. Merci, gardien. Ce n'est que le début de l'histoire."
    }
  ];

  const ISLES = {
    bourg: { name: "Bourg d'Argel", theme: 'bourg' },
    givre: {
      name: 'Île Givrée',
      theme: 'givre',
      seed: 7101,
      fx: 'slow',
      mobs: ['frost', 'frost', 'pingouin', 'loupneige', 'esprit', 'champi', 'slime'],
      res: ['quartz', 'wood'],
      trees: ['pine', 'pine', 'pine', 'oak', 'rock'],
      desc: 'Le froid mord : tes coups ralentissent les ennemis (sauf les créatures de givre).'
    },
    braise: {
      name: 'Île des Braises',
      theme: 'braise',
      seed: 7202,
      fx: 'burn',
      mobs: ['ember', 'salamandre', 'magma', 'cendre', 'ember', 'champi', 'slime'],
      res: ['quartz', 'herb'],
      trees: ['rock', 'rock', 'pine', 'bush', 'oak'],
      desc: 'La terre brûle : tes coups enflamment les ennemis (sauf les créatures de feu).'
    },
    donjon: { name: 'Donjon', theme: 'donjon' },
    brume: {
      name: 'Île de Brume',
      theme: 'brume',
      eph: 1,
      mobs: ['follet', 'spectre', 'loup', 'chauvesouris', 'souche', 'slime', 'champi', 'frost'],
      res: ['herb', 'wood', 'quartz'],
      trees: ['oak', 'pine', 'blossom', 'bush'],
      desc: "Île éphémère : un coffre rare t'attend. Elle disparaîtra quand tu partiras."
    }
  };
  const FIXED_ISLES = ['givre', 'braise'];
  const DG = [
    {
      n: 'Commun',
      c: '#ece8f4',
      w: 45,
      size: 5,
      lvl: 0,
      elite: 0,
      trap: 0,
      loops: 0.1,
      light: 1,
      name: 'Caveau',
      mobs: ['slime', 'chauvesouris', 'champi', 'souche']
    },
    {
      n: 'Inhabituel',
      c: '#5ee870',
      w: 28,
      size: 7,
      lvl: 1,
      elite: 1,
      trap: 0,
      loops: 0.08,
      light: 0.9,
      name: 'Racines',
      mobs: ['souche', 'champi', 'loup', 'abeille']
    },
    {
      n: 'Rare',
      c: '#5aa8ff',
      w: 17,
      size: 9,
      lvl: 2,
      elite: 2,
      trap: 6,
      loops: 0.07,
      light: 0.8,
      name: 'Grotte de cristal',
      mobs: ['golem', 'esprit', 'follet', 'chauvesouris']
    },
    {
      n: 'Épique',
      c: '#c47cff',
      w: 8,
      size: 11,
      lvl: 3,
      elite: 4,
      trap: 10,
      loops: 0.06,
      light: 0.7,
      name: "Catacombes d'Éther",
      mobs: ['spectre', 'chauvesouris', 'follet', 'loup']
    },
    {
      n: 'Légendaire',
      c: '#ffb43a',
      w: 2,
      size: 13,
      lvl: 5,
      elite: 6,
      trap: 16,
      loops: 0.04,
      light: 0.62,
      name: 'Salle dorée',
      mobs: ['magma', 'salamandre', 'golem', 'spectre']
    }
  ];
  const DG_MYTH = { n: 'Mythique', c: '#ff4a7a' };
  // boss : dessin (type de monstre), rareté (5 = mythique), objet propre, titre (bit de « ttl »)
  const DG_BOSSES = [
    { type: 'boss', n: 'Roi Gelée', r: 0, item: 63 },
    { type: 'souche', n: 'Souche ancestrale', r: 0, item: 64 },
    { type: 'loup', n: 'Grand Loup des brumes', r: 1, item: 65 },
    { type: 'abeille', n: 'Reine des abeilles', r: 1, item: 66 },
    { type: 'golem', n: 'Golem de cristal ancien', r: 2, item: 67 },
    { type: 'salamandre', n: 'Salamandre-reine', r: 3, item: 68 },
    { type: 'spectre', n: 'Spectre couronné', r: 3, item: 69 },
    { type: 'magma', n: 'Colosse de magma', r: 4, item: 70, title: 1 },
    { type: 'esprit', n: 'Liche de Givre', r: 4, item: 71, title: 2 },
    { type: 'spectre', n: "Le Dévoreur d'Éther", r: 5, item: 72, title: 4 }
  ];
  const TITLES = [
    [1, 'Fléau du Colosse'],
    [2, 'Fléau de la Liche'],
    [4, "Dévoreur d'Éther"]
  ];
  const DG_ITEM_CH = [0.05, 0.06, 0.07, 0.09, 0.12, 1],
    DG_MYTH_IN = [1000, 500, 250, 120, 40],
    DG_BOSS_HP = [8, 9, 10, 12, 14, 20];

  return {
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
  };
});
