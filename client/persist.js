/* Sauvegarde durable dans l'app iOS.
   Le localStorage d'une WebView iOS peut être effacé par le système (manque de place, etc.).
   Dans l'app native, chaque clé « etheria_* » est donc recopiée dans les préférences natives
   (UserDefaults, incluses dans les sauvegardes iCloud / Finder de l'iPhone), puis restaurée
   au démarrage AVANT le lancement du jeu. Les mises à jour de l'app (Xcode, TestFlight, App Store)
   gardent ces données tant que l'identifiant de l'app (appId) ne change pas.
   Dans un navigateur, ce fichier se contente de charger game.js. */
(function () {
  'use strict';
  const PREFIX = 'etheria_';
  const Cap = window.Capacitor;
  const native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform() && Cap.registerPlugin);
  const Prefs = native ? Cap.registerPlugin('Preferences') : null;
  let started = false;
  function start() {
    if (started) return; started = true;
    const s = document.createElement('script'); s.src = 'game.js'; document.body.appendChild(s);
  }
  if (!Prefs) { start(); return; }

  const ls = window.localStorage;
  const set = Storage.prototype.setItem, del = Storage.prototype.removeItem;
  function mirror() {
    Storage.prototype.setItem = function (k, v) {
      set.call(this, k, v);
      if (this === ls && String(k).startsWith(PREFIX)) Prefs.set({ key: String(k), value: String(v) }).catch(() => { });
    };
    Storage.prototype.removeItem = function (k) {
      del.call(this, k);
      if (this === ls && String(k).startsWith(PREFIX)) Prefs.remove({ key: String(k) }).catch(() => { });
    };
  }
  async function hydrate() {
    const r = await Prefs.keys();
    const keys = ((r && r.keys) || []).filter(k => k.startsWith(PREFIX));
    if (keys.length) {
      // La copie native fait foi : elle est écrite à chaque sauvegarde.
      for (const k of keys) { const g = await Prefs.get({ key: k }); if (g && g.value != null) set.call(ls, k, g.value); }
    } else {
      // Première ouverture avec ce fichier : on recopie ce que la WebView contient déjà.
      for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && k.startsWith(PREFIX)) await Prefs.set({ key: k, value: ls.getItem(k) }); }
    }
  }
  const timeout = new Promise(r => setTimeout(r, 4000));
  Promise.race([hydrate(), timeout]).catch(() => { }).then(() => { mirror(); start(); });
})();
