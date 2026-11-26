/* Pixels Worlds — client, input.js : Entrées (tactile, clavier), page personnage, dialogues des PNJ, artisanat, marche réelle.
   Les fichiers de client/game/ se partagent leurs déclarations (scripts classiques chargés dans l'ordre par persist.js,
   voir GAME_FILES) : une fonction ou une variable d'un fichier sert aux suivants. */
'use strict';
/* ---------- entrées ---------- */
const input = { atkBtn: false, atkKey: false, ab: -1, pot: false };
const CL = () => C.kitOf(me.equip, me.mast, me.bar, me.sk, me.lvl, me.skc, me.stats && me.stats.int); // arme en main → attaque de base + 3 techniques
const localAbCd = [0, 0, 0];
const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 },
  keys = {},
  pointers = new Map(),
  btnDown = {};
function btns() {
  const b = UH - 12 - SB,
    K0 = CL();
  return {
    atk: { x: UW - 27, y: b - 18, r: 18, icon: 'a_' + K0.basic.icon },
    s0: { x: UW - 62, y: b - 6, r: 12, icon: 'a_' + K0.ab[0].icon, ab: 0 },
    s1: { x: UW - 59, y: b - 38, r: 12, icon: 'a_' + K0.ab[1].icon, ab: 1 },
    s2: { x: UW - 31, y: b - 57, r: 12, icon: 'a_' + K0.ab[2].icon, ab: 2 },
    pot: { x: UW - 91, y: b - 4, r: 10, icon: 'potion' },
    chat: { x: UW - 64, y: 16 + ST, r: 9, icon: 'chat' },
    bag: { x: UW - 64, y: 38 + ST, r: 9, icon: 'bag' },
    zoom: { x: UW - 64, y: 60 + ST, r: 9, icon: 'zoom' }
  };
}
const toU = e => ({ x: (e.clientX * dpr) / SU, y: (e.clientY * dpr) / SU });
function hitBtn(p) {
  const B = btns();
  for (const k in B) {
    const b = B[k];
    if (Math.hypot(p.x - b.x, p.y - b.y) <= b.r + 4) return k;
  }
  return null;
}
function pressBtn(k, down) {
  btnDown[k] = down;
  if (k === 'atk') input.atkBtn = down;
  else if (down) {
    if (k[0] === 's' && k.length === 2) input.ab = +k[1];
    if (k === 'pot') input.pot = true;
    if (k === 'chat') openChat();
    if (k === 'bag') openChar();
    if (k === 'zoom') setZoom((ZOOM + 1) % 3);
  }
}
cvU.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (e.pointerType === 'touch') usedTouch = true;
  if (mode !== 'play') return;
  const p = toU(e);
  if (Math.hypot(p.x - (UW - 27), p.y - (27 + ST)) < 25) {
    showFps = !showFps;
    return;
  } // mini-carte → compteur d'images/s
  if (p.x >= 3 && p.x <= 3 + Math.min(104, UW - 64) && p.y >= ST + 3 && p.y <= ST + 36) {
    openChar();
    return;
  } // portrait → page personnage
  if (hudWalk && p.x >= hudWalk.x && p.x <= hudWalk.x + hudWalk.w && p.y >= hudWalk.y - 3 && p.y <= hudWalk.y + hudWalk.h + 3) {
    openWalk();
    return;
  }
  if (
    talkRect &&
    p.x >= talkRect.x - 3 &&
    p.x <= talkRect.x + talkRect.w + 3 &&
    p.y >= talkRect.y - 4 &&
    p.y <= talkRect.y + talkRect.h + 4
  ) {
    interact();
    return;
  }
  const b = hitBtn(p);
  if (b) {
    pointers.set(e.pointerId, { type: 'btn', b });
    pressBtn(b, true);
    return;
  }
  if (!joy.active && p.x < UW * 0.62) {
    joy.active = true;
    joy.id = e.pointerId;
    joy.ox = joy.x = p.x;
    joy.oy = joy.y = p.y;
    pointers.set(e.pointerId, { type: 'joy' });
  }
  try {
    cvU.setPointerCapture(e.pointerId);
  } catch (err) {
    /* ignore */
  }
});
cvU.addEventListener('pointermove', e => {
  if (joy.active && e.pointerId === joy.id) {
    const p = toU(e);
    joy.x = p.x;
    joy.y = p.y;
  }
});
function release(e) {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  pointers.delete(e.pointerId);
  if (p.type === 'btn') pressBtn(p.b, false);
  if (p.type === 'joy') {
    joy.active = false;
    joy.id = null;
  }
}
cvU.addEventListener('pointerup', release);
cvU.addEventListener('pointercancel', release);
document.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (mode !== 'play') return;
  if (e.code === 'Space') {
    input.atkKey = true;
    e.preventDefault();
  }
  if (e.code === 'KeyE' || e.code === 'Digit1') input.ab = 0;
  if (e.code === 'Digit2') input.ab = 1;
  if (e.code === 'Digit3') input.ab = 2;
  if (e.code === 'KeyR') input.pot = true;
  if (e.code === 'Enter') {
    e.preventDefault();
    openChat();
  }
  if (e.code === 'KeyF') interact();
  if (e.code === 'KeyI' || e.code === 'KeyC') openChar();
});
addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === 'Space') input.atkKey = false;
});
function inputDir() {
  if (joy.active) {
    const dx = joy.x - joy.ox,
      dy = joy.y - joy.oy,
      m = Math.hypot(dx, dy);
    if (m > 3) return [dx / m, dy / m];
  }
  const x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0),
    y = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  if (x || y) {
    const m = Math.hypot(x, y);
    return [x / m, y / m];
  }
  return [0, 0];
}
// dialogues avec les personnages
const dlg = $('dialog'),
  dport = $('dport'),
  dpx = dport.getContext('2d');
let dlgAction = null;
function openNpc(n) {
  if (!n || me.dead) return;
  input.atkBtn = false;
  joy.active = false;
  const Q = C.QUESTS[me.q],
    N = C.NPCS[n.id];
  let txt,
    obj = '',
    rew = '',
    ok = 'Au revoir',
    act = null,
    later = false;
  if (!Q) txt = "Pixels Worlds te doit beaucoup, gardien. Reviens nous voir quand la suite de l'histoire s'écrira.";
  else if (Q.giver !== n.id)
    txt = N.idle[Math.floor(Math.random() * N.idle.length)] + (me.qs === 0 ? ' ' + C.NPCS[Q.giver].name + ' te cherchait, je crois.' : '');
  else if (me.qs === 0) {
    txt = Q.intro;
    obj = Q.obj;
    rew =
      Q.xp +
      ' XP · ' +
      Q.gold +
      ' PO' +
      (Q.pot ? ' · ' + Q.pot + ' potion' + (Q.pot > 1 ? 's' : '') : '') +
      (Q.reward ? ' · ' + C.ITEMS[Q.reward[0]].n + ' (' + C.RARITY[Q.reward[1]][0].toLowerCase() + ')' : '');
    ok = 'Accepter';
    act = 'talk';
    later = true;
  } else if (me.qs === 1) {
    txt = Q.wait;
    obj = Q.short + ' : ' + me.qn + ' / ' + Q.n;
    ok = "J'y retourne";
  } else {
    txt = Q.done;
    rew =
      Q.xp +
      ' XP · ' +
      Q.gold +
      ' PO' +
      (Q.pot ? ' · ' + Q.pot + ' potion' + (Q.pot > 1 ? 's' : '') : '') +
      (Q.reward ? ' · ' + C.ITEMS[Q.reward[0]].n + ' (' + C.RARITY[Q.reward[1]][0].toLowerCase() + ')' : '');
    ok = 'Terminer la quête';
    act = 'talk';
  }
  $('dname').textContent = n.name;
  $('drole').textContent = N.role;
  $('dtitle').textContent = Q && Q.giver === n.id ? Q.title : '';
  $('dtitle').hidden = !(Q && Q.giver === n.id);
  $('dtext').textContent = txt;
  $('dobj').textContent = obj ? 'Objectif : ' + obj : '';
  $('dobj').hidden = !obj;
  $('drew').textContent = rew ? 'Récompense : ' + rew : '';
  $('drew').hidden = !rew;
  $('dok').textContent = ok;
  $('dno').hidden = !later;
  dlgAction = act ? n.id : null;
  dlgNpc = n.id;
  $('dcraft').hidden = !C.RECIPES.some(r => r.npc === n.id);
  $('dcraft').textContent = n.id === 'bran' ? 'Forge' : 'Atelier';
  $('dskc').hidden = n.id !== 'elya';
  $('dresp').hidden = n.id !== 'elya';
  $('dresp').textContent = 'Réinitialiser mes points (' + (me.fr ? 'gratuit' : fmt(me.rcost || 0) + ' PO') + ')';
  dpx.clearRect(0, 0, 32, 36);
  dpx.drawImage(n.set.front[0], 13, 8, 32, 36, 0, 0, 32, 36);
  dlg.hidden = false;
}
function closeDlg() {
  dlg.hidden = true;
}
let dlgNpc = null,
  craftNpc = null,
  craftSig = '',
  walkSig = '';
function interact() {
  if (me.dead || mode !== 'play' || travel) return;
  if (nearBridge) {
    if (nearBridge.kind === 'ether' && me.ether < C.ETHER_BRIDGE) {
      floatAt(me, 'Il faut ' + C.ETHER_BRIDGE + ' Éther', '#bfe6ff');
      openWalk();
      return;
    }
    link.send({ t: 'cross', b: W.bridges.indexOf(nearBridge) });
    return;
  }
  if (nearPortal) {
    link.send({ t: 'dgOut' });
    return;
  }
  if (nearGate) {
    if (!ISLE_DG || ISLE_DG[2]) floatAt(me, 'Donjon éteint', '#c8c0d8');
    else link.send({ t: 'dgIn' });
    return;
  }
  if (nearCorpse) {
    link.send({ t: 'loot', c: nearCorpse.id });
    return;
  }
  if (nearChest) {
    link.send({ t: 'chest' });
    return;
  }
  if (nearNpc) return openNpc(nearNpc);
  if (!nearNode) return;
  const R0 = C.RES[nearNode.res];
  if (me.glvl < R0.req) {
    floatAt(me, 'Cueillette nv' + R0.req + ' requise', '#c8c0d8');
    return;
  }
  if ((nodeCd[nearNode.k] || 0) >= time) {
    floatAt(me, 'Pas encore repoussé', '#c8c0d8');
    return;
  }
  if (me.ether < 1) {
    floatAt(me, "Pas assez d'Éther", '#bfe6ff');
    openWalk();
    return;
  }
  nodeCd[nearNode.k] = time + 1.5;
  link.send({ t: 'gather', k: nearNode.k });
}
const resLine = () => ['herb', 'wood', 'quartz'].map(k => C.RES[k].plural + ' ' + ((me.inv && me.inv[k]) || 0)).join(' · ');
function openCraft(id) {
  craftNpc = id;
  craftSig = '';
  dlg.hidden = true;
  renderCraft();
  $('craft').hidden = false;
}
function renderCraft() {
  if (!craftNpc) return;
  const sig = JSON.stringify([me.inv, me.bag && me.bag.length, me.scarves, me.scarf, me.glvl]);
  if (sig === craftSig) return;
  craftSig = sig;
  $('ctitle').textContent = craftNpc === 'bran' ? 'Forge de Bran' : 'Atelier de Mira';
  $('cinv').textContent = 'Inventaire : ' + resLine() + ' · Cueillette nv' + me.glvl;
  $('clist').innerHTML = C.RECIPES.map((r, i) => {
    if (r.npc !== craftNpc) return '';
    const locked = me.glvl < r.req,
      owned = r.scarf && me.scarves & (1 << r.scarf);
    const cost = Object.keys(r.cost)
      .map(k => {
        const have = (me.inv && me.inv[k]) || 0;
        return `<span class="${have >= r.cost[k] ? 'ok' : 'no'}">${r.cost[k]} ${C.RES[k].plural} (${have})</span>`;
      })
      .join(', ');
    const can = !locked && !owned && Object.keys(r.cost).every(k => ((me.inv && me.inv[k]) || 0) >= r.cost[k]);
    let btn;
    if (owned && r.scarf)
      btn =
        me.scarf === r.scarf
          ? '<button type="button" disabled>Portée</button>'
          : `<button type="button" data-scarf="${r.scarf}">Porter</button>`;
    else if (owned) btn = '<button type="button" disabled>Équipé</button>';
    else btn = `<button type="button" data-r="${i}" ${can ? '' : 'disabled'}>${locked ? 'Nv' + r.req : 'Fabriquer'}</button>`;
    const ic = r.item ? `<img class="ic r${r.item[1]}" src="${iconURL(r.item[0])}" alt="">` : '';
    return `<li>${ic}<div><b${r.item ? ' style="color:' + C.RARITY[r.item[1]][1] + '"' : ''}>${r.name}</b><small>${r.item ? statLine(r.item) : r.desc}</small><small>${locked ? 'Cueillette nv' + r.req + ' requise · ' : ''}${cost}</small></div>${btn}</li>`;
  }).join('');
}
$('clist').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled || !link) return;
  if (b.dataset.r != null) link.send({ t: 'craft', r: +b.dataset.r });
  if (b.dataset.scarf != null) link.send({ t: 'scarf', s: +b.dataset.scarf });
});
$('cclose').addEventListener('click', () => {
  $('craft').hidden = true;
  craftNpc = null;
});
$('dcraft').addEventListener('click', () => openCraft(dlgNpc));
$('dskc').addEventListener('click', () => {
  if (link) link.send({ t: 'skcReset' });
  closeDlg();
});
$('dresp').addEventListener('click', () => {
  if (link) link.send({ t: 'respec' });
  closeDlg();
});
/* ---------- page personnage : équipement, essayage, stats, sac, compétences ---------- */
const iconCache2 = new Map();
function iconURL(t) {
  let u0 = iconCache2.get(t);
  if (!u0) {
    const T = C.ITEMS[t];
    u0 = ARTAPI.itemIcon(T.icon, T.c).toDataURL();
    iconCache2.set(t, u0);
  }
  return u0;
}
function statLine(inst) {
  const st = C.itemStats(inst),
    el = C.instEl(inst);
  return (
    Object.keys(st)
      .map(k => '+' + st[k] + ' ' + C.STAT_NAMES[k])
      .join(' · ') + (el ? ' · <span style="color:' + C.ELEMENTS[el][1] + '">' + C.ELEMENTS[el][0] + '</span>' : '')
  );
}
let charSig = '',
  sel = null,
  charTab = 'stats',
  bagFilter = 'all',
  sellArm = false,
  prevDir = 0,
  prevSet = null; // sel = { from: 'bag', i } | { slot }
const ARMOR = ['head', 'chest', 'legs', 'feet', 'offhand'];
function openChar() {
  if (mode !== 'play') return;
  charSig = '';
  sel = null;
  sellArm = false;
  renderChar();
  $('char').hidden = false;
  input.atkBtn = false;
  joy.active = false;
}
function slotHTML(sl) {
  const it = me.equip && me.equip[sl];
  return it
    ? `<button type="button" class="slot r${it[1]}${sel && sel.slot === sl ? ' sel' : ''}" data-slot="${sl}" aria-label="${C.ITEMS[it[0]].n}"><img src="${iconURL(it[0])}" alt=""></button><span>${C.SLOT_NAMES[sl]}</span>`
    : `<button type="button" class="slot empty" data-slot="${sl}" aria-label="${C.SLOT_NAMES[sl]} vide"></button><span>${C.SLOT_NAMES[sl]}</span>`;
}
// équipement « essayé » : celui du héros avec l'objet sélectionné du sac à la place (ou l'emplacement vidé)
function trialEquip() {
  if (!sel || !me.equip) return null;
  const e = Object.assign({}, me.equip);
  if (sel.from === 'bag') {
    const inst = (me.bag || [])[sel.i];
    if (!inst) return null;
    e[C.ITEMS[inst[0]].slot] = inst;
    return e;
  }
  if (sel.slot) {
    e[sel.slot] = null;
    return e;
  }
  return null;
}
function tipHTML(inst, equipped) {
  const T = C.ITEMS[inst[0]],
    R0 = C.RARITY[inst[1]],
    st = C.itemStats(inst),
    cur = !equipped && me.equip && me.equip[T.slot] ? C.itemStats(me.equip[T.slot]) : null;
  const keys = [...new Set([...Object.keys(st), ...(cur ? Object.keys(cur) : [])])];
  const lines0 = keys
    .map(k => {
      const v = st[k] || 0,
        d = cur ? v - (cur[k] || 0) : 0;
      return `<li>${v ? '+' + v : '–'} ${C.STAT_NAMES[k]}${cur && d ? ` <em class="${d > 0 ? 'up' : 'down'}">(${d > 0 ? '+' : ''}${d})</em>` : ''}</li>`;
    })
    .join('');
  const fam = T.slot === 'weapon' ? C.FAMS[C.FAM_OF[T.icon]] : null,
    sm = C.mLevel((me.mast || {}).sword || 0).lv;
  const need =
    T.slot === 'offhand'
      ? C.weaponFam(me.equip) !== 'sword'
        ? '<li class="no">Se porte avec une épée à une main.</li>'
        : sm < 5
          ? '<li class="no">Maîtrise Épée à une main 5 requise (actuelle : ' + sm + ').</li>'
          : ''
      : '';
  const tooLow = me.lvl < T.lvl,
    lines =
      (fam ? `<li>Arme : ${fam.name} · attaque « ${fam.basic.name} »</li>` : '') +
      need +
      (() => {
        // élément : forces et faiblesses pour une arme, protection pour une armure
        const el = C.instEl(inst);
        if (!el) return '';
        const E = C.ELEMENTS,
          strong = C.BEATS[el],
          weak = Object.keys(C.BEATS).find(k => C.BEATS[k] === el),
          sp = k => `<span style="color:${E[k][1]}">${E[k][0]}</span>`;
        return T.slot === 'weapon'
          ? `<li>${sp(el)}${inst[2] != null ? ' (enchantée)' : ''} : +30 % contre ${sp(strong)}${weak !== strong ? `, −20 % contre ${sp(weak)}` : ''}</li>`
          : `<li>${sp(el)} : −5 % de dégâts de ${E[el][0]} subis · ensemble : 3 pièces +10 %, 5 pièces aura</li>`;
      })() +
      lines0 +
      (T.speed ? `<li>+${Math.round(T.speed * 100)} % vitesse de déplacement</li>` : '') +
      (T.fx === 'void' ? '<li class="lore">Laisse des empreintes de néant.</li>' : '') +
      (T.lore ? `<li class="lore">« ${T.lore} »</li>` : '');
  const sellBtn = `<button type="button" data-act="sell" class="sell">${sellArm ? 'Confirmer la vente' : 'Vendre ' + C.itemValue(inst) + ' PO'}</button>`;
  return `<b style="color:${R0[1]}">${T.n}</b><small>${R0[0]} · ${C.SLOT_NAMES[T.slot]} · <span class="${tooLow ? 'no' : ''}">Niveau ${T.lvl}${tooLow ? ' requis' : ''}</span></small><ul>${lines}</ul>${cur ? '<small>Comparé à ton objet équipé · stats ci-dessous avec cet objet</small>' : ''}
    <div class="tipb">${equipped ? `<button type="button" data-act="unequip">Retirer</button>` : `<button type="button" data-act="equip" ${tooLow ? 'disabled' : ''}>Équiper</button>${sellBtn}`}</div>`;
}
function statRows(rows) {
  return rows
    .map(
      ([k, v, d, unit]) =>
        `<div><span>${k}</span><b>${v == null ? '–' : v + (unit || '')}${d ? `<em class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}${unit || ''}</em>` : ''}</b></div>`
    )
    .join('');
}
function renderChar() {
  const sig = JSON.stringify([
    me.equip,
    me.bag,
    me.lvl,
    me.xp,
    me.gold,
    sel,
    charTab,
    bagFilter,
    sellArm,
    me.mast,
    me.pts,
    me.bar,
    me.free,
    me.fr,
    me.sk,
    me.skc,
    me.ttl,
    me.tt
  ]);
  if (sig === charSig) return;
  charSig = sig;
  const K0 = CL(),
    bag = me.bag || [];
  $('chtitle').textContent = me.name;
  $('chsub').textContent = 'Niveau ' + me.lvl + ' · ' + K0.name + ' (maîtrise ' + K0.ml + ') · ' + fmt(me.gold || 0) + ' PO';
  {
    let box = $('chttl');
    if (!box) {
      box = document.createElement('p');
      box.id = 'chttl';
      box.className = 'titles';
      $('chsub').after(box);
    }
    const own = C.TITLES.map((t, i) => [t, i]).filter(([t]) => me.ttl & t[0]);
    box.hidden = !own.length;
    box.innerHTML = own.length
      ? 'Titre : ' +
        [[null, -1], ...own]
          .map(([t, i]) => `<button type="button" data-tt="${i}" class="${me.tt === i ? 'on' : ''}">${t ? t[1] : 'aucun'}</button>`)
          .join('')
      : '';
  }
  const xpf = me.need ? Math.min(1, (me.xp || 0) / me.need) : 1;
  $('chxp').style.width = (xpf * 100).toFixed(1) + '%';
  $('chxpt').textContent = me.need ? 'XP ' + fmt(me.xp || 0) + ' / ' + fmt(me.need) : 'Niveau maximum (' + C.MAX_LVL + ')';
  $('slotsL').innerHTML = ['head', 'chest', 'legs', 'feet'].map(slotHTML).join('');
  $('slotsR').innerHTML = ['weapon', 'offhand', 'trinket'].map(slotHTML).join('');
  // stats actuelles, et différence si un objet est essayé
  const now = C.computeStats(me.lvl, me.equip, me.pts),
    te = trialEquip(),
    tr = te ? C.computeStats(me.lvl, te, me.pts) : null;
  const dv = (a, b) => (tr ? Math.round(b) - Math.round(a) : 0),
    S2 = now.stats,
    T2 = tr ? tr.stats : S2;
  $('chattr').innerHTML = statRows([
    ['Force', S2.str, dv(S2.str, T2.str)],
    ['Endurance', S2.sta, dv(S2.sta, T2.sta)],
    ['Intelligence', S2.int, dv(S2.int, T2.int)],
    ['Agilité', S2.agi, dv(S2.agi, T2.agi)],
    ['Armure', S2.armor, dv(S2.armor, T2.armor)]
  ]);
  const P = x => Math.round(x * 100);
  $('chstats').innerHTML = statRows([
    ['Attaque', Math.round(now.atk), tr ? dv(now.atk, tr.atk) : 0],
    ['Points de vie', now.maxhp, tr ? dv(now.maxhp, tr.maxhp) : 0],
    ['Points de mana', now.maxmp, tr ? dv(now.maxmp, tr.maxmp) : 0],
    ['Critique', P(now.crit), tr ? P(tr.crit) - P(now.crit) : 0, ' %'],
    ['Réduction', P(now.red), tr ? P(tr.red) - P(now.red) : 0, ' %'],
    ['Vitesse', P(now.speed), tr ? P(tr.speed) - P(now.speed) : 0, ' %'],
    ['Recharge (Int.)', '−' + P(C.intCdK(now.stats.int)), tr ? P(C.intCdK(now.stats.int)) - P(C.intCdK(tr.stats.int)) : 0, ' %'],
    ["Élément de l'arme", now.el ? C.ELEMENTS[now.el][0] : 'aucun'],
    [
      'Ensemble',
      now.setN
        ? now.setN + ' / 5' + (now.setEl ? ' ' + C.ELEMENTS[now.setEl][0] + (now.setN >= C.EL_SET[2] ? ' (aura)' : ' (+10 %)') : '')
        : 'aucun'
    ]
  ]);
  // points de caractéristiques (3 par niveau) ; réinitialisation chez Elya
  const free = me.free | 0,
    PN = { str: 'Force', sta: 'Endurance', int: 'Intelligence', agi: 'Agilité' };
  $('chpts').innerHTML =
    (free > 0
      ? `<p class="ptsn">${free} point${free > 1 ? 's' : ''} à répartir</p><div class="ptsb">${Object.keys(PN)
          .map(k => `<button type="button" data-pt="${k}">+ ${PN[k]}</button>`)
          .join('')}</div>`
      : '') +
    `<p class="muted small">Chaque niveau donne 3 points. Elya, à la fontaine, les réinitialise (${me.fr ? 'gratuit la première fois' : fmt(me.rcost || 0) + ' PO'}).</p>`;
  // compétences : celles de l'arme en main, débloquées par sa maîtrise ; 3 cases dans la barre
  const M0 = C.mLevel((me.mast || {})[K0.fam] || 0),
    inBar = K0.ab.map(a => (a.locked ? -1 : a.ti)),
    ico = n => (ART.icons['a_' + n] || ART.icons.a_slash).toDataURL();
  const mbar =
    K0.fam === 'none'
      ? '<p class="muted">Équipe une arme pour débloquer des techniques.</p>'
      : `<div class="mast"><b>${K0.name} · maîtrise ${M0.lv}${M0.lv >= C.MAST_MAX ? ' (max)' : ''}</b><div class="xp"><i style="width:${M0.need ? ((M0.cur / M0.need) * 100).toFixed(1) : 100}%"></i><span>${M0.need ? M0.cur + ' / ' + M0.need : 'Maîtrise complète'}</span></div><small>Elle monte en te battant avec cette arme.</small></div>`;
  // rang de la technique : progresse en l'utilisant, plafonné par le niveau du héros
  const rankHTML = key => {
    const I = C.skInfo((me.sk || {})[key] || 0, me.lvl);
    const note =
      I.r >= C.SK_MAX
        ? 'Rang maximum atteint.'
        : I.ready
          ? 'Prête à monter : rang ' + (I.r + 1) + ' au niveau ' + I.lvlNext + '.'
          : I.r >= I.cap
            ? 'Rang max ' + I.cap + ' à ton niveau : rang ' + (I.r + 1) + ' au niveau ' + I.lvlNext + '.'
            : "Elle progresse quand tu t'en sers.";
    const mile = '';
    return `<div class="skr${I.r >= C.SK_MAX ? ' max' : ''}"><b>Rang ${I.r} / ${C.SK_MAX}</b> <span>${I.r > 1 ? '+' + (I.r - 1) * 5 + ' % de puissance · −' + (I.r - 1) * 3 + ' % de recharge' : 'puissance de base'}</span><div class="xp"><i style="width:${I.need ? Math.min(100, (I.cur / I.need) * 100).toFixed(1) : 100}%"></i><span>${I.need ? I.cur + ' / ' + I.need : 'Max'}</span></div><small>${note}${mile}</small></div>`;
  };
  // paliers des rangs 4 et 8 : choix entre deux effets (définitif, Elya peut tout réinitialiser)
  const mileHTML = (key, T, rk) => {
    if (!T.ms) return '';
    const ch = (me.skc || {})[key] || [-1, -1];
    return T.ms
      .map((pair, j) => {
        const req = j ? 8 : 4;
        if (ch[j] >= 0) {
          const o = pair[ch[j]];
          return `<p class="mile on"><b>Rang ${req} · ${o.n}</b> — ${o.d}</p>`;
        }
        if (rk >= req)
          return `<div class="mile pick"><b>Rang ${req} atteint : choisis un effet</b>${pair.map((o, c) => `<button type="button" data-skk="${key}" data-skj="${j}" data-skc="${c}"><b>${o.n}</b><small>${o.d}</small></button>`).join('')}</div>`;
        return `<p class="mile"><b>Rang ${req}</b> — ${pair.map(o => o.n).join(' ou ')}</p>`;
      })
      .join('');
  };
  const techs = K0.F.tech
    .map((A, i) => {
      const lock = A.m > K0.ml,
        slot = inBar.indexOf(i),
        rk = C.skRank((me.sk || {})[K0.fam + ':' + i] || 0, C.skCap(me.lvl)),
        cd = C.techCd(A.cd, rk, me.stats && me.stats.int);
      return `<li class="${lock ? 'lock' : ''}"><img src="${ico(A.icon)}" alt=""><div><b>${A.name}${slot >= 0 ? ' <span class="inbar">case ' + (slot + 1) + '</span>' : ''}</b><small>${lock ? 'Maîtrise ' + A.m + ' · ' : ''}${A.mp} PM · recharge ${lock ? A.cd : cd} s · ${A.desc}</small>${lock ? '' : rankHTML(K0.fam + ':' + i) + mileHTML(K0.fam + ':' + i, A, rk)}${lock ? '' : `<span class="barb">${[0, 1, 2].map(s0 => `<button type="button" data-bs="${s0}" data-bk="${i}" class="${slot === s0 ? 'on' : ''}" aria-label="Mettre en case ${s0 + 1}">${s0 + 1}</button>`).join('')}</span>`}</div></li>`;
    })
    .join('');
  const caps = (K0.F.caps || [])
    .map(
      A =>
        `<li class="${A.m > K0.ml ? 'lock' : ''}"><img src="${ico(A.m === 5 ? 'charge' : 'shout')}" alt=""><div><b>${A.name}</b><small>${A.m > K0.ml ? 'Maîtrise ' + A.m + ' · ' : ''}${A.desc}</small>${A.m === 8 && A.m <= K0.ml ? rankHTML('sword:block') : ''}</div></li>`
    )
    .join('');
  const others0 = Object.keys(C.FAMS)
    .filter(f => f !== 'none' && f !== K0.fam && (me.mast || {})[f])
    .map(f => C.FAMS[f].name + ' ' + C.mLevel(me.mast[f]).lv)
    .join(' · ');
  $('abil').innerHTML =
    mbar +
    `<ul class="abil"><li><img src="${ico(K0.basic.icon)}" alt=""><div><b>${K0.basic.name}</b><small>Attaque de base · recharge ${K0.basic.cd} s · portée ${K0.basic.range}</small></div></li>${techs}${caps}</ul>` +
    (others0 ? `<p class="muted small">Autres maîtrises : ${others0}</p>` : '');
  $('bagn').textContent = bag.length + '/' + C.BAG_SIZE;
  const pass = it => {
    const sl = C.ITEMS[it[0]].slot;
    return bagFilter === 'all' || (bagFilter === 'armor' ? ARMOR.includes(sl) : sl === bagFilter);
  };
  let cells = '';
  for (let i = 0; i < C.BAG_SIZE; i++) {
    const it = bag[i];
    cells += it
      ? `<button type="button" class="slot r${it[1]}${sel && sel.from === 'bag' && sel.i === i ? ' sel' : ''}${pass(it) ? '' : ' dim'}${me.lvl < C.ITEMS[it[0]].lvl ? ' low' : ''}" data-bag="${i}" aria-label="${C.ITEMS[it[0]].n}"><img src="${iconURL(it[0])}" alt=""></button>`
      : '<span class="slot empty"></span>';
  }
  $('bag').innerHTML = cells;
  for (const b of $('bagf').children) b.classList.toggle('on', b.dataset.f === bagFilter);
  for (const b of document.querySelectorAll('#char .tabs button')) {
    const on = b.dataset.tab === charTab;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on);
    $('tab-' + b.dataset.tab).hidden = !on;
  }
  let inst = null,
    equipped = false;
  if (sel && sel.from === 'bag') inst = bag[sel.i];
  else if (sel && sel.slot) {
    inst = me.equip && me.equip[sel.slot];
    equipped = true;
  }
  $('tip').hidden = !inst;
  if (inst) $('tip').innerHTML = tipHTML(inst, equipped);
  // aperçu : le héros porte l'objet essayé
  prevSet = te && sel.from === 'bag' ? ARTAPI.charSet(look, C.gearStr(te)) : null;
  $('trying').textContent = prevSet ? 'Essayage' : '';
}
$('char').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.id === 'chclose') {
    $('char').hidden = true;
    sel = null;
    prevSet = null;
    return;
  }
  if (b.id === 'rotl' || b.id === 'rotr') {
    prevDir = (prevDir + (b.id === 'rotr' ? 1 : 3)) % 4;
    return;
  }
  if (b.dataset.tab) {
    charTab = b.dataset.tab;
    renderChar();
    return;
  }
  if (b.dataset.tt != null) {
    link.send({ t: 'tt', i: +b.dataset.tt });
    return;
  }
  if (b.dataset.pt && link) {
    link.send({ t: 'pt', s: b.dataset.pt });
    return;
  }
  if (b.dataset.bs != null && link) {
    link.send({ t: 'bar', s: +b.dataset.bs, k: +b.dataset.bk });
    return;
  }
  if (b.dataset.skk && link) {
    link.send({ t: 'skc', k: b.dataset.skk, j: +b.dataset.skj, c: +b.dataset.skc });
    return;
  }
  if (b.dataset.f) {
    bagFilter = b.dataset.f;
    renderChar();
    return;
  }
  if (b.dataset.bag != null) {
    const i = +b.dataset.bag;
    sel = sel && sel.from === 'bag' && sel.i === i ? null : { from: 'bag', i };
    sellArm = false;
    renderChar();
    return;
  }
  if (b.dataset.slot != null) {
    const sl = b.dataset.slot;
    sel = me.equip && me.equip[sl] && !(sel && sel.slot === sl) ? { slot: sl } : null;
    sellArm = false;
    if (!sel && !(me.equip && me.equip[sl])) {
      charTab = 'bag';
      bagFilter = sl === 'weapon' ? 'weapon' : sl === 'trinket' ? 'trinket' : 'armor';
    }
    renderChar();
    return;
  }
  if (b.dataset.act && link && sel) {
    if (b.dataset.act === 'sell') {
      const inst = (me.bag || [])[sel.i];
      if (inst && inst[1] >= 2 && !sellArm) {
        sellArm = true;
        renderChar();
        return;
      }
      link.send({ t: 'sell', b: sel.i });
    }
    if (b.dataset.act === 'equip') link.send({ t: 'equip', b: sel.i });
    if (b.dataset.act === 'unequip') link.send({ t: 'unequip', s: sel.slot });
    sel = null;
    sellArm = false;
    prevSet = null;
    charSig = '';
  }
});
const chp = $('chprev').getContext('2d');
chp.imageSmoothingEnabled = false;
function drawCharPreview() {
  if ($('char').hidden || !me.set) return;
  const set = prevSet || me.set,
    d = ['front', 'side', 'back', 'sideL'][prevDir],
    fr = Math.floor(time * 10) % 8;
  const img =
    d === 'sideL' ? set.sideL[fr] : d === 'side' ? set.side[fr] : set[d][Math.floor(time * 2) % 4 === 0 && d === 'front' ? 0 : fr];
  chp.clearRect(0, 0, 64, 68);
  chp.fillStyle = 'rgba(10,12,40,.35)';
  chp.fillRect(20, 62, 24, 4);
  chp.drawImage(img, 3, 9);
}
const STEPS = window.EtheriaSteps || { native: false, collect: async () => 0 };
function openWalk() {
  walkSig = '';
  renderWalk();
  $('walk').hidden = false;
  input.atkBtn = false;
  joy.active = false;
}
function renderWalk() {
  const sig = JSON.stringify([me.stepsToday, me.ether, me.glvl, me.gxp, me.inv, me.scarves, me.scarf]);
  if (sig === walkSig) return;
  walkSig = sig;
  const st = me.stepsToday || 0;
  $('wsteps').textContent = fmt(st) + ' / ' + fmt(C.DAILY_STEP_CAP) + ' pas';
  $('wbar').style.width = Math.min(100, (st / C.DAILY_STEP_CAP) * 100) + '%';
  $('wether').textContent = (me.ether || 0) + ' Éther';
  $('wglvl').textContent = 'Cueillette niveau ' + (me.glvl || 1);
  $('wgbar').style.width = Math.min(100, ((me.gxp || 0) / (me.gneed || 1)) * 100) + '%';
  $('winv').textContent = resLine();
  $('wsync').textContent = STEPS.native ? 'Synchroniser mes pas' : 'Simuler une balade (+1 000 pas)';
  $('wnote').textContent = STEPS.native
    ? 'Tes pas sont lus par le capteur de mouvement de ton iPhone.'
    : "Mode test : dans le navigateur, le jeu n'a pas accès à tes pas. Sur l'app iPhone, ce sont tes vrais pas qui comptent.";
  $('wscarves').innerHTML = C.SCARVES.map((c, i) =>
    me.scarves & (1 << i)
      ? `<button type="button" data-s="${i}" class="sw${me.scarf === i ? ' on' : ''}" style="background:${c[0]}" aria-label="Écharpe ${c[3]}"></button>`
      : ''
  ).join('');
}
$('wscarves').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b && link) link.send({ t: 'scarf', s: +b.dataset.s });
});
$('wsync').addEventListener('click', async () => {
  if (!link) return;
  if (STEPS.native) await syncSteps(true);
  else link.send({ t: 'steps', n: 1000 });
});
$('wclose').addEventListener('click', () => {
  $('walk').hidden = true;
});
let syncing = false;
async function syncSteps(manual) {
  if (!link || !STEPS.native || syncing) return;
  syncing = true;
  try {
    const n = await STEPS.collect();
    if (n > 0) link.send({ t: 'steps', n });
    else if (manual) sys('Aucun nouveau pas depuis la dernière synchronisation.');
  } catch (e) {
    if (manual) sys('Impossible de lire tes pas (autorisation Mouvement & forme ?).');
  }
  syncing = false;
}
setInterval(() => {
  if (mode === 'play') syncSteps(false);
}, 60000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && mode === 'play') syncSteps(false);
});
$('dok').addEventListener('click', () => {
  if (dlgAction && link) link.send({ t: 'talk', npc: dlgAction });
  closeDlg();
});
$('dno').addEventListener('click', closeDlg);
// tchat
const chatbox = $('chatbox'),
  chatin = $('chatin');
function openChat() {
  chatbox.hidden = false;
  chatin.value = '';
  setTimeout(() => chatin.focus(), 30);
}
const ignored = new Set(
  (() => {
    try {
      return JSON.parse(localStorage.getItem('etheria_ignore') || '[]');
    } catch (e) {
      return [];
    }
  })()
);
function sendChat() {
  const t = chatin.value.trim();
  chatbox.hidden = true;
  chatin.blur();
  if (!t) return;
  const m = t.match(/^\/(ignorer|ignore|retablir)\s+(.+)$/i);
  if (m) {
    const n = m[2].trim().toLowerCase();
    if (/^r/i.test(m[1])) {
      ignored.delete(n);
      sys('Tu vois de nouveau les messages de ' + m[2] + '.');
    } else {
      ignored.add(n);
      sys(m[2] + ' est ignoré. /retablir ' + m[2] + ' pour annuler.');
    }
    try {
      localStorage.setItem('etheria_ignore', JSON.stringify([...ignored]));
    } catch (e) {
      /* ignore */
    }
    return;
  }
  if (link) link.send({ t: 'chat', text: t });
}
chatin.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendChat();
  }
  if (e.key === 'Escape') {
    chatbox.hidden = true;
    chatin.blur();
  }
});
$('chatsend').addEventListener('click', sendChat);
$('chatclose').addEventListener('click', () => {
  chatbox.hidden = true;
});
