# Pixels Worlds — vers des graphismes plus adultes

Statut : **maquette, à valider** (formulaire, série 4).

Point de départ : une vidéo envoyée par Archibald. Une scène 3D de nuit, dessinée en caractères de texte (glyphes), sous la
pluie, avec des néons rouges et verts. Le décor est la Corée de l'époque Joseon (un dokkaebi coiffé d'un chapeau gat), et
les silhouettes sont réalistes.

![Directions](img/v13-direction-adulte.png)

La même scène du Bourg, traitée de quatre façons à partir d'une vraie capture du jeu :

- **A · Actuel** : aquarelle pastel, personnages chibi.
- **B · Nuit adulte** : pixel art désaturé et sombre, lumière des lanternes, pluie.
- **C · Tout en glyphes** : chaque case de l'écran devient un caractère coloré, décor et héros compris, comme la vidéo.
- **D · Mixte** : décor en glyphes, héros et monstres en pixel art éclairés, avec une lueur autour d'eux.

Ce qu'il faudrait pour C ou D en jeu : un rendu « glyphes » calculé à chaque image sur une grille de caractères
(par exemple 6 × 10 pixels), à mesurer sur iPhone, et la règle actuelle « jamais d'effet plein écran par image » à revoir.
Des proportions plus élancées obligent à redessiner toutes les grilles de `sprites.js`.

Questions posées : direction, où l'appliquer, proportions des personnages, moment de la journée, effets, univers.
