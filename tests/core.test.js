/* Tests du moteur partagé (client/core.js + client/content.js), sans dépendance : node --test tests/
   Ils protègent les règles qui ne doivent jamais casser : sauvegardes, île d'origine identique, îles et donjons
   praticables à pied, contenu cohérent, format des messages. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const C = require('../client/core.js');

// accessibilité à pied depuis un point (mêmes règles que le héros : pas d'obstacle, marche d'au plus 1 niveau)
function reach(W, x, y) {
  const seen = new Uint8Array(W.MW * W.MH),
    q = [[Math.floor(x), Math.floor(y)]];
  seen[W.idx(q[0][0], q[0][1])] = 1;
  for (let h = 0; h < q.length; h++) {
    const [i, j] = q[h];
    for (const [a, b] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      const u = i + a,
        v = j + b;
      if (!W.walkable(u, v) || seen[W.idx(u, v)] || Math.abs(W.HT[W.idx(u, v)] - W.HT[W.idx(i, j)]) > 1) continue;
      seen[W.idx(u, v)] = 1;
      q.push([u, v]);
    }
  }
  return (px, py) => !!seen[W.idx(Math.floor(px), Math.floor(py))];
}
const newSim = (isle, save) => {
  const W = C.buildWorld(C.SEED, isle),
    sim = new C.Sim(W, { lvl: (save && save.lvl) || 10, dg: save && save.dg });
  const p = sim.addPlayer('a', 'Testeur', [0, 0, 0, 0, 0], Object.assign({ lvl: 10, isle }, save));
  sim.events.length = 0;
  return { W, sim, p };
};

test("l'île d'origine ne change jamais (empreinte de la génération)", () => {
  const W = C.buildWorld(C.SEED),
    h = crypto.createHash('sha1');
  for (const a of [W.TY, W.HT, W.SOL]) h.update(Buffer.from(a));
  for (const a of [W.spawns, W.nodes, W.props]) h.update(JSON.stringify(a));
  assert.equal(h.digest('hex'), 'a71a5d24428f6d42539da694e47db35d0dd89fa1');
});

test('la sauvegarde garde tous ses champs, et un aller-retour ne perd rien', () => {
  // champs historiques : on peut en ajouter, jamais en retirer ni en renommer
  const REQUIRED = [
    'gifts',
    'cls',
    'lvl',
    'xp',
    'gold',
    'potions',
    'q',
    'qs',
    'qn',
    'inv',
    'equip',
    'bag',
    'ether',
    'glvl',
    'gxp',
    'scarves',
    'scarf',
    'day',
    'stepsToday',
    'mast',
    'pts',
    'bar',
    'fr',
    'isle',
    'isles',
    'arr',
    'sk',
    'skc',
    'dg',
    'ttl',
    'tt'
  ];
  const { sim, p } = newSim(
    { k: 'bourg' },
    { lvl: 19, xp: 1234, gold: 999, mast: { staff: 500 }, pts: { str: 0, sta: 10, int: 20, agi: 0 }, ttl: 3, tt: 1, sk: { 'staff:1': 40 } }
  );
  const sd = sim.saveData(p);
  for (const k of REQUIRED) assert.ok(k in sd, 'champ manquant : ' + k);
  const round = s => {
    const o = newSim({ k: 'bourg' }, JSON.parse(JSON.stringify(s)));
    return JSON.parse(JSON.stringify(o.sim.saveData(o.p)));
  };
  const sd2 = round(sd);
  assert.deepEqual(round(sd2), sd2, 'recharger une sauvegarde doit la rendre telle quelle');
  for (const k of ['lvl', 'xp', 'gold', 'mast', 'pts', 'ttl', 'tt', 'sk'])
    assert.deepEqual(sd2[k], JSON.parse(JSON.stringify(sd[k])), 'champ modifié : ' + k);
});

test('une sauvegarde abîmée ou très ancienne est réparée sans erreur', () => {
  for (const save of [
    {},
    { lvl: 'x', bag: 'oops', equip: { weapon: [999, 9] }, isle: { k: 'nulle-part' }, sk: { '<script>': 5 } },
    { lvl: 8, cls: 2 }
  ]) {
    const { sim, p } = newSim({ k: 'bourg' }, save);
    assert.ok(p.lvl >= 1 && Array.isArray(p.bag) && p.isle.k === 'bourg');
    assert.doesNotThrow(() => JSON.stringify(sim.saveData(p)));
  }
});

test("îles : le pont du retour et l'entrée du donjon sont atteignables à pied depuis l'arrivée", () => {
  const isles = [{ k: 'givre' }, { k: 'braise' }];
  for (let s = 1; s <= 150; s++) isles.push({ k: 'brume', s });
  for (const isle of isles) {
    const W = C.buildWorld(C.SEED, isle),
      ok = reach(W, W.spawn.x, W.spawn.y),
      home = W.bridges.find(b => b.kind === 'home');
    assert.ok(home && ok(home.hx, home.hy), 'pont du retour inaccessible : ' + JSON.stringify(isle));
    assert.ok(W.gate && ok(W.gate.x + 1.5, W.gate.y + 1.5), 'entrée du donjon inaccessible : ' + JSON.stringify(isle));
  }
});

test('donjons : boss, coffre et sorties atteignables pour chaque rareté', () => {
  for (let r = 0; r < C.DG.length; r++)
    for (let s = 1; s <= 40; s++) {
      const W = C.buildWorld(C.SEED, { k: 'donjon', s, r, b: 0, f: { k: 'givre' } }),
        ok = reach(W, W.spawn.x, W.spawn.y),
        D = W.dg,
        boss = W.spawns[D.bossK];
      for (const [name, o] of [
        ['coffre', W.chest],
        ['sortie', D.exit],
        ['portail', D.portal],
        ['boss', { x: boss.i + 0.5, y: boss.j + 0.5 }]
      ])
        assert.ok(ok(o.x, o.y), `${name} inaccessible (rareté ${r}, graine ${s})`);
      assert.equal(W.spawns.filter(o => o.elite).length, Math.min(C.DG[r].elite, W.spawns.filter(o => o.elite).length));
    }
});

test("donjon : entrer, vaincre le boss, ouvrir le coffre, sortir ; l'entrée s'éteint", () => {
  const isle = newSim({ k: 'givre' }, { lvl: 19 });
  isle.p.x = isle.W.gate.x + 1.5;
  isle.p.y = isle.W.gate.y + 1.5;
  isle.sim.handle('a', { t: 'dgIn' });
  const tr = isle.sim.events.find(e => e.e === 'travel');
  assert.ok(tr && tr.to.k === 'donjon' && tr.to.f.k === 'givre');
  const inside = newSim(tr.to, isle.sim.saveData(isle.p));
  const boss = inside.sim.mobs[inside.W.dg.bossK];
  inside.p.x = inside.W.chest.x;
  inside.p.y = inside.W.chest.y;
  inside.sim.handle('a', { t: 'chest' });
  assert.ok(
    inside.sim.events.some(e => e.e === 'msg' && /scellé/.test(e.t)),
    'le coffre doit rester scellé tant que le boss vit'
  );
  boss.tagged.add('a');
  inside.sim.killMob(boss);
  inside.sim.handle('a', { t: 'chest' });
  assert.ok(inside.sim.events.some(e => e.e === 'chest' && e.dg));
  inside.p.x = inside.W.dg.exit.x;
  inside.p.y = inside.W.dg.exit.y;
  inside.sim.handle('a', { t: 'dgOut' });
  const out = inside.sim.saveData(inside.p);
  assert.deepEqual(out.isle, { k: 'givre' });
  assert.equal(out.arr, 2);
  assert.equal(out.dg.done, 1);
  const back = newSim(out.isle, out);
  assert.equal(back.sim.dg.done, 1);
  assert.ok(Math.hypot(back.p.x - back.W.gate.x, back.p.y - back.W.gate.y) < 2.5, "on ressort devant l'entrée");
});

test('contenu : chaque référence pointe vers quelque chose qui existe', () => {
  const ICONS = new Set([
    'sword',
    'staff',
    'axe',
    'hood',
    'helm',
    'crown',
    'tunic',
    'plate',
    'pants',
    'boots',
    'spore',
    'amulet',
    'shard',
    'bow',
    'shield',
    'dagger',
    'spear',
    'great',
    'gmhelm',
    'tome'
  ]);
  C.ITEMS.forEach((it, i) => {
    assert.ok(C.SLOTS.includes(it.slot), 'emplacement inconnu, objet ' + i);
    assert.ok(ICONS.has(it.icon), 'icône inconnue, objet ' + i);
  });
  for (const k in C.LOOT) {
    assert.ok(C.MOBDEF[k], 'butin pour un monstre inconnu : ' + k);
    for (const id of C.LOOT[k].items) assert.ok(C.ITEMS[id], 'objet inconnu dans le butin de ' + k);
  }
  for (const Q of C.QUESTS) {
    assert.ok(C.MOBDEF[Q.mob], 'quête : monstre inconnu ' + Q.mob);
    assert.ok(C.NPCS[Q.giver]);
    if (Q.reward) assert.ok(C.ITEMS[Q.reward[0]]);
  }
  for (const k in C.ISLES) for (const m of C.ISLES[k].mobs || []) assert.ok(C.MOBDEF[m], 'île ' + k + ' : monstre inconnu ' + m);
  for (const T of C.DG) for (const m of T.mobs) assert.ok(C.MOBDEF[m], 'donjon : monstre inconnu ' + m);
  for (const B of C.DG_BOSSES) {
    assert.ok(C.MOBDEF[B.type]);
    assert.ok(C.ITEMS[B.item]);
    if (B.title) assert.ok(C.TITLES.some(t => t[0] === B.title));
  }
  for (const R of C.RECIPES) {
    assert.ok(C.NPCS[R.npc]);
    if (R.item) assert.ok(C.ITEMS[R.item[0]]);
  }
  for (const [id] of C.START) assert.equal(C.ITEMS[id].slot, 'weapon');
});

test("format des messages : l'état public est du JSON simple et ne masque pas le type du message", () => {
  for (const isle of [{ k: 'bourg' }, { k: 'givre' }, { k: 'donjon', s: 3, r: 2, b: 4, f: { k: 'braise' } }]) {
    const { sim } = newSim(isle);
    for (let i = 0; i < 20; i++) sim.step(0.1);
    const st = sim.publicState(),
      me = sim.meState('a');
    assert.ok(!('t' in st) && !('t' in me), '« t » est réservé au type du message (« s »)');
    assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
    assert.equal(st.m.length, sim.mobs.length);
  }
});

test('le serveur et le client parlent la même version', () => {
  assert.ok(Number.isInteger(C.VERSION) && C.VERSION > 0);
});

test("traverser ensemble : deux héros partis à moins de 10 s d'écart arrivent sur la même île", () => {
  for (let k = 0; k < 20; k++) {
    const W = C.buildWorld(C.SEED), sim = new C.Sim(W), eb = W.bridges.find(b => b.kind === 'ether'), to = [];
    for (const id of ['a', 'b']) { const p = sim.addPlayer(id, id, [0, 0, 0, 0, 0], { lvl: 5, ether: 10 }); p.x = eb.ex; p.y = eb.ey; }
    sim.handle('a', { t: 'cross', b: 0 });
    for (let i = 0; i < 50; i++) sim.step(0.1); // 5 s plus tard
    sim.handle('b', { t: 'cross', b: 0 });
    for (const e of sim.events) if (e.e === 'travel') to.push(JSON.stringify(e.to));
    assert.equal(to.length, 2); assert.equal(to[0], to[1]);
  }
});
