# Pixels Worlds — progression des compétences par l'usage

Statut : **proposition, en attente de validation**. Rien n'est codé.

Objectif : chaque technique (Tourbillon, Boule de feu, Volée…) progresse **en s'en servant**, lentement, et ce progrès
reste **tenu en laisse par le niveau du héros** : on ne peut pas « farmer » une compétence jusqu'au maximum dès le début.

## Trois progressions qui s'emboîtent

| Progression | Comment elle monte | Ce qu'elle donne |
|---|---|---|
| **Niveau du héros** (XP) | quêtes, monstres | points de caractéristiques, et **le rang maximum** des compétences |
| **Maîtrise d'arme** (déjà en jeu) | se battre avec une famille d'armes | **débloque** les techniques de cette famille |
| **Rang de compétence** (nouveau) | **utiliser** cette technique | la **rend plus forte**, avec deux paliers qui la transforment |

## Rang d'une compétence : 1 à 10

- **Expérience de compétence** à chaque utilisation : +1 par lancer, +1 par ennemi touché (3 au plus), +2 si elle achève un ennemi
  (un soin compte les alliés soignés). Une technique lancée dans le vide ne rapporte rien.
- **Rangs** : du rang r au rang r+1, il faut `20 × r^1,6` points (rang 2 : 20, rang 5 : ≈ 180, rang 10 : ≈ 2 700 au total),
  soit environ 900 utilisations utiles pour le rang 10.
- **Plafond lié au niveau** : rang maximum = `1 + niveau / 4` (arrondi en dessous).
  Niveau 4 → rang 2, niveau 8 → rang 3, niveau 12 → rang 4 (premier palier), niveau 28 → rang 8 (deuxième palier), niveau 36 → rang 10.
- **Réserve** : au plafond, l'expérience continue de s'accumuler jusqu'à remplir le rang suivant ; dès que le héros prend
  le niveau qui le permet, la compétence monte aussitôt (« prête à monter »).
- **Effet de chaque rang** : +5 % de puissance (dégâts, soin, durée d'étourdissement) et −2 % de temps de recharge.
  Au rang 10 : +45 % de puissance, −18 % de recharge.
- **Rang 10** : icône à cadre doré et effet visuel plus grand.

## Paliers : rangs 4 et 8

Chaque technique gagne un effet supplémentaire au rang 4 et au rang 8.

| Arme | Technique | Rang 4 | Rang 8 |
|---|---|---|---|
| Épée à une main | Tourbillon | rayon +0,6 | attire les ennemis vers toi |
| | Taillade | fait saigner 3 s | coup critique garanti sur une cible ralentie ou étourdie |
| | Charge | portée +2 | étourdit aussi les ennemis autour de l'impact |
| | Cri de guerre | durée +3 s | profite aussi aux alliés proches |
| Deux mains | Moulinet | rayon +0,6 | frappe deux fois |
| | Fendoir | touche aussi l'ennemi juste derrière | si la cible meurt, la moitié de la recharge est rendue |
| | Brise-garde | étourdit 3 s | la cible étourdie subit +20 % de dégâts |
| | Cri de guerre | durée +3 s | profite aussi aux alliés proches |
| Dagues | Saignement | dure 2 s de plus | se propage à un ennemi voisin |
| | Pas de l'ombre | recharge −2 s | les monstres perdent ta trace 2 s |
| | Danse des lames | rayon +0,5 | chaque ennemi touché réduit la recharge de 0,5 s |
| | Coup dans le dos | +20 % de critique | recharge Pas de l'ombre si la cible meurt |
| Arc | Volée | 2 flèches de plus, rayon +0,5 | ralentit les ennemis touchés |
| | Flèche perçante | traverse 2 ennemis alignés | ralentissement plus fort (−70 %) |
| | Pluie d'Éther | frappe deux fois | soigne les alliés dans la zone |
| Bâton / grimoire | Nova de givre | rayon +0,5 | gel prolongé d'1 s |
| | Boule de feu | laisse un brasier 3 s | rebondit sur une deuxième cible |
| | Soin lumineux | rend aussi du mana | bouclier qui absorbe 15 % des PV |
| Lance | Balayage | repousse les ennemis | rayon +0,8 |
| | Saut | portée +2 | zone d'impact de 2 cases |
| | Empalement | traverse 2 ennemis | étourdit 1 s |

**Capacités passives** : le Blocage progresse aussi en bloquant (25 % de chances au rang 1, +1 % par rang, 34 % au rang 10).

## Interface

- **Onglet Compétences** : pour chaque technique, « Rang 3 / 10 », une barre d'expérience, le plafond actuel
  (« Rang max 3 — rang 4 au niveau 12 ») et le prochain palier.
- **Boutons d'action** : un petit chiffre de rang dans le coin ; un liseré doré au rang 10.
- **Montée de rang** : message (« Boule de feu passe au rang 4 : elle laisse un brasier ! ») et éclat lumineux.

## Sauvegarde

- Nouveau champ `sk` : expérience de chaque technique, par arme et par technique (ex. `staff:1`). Valeur par défaut : vide.
- Toutes les techniques déjà débloquées démarrent au rang 1.

## Étapes après validation

1. Expérience et rangs, bonus par rang, plafond par niveau, interface (onglet, boutons, messages).
2. Paliers des rangs 4 et 8, famille par famille (en commençant par le bâton / grimoire d'Archi404).
3. Blocage et effets visuels du rang 10.
