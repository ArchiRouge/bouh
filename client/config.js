/* Configuration du client.
   server: 'auto'  -> se connecte au serveur qui sert la page (ws://hôte/ws)
           'wss://mon-serveur.fly.dev/ws' -> adresse fixe (obligatoire pour l'app iOS)
           null    -> mode solo hors-ligne

   founder: true -> le héros reçoit une fois le cadeau du fondateur (Bottes du Néant + ensemble épique) en mode solo. */
window.ETHERIA_CONFIG = { server: 'auto', founder: false };
