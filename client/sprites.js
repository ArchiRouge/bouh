/* Pixels Worlds — personnages en pixel art posé à la main (style validé : chevalier « test pixel par pixel »).
   Chaque pièce est une grille dessinée pixel par pixel, en couches : cheveux, visage, torse, bras, jambes,
   bottes, couvre-chef, arme, cape. Les chiffres 1–5 sont les tons de la matière de la couche (sombre → clair),
   recoloriés selon l'objet porté ; les lettres sont des couleurs fixes (peau, yeux, cheveux, or, cuir, bois).
   Coordonnées : grille de 38 de large (axe entre les colonnes 18 et 19), tête en haut (ligne 0), pieds ligne 45.
   Le peintre ajoute une marge (OX, OY) et un contour teinté par matière. Ce fichier ne dépend pas du DOM :
   il peint dans un tableau RGBA, ce qui permet de le tester hors navigateur. */
(function () {
  'use strict';
  const OX = 10,
    OY = 9,
    W = 58,
    H = 57; // sprite final 58×57 (marge pour les coups d'arme), pieds (contour compris) en y = 55, centre x = 28.5
  const FOOT_Y = 55,
    CX = 28.5;
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];

  /* ---------- palettes ---------- */
  const HAIR = [
    ['#2e1610', '#4a2618', '#6e3c22', '#94582e', '#b87a44', '#e0a868'], // châtain
    ['#4a1e22', '#7a3026', '#a8482e', '#d0703c', '#f0a058', '#ffd08a'], // roux
    ['#6a3c10', '#a8701c', '#d8a02a', '#f0c840', '#ffe478', '#fff6c0'], // blond
    ['#3a3c5a', '#5e6488', '#8a90b4', '#b4bad8', '#dce0f2', '#ffffff'], // argent
    ['#10123a', '#1c2260', '#2c3a8e', '#4060bc', '#6a8ae0', '#a8c0ff'], // nuit
    ['#0e3a24', '#16582e', '#22803c', '#3cac4e', '#6ed070', '#b0f0a0'], // sylve
    ['#5a1040', '#8a2060', '#c03a88', '#e860aa', '#ff90c8', '#ffc8e4'] // rose
  ].map(r => r.map(hex));
  const SKIN = [
    // s t u v (clair → sombre)
    ['#f4dcc6', '#e2b898', '#c48a72', '#94604f'],
    ['#e8c49a', '#cf9c72', '#a87052', '#7a4838'],
    ['#b88058', '#966042', '#744630', '#4e2e22']
  ].map(r => r.map(hex));
  const TUNIC = ['#2e4a92', '#94303a', '#386e46', '#a8742c', '#603c92', '#44465a', '#2a7882']; // couleur de tenue choisie à la création
  const STEEL = ['#2e3450', '#545c80', '#8a94b4', '#c4cce0', '#f4f8ff'].map(hex);
  const GOLD = ['#7a4a14', '#c08a2a', '#f0c850', '#fff0a0'].map(hex);
  const FIX = {
    w: hex('#ffffff'),
    k: hex('#1e1424'),
    i: hex('#5a7ea8'),
    j: hex('#1e2840'),
    l: hex('#8ad8ff'),
    m: hex('#c0505a'),
    L: hex('#3a2018'),
    M: hex('#6a3c22'),
    N: hex('#9a6038'),
    o: hex('#4a2a14'),
    O: hex('#7a4a22'),
    P: hex('#b07a40'),
    n: hex('#2a2438'),
    R: hex('#e02a3a'),
    Q: hex('#ff9aa0')
  };
  // rampe de 5 tons à partir d'une couleur : ombres décalées vers le violet, lumières vers le crème
  function ramp5(h) {
    const b = hex(h),
      sh = [30, 18, 60],
      li = [255, 248, 228];
    return [mix(mix(b, [0, 0, 0], 0.55), sh, 0.35), mix(mix(b, [0, 0, 0], 0.28), sh, 0.18), b, mix(b, li, 0.38), mix(b, li, 0.72)];
  }
  // métal teinté par la couleur de l'objet
  const metal = (h, k) => ramp5(h).map((c, i) => mix(c, STEEL[i], k == null ? 0.55 : k));
  const DEF_LEGS = ramp5('#3c3256'),
    DEF_FEET = ramp5('#6a3c22');

  /* ---------- FACE (vue de face) ---------- */
  const F = {};
  F.face = [
    [11, 10, 'tttttttttttttttttt'],
    [12, 10, 'tttttttttttttttttt'],
    [13, 10, 'tssssssssssssssstu'],
    [14, 10, 'tssaaassssssaaastu'],
    [15, 10, 'ssskkksssssskkksst'],
    [16, 10, 'ssswjissssssijwstt'],
    [17, 10, 'ssstttssstsstttstt'],
    [18, 10, 'sstssssssusssssttt'],
    [19, 10, 'tssssssstussssssut'],
    [20, 10, 'ttsssssvuuvsssssut'],
    [21, 12, 'ttsssssssssttu'],
    [22, 15, 'vuuuuuuv']
  ];
  F.blink = [
    [15, 10, 'ssssssssssssssssst'],
    [16, 10, 'ssskkksssssskkkstt']
  ];
  // cheveux : 0 courte (ronde), 1 longue, 2 épis (le modèle validé)
  const HAIR_SIDES = [
    [5, 7, 'eeffeeedddddccddcccccbbb'],
    [6, 7, 'effffeeddddcddddcccccbba'],
    [7, 6, 'deefffeddddcddddcccccccbba'],
    [8, 6, 'dceeeeddcddddddcccccccbbba'],
    [9, 6, 'deedddcdddddddccccccccbbba'],
    [10, 6, 'dedddcddddddcccccccccccbba'],
    [11, 5, 'cdddcdddcddddccdcccccccccbbb'],
    [12, 5, 'cddcdccb.cdcb.cdcb.ccb.ccbbb'],
    [13, 5, 'cddcb...cb..ccb..cb....bccbb'],
    [14, 5, 'cdcba..................abcbb'],
    [15, 5, 'cddcba.................bccbb'],
    [16, 5, 'cddcba................abccbb'],
    [17, 6, 'cdcba................abccb'],
    [18, 6, 'cdcba................abcbb'],
    [19, 6, 'acbaa.................abba'],
    [20, 7, 'cbaa.................bba'],
    [21, 8, 'cb'],
    [21, 27, 'bb']
  ];
  F.hair = [
    [[2, 12, 'eeeddddddcccbb'], [3, 10, 'eeeedddddddccccbbb'], [4, 9, 'eeeddeedddcccdccccbb'], ...HAIR_SIDES],
    [[2, 12, 'eeeddddddcccbb'], [3, 10, 'eeeedddddddccccbbb'], [4, 9, 'eeeddeedddcccdccccbb'], ...HAIR_SIDES],
    [
      [0, 19, 'ee'],
      [1, 13, 'ed'],
      [1, 18, 'edd'],
      [1, 25, 'c'],
      [2, 12, 'edd'],
      [2, 17, 'eeddc'],
      [2, 24, 'ccb'],
      [3, 9, 'e'],
      [3, 11, 'eeddd'],
      [3, 16, 'eedddcc'],
      [3, 23, 'cccbb'],
      [3, 30, 'b'],
      [4, 8, 'eeedddeedddcccddcccccbb'],
      ...HAIR_SIDES
    ]
  ];
  // cheveux longs : mèches qui tombent derrière les épaules (peintes avant le corps)
  F.hairBack = [];
  for (let y = 19; y <= 30; y++) {
    const t = y < 25 ? 0 : y < 29 ? 1 : 2;
    F.hairBack.push([y, 4 + t, ['acdcb', 'acdb', 'acb'][t]]);
    F.hairBack.push([y, 29, ['bccba', 'bcba', 'bba'][t]]);
  }
  F.hairBack.push([31, 7, 'b'], [31, 29, 'a']);

  /* ---------- TORSE (vue de face) ---------- */
  // tunique de tissu (tenue par défaut et tuniques)
  F.tunic = {
    body: [
      [23, 12, '34445tsst54332'],
      [24, 12, '344445tt543321'],
      [25, 12, '344444yy443321'],
      [26, 12, '34434444443321'],
      [27, 12, '34443444443221'],
      [28, 12, '33443444433221'],
      [29, 12, '23443344433211'],
      [30, 12, '23333333332211'],
      [31, 12, '12333333322211'],
      [32, 12, 'LMMNNMyyMMMMML'],
      [33, 12, 'LLMMMMGGMMMLLL'],
      [34, 11, '2344444444443321'],
      [35, 11, '2344434444433321'],
      [36, 11, '1233323333332211'],
      [37, 11, 'gGGGGGGGGGGGGggg']
    ],
    armL: [
      [23, 9, '234'],
      [24, 8, '2344'],
      [25, 8, '2344'],
      [26, 8, '2343'],
      [27, 8, '2343'],
      [28, 8, '1232'],
      [29, 8, 'gGGg'],
      [30, 8, 'sttu'],
      [31, 8, 'stuv']
    ],
    armR: [
      [23, 26, '432'],
      [24, 26, '4321'],
      [25, 26, '3321'],
      [26, 26, '3321'],
      [27, 26, '3221'],
      [28, 26, '2211'],
      [29, 26, 'GGgg'],
      [30, 26, 'ttuv'],
      [31, 26, 'tuvv']
    ]
  };
  // armure de plaques : épaulières rondes, plastron, tassettes ; le tabard prend la couleur de tenue (p q r)
  F.plate = {
    body: [
      [23, 12, 'Gyyyyyyyyyyyyg'],
      [24, 13, '245544443331'],
      [25, 13, '245554443321'],
      [26, 13, '34554yG43321'],
      [27, 13, '345yyyGGg321'],
      [28, 13, '34544yG43321'],
      [29, 13, '34544yG43321'],
      [30, 13, '234444333221'],
      [31, 13, '123333332211'],
      [24, 12, '1'],
      [25, 12, '1'],
      [24, 25, '1'],
      [25, 25, '1'],
      [26, 12, 'n'],
      [27, 12, 'n'],
      [28, 12, 'n'],
      [29, 12, 'n'],
      [30, 12, 'n'],
      [31, 12, 'n'],
      [26, 25, 'n'],
      [27, 25, 'n'],
      [28, 25, 'n'],
      [29, 25, 'n'],
      [30, 25, 'n'],
      [31, 25, 'n'],
      [32, 12, 'LMMNNMyyMMMMML'],
      [33, 12, 'LLMMMMGGMMMLLL'],
      [34, 11, '3442qrrrrqqp3221'],
      [35, 11, '3442qrrqqqqp3221'],
      [36, 11, '2332qrqqqqpp2211'],
      [37, 11, 'Gyygqqqqqpppggg'],
      [38, 15, 'GyyyyGGg']
    ],
    armL: [
      [23, 7, '34554'],
      [24, 6, '2455431'],
      [25, 6, '2345431'],
      [26, 6, 'Gyyyyyg'],
      [27, 7, '34432'],
      [28, 8, '3442'],
      [29, 8, '2442'],
      [30, 8, '2332'],
      [31, 7, 'GyyGg'],
      [32, 7, '34432'],
      [33, 8, '2332']
    ],
    armR: [
      [23, 26, '44433'],
      [24, 25, '1344321'],
      [25, 25, '1334321'],
      [26, 25, 'GGGGGgg'],
      [27, 26, '33321'],
      [28, 26, '2321'],
      [29, 26, '2321'],
      [30, 26, '1221'],
      [31, 26, 'GGGgg'],
      [32, 26, '33221'],
      [33, 26, '2211']
    ]
  };
  // jambes et bottes (gauche / droite, pour l'animation de marche)
  F.legL = [
    [38, 13, '3443'],
    [39, 13, '34432'],
    [40, 13, '34432'],
    [41, 13, '23432']
  ];
  F.legR = [
    [38, 21, '3321'],
    [39, 20, '34321'],
    [40, 20, '33221'],
    [41, 20, '23221']
  ];
  F.bootL = [
    [42, 12, 'g4444g'],
    [43, 12, '345432'],
    [44, 11, '2455432'],
    [45, 11, '1222221']
  ];
  F.bootR = [
    [42, 20, 'g3333g'],
    [43, 20, '334321'],
    [44, 20, '3344321'],
    [45, 20, '1222211']
  ];

  /* ---------- ARMES (vue de face, tenues dans la main gauche de l'écran ; ancre de la main en 9,31) ---------- */
  F.weapons = {
    sword: (() => {
      const L = [];
      for (let y = 28; y >= 7; y--) {
        const x = 8 - ((30 - y) >> 1);
        L.push(y > 8 ? [y, x - 2, '5442'] : [y, x - 1, y === 8 ? '54' : '5']);
      }
      L.push([29, 3, 'gGyyYyyGg'], [30, 5, 'gyYyg'], [31, 8, 'LM'], [32, 8, 'LM'], [33, 8, 'LM'], [34, 7, 'gRQg'], [35, 8, 'gg']);
      return L;
    })(),
    axe: (() => {
      const L = [];
      for (let y = 12; y <= 36; y++) {
        const x = 9 - Math.round((32 - y) / 3);
        L.push([y, x - 1, 'PO']);
      }
      L.push(
        [9, 0, '45'],
        [10, -1, '4552'],
        [11, -2, '45542'],
        [12, -3, '455432'],
        [13, -3, '4554321'],
        [14, -3, '455432'],
        [15, -3, '45543'],
        [16, -2, '4543'],
        [17, -1, '432'],
        [18, 0, '2'],
        [11, 5, '32'],
        [12, 5, '321'],
        [13, 5, '21'],
        [13, 3, 'gG'],
        [14, 3, 'gG'],
        [36, 8, 'gg']
      );
      return L;
    })(),
    staff: (() => {
      const L = [];
      for (let y = 9; y <= 38; y++) L.push([y, 9, y % 7 === 3 ? 'gG' : 'PO']);
      L.push(
        [2, 9, '45'],
        [3, 8, '4553'],
        [4, 7, '455543'],
        [5, 7, '455432'],
        [6, 7, '345321'],
        [7, 8, '3221'],
        [8, 8, 'gYyg'],
        [4, 6, 'y'],
        [6, 13, 'y'],
        [3, 9, 'w']
      );
      return L;
    })(),
    bow: (() => {
      const L = [];
      for (let y = 19; y <= 45; y++) {
        const t = Math.abs(y - 32),
          x = 9 - Math.round(4 - (t * t) / 42);
        L.push([y, x - 1, t > 11 ? '32' : '453']);
        if (y > 19 && y < 45) L.push([y, 10, 'w']);
      }
      L.push([31, 7, 'gG'], [32, 7, 'gG'], [19, 5, 'y'], [45, 5, 'y']);
      return L;
    })(),
    // dagues : une dans chaque main (main droite de l'écran : prise inversée, lame vers le bas)
    dagger: (() => {
      const L = [];
      for (let y = 30; y >= 20; y--) {
        const x = 6 - ((31 - y) >> 1);
        L.push([y, x - 1, '5442']);
      }
      L.push(
        [19, 1, '54'],
        [18, 1, '5'],
        [31, 4, 'gGyyg'],
        [32, 7, 'LM'],
        [33, 7, 'LM'],
        [34, 7, 'gR'],
        [32, 31, 'LM'],
        [33, 30, 'gyGg'],
        [34, 31, '544'],
        [35, 31, '544'],
        [36, 31, '544'],
        [37, 31, '542'],
        [38, 31, '54'],
        [39, 32, '4']
      );
      return L;
    })(),
    // lance : longue hampe tenue en biais, fer en feuille au-dessus de l'épaule
    spear: (() => {
      const L = [];
      for (let y = 0; y <= 40; y++) L.push([y, Math.round(9 - (31 - y) / 3.5), 'PO']);
      L.push(
        [-8, 0, '5'],
        [-7, -1, '545'],
        [-6, -1, '4552'],
        [-5, -1, '4552'],
        [-4, -1, '4542'],
        [-3, -1, '452'],
        [-2, 0, '42'],
        [-1, -1, 'gGyg']
      );
      return L;
    })(),
    // épée à deux mains : lame large et longue, garde massive
    great: (() => {
      const L = [];
      for (let y = 28; y >= 1; y--) {
        const x = 8 - Math.round((30 - y) / 3);
        L.push([y, x - 3, '55442']);
      }
      L.push(
        [0, -2, '544'],
        [-1, -2, '54'],
        [-2, -1, '5'],
        [29, 1, 'gGGyyYyyGGg'],
        [30, 4, 'gGyyGg'],
        [31, 8, 'LM'],
        [32, 8, 'LM'],
        [33, 8, 'LM'],
        [34, 7, 'gRQg'],
        [35, 8, 'gg']
      );
      return L;
    })()
  };
  // bouclier rond (face) : bord = liseré, champ = couleur de l'objet, umbo central ; tenu au bras gauche (droite de l'écran)
  function disc(cx, cy, R, back) {
    const L = [];
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) {
      let s = '',
        lead = null;
      for (let x = Math.floor(cx - R) - 1; x <= Math.ceil(cx + R) + 1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > R) {
          if (lead !== null) s += '.';
          continue;
        }
        if (lead === null) lead = x;
        const lx = x + 0.5 - cx + (y + 0.5 - cy);
        if (d > R - 1.5) s += lx < -3 ? 'y' : lx < 3 ? 'G' : 'g';
        else if (back) s += d < 1.6 ? 'M' : Math.abs(y + 0.5 - cy) < 1 ? 'L' : lx < 0 ? '2' : '1';
        else if (d < 1.5) s += lx < -0.5 ? 'Y' : lx < 1 ? 'y' : 'g';
        else if (d < 2.5) s += lx < 0 ? 'G' : 'g';
        else s += lx < -4 ? '5' : lx < 0 ? '4' : lx < 4 ? '3' : '2';
      }
      L.push([y, lead, s.replace(/\.+$/, '')]);
    }
    return L;
  }
  F.shield = disc(30.5, 34, 6.6, false);

  // sceptre du Maître du jeu : hampe dorée, ailettes, orbe d'éther (couleurs fixes w l i)
  F.weapons.gmstaff = (() => {
    const L = [
      [-8, 9, 'Y'],
      [-7, 9, 'y5'],
      [-6, 5, 'Y'],
      [-6, 9, 'y4'],
      [-6, 14, 'Y'],
      [-5, 5, 'y5'],
      [-5, 13, '4y'],
      [-4, 5, 'y5'],
      [-4, 9, 'wl'],
      [-4, 13, '4G'],
      [-3, 5, 'y4'],
      [-3, 8, 'wlli'],
      [-3, 13, '3G'],
      [-2, 6, 'y4'],
      [-2, 8, 'llii'],
      [-2, 12, '3g'],
      [-1, 6, 'g4'],
      [-1, 9, 'ii'],
      [-1, 11, '3g'],
      [0, 7, 'g44332g'],
      [1, 8, 'gyyGg']
    ];
    for (let y = 2; y <= 40; y++) L.push([y, 9, y % 7 === 4 ? 'yG' : '43']);
    L.push([41, 9, 'g']);
    return L;
  })();
  // grimoire (famille Bâton) : livre tenu à la main, couverture à la couleur de l'objet, pages et gemme ; l'orbe flotte de l'autre côté
  F.weapons.tome = [
    [26, -1, 'gGGGGGGg'],
    [27, -1, 'G555544G'],
    [28, -1, 'G5yyyy4G'],
    [29, -1, 'G5yRQy3G'],
    [30, -1, 'G5yRRy3G'],
    [31, -1, 'G5yyyy3G'],
    [32, -1, 'G444433G'],
    [33, -1, 'G443333G'],
    [34, -1, 'gGGGGGGg'],
    [27, 7, 'w'],
    [28, 7, 'l'],
    [29, 7, 'w'],
    [30, 7, 'w'],
    [31, 7, 'l'],
    [32, 7, 'w'],
    [33, 7, 'w'],
    [26, 0, 'Y']
  ];
  const ORB = [
    [0, 1, 'lll'],
    [1, 0, 'lwwli'],
    [2, 0, 'lwllj'],
    [3, 0, 'illij'],
    [4, 1, 'ijj']
  ];
  const orbAt = (x, y, fr) =>
    ORB.map(([dy, dx, t]) => [y + dy, x + dx, t]).concat(
      fr % 2
        ? [
            [y - 2, x + 5, 'w'],
            [y + 6, x - 1, 'l']
          ]
        : [
            [y - 1, x - 2, 'l'],
            [y + 5, x + 5, 'w']
          ]
    );
  /* ---------- couvre-chefs (vue de face) ---------- */
  function dome(rx, ry, cx, cy, y0, y1, open) {
    // calotte ombrée (lumière en haut à gauche) ; open(x, y) = trou du visage
    const L = [];
    for (let y = y0; y <= y1; y++) {
      let s = '',
        lead = null;
      for (let x = 0; x < 38; x++) {
        const nx = (x + 0.5 - cx) / rx,
          ny = (y + 0.5 - cy) / ry,
          d = nx * nx + ny * ny;
        if (d > 1 || (open && open(x, y))) {
          if (lead !== null) s += '.';
          continue;
        }
        if (lead === null) lead = x;
        const lt = -(nx * 0.65 + ny * 0.75) + (1 - d) * 0.35;
        s += lt > 0.78 ? '5' : lt > 0.3 ? '4' : lt > -0.15 ? '3' : lt > -0.55 ? '2' : '1';
      }
      if (lead !== null) L.push([y, lead, s.replace(/\.+$/, '')]);
    }
    return L;
  }
  F.hood = [
    ...dome(14.6, 12.8, 19, 10.5, -2, 21, (x, y) => y >= 11 && x >= 10 && x <= 27 && (y <= 19 || (x >= 12 && x <= 25))),
    [10, 10, '111111111111111111'],
    [11, 9, '1'],
    [11, 28, '1'],
    [12, 9, '1'],
    [12, 28, '1'],
    [13, 9, '1'],
    [13, 28, '1'],
    [14, 9, '1'],
    [14, 28, '1'],
    [15, 9, '1'],
    [15, 28, '1'],
    [16, 9, '1'],
    [16, 28, '1'],
    [17, 9, '1'],
    [17, 28, '1'],
    [18, 9, '1'],
    [18, 28, '1'],
    [19, 9, '1'],
    [19, 28, '1'],
    [20, 11, '1'],
    [20, 26, '1'],
    [21, 11, '1'],
    [21, 26, '1'],
    [-3, 18, '43'],
    [-4, 19, '3'],
    [4, 6, '2'],
    [5, 6, '2'],
    [6, 6, '2'],
    [7, 7, '2'],
    [4, 31, '1'],
    [5, 31, '1'],
    [6, 31, '1'],
    [21, 9, '2344444'],
    [21, 22, '4443321'],
    [22, 9, '2344444444444444443321'],
    [23, 9, '1233333333333333332211']
  ];
  F.helm = [
    ...dome(14, 11.5, 19, 10.5, -1, 12, null),
    [11, 6, 'gGGGGGGGGGGGGGGGGGGGGGGGGg'],
    [12, 6, '21111111111111111111111111'],
    [14, 7, '232'],
    [15, 7, '232'],
    [16, 7, '232'],
    [17, 8, '22'],
    [14, 28, '221'],
    [15, 28, '221'],
    [16, 28, '221'],
    [17, 28, '21'],
    [12, 18, '45'],
    [13, 18, '43'],
    [14, 18, '32'],
    [-2, 18, 'yy'],
    [-3, 18, 'Yy'],
    [-4, 19, 'y']
  ];
  F.crown = [
    [0, 10, 'y'],
    [0, 18, 'Yy'],
    [0, 27, 'y'],
    [1, 10, 'yG'],
    [1, 14, 'y'],
    [1, 17, 'yYyG'],
    [1, 23, 'y'],
    [1, 26, 'yG'],
    [2, 10, 'yGG'],
    [2, 13, 'yGG'],
    [2, 17, 'yy4G'],
    [2, 22, 'yGG'],
    [2, 26, 'yGg'],
    [3, 10, 'yyyyyyyy5Q4yyyyyyGGg'],
    [4, 10, 'GGGGGGGG434GGGGGGggg'],
    [5, 10, 'ggggggggg3gggggggggg']
  ];
  // chapeaux de la création : 1 mage, 2 bandeau, 3 pousse
  F.hats = [
    null,
    [
      [-8, 23, 'q'],
      [-7, 21, 'rqp'],
      [-6, 20, 'rrqp'],
      [-5, 19, 'rrqqp'],
      [-4, 18, 'rrrqqp'],
      [-3, 17, 'rrrqqqp'],
      [-2, 16, 'rrrrqqqp'],
      [-1, 15, 'rrrrqqqqp'],
      [0, 14, 'rrrrrqqqqp'],
      [1, 13, 'rrrrrqqqqqp'],
      [2, 12, 'yyyyyyyGGGGgg'],
      [3, 11, 'rrrrrrrqqqqqqpp'],
      [4, 5, 'prrrrrrrrrqqqqqqqqqqqqqpp'],
      [5, 4, 'ppqqqqqqqqqqqqqqqqqqqqqqqpp'],
      [6, 6, 'pppppppppppppppppppppppp']
    ],
    [
      [8, 6, 'RQQRRRRRRRRRRRRRRRRRRRRRRRR'],
      [9, 5, 'RRRRRRRRRRRRRRRRRRRRRRRRRRRRR'],
      [10, 4, 'RR'],
      [11, 2, 'RRR'],
      [12, 1, 'RR']
    ],
    [
      [-6, 20, 'P'],
      [-5, 15, 'Pw'],
      [-5, 21, 'PP'],
      [-4, 14, 'PPPw'],
      [-4, 19, 'O'],
      [-4, 21, 'PPP'],
      [-3, 15, 'OPP'],
      [-3, 19, 'O'],
      [-3, 21, 'PPO'],
      [-2, 17, 'OO'],
      [-2, 19, 'O'],
      [-1, 19, 'O'],
      [0, 19, 'o']
    ]
  ];

  /* ---------- DOS (vue de dos) ---------- */
  const B = {};
  B.head = [
    [0, 13, 'dddddcccccbb'],
    [1, 11, 'deeedddddcccccbb'],
    [2, 9, 'ddeeeeddddddcccccbbb'],
    [3, 8, 'ddeeeedddddddcccccbbbb'],
    [4, 7, 'cddeeeddddcddddccccbbbba'],
    [5, 6, 'cdddeedddcddddcccccbbbbaa'],
    [6, 6, 'cddddddddcdddccccccbbbbaa'],
    [7, 6, 'cdddddddcddddccccccbbbba'],
    [8, 6, 'cddddddcdddddcccccbbbbba'],
    [9, 6, 'ccddddcddddddcccccbbbbba'],
    [10, 5, 'ccddddcddddddccccccbbbbbaa'],
    [11, 5, 'cccdddcdddddcccccccbbbbba'],
    [12, 5, 'cccddcddddcccccccbbbbbbba'],
    [13, 5, 'cccdcddddccccccccbbbbbbaa'],
    [14, 5, 'bcccdcdddcccccccbbbbbbbaa'],
    [15, 5, 'bccccdcdcccccccbbbbbbbba'],
    [16, 6, 'bccccdcccccccbbbbbbbba'],
    [17, 6, 'bcccdcccccccbbbbbbbba'],
    [18, 6, 'abccdccccccbbbbbbbbba'],
    [19, 7, 'abbcbcbcbbcbbbbbbaa'],
    [20, 8, 'ab.bab.bab.bbab.ba'],
    [21, 15, 'uuuuuuuu'],
    [22, 15, 'vuuuuuuv']
  ];
  // compléments de coupe : 0 courte (dessus rond), 2 épis
  B.top = [
    [],
    [],
    [
      [-1, 19, 'dd'],
      [0, 12, 'dd'],
      [0, 18, 'dddc'],
      [0, 25, 'c'],
      [-1, 13, 'd'],
      [1, 9, 'd'],
      [1, 28, 'c'],
      [2, 30, 'b']
    ]
  ];
  B.hairLong = [];
  for (let y = 21; y <= 34; y++) B.hairLong.push([y, 10, y > 32 ? '.b.cb.cb.bcb.bb.b' : 'bccdcccdcccbccbbb']);
  B.tunic = [
    [23, 9, '234444444444443321'],
    [24, 8, '23444444444444433321'],
    [25, 8, '23444444444444333211'],
    [26, 8, '2343444444443333211'],
    [27, 8, '23434444444433332211'],
    [28, 8, '12334444444333322211'],
    [29, 8, 'gGG3344444433332ggg'],
    [30, 8, 'tt.2334444433322.uv'],
    [31, 8, 'tu.1233333333221.vv'],
    [32, 12, 'LMMMMMMMMMMMML'],
    [33, 12, 'LLMMMMMMMMMLLL'],
    [34, 11, '2344444444443321'],
    [35, 11, '2344434444433321'],
    [36, 11, '1233323333332211'],
    [37, 11, 'gGGGGGGGGGGGGggg']
  ];
  B.plate = [
    [23, 7, '3455444444444444433'],
    [24, 6, '24554444444444444321'],
    [25, 6, '23454444444444443321'],
    [26, 6, 'Gyyyyy3444444433GGgg'],
    [27, 7, '3442344444433333321'],
    [28, 8, '3442344444333 2221'.replace(' ', '3')],
    [29, 8, '2442234443333322 21'.replace(' ', '2')],
    [30, 8, '233212333332221221'],
    [31, 7, 'GyyGg233333322GGGgg'],
    [32, 7, '34432LMMMMMML33221'],
    [33, 8, '2332LLMMMMMLL2211'],
    [34, 11, '3442pppppppp3221'],
    [35, 11, '3442pqpqpqpp3221'],
    [36, 11, '2332pppppppp2211'],
    [37, 11, 'Gyyg.......pGGgg'.replace(/\./g, 'p')]
  ];
  B.legL = [
    [38, 13, '2343'],
    [39, 13, '23432'],
    [40, 13, '23432'],
    [41, 13, '22321']
  ];
  B.legR = [
    [38, 21, '3321'],
    [39, 20, '33221'],
    [40, 20, '23221'],
    [41, 20, '22211']
  ];
  B.bootL = [
    [42, 12, 'g3333g'],
    [43, 12, '234432'],
    [44, 12, '233321'],
    [45, 12, '122221']
  ];
  B.bootR = [
    [42, 20, 'g3333g'],
    [43, 20, '233321'],
    [44, 20, '233221'],
    [45, 20, '122211']
  ];
  B.hood = [...dome(14.6, 12.8, 19, 10.5, -2, 21, null), [22, 9, '2344444444444444443321'], [23, 9, '1233333333333333332211']];
  B.helm = [...dome(14, 11.5, 19, 10.5, -1, 15, null), [11, 6, 'gGGGGGGGGGGGGGGGGGGGGGGGGg'], [-2, 18, 'yy'], [-3, 18, 'Yy']];

  /* ---------- PROFIL (regarde vers la droite) ---------- */
  const S = {};
  S.face = [
    [9, 18, 'tttttttttt'],
    [10, 17, 'ttttttttttttt'],
    [11, 17, 'ttttttttttttt'],
    [12, 17, 'tssssssssssss'],
    [13, 17, 'tssssssssssss'],
    [14, 17, 'tttsssssaaass'],
    [15, 17, 'utussssskkkss'],
    [16, 17, 'tuussssswjiss'],
    [16, 30, 's'],
    [17, 17, 'ttsssssstttss'],
    [17, 30, 't'],
    [18, 17, 'ttssssssssssu'],
    [19, 18, 'tsssssssuvst'],
    [20, 18, 'vttssssssstu'],
    [21, 19, 'vuttttttu'],
    [22, 18, 'vuuuuv']
  ];
  S.blink = [
    [15, 25, 'sss'],
    [16, 25, 'kkk']
  ];
  S.head = [
    [0, 12, 'eeedddcc'],
    [1, 9, 'eeeeedddddccc'],
    [2, 7, 'eeffeeedddddcccb'],
    [3, 6, 'deffffeedddddccccb'],
    [4, 6, 'eefffeeddddddccccbb'],
    [5, 6, 'eeeeeddddddddcccccbb'],
    [6, 5, 'deeeedddddcdddcccccbbb'],
    [7, 5, 'ddeedddddcdddddcccccbbb'],
    [8, 5, 'dddddddddcddddddcccccbba'],
    [9, 5, 'cdddddddcddddddcccccbbbba'],
    [10, 4, 'acddddddcdddddcc'],
    [10, 21, 'cb'],
    [10, 24, 'cbb'],
    [10, 28, 'bba'],
    [11, 4, 'acdddddcddddcb'],
    [11, 22, 'b'],
    [11, 25, 'cb'],
    [11, 29, 'a'],
    [12, 4, 'acddddcdddccb'],
    [12, 26, 'b'],
    [13, 4, 'acdddcdddccbb'],
    [14, 4, 'acddcdddccba'],
    [15, 4, 'acdcdddccba'],
    [16, 5, 'acddccccba'],
    [17, 5, 'acdcccccba'],
    [18, 6, 'abccccbba'],
    [19, 7, 'abccbbbbaaa'],
    [20, 8, 'abbbbba'],
    [21, 10, 'abba']
  ];
  S.top = [
    [],
    [],
    [
      [-2, 13, 'e'],
      [-1, 12, 'ed'],
      [-1, 17, 'edd'],
      [0, 16, 'eddc'],
      [-1, 22, 'c'],
      [0, 21, 'cc'],
      [1, 22, 'ccc'],
      [2, 23, 'ccb'],
      [0, 9, 'dd'],
      [1, 7, 'dd'],
      [2, 5, 'dd']
    ]
  ];
  S.hairLong = [];
  for (let y = 19; y <= 31; y++) S.hairLong.push([y, 6 + (y > 27 ? 1 : 0), y > 27 ? 'acb' : 'acdcb']);
  S.tunic = {
    body: [
      [23, 13, '2344445tt5'],
      [24, 13, '23444445t5'],
      [25, 13, '2344444444'],
      [26, 13, '2344444443'],
      [27, 13, '2334444443'],
      [28, 13, '1233444433'],
      [29, 13, '1233344433'],
      [30, 13, '1223333332'],
      [31, 13, '1122333322'],
      [32, 13, 'LLMMMNNMyL'],
      [33, 13, 'LLLMMMMMGL'],
      [34, 12, '123344444443'],
      [35, 12, '123344444432'],
      [36, 12, '112333333321'],
      [37, 12, 'ggGGGGGGGGGy']
    ],
    arm: [
      [24, 16, '345'],
      [25, 16, '3454'],
      [26, 16, '3443'],
      [27, 16, '2443'],
      [28, 16, '2343'],
      [29, 16, 'gGGy'],
      [30, 17, 'stt'],
      [31, 17, 'tuu']
    ]
  };
  S.plate = {
    body: [
      [23, 13, 'GGyyyyyyyy'],
      [24, 13, '1234554433'],
      [25, 13, '1234554433'],
      [26, 13, '12345yG433'],
      [27, 13, '1234yyyG33'],
      [28, 13, '12344yG433'],
      [29, 13, '12344yG433'],
      [30, 13, '1223444332'],
      [31, 13, '1122333322'],
      [32, 13, 'LLMMMNNMyL'],
      [33, 13, 'LLLMMMMMGL'],
      [34, 12, '1233qrrqq322'],
      [35, 12, '1233qrqqq321'],
      [36, 12, '1122qqqpp211'],
      [37, 12, 'ggGGqqqpGGGy']
    ],
    arm: [
      [22, 14, '3455'],
      [23, 13, '245554'],
      [24, 13, '2345543'],
      [25, 13, '2345432'],
      [26, 13, 'Gyyyyyg'],
      [27, 15, '34432'],
      [28, 16, '3442'],
      [29, 16, '2442'],
      [30, 16, 'GyyG'],
      [31, 16, '3443'],
      [32, 17, '332']
    ]
  };
  // jambes de profil : 0 au repos, 1 et 2 foulées
  S.legs = [
    {
      back: [
        [38, 15, '2232'],
        [39, 15, '2232'],
        [40, 15, '1232'],
        [41, 15, '1221']
      ],
      front: [
        [38, 19, '3443'],
        [39, 19, '3443'],
        [40, 19, '3443'],
        [41, 19, '2342']
      ],
      bootB: [
        [42, 14, 'g222g'],
        [43, 14, '22221'],
        [44, 14, '122221'],
        [45, 14, '111111']
      ],
      bootF: [
        [42, 18, 'g4444g'],
        [43, 18, '344443'],
        [44, 18, '2344443'],
        [45, 18, '1222221']
      ]
    },
    {
      back: [
        [38, 13, '2232'],
        [39, 12, '2232'],
        [40, 11, '1232'],
        [41, 10, '1221']
      ],
      front: [
        [38, 20, '3443'],
        [39, 21, '3443'],
        [40, 22, '3443'],
        [41, 23, '2342']
      ],
      bootB: [
        [42, 9, 'g222g'],
        [43, 8, '22221'],
        [44, 7, '122221'],
        [45, 7, '11111']
      ],
      bootF: [
        [42, 22, 'g4444g'],
        [43, 23, '344443'],
        [44, 23, '2344443'],
        [45, 23, '1222221']
      ]
    },
    {
      back: [
        [38, 19, '2232'],
        [39, 20, '2232'],
        [40, 21, '1232'],
        [41, 22, '1221']
      ],
      front: [
        [38, 15, '3443'],
        [39, 14, '3443'],
        [40, 13, '3443'],
        [41, 12, '2342']
      ],
      bootB: [
        [42, 21, 'g222g'],
        [43, 22, '22221'],
        [44, 22, '122221'],
        [45, 22, '111111']
      ],
      bootF: [
        [42, 11, 'g4444g'],
        [43, 10, '344443'],
        [44, 10, '2344443'],
        [45, 10, '1222221']
      ]
    }
  ];
  S.hood = dome(14.5, 14.5, 17, 11.5, -3, 23, (x, y) => y >= 11 && x >= 20 && y <= 21);
  S.helm = [
    ...dome(14, 12.5, 17, 10, -2, 13, null),
    [12, 4, 'gGGGGGGGGGGGGGGGGGGGGGGGg'],
    [13, 4, '21111111111111111'],
    [14, 5, '2321'],
    [15, 5, '2321'],
    [16, 6, '221'],
    [-3, 16, 'yy'],
    [-4, 15, 'Yyy']
  ];
  S.crown = [
    [0, 9, 'y'],
    [0, 16, 'Yy'],
    [0, 24, 'y'],
    [1, 9, 'yG'],
    [1, 15, 'yYyG'],
    [1, 23, 'yG'],
    [2, 9, 'yGG'],
    [2, 14, 'yyyGG'],
    [2, 22, 'yGg'],
    [3, 9, 'yyyyyyyyyy5Q4yyGg'],
    [4, 9, 'GGGGGGGGGG434GGgg'],
    [5, 9, 'ggggggggggg3ggggg']
  ];
  S.hats = [
    null,
    [
      [-8, 15, 'q'],
      [-7, 13, 'rqp'],
      [-6, 13, 'rrqp'],
      [-5, 13, 'rrqqp'],
      [-4, 12, 'rrrqqp'],
      [-3, 12, 'rrrqqqp'],
      [-2, 11, 'rrrrqqqp'],
      [-1, 11, 'rrrrqqqqp'],
      [0, 10, 'rrrrrqqqqp'],
      [1, 10, 'rrrrrqqqqqp'],
      [2, 9, 'yyyyyyyGGGGgg'],
      [3, 8, 'rrrrrrrqqqqqqpp'],
      [4, 2, 'prrrrrrrrrqqqqqqqqqqqqqqqpp'],
      [5, 1, 'ppqqqqqqqqqqqqqqqqqqqqqqqqqpp'],
      [6, 3, 'ppppppppppppppppppppppppp']
    ],
    [
      [8, 5, 'RRRRRRRRRRRRRRRRRRRRRRRRR'],
      [9, 5, 'RRRRRRRRRRRRRRRRRRRRRRRRRR'],
      [10, 3, 'RRR'],
      [11, 1, 'RRR'],
      [12, 0, 'RR']
    ],
    [
      [-6, 17, 'P'],
      [-5, 12, 'Pw'],
      [-5, 18, 'PP'],
      [-4, 11, 'PPPw'],
      [-4, 16, 'O'],
      [-4, 18, 'PPP'],
      [-3, 12, 'OPP'],
      [-3, 16, 'O'],
      [-3, 18, 'PPO'],
      [-2, 14, 'OO'],
      [-2, 16, 'O'],
      [-1, 16, 'O'],
      [0, 16, 'o']
    ]
  ];
  // armes de profil : tenues devant, pointe vers l'avant et le haut (main en 18,31)
  S.weapons = {
    sword: (() => {
      const L = [];
      for (let i = 0; i <= 8; i++) L.push([29 - i, 21 + 2 * i, '2445']);
      L.push([20, 39, '5'], [27, 19, 'Y'], [28, 20, 'y'], [29, 20, 'G'], [30, 21, 'g'], [30, 17, 'LM'], [31, 15, 'LM'], [32, 13, 'RQ']);
      return L;
    })(),
    axe: (() => {
      const L = [];
      for (let i = 0; i <= 12; i++) L.push([34 - i, 15 + i, 'PO']);
      L.push(
        [18, 28, '34'],
        [19, 28, '3455'],
        [20, 28, '34554'],
        [21, 28, '345543'],
        [22, 29, '45543'],
        [23, 29, '4543'],
        [24, 29, '432'],
        [25, 30, '2'],
        [21, 25, 'gG'],
        [22, 25, 'gG']
      );
      return L;
    })(),
    staff: (() => {
      const L = [];
      for (let y = 0; y <= 37; y++) L.push([y, Math.round(19 - (31 - y) * 0.35), y % 7 === 3 ? 'gG' : 'OP']);
      L.push([-6, 6, '45'], [-5, 5, '4553'], [-4, 4, '455543'], [-3, 4, '455432'], [-2, 4, '345321'], [-1, 5, '3221'], [-5, 6, 'w']);
      return L;
    })(),
    bow: (() => {
      const L = [];
      for (let y = 22; y <= 44; y++) {
        const t = Math.abs(y - 33),
          x = 22 + Math.round(4 - (t * t) / 30);
        L.push([y, x, t > 9 ? '23' : '354']);
        if (y > 22 && y < 44) L.push([y, 21, 'w']);
      }
      L.push([32, 19, 'gG'], [33, 19, 'gG']);
      return L;
    })(),
    dagger: [
      [29, 23, '2445'],
      [28, 25, '2445'],
      [27, 27, '2445'],
      [26, 29, '245'],
      [25, 31, '45'],
      [24, 33, '5'],
      [28, 22, 'y'],
      [29, 22, 'G'],
      [30, 22, 'g'],
      [30, 19, 'LMM']
    ],
    spear: (() => {
      const L = [];
      for (let x = 6; x <= 37; x++) {
        const y = Math.round(31 - (x - 19) * 0.4);
        L.push([y, x, 'P'], [y + 1, x, 'O']);
      }
      L.push([24, 37, '45'], [23, 38, '4555'], [24, 39, '442'], [25, 38, '22'], [22, 39, '5'], [26, 36, 'gG'], [25, 36, 'g']);
      return L;
    })(),
    great: (() => {
      const L = [];
      for (let i = 0; i <= 9; i++) L.push([29 - i, 21 + 2 * i, '234455']);
      L.push(
        [19, 41, '5'],
        [26, 19, 'Y'],
        [27, 19, 'yG'],
        [28, 20, 'yG'],
        [29, 20, 'Gg'],
        [30, 21, 'g'],
        [31, 21, 'g'],
        [30, 17, 'LM'],
        [31, 15, 'LM'],
        [32, 13, 'RQ']
      );
      return L;
    })()
  };
  S.weapons.tome = [
    [26, 20, 'gGGGGg'],
    [27, 20, 'G554ww'],
    [28, 20, 'G5Rwlw'],
    [29, 20, 'G543ww'],
    [30, 20, 'G433lw'],
    [31, 20, 'gGGGGg']
  ];
  S.shield = [
    [26, 22, 'yG'],
    [27, 21, 'y45g'],
    [28, 21, 'y45g'],
    [29, 21, 'y44g'],
    [30, 21, 'yYyg'],
    [31, 21, 'y43g'],
    [32, 21, 'y43g'],
    [33, 21, 'y32g'],
    [34, 21, 'G32g'],
    [35, 22, 'Gg']
  ];
  // armes dans le dos (vue de dos) : en diagonale derrière les épaules
  B.weapons = {
    sword: (() => {
      const L = [];
      for (let y = 6; y <= 30; y++) {
        const x = 30 - ((y - 6) >> 1) * 1 + 0;
        L.push([y, x - 1, '2443']);
      }
      L.push([31, 16, 'gGyyGg'], [32, 17, 'LM'], [33, 17, 'LM']);
      return L;
    })(),
    axe: (() => {
      const L = [];
      for (let y = 8; y <= 34; y++) L.push([y, 28 - ((y - 8) >> 1), 'OP']);
      L.push([6, 27, '345'], [7, 26, '23455'], [8, 26, '234554'], [9, 26, '23455'], [10, 27, '234']);
      return L;
    })(),
    staff: (() => {
      const L = [];
      for (let y = 4; y <= 36; y++) L.push([y, 29 - ((y - 4) >> 2), 'OP']);
      L.push([0, 29, '45'], [1, 28, '4553'], [2, 28, '3542'], [3, 29, '22']);
      return L;
    })(),
    bow: (() => {
      const L = [];
      for (let y = 16; y <= 40; y++) {
        const t = Math.abs(y - 28),
          x = 31 - Math.round(3 - (t * t) / 48);
        L.push([y, x, '342']);
      }
      return L;
    })(),
    dagger: [
      [31, 27, 'gG'],
      [32, 27, '34'],
      [33, 27, '34'],
      [34, 27, '24'],
      [35, 28, '2'],
      [31, 10, 'Gg'],
      [32, 10, '43'],
      [33, 10, '43'],
      [34, 10, '42'],
      [35, 10, '2']
    ],
    spear: (() => {
      const L = [];
      for (let y = -2; y <= 38; y++) L.push([y, Math.round(30 - (y + 2) / 3), 'OP']);
      L.push([-8, 31, '5'], [-7, 30, '545'], [-6, 30, '4552'], [-5, 30, '4542'], [-4, 31, '42'], [-3, 30, 'gGg']);
      return L;
    })(),
    great: (() => {
      const L = [];
      for (let y = 2; y <= 30; y++) {
        const x = 32 - ((y - 2) >> 1);
        L.push([y, x - 2, '24453']);
      }
      L.push([1, 31, '45'], [0, 32, '5'], [31, 14, 'gGGyyGGg'], [32, 17, 'LM'], [33, 17, 'LM']);
      return L;
    })()
  };
  B.weapons.tome = []; // de dos, le livre est caché ; seule l'orbe se voit
  B.shield = disc(7.5, 34, 6.6, true);

  /* ---------- armure du Maître du jeu (unique) : or ciselé, épaulières à ailettes, diadème ailé, cape blanche ---------- */
  const GMR = ['#4a2008', '#94540e', '#dca42a', '#ffdc68', '#fff6c8'].map(hex),
    GMT = ['#5a2a06', '#c0801c', '#fff0a0', '#ffffff'].map(hex),
    GMW = ['#6a5a78', '#a89cb0', '#e4dcd8', '#f8f4ee', '#ffffff'].map(hex);
  const DARKEN = { 5: '4', 4: '3', 3: '2', 2: '1', 1: '1', Y: 'y', y: 'G', G: 'g', g: 'g' };
  // miroir d'une moitié gauche (colonnes ≤ 18) vers la droite, un ton plus sombre (la lumière vient de la gauche)
  const mirror = rows => {
    const out = [];
    for (const [y, x0, s0] of rows)
      for (let i = 0; i < s0.length; i++) {
        const c = s0[i];
        if (c !== '.') out.push([y, 37 - (x0 + i), DARKEN[c] || c]);
      }
    return out;
  };
  const sym = rows => rows.concat(mirror(rows));
  const GM_WING = [
    [-6, 1, 'Y'],
    [-5, 1, 'y5'],
    [-4, 1, 'y55'],
    [-3, 2, 'y55'],
    [-2, 2, 'y554'],
    [-1, 3, 'y554'],
    [0, 3, 'y5543'],
    [1, 4, 'y5543'],
    [2, 5, 'y543'],
    [3, 5, 'y43'],
    [4, 6, 'g3']
  ];
  const GM_CREST = [
    [-7, 18, 'Y'],
    [-6, 17, 'Y5'],
    [-5, 17, 'y5'],
    [-4, 16, 'y55'],
    [-3, 16, 'y54'],
    [-2, 15, 'y554'],
    [-1, 15, 'y554']
  ];
  const GM_DOME = [
    [0, 12, 'Yy5555y'],
    [1, 9, 'Yy55555455'],
    [2, 7, 'Yy5555554455'],
    [3, 6, 'y555555445555'],
    [4, 5, 'y5555554455554'],
    [5, 5, 'y5554445555444'],
    [6, 4, 'y55544445554443']
  ];
  const GM_CHEEK = [
    [8, 5, 'g43'],
    [9, 5, 'g43'],
    [10, 6, 'g4'],
    [11, 6, 'g4'],
    [12, 6, 'g4'],
    [13, 7, 'g4'],
    [14, 7, 'g']
  ];
  F.gmhelm = sym([
    ...GM_WING,
    ...GM_CREST,
    ...GM_DOME,
    [7, 4, 'gGyyyyyyyyyyyyR'],
    [6, 18, 'Q'],
    [8, 16, 'y55'],
    [9, 17, 'y5'],
    [10, 18, 'y'],
    ...GM_CHEEK
  ]);
  B.gmhelm = sym([...GM_WING, ...GM_CREST, ...GM_DOME, [7, 4, 'gGyyyyyyyyyyyyy'], ...GM_CHEEK]);
  S.gmhelm = [
    ...GM_WING,
    ...GM_CREST.map(([y, x, t]) => [y, x - 3, t]),
    ...dome(13.5, 9, 17, 8, -1, 6, null),
    [7, 4, 'gGyyyyyyyyyyyyyyyyyyyyyyyG'],
    [6, 27, 'RQ'],
    [8, 27, 'y5'],
    [9, 28, 'y'],
    [8, 16, 'g43'],
    [9, 16, 'g43'],
    [10, 17, 'g4'],
    [11, 17, 'g4'],
    [12, 17, 'g4'],
    [13, 17, 'g']
  ];
  const GM_ARM = [
    [20, 5, 'Y'],
    [20, 9, 'Y'],
    [21, 4, 'Y5'],
    [21, 8, 'Y5'],
    [22, 4, 'y54'],
    [22, 7, 'y554'],
    [23, 3, 'y5554y5543'],
    [24, 3, 'y5555445543'],
    [25, 3, 'gyyyyyyyGGg'],
    [26, 4, '35554432'],
    [27, 4, 'gyyyyGgg'],
    [28, 8, 'n32n'],
    [29, 7, 'GyyyG'],
    [30, 7, '34554'],
    [31, 7, '3455Y'],
    [32, 7, 'GyyyG'],
    [33, 8, '334']
  ];
  F.gm = {
    body: [
      [22, 13, '45'],
      [22, 23, '43'],
      [23, 12, '23455yYYy55432'],
      [24, 12, '34555432455432'],
      [25, 12, '45555433455543'],
      [26, 12, '455543RQ345542'],
      [27, 12, '344432RR234432'],
      [28, 12, '23yyyYYYyyyy32'],
      [29, 12, 'n234434443342n'],
      [30, 12, 'n234434443321n'],
      [31, 12, 'nn2344344332nn'],
      [32, 12, 'gGyyyYRQYyyyGg'],
      [33, 12, 'gGGGGyyyyGGGGg'],
      [34, 10, '3455543yYYy3455432'],
      [35, 9, '23455432y55y23455432'],
      [36, 9, '12344321y44y12344321'],
      [37, 9, 'gGGGGGg.y33y.gGGGGg'],
      [38, 18, 'yy']
    ],
    armL: GM_ARM,
    armR: mirror(GM_ARM)
  };
  const GM_BACKP = [
    [21, 5, 'Y'],
    [22, 5, 'y5'],
    [23, 5, 'y5554'],
    [24, 4, 'y55543'],
    [25, 4, 'gyyyyGg']
  ];
  B.gmPauldrons = sym(GM_BACKP);
  S.gmSpikes = [
    [21, 14, 'Y'],
    [20, 15, 'Y'],
    [21, 17, 'Y'],
    [20, 18, 'Y'],
    [28, 17, 'RQ']
  ];
  F.gmKnee = [
    [39, 13, 'Y55y'],
    [40, 13, 'g44g'],
    [39, 20, 'y44G'],
    [40, 20, 'g33g']
  ];
  B.gmKnee = [
    [40, 13, 'g44g'],
    [40, 20, 'g33g']
  ];
  S.gmKnee = [
    [39, 19, 'y55y'],
    [40, 19, 'g44g']
  ];

  /* ---------- rotation des armes (RotSprite) : Scale2x deux fois, rotation au plus proche, retour à 1× ---------- */
  function scale2xKeys(K, w, h) {
    const O = new Float64Array(w * h * 4).fill(-1),
      at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : K[y * w + x]);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const E = at(x, y),
          B0 = at(x, y - 1),
          D0 = at(x - 1, y),
          F0 = at(x + 1, y),
          H0 = at(x, y + 1);
        let e0 = E,
          e1 = E,
          e2 = E,
          e3 = E;
        if (B0 !== H0 && D0 !== F0) {
          e0 = D0 === B0 ? D0 : E;
          e1 = B0 === F0 ? F0 : E;
          e2 = D0 === H0 ? D0 : E;
          e3 = H0 === F0 ? F0 : E;
        }
        const o = y * 2 * w * 2 + x * 2;
        O[o] = e0;
        O[o + 1] = e1;
        O[o + w * 2] = e2;
        O[o + w * 2 + 1] = e3;
      }
    return O;
  }
  function rotsprite(D, M, ang, px, py, outD, outM) {
    const K = new Float64Array(W * H).fill(-1);
    for (let i = 0; i < W * H; i++) if (M[i] >= 0) K[i] = M[i] * 16777216 + (D[i * 4] << 16) + (D[i * 4 + 1] << 8) + D[i * 4 + 2];
    const K4 = scale2xKeys(scale2xKeys(K, W, H), W * 2, H * 2),
      W4 = W * 4,
      H4 = H * 4,
      c = Math.cos(ang),
      sn = Math.sin(ang);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - px,
          dy = y + 0.5 - py,
          sx = px + dx * c + dy * sn,
          sy = py - dx * sn + dy * c;
        const X = Math.floor(sx * 4),
          Y = Math.floor(sy * 4);
        if (X < 0 || Y < 0 || X >= W4 || Y >= H4) continue;
        const k = K4[Y * W4 + X];
        if (k < 0) continue;
        const m = Math.floor(k / 16777216),
          rgb = k - m * 16777216,
          q = (y * W + x) * 4;
        outD[q] = rgb >> 16;
        outD[q + 1] = (rgb >> 8) & 255;
        outD[q + 2] = rgb & 255;
        outD[q + 3] = 255;
        outM[y * W + x] = m;
      }
  }
  const DEG = Math.PI / 180;
  // angle de l'arme selon la pose : 1 = armer, 2 = frapper (au corps à corps grand arc, à distance geste court)
  const SWING = {
    tome: [-12, 14, 5],
    sword: [35, -70, -28],
    axe: [40, -70, -28],
    great: [40, -70, -28],
    dagger: [30, -55, -20],
    spear: [15, -35, -12],
    staff: [10, -18, -6],
    gmstaff: [10, -18, -6],
    bow: [0, 0, 0]
  };
  const SWING_SIDE = {
    tome: [-15, 18, 6],
    sword: [-55, 40, 16],
    axe: [-60, 45, 18],
    great: [-60, 45, 18],
    dagger: [-45, 35, 12],
    spear: [-20, 15, 6],
    staff: [-15, 20, 8],
    gmstaff: [-15, 20, 8],
    bow: [0, 0, 0]
  };

  /* ---------- peintre ---------- */
  // look : [coiffure, couleur des cheveux, tenue, peau, chapeau] ; gear : { slot: { icon, c, rar } }
  // dir : 'front' | 'back' | 'side' ; fr : image de marche 0–3 ; blink : yeux fermés
  // pose : 0 normal, 1 arme armée, 2 frappe, 3 retour (animation d'attaque)
  function paint(look, gear, dir, fr, blink, pose) {
    gear = gear || {};
    pose = pose | 0;
    const data = new Uint8ClampedArray(W * H * 4),
      mat = new Int16Array(W * H).fill(-1); // mat : indice de la rampe (pour le contour teinté)
    let tgtD = data,
      tgtM = mat;
    const RAMPS = [];
    const rampId = r => {
      let k = RAMPS.indexOf(r);
      if (k < 0) {
        RAMPS.push(r);
        k = RAMPS.length - 1;
      }
      return k;
    };
    const hair = HAIR[look[1]] || HAIR[0],
      skin = SKIN[look[3]] || SKIN[0];
    const tunic = ramp5(TUNIC[look[2]] || TUNIC[0]);
    const ch = gear.chest,
      lg = gear.legs,
      ft = gear.feet,
      hd = gear.head,
      wp = gear.weapon,
      sh = wp && wp.icon === 'sword' && gear.offhand && gear.offhand.icon === 'shield' ? gear.offhand : null;
    const shR = sh ? (sh.fx === 'gm' ? GMR : ramp5(sh.c)) : null,
      shT = sh ? (sh.fx === 'gm' ? GMT : sh.rar >= 2 ? GOLD : [FIX.o, FIX.O, FIX.P, hex('#e0b070')]) : null;
    const gm = ch && ch.fx === 'gm',
      plate = ch && ch.icon === 'plate';
    const chestR = gm ? GMR : ch ? (plate ? metal(ch.c) : ramp5(ch.c)) : tunic;
    const legsR = lg ? (lg.fx === 'gm' ? GMR : ramp5(lg.c)) : DEF_LEGS,
      feetR = ft ? (ft.fx === 'void' ? ramp5('#5a3ab8') : ft.fx === 'gm' ? GMR : ramp5(ft.c)) : DEF_FEET;
    const goldOr = (rar, r) => (rar >= 2 ? GOLD : [r[0], r[1], r[3], r[4]]);
    const capeR = gm ? GMW : ch && ch.rar >= 2 ? ramp5(['#ece8f4', '#5ee870', '#3a6ad0', '#8a3ad0', '#d0402a'][ch.rar]) : null;
    const hairR = [hair[0], hair[1], hair[2], hair[3], hair[4], hair[5]];
    const put = (x, y, c, r) => {
      x += OX;
      y += OY;
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const k = (y * W + x) * 4;
      tgtD[k] = c[0];
      tgtD[k + 1] = c[1];
      tgtD[k + 2] = c[2];
      tgtD[k + 3] = 255;
      tgtM[y * W + x] = rampId(r);
    };
    // dessine une couche : R = rampe des chiffres, T = rampe des liserés (g G y Y)
    const layer = (rows, R, T, dx, dy) => {
      if (!rows) return;
      dx = dx || 0;
      dy = dy || 0;
      T = T || GOLD;
      for (const [y, x0, s] of rows)
        for (let i = 0; i < s.length; i++) {
          const c = s[i];
          if (c === '.' || c === ' ') continue;
          const x = x0 + i + dx,
            yy = y + dy;
          if (c >= '1' && c <= '5') put(x, yy, R[c.charCodeAt(0) - 49], R);
          else if (c >= 'a' && c <= 'f') put(x, yy, hairR[c.charCodeAt(0) - 97], hairR);
          else if (c === 's' || c === 't' || c === 'u' || c === 'v') put(x, yy, skin['stuv'.indexOf(c)], skin);
          else if (c === 'g' || c === 'G' || c === 'y' || c === 'Y') put(x, yy, T['gGyY'.indexOf(c)], T);
          else if (c === 'p' || c === 'q' || c === 'r') {
            const tr = gm && yy >= 20 ? GMW : tunic;
            put(x, yy, tr['pqr'.indexOf(c) + 1], tr);
          } else if (FIX[c])
            put(
              x,
              yy,
              FIX[c],
              c === 'L' || c === 'M' || c === 'N' ? FIX_LEATHER : c === 'o' || c === 'O' || c === 'P' ? FIX_WOOD : FIX_DARK
            );
        }
    };
    // marche sur 8 images : la jambe gauche se lève puis redescend (1, 2, 1), puis la droite ; bras et arme en balancier
    const W8 = [
        [0, 0],
        [1, 0],
        [2, 0],
        [1, 0],
        [0, 0],
        [0, 1],
        [0, 2],
        [0, 1]
      ],
      wl = W8[(fr | 0) % 8],
      liftL = wl[0],
      liftR = wl[1];
    const step = liftL ? 1 : liftR ? -1 : 0; // 1 : jambe gauche levée ; -1 : jambe droite levée
    // arme peinte à part puis tournée autour de la main (px, py en coordonnées de grille)
    const layerRot = (rows, R, T, dx, dy, deg, px, py) => {
      if (!deg) return layer(rows, R, T, dx, dy);
      const D = new Uint8ClampedArray(W * H * 4),
        M = new Int16Array(W * H).fill(-1);
      tgtD = D;
      tgtM = M;
      layer(rows, R, T, dx, dy);
      tgtD = data;
      tgtM = mat;
      rotsprite(D, M, deg * DEG, px + dx + OX + 0.5, py + dy + OY + 0.5, data, mat);
    };
    const style = look[0] | 0,
      hatK = hd ? 0 : look[4] | 0;
    const hatPal = look[4] === 1 ? ramp5('#5e3cb4') : null;
    const wpR = wp
      ? wp.fx === 'gm'
        ? GMR
        : wp.icon === 'staff' || wp.icon === 'bow' || wp.icon === 'tome'
          ? ramp5(wp.c)
          : metal(wp.c)
      : null;
    const tome = wp && wp.icon === 'tome',
      bob = [0, -1, -1, -1, 0, 1, 1, 1][(fr | 0) % 8] || 0;
    const wpT = wp ? (wp.fx === 'gm' ? GMT : goldOr(wp.rar, STEEL)) : GOLD;
    const gmKnee = lg && lg.fx === 'gm',
      gmHelm = hd && hd.icon === 'gmhelm';
    const cape = (rows0, rows1, front) => {
      if (!capeR) return;
      for (let y = rows0; y <= rows1; y++) {
        const l = y < 28 ? 8 : y < 34 ? 7 : 6,
          r = 37 - l;
        let s = '';
        for (let x = l; x <= r; x++) {
          const f = (x - l) % 5;
          s += front
            ? x === l
              ? '5'
              : x < l + 5
                ? f !== 4
                  ? '4'
                  : '3'
                : x < r - 4
                  ? f !== 4
                    ? '3'
                    : '2'
                  : f !== 1
                    ? '2'
                    : '3'
            : x === l
              ? '4'
              : f === 2
                ? '2'
                : x < 19
                  ? '4'
                  : '3';
        }
        if (y === rows1)
          s = s
            .split('')
            .map((c, i) => (i % 5 > 2 ? '.' : c))
            .join('');
        layer([[y, l, s]], capeR);
      }
    };
    if (dir === 'front') {
      cape(23, 44, true);
      if (style === 1) layer(F.hairBack);
      const A = gm ? F.gm : plate ? F.plate : F.tunic,
        AT = gm ? GMT : plate ? goldOr(ch.rar, STEEL) : ch ? goldOr(ch.rar, chestR) : goldOr(0, tunic);
      layer(F.legL, legsR, null, 0, -liftL);
      layer(F.legR, legsR, null, 0, -liftR);
      layer(F.bootL, feetR, goldOr(ft ? ft.rar : 0, feetR), 0, -liftL);
      layer(F.bootR, feetR, goldOr(ft ? ft.rar : 0, feetR), 0, -liftR);
      if (gmKnee) {
        layer(F.gmKnee.slice(0, 2), GMR, GMT, 0, -liftL);
        layer(F.gmKnee.slice(2), GMR, GMT, 0, -liftR);
      }
      layer(A.body, chestR, AT);
      layer(A.armR, chestR, AT, 0, -step);
      layer(F.face, skin);
      if (blink) layer(F.blink, skin);
      if (hd && hd.icon === 'hood') layer(F.hood, ramp5(hd.c), goldOr(hd.rar, ramp5(hd.c)));
      else {
        layer(F.hair[style] || F.hair[0]);
        if (hd && hd.icon === 'helm') layer(F.helm, metal(hd.c, 0.3), goldOr(hd.rar, metal(hd.c, 0.3)));
        else if (hd && hd.icon === 'crown') layer(F.crown, ramp5(hd.c), goldOr(2, GOLD));
        else if (gmHelm) layer(F.gmhelm, GMR, GMT);
        else if (hatK === 1) layer(F.hats[1], null, GOLD);
        else if (hatK) layer(F.hats[hatK]);
      }
      // bras armé : marche (balancier), armer (bras levé), frapper (bras abaissé et avancé)
      const ax = pose === 2 ? -1 : 0,
        ay = pose === 1 ? -2 : pose === 2 ? 1 : step;
      if (wp) {
        const key = wp.fx === 'gm' && wp.icon === 'staff' ? 'gmstaff' : wp.icon,
          rows = F.weapons[key];
        if (rows) {
          const sw = SWING[key] || [0, 0, 0],
            deg = pose ? sw[pose - 1] : (liftL - liftR) * 3;
          const main = key === 'dagger' ? rows.filter(r => r[1] < 20) : rows;
          layerRot(main, wpR, wpT, ax, ay, deg, 9, 31);
          if (key === 'dagger')
            layerRot(
              rows.filter(r => r[1] >= 20),
              wpR,
              wpT,
              0,
              -step,
              pose ? -sw[pose - 1] : 0,
              29,
              31
            );
        }
      }
      layer(A.armL, chestR, AT, ax, ay);
      if (sh) layer(F.shield, shR, shT, 0, -step);
      if (tome)
        layer(
          orbAt(31 + (pose === 2 ? 1 : 0), 26 + bob - (pose === 1 ? 4 : pose === 2 ? 1 : 0), fr | 0).concat(
            pose === 2
              ? [
                  [24, 30, 'l'],
                  [31, 37, 'l'],
                  [23, 35, 'w']
                ]
              : []
          )
        );
    } else if (dir === 'back') {
      if (wp && B.weapons[wp.icon]) layer(B.weapons[wp.icon], wpR, wpT);
      layer(B.legL, legsR, null, 0, -liftL);
      layer(B.legR, legsR, null, 0, -liftR);
      layer(B.bootL, feetR, goldOr(ft ? ft.rar : 0, feetR), 0, -liftL);
      layer(B.bootR, feetR, goldOr(ft ? ft.rar : 0, feetR), 0, -liftR);
      if (gmKnee) layer(B.gmKnee, GMR, GMT);
      layer(plate || gm ? B.plate : B.tunic, chestR, gm ? GMT : plate ? goldOr(ch.rar, STEEL) : goldOr(ch ? ch.rar : 0, chestR));
      if (capeR) cape(23, 44, false);
      if (gm) layer(B.gmPauldrons, GMR, GMT);
      if (sh) layer(B.shield, shR, shT, 0, -step);
      if (tome) layer(orbAt(32, 21 + bob, fr | 0));
      if (wp && B.weapons[wp.icon] && !capeR) layer(B.weapons[wp.icon], wpR, wpT);
      else if (wp && B.weapons[wp.icon])
        layer(
          B.weapons[wp.icon].filter(r => r[0] < 24),
          wpR,
          wpT
        );
      if (hd && hd.icon === 'hood') layer(B.hood, ramp5(hd.c));
      else {
        layer(B.head);
        if (!hd) layer(B.top[style] || []);
        if (style === 1) layer(B.hairLong);
        if (hd && hd.icon === 'helm') layer(B.helm, metal(hd.c, 0.3), goldOr(hd.rar, metal(hd.c, 0.3)));
        else if (hd && hd.icon === 'crown') layer(F.crown, ramp5(hd.c), GOLD);
        else if (gmHelm) layer(B.gmhelm, GMR, GMT);
        else if (hatK === 1) layer(F.hats[1], null, GOLD);
        else if (hatK === 2) layer(F.hats[2].slice(0, 2));
        else if (hatK === 3) layer(F.hats[3]);
      }
    } else {
      // profil : la jambe et le bras arrière sont plus sombres et peints avant le corps
      const Lg = S.legs[liftL ? 1 : liftR ? 2 : 0],
        A = plate || gm ? S.plate : S.tunic,
        AT = gm ? GMT : plate ? goldOr(ch.rar, STEEL) : goldOr(ch ? ch.rar : 0, chestR);
      if (capeR) {
        for (let y = 23; y <= 43; y++) {
          const w = 3 + ((y - 23) >> 2);
          layer([[y, 12 - w + 2, '4'.repeat(1) + '3'.repeat(Math.max(1, w - 2)) + '2']], capeR);
        }
      }
      if (style === 1) layer(S.hairLong);
      const sax = pose === 1 ? -1 : pose === 2 ? 2 : step,
        say = pose === 1 ? -1 : 0,
        ssw = wp ? SWING_SIDE[wp.icon] || [0, 0, 0] : [0, 0, 0],
        sdeg = pose ? ssw[pose - 1] : (liftL - liftR) * -2.5;
      if (wp && wp.icon === 'staff') layerRot(S.weapons.staff, wpR, wpT, sax, say + (step ? -1 : 0), sdeg, 19, 31);
      layer(Lg.back, legsR);
      layer(Lg.bootB, feetR, goldOr(ft ? ft.rar : 0, feetR));
      layer(Lg.front, legsR);
      layer(Lg.bootF, feetR, goldOr(ft ? ft.rar : 0, feetR));
      if (gmKnee && step === 0) layer(S.gmKnee, GMR, GMT);
      layer(A.body, chestR, AT);
      if (sh) layer(S.shield, shR, shT);
      layer(S.face, skin);
      if (blink) layer(S.blink, skin);
      if (hd && hd.icon === 'hood') layer(S.hood, ramp5(hd.c));
      else {
        layer(S.head);
        layer(S.top[style] || []);
        if (hd && hd.icon === 'helm') layer(S.helm, metal(hd.c, 0.3), goldOr(hd.rar, metal(hd.c, 0.3)));
        else if (hd && hd.icon === 'crown') layer(S.crown, ramp5(hd.c), GOLD);
        else if (gmHelm) layer(S.gmhelm, GMR, GMT);
        else if (hatK === 1) layer(S.hats[1], null, GOLD);
        else if (hatK) layer(S.hats[hatK]);
      }
      if (wp && S.weapons[wp.icon] && wp.icon !== 'staff') layerRot(S.weapons[wp.icon], wpR, wpT, sax, say + (step ? -1 : 0), sdeg, 19, 30);
      layer(A.arm, chestR, AT, sax, say);
      if (gm) layer(S.gmSpikes, GMR, GMT, sax, say);
      if (tome) layer(orbAt(31 + (pose === 2 ? 3 : pose === 1 ? -1 : 0), 25 + bob - (pose === 1 ? 3 : 0), fr | 0));
    }
    // chapeau de mage : les lettres p q r prennent la couleur du chapeau, pas celle de la tenue
    // (géré en repeignant après coup : plus simple que de multiplier les rampes)
    if (hatPal && !hd) recolor(data, mat, RAMPS, tunic, hatPal, dir, look);
    // contour teinté par matière + halo sombre semi-transparent
    const out = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (data[(y * W + x) * 4 + 3]) continue;
        let best = -1;
        for (const [a, b] of [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0]
        ]) {
          const xx = x + a,
            yy = y + b;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const m = mat[yy * W + xx];
          if (m >= 0 && data[(yy * W + xx) * 4 + 3] === 255) {
            best = m;
            break;
          }
        }
        if (best >= 0) out.push([x, y, best]);
      }
    for (const [x, y, m] of out) {
      const c = mix(RAMPS[m][0], [14, 6, 22], 0.62),
        k = (y * W + x) * 4;
      data[k] = c[0];
      data[k + 1] = c[1];
      data[k + 2] = c[2];
      data[k + 3] = 255;
      mat[y * W + x] = -2;
    }
    const halo = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (data[(y * W + x) * 4 + 3]) continue;
        for (const [a, b] of [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0]
        ]) {
          const xx = x + a,
            yy = y + b;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H && mat[yy * W + xx] === -2) {
            halo.push(x, y);
            break;
          }
        }
      }
    for (let i = 0; i < halo.length; i += 2) {
      const k = (halo[i + 1] * W + halo[i]) * 4;
      data[k] = 16;
      data[k + 1] = 10;
      data[k + 2] = 26;
      data[k + 3] = 60;
    }
    return { w: W, h: H, data };
  }
  const FIX_LEATHER = [FIX.L, FIX.M, FIX.N],
    FIX_WOOD = [FIX.o, FIX.O, FIX.P],
    FIX_DARK = [hex('#2a1a30')];
  // repeint les pixels « tenue » de la zone du chapeau de mage (au-dessus de la ligne 7) avec la rampe du chapeau
  function recolor(data, mat, RAMPS, from, to, dir, look) {
    const id = RAMPS.indexOf(from);
    if (id < 0) return;
    RAMPS.push(to);
    const nid = RAMPS.length - 1;
    for (let y = 0; y < OY + 7; y++)
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        if (mat[p] !== id) continue;
        const k = p * 4;
        for (let t = 0; t < 5; t++)
          if (data[k] === from[t][0] && data[k + 1] === from[t][1] && data[k + 2] === from[t][2]) {
            data[k] = to[t][0];
            data[k + 1] = to[t][1];
            data[k + 2] = to[t][2];
            mat[p] = nid;
            break;
          }
      }
  }
  window.EtheriaSprites = { paint, W, H, FOOT_Y, CX, ramp5 };
})();
