"""Forge Tactique : auto-battler à 8 sur les métiers de la métallurgie (robots en renfort).

On recrute des métiers, on les place sur l'atelier, puis les équipes s'affrontent seules. 3 exemplaires identiques
fusionnent en une étoile de plus. Chaque unité appartient à 2 ou 3 familles (son corps de métier et ses spécialités),
qui donnent des synergies. Certaines manches opposent chacun à des monstres qui laissent du butin : on choisit
un objet parmi trois et on l'équipe sur une unité. Chaque corps de métier attaque à sa façon.
La rareté suit la difficulté de recrutement et la spécialisation du métier : ce n'est ni un classement officiel
ni un jugement sur la valeur des métiers. Chaque combat est calculé d'un coup puis rejoué par les navigateurs."""
from __future__ import annotations
import math
import random

COLS, ROWS = 7, 4
BENCH = 9
SHOP = 5
PREP = 32.0
START_HP = 100
MAX_ROUNDS = 40
TICK = 0.1
FIGHT_MAX = 28.0
FRAME_EVERY = 3            # une image de combat toutes les 0,3 s
MAX_ITEMS = 3
PVE_ROUNDS = {1, 2, 3, 8, 13, 18, 23, 28, 33, 38}
COST = [1, 2, 3, 5]
RARITY = ['Commun', 'Rare', 'Épique', 'Légendaire']
POOL = [22, 18, 12, 8]     # exemplaires de chaque unité dans la boutique commune
ODDS = {1: (100, 0, 0, 0), 2: (100, 0, 0, 0), 3: (75, 25, 0, 0), 4: (55, 35, 10, 0), 5: (45, 35, 18, 2), 6: (30, 40, 25, 5), 7: (20, 35, 35, 10), 8: (15, 25, 40, 20), 9: (10, 20, 40, 30)}
XP_NEED = {1: 2, 2: 2, 3: 6, 4: 10, 5: 20, 6: 36, 7: 56, 8: 80}

ROLES = {   # PV, attaque, armure, portée, attaques/s
    'mur': (900, 55, 40, 1, 0.65), 'lame': (680, 75, 25, 1, 0.8), 'tir': (500, 72, 15, 4, 0.75), 'arc': (480, 50, 15, 3, 0.7), 'soin': (540, 45, 20, 3, 0.7),
}
# corps de métier : id, nom, couleur, rôle, sort, synergie, attaque propre au métier
FAMILIES = [
    ('metal', 'Métallerie', '#8a8d91', 'mur', ('garde', 'Garde-corps', 'Se protège derrière un bouclier.'), ('armor', 'Armure', (20, 40, 70)), ('Coup de barre', 'Chaque coup renforce son bouclier.')),
    ('chaudro', 'Chaudronnerie', '#c87533', 'mur', ('zone', 'Coup de maillet', 'Frappe tous les ennemis proches.'), ('hp', 'PV', (15, 30, 50)), ('Maillet', 'Touche aussi les ennemis voisins.')),
    ('soudage', 'Soudage', '#5AA8FF', 'lame', ('frappe', 'Arc électrique', 'Grosse décharge sur la cible.'), ('speed', 'Vitesse d’attaque', (15, 30, 50)), ('Arc', 'Le courant saute sur un second ennemi.')),
    ('tuyau', 'Tuyauterie', '#2f8a8a', 'lame', ('garde', 'Purge haute pression', 'Se protège derrière la vapeur.'), ('regen', 'Régénération', (1.5, 3, 5)), ('Clé à tube', 'Récupère un peu de vie à chaque coup.')),
    ('usinage', 'Usinage', '#d8dde3', 'tir', ('frappe', 'Passe de finition', 'Tir de précision sur la cible.'), ('crit', 'Critique', (15, 30, 50)), ('Copeaux', 'Critique naturel plus élevé.')),
    ('fonderie', 'Fonderie et Forge', '#EC641E', 'arc', ('zone', 'Coulée en fusion', 'Métal en fusion sur une zone.'), ('burn', 'Brûlure', (4, 8, 14)), ('Jet de fonte', 'Laisse la cible brûlante.')),
    ('surface', 'Traitement de surface', '#C77DFF', 'soin', ('soin', 'Couche protectrice', 'Soigne l’allié le plus touché.'), ('shield', 'Bouclier de départ', (15, 30, 50)), ('Pistolet à peinture', 'Réduit l’armure de la cible.')),
    ('maint', 'Maintenance', '#7FD48A', 'soin', ('soin', 'Remise en état', 'Soigne l’allié le plus touché.'), ('teamregen', 'Soin d’équipe', (1, 2, 3)), ('Clé plate', 'Soigne aussi un allié blessé.')),
    ('bureau', 'Bureau d’études', '#F5B700', 'arc', ('frappe', 'Calcul de structure', 'Vise le point faible de la cible.'), ('mana', 'Énergie de départ', (30, 60, 100)), ('Plan coté', 'Gagne de l’énergie plus vite.')),
    ('qualite', 'Qualité et Contrôle', '#f2f4f7', 'tir', ('frappe', 'Contrôle ultrasons', 'Traverse l’armure de la cible.'), ('pierce', 'Perce-armure', (30, 60, 100)), ('Rayon de contrôle', 'Ignore une partie de l’armure.')),
    ('prod', 'Production', '#BA2C3A', 'lame', ('zone', 'Cadence maximale', 'Enchaîne sur les ennemis proches.'), ('gold', 'Or par manche', (1, 2, 4)), ('Cadence', 'Un coup sur trois est doublé.')),
    ('chantier', 'Chantier et Levage', '#d9a02a', 'mur', ('zone', 'Charge lourde', 'Écrase les ennemis proches.'), ('atk', 'Attaque', (15, 30, 50)), ('Crochet', 'Repousse la cible.')),
    ('recyclage', 'Recyclage', '#6a8a3a', 'lame', ('frappe', 'Broyeur', 'Mord la cible à pleines dents.'), ('avenge', 'Rage par allié perdu', (10, 20, 35)), ('Pince', 'Se soigne d’une part des dégâts.')),
    ('commerce', 'Commerce et Gestion', '#3f7fd8', 'soin', ('soin', 'Budget d’urgence', 'Soigne l’allié le plus touché.'), ('interest', 'Intérêts maximum', (1, 2, 3)), ('Facture', 'Une chance d’attaquer deux fois.')),
]
# spécialités : le deuxième et le troisième « combo » de chaque unité
SPECS = [
    ('nuc', 'Nucléaire', '#9dff3a', ('spell', 'Puissance des sorts', (20, 40, 70))), ('aero', 'Aéronautique', '#7fd4ff', ('speed', 'Vitesse d’attaque', (15, 25, 40))),
    ('naval', 'Naval', '#2b6cb0', ('hp', 'PV', (12, 22, 35))), ('hp', 'Haute pression', '#ff7a5a', ('armor', 'Armure', (15, 30, 50))),
    ('art', 'Art et Patrimoine', '#e0b0ff', ('crit', 'Critique', (15, 25, 40))), ('robot', 'Robotique', '#b8c4cc', ('mana', 'Énergie de départ', (25, 45, 70))),
    ('prec', 'Précision', '#ffe08a', ('pierce', 'Perce-armure', (25, 45, 70))), ('lourd', 'Charges lourdes', '#a07c54', ('atk', 'Attaque', (12, 22, 35))),
]
# un métier représentatif par rareté et par corps de métier, avec ses spécialités
ROSTER = {
    'metal': (('Métallier', 'lourd'), ('Charpentier métallique', 'lourd'), ('Ferronnier d’art', 'art'), ('Maître ferronnier', 'art', 'lourd')),
    'chaudro': (('Tôlier', 'prec'), ('Chaudronnier industriel', 'hp'), ('Chaudronnier aéronautique', 'aero'), ('Chaudronnier nucléaire', 'nuc', 'hp')),
    'soudage': (('Soudeur MIG/MAG', 'hp'), ('Soudeur TIG', 'prec'), ('Soudeur orbital', 'robot'), ('Soudeur sous-marin', 'naval', 'hp')),
    'tuyau': (('Monteur en tuyauterie', 'naval'), ('Tuyauteur industriel', 'hp'), ('Tuyauteur haute pression', 'hp'), ('Maître tuyauteur', 'nuc', 'naval')),
    'usinage': (('Opérateur CNC', 'prec'), ('Tourneur-fraiseur', 'prec'), ('Programmeur 5 axes', 'robot'), ('Maître outilleur', 'prec', 'aero')),
    'fonderie': (('Opérateur de fonderie', 'lourd'), ('Mouleur', 'art'), ('Métallurgiste', 'nuc'), ('Maître forgeron', 'art', 'aero')),
    'surface': (('Grenailleur', 'naval'), ('Thermolaqueur', 'aero'), ('Anodiseur', 'aero'), ('Expert revêtements', 'aero', 'hp')),
    'maint': (('Mécanicien industriel', 'robot'), ('Électromécanicien', 'robot'), ('Roboticien', 'robot'), ('Expert machines critiques', 'nuc', 'robot')),
    'bureau': (('Dessinateur industriel', 'prec'), ('Projeteur', 'lourd'), ('Ingénieur matériaux', 'aero'), ('Expert calcul de structures', 'nuc', 'aero')),
    'qualite': (('Contrôleur qualité', 'prec'), ('Métrologue', 'prec'), ('Contrôleur CND', 'nuc'), ('Expert CND niveau 3', 'nuc', 'aero')),
    'prod': (('Conducteur de ligne', 'robot'), ('Régleur industriel', 'prec'), ('Ingénieur méthodes', 'robot'), ('Directeur technique', 'lourd', 'aero')),
    'chantier': (('Élingueur', 'lourd'), ('Grutier', 'lourd'), ('Conducteur de travaux', 'naval'), ('Expert levage exceptionnel', 'lourd', 'nuc')),
    'recyclage': (('Ferrailleur', 'lourd'), ('Conducteur de broyeur', 'naval'), ('Ingénieur démantèlement', 'nuc'), ('Expert démantèlement nucléaire', 'nuc', 'art')),
    'commerce': (('Magasinier industriel', 'naval'), ('Technico-commercial', 'aero'), ('Directeur d’usine', 'art'), ('Directeur de grands projets', 'lourd', 'naval')),
}
# objets gagnés sur les monstres
ITEMS = [
    {'id': 'gants', 'n': 'Gants ignifugés', 'd': '+25 armure', 'fx': {'armor': 25}, 'c': '#c9a36a'}, {'id': 'tablier', 'n': 'Tablier aluminisé', 'd': '+25 % PV', 'fx': {'hp': 25}, 'c': '#d8dde3'},
    {'id': 'masse', 'n': 'Masse de forge', 'd': '+25 % attaque', 'fx': {'atk': 25}, 'c': '#8a8d91'}, {'id': 'riveteuse', 'n': 'Riveteuse', 'd': '+25 % vitesse', 'fx': {'speed': 25}, 'c': '#F5B700'},
    {'id': 'masque', 'n': 'Masque de soudeur', 'd': '+25 % critique', 'fx': {'crit': 25}, 'c': '#3a3d42'}, {'id': 'batterie', 'n': 'Batterie', 'd': '+50 énergie de départ', 'fx': {'mana': 50}, 'c': '#7FD48A'},
    {'id': 'burette', 'n': 'Burette d’huile', 'd': 'Régénère 3 % de PV/s', 'fx': {'regen': 3}, 'c': '#a07c54'}, {'id': 'creuset', 'n': 'Creuset ardent', 'd': 'Brûle la cible', 'fx': {'burn': 10}, 'c': '#EC641E'},
    {'id': 'poincon', 'n': 'Poinçon trempé', 'd': '+50 % perce-armure', 'fx': {'pierce': 50}, 'c': '#b8c4cc'}, {'id': 'blindage', 'n': 'Plaque de blindage', 'd': 'Bouclier de 25 % des PV', 'fx': {'shield': 25}, 'c': '#2b6cb0'},
    {'id': 'poche', 'n': 'Poche de fonte', 'd': '+40 % puissance des sorts', 'fx': {'spell': 40}, 'c': '#ff7a2a'}, {'id': 'pince', 'n': 'Pince de vautour', 'd': '+15 % attaque, +15 % PV', 'fx': {'atk': 15, 'hp': 15}, 'c': '#6a8a3a'},
]
ITEM_BY = {i['id']: i for i in ITEMS}
FAM = {f[0]: f for f in FAMILIES}
TRAITS = {f[0]: {'n': f[1], 'c': f[2], 'eff': f[5][0], 'name': f[5][1], 'val': f[5][2], 'at': (2, 4, 6)} for f in FAMILIES}
TRAITS.update({s[0]: {'n': s[1], 'c': s[2], 'eff': s[3][0], 'name': s[3][1], 'val': s[3][2], 'at': (2, 3, 4)} for s in SPECS})
UNITS = []
for f in FAMILIES:
    for tier, row in enumerate(ROSTER[f[0]]):
        UNITS.append({'id': len(UNITS), 'n': row[0], 'f': f[0], 'tr': [f[0], *row[1:]], 'tier': tier, 'cost': COST[tier], 'role': f[3]})
N_HIRE = len(UNITS)
BY_TIER = [[u['id'] for u in UNITS if u['tier'] == t] for t in range(4)]
# monstres des manches de butin
for name, role, tier, look in (('Rat de cubilot', 'lame', 0, 'rat'), ('Crasse vivante', 'mur', 0, 'crasse'), ('Golem de sable', 'mur', 1, 'golem'), ('Salamandre de fonte', 'arc', 1, 'salamandre'), ('Spectre de laitier', 'tir', 2, 'spectre'), ('Dragon de fonte', 'arc', 3, 'dragon')):
    UNITS.append({'id': len(UNITS), 'n': name, 'f': 'monstre', 'tr': [], 'tier': tier, 'cost': 0, 'role': role, 'mon': look})
RAT, CRASSE, GOLEM, SALA, SPECTRE, DRAGON = range(N_HIRE, N_HIRE + 6)
MON_SPELL = ('zone', 'Souffle', '')
WAVES = {
    1: [(RAT, 1, 3, 0), (RAT, 1, 2, 1)], 2: [(RAT, 1, 2, 0), (RAT, 1, 4, 0), (CRASSE, 1, 3, 1)], 3: [(CRASSE, 1, 2, 0), (CRASSE, 1, 4, 0), (RAT, 1, 3, 1), (RAT, 1, 1, 1)],
    8: [(GOLEM, 1, 2, 0), (GOLEM, 1, 4, 0), (SALA, 1, 3, 2), (SALA, 1, 1, 2)], 13: [(GOLEM, 2, 2, 0), (GOLEM, 2, 4, 0), (SALA, 2, 1, 2), (SALA, 2, 5, 2), (SPECTRE, 1, 3, 3)],
    18: [(GOLEM, 2, 1, 0), (GOLEM, 2, 3, 0), (GOLEM, 2, 5, 0), (SPECTRE, 2, 2, 2), (SPECTRE, 2, 4, 2)], 23: [(DRAGON, 1, 3, 1), (GOLEM, 2, 1, 0), (GOLEM, 2, 5, 0), (SPECTRE, 2, 2, 3), (SPECTRE, 2, 4, 3)],
}
STAR = (0, 1.0, 1.8, 3.2)
TIER_POWER = (1.0, 1.3, 1.7, 2.3)


def wave(rnd):
    if rnd in WAVES:
        return WAVES[rnd]
    k = 2 if rnd < 33 else 3
    return [(DRAGON, k, 3, 1), (GOLEM, 3, 1, 0), (GOLEM, 3, 5, 0), (SPECTRE, k, 2, 3), (SPECTRE, k, 4, 3), (SALA, k, 3, 3)]


def base_stats(uid, star):
    u = UNITS[uid]
    hp, atk, arm, rng, spd = ROLES[u['role']]
    k = TIER_POWER[u['tier']] * STAR[star]
    return {'hp': hp * k, 'atk': atk * k, 'arm': arm, 'rng': rng, 'spd': spd}


def trait_levels(board):
    """Paliers actifs : unités différentes par famille, sur l'atelier."""
    seen = {}
    for v in board:
        for t in UNITS[v[0]]['tr']:
            seen.setdefault(t, set()).add(v[0])
    out = {}
    for t, s in seen.items():
        at = TRAITS[t]['at']
        out[t] = sum(1 for a in at if len(s) >= a)
    return out


class Player:
    def __init__(self, name, bot):
        self.name, self.bot = name, bot
        self.hp = START_HP
        self.gold = 5
        self.level = 2
        self.xp = 0
        self.board: dict[tuple, list] = {}     # (col, rang) -> [unité, étoiles, objets]
        self.bench: list = [None] * BENCH
        self.shop: list = [None] * SHOP
        self.items: list = []                  # objets pas encore équipés
        self.loot: list = []                   # 3 objets au choix après une manche de monstres
        self.streak = 0
        self.ready = False
        self.opp = -1

    @property
    def alive(self):
        return self.hp > 0


class Tactique:
    kind = 'tactique'
    max_seats = 8
    min_seats = 8
    fill_only_quick = True
    stream = False

    def __init__(self, seats):
        self.p = [Player(s['name'], s['bot']) for s in seats]
        self.pool = {u['id']: POOL[u['tier']] for u in UNITS[:N_HIRE]}
        self.round = 0
        self.fights: list[dict] = []
        self.left = 0.0
        self.phase = 'prep'
        self.finished: list[int] | None = None
        self.order: list[int] = []
        self.dirty = True
        self.start_round()

    # ---------------- boutique ----------------
    def roll(self, p):
        for u in p.shop:
            if u is not None:
                self.pool[u] += 1
        p.shop = [self.draw(p.level) for _ in range(SHOP)]

    def draw(self, level):
        for _ in range(8):
            tier = random.choices(range(4), ODDS[level])[0]
            ids = [i for i in BY_TIER[tier] if self.pool[i] > 0]
            if ids:
                u = random.choices(ids, [self.pool[i] for i in ids])[0]
                self.pool[u] -= 1
                return u
        return None

    def merge(self, p, uid):
        """3 exemplaires identiques en font 1 avec une étoile de plus ; les objets en trop reviennent au stock."""
        for star in (1, 2):
            spots = [('b', k) for k, v in p.board.items() if v[0] == uid and v[1] == star] + [('s', i) for i, v in enumerate(p.bench) if v and v[0] == uid and v[1] == star]
            if len(spots) < 3:
                continue
            spots = spots[:3]
            items = []
            for kind, key in spots:
                items += (p.board[key] if kind == 'b' else p.bench[key])[2]
                if kind == 's':
                    p.bench[key] = None
            keep = spots[0]
            for kind, key in spots[1:]:
                if kind == 'b':
                    p.board.pop(key)
            nv = [uid, star + 1, items[:MAX_ITEMS]]
            p.items += items[MAX_ITEMS:]
            if keep[0] == 'b':
                p.board[keep[1]] = nv
            else:
                p.bench[keep[1]] = nv

    def buy(self, p, i):
        u = p.shop[i]
        if u is None or p.gold < UNITS[u]['cost']:
            return
        slot = next((k for k, v in enumerate(p.bench) if v is None), None)
        if slot is None:         # banc plein : l'achat passe seulement s'il déclenche une fusion
            have = sum(1 for v in list(p.board.values()) + p.bench if v and v[0] == u and v[1] == 1)
            if have < 2:
                return
            p.bench.append([u, 1, []])
        else:
            p.bench[slot] = [u, 1, []]
        p.gold -= UNITS[u]['cost']
        p.shop[i] = None
        self.merge(p, u)
        del p.bench[BENCH:]

    def sell(self, p, src):
        v = self.take(p, src)
        if v is None:
            return
        uid, star, items = v
        p.items += items
        p.gold += UNITS[uid]['cost'] * 3 ** (star - 1) - (1 if star > 1 and UNITS[uid]['cost'] > 1 else 0)
        self.pool[uid] += 3 ** (star - 1)

    def take(self, p, src):
        if src[0] == 's':
            v = p.bench[src[1]]
            p.bench[src[1]] = None
            return v
        return p.board.pop((src[1], src[2]), None)

    def peek(self, p, src):
        return p.bench[src[1]] if src[0] == 's' else p.board.get((src[1], src[2]))

    def valid(self, src):
        try:
            if src[0] == 's':
                return 0 <= int(src[1]) < BENCH
            return src[0] == 'b' and 0 <= int(src[1]) < COLS and 0 <= int(src[2]) < ROWS
        except (IndexError, TypeError, ValueError):
            return False

    def move(self, p, a, b):
        va, vb = self.peek(p, a), self.peek(p, b)
        if va is None:
            return
        if b[0] == 'b' and a[0] == 's' and vb is None and len(p.board) >= p.level:
            return
        self.take(p, a)
        self.take(p, b)
        for spot, v in ((b, va), (a, vb)):
            if v is None:
                continue
            if spot[0] == 's':
                p.bench[spot[1]] = v
            else:
                p.board[(spot[1], spot[2])] = v

    def equip(self, p, i, spot):
        v = self.peek(p, spot)
        if v is None or not 0 <= i < len(p.items) or len(v[2]) >= MAX_ITEMS:
            return
        v[2].append(p.items.pop(i))

    def pick_loot(self, p, i):
        if 0 <= i < len(p.loot):
            p.items.append(p.loot[i])
            p.loot = []

    def buy_xp(self, p):
        if p.level < 9 and p.gold >= 4:
            p.gold -= 4
            self.add_xp(p, 4)

    def add_xp(self, p, n):
        p.xp += n
        while p.level < 9 and p.xp >= XP_NEED[p.level]:
            p.xp -= XP_NEED[p.level]
            p.level += 1

    def handle(self, seat, data):
        if seat >= len(self.p) or self.phase == 'over':
            return
        p = self.p[seat]
        a = data.get('a')
        if a == 'skip':
            p.ready = True
            self.dirty = True
            return
        if self.phase != 'prep' or not p.alive:
            return
        try:
            if a == 'buy':
                self.buy(p, int(data['i']))
            elif a == 'roll' and p.gold >= 2:
                p.gold -= 2
                self.roll(p)
            elif a == 'xp':
                self.buy_xp(p)
            elif a == 'move' and self.valid(data['a2']) and self.valid(data['b']):
                self.move(p, self.spot(data['a2']), self.spot(data['b']))
            elif a == 'sell' and self.valid(data['b']):
                self.sell(p, self.spot(data['b']))
            elif a == 'equip' and self.valid(data['b']):
                self.equip(p, int(data['i']), self.spot(data['b']))
            elif a == 'loot':
                self.pick_loot(p, int(data['i']))
        except (KeyError, IndexError, TypeError, ValueError):
            return
        self.dirty = True

    @staticmethod
    def spot(s):
        return ('s', int(s[1])) if s[0] == 's' else ('b', int(s[1]), int(s[2]))

    # ---------------- déroulé ----------------
    def tick(self, dt, connected):
        if self.phase == 'over':
            return
        self.left -= dt
        humans = [p for i, p in enumerate(self.p) if not p.bot and p.alive and connected(i)]
        if self.left <= 0 or not humans or all(p.ready for p in humans):
            if self.phase == 'prep':
                self.start_fights()
            else:
                self.end_fights()

    def alive_ids(self):
        return [i for i, p in enumerate(self.p) if p.alive]

    def bonus(self, p, effect):
        lv = trait_levels(p.board.values())
        return sum(TRAITS[t]['val'][n - 1] for t, n in lv.items() if n and TRAITS[t]['eff'] == effect)

    def start_round(self):
        self.round += 1
        self.phase = 'prep'
        self.left = PREP
        self.fights = []
        for p in self.p:
            p.ready = False
            if not p.alive:
                continue
            if self.round > 1:
                cap = 5 + self.bonus(p, 'interest')
                p.gold += 5 + min(cap, p.gold // 10) + min(3, abs(p.streak) // 2) + self.bonus(p, 'gold')
                self.add_xp(p, 2)
            self.roll(p)
        for p in self.p:
            if p.bot and p.alive:
                self.bot_turn(p)
        self.dirty = True

    def start_fights(self):
        for p in self.p:           # butin pas choisi : un objet au hasard
            if p.loot:
                self.pick_loot(p, random.randrange(len(p.loot)))
        self.fights = []
        ids = self.alive_ids()
        if self.round in PVE_ROUNDS:
            mons = {(c, r): [u, s, []] for u, s, c, r in wave(self.round)}
            for i in ids:
                f = self.fight(self.p[i].board, mons, self.p[i])
                f['a'], f['b'] = i, -1
                self.apply_pve(self.p[i], f)
                self.fights.append(f)
        else:
            random.shuffle(ids)
            pairs = [(ids[k], ids[k + 1]) for k in range(0, len(ids) - 1, 2)]
            ghost = ids[-1] if len(ids) % 2 else None
            if ghost is not None:      # nombre impair : le dernier affronte une copie d'un autre
                pairs.append((ghost, ids[0]))
            for a, b in pairs:
                f = self.fight(self.p[a].board, self.p[b].board, self.p[a], self.p[b])
                f['a'], f['b'] = a, b
                self.apply(a, b, f, ghost != a)
                self.p[a].opp, self.p[b].opp = b, a
                self.fights.append(f)
        self.phase = 'combat'
        self.left = max((f['dur'] for f in self.fights), default=0) + 3
        for p in self.p:
            p.ready = False
        self.dirty = True

    def apply_pve(self, p, f):
        f['dmg'] = 0
        if f['win'] == 0:
            p.gold += 1 + (self.round > 3)
            p.loot = random.sample([i['id'] for i in ITEMS], 3)
        else:
            f['dmg'] = 1 + self.round // 5
            p.hp -= f['dmg']
            if self.round <= 3:       # au début, on repart quand même avec un objet
                p.loot = random.sample([i['id'] for i in ITEMS], 3)

    def apply(self, a, b, f, hurt_b):
        pa, pb = self.p[a], self.p[b]
        dmg = 2 + min(12, self.round // 3) + f['left'] * 2
        f['dmg'] = dmg
        if f['win'] == 0:
            pa.streak = max(1, pa.streak + 1)
            pa.gold += 1
            if hurt_b:
                pb.streak = min(-1, pb.streak - 1)
                pb.hp -= dmg
        elif f['win'] == 1:
            pa.streak = min(-1, pa.streak - 1)
            pa.hp -= dmg
            if hurt_b:
                pb.streak = max(1, pb.streak + 1)
                pb.gold += 1
        else:
            pa.hp -= dmg // 2
            if hurt_b:
                pb.hp -= dmg // 2

    def end_fights(self):
        for i, p in enumerate(self.p):
            if p.hp <= 0 and i not in self.order:
                p.hp = 0
                self.order.append(i)
                for v in list(p.board.values()) + [x for x in p.bench if x]:
                    self.pool[v[0]] += 3 ** (v[1] - 1)
                p.board.clear()
                p.bench = [None] * BENCH
        alive = self.alive_ids()
        if len(alive) <= 1 or self.round >= MAX_ROUNDS:
            self.order += sorted(alive, key=lambda i: self.p[i].hp)
            self.finished = list(reversed(self.order))
            self.phase = 'over'
            self.dirty = True
            return
        self.start_round()

    # ---------------- combat ----------------
    def team(self, board, side):
        levels = trait_levels(board.values())
        team_regen = sum(TRAITS[t]['val'][n - 1] for t, n in levels.items() if n and TRAITS[t]['eff'] == 'teamregen')
        out = []
        for (c, r), v in board.items():
            uid, star, items = v
            s = base_stats(uid, star)
            fx = {}
            for t in UNITS[uid]['tr']:
                n = levels.get(t, 0)
                if n:
                    e = TRAITS[t]['eff']
                    fx[e] = fx.get(e, 0) + TRAITS[t]['val'][n - 1]
            for it in items:
                for e, val in ITEM_BY[it]['fx'].items():
                    fx[e] = fx.get(e, 0) + val
            g = lambda e: fx.get(e, 0)
            hp = s['hp'] * (1 + g('hp') / 100)
            fam = UNITS[uid]['f']
            out.append({'u': uid, 'star': star, 'side': side, 'fam': fam, 'x': float(c if side == 0 else COLS - 1 - c), 'y': float((3 - r) if side == 0 else 4 + r),
                        'hp': hp, 'max': hp, 'atk': s['atk'] * (1 + g('atk') / 100), 'arm': s['arm'] + g('armor'), 'rng': s['rng'], 'spd': s['spd'] * (1 + g('speed') / 100),
                        'mana': min(100, g('mana')), 'shield': hp * g('shield') / 100, 'cd': 0.2, 'crit': g('crit') / 100 + (0.15 if fam == 'usinage' else 0), 'burnfx': g('burn') + (6 if fam == 'fonderie' else 0),
                        'pierce': min(1, g('pierce') / 100 + (0.3 if fam == 'qualite' else 0)), 'regen': (g('regen') + team_regen) / 100, 'avenge': g('avenge'), 'spell': 1 + g('spell') / 100,
                        'burn': 0.0, 'burnt': 0.0, 'dead': False, 'n': 0})
        return out

    def fight(self, ba, bb, pa=None, pb=None):
        units = self.team(ba, 0) + self.team(bb, 1)
        frames, hits = [], []
        spawn = [[u['u'], u['star'], u['side']] for u in units]
        t = 0

        def hurt(u, dmg, src, kind):
            if u['dead']:
                return
            a = max(0.0, u['arm'] * (1 - (src['pierce'] if src else 0)))
            d = dmg * 100 / (100 + a) if kind != 'burn' else dmg
            if u['shield'] > 0:
                ab = min(u['shield'], d)
                u['shield'] -= ab
                d -= ab
            u['hp'] -= d
            u['mana'] = min(100, u['mana'] + 3)
            if u['hp'] <= 0:
                u['dead'] = True
                for o in units:
                    if o['side'] == u['side'] and not o['dead'] and o['avenge']:
                        o['atk'] *= 1 + o['avenge'] / 100

        def snap():
            return [v for u in units for v in (round(u['x'] * 10), round(u['y'] * 10), 0 if u['dead'] else max(1, round(100 * u['hp'] / u['max'])), round(u['mana']))]

        for t in range(int(FIGHT_MAX / TICK)):
            sides = [[u for u in units if u['side'] == s and not u['dead']] for s in (0, 1)]
            if not sides[0] or not sides[1]:
                break
            for i, u in enumerate(units):
                if u['dead']:
                    continue
                if u['regen']:
                    u['hp'] = min(u['max'], u['hp'] + u['max'] * u['regen'] * TICK)
                if u['burnt'] > 0:
                    u['burnt'] -= TICK
                    hurt(u, u['burn'] * TICK, None, 'burn')
                    if u['dead']:
                        continue
                foes = [f for f in sides[1 - u['side']] if not f['dead']]
                if not foes:
                    continue
                tgt = min(foes, key=lambda f: (f['x'] - u['x']) ** 2 + (f['y'] - u['y']) ** 2)
                d = math.hypot(tgt['x'] - u['x'], tgt['y'] - u['y'])
                u['cd'] -= TICK
                if d > u['rng'] + 0.1:
                    st = min(d, 1.3 * TICK)
                    u['x'] += (tgt['x'] - u['x']) / d * st
                    u['y'] += (tgt['y'] - u['y']) / d * st
                    continue
                if u['mana'] >= 100:
                    u['mana'] = 0
                    self.cast(u, tgt, units, hurt, hits, t, i)
                    u['cd'] = 0.4
                elif u['cd'] <= 0:
                    u['cd'] = 1 / u['spd']
                    self.attack(u, tgt, foes, sides[u['side']], units, hurt, hits, t, i)
            if t % FRAME_EVERY == 0:
                frames.append(snap())
        frames.append(snap())
        a = sum(1 for u in units if u['side'] == 0 and not u['dead'])
        b = sum(1 for u in units if u['side'] == 1 and not u['dead'])
        win = 2 if (a and b) or (not a and not b) else 0 if a else 1
        return {'units': spawn, 'frames': frames, 'hits': hits[:900], 'win': win, 'left': a if win == 0 else b if win == 1 else 0, 'dur': round((t + 1) * TICK, 1)}

    def attack(self, u, tgt, foes, mates, units, hurt, hits, t, i):
        """Coup normal : chaque corps de métier a sa particularité."""
        fam, u['n'] = u['fam'], u['n'] + 1
        crit = random.random() < u['crit']
        dmg = u['atk'] * (1.8 if crit else 1)
        if fam == 'prod' and u['n'] % 3 == 0:
            dmg *= 2
        hurt(tgt, dmg, u, 'atk')
        hits.append([t, i, units.index(tgt), round(dmg), 1 if crit else 0])
        u['mana'] = min(100, u['mana'] + (20 if fam == 'bureau' else 12))
        if u['burnfx']:
            tgt['burn'], tgt['burnt'] = u['burnfx'] * TIER_POWER[UNITS[u['u']]['tier']] * 2, 3.0
        if fam == 'metal':
            u['shield'] += u['max'] * 0.02
        elif fam == 'chaudro':
            for o in foes:
                if o is not tgt and math.hypot(o['x'] - tgt['x'], o['y'] - tgt['y']) < 1.3:
                    hurt(o, dmg * 0.4, u, 'atk')
                    hits.append([t, i, units.index(o), round(dmg * 0.4), 0])
        elif fam == 'soudage':
            o = next((o for o in foes if o is not tgt and not o['dead']), None)
            if o:
                hurt(o, dmg * 0.4, u, 'atk')
                hits.append([t, units.index(tgt), units.index(o), round(dmg * 0.4), 6])
        elif fam in ('tuyau', 'recyclage'):
            u['hp'] = min(u['max'], u['hp'] + dmg * (0.1 if fam == 'tuyau' else 0.2))
        elif fam == 'surface':
            tgt['arm'] = max(0, tgt['arm'] - 2)
        elif fam == 'maint':
            o = min(mates, key=lambda m: m['hp'] / m['max'])
            o['hp'] = min(o['max'], o['hp'] + u['atk'] * 0.3)
        elif fam == 'chantier':
            k = 0.25 if u['side'] == 0 else -0.25
            tgt['y'] = max(0.0, min(7.0, tgt['y'] + k))
        elif fam == 'commerce' and random.random() < 0.25:
            hurt(tgt, dmg, u, 'atk')
            hits.append([t, i, units.index(tgt), round(dmg), 0])

    def cast(self, u, tgt, units, hurt, hits, t, i):
        kind = FAM[u['fam']][4][0] if u['fam'] in FAM else MON_SPELL[0]
        power = u['atk'] * 2.4 * u['spell']
        if kind == 'frappe':
            hurt(tgt, power * 1.3, u, 'spell')
            hits.append([t, i, units.index(tgt), round(power * 1.3), 2])
        elif kind == 'zone':
            for o in units:
                if o['side'] != u['side'] and not o['dead'] and math.hypot(o['x'] - tgt['x'], o['y'] - tgt['y']) < 1.7:
                    hurt(o, power * 0.8, u, 'spell')
                    hits.append([t, i, units.index(o), round(power * 0.8), 3])
        elif kind == 'garde':
            u['shield'] += u['max'] * 0.3 * u['spell']
            hits.append([t, i, i, 0, 4])
        else:
            mates = [o for o in units if o['side'] == u['side'] and not o['dead']]
            o = min(mates, key=lambda m: m['hp'] / m['max'])
            o['hp'] = min(o['max'], o['hp'] + power * 1.2)
            hits.append([t, i, units.index(o), round(power * 1.2), 5])

    # ---------------- robots ----------------
    def bot_turn(self, p):
        if p.loot:
            self.pick_loot(p, random.randrange(len(p.loot)))
        tr = {}
        for v in list(p.board.values()) + [x for x in p.bench if x]:
            for t in UNITS[v[0]]['tr']:
                tr[t] = tr.get(t, 0) + 1
        for _ in range(3):
            for i, u in enumerate(p.shop):
                if u is None or p.gold < UNITS[u]['cost']:
                    continue
                have = any(v and v[0] == u for v in list(p.board.values()) + p.bench)
                if have or any(tr.get(t) for t in UNITS[u]['tr']) or UNITS[u]['tier'] >= 2 or len(p.board) + sum(1 for b in p.bench if b) < p.level:
                    self.buy(p, i)
                    for t in UNITS[u]['tr']:
                        tr[t] = tr.get(t, 0) + 1
            if p.gold >= 14 and p.level < 9:
                self.buy_xp(p)
            elif p.gold >= 12:
                p.gold -= 2
                self.roll(p)
        # le banc monte sur l'atelier, les plus solides au contact (rang 0)
        allu = [v for v in list(p.board.values()) + p.bench if v]
        allu.sort(key=lambda v: (-v[1], -UNITS[v[0]]['tier']))
        p.board = {}
        p.bench = [None] * BENCH
        team, rest = allu[:p.level], allu[p.level:]
        front = [v for v in team if UNITS[v[0]]['role'] in ('mur', 'lame')]
        back = [v for v in team if UNITS[v[0]]['role'] not in ('mur', 'lame')]
        for rows, group in (((0, 1), front), ((3, 2), back)):
            spots = [(c, r) for r in rows for c in (3, 2, 4, 1, 5, 0, 6)]
            for v, k in zip(group, spots):
                p.board[k] = v
        for k, v in enumerate(rest[:BENCH]):
            p.bench[k] = v
        for v in team:
            while p.items and len(v[2]) < MAX_ITEMS:
                v[2].append(p.items.pop())

    # ---------------- état envoyé ----------------
    def completed(self, seat):
        return True

    def init_payload(self):
        fams = [{'id': f[0], 'atk': f[6][0], 'ad': f[6][1], 'spell': f[4][1], 'sd': f[4][2]} for f in FAMILIES]
        return {'tq': {'units': UNITS, 'families': fams, 'traits': TRAITS, 'items': ITEMS, 'rarity': RARITY, 'cols': COLS, 'rows': ROWS, 'bench': BENCH, 'maxItems': MAX_ITEMS,
                       'odds': {str(k): v for k, v in ODDS.items()}, 'xp': {str(k): v for k, v in XP_NEED.items()}, 'frame': FRAME_EVERY * TICK, 'tick': TICK, 'pve': sorted(PVE_ROUNDS)}}

    def view(self):
        return {
            'phase': self.phase, 'round': self.round, 'left': round(self.left, 1), 'finished': self.finished,
            'p': [{'n': p.name, 'b': p.bot, 'hp': max(0, p.hp), 'gold': p.gold, 'lv': p.level, 'xp': p.xp, 'streak': p.streak, 'ready': p.ready, 'items': p.items, 'loot': p.loot,
                   'board': [[k[0], k[1], v[0], v[1], v[2]] for k, v in p.board.items()], 'bench': p.bench, 'shop': p.shop} for p in self.p],
            'fights': self.fights if self.phase == 'combat' else [],
        }
