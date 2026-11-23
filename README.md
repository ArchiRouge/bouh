# Pixels Worlds — bêta

MMORPG mobile collaboratif en pixel art 2.5D peint, dans l'esprit de Tree of Savior.
Le jeu est en HTML5 (canvas), le serveur en Node.js (WebSocket), et l'app iOS est produite avec Capacitor.

## Construire l'app iPhone avec Claude Code

Ouvre ce dossier dans Claude Code sur ton Mac et demande : « Construis l'app iOS et lance-la sur le simulateur, puis sur mon iPhone. » Le fichier `CLAUDE.md` lui donne toutes les étapes, y compris le plugin natif qui lit tes vrais pas.

## Ta progression

Ton héros de l'alpha (Archi404, Guerrier niveau 8, Bottes du Néant et ensemble épique, 776 PO) est inclus : `client/seed-save.js` le charge au premier lancement de l'app, et `server/seed-saves.json` le donne au serveur multijoueur quand tu te connectes avec le nom Archi404.

## Structure

```
client/          le jeu (c'est aussi le dossier embarqué dans l'app iOS)
  index.html     écran de création du héros et canevas
  config.js      ← adresse du serveur à renseigner
  persist.js     sauvegarde durable dans l'app iOS (charge game.js)
  core.js        monde et simulation, partagés avec le serveur
  assets.js      direction artistique, entièrement procédurale
  game.js        rendu, interface, contrôles tactiles, réseau
server/          serveur multijoueur (Node + ws)
assets/          icône 1024 px et écran de lancement de l'app
ios/             projet Xcode (généré par Capacitor, déjà configuré)
.github/workflows/ios.yml   compilation iOS et envoi sur TestFlight sans Mac
Dockerfile, fly.toml   déploiement du serveur
capacitor.config.json  configuration de l'app iOS
```

## Tester sur ton iPhone pendant le développement

Le projet Xcode (`ios/`) est déjà prêt dans le dépôt. Deux façons d'installer le jeu sur l'iPhone :

| | **A. Avec un Mac** (gratuit) | **B. Sans Mac : GitHub Actions → TestFlight** |
|---|---|---|
| Il faut | Xcode 26+, un câble, ton identifiant Apple | Apple Developer Program (99 $/an) |
| Installer | `npm install && npx cap sync ios && npx cap open ios`, choisis ton équipe dans *Signing*, ▶ | Actions → **iOS** → *Run workflow* ; la version arrive dans l'app TestFlight |
| Limite | l'app expire au bout de 7 jours (relancer ▶ suffit) | 90 jours par version, mises à jour en un clic |

**Ta progression est conservée dans les deux cas** : chaque mise à jour garde la sauvegarde tant que l'identifiant de l'app
(`appId` dans `capacitor.config.json`, `com.pixelsworlds.app`) ne change pas. Dans l'app, la sauvegarde est recopiée dans les
préférences natives de l'iPhone (`client/persist.js`), qui font partie des sauvegardes iCloud. Seule la suppression de l'app l'efface.

Pour la voie B, une seule fois :
1. Sur appstoreconnect.apple.com → Apps → **+** : crée l'app avec le Bundle ID `com.pixelsworlds.app` (ou change `appId` s'il est pris).
2. Users and Access → Integrations → App Store Connect API : crée une clé avec le rôle **Admin**, télécharge le `.p8`.
3. Sur GitHub, Settings → Secrets and variables → Actions, ajoute `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (le contenu du `.p8`).
4. Facultatif : la variable `TESTFLIGHT_ON_PUSH` = `true` envoie une nouvelle version sur TestFlight à chaque push.
5. Sur l'iPhone, installe TestFlight ; tu es testeur interne automatiquement en tant que titulaire du compte.

## 1. Tester en local (5 minutes)

Il faut Node.js 18 ou plus récent (nodejs.org).

```bash
cd server && npm install && npm start
```

Ouvre ensuite http://localhost:8080 dans deux onglets ou deux navigateurs : tu verras les deux héros dans le même monde.
Pour tester avec un téléphone sur le même Wi-Fi, ouvre http://IP-DE-TON-ORDI:8080 sur le téléphone.

## 2. Mettre le serveur en ligne (Fly.io, environ 5 $/mois)

1. Crée un compte sur fly.io puis installe l'outil `flyctl`.
2. À la racine du projet, lance ces commandes :
   ```bash
   fly launch --no-deploy        # garde le fly.toml existant, choisis un nom d'app unique
   fly volumes create etheria_data --size 1 --region cdg
   fly deploy
   ```
3. Le jeu est alors jouable sur `https://<ton-app>.fly.dev`, ce qui en fait déjà une bêta web partageable.
4. Garde **une seule machine** : le monde vit dans la mémoire du serveur.

Render ou Railway conviennent aussi (le Dockerfile est prêt). Il faut seulement un disque persistant monté sur `/data`.

## 3. Créer l'app iOS et la passer sur TestFlight

Prérequis :
- un compte **Apple Developer** à 99 $/an (developer.apple.com/programs). Compte quelques jours de validation, alors lance l'inscription tout de suite ;
- un **Mac** avec Xcode. Sans Mac, Codemagic ou Ionic Appflow peuvent compiler dans le cloud.

Étapes :
1. Dans `client/config.js`, remplace `'auto'` par l'adresse de ton serveur :
   `window.ETHERIA_CONFIG = { server: 'wss://<ton-app>.fly.dev/ws' };`
2. À la racine du projet :
   ```bash
   npm install
   npm run ios:sync      # le projet Xcode ios/ existe déjà
   npm run ios:open      # ouvre Xcode
   ```
3. Dans Xcode :
   - App → Signing & Capabilities : choisis ton équipe Apple et un Bundle ID unique (par défaut `com.pixelsworlds.app`, à changer s'il est déjà pris) ;
   - General → Deployment Info : coche uniquement **Portrait** ;
   - Product → Archive, puis Distribute App → **TestFlight & App Store**.
4. Sur appstoreconnect.apple.com :
   - crée la fiche de l'app (nom, catégorie Jeux / Jeu de rôle, âge 9+ ou 12+ à cause du tchat) ;
   - **testeurs internes** (jusqu'à 100 membres de ton équipe) : ils jouent dès que la compilation est traitée, sans validation d'Apple ;
   - **testeurs externes** (jusqu'à 10 000 personnes via un lien public) : nécessite une courte validation « Beta App Review », souvent en 24 à 48 h.

À chaque mise à jour du jeu : `npm run ios:sync`, augmente le numéro de build dans Xcode, puis refais une archive.

## Avant de passer en externe / sur l'App Store

Apple exige, pour une app avec du contenu généré par les joueurs (tchat) :
- un filtre de messages : il y en a un basique dans `core.js` (liste `BAD`), à compléter ;
- un moyen de **bloquer** un joueur : la commande `/ignorer Nom` existe (et `/retablir Nom`) ; prévoir un bouton visible ;
- un moyen de **signaler** un abus et un contact de modération : à ajouter (bouton « Signaler » qui journalise côté serveur) ;
- une **politique de confidentialité** publique (URL demandée dans App Store Connect). Le jeu ne collecte qu'un pseudo et un identifiant anonyme d'appareil.

## Ce que fait la bêta

- Création du héros : nom, coiffure, couleur des cheveux, tenue, peau, chapeau.
- Un monde partagé : l'île, son bourg, 4 zones de difficulté croissante, 52 monstres et le Roi Gelée.
- Coopération : chaque joueur qui frappe un monstre reçoit toute l'XP, avec **+25 % en groupe**.
- Tchat global, liste des joueurs en ligne, mini-carte.
- Sauvegarde côté serveur (niveau, XP, or, potions), liée à l'appareil.
- Mode solo automatique si le serveur est injoignable.

## Systèmes de jeu

- **Équipement façon WoW** : 6 emplacements (tête, torse, jambes, pieds, arme, bijou), 20 objets, 4 raretés (commun, inhabituel, rare, épique), caractéristiques Force / Endurance / Intelligence / Agilité / Armure, butin personnel sur les monstres, comparaison avec l'objet équipé. Touche **I** ou le bouton sac.
- **Page personnage** (bouton sac, portrait en haut à gauche, ou touche I) : équipement sur 6 emplacements, aperçu du héros qui tourne, **essayage** d'un objet du sac avec gains/pertes de stats en vert/rouge, onglets Stats / Sac (filtres armes, armures, bijoux) / Compétences, confirmation avant de vendre un objet rare ou mieux.
- **Équipement visible** : casque, capuche ou couronne, torse (tunique ou plastron avec épaulières), jambes, bottes et arme en main sont dessinés sur le héros, dans les 4 directions et pour les autres joueurs. Les objets rares et plus ont des finitions dorées, les armes épiques et uniques scintillent.
- **Direction artistique** : pixel art 16 bits façon JRPG, couleurs franches, contours sombres, fenêtres bleues à bord blanc.
- **Marche réelle → cueillette** : 100 pas = 1 Éther (12 000 pas/jour max, +15 Éther offerts chaque jour). L'Éther sert à récolter herbes, bois et quartz ; le métier de cueillette monte de niveau et débloque les recettes de Mira et Bran.

## Pistes pour la suite

Comptes (Sign in with Apple), inventaire et équipement, classes, quêtes du bourg, donjon instancié pour groupes, emotes, sons et musique.
