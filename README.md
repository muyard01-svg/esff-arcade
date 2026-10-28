# Arcade 101 — la borne d'arcade de la promo ESFF 2027

Une borne d'arcade en ligne : on choisit son jeu dans le menu de l'écran, on joue, et on gagne des **tickets à gratter**. Chaque ticket a **1 chance sur 5** de révéler un code **-10 %** à utiliser sur [esff2027.shop](https://www.esff2027.shop).

## Lancer en local

```bash
python -m pip install -r requirements.txt
python server.py
```

Puis ouvrir http://localhost:8090.

## Avant la mise en ligne : le code promo

1. Créer dans la boutique Zyro le code de réduction **-10 %** (respecter minuscules et symboles).
2. Pour en changer plus tard, passer le nouveau code au serveur par une variable d'environnement :

| Variable | Rôle | Défaut |
|---|---|---|
| `ESFF_PROMO_CODE` | Code révélé par les tickets gagnants (en local : fichier `promo_code.txt`, jamais publié) | aucun |
| `ESFF_WIN_RATE` | Probabilité de gain d'un ticket | `0.20` |
| `PORT` | Port HTTP | `8090` |
| `ESFF_DB` | Fichier SQLite (tickets, pseudos, scores) | `arcade.db` |

Le code n'est jamais envoyé au navigateur avant qu'un ticket gagnant ne soit gratté. Le tirage se fait sur le serveur.

## Générique

À l'arrivée sur le site, un générique animé d'environ 14 secondes se lance, avec une musique chiptune : coulée de fonte, titre ARCADE 101 en métal en fusion, montage des jeux, logo ESFF, puis INSERT COIN. Il passe une fois par session (pas pour un lien d'invitation à un salon). On peut le passer (bouton, Échap, Entrée ou Espace) et le revoir depuis le pied de page. Le son démarre au premier clic, car les navigateurs bloquent le son automatique. Tout est dans `public/intro.js`.

## Les jeux

| Jeu | Type | Ticket | Max / jour |
|---|---|---|---|
| **Coulée Royale** | FPS battle royale des métiers de la métallurgie, jusqu'à 16 (robots en renfort), 1re ou 3e personne | finir = 1, gagner = 2 | 2 |
| **Poing de Fonte 3D** | Combat 3D façon Tekken 2, 1 contre 1 en ligne ou contre l'ordi | finir = 1, gagner = 2 | 2 |
| **Forge Fighters** | Combat 2D 1 contre 1, en ligne ou contre l'ordi | finir = 1, gagner = 2 | 2 |
| **Escadrille 101** | Combat d'avions, 4 à 8 pilotes (robots en renfort) | finir = 1, gagner = 2 | 2 |
| Grand Prix de la Coulée | Kart 3D façon « party kart », 2 à 8 pilotes (robots en renfort) | franchir l'arrivée = 1, gagner = 2 | 2 |
| Forgeopoly | Plateau aux règles complètes du « monopole », 2 à 4 joueurs | finir = 1, gagner = 2 | 2 |
| **Coulée Galactique** | Shooter 3D façon Galaga (3e / 1re personne, bonus de tir) | 20 000 points | 1 |
| **Usine 101** | Gestion d'une forge ou d'une fonderie | tenir 5 ans sans faillite | 1 |
| Quiz métallurgie | Solo | 7/10 bonnes réponses | 1 |
| **L'Atelier de Coulée** | Coopération en ligne 3D, 1 à 4 ouvriers (apprentis robots en renfort) | finir = 1, objectif d'équipe atteint = 2 | 2 |
| Le Moulage 3D | Solo, 3D : moule, noyaux, masselottes, coulée, défauts | 2 100 points | 1 |
| La Coulée | Solo, moules de formes différentes | 350 points | 1 |
| Frappe d'enclume | Solo | 250 points | 1 |
| Tri des teintes | Solo | 350 points | 1 |
| La Poche | Solo | 400 points | 1 |

Ces limites se règlent en haut de `server.py` (`DAILY`, `SOLO_THRESHOLDS`, `QUIZ_PASS`, `IP_DAILY_CAP`).

### Coulée Royale

FPS battle royale en 3D sur **quatre cartes** au choix dans le salon (ou au hasard) : la **Halle de coulée** (fours, convoyeurs, moules, conteneurs), **La Forge** (îlots de marteaux-pilons, foyers, enclumes, cuves de trempe), **Le Laminoir** (longue halle traversée par le train de laminage, bobines, brames) et le **Parc à ferraille** (à ciel ouvert : tas de ferraille, cubes compactés, grues, bennes). Chacun arrive à mains nues avec **100 PV**. La fonte en fusion envahit la carte en 5 phases ; le dernier debout gagne.

- Les armes sont rangées dans des **coffres** (lueur dorée) : **E** ouvre le coffre, qui éjecte deux armes ; **E** ramasse l'arme la plus proche (ou l'échange contre celle en main) ; **G** lâche l'arme qu'on tient. Les coffres posés sur les toits donnent plus souvent des armes rares.

- Vue **1re personne** (arme en main) ou **3e personne** par-dessus l'épaule, à changer avec **V** (effet d'ondulation). Souris capturée pour viser (haut et bas), joysticks et boutons tactiles sur téléphone.
- Personnages **articulés** (squelette animé : course, saut, visée, coups, recul, chute) et **vraie physique** : accélération, inertie, sprint (Maj), saut (Espace) et gravité, marches et toits d'obstacles.
- Chaque navigateur prédit son propre déplacement ; le serveur vérifie qu'il est atteignable (vitesse, murs, hauteur de saut) et recale sinon. Les tirs (projectiles 3D) sont tranchés par le serveur : **tir à la tête ×1,5**, et chaque élimination rend **25 PV**.

- **9 métiers**, chacun avec un petit avantage : forgeron (+15 % en mêlée), fondeur (-40 % de dégâts dans la fonte), mouleur (+8 % de vitesse), noyauteur (saute 20 % plus haut), ébarbeur (cadence +12 %), lamineur (35 d'armure au départ, qui absorbe 60 % des coups), chaudronnier (-12 % de dégâts reçus), soudeur (+20 % au chalumeau et à la louche), métallurgiste (voit les armes rares sur la mini-carte).
- **8 armes de la métallurgie** : pince de forgeron, marteau de forge, masse à frapper, ringard (mêlée) ; riveteuse, canon à grenaille, louche de fonte (éclaboussure), chalumeau (à distance).
- **4 raretés** qui multiplient les dégâts : commun ×1 (gris), rare ×1,2 (bleu), épique ×1,45 (violet), légendaire ×1,8 (or).
- **Largage** : tout le monde part accroché au **pont roulant** qui traverse la halle. **Espace** pour sauter quand on veut (largage automatique en bout de course), puis on plane sous une couverture aluminisée en choisissant où atterrir.

## Grand écran et transitions

Chaque jeu se lance avec une animation où l'on « plonge » dans l'écran de la borne, avec des ondulations. Le bouton **⛶** (ou la touche **F**) passe n'importe quel jeu en grand écran, avec la même ondulation à chaque changement de vue.

### Poing de Fonte 3D

Combat en vraie 3D (three.js) sur les règles de Tekken 2 : quatre boutons de membres, coups hauts / moyens / bas, pas de côté, coups qui suivent, projections et jongles. Six combattants : Marius, Brigitte, Sacha, Nina, Yanis le Lamineur (projection imparable) et Léa la Chaudronnière (rafales de pieds). Le jeu ne reprend aucun personnage, nom ou décor de Tekken, seulement la façon de jouer.

| Action | Clavier | Mobile |
|---|---|---|
| Reculer / avancer (double appui = dash) | ← → | ◀ ▶ |
| Pas de côté (appui bref) · saut / accroupi (maintenu) | ↑ ↓ | ▲ ▼ |
| Poing gauche · poing droit · pied gauche · pied droit | U · I · J · K | 1 · 2 · 3 · 4 |
| Garde | rester immobile (debout : hauts et moyens ; accroupi : bas) | |
| Uppercut qui lance un jongle | ↓ + → + I | |
| Projection (dégagement : 1 ou 2 pendant la saisie) | U + J ou I + K | |
| Coup spécial | ← + I | |

Combos nommés (un coup qui touche peut s'enchaîner tout de suite, + 4 dégâts quand le combo passe) : Martelage (1, 2, → + 3), Coulée continue (1, 2, ↓ + 3, 4), Fauchage (↓ + 3, 4), Enclume (→ + 3, 1), Trempe aérienne (↓↘ + 2, puis deux coups en l'air) et la signature de chaque personnage (1, 2, puis le spécial ; Lamineur : 1, 2, → + 4). Le bouton **📖 Guide des combos** (sur l'écran de la borne avant de lancer, dans le salon, ou la touche **G** en combat) les montre en animation.

**Attaque ultime** : la jauge d'énergie se remplit en frappant et en encaissant. Pleine, **L** (mobile : ULTI) lance une ruée imparable : une ouverture façon anime (bandeau en diagonale, « 奥義 », nom de la technique) puis, **si le coup touche**, une cinématique de 4 s en quatre plans (impact en noir et blanc, envol sous les lignes de vitesse, gros plan pendant la charge, coup final propre au personnage) et 42 dégâts. Esquivée, l'attaquant reste vulnérable. Ultimes : Coulée Éternelle, Marteau-Pilon Divin, Tempête du Désert Noir, Disque Fulgurant, Laminoir Infernal, Mille Rivets.

### Coulée Galactique

Shooter inspiré de la formule de Galaga, en 3D : vagues qui se mettent en formation, piqués, rayon tracteur du Grand Creuset (abats-le pendant un piqué pour récupérer ton vaisseau et piloter en double), étape bonus toutes les 4 étapes. Trois vues, changeables en pleine partie avec **V** : 3e personne (par défaut), 1re personne (cockpit) et vue arcade (de dessus, comme l'original).

Bonus de tir lâchés par les ennemis abattus (surtout les Grands Creusets) :

| Bonus | Effet |
|---|---|
| Double | deux tirs parallèles (15 s) |
| Éventail | trois tirs en éventail (12 s) |
| Laser | tir perçant qui traverse les ennemis (10 s) |
| Rafale | tir rapide, jusqu'à 6 tirs à l'écran (15 s) |
| Bouclier | encaisse un coup |
| Bombe | détruit les ennemis en vol et endommage la formation |

### L'Atelier de Coulée (coopération)

Toute l'équipe (1 à 4 joueurs en ligne, chacun avec son ouvrier animé) travaille dans la même fonderie en 3D pour honorer des commandes de pièces (roue = 1 noyau, carter = 2, bloc = 3) en 4 minutes. Objectif d'équipe : 300 points (2 tickets pour tout le monde).

- **Moulage** : apporter 2 seaux de sable au châssis, le tasser (Espace maintenu ; deux fois plus vite à deux), poser les noyaux, fermer le moule.
- **Pont roulant** : un ouvrier prend les commandes au **pupitre** (E, puis flèches), un autre accroche et décroche (E) le moule ou la poche quand le crochet est au-dessus.
- **Cubilot** : le charger en gueuses de fonte, coke et castine (1 coke pour 2 gueuses, 1 castine pour 4), lancer la **soufflerie**, percer au **trou de coulée** pour remplir la poche.
- **Dosage métallurgique** : inoculer la poche au ferrosilicium (½ par unité de fonte) ; la poche refroidit, il faut couler au-dessus de 1330 °C.
- **Coulée, refroidissement, décochage** sur la grille, puis **expédition**. Chaque pièce est notée : conforme, à retoucher ou rebut (malvenue, reprise, fonte blanche, surinoculation, inclusions de laitier, fonte trop carburée).
- Seul, un apprenti robot tient le cubilot ; avec un deuxième robot, un apprenti mouleur apporte le sable et tasse.

### Le Moulage 3D

Jeu solo en 3D : on fabrique trois pièces de plus en plus complexes (roue de wagonnet en fonte, carter de pompe en aluminium, bloc-cylindres en fonte). Pour chacune :

1. **Serrage du sable** : arrêter le curseur dans la zone verte (trop peu serré = gale, trop serré = soufflures).
2. **Noyaux** : choisir le bon noyau dans le bac (des intrus s'y glissent), le tourner avec **R** et le poser dans sa portée.
3. **Évents** : percer chaque noyau pour que ses gaz s'échappent (sinon soufflures de noyau).
4. **Masselottes** : en poser au-dessus des points chauds (sinon retassure), sans en mettre partout (chacune coûte du métal).
5. **Température** : surchauffe adaptée à l'alliage (trop froid = malvenue ou reprise, trop chaud = pénétration).
6. **Coulée** : maintenir pour verser en gardant le débit dans le vert (trop fort = inclusions d'oxydes, interruption = reprise), relâcher quand c'est plein (sinon bavures).
7. **Décochage et contrôle** : la chape se soulève, la pièce refroidit, chaque défaut est montré sur la pièce et expliqué ; pièce conforme, à retoucher ou rebut.

100 points par pièce (moins 45 par défaut critique, 15 par défaut mineur), ×10. Ticket à 2 100 points.

### Usine 101

Inspiré de *1 sur 8 milliards* : tu choisis seulement « forge » ou « fonderie ». Le pays et la ville sont tirés au sort en proportion de la production mondiale réelle (la Chine pèse environ la moitié des pièces de fonderie du monde). Le capital, l'effectif et la capacité sont tirés eux aussi. Le temps défile tout seul (6 s = 1 mois, accéléré jusqu'à x4) et des événements tombent : flambée de l'énergie, crise automobile, grève, norme environnementale, contrôle fiscal… La partie se termine par une faillite, une vente ou la retraite (67 ans ou 30 ans de gestion). Le score est la valeur créée pendant ta gestion.

Les chiffres (prix de vente, coût du travail, électricité, gaz, impôt sur les sociétés, taux d'emprunt, formalités, nombre de concurrents) sont dans `public/usine-data.js`, avec leurs sources. Les valeurs françaises viennent directement de la Fédération Forge Fonderie ; les autres sont estimées à partir des sources citées et calées pour qu'une entreprise démarre avec une marge d'exploitation réaliste (environ 8 à 11 %). L'écran « Sources » du jeu les liste.

### Forgeopoly

Les règles officielles du jeu de plateau classique, sur un plateau de 40 cases aux couleurs de l'école (le nom, les rues et les graphismes du jeu de Hasbro ne sont pas repris) :
- 22 terrains en 8 groupes, 4 navettes (gares), 2 réseaux (compagnies), 16 cartes Coulée surprise (Chance) et 16 cartes Caisse de la promo (Caisse de communauté), impôts, parc gratuit ;
- doubles qui font rejouer, 3 doubles = retouche (prison), sortie en payant 50, avec une carte ou en faisant un double ;
- loyer doublé sur un groupe complet, maisons et hôtels avec construction équilibrée, stock limité (32 maisons, 12 hôtels) ;
- hypothèques (levée à +10 %), enchères quand personne n'achète, échanges entre joueurs (terrains et lingots), faillite au profit du créancier ;
- fin de partie quand il ne reste qu'un joueur, ou au bout de 30 tours (le plus riche gagne).

Plateau **en relief 3D** (three.js, par défaut) : plateau épais avec bandes de couleur en relief, ateliers et usines (maisons et hôtels) en volume, lingots aux couleurs des propriétaires, pions sculptés (louche, marteau, creuset, enclume) qui sautent de case en case, dés qui roulent, ombres. Glisser pour tourner autour, molette pour zoomer, **V** ou le bouton « Plateau 2D / 3D » pour revenir au plateau à plat. Cartes qui se retournent, montants qui s'envolent. Clique sur une case pour voir sa fiche, construire ou hypothéquer.

### Forge Fighters

Quatre combattants : Marius le Fondeur (projectile de fonte), Brigitte la Forgeronne (marteau-pilon), Sacha le Mouleur (tempête de sable) et Nina l'Ébarbeuse (ruée à la meuleuse). Le premier à 2 manches gagne. Un coup spécial coûte de la « chaleur », qui monte quand on frappe ou qu'on encaisse.

| Action | Clavier | Mobile |
|---|---|---|
| Bouger / sauter / s'accroupir | flèches (ou ZQSD / WASD) | ◀ ▲ ▼ ▶ |
| Poing · pied · spécial | J · K · L | POING · PIED · SPÉ |
| Garde | reculer (accroupi pour les coups bas) | ◀ ou ▶ à l'opposé de l'adversaire |

↓ + poing = uppercut qui projette l'adversaire, ↓ + pied = balayette. Un coup qui touche peut s'annuler dans le suivant ; combos nommés : Martelage (J, J, K), Forge infernale (J, J, K, ↓ + K), Fauchage (↓ + K, ↓ + J), Coup de trempe (J, ↓ + J) et la signature de chaque personnage (J, K, L). Guide animé avec **📖 Guide des combos** (aussi avant de lancer la partie) ou **G**. La jauge d'énergie sert aux spéciaux (un tiers) et, pleine, à l'**attaque ultime** avec **I** (mobile : ULTI) : même mise en scène façon anime que dans Poing de Fonte 3D, 30 dégâts si elle touche.

### Grand Prix de la Coulée

Course de karts en 3D façon « party kart » avec les six persos de la métallurgie (Marius, Brigitte, Sacha, Nina, Yanis, Léa), chacun avec sa vitesse et son adhérence. Deux circuits : **Circuit de la Coulée** (autour de la fonderie) et **Boucle du Laminoir** (plus long, épingles serrées). 3 tours, robots en renfort jusqu'à 6 pilotes.

- Vue **3e personne** derrière le kart ou **1re personne** au volant (**V**), **C** pour regarder derrière.
- **Dérapage** : Maj ou Espace en tournant, puis relâcher pour un mini-turbo (bleu puis orange selon la durée). Le hors-piste (sable de moulage) freine, les murets font rebondir.
- **Caisses à outils** sur la piste, avec des objets de la métallurgie (les derniers reçoivent les plus puissants) : lingot d'acier et flaque d'huile de trempe (posés derrière soi), boulet de fonte (tiré tout droit), poche de fonte guidée (file vers le kart devant), bouteille d'oxygène (turbo), tablier aluminisé (invincible et plus rapide), coupure de courant (ralentit tous les autres). **E** ou clic pour l'utiliser.
- Mon kart est piloté dans le navigateur ; le serveur vérifie les positions, gère les objets, les collisions, le classement et les arrivées.

### Escadrille 101

Chacun pour soi pendant 3 minutes, ou jusqu'à 15 avions abattus. On réapparaît 3 secondes après avoir été abattu, protégé par un bouclier pendant 2 secondes. Flèches pour piloter, Espace pour tirer.

## Classement

Chaque joueur choisit un pseudo à sa première visite. Le menu « Classement » affiche les 10 meilleurs scores de chaque jeu solo et le nombre de victoires dans chaque jeu en ligne. Les scores solo sont envoyés par le navigateur ; un joueur malin peut donc tricher sur le classement, mais pas sur le code promo.

## Hébergement

Il faut un hébergeur capable de faire tourner Python et les WebSockets, par exemple Render, Railway, Fly.io ou un petit VPS. La commande de démarrage est `python server.py`, et le port est lu dans `PORT`. Garder le fichier `arcade.db` sur un disque persistant, sinon tickets, pseudos et scores sont perdus à chaque redémarrage. Les jeux en ligne tournent sur le serveur à 30 images/s : choisir un hébergement proche (Europe) pour une bonne réactivité.

## Fichiers

- `server.py` : API (tickets, pseudos, classement, quiz) et salons en ligne
- `royale.py` : moteur du battle royale (carte 3D, physique, vérification des déplacements, armes, raretés, fonte, robots)
- `tekken.py` : moteur du combat 3D (déplacements en 3D, hauteurs de coups, projections, jongles, robot)
- `fighter.py` : moteur du jeu de combat 2D (coups, gardes, manches, robot)
- `combos.py` : combos nommés des deux jeux de combat
- `planes.py` : moteur du combat d'avions
- `forgeopoly.py` : règles complètes du jeu de plateau (et robots qui achètent, construisent et négocient)
- `kart.py` : Grand Prix en karts (circuits, objets, robots, classement)
- `atelier.py` : l'Atelier de Coulée en coopération (postes, pont roulant, cubilot, dosage, apprentis robots)
- `quiz_data.py` : questions du quiz (la première réponse de chaque liste est la bonne)
- `public/` : la borne
  - `index.html`, `style.css` : la borne et son écran
  - `intro.js` : générique d'ouverture
  - `cabinet.js` : menu de sélection, pupitre, pseudo, classement
  - `app.js` : jeux solo, quiz, tickets à gratter
  - `online.js` : salons et résultats ; `kart.js` : le Grand Prix en karts 3D
  - `forgeo.js` : plateau animé de Forgeopoly ; `forgeo3d.js` : le même plateau en relief 3D
  - `combos.js` : guide des combos animé et annonce des combos réussis
  - `royale.js` : Coulée Royale en FPS / TPS (squelettes animés, arme en main, prédiction des déplacements)
  - `fx.js` : grand écran et transitions à ondulations
  - `tekken3d.js` : arène et personnages 3D (three.js chargé à la demande)
  - `fighter.js`, `planes.js` : combat 2D et avions
  - `galaxie.js` : Coulée Galactique (3D)
  - `usine.js`, `usine-data.js` : Usine 101 et ses données réelles
