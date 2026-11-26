/* Pixels Worlds — serveur multijoueur
   - sert le client web (dossier ../client)
   - WebSocket sur /ws : une simulation autoritaire à 10 Hz par île (Bourg d'Argel, îles du voyage), tchat commun
   - sauvegarde des héros dans data/players.json (clé = jeton anonyme de l'appareil) */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const Core = require('../client/core.js');

const PORT = +process.env.PORT || 8080;
const MAX_PLAYERS = +process.env.MAX_PLAYERS || 150;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'players.json');
const CLIENT_DIR = path.join(__dirname, '..', 'client');
const TICK = 0.1;
// Héros qui reçoivent le cadeau du fondateur (Bottes du Néant + ensemble épique), ex. FOUNDER_NAMES="Archi"
const FOUNDERS = String(process.env.FOUNDER_NAMES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

/* ---------- îles : une simulation par île (les îles éphémères sont créées à la demande et libérées vides) ---------- */
const isles = new Map(); // clé -> { key, isle, sim, emptyT }
const isleKey = i => i.k === 'brume' || i.k === 'donjon' ? i.k + ':' + i.s : i.k;
function getIsle(i, lvl) {
  i = Core.cleanIsle(i); const key = isleKey(i); let I = isles.get(key);
  if (!I) { I = { key, isle: i, sim: new Core.Sim(Core.buildWorld(Core.SEED, i), { lvl: lvl || 1 }), emptyT: 0 }; isles.set(key, I); console.log(`[île] ${key} ouverte`); }
  return I;
}
getIsle({ k: 'bourg' });
const totalPlayers = () => { let n = 0; for (const I of isles.values()) n += I.sim.players.size; return n; };

/* ---------- sauvegarde ---------- */
let db = {};
try { db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { db = {}; }
let dirty = false;
// Progressions importées (ex. depuis l'alpha), données une seule fois au premier héros portant ce nom
let SEEDS = {}; try { SEEDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-saves.json'), 'utf8')); } catch (e) { SEEDS = {}; }
for (const t in db) if (db[t] && db[t].name) delete SEEDS[String(db[t].name).toLowerCase()];
function persist() {
  if (!dirty) return; dirty = false;
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFile(tmp, JSON.stringify(db), err => { if (!err) fs.rename(tmp, DATA_FILE, () => { }); });
}
setInterval(persist, 5000);

/* ---------- fichiers statiques ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, players: totalPlayers(), isles: [...isles.keys()], v: Core.VERSION })); return; }
  const file = path.normalize(path.join(CLIENT_DIR, url === '/' ? 'index.html' : url));
  if (!file.startsWith(CLIENT_DIR)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end('Introuvable'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(buf);
  });
});

/* ---------- WebSocket ---------- */
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
const clients = new Map(); // id -> { ws, token, budget }
let nextId = 1;

wss.on('connection', ws => {
  let id = null, token = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  const c = { ws, budget: 40 };
  ws.on('message', buf => {
    if (--c.budget < 0) return; // anti-flood : ~30 messages/s max
    let m; try { m = JSON.parse(buf); } catch (e) { return; }
    if (!id) {
      if (!m || m.t !== 'hello') return;
      if ((m.v | 0) !== Core.VERSION) { ws.send(JSON.stringify({ t: 'err', msg: 'Nouvelle version disponible : mets le jeu à jour.' })); ws.close(); return; }
      if (clients.size >= MAX_PLAYERS) { ws.send(JSON.stringify({ t: 'err', msg: 'Le monde est plein, réessaie plus tard.' })); ws.close(); return; }
      token = String(m.token || '').replace(/[^a-z0-9]/gi, '').slice(0, 64) || ('anon' + Date.now() + Math.random());
      for (const [oid, oc] of clients) if (oc.token === token) { oc.ws.close(); } // même appareil reconnecté
      id = 'p' + (nextId++);
      let save = db[token];
      const seedKey = String(m.name || '').trim().toLowerCase();
      if (!save && SEEDS[seedKey]) { save = SEEDS[seedKey]; delete SEEDS[seedKey]; console.log(`[seed] progression importée pour ${m.name}`); }
      const I = getIsle(save && save.isle, save && save.lvl), sim = I.sim; c.I = I;
      const p = sim.addPlayer(id, m.name, m.look, save, m.cls);
      if (FOUNDERS.includes(String(p.name).toLowerCase())) sim.grantFounder(p);
      // maître du jeu : jeton(s) de l'appareil listés dans la variable d'environnement GM_TOKENS (séparés par des virgules)
      if ((process.env.GM_TOKENS || '').split(',').map(t => t.trim()).filter(Boolean).includes(token)) sim.grantGM(p);
      c.token = token; clients.set(id, c);
      ws.send(JSON.stringify({ t: 'welcome', id, x: p.x, y: p.y, v: Core.VERSION, isle: I.isle }));
      console.log(`[+] ${p.name} (${id}) — ${clients.size} en ligne`);
      return;
    }
    c.I.sim.handle(id, m);
  });
  ws.on('close', () => {
    if (!id) return;
    const sim = c.I.sim, p = sim.players.get(id);
    if (p && c.token) { db[c.token] = Object.assign(sim.saveData(p), { name: p.name, seen: Date.now() }); dirty = true; }
    console.log(`[-] ${p ? p.name : id}`);
    sim.removePlayer(id); clients.delete(id);
  });
  ws.on('error', () => { });
});

// battement de cœur : coupe les connexions mortes
setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; try { ws.ping(); } catch (e) { /* ignore */ } } }, 15000);

/* ---------- boucle de simulation : chaque île avance et n'envoie l'état qu'à ses joueurs ; le tchat des joueurs est commun ---------- */
let saveTick = 0;
const saveOf = (sim, id, c) => { const p = sim.players.get(id); if (p && c.token) db[c.token] = Object.assign(sim.saveData(p), { name: p.name, seen: Date.now() }); };
setInterval(() => {
  const n = clients.size, evs = new Map(), shared = [];
  for (const I of isles.values()) {
    const sim = I.sim; sim.step(TICK); const ev = sim.events.splice(0); evs.set(I, ev);
    for (const e of ev) {
      if (e.e === 'ch' && e.id) shared.push(e);
      // traversée d'un pont : la nouvelle île est enregistrée tout de suite ; le client recharge et se reconnecte sur cette île
      if (e.e === 'travel') { const c = clients.get(e.id); if (c) { saveOf(sim, e.id, c); dirty = true; } }
      // boss d'un donjon vaincu : l'entrée de son île s'éteint (un nouveau donjon sera tiré quand l'île se rouvrira)
      if (e.e === 'dgdone') for (const J of isles.values()) if (J.sim.dg && J.sim.dg.s === e.s) J.sim.dg.done = 1;
    }
  }
  for (const [I, ev] of evs) {
    const sim = I.sim, all = ev.concat(shared.filter(e => !ev.includes(e)));
    const head = '{"t":"s",' + JSON.stringify(sim.publicState()).slice(1, -1) + ',"n":' + n + ',"ev":' + JSON.stringify(all) + ',"me":';
    for (const [id, c] of clients) {
      if (c.I !== I) continue;
      c.budget = Math.min(40, c.budget + 4);
      if (c.ws.readyState !== 1) continue;
      c.ws.send(head + JSON.stringify(sim.meState(id)) + '}');
    }
    // île du voyage vide depuis 5 minutes : libérée (elle sera recréée au prochain passage)
    if (I.key !== 'bourg') { if (sim.players.size) I.emptyT = 0; else if ((I.emptyT += TICK) > 300) { isles.delete(I.key); console.log(`[île] ${I.key} fermée`); } }
  }
  if (++saveTick >= 100) { // toutes les 10 s
    saveTick = 0;
    for (const [id, c] of clients) saveOf(c.I.sim, id, c);
    dirty = true;
  }
}, TICK * 1000);

function shutdown() { for (const [id, c] of clients) saveOf(c.I.sim, id, c); dirty = true; persist(); setTimeout(() => process.exit(0), 300); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);

server.listen(PORT, () => console.log(`Pixels Worlds — serveur v${Core.VERSION} sur http://localhost:${PORT}`));
