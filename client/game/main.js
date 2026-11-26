/* Pixels Worlds — client, main.js : Menu de création, boucle principale, sauvegarde dans le compte Claude, démarrage.
   Les fichiers de client/game/ se partagent leurs déclarations (scripts classiques chargés dans l'ordre par persist.js,
   voir GAME_FILES) : une fonction ou une variable d'un fichier sert aux suivants. */
'use strict';
/* ---------- menu de création ---------- */
const preview = $('preview'),
  pctx = preview.getContext('2d');
pctx.imageSmoothingEnabled = false;
const LOOK_LABELS = ['Coiffure', 'Cheveux', 'Tenue', 'Peau', 'Chapeau'];
me.cls = C.START[prefs.cls | 0] ? prefs.cls | 0 : 0;
const LOOK_NAMES = [
  ['Courte', 'Longue', 'Épis'],
  ['Châtain', 'Roux', 'Blond', 'Argent', 'Nuit', 'Sylve', 'Rose'],
  ['Azur', 'Carmin', 'Forêt', 'Ocre', 'Améthyste', 'Ardoise', 'Lagon'],
  ['Claire', 'Dorée', 'Brune'],
  ['Aucun', 'Mage', 'Bandeau', 'Pousse']
];
function buildMenu() {
  {
    let sv = null;
    try {
      sv = JSON.parse(localStorage.getItem('etheria_solo') || 'null');
    } catch (e) {
      /* ignore */
    }
    if (!sv) sv = restoredSolo || (SEED && SEED.solo);
    if (sv && sv.equip && prefs.name) {
      me.equip = sv.equip;
      me.gear = C.gearStr(sv.equip);
    }
  }
  const box = $('looks');
  box.innerHTML =
    `<div class="row cls"><span>Arme</span><button type="button" data-c="-1" aria-label="Arme précédente">‹</button><b id="lvc"></b><button type="button" data-c="1" aria-label="Arme suivante">›</button></div><p id="clsdesc" class="clsdesc"></p>` +
    LOOK_LABELS.map(
      (l, i) =>
        `<div class="row"><span>${l}</span><button type="button" data-i="${i}" data-d="-1" aria-label="${l} précédent">‹</button><b id="lv${i}"></b><button type="button" data-i="${i}" data-d="1" aria-label="${l} suivant">›</button></div>`
    ).join('');
  box.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.c) {
      me.cls = (me.cls + +b.dataset.c + C.START.length) % C.START.length;
      refreshLook();
      return;
    }
    const i = +b.dataset.i,
      d = +b.dataset.d;
    look[i] = (look[i] + d + C.LOOK_MAX[i]) % C.LOOK_MAX[i];
    refreshLook();
  });
  $('name').value = me.name;
  refreshLook();
  $('form').addEventListener('submit', e => {
    e.preventDefault();
    play();
  });
  // héros déjà créé : écran « Continuer » au lieu de la création
  const setResume = on => {
    $('resume').hidden = !on;
    $('namebox').hidden = on;
    $('looks').hidden = on;
    $('edit').hidden = !on;
    $('play').textContent = on ? "Continuer l'aventure" : 'Entrer dans Pixels Worlds';
  };
  if (prefs.name) {
    let lvl = 0;
    try {
      const s = JSON.parse(localStorage.getItem('etheria_solo') || 'null');
      if (s && s.lvl) lvl = s.lvl;
    } catch (e) {
      /* ignore */
    }
    lvl = Math.max(lvl, prefs.lvl || 0);
    $('rname').textContent = prefs.name;
    $('rlvl').textContent = (lvl ? 'Niveau ' + lvl + ' · ' : '') + C.FAMS[C.weaponFam(me.equip)].name;
    setResume(true);
  }
  $('edit').addEventListener('click', () => setResume(false));
  const url = serverUrl();
  $('status').textContent = url ? 'Serveur : ' + url.replace(/^wss?:\/\//, '') : 'Mode solo : aucun serveur configuré';
  if (Cloud.ok === false && !prefs.name && window.claude) {
    // dans Claude, mais le compte n'a pas répondu : ne pas recréer un héros par erreur
    const w = document.createElement('div');
    w.className = 'cloudwarn';
    w.innerHTML =
      '<p>Ta sauvegarde n\'a pas pu être chargée depuis ton compte. Si tu as déjà un héros, ne le recrée pas : réessaie.</p><button type="button">Réessayer</button>';
    w.querySelector('button').addEventListener('click', () => location.reload());
    $('form').prepend(w);
  }
}
function refreshLook() {
  const st = C.START[me.cls] || C.START[0],
    F = C.FAMS[st[1]];
  $('lvc').textContent = F.name;
  $('clsdesc').textContent =
    'Pas de classe : ton arme définit tes attaques. Attaque « ' +
    F.basic.name +
    ' », puis ' +
    F.tech.map(a => a.name).join(', ') +
    " en gagnant de la maîtrise. Tu peux changer d'arme à tout moment.";
  LOOK_LABELS.forEach((l, i) => {
    $('lv' + i).textContent = LOOK_NAMES[i][look[i]];
  });
  me.set = ARTAPI.charSet(look, me.gear || C.gearStr({ weapon: [st[0], 0], chest: [9, 0] }));
}
function drawPreview() {
  if (!me.set) return;
  pctx.clearRect(0, 0, preview.width, preview.height);
  const dirs = ['front', 'side', 'back', 'side'],
    k = Math.floor(time / 1.2) % 4,
    fr = Math.floor(time * 10) % 8;
  const img = dirs[k] === 'side' ? (k === 3 ? me.set.sideL : me.set.side)[fr] : me.set[dirs[k]][fr];
  pctx.fillStyle = 'rgba(24,16,48,.3)';
  pctx.fillRect(20, 59, 24, 4);
  pctx.drawImage(img, 3, 6);
}
async function play() {
  if (mode === 'connecting') return;
  me.name = C.cleanName($('name').value);
  $('name').value = me.name;
  prefs.name = me.name;
  prefs.cls = me.cls;
  try {
    localStorage.setItem('etheria_prefs', JSON.stringify({ name: me.name, look, lvl: prefs.lvl || 0, cls: me.cls }));
  } catch (e) {
    /* ignore */
  }
  const hello = { name: me.name, look, cls: me.cls, token: token() };
  const url = serverUrl();
  mode = 'connecting';
  $('play').disabled = true;
  if (url) {
    $('status').textContent = 'Connexion au serveur…';
    try {
      netMode = 'online';
      link = new WsLink(url, onMsg);
      await link.connect(hello);
      return;
    } catch (e) {
      $('status').textContent = 'Serveur injoignable, passage en solo.';
    }
  }
  netMode = 'solo';
  link = new LocalLink(onMsg);
  await link.connect(hello);
}

/* ---------- boucle ---------- */
let last = performance.now();
// qualité adaptative : si le téléphone ne tient pas ~50 images/s, on divise la résolution du monde (pleine → moitié → pixel de jeu)
let perfN = 0,
  perfT = 0,
  perfGrace = 2,
  showFps = false,
  fpsN = 0,
  fpsT = 0,
  fpsShown = 0;
function adaptQuality(ms) {
  if (mode !== 'play' || document.hidden || ms > 250) return;
  perfN++;
  perfT += ms;
  if (perfT < 2000) return;
  const avg = perfT / perfN;
  perfN = 0;
  perfT = 0;
  if (perfGrace > 0) {
    perfGrace--;
    return;
  }
  if (avg > 20 && RQ > 1) {
    RQ = Math.max(1, Math.floor(RQ / 2));
    resize();
    perfGrace = 1;
  }
}
function loop(now) {
  adaptQuality(now - last);
  fpsN++;
  fpsT += now - last;
  if (fpsT >= 500) {
    fpsShown = Math.round((fpsN * 1000) / fpsT);
    fpsN = 0;
    fpsT = 0;
  }
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  update(dt);
  render();
  drawUI();
  if (mode !== 'play') drawPreview();
  else drawCharPreview();
  requestAnimationFrame(loop);
}
/* ---------- sauvegarde dans le compte Claude (survit aux mises à jour du jeu) ---------- */
const Cloud = {
  ref: null,
  owner: false,
  last: '',
  pending: null,
  writing: false,
  ok: null,
  top: null, // top : la progression la plus avancée connue dans le compte
  async init() {
    try {
      if (!window.claude || typeof window.claude.use !== 'function') return false;
      const to = new Promise(r => setTimeout(() => r(null), 12000)); // l'app mobile peut être lente à répondre
      const [db, user] = await Promise.race([
        Promise.all([window.claude.use('db'), window.claude.use('user')]),
        to.then(() => [null, null])
      ]);
      if (!db || !user) return false;
      const id = await Promise.race([user.id(), to]);
      if (!id) return false;
      this.ref = db.doc('data/users/' + id + '/save');
      try {
        this.owner = !!(await Promise.race([user.isOwner(), to]));
      } catch (e) {
        this.owner = false;
      }
      return true;
    } catch (e) {
      return false;
    }
  },
  async load() {
    if (!this.ref) return null;
    try {
      const snap = await Promise.race([this.ref.get(), new Promise((_, j) => setTimeout(() => j(new Error('timeout')), 8000))]);
      return snap.exists ? snap.data() : null;
    } catch (e) {
      this.ref = null;
      return null;
    } // lecture impossible : on n'écrit pas non plus, pour ne rien écraser
  },
  save(solo) {
    if (!this.ref) return;
    if (this.top && ahead(this.top, solo)) return; // le compte garde un héros plus avancé : on ne l'écrase pas
    const body = { v: 1, prefs: { name: me.name, look: look.slice(), lvl: prefs.lvl || 0, cls: me.cls | 0 }, solo };
    const j = JSON.stringify(body);
    if (j === this.last) return;
    this.pending = body;
    this.flush();
  },
  async flush() {
    if (this.writing || !this.pending) return;
    this.writing = true;
    const body = this.pending;
    this.pending = null;
    try {
      await this.ref.set(Object.assign({ savedAt: Date.now() }, body));
      this.last = JSON.stringify(body);
      this.top = body.solo;
    } catch (e) {
      /* hors ligne : on réessaiera à la prochaine sauvegarde */
    }
    this.writing = false;
    if (this.pending) this.flush();
  }
};
// a est-il plus avancé que b ? (niveau, puis expérience)
function ahead(a, b) {
  if (!a) return false;
  if (!b) return true;
  const la = a.lvl | 0,
    lb = b.lvl | 0;
  return la !== lb ? la > lb : (a.xp | 0) > (b.xp | 0);
}
async function restoreCloud() {
  $('loading').textContent = 'Récupération de ta sauvegarde…';
  Cloud.ok = await Cloud.init();
  if (!Cloud.ok) return;
  const c = await Cloud.load();
  if (!Cloud.ref) Cloud.ok = false;
  if (!c || !c.solo) return;
  Cloud.top = c.solo;
  let localAt = 0,
    local = null;
  try {
    localAt = +localStorage.getItem('etheria_saved_at') || 0;
    local = JSON.parse(localStorage.getItem('etheria_solo') || 'null');
  } catch (e) {
    /* ignore */
  }
  if (!prefs.name) local = null;
  // le héros le plus avancé gagne toujours (un nouveau perso créé par erreur n'écrase pas l'ancien) ; à égalité, la copie la plus récente
  if (local && (ahead(local, c.solo) || (!ahead(c.solo, local) && (c.savedAt || 0) < localAt))) return;
  try {
    localStorage.setItem('etheria_solo', JSON.stringify(c.solo));
    localStorage.setItem('etheria_saved_at', String(c.savedAt || Date.now()));
  } catch (e) {
    /* ignore */
  }
  if (c.prefs) {
    Object.assign(prefs, c.prefs);
    me.name = prefs.name || me.name;
    me.cls = prefs.cls | 0;
    look.splice(0, look.length, ...C.cleanLook(prefs.look));
    try {
      localStorage.setItem('etheria_prefs', JSON.stringify(prefs));
    } catch (e) {
      /* ignore */
    }
  }
  restoredSolo = c.solo;
  const ci = C.cleanIsle(c.solo.isle);
  if (ci.k !== ISLE.k || ci.s !== ISLE.s) {
    try {
      sessionStorage.setItem('etheria_autoplay', '0');
    } catch (e) {
      /* ignore */
    }
    location.reload();
    await new Promise(() => {});
  }
}
const TELE = []; // attaques de boss annoncées
let bossIntro = null,
  bossIntroDone = false;
let restoredSolo = null,
  arrive = null;
function boot() {
  setTimeout(async () => {
    ART = ARTAPI.buildAll(W);
    buildScene();
    await restoreCloud();
    buildMenu();
    $('loading').hidden = true;
    $('menu').hidden = false;
    mode = 'menu';
    requestAnimationFrame(loop);
    let auto = null;
    try {
      auto = sessionStorage.getItem('etheria_autoplay');
      sessionStorage.removeItem('etheria_autoplay');
    } catch (e) {
      /* ignore */
    }
    if (auto === '1' && prefs.name) {
      let arr = null;
      try {
        arr = JSON.parse(sessionStorage.getItem('etheria_arrive') || 'null');
        sessionStorage.removeItem('etheria_arrive');
      } catch (e) {
        /* ignore */
      }
      if (arr) arrive = { t: 0, name: arr.name, col: arr.col || [120, 80, 200] };
      await play();
      if (arr)
        setTimeout(() => {
          if (arr.fresh) sys('Nouvelle île découverte : ' + arr.name + ' !');
          if (arr.desc) sys(arr.desc);
          if (PVP)
            sys(
              "Attention : sur les îles, les autres joueurs peuvent t'attaquer, et si tu meurs ton sac reste sur ton corps (objets uniques protégés)."
            );
        }, 700);
    }
  }, 30);
}
const saveOnLeave = () => {
  if (link) link.saveNow();
};
addEventListener('pagehide', saveOnLeave);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveOnLeave();
});
window.__etheria = {
  get cam() {
    return [camX, camY, lastOX, lastOY, VW, VH, RQ, lastOX * RQ + SUBX, lastOY * RQ + SUBY];
  },
  me,
  mobs,
  others,
  get link() {
    return link;
  },
  get mode() {
    return mode;
  },
  play,
  input,
  W,
  get ART() {
    return ART;
  }
};
boot();
