/* Pixels Worlds — serveur multijoueur
   - sert le client web (dossier ../client)
   - WebSocket sur /ws : simulation autoritaire à 10 Hz (monstres, combat, XP, tchat)
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

const world = Core.buildWorld(Core.SEED);
const sim = new Core.Sim(world);

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
  if (url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, players: sim.players.size, v: Core.VERSION })); return; }
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
      const p = sim.addPlayer(id, m.name, m.look, save, m.cls);
      if (FOUNDERS.includes(String(p.name).toLowerCase())) sim.grantFounder(p);
      p.isle = { k: 'bourg' }; p.arr = 0; // en ligne, tout le monde est au Bourg d'Argel pour l'instant
      // maître du jeu : jeton(s) de l'appareil listés dans la variable d'environnement GM_TOKENS (séparés par des virgules)
      if ((process.env.GM_TOKENS || '').split(',').map(t => t.trim()).filter(Boolean).includes(token)) sim.grantGM(p);
      c.token = token; clients.set(id, c);
      ws.send(JSON.stringify({ t: 'welcome', id, x: p.x, y: p.y, v: Core.VERSION }));
      console.log(`[+] ${p.name} (${id}) — ${clients.size} en ligne`);
      return;
    }
    if (m && (m.t === 'cross' || m.t === 'chest')) return; // les ponts d'Éther ne sont pas encore gérés par le serveur (une simulation par île à venir)
    sim.handle(id, m);
  });
  ws.on('close', () => {
    if (!id) return;
    const p = sim.players.get(id);
    if (p && c.token) { db[c.token] = Object.assign(sim.saveData(p), { name: p.name, seen: Date.now() }); dirty = true; }
    console.log(`[-] ${p ? p.name : id}`);
    sim.removePlayer(id); clients.delete(id);
  });
  ws.on('error', () => { });
});

// battement de cœur : coupe les connexions mortes
setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; try { ws.ping(); } catch (e) { /* ignore */ } } }, 15000);

/* ---------- boucle de simulation ---------- */
let saveTick = 0;
setInterval(() => {
  sim.step(TICK);
  const ev = JSON.stringify(sim.events.splice(0));
  const pub = JSON.stringify(sim.publicState());
  const n = clients.size;
  const head = '{"t":"s",' + pub.slice(1, -1) + ',"n":' + n + ',"ev":' + ev + ',"me":';
  for (const [id, c] of clients) {
    c.budget = Math.min(40, c.budget + 4);
    if (c.ws.readyState !== 1) continue;
    c.ws.send(head + JSON.stringify(sim.meState(id)) + '}');
  }
  if (++saveTick >= 100) { // toutes les 10 s
    saveTick = 0;
    for (const [id, c] of clients) { const p = sim.players.get(id); if (p) db[c.token] = Object.assign(sim.saveData(p), { name: p.name, seen: Date.now() }); }
    dirty = true;
  }
}, TICK * 1000);

function shutdown() { for (const [id, c] of clients) { const p = sim.players.get(id); if (p) db[c.token] = sim.saveData(p); } dirty = true; persist(); setTimeout(() => process.exit(0), 300); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);

server.listen(PORT, () => console.log(`Pixels Worlds — serveur v${Core.VERSION} sur http://localhost:${PORT}`));
