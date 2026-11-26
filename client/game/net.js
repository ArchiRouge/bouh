/* Pixels Worlds — client, net.js : Réseau : simulation locale (solo) ou WebSocket, réception de l'état et des événements.
   Les fichiers de client/game/ se partagent leurs déclarations (scripts classiques chargés dans l'ordre par persist.js,
   voir GAME_FILES) : une fonction ou une variable d'un fichier sert aux suivants. */
'use strict';
/* ---------- réseau ---------- */
class LocalLink {
  constructor(onmsg) {
    this.onmsg = onmsg;
    this.sim = new C.Sim(W);
  }
  connect(hello) {
    let save = null;
    try {
      save = JSON.parse(localStorage.getItem('etheria_solo') || 'null');
    } catch (e) {
      /* ignore */
    }
    if (!save) save = restoredSolo;
    if (!save && SEED && SEED.solo) save = SEED.solo;
    this.sim = new C.Sim(W, { lvl: save && save.lvl, dg: save && save.dg });
    this.sim.mobs.forEach((sm, k) => {
      if (mobs[k]) {
        mobs[k].lvl = sm.lvl;
        mobs[k].maxhp = sm.maxhp;
        mobs[k].hp = sm.hp;
      }
    });
    const p = this.sim.addPlayer('me', hello.name, hello.look, save, hello.cls);
    this.sim.events.length = 0;
    if (Cloud.owner || (window.ETHERIA_CONFIG && window.ETHERIA_CONFIG.founder)) this.sim.grantFounder(p);
    // maître du jeu : le propriétaire de la page de test, ou le héros Archi404 dans l'app quand config.gm est activé
    if (Cloud.owner || (window.ETHERIA_CONFIG && window.ETHERIA_CONFIG.gm && p.name === 'Archi404')) this.sim.grantGM(p);
    setTimeout(() => this.onmsg({ t: 'welcome', id: 'me', x: p.x, y: p.y }), 0);
    this.iv = setInterval(() => {
      this.sim.step(0.1);
      const ev = this.sim.events.splice(0);
      this.onmsg(Object.assign({ t: 's', me: this.sim.meState('me'), ev, n: 1 }, this.sim.publicState()));
    }, 100);
    return Promise.resolve();
  }
  send(m) {
    this.sim.handle('me', m);
  }
  saveNow() {
    const p = this.sim.players.get('me');
    if (!p) return;
    const sd = this.sim.saveData(p);
    try {
      localStorage.setItem('etheria_solo', JSON.stringify(sd));
      localStorage.setItem('etheria_saved_at', String(Date.now()));
    } catch (e) {
      /* ignore */
    }
    Cloud.save(sd);
  }
}
class WsLink {
  constructor(url, onmsg) {
    this.url = url;
    this.onmsg = onmsg;
    this.ws = null;
  }
  connect(hello) {
    return new Promise((res, rej) => {
      let ok = false;
      const ws = new WebSocket(this.url);
      this.ws = ws;
      const to = setTimeout(() => {
        if (!ok) {
          try {
            ws.close();
          } catch (e) {
            /* ignore */
          }
          rej(new Error('timeout'));
        }
      }, 5000);
      ws.onopen = () => ws.send(JSON.stringify(Object.assign({ t: 'hello', v: C.VERSION }, hello)));
      ws.onmessage = ev => {
        let m;
        try {
          m = JSON.parse(ev.data);
        } catch (e) {
          return;
        }
        if (m.t === 'welcome' && !ok) {
          ok = true;
          clearTimeout(to);
          res();
        }
        this.onmsg(m);
      };
      ws.onclose = () => {
        clearTimeout(to);
        if (!ok) rej(new Error('closed'));
        else this.onmsg({ t: 'closed' });
      };
      ws.onerror = () => {};
    });
  }
  send(m) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m));
  }
  saveNow() {}
}
function serverUrl() {
  const cfg = (window.ETHERIA_CONFIG && window.ETHERIA_CONFIG.server) || null;
  const q = new URLSearchParams(location.search).get('server');
  if (q) return q;
  if (cfg === 'auto')
    return /^https?:$/.test(location.protocol) ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws' : null;
  return cfg;
}
function token() {
  let t = null;
  try {
    t = localStorage.getItem('etheria_token');
    if (!t) {
      t = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('etheria_token', t);
    }
  } catch (e) {
    t = 'anon' + Math.random();
  }
  return t;
}

function onMsg(m) {
  if (m.t === 'welcome') {
    if (m.isle && !sameIsle(C.cleanIsle(m.isle), ISLE)) {
      gotoIsle(m.isle, true);
      location.reload();
      return;
    } // le serveur nous place sur une autre île
    myId = m.id;
    me.x = m.x;
    me.y = m.y;
    me.z = W.hAt(me.x, me.y);
    mode = 'play';
    $('menu').hidden = true;
    me.gear = C.gearStr(me.equip);
    me.set = ARTAPI.charSet(look, me.gear);
    sys(netMode === 'online' ? 'Connecté au monde partagé.' : 'Mode solo : aucun serveur configuré.');
    setTimeout(
      () =>
        say(
          usedTouch
            ? "Astuce : glisse à gauche pour bouger, maintiens l'épée pour attaquer."
            : 'Astuce : ZQSD pour bouger, ESPACE attaque, E tourbillon, R potion, F parler, ENTRÉE tchat.',
          '#9fe0ff'
        ),
      1200
    );
    if (me.q === 0 && me.qs === 0) setTimeout(() => say("Elya t'attend près de la fontaine (marqueur !).", '#ffe27a'), 2600);
    setTimeout(
      () =>
        say(
          "Les plantes lumineuses se récoltent avec de l'Éther. Marche dans la vraie vie pour en gagner (touche l'icône bleue).",
          '#bfe6ff'
        ),
      5200
    );
    setTimeout(() => syncSteps(false), 1500);
    return;
  }
  if (m.t === 'closed') {
    sys('Connexion perdue. Recharge la page pour revenir.');
    return;
  }
  if (m.t === 'err') {
    sys(m.msg || 'Erreur serveur');
    return;
  }
  if (m.t !== 's') return;
  online = m.n || 1;
  if (lastSnap) snapDt = snapDt * 0.8 + clamp(time - lastSnap, 0.05, 0.3) * 0.2;
  lastSnap = time;
  const seen = new Set();
  for (const a of m.p) {
    const [id, name, lk, x, y, f, fl, mv, hp, mh, lv, dead, sc, cl, vd, gr, tt, au] = a;
    if (id === myId) continue;
    seen.add(id);
    let o = others.get(id);
    if (!o) {
      o = { id, x, y, z: W.hAt(x, y), anim: 0, hitFlash: 0, slash: 0, slashAng: 0, spin: 0 };
      others.set(id, o);
    }
    o.name = name;
    if (o.lk !== lk || o.gr !== gr) {
      o.lk = lk;
      o.gr = gr;
      o.set = ARTAPI.charSet(lk.split('').map(Number), gr || '');
    }
    o.fx = o.x;
    o.fy = o.y;
    o.t0 = time;
    o.tx = x;
    o.ty = y;
    o.face = FACES[f] || 'front';
    o.flip = !!fl;
    o.moving = !!mv;
    o.hp = hp;
    o.maxhp = mh;
    o.lvl = lv;
    o.dead = !!dead;
    o.scarf = sc | 0;
    o.cls = cl | 0;
    o.voidFx = !!vd;
    o.tt = tt == null ? -1 : tt;
    o.au = au || null; // aura d'élément (5 pièces assorties)
  }
  for (const id of [...others.keys()]) if (!seen.has(id)) others.delete(id);
  m.m.forEach((a, k) => {
    const mb = mobs[k];
    if (!mb) return;
    const [x, y, hp, al, ag, mv, st, mh, lv] = a;
    mb.status = st | 0;
    if (mh) {
      mb.maxhp = mh;
      mb.lvl = lv;
    }
    if (!mb.alive && al) {
      mb.x = x;
      mb.y = y;
    }
    mb.fx = mb.x;
    mb.fy = mb.y;
    mb.t0 = time;
    mb.tx = x;
    mb.ty = y;
    mb.hp = hp;
    mb.alive = !!al;
    mb.aggro = !!ag;
    mb.moving = !!mv;
  });
  if (m.me) {
    const wasDead = me.dead;
    Object.assign(me, m.me);
    {
      const gs = C.gearStr(me.equip);
      if (gs !== me.gear) {
        me.gear = gs;
        me.set = ARTAPI.charSet(look, gs);
      }
    }
    if (!$('craft').hidden) renderCraft();
    if (!$('walk').hidden) renderWalk();
    if (!$('char').hidden) renderChar();
    if (me.lvl !== prefs.lvl) {
      prefs.lvl = me.lvl;
      try {
        localStorage.setItem('etheria_prefs', JSON.stringify({ name: me.name, look, lvl: me.lvl }));
      } catch (e) {
        /* ignore */
      }
    }
    if (!wasDead && me.dead) {
      joy.active = false;
    }
  }
  if (m.c != null) chestOpen = !!m.c;
  if (m.tm != null) {
    simT = m.tm;
    simT0 = time;
  }
  ISLE_DG = m.dg || null;
  if (m.cp) CORPSES = m.cp.map(([id, x, y, n, name, left]) => ({ kind: 'corpse', id, x, y, z: W.hAt(x, y), n, name, left }));
  for (const ev of m.ev || []) handleEvent(ev);
}
const ent = id => (id === myId ? me : others.get(id));
function handleEvent(ev) {
  switch (ev.e) {
    case 'hm': {
      const mb = mobs[ev.m];
      if (!mb) break;
      mb.hitFlash = 0.15;
      const mine = ev.by === myId;
      // éléments : chiffres orange quand l'élément de l'arme est fort contre le monstre, gris quand il est faible
      const efCol = ev.ef > 0 ? '#ffb43a' : ev.ef < 0 ? '#a8a8c0' : null;
      if (ev.c && mine) critFx(mb); // éclair en croix et « glitch »
      floatAt(
        mb,
        ev.v,
        ev.burn ? '#ff9a3c' : ev.bleed ? '#ff5a6a' : mine ? efCol || (ev.c ? '#ffd23f' : '#ffffff') : '#b8c4e0',
        (ev.c || ev.ef > 0) && mine
      );
      if (mine && ev.ef && !(mb.efT > time)) {
        mb.efT = time + 1.4;
        floatAt(mb, ev.ef > 0 ? 'Efficace !' : 'Résiste…', ev.ef > 0 ? '#ffd23f' : '#c8c0d8', ev.ef > 0);
        floats.at(-1).y -= 14; // au-dessus des chiffres de dégâts
      }
      burst(mb, ART.slimeLight[mb.type], ev.c ? 9 : 4);
      break;
    }
    case 'km': {
      const mb = mobs[ev.m];
      if (!mb) break;
      burst(mb, ART.slimeLight[mb.type], 18, 20);
      burst(mb, '#ffffff', 6, 30);
      mb.alive = false;
      break;
    }
    case 'lt':
      if (ev.id === myId) {
        const mb = mobs[ev.m];
        setTimeout(() => floatAt(mb, '+' + ev.xp + ' XP', '#8cf07a'), 150);
        setTimeout(() => floatAt(mb, '+' + ev.g + ' PO', '#ffd23f'), 450);
        if (ev.pot) setTimeout(() => floatAt(mb, '+1 potion', '#ff8ac0'), 750);
        if (ev.grp) setTimeout(() => floatAt(mb, 'Bonus groupe', '#9fe0ff'), 1000);
      }
      break;
    case 'hp': {
      const t = ent(ev.id),
        mb = mobs[ev.m];
      if (mb) mb.lunge = 0.15;
      if (!t) break;
      t.hitFlash = 0.18;
      if (t !== me && ev.by === myId) floatAt(t, ev.v, '#ffffff');
      if (t === me) {
        if (ev.sh) floatAt(me, 'Absorbé', '#bfe6ff');
        else {
          floatAt(me, '-' + ev.v, ev.burn ? '#ff9a3c' : '#ff5a5a');
          if (!ev.burn && ev.v > me.maxhp * 0.08) shake = 0.15;
        }
      }
      if (ev.b) {
        floatAt(t, 'Bloqué !', '#bfe6ff');
        ring(t, 1.2, '#bfe6ff', 0.25);
      }
      break;
    }
    case 'lv': {
      const t = ent(ev.id);
      if (!t) break;
      ring(t, 2.5, '#ffe27a', 0.6);
      burst(t, '#ffe27a', 24, 60);
      floatAt(t, 'Niveau ' + ev.lv + ' !', '#ffe27a', true);
      if (t === me) {
        sys('Niveau ' + ev.lv + ' atteint ! +3 points de caractéristiques à répartir (page personnage).');
      } else say(t.name + ' passe niveau ' + ev.lv + ' !', '#9fe0ff');
      break;
    }
    case 'die':
      if (ev.id === myId) {
        sys((ev.by ? ev.by + " t'a vaincu… " : 'Vous êtes mort… ') + '-' + ev.loss + ' XP');
        if (ev.drop)
          sys(
            'Ton sac (' +
              ev.drop +
              ' objet' +
              (ev.drop > 1 ? 's' : '') +
              ") est resté sur ton corps : 3 minutes pour le récupérer avant qu'un autre ne le pille !"
          );
      }
      break;
    case 'looted':
      if (ev.id === myId) {
        sys(
          ev.own
            ? 'Tu as récupéré ' + ev.n + ' objet' + (ev.n > 1 ? 's' : '') + ' sur ton corps.'
            : 'Tu as pillé ' + ev.n + ' objet' + (ev.n > 1 ? 's' : '') + ' sur le corps de ' + ev.of + '.'
        );
        floatAt(me, '+' + ev.n + ' objet' + (ev.n > 1 ? 's' : ''), '#ffe27a');
      }
      break;
    case 'rs': {
      const t = ent(ev.id);
      if (t) ring(t, 1.8, '#8fd4ff', 0.5);
      if (ev.id === myId) sys(DGN ? "Tu reviens à l'entrée du donjon." : PVP ? 'Tu reviens au pont.' : "Retour au Bourg d'Argel.");
      break;
    }
    case 'tp':
      if (ev.dash) {
        const t = ent(ev.id);
        if (t) burst(t, '#ffd060', 10, 10);
      }
      if (ev.id === myId) {
        me.x = ev.x;
        me.y = ev.y;
        me.z = W.hAt(me.x, me.y);
      } else {
        const o = others.get(ev.id);
        if (o) {
          o.x = o.tx = o.fx = ev.x;
          o.y = o.ty = o.fy = ev.y;
        }
      }
      break;
    case 'ch':
      if (ev.s) sys(ev.t);
      else if (!ignored.has(String(ev.n).toLowerCase())) say(ev.n + ': ' + ev.t, ev.id === myId ? '#b8f0a0' : '#ece6f4');
      break;
    case 'ab': {
      const t = ent(ev.id);
      if (t) abilityFx(t, ev, mobs[ev.m] || (ev.pv ? ent(ev.pv) : null));
      break;
    }
    case 'ml':
      if (ev.id === myId) {
        const F = C.FAMS[ev.f];
        if (!F) break;
        sys('Maîtrise ' + F.name + ' ' + ev.lv + ' !');
        floatAt(me, 'Maîtrise ' + ev.lv, '#9fe0ff', true);
        ring(me, 2, '#9fe0ff', 0.5);
        for (const A of F.tech)
          if (A.m === ev.lv)
            setTimeout(() => {
              sys('Nouvelle technique : ' + A.name + ' — ' + A.desc);
              floatAt(me, A.name, '#ffe27a', true);
            }, 600);
        for (const A of F.caps || [])
          if (A.m === ev.lv)
            setTimeout(() => {
              sys('Nouvelle capacité : ' + A.name + ' — ' + A.desc);
            }, 900);
      }
      break;
    case 'heal': {
      const t = ent(ev.id);
      if (t) {
        burst(t, '#9cf07a', 14, 30);
        if (t === me) floatAt(me, '+' + ev.v + (ev.by && ev.by !== myId ? ' (soin)' : ''), '#9cf07a');
      }
      break;
    }
    case 'gm':
      if (ev.id === myId) {
        sys(
          ev.mage
            ? 'Te voilà mage : le Grimoire du Maître du jeu et son orbe tirent à distance. Maîtrise Bâton ' +
                ev.mage +
                ', points passés en Intelligence (réinitialisables chez Elya).'
            : 'Ton armure de Maître du jeu est équipée. Elle est unique.'
        );
        floatAt(me, 'Maître du jeu', '#ffe070', true);
        ring(me, 3, '#ffe070', 0.9);
        burst(me, '#ffe070', 40, 60);
        burst(me, '#ffffff', 16, 50);
      }
      break;
    case 'travel':
      if (ev.id === myId && !travel) {
        const I = C.ISLES[ev.to.k] || C.ISLES.bourg,
          nm = C.isleName(ev.to),
          hx3 = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
        travel = {
          t: time,
          name: nm,
          col:
            ev.via === 'ether'
              ? [120, 80, 200]
              : ev.via === 'dg'
                ? hx3(C.DG[ev.to.r].c).map(v => (v * 0.45) | 0)
                : ev.via === 'dgout'
                  ? [40, 30, 60]
                  : [230, 170, 70]
        };
        const desc = ev.to.k === 'donjon' ? 'Donjon ' + C.DG[ev.to.r].n + " : le boss t'attend au fond du labyrinthe." : I.desc || '';
        joy.active = false;
        input.atkBtn = false;
        gotoIsle(ev.to, false);
        try {
          sessionStorage.setItem('etheria_autoplay', '1');
          sessionStorage.setItem('etheria_arrive', JSON.stringify({ name: nm, desc, fresh: ev.fresh, col: travel.col }));
        } catch (e) {
          /* ignore */
        }
        setTimeout(async () => {
          if (link) link.saveNow();
          try {
            await Promise.race([window.EtheriaPersist ? window.EtheriaPersist.flush() : null, new Promise(r => setTimeout(r, 2000))]);
          } catch (e) {
            /* ignore */
          }
          location.reload();
        }, 1300); // dans l'app iOS : la sauvegarde native doit être écrite avant de recharger
      }
      break;
    case 'skr':
      if (ev.id === myId) {
        const [f, t] = String(ev.k).split(':'),
          nm = t === 'block' ? 'Blocage' : ((C.FAMS[f] || {}).tech || [])[+t] ? C.FAMS[f].tech[+t].name : 'Compétence';
        sys(
          nm +
            ' passe au rang ' +
            ev.r +
            ' !' +
            ((ev.r === 4 || ev.r === 8) && t !== 'block'
              ? ' Palier atteint : choisis son effet dans la page personnage (Compétences).'
              : ev.r >= C.SK_MAX
                ? ' Rang maximum !'
                : '')
        );
        floatAt(me, nm + ' rang ' + ev.r, '#bfe6ff', true);
        ring(me, 1.8, '#bfe6ff', 0.5);
        burst(me, '#bfe6ff', 16, 40);
      }
      break;
    case 'skc':
      if (ev.id === myId) {
        sys('Effet choisi : ' + ev.n + '.');
        floatAt(me, ev.n, '#ffe27a', true);
        ring(me, 2, '#ffe27a', 0.5);
      }
      break;
    case 'zone':
      ZONES.push({ x: ev.x, y: ev.y, r: ev.r, until: time + ev.d });
      break;
    case 'bsk': {
      const mb = mobs[ev.m];
      TELE.push({ m: ev.m, x: ev.x, y: ev.y, r: ev.r, d: ev.d, until: time + ev.d });
      if (mb) floatAt(mb, ev.n + ' !', '#ff9a7a', true);
      break;
    }
    case 'bskx': {
      const pos = { x: ev.x, y: ev.y, z: W.hAt(ev.x, ev.y) };
      ring(pos, ev.r, '#ff7a5a', 0.45);
      burst(pos, '#ffb080', 26, 30);
      if (Math.hypot(me.x - ev.x, me.y - ev.y) < ev.r + 2) shake = Math.max(shake, 0.35);
      if ((ev.fx || []).includes('saut')) {
        const mb = mobs[ev.m];
        if (mb) {
          mb.x = mb.fx = mb.tx = ev.x;
          mb.y = mb.fy = mb.ty = ev.y;
        }
      }
      break;
    }
    case 'imm': {
      const mb = mobs[ev.m];
      if (mb) floatAt(mb, ev.fx === 'burn' ? 'Insensible au feu' : 'Insensible au froid', '#c8c0d8');
      break;
    }
    case 'ttl':
      if (ev.id === myId) {
        sys('Nouveau titre : « ' + ev.n + ' » (affiché sous ton nom, à changer dans la page personnage).');
        floatAt(me, ev.n, '#ffd23f', true);
        ring(me, 3, '#ffd23f', 0.9);
        burst(me, '#ffd23f', 40, 60);
      }
      break;
    case 'chest':
      if (ev.id === myId) {
        chestOpen = true;
        sys(
          ev.dg
            ? 'Coffre du donjon : +' + ev.g + ' PO' + (ev.eth ? ', +' + ev.eth + ' Éther' : '') + ' et des objets !'
            : 'Coffre de brume : +' + ev.g + ' PO et deux objets !'
        );
        floatAt(me, 'Trésor !', '#ffe27a', true);
        burst(me, '#ffe27a', 30, 50);
      }
      break;
    case 'founder':
      if (ev.id === myId) {
        sys('Cadeau du fondateur : les Bottes du Néant (Unique) et un ensemble épique sont équipés !');
        floatAt(me, 'Bottes du Néant', '#ff9a3c', true);
        ring(me, 2.6, '#ff9a3c', 0.8);
        burst(me, '#b08ae8', 30, 50);
      }
      break;
    case 'sw':
      if (ev.id !== myId) {
        const o = others.get(ev.id),
          mb = mobs[ev.m];
        const tv = mb || (ev.pv === myId ? me : others.get(ev.pv));
        if (o && tv) {
          basicFx(o, tv, ev.fx);
          setFacing(o, tv.x - o.x, tv.y - o.y);
        }
      }
      break;
    case 'sk':
      if (ev.id !== myId) {
        const o = others.get(ev.id);
        if (o) {
          o.spin = 0.35;
          ring(o, 2.4, '#ffe27a', 0.35);
        }
      }
      break;
    case 'po': {
      const t = ent(ev.id);
      if (t) {
        burst(t, '#8cf07a', 12, 20);
        if (t === me) floatAt(me, '+' + ev.v, '#8cf07a');
      }
      break;
    }
    case 'ga':
      if (ev.id === myId) {
        nodeCd[ev.k] = time + C.NODE_CD;
        const n = W.nodes[ev.k],
          pos = { x: n.x, y: n.y, z: W.hAt(n.x, n.y) };
        floatAt(pos, '+' + ev.n + ' ' + C.RES[ev.res].name, '#bfe6ff');
        burst(pos, ev.res === 'herb' ? '#bfe6ff' : ev.res === 'wood' ? '#ffd060' : '#ffb0d4', 12, 20);
        setTimeout(() => floatAt(me, '+' + ev.g + ' cueillette', '#c8c0d8'), 400);
      }
      break;
    case 'gl':
      if (ev.id === myId) {
        sys('Cueillette niveau ' + ev.lv + ' !');
        floatAt(me, 'Cueillette nv' + ev.lv, '#bfe6ff', true);
        ring(me, 2, '#bfe6ff', 0.6);
        for (const k in C.RES) if (C.RES[k].req === ev.lv) sys('Tu peux maintenant récolter : ' + C.RES[k].name + '.');
        for (const r of C.RECIPES) if (r.req === ev.lv) sys('Nouvelle recette chez ' + C.NPCS[r.npc].name + ' : ' + r.name + '.');
      }
      break;
    case 'st':
      if (ev.id === myId) {
        if (ev.n > 0) {
          sys('Marche : +' + fmt(ev.n) + ' pas → +' + ev.v + ' Éther');
          if (ev.v > 0) floatAt(me, '+' + ev.v + ' Éther', '#bfe6ff', true);
        }
        if (ev.capped) sys('Plafond de ' + fmt(C.DAILY_STEP_CAP) + " pas atteint pour aujourd'hui.");
      }
      break;
    case 'gift':
      if (ev.id === myId) sys('Cadeau du jour : +' + ev.v + ' Éther.');
      break;
    case 'it':
      if (ev.id === myId) {
        const T = C.ITEMS[ev.t],
          R0 = C.RARITY[ev.r];
        say((ev.sold ? 'Sac plein, vendu : ' : 'Butin : ') + T.n + ' (' + R0[0] + ')' + (ev.sold ? ' +' + ev.sold + ' PO' : ''), R0[1]);
        const pos = ev.m >= 0 ? mobs[ev.m] : me;
        setTimeout(() => floatAt(pos, T.n, R0[1], ev.r >= 2), ev.m >= 0 ? 900 : 300);
        if (ev.r >= 2) setTimeout(() => ring(pos, 1.6, R0[1], 0.6), 900);
      }
      break;
    case 'eq':
      if (ev.id === myId) {
        const T = C.ITEMS[ev.t];
        sys('Équipé : ' + T.n);
        burst(me, C.RARITY[ev.r][1], 10, 20);
      }
      break;
    case 'sold':
      if (ev.id === myId) sys('Vendu : ' + C.ITEMS[ev.t].n + ' (+' + ev.v + ' PO)');
      break;
    case 'msg':
      if (ev.id === myId) sys(ev.t);
      break;
    case 'cr':
      if (ev.id === myId) {
        const r = C.RECIPES[ev.r];
        sys('Fabriqué : ' + r.name + ' (' + r.desc + ')');
        floatAt(me, r.name, '#ffe27a', true);
        burst(me, '#ffe27a', 16, 40);
      }
      break;
    case 'qa':
      if (ev.id === myId) {
        const Q = C.QUESTS[ev.q];
        sys('Nouvelle quête : ' + Q.title);
        floatAt(me, 'Nouvelle quête', '#ffe27a', true);
      }
      break;
    case 'qp':
      if (ev.id === myId) {
        const Q = C.QUESTS[ev.q],
          mb = mobs[ev.m] || me;
        setTimeout(() => floatAt(mb, ev.item ? '+1 ' + Q.item : Q.short + ' ' + ev.n + '/' + Q.n, '#ffe9b0'), ev.item ? 1250 : 1100);
      }
      break;
    case 'qc':
      if (ev.id === myId) {
        const Q = C.QUESTS[ev.q];
        setTimeout(() => {
          floatAt(me, 'Objectif accompli !', '#9cf07a', true);
          ring(me, 2, '#9cf07a', 0.5);
        }, 1400);
        sys('Objectif accompli ! Retourne voir ' + C.NPCS[Q.giver].name + '.');
      }
      break;
    case 'qr':
      if (ev.id === myId) {
        const Q = C.QUESTS[ev.q];
        sys('Quête terminée : ' + Q.title + ' (+' + ev.xp + ' XP, +' + ev.g + ' PO' + (ev.pot ? ', +' + ev.pot + ' potions' : '') + ')');
        floatAt(me, 'Quête terminée !', '#ffe27a', true);
        burst(me, '#ffe27a', 20, 50);
        ring(me, 2.4, '#ffe27a', 0.6);
      }
      break;
    case 'mr': {
      const mb = mobs[ev.m];
      if (mb) {
        mb.x = mb.fx = mb.tx;
        mb.y = mb.fy = mb.ty;
        ring(mb, 1, ART.slimeLight[mb.type], 0.4);
      }
      break;
    }
  }
}
