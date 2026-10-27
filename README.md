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
| **Poing de Fonte 3D** | Combat 3D façon Tekken 2, 1 contre 1 en ligne ou contre l'ordi | finir = 1, gagner = 2 | 2 |
| **Forge Fighters** | Combat 2D 1 contre 1, en ligne ou contre l'ordi | finir = 1, gagner = 2 | 2 |
| **Escadrille 101** | Combat d'avions, 4 à 8 pilotes (robots en renfort) | finir = 1, gagner = 2 | 2 |
| Grand Prix de la Coulée | Course, 2 à 6 pilotes | franchir l'arrivée = 1, gagner = 2 | 2 |
| Forgeopoly | Plateau aux règles complètes du « monopole », 2 à 4 joueurs | finir = 1, gagner = 2 | 2 |
| **Coulée Galactique** | Shooter 3D façon Galaga (3e / 1re personne, bonus de tir) | 20 000 points | 1 |
| **Usine 101** | Gestion d'une forge ou d'une fonderie | tenir 5 ans sans faillite | 1 |
| Quiz métallurgie | Solo | 7/10 bonnes réponses | 1 |
| La Coulée | Solo | 350 points | 1 |
| Frappe d'enclume | Solo | 250 points | 1 |
| Tri des teintes | Solo | 350 points | 1 |
| La Poche | Solo | 400 points | 1 |

Ces limites se règlent en haut de `server.py` (`DAILY`, `SOLO_THRESHOLDS`, `QUIZ_PASS`, `IP_DAILY_CAP`).

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

Animations : dés en 3D, pions (louche, marteau, creuset, enclume) qui avancent case par case, cartes qui se retournent, montants qui s'envolent, maisons et hôtels qui poussent. Clique sur une case pour voir sa fiche, construire ou hypothéquer.

### Forge Fighters

Quatre combattants : Marius le Fondeur (projectile de fonte), Brigitte la Forgeronne (marteau-pilon), Sacha le Mouleur (tempête de sable) et Nina l'Ébarbeuse (ruée à la meuleuse). Le premier à 2 manches gagne. Un coup spécial coûte de la « chaleur », qui monte quand on frappe ou qu'on encaisse.

| Action | Clavier | Mobile |
|---|---|---|
| Bouger / sauter / s'accroupir | flèches (ou ZQSD / WASD) | ◀ ▲ ▼ ▶ |
| Poing · pied · spécial | J · K · L | POING · PIED · SPÉ |
| Garde | reculer (accroupi pour les coups bas) | ◀ ou ▶ à l'opposé de l'adversaire |

Il y a aussi des combos simples : ↓ + poing = uppercut qui projette l'adversaire, ↓ + pied = balayette.

### Escadrille 101

Chacun pour soi pendant 3 minutes, ou jusqu'à 15 avions abattus. On réapparaît 3 secondes après avoir été abattu, protégé par un bouclier pendant 2 secondes. Flèches pour piloter, Espace pour tirer.

## Classement

Chaque joueur choisit un pseudo à sa première visite. Le menu « Classement » affiche les 10 meilleurs scores de chaque jeu solo et le nombre de victoires dans chaque jeu en ligne. Les scores solo sont envoyés par le navigateur ; un joueur malin peut donc tricher sur le classement, mais pas sur le code promo.

## Hébergement

Il faut un hébergeur capable de faire tourner Python et les WebSockets, par exemple Render, Railway, Fly.io ou un petit VPS. La commande de démarrage est `python server.py`, et le port est lu dans `PORT`. Garder le fichier `arcade.db` sur un disque persistant, sinon tickets, pseudos et scores sont perdus à chaque redémarrage. Les jeux en ligne tournent sur le serveur à 30 images/s : choisir un hébergement proche (Europe) pour une bonne réactivité.

## Fichiers

- `server.py` : API (tickets, pseudos, classement, quiz) et salons en ligne
- `tekken.py` : moteur du combat 3D (déplacements en 3D, hauteurs de coups, projections, jongles, robot)
- `fighter.py` : moteur du jeu de combat 2D (coups, gardes, manches, robot)
- `planes.py` : moteur du combat d'avions
- `forgeopoly.py` : règles complètes du jeu de plateau (et robots qui achètent, construisent et négocient)
- `race.py` : circuit, robots et arrivées de la course
- `quiz_data.py` : questions du quiz (la première réponse de chaque liste est la bonne)
- `public/` : la borne
  - `index.html`, `style.css` : la borne et son écran
  - `intro.js` : générique d'ouverture
  - `cabinet.js` : menu de sélection, pupitre, pseudo, classement
  - `app.js` : jeux solo, quiz, tickets à gratter
  - `online.js` : salons et Grand Prix
  - `forgeo.js` : plateau animé de Forgeopoly
  - `tekken3d.js` : arène et personnages 3D (three.js chargé à la demande)
  - `fighter.js`, `planes.js` : combat 2D et avions
  - `galaxie.js` : Coulée Galactique (3D)
  - `usine.js`, `usine-data.js` : Usine 101 et ses données réelles
