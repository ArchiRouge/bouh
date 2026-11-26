# Pixels Worlds — éléments : faiblesses et bonus d'ensemble

Statut : **codé** (principe validé en série 1, détails en série 3).

![Éléments](img/v12-elements.png)

Maquette : `prototype/maquette-elements.html`.

## Proposition

- **Cycle** : Feu bat Bois, Bois bat Eau, Eau bat Feu ; Lumière et Ténèbres se battent l'une l'autre.
- **Dégâts** : +30 % contre un élément faible, −20 % contre un élément fort, normal sinon ou sans élément.
  Les monstres ont déjà un élément (`MOBDEF.el`) : il sert désormais dans les deux sens.
- **Arme** : chaque arme a un élément ou aucun, donné par le catalogue (`ITEMS[].el`), donc sans toucher aux sauvegardes.
  Les objets actuels le reçoivent d'après leur nom (braise = Feu, givre / glace = Eau, saule / souche = Bois,
  quartz / cristal = Lumière, ombres / nuit = Ténèbres) ; les autres restent neutres.
- **Techniques du bâton** : Boule de feu = Feu, Nova de givre = Eau, Soin lumineux = Lumière ; le Trait d'Éther prend l'élément du bâton.
- **Armure** : chaque pièce d'un élément réduit de 5 % les dégâts de cet élément.
- **Bonus d'ensemble** : 3 pièces du même élément = +10 % de dégâts de cet élément ; 5 pièces = en plus une aura colorée.
- **Lisibilité** : icône d'élément sur les objets et à côté du nom des monstres, chiffres colorés, « Efficace ! » / « Résiste… ».

## Choix d'Archibald (série 3) et code

- Faiblesses +30 % / −20 % ; protection de 5 % par pièce ; ensemble : 3 pièces +10 %, 5 pièces aura ; objets actuels d'après leur nom ;
  « Efficace ! » / « Résiste… » en combat.
- **Arme** : élément fixé par l'arme, **et modifiable chez Bran** (« Enchanter : Feu »…, 4 quartz + 2 bois, cueillette nv 4).
  L'enchantement est rangé dans l'objet lui-même : `[numéro, rareté, élément]` (numéro dans `EL_ORDER`), compatible avec les anciennes sauvegardes.
- **Bâton** : tous les sorts prennent l'élément du bâton (pas d'élément propre aux sorts).
- Le bonus d'ensemble (+10 %) s'applique quand l'arme est du même élément que l'ensemble.
- Code : `EL_ORDER`, `BEATS`, `ITEM_EL`, recettes `ench_*` dans `content.js` ; `instEl`, `elK`, `computeStats` (`el`, `res`, `setEl`, `setN`),
  `hitMob` (événement `hm` avec `ef` : 1 efficace, −1 résiste), `hurt` (protection) dans `core.js` ;
  icônes `elIcons` (`assets.js`), retours en combat (`net.js`), aura (`render.js`), fiches et statistiques (`input.js`).
