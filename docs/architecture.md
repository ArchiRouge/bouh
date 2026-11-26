# Pixels Worlds — architecture du code

Ce document est la carte du code, pour les personnes comme pour les agents. Le jeu est du JavaScript sans framework ni
étape de compilation. Les mêmes fichiers tournent dans le navigateur, dans l'app iOS (Capacitor) et, pour le moteur, sur le
serveur Node.

## En bref

```
content.js  (données)  ──►  core.js  (moteur : mondes + simulation)  ◄──  server/server.js  (multijoueur, une simulation par île)
                               ▲
sprites.js  (héros, pixel art) │
assets.js   (tout le reste de l'art, procédural)
game/       (client en 9 fichiers : rendu, interface, entrées, réseau)  ── solo : fait tourner core.js dans la page
persist.js  (app iOS : sauvegarde native, puis charge game/)
steps.js    (app iOS : vrais pas du téléphone)
```

- Le **moteur** (`core.js`) est autoritaire : il génère les mondes (`buildWorld`) et fait tourner la simulation (`Sim`).
- En **solo**, le client crée une `Sim` dans la page (`LocalLink`). **En ligne**, la même `Sim` tourne sur le serveur
  (`WsLink`), à 10 Hz.
- Le client n'envoie que des **intentions** (messages). Il reçoit, 10 fois par seconde, l'**état public**, son **état
  personnel** et des **événements**. Il ne décide jamais d'un résultat de combat ni d'un butin.

## Fichiers

| Fichier | Rôle | Dépend de |
|---|---|---|
| `client/content.js` | Contenu, en données seulement : monstres (`MOBDEF`), objets (`ITEMS`), butin (`LOOT`), armes et techniques (`FAMS`, paliers `MS`), artisanat (`RECIPES`), PNJ et quêtes, îles (`ISLES`), donjons (`DG`, `DG_BOSSES`, `TITLES`). | rien |
| `client/core.js` | Moteur partagé : hasard déterministe, génération du Bourg, des îles et des donjons, déplacements, simulation (`Sim` : combat, progression, voyage, sauvegarde). Réexporte tout `content.js` (`C.ITEMS`…). | `content.js` |
| `client/sprites.js` | Héros et équipement porté, en pixel art posé à la main (grilles par direction et par couche) ; sans DOM, donc testable dans Node. | rien |
| `client/assets.js` | Tout l'art procédural : terrain, palettes, arbres, maisons, monstres, icônes, ponts, donjons. Met en cache les sprites des héros. | `core.js`, `sprites.js` |
| `client/game/*.js` | Client, en 9 fichiers (détail ci-dessous) : canvas, caméra, rendu 2.5D, interface, entrées tactiles et clavier, réseau (solo ou WebSocket), sauvegarde dans le compte Claude. | tout ce qui précède |
| `client/persist.js` | App iOS : recopie les clés `etheria_*` dans les préférences natives et les restaure, puis charge `client/game/`. | Capacitor |
| `client/steps.js` | App iOS : plugin natif `Pedometer` (CoreMotion). | Capacitor |
| `client/config.js` | Adresse du serveur (`'auto'`, une adresse fixe ou `null`), drapeaux `founder` et `gm`. | rien |
| `client/seed-save.js` | Progression de l'alpha d'Archibald, chargée seulement si l'appareil n'a aucune sauvegarde. | rien |
| `server/server.js` | Serveur Node : fichiers statiques, WebSocket `/ws`, une `Sim` par île ou donjon ouvert, sauvegardes dans `data/players.json`. | `core.js` |
| `tools/build-preview.js` | Assemble un seul fichier HTML solo (`dist/`) pour l'aperçu web. | `client/` |
| `tests/core.test.js` | Tests du moteur (`npm test`). | `core.js` |

### Ordre de chargement (`client/index.html`)

`config.js`, `seed-save.js`, `content.js`, `core.js`, `sprites.js`, `assets.js`, `steps.js`, puis **`persist.js` en
dernier** : c'est lui qui charge les fichiers de `client/game/`, dans l'ordre, une fois la sauvegarde native restaurée.

### Le client : `client/game/`

Neuf scripts classiques, chargés dans cet ordre (`GAME_FILES` dans `persist.js`, même liste dans `tools/build-preview.js`).
Ils partagent une seule portée globale : ce qu'un fichier déclare au premier niveau (`const`, `let`, `function`) sert aux fichiers
suivants. Au chargement, un fichier ne peut utiliser que ce que les précédents ont déclaré ; dans une fonction appelée plus
tard, tout est disponible.

| Fichier | Contenu |
|---|---|
| `setup.js` | Île en cours (lue dans la sauvegarde) et monde, canvases et échelles (`S`, `SU`, `RQ`), ambiance par zone (`ZONE_LOOK`), obscurité des donjons, police pixel, état du jeu (`me`, `mobs`, `others`). |
| `scene.js` | Décor statique trié par diagonale (`buildScene`), couleurs de la mini-carte, textes flottants, éclats, effets des armes et techniques. |
| `input.js` | Tactile et clavier, page personnage, dialogues des PNJ, artisanat, marche réelle (Éther). |
| `net.js` | `LocalLink` (solo) et `WsLink` (en ligne), `onMsg`, `handleEvent`. |
| `update.js` | Mise à jour à chaque image : héros, monstres et joueurs interpolés, invites, caméra. |
| `render.js` | Rendu du monde : tuiles, entités, héros (`drawChar`), monstres et boss (`drawMob`), lumières. |
| `atmo.js` | Direction « plus adulte » : décor en glyphes précalculé (désactivé par défaut, `etheria_glyph = '1'`), jour et nuit, pluie et brume, néons, éclair et glitch des critiques. |
| `hud.js` | Interface sur le canevas : étiquettes, statut, mini-carte, boutons, barre du boss, invites, voiles. |
| `main.js` | Menu de création, boucle principale, sauvegarde dans le compte Claude (`Cloud`), démarrage (`boot`). |

## Protocole

Les mêmes messages servent en solo (appel direct de `sim.handle(id, message)`) et en ligne (JSON sur WebSocket).

### Messages du client vers la simulation (`Sim.handle`)

| `t` | Champs | Effet |
|---|---|---|
| `hello` | `v`, `name`, `look`, `cls`, `token` | En ligne seulement, premier message (refusé si `v` ≠ `VERSION`). |
| `mv` | `x`, `y`, `f` (face), `fl` (miroir), `mv` (en marche) | Position du héros, vérifiée (vitesse, cases praticables). |
| `atk` | `m` (monstre) ou `p` (joueur, sur les îles) | Attaque de base de l'arme en main. |
| `ab` | `a` (emplacement 0-2), `m` ou `p` | Technique de la barre. |
| `pot` | | Potion. |
| `steps` | `n` | Pas réels (Éther). |
| `gather` | `k` | Cueillette d'un point. |
| `craft` | `r` | Recette (près du PNJ). |
| `equip` / `unequip` / `sell` | `b` (case du sac) / `s` (emplacement) / `b` | Équipement. |
| `scarf` | `s` | Couleur d'écharpe. |
| `pt` | `s` (`str`, `sta`, `int`, `agi`) | Un point de caractéristique. |
| `respec`, `skcReset` | | Chez Elya. |
| `skc` | `k`, `j`, `c` | Choix d'un palier de technique. |
| `bar` | `s`, `k` | Barre de techniques. |
| `talk` | `npc` | Quêtes. |
| `cross` | `b` | Traverser un pont. |
| `dgIn` / `dgOut` | | Entrer dans le donjon de l'île, en sortir. |
| `chest`, `loot` | `c` (corps) | Coffre, pillage d'un corps. |
| `tt` | `i` | Titre affiché (-1 : aucun). |
| `chat` | `text` | Tchat. |

### Ce que reçoit le client (message `t: 's'`, 10 fois par seconde)

- `p` : joueurs `[id, nom, apparence, x, y, face, miroir, marche, pv, pvMax, niveau, mort, écharpe, cls, néant, équipement, titre, aura d'élément]`.
- `m` : monstres, dans l'ordre de `W.spawns`, `[x, y, pv, vivant, en chasse, marche, statut, pvMax, niveau]`.
- `c` : coffre ouvert ; `cp` : corps pillables ; `tm` : horloge de la simulation (pièges) ; `dg` : donjon de l'île `[rareté, boss, éteint]`.
- `me` : état complet du héros (`Sim.meState`) ; `n` : joueurs en ligne ; `ev` : événements.
- Le champ `t` est réservé au type du message : l'état public ne doit jamais avoir de clé `t` (un test le vérifie).

### Événements (`ev`, champ `e`)

Combat : `hm`, `km`, `mr`, `hp`, `die`, `rs`, `sw`, `ab`, `heal`, `zone`, `imm`, `tp`, `bsk` et `bskx` (attaque de boss annoncée, déclenchée). Butin et progression : `lt`, `it`,
`sold`, `lv`, `ml`, `skr`, `skc`, `gl`, `ga`, `cr`, `eq`, `po`, `st`, `gift`. Quêtes : `qa`, `qp`, `qc`, `qr`. Monde : `travel`,
`chest`, `looted`, `ttl`, `dgdone` (serveur), `founder`, `gm`. Messages : `ch` (tchat ou annonce `s: 1`), `msg` (au joueur).

## Sauvegarde

- Format : `Sim.saveData(p)`. **On ne renomme ni ne retire jamais un champ.** Un nouveau champ reçoit une valeur par défaut
  dans `addPlayer`, qui répare aussi les sauvegardes abîmées (un test le vérifie).
- Où elle vit :
  - en solo, dans `localStorage` (`etheria_solo`, `etheria_prefs`, `etheria_saved_at`) ;
  - dans l'app iOS, aussi dans les préférences natives (`persist.js`) ;
  - sur la page de test, aussi dans le compte Claude (`Cloud`, base de l'artefact) ;
  - en ligne, dans `server/data/players.json` (clé : jeton anonyme de l'appareil).
- Un objet est `[numéro dans ITEMS, rareté]`, ou `[numéro, rareté, élément]` pour une arme enchantée (numéro dans `EL_ORDER`).
- Restauration : le héros le plus avancé (niveau, puis XP) gagne ; à égalité, la copie la plus récente.
- Voyage (pont, donjon) : sauvegarde, puis `await EtheriaPersist.flush()`, puis `location.reload()` sur le nouveau monde
  (`etheria_isle_force`, `etheria_autoplay`).
- Autres clés locales : `etheria_zoom`, `etheria_token`, `etheria_ignore`, `etheria_steps_since`, `etheria_arrive`.

## Mondes

`buildWorld(seed, isle)` renvoie toujours la même forme : `TY`, `HT`, `SOL` (types, hauteurs, obstacles, par case),
`props`, `spawns`, `nodes`, `bridges`, `spawn`, `chest`, et selon le monde `gate` (entrée de donjon) ou `dg` (plan du donjon).

- `isle` absent ou `{ k: 'bourg' }` : le Bourg d'Argel. Sa génération ne doit jamais changer (empreinte vérifiée par un test).
- `{ k: 'givre' | 'braise' }` : îles fixes ; `{ k: 'brume', s }` : île éphémère (graine).
- `{ k: 'donjon', s, r, b, f }` : donjon (graine, rareté, boss, île d'origine).

## Recettes

- **Un objet** : l'ajouter **à la fin** de `ITEMS` (`content.js`) avec une icône connue (liste dans le test « contenu »),
  puis le mettre dans un `LOOT`, une recette ou un boss. Il est dessiné automatiquement (icône teintée et pièce portée).
- **Un monstre** : une entrée dans `MOBDEF`, son dessin dans `assets.js` (`bestiary()`), puis l'ajouter aux listes `mobs`
  d'une île ou d'un donjon et à `LOOT`.
- **Un boss de donjon** : une entrée dans `DG_BOSSES` (dessin d'un monstre existant, rareté, objet propre, titre éventuel).
- **Une île** : une entrée dans `ISLES` (thème, monstres, ressources, arbres), sa palette dans `assets.js` (`ISLE_PAL`)
  et son ambiance dans `game/setup.js` (`ZONE_LOOK`, `THEME_LOOK`).
- **Une technique** : dans `FAMS` (`content.js`), et ses deux paliers dans `MS`.
- Tout changement visible par un joueur : mettre à jour le [guide du joueur](guide-du-joueur.md).
- Après tout changement : `npm test`, puis `npm run build:preview` pour l'aperçu ; pour l'app iOS, `npx cap sync ios`.

## Commandes

| Commande | Effet |
|---|---|
| `npm test` | Tests du moteur (Node 22, aucune dépendance). |
| `npm run build:preview` | `dist/pixels-worlds-preview.html`, version solo en un fichier. |
| `npm run serve` | Serveur multijoueur local (http://localhost:8080). |
| `npx cap sync ios` puis `npx cap run ios` | App iOS (sur un Mac). |

Style : Prettier (`.prettierrc.json`, largeur 140), commentaires et textes du jeu en français.
