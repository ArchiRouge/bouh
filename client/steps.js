/* Source de pas réels.
   - Dans l'app iOS : plugin natif « Pedometer » (CoreMotion, voir ios-plugin/) → vrais pas du téléphone.
   - Dans un navigateur : pas de capteur accessible, le jeu propose une simulation de test. */
window.EtheriaSteps = (function () {
  'use strict';
  const Cap = window.Capacitor;
  const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform() && Cap.registerPlugin);
  const Pedometer = isNative ? Cap.registerPlugin('Pedometer') : null;
  const KEY = 'etheria_steps_since';
  function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  return {
    native: isNative,
    /* Renvoie le nombre de pas faits depuis la dernière synchronisation (0 hors app iOS). */
    async collect() {
      if (!Pedometer) return 0;
      const now = Date.now();
      let since = 0; try { since = +localStorage.getItem(KEY) || 0; } catch (e) { /* ignore */ }
      if (!since) since = startOfToday();                       // première fois : les pas d'aujourd'hui
      since = Math.max(since, now - 7 * 24 * 3600 * 1000);      // CoreMotion garde 7 jours d'historique
      const r = await Pedometer.stepsSince({ since });
      try { localStorage.setItem(KEY, String(now)); } catch (e) { /* ignore */ }
      return Math.max(0, (r && r.steps) | 0);
    }
  };
})();
