# Pixels Worlds — progression des compétences par l'usage

Statut : **validé et codé** (rangs, plafond, interface, et les 84 effets au choix des paliers).

Choix d'Archibald : rythme lent (rang max = 1 + niveau / 5), un **choix entre deux effets** à chaque palier,
toutes les techniques démarrent au rang 1.

## Trois progressions qui s'emboîtent

| Progression | Comment elle monte | Ce qu'elle donne |
|---|---|---|
| **Niveau du héros** (XP) | quêtes, monstres | points de caractéristiques, et **le rang maximum** des compétences |
| **Maîtrise d'arme** | se battre avec une famille d'armes | **débloque** les techniques de cette famille |
| **Rang de compétence** | **utiliser** cette technique | la **rend plus forte**, avec deux paliers au choix |

## Rang d'une compétence : 1 à 10 (en jeu)

- **Expérience** à chaque utilisation utile : +1 par lancer, +1 par ennemi touché (3 au plus), +2 si elle achève un ennemi ;
  un soin compte les blessés soignés, un cri de guerre rapporte 2. Lancée dans le vide : rien.
- **Rangs** : du rang r au rang r+1, `26 × r^1,6` points (rang 2 : 26, rang 5 : ≈ 240, rang 10 : ≈ 3 500 au total),
  soit environ 1 200 utilisations utiles.
- **Plafond** : rang max = `1 + niveau / 5`. Niveau 5 → rang 2, niveau 15 → rang 4 (1er palier), niveau 35 → rang 8
  (2e palier), niveau 45 → rang 10.
- **Réserve** : au plafond, l'expérience remplit encore le rang suivant ; la technique monte dès le niveau requis.
- **Chaque rang** : +5 % de puissance (dégâts, soins, durées d'étourdissement, de ralentissement et du cri) et −2 % de recharge.
- **Blocage** progresse en bloquant : 25 % de chances au rang 1, +1 % par rang.
- **Interface** : rang et barre dans l'onglet Compétences, plafond expliqué, chiffre de rang sur les boutons (doré au rang 10),
  message à chaque montée de rang.
- **Sauvegarde** : champ `sk` (expérience par technique, ex. `staff:1`).

## Paliers au choix (en jeu)

Au rang 4 puis au rang 8, la technique propose **deux effets** ; on en choisit un dans l'onglet Compétences (le bouton
de la technique affiche « ! » tant qu'un choix attend). Le choix est définitif, mais Elya réinitialise gratuitement
tous les choix. Saignement (dagues) saigne désormais 3 s de base ; Venin = +50 % de dégâts de saignement.
Code : `MS` et les modificateurs génériques dans `core.js` (`kitOf` les applique, le lancer `ab` les exécute).

| Arme | Technique | Rang 4 : A ou B | Rang 8 : A ou B |
|---|---|---|---|
| Épée 1M | Tourbillon | **Large** : rayon +0,6 · **Tranchant** : fait saigner 3 s | **Aimant** : attire les ennemis · **Double** : frappe deux fois |
| | Taillade | **Hémorragie** : saigne 4 s · **Écrasante** : +25 % de dégâts | **Exécution** : ×2 sur une cible sous 30 % de PV · **Garde** : te protège de 20 % 3 s |
| | Charge | **Longue** : portée +2 · **Rapide** : recharge −2 s | **Onde de choc** : étourdit autour de l'impact · **Élan** : +30 % de vitesse 3 s |
| | Cri de guerre | **Prolongé** : +3 s · **Rageur** : +15 % de dégâts en plus | **Bannière** : profite aux alliés · **Second souffle** : rend 15 % des PV |
| Deux mains | Moulinet | **Large** : rayon +0,6 · **Lourd** : +25 % de dégâts | **Tornade** : deux tours · **Repousser** : écarte les ennemis |
| | Fendoir | **Traversant** : touche l'ennemi derrière · **Brutal** : +25 % de dégâts | **Bourreau** : recharge rendue à moitié si la cible meurt · **Fracas** : étourdit 1 s |
| | Brise-garde | **Long** : étourdit 3 s · **Vulnérable** : +20 % de dégâts subis pendant l'étourdissement | **Zone** : étourdit les voisins · **Rapide** : recharge −3 s |
| | Cri de guerre | (comme l'épée) | (comme l'épée) |
| Dagues | Saignement | **Profond** : +2 s · **Venin** : ralentit aussi | **Contagion** : se propage à un voisin · **Saignée** : te soigne de 30 % des dégâts |
| | Pas de l'ombre | **Vif** : recharge −2 s · **Long** : portée +2 | **Disparition** : les monstres perdent ta trace 2 s · **Embuscade** : critique garanti |
| | Danse des lames | **Large** : rayon +0,5 · **Affûtée** : +25 % de dégâts | **Tempo** : −0,5 s de recharge par ennemi touché · **Esquive** : −30 % de dégâts subis 2 s |
| | Coup dans le dos | **Précis** : +20 % de critique · **Perforant** : +25 % de dégâts | **Enchaînement** : recharge Pas de l'ombre si la cible meurt · **Marque** : la cible subit +15 % 4 s |
| Arc | Volée | **Nourrie** : 2 flèches de plus · **Large** : rayon +0,5 | **Glu** : ralentit · **Feu** : enflamme 2 s |
| | Flèche perçante | **Transperçante** : traverse 2 ennemis · **Lourde** : +25 % de dégâts | **Entrave** : ralentissement −70 % · **Recul** : repousse la cible |
| | Pluie d'Éther | **Double** : frappe deux fois · **Large** : rayon +0,6 | **Bénie** : soigne les alliés dans la zone · **Orage** : étourdit 0,5 s |
| Bâton / grimoire | Nova de givre | **Large** : rayon +0,5 · **Mordante** : +25 % de dégâts | **Glaciale** : gel +1 s · **Éclats** : les gelés touchés subissent +20 % |
| | Boule de feu | **Brasier** : laisse un feu au sol 3 s · **Comète** : rayon +0,6 | **Rebond** : touche une 2e cible · **Combustion** : enflamme 4 s |
| | Soin lumineux | **Clarté** : rend aussi du mana · **Ample** : portée de soin des alliés +2 | **Égide** : bouclier de 15 % des PV · **Renouveau** : soigne encore 4 s |
| Lance | Balayage | **Repousser** : écarte les ennemis · **Large** : rayon +0,6 | **Faucheuse** : +30 % de dégâts aux ennemis ralentis · **Riposte** : −20 % de dégâts subis 3 s |
| | Saut | **Long** : portée +2 · **Vif** : recharge −2 s | **Impact** : zone de 2 cases · **Écrasant** : étourdit 2 s |
| | Empalement | **Traversant** : traverse 2 ennemis · **Profond** : +25 % de dégâts | **Clouer** : étourdit 1 s · **Hémorragie** : saigne 4 s |

## Étapes

1. ~~Rangs, expérience, plafond, bonus par rang, interface~~ (fait).
2. ~~Paliers au choix~~ (fait).
3. Effet visuel du rang 10 (plus grand, doré).
