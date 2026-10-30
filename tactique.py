"""Forge Tactique : auto-battler à 8 sur les métiers de la métallurgie (robots en renfort).

On recrute des métiers dans une boutique commune, on les place sur l'atelier, puis les équipes s'affrontent seules.
3 exemplaires identiques fusionnent en une étoile de plus. Les corps de métier donnent des synergies (2, 4, 6 unités).
La rareté (commun, rare, épique, légendaire) suit la difficulté de recrutement et la spécialisation du métier :
ce n'est ni un classement officiel ni un jugement sur la valeur des métiers.
Le serveur simule tout ; chaque combat est calculé d'un coup et envoyé aux navigateurs, qui le rejouent."""
from __future__ import annotations
import math
import random

COLS, ROWS = 7, 4
BENCH = 9
SHOP = 5
PREP = 30.0
START_HP = 100
MAX_ROUNDS = 40
TICK = 0.1
FIGHT_MAX = 28.0
FRAME_EVERY = 3            # une image de combat toutes les 0,3 s
COST = [1, 2, 3, 5]
RARITY = ['Commun', 'Rare', 'Épique', 'Légendaire']
POOL = [22, 18, 12, 8]     # exemplaires de chaque unité dans la boutique commune
ODDS = {1: (100, 0, 0, 0), 2: (100, 0, 0, 0), 3: (75, 25, 0, 0), 4: (55, 35, 10, 0), 5: (45, 35, 18, 2), 6: (30, 40, 25, 5), 7: (20, 35, 35, 10), 8: (15, 25, 40, 20), 9: (10, 20, 40, 30)}
XP_NEED = {1: 2, 2: 2, 3: 6, 4: 10, 5: 20, 6: 36, 7: 56, 8: 80}

ROLES = {   # PV, attaque, armure, portée, attaques/s
    'mur': (900, 55, 40, 1, 0.65), 'lame': (680, 75, 25, 1, 0.8), 'tir': (500, 72, 15, 4, 0.75), 'arc': (480, 50, 15, 3, 0.7), 'soin': (540, 45, 20, 3, 0.7),
}
# corps de métier : nom, couleur, rôle, sort, effet de synergie et paliers (2, 4, 6 unités)
FAMILIES = [
    ('metal', 'Métallerie', '#8a8d91', 'mur', ('garde', 'Garde-corps', 'Se protège derrière un bouclier.'), ('armor', 'Armure', (20, 40, 70))),
    ('chaudro', 'Chaudronnerie', '#c87533', 'mur', ('zone', 'Coup de maillet', 'Frappe tous les ennemis proches.'), ('hp', 'PV', (15, 30, 50))),
    ('soudage', 'Soudage', '#5AA8FF', 'lame', ('frappe', 'Arc électrique', 'Grosse décharge sur la cible.'), ('speed', 'Vitesse d’attaque', (15, 30, 50))),
    ('tuyau', 'Tuyauterie', '#2f8a8a', 'lame', ('garde', 'Purge haute pression', 'Se soigne et se protège.'), ('regen', 'Régénération', (1.5, 3, 5))),
    ('usinage', 'Usinage', '#d8dde3', 'tir', ('frappe', 'Passe de finition', 'Tir de précision sur la cible.'), ('crit', 'Critique', (15, 30, 50))),
    ('fonderie', 'Fonderie et Forge', '#EC641E', 'arc', ('zone', 'Coulée en fusion', 'Métal en fusion sur une zone.'), ('burn', 'Brûlure', (4, 8, 14))),
    ('surface', 'Traitement de surface', '#C77DFF', 'soin', ('soin', 'Couche protectrice', 'Soigne l’allié le plus touché.'), ('shield', 'Bouclier de départ', (15, 30, 50))),
    ('maint', 'Maintenance', '#7FD48A', 'soin', ('soin', 'Remise en état', 'Soigne l’allié le plus touché.'), ('teamregen', 'Soin d’équipe', (1, 2, 3))),
    ('bureau', 'Bureau d’études', '#F5B700', 'arc', ('frappe', 'Calcul de structure', 'Vise le point faible de la cible.'), ('mana', 'Énergie de départ', (30, 60, 100))),
    ('qualite', 'Qualité et Contrôle', '#f2f4f7', 'tir', ('frappe', 'Contrôle ultrasons', 'Traverse l’armure de la cible.'), ('pierce', 'Perce-armure', (30, 60, 100))),
    ('prod', 'Production', '#BA2C3A', 'lame', ('zone', 'Cadence maximale', 'Enchaîne sur les ennemis proches.'), ('gold', 'Or par manche', (1, 2, 4))),
    ('chantier', 'Chantier et Levage', '#d9a02a', 'mur', ('zone', 'Charge lourde', 'Écrase les ennemis proches.'), ('atk', 'Attaque', (15, 30, 50))),
    ('recyclage', 'Recyclage', '#6a8a3a', 'lame', ('frappe', 'Broyeur', 'Mord la cible à pleines dents.'), ('avenge', 'Rage par allié perdu', (10, 20, 35))),
    ('commerce', 'Commerce et Gestion', '#3f7fd8', 'soin', ('soin', 'Budget d’urgence', 'Soigne l’allié le plus touché.'), ('interest', 'Intérêts maximum', (1, 2, 3))),
]
# un métier représentatif par rareté et par corps de métier
NAMES = {
    'metal': ('Métallier', 'Charpentier métallique', 'Ferronnier d’art', 'Maître ferronnier'),
    'chaudro': ('Tôlier', 'Chaudronnier industriel', 'Chaudronnier aéronautique', 'Chaudronnier nucléaire'),
    'soudage': ('Soudeur MIG/MAG', 'Soudeur TIG', 'Soudeur orbital', 'Soudeur sous-marin'),
    'tuyau': ('Monteur en tuyauterie', 'Tuyauteur industriel', 'Tuyauteur haute pression', 'Maître tuyauteur'),
    'usinage': ('Opérateur CNC', 'Tourneur-fraiseur', 'Programmeur 5 axes', 'Maître outilleur'),
    'fonderie': ('Opérateur de fonderie', 'Mouleur', 'Métallurgiste', 'Maître forgeron'),
    'surface': ('Grenailleur', 'Thermolaqueur', 'Anodiseur', 'Expert revêtements'),
    'maint': ('Mécanicien industriel', 'Électromécanicien', 'Roboticien', 'Expert machines critiques'),
    'bureau': ('Dessinateur industriel', 'Projeteur', 'Ingénieur matériaux', 'Expert calcul de structures'),
    'qualite': ('Contrôleur qualité', 'Métrologue', 'Contrôleur CND', 'Expert CND niveau 3'),
    'prod': ('Conducteur de ligne', 'Régleur industriel', 'Ingénieur méthodes', 'Directeur technique'),
    'chantier': ('Élingueur', 'Grutier', 'Conducteur de travaux', 'Expert levage exceptionnel'),
    'recyclage': ('Ferrailleur', 'Conducteur de broyeur', 'Ingénieur démantèlement', 'Expert démantèlement nucléaire'),
    'commerce': ('Magasinier industriel', 'Technico-commercial', 'Directeur d’usine', 'Directeur de grands projets'),
}
FAM = {f[0]: f for f in FAMILIES}
UNITS = []
for f in FAMILIES:
    for tier in range(4):
        UNITS.append({'id': len(UNITS), 'n': NAMES[f[0]][tier], 'f': f[0], 'tier': tier, 'cost': COST[tier], 'role': f[3]})
BY_TIER = [[u['id'] for u in UNITS if u['tier'] == t] for t in range(4)]
STAR = (0, 1.0, 1.8, 3.2)
TIER_POWER = (1.0, 1.3, 1.7, 2.3)


def base_stats(uid, star):
    u = UNITS[uid]
    hp, atk, arm, rng, spd = ROLES[u['role']]
    k = TIER_POWER[u['tier']] * STAR[star]
    return {'hp': hp * k, 'atk': atk * k, 'arm': arm, 'rng': rng, 'spd': spd}


class Player:
    def __init__(self, name, bot):
        self.name, self.bot = name, bot
        self.hp = START_HP
        self.gold = 5
        self.level = 2
        self.xp = 0
        self.board: dict[tuple, list] = {}     # (col, rang) -> [unité, étoiles]
        self.bench: list = [None] * BENCH
        self.shop: list = [None] * SHOP
        self.streak = 0
        self.place = 0
        self.ready = False
        self.last = ''                         # résultat du dernier combat
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
        self.pool = {u['id']: POOL[u['tier']] for u in UNITS}
        self.round = 0
        self.fights: list[dict] = []
        self.acc = 0.0
        self.left = 0.0
        self.phase = 'prep'
        self.finished: list[int] | None = None
        self.order: list[int] = []              # éliminés, du premier au dernier
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
        """3 exemplaires identiques deviennent 1 exemplaire avec une étoile de plus."""
        for star in (1, 2):
            spots = [('b', k) for k, v in p.board.items() if v == [uid, star]] + [('s', i) for i, v in enumerate(p.bench) if v == [uid, star]]
            if len(spots) >= 3:
                keep = next((s for s in spots if s[0] == 'b'), spots[0])
                for kind, key in spots[:3] + ([keep] if keep not in spots[:3] else []):
                    if kind == 'b':
                        p.board.pop(key, None)
                    else:
                        p.bench[key] = None
                if keep[0] == 'b':
                    p.board[keep[1]] = [uid, star + 1]
                else:
                    p.bench[keep[1]] = [uid, star + 1]

    def buy(self, p, i):
        u = p.shop[i]
        if u is None or p.gold < UNITS[u]['cost']:
            return
        slot = next((k for k, v in enumerate(p.bench) if v is None), None)
        have = sum(1 for v in list(p.board.values()) + p.bench if v == [u, 1])
        if slot is None and have < 2:
            return
        p.gold -= UNITS[u]['cost']
        p.shop[i] = None
        if slot is None:         # banc plein : l'achat passe s'il déclenche une fusion
            for k, v in list(p.board.items()):
                if v == [u, 1]:
                    p.board.pop(k)
                    p.board[k] = [u, 2]
                    break
            else:
                k = next(k for k, v in enumerate(p.bench) if v == [u, 1])
                p.bench[k] = [u, 2]
            for k, v in enumerate(p.bench):
                if v == [u, 1]:
                    p.bench[k] = None
                    break
            else:
                for k, v in list(p.board.items()):
                    if v == [u, 1]:
                        p.board.pop(k)
                        break
        else:
            p.bench[slot] = [u, 1]
        self.merge(p, u)

    def sell(self, p, src):
        v = self.take(p, src)
        if v is None:
            return
        uid, star = v
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
        if self.left <= 0 or (humans and all(p.ready for p in humans)) or (not humans and self.phase != 'over'):
            if self.phase == 'prep':
                self.start_fights()
            else:
                self.end_fights()

    def alive_ids(self):
        return [i for i, p in enumerate(self.p) if p.alive]

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
        for i, p in enumerate(self.p):
            if p.bot and p.alive:
                self.bot_turn(p)
        self.dirty = True

    def bonus(self, p, effect):
        for f in FAMILIES:
            if f[5][0] == effect:
                n = len({v[0] for v in p.board.values() if UNITS[v[0]]['f'] == f[0]})
                lv = 3 if n >= 6 else 2 if n >= 4 else 1 if n >= 2 else 0
                return f[5][2][lv - 1] if lv else 0
        return 0

    def start_fights(self):
        ids = self.alive_ids()
        random.shuffle(ids)
        pairs = [(ids[i], ids[i + 1]) for i in range(0, len(ids) - 1, 2)]
        ghost = None
        if len(ids) % 2:                     # nombre impair : le dernier affronte une copie d'un autre
            ghost = ids[-1]
            pairs.append((ghost, ids[0]))
        self.fights = []
        for a, b in pairs:
            f = self.fight(self.p[a], self.p[b])
            f['a'], f['b'] = a, b
            real_b = not (ghost == a)
            self.apply(a, b, f, real_b)
            self.p[a].opp, self.p[b].opp = b, a
            self.fights.append(f)
        self.phase = 'combat'
        self.left = max((f['dur'] for f in self.fights), default=0) + 2.5
        for p in self.p:
            p.ready = False
        self.dirty = True

    def apply(self, a, b, f, hurt_b):
        pa, pb = self.p[a], self.p[b]
        dmg = 2 + min(12, self.round // 3) + f['left'] * 2
        f['dmg'] = dmg
        if f['win'] == 0:
            pa.streak = max(1, pa.streak + 1); pb.streak = min(-1, pb.streak - 1) if hurt_b else pb.streak
            pa.last = 'win'; pb.last = 'lose' if hurt_b else pb.last
            pa.gold += 1
            if hurt_b:
                pb.hp -= dmg
        elif f['win'] == 1:
            pa.streak = min(-1, pa.streak - 1); pa.last = 'lose'
            pa.hp -= dmg
            if hurt_b:
                pb.streak = max(1, pb.streak + 1); pb.last = 'win'; pb.gold += 1
        else:
            pa.hp -= dmg // 2; pa.last = 'draw'
            if hurt_b:
                pb.hp -= dmg // 2; pb.last = 'draw'

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
            rest = sorted(alive, key=lambda i: self.p[i].hp)
            self.order += rest
            self.finished = list(reversed(self.order))
            self.phase = 'over'
            self.dirty = True
            return
        self.start_round()

    # ---------------- combat ----------------
    def team(self, p, side):
        fam = {}
        for v in p.board.values():
            fam.setdefault(UNITS[v[0]]['f'], set()).add(v[0])
        lv = {f: (3 if len(s) >= 6 else 2 if len(s) >= 4 else 1 if len(s) >= 2 else 0) for f, s in fam.items()}
        eff = {}
        for f, n in lv.items():
            if n:
                eff[FAM[f][5][0]] = (f, FAM[f][5][2][n - 1])
        out = []
        for (c, r), (uid, star) in p.board.items():
            s = base_stats(uid, star)
            f = UNITS[uid]['f']
            own = lambda e: eff[e][1] if e in eff and eff[e][0] == f else 0
            hp = s['hp'] * (1 + own('hp') / 100)
            out.append({'u': uid, 'star': star, 'side': side, 'x': float(c if side == 0 else COLS - 1 - c), 'y': float((3 - r) if side == 0 else 4 + r),
                        'hp': hp, 'max': hp, 'atk': s['atk'] * (1 + own('atk') / 100), 'arm': s['arm'] + own('armor'), 'rng': s['rng'], 'spd': s['spd'] * (1 + own('speed') / 100),
                        'mana': own('mana'), 'shield': hp * own('shield') / 100, 'cd': 0.2, 'crit': own('crit') / 100, 'burnfx': own('burn'), 'pierce': own('pierce') / 100,
                        'regen': own('regen') / 100 + (eff['teamregen'][1] / 100 if 'teamregen' in eff else 0), 'avenge': (eff['avenge'][1] if 'avenge' in eff else 0) if f == (eff.get('avenge') or ('',))[0] else 0,
                        'burn': 0.0, 'burnt': 0.0, 'dead': False})
        return out

    def fight(self, pa, pb):
        units = self.team(pa, 0) + self.team(pb, 1)
        n = len(units)
        frames, hits = [], []
        spawn = [[u['u'], u['star'], u['side']] for u in units]
        t = 0
        ticks = int(FIGHT_MAX / TICK)

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

        for t in range(ticks):
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
                foes = sides[1 - u['side']]
                foes = [f for f in foes if not f['dead']]
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
                    crit = random.random() < u['crit']
                    dmg = u['atk'] * (1.8 if crit else 1)
                    hurt(tgt, dmg, u, 'atk')
                    if u['burnfx']:
                        tgt['burn'], tgt['burnt'] = u['burnfx'] * TIER_POWER[UNITS[u['u']]['tier']] * 2, 3.0
                    u['mana'] = min(100, u['mana'] + 12)
                    hits.append([t, i, units.index(tgt), round(dmg), 1 if crit else 0])
            if t % FRAME_EVERY == 0:
                frames.append([v for u in units for v in (round(u['x'] * 10), round(u['y'] * 10), 0 if u['dead'] else max(1, round(100 * u['hp'] / u['max'])), round(u['mana']))])
        frames.append([v for u in units for v in (round(u['x'] * 10), round(u['y'] * 10), 0 if u['dead'] else max(1, round(100 * u['hp'] / u['max'])), round(u['mana']))])
        a = sum(1 for u in units if u['side'] == 0 and not u['dead'])
        b = sum(1 for u in units if u['side'] == 1 and not u['dead'])
        win = 2 if (a and b) or (not a and not b) else 0 if a else 1
        return {'units': spawn, 'frames': frames, 'hits': hits[:900], 'win': win, 'left': a if win == 0 else b if win == 1 else 0, 'dur': round((t + 1) * TICK, 1)}

    def cast(self, u, tgt, units, hurt, hits, t, i):
        kind = FAM[UNITS[u['u']]['f']][4][0]
        power = u['atk'] * 2.4
        if kind == 'frappe':
            hurt(tgt, power * 1.3, u, 'spell')
            hits.append([t, i, units.index(tgt), round(power * 1.3), 2])
        elif kind == 'zone':
            for o in units:
                if o['side'] != u['side'] and not o['dead'] and math.hypot(o['x'] - tgt['x'], o['y'] - tgt['y']) < 1.7:
                    hurt(o, power * 0.8, u, 'spell')
                    hits.append([t, i, units.index(o), round(power * 0.8), 3])
        elif kind == 'garde':
            u['shield'] += u['max'] * 0.3
            hits.append([t, i, i, 0, 4])
        else:
            mates = [o for o in units if o['side'] == u['side'] and not o['dead']]
            o = min(mates, key=lambda m: m['hp'] / m['max'])
            o['hp'] = min(o['max'], o['hp'] + power * 1.2)
            hits.append([t, i, units.index(o), round(power * 1.2), 5])

    # ---------------- robots ----------------
    def bot_turn(self, p):
        fam = {}
        for v in list(p.board.values()) + [x for x in p.bench if x]:
            fam[UNITS[v[0]]['f']] = fam.get(UNITS[v[0]]['f'], 0) + 1
        for _ in range(3):
            for i, u in enumerate(p.shop):
                if u is None or p.gold < UNITS[u]['cost']:
                    continue
                f = UNITS[u]['f']
                have = any(v and v[0] == u for v in list(p.board.values()) + p.bench)
                if have or fam.get(f, 0) >= 1 or UNITS[u]['tier'] >= 2 or len(p.board) + sum(1 for b in p.bench if b) < p.level:
                    self.buy(p, i)
                    fam[f] = fam.get(f, 0) + 1
            if p.gold >= 14 and p.level < 9:
                self.buy_xp(p)
            elif p.gold >= 12:
                p.gold -= 2
                self.roll(p)
        # le banc monte sur l'atelier, les plus solides devant (rang 0 = au contact)
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

    # ---------------- état envoyé ----------------
    def completed(self, seat):
        return True

    def init_payload(self):
        return {'tq': {'units': UNITS, 'families': [{'id': f[0], 'n': f[1], 'c': f[2], 'spell': f[4][1], 'sd': f[4][2], 'eff': f[5][1], 'lv': f[5][2]} for f in FAMILIES],
                       'rarity': RARITY, 'cols': COLS, 'rows': ROWS, 'bench': BENCH, 'odds': {str(k): v for k, v in ODDS.items()}, 'xp': {str(k): v for k, v in XP_NEED.items()}, 'frame': FRAME_EVERY * TICK, 'tick': TICK}}

    def view(self):
        return {
            'phase': self.phase, 'round': self.round, 'left': round(self.left, 1), 'finished': self.finished,
            'p': [{'n': p.name, 'b': p.bot, 'hp': max(0, p.hp), 'gold': p.gold, 'lv': p.level, 'xp': p.xp, 'streak': p.streak, 'last': p.last, 'opp': p.opp, 'ready': p.ready,
                   'board': [[k[0], k[1], v[0], v[1]] for k, v in p.board.items()], 'bench': p.bench, 'shop': p.shop} for p in self.p],
            'fights': self.fights if self.phase == 'combat' else [],
        }
