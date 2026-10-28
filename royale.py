"""Coulée Royale : FPS / TPS battle royale des métiers de la métallurgie (serveur, 30 images/s).

Quatre cartes : la halle de coulée, la forge, le laminoir et le parc à ferraille. Tout le monde part accroché
au pont roulant et saute quand il veut, puis plane jusqu'au sol. Chacun arrive à mains nues avec 100 PV :
les armes de la métallurgie (rareté variable) sont rangées dans des coffres qu'on ouvre avec E ; on ramasse
une arme avec E et on lâche celle qu'on tient avec G. La fonte en fusion envahit la carte ; le dernier debout gagne.

Déplacements : vraie physique (accélération, inertie, sprint, saut et gravité, marches et toits d'obstacles).
Chaque navigateur prédit son propre personnage et envoie sa position ; le serveur vérifie qu'elle est
atteignable (vitesse, murs, hauteur de saut) et renvoie le joueur à sa dernière position valide sinon.
Les robots et les joueurs déconnectés sont simulés ici avec exactement la même physique que le navigateur.
Les tirs (projectiles 3D, mêlée) sont toujours tranchés par le serveur, avec tirs à la tête x1,5."""
from __future__ import annotations
import math
import random
import time

FPS = 30
PR = 18                      # rayon d'un joueur
BODY = 104                   # taille d'un joueur
EYE = 92                     # hauteur des yeux
HEAD = 82                    # au-dessus : tir à la tête
CELL = 200
COUNTDOWN = 3.0

# physique (identique dans public/royale.js)
WALK = 240
SPRINT = 1.4
ACC_GROUND = 10.0
ACC_AIR = 2.0
JUMP_V = 430
GRAVITY = 1350
STEP = 30                    # hauteur franchie sans sauter

L, R, U, D, FIRE, PICK, SWAP, JUMP, RUN, DROP = 1, 2, 4, 8, 16, 32, 64, 128, 256, 512

RARITY = [  # nom, multiplicateur de dégâts, couleur, poids d'apparition
    ('commun', 1.0, '#b8bcc2', 55),
    ('rare', 1.2, '#5AA8FF', 28),
    ('épique', 1.45, '#C77DFF', 13),
    ('légendaire', 1.8, '#F5B700', 4),
]

WEAPONS = {
    'poings':    dict(name='Poings', kind='melee', dmg=7, cd=0.45, range=46, arc=1.2),
    'pince':     dict(name='Pince de forgeron', kind='melee', dmg=12, cd=0.3, range=58, arc=1.2),
    'marteau':   dict(name='Marteau de forge', kind='melee', dmg=22, cd=0.55, range=66, arc=1.3),
    'masse':     dict(name='Masse à frapper', kind='melee', dmg=36, cd=1.1, range=76, arc=1.4, kb=420),
    'ringard':   dict(name='Ringard', kind='melee', dmg=18, cd=0.6, range=112, arc=0.5),
    'riveteuse': dict(name='Riveteuse', kind='gun', dmg=9, cd=0.13, speed=1900, life=0.55, spread=0.028, pellets=1, proj='rivet', grav=0),
    'grenaille': dict(name='Canon à grenaille', kind='gun', dmg=7, cd=0.9, speed=1300, life=0.3, spread=0.13, pellets=8, proj='pellet', grav=0),
    'louche':    dict(name='Louche de fonte', kind='gun', dmg=28, cd=1.15, speed=820, life=1.6, spread=0.01, pellets=1, proj='blob', splash=80, grav=700),
    'chalumeau': dict(name='Chalumeau', kind='gun', dmg=3.4, cd=0.06, speed=520, life=0.38, spread=0.09, pellets=1, proj='flame', grav=-120),
}
LOOT_WEAPONS = [k for k in WEAPONS if k != 'poings']

METIERS = {
    'forgeron':      {'name': 'Forgeron', 'color': '#BA2C3A', 'perk': '+15 % de dégâts en mêlée', 'melee': 1.15},
    'fondeur':       {'name': 'Fondeur', 'color': '#EC641E', 'perk': '-40 % de dégâts dans la fonte', 'zone': 0.6},
    'mouleur':       {'name': 'Mouleur', 'color': '#8A8D91', 'perk': '+8 % de vitesse', 'speed': 1.08},
    'noyauteur':     {'name': 'Noyauteur', 'color': '#C4A06E', 'perk': 'saute 20 % plus haut', 'jump': 1.1},
    'ebarbeur':      {'name': 'Ébarbeur', 'color': '#2E3238', 'perk': 'cadence de tir +12 %', 'rate': 0.88},
    'lamineur':      {'name': 'Lamineur', 'color': '#5AA8FF', 'perk': 'commence avec 35 d\'armure', 'armor': 35},
    'chaudronnier':  {'name': 'Chaudronnier', 'color': '#7FD48A', 'perk': '-12 % de dégâts reçus', 'tough': 0.88},
    'soudeur':       {'name': 'Soudeur', 'color': '#F5B700', 'perk': '+20 % au chalumeau et à la louche', 'fire': 1.2},
    'metallurgiste': {'name': 'Métallurgiste', 'color': '#C77DFF', 'perk': 'voit les coffres et les armes rares sur la mini-carte', 'sight': True},
}
KILL_HEAL = 25               # PV rendus par élimination (il n'y a pas de soins)
CHEST_ITEMS = 2              # armes éjectées par un coffre
REACH_ITEM = 55              # portée pour ramasser une arme
REACH_CHEST = 80             # portée pour ouvrir un coffre

# largage : tout le monde part du pont roulant qui traverse la carte, puis plane jusqu'au sol
BUS_TIME = 16.0
GLIDE_SPEED = 430
GLIDE_FALL = 200


# ======================= cartes =======================
class Arena:
    """Une carte : obstacles (boîtes posées au sol, hauteur z), grille de recherche et géométrie partagée."""
    def __init__(self, key, title, w, h, ceil, obs, sky=False):
        self.key, self.title, self.w, self.h, self.ceil, self.obs, self.sky = key, title, w, h, ceil, obs, sky
        self.grid = {}
        for o in obs:
            for gx in range(int(o['x'] // CELL), int((o['x'] + o['w']) // CELL) + 1):
                for gy in range(int(o['y'] // CELL), int((o['y'] + o['h']) // CELL) + 1):
                    self.grid.setdefault((gx, gy), []).append(o)
        self.bus_z = ceil - 140

    def around(self, x, y):
        cx, cy = int(x // CELL), int(y // CELL)
        seen = []
        for gx in (cx - 1, cx, cx + 1):
            for gy in (cy - 1, cy, cy + 1):
                for o in self.grid.get((gx, gy), ()):
                    if o not in seen:
                        seen.append(o)
        return seen

    def ground_at(self, x, y, z):
        """Sol sous les pieds : le plus haut dessus d'obstacle atteignable (pas plus haut que z + STEP)."""
        g = 0
        for o in self.around(x, y):
            if g < o['z'] <= z + STEP and touches(o, x, y, PR * 0.7):
                g = o['z']
        return g

    def body_blocked(self, x, y, z):
        if x < PR or y < PR or x > self.w - PR or y > self.h - PR:
            return True
        return any(o['z'] > z + STEP and touches(o, x, y, PR - 1) for o in self.around(x, y))

    def map_at(self, x, y, z):
        for o in self.grid.get((int(x // CELL), int(y // CELL)), ()):
            if o['x'] <= x <= o['x'] + o['w'] and o['y'] <= y <= o['y'] + o['h'] and z <= o['z']:
                return o
        return None

    def point_blocked(self, x, y, z):
        if x < 0 or y < 0 or x > self.w or y > self.h or z < 0 or z > self.ceil:
            return True
        return self.map_at(x, y, z) is not None

    def seg_clear(self, x1, y1, z1, x2, y2, z2):
        n = int(math.hypot(x2 - x1, y2 - y1) // 25) + 1
        return not any(self.point_blocked(x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n, z1 + (z2 - z1) * k / n) for k in range(1, n))

    def free_spot(self, rnd, margin=40):
        for _ in range(500):
            x, y = rnd.uniform(90, self.w - 90), rnd.uniform(90, self.h - 90)
            if not any(abs(x - (o['x'] + o['w'] / 2)) < o['w'] / 2 + margin and abs(y - (o['y'] + o['h'] / 2)) < o['h'] / 2 + margin
                       for o in self.around(x, y)):
                return x, y
        return self.w / 2, self.h / 2


def touches(o, x, y, r):
    nx = min(max(x, o['x']), o['x'] + o['w'])
    ny = min(max(y, o['y']), o['y'] + o['h'])
    return (x - nx) ** 2 + (y - ny) ** 2 < r * r


def scatter(rnd, obs, add, w, h, kinds, total, gap=70, tries=6000):
    """Disperse des obstacles sans qu'ils se touchent (couloirs d'au moins `gap`)."""
    n = 0
    while len(obs) < total and n < tries:
        n += 1
        k, ow, oh = rnd.choice(kinds)
        x, y = rnd.uniform(80, w - 80 - ow), rnd.uniform(80, h - 80 - oh)
        if any(x < o['x'] + o['w'] + gap and x + ow + gap > o['x'] and y < o['y'] + o['h'] + gap and y + oh + gap > o['y'] for o in obs):
            continue
        add(round(x), round(y), ow, oh, k)


def walls(add, w, h, kind='mur'):
    t = 40
    add(0, 0, w, t, kind); add(0, h - t, w, t, kind); add(0, 0, t, h, kind); add(w - t, 0, t, h, kind)


def pillars(obs, add, w, h, step=600, y0=700):
    for gx in range(400, w - 200, step):
        for gy in range(y0, h - 200, step):
            if not any(abs(gx - (o['x'] + o['w'] / 2)) < o['w'] / 2 + 60 and abs(gy - (o['y'] + o['h'] / 2)) < o['h'] / 2 + 60 for o in obs):
                add(gx - 22, gy - 22, 44, 44, 'pilier')


def steps_to(obs, add, kind_from, step_kind='moules', every=2):
    """Marches pour grimper sur certains gros obstacles : une pile collée contre eux."""
    for o in [o for o in obs if o['k'] == kind_from][::every]:
        x, y = (o['x'] - 96, o['y'] + 4) if o['w'] < o['h'] else (o['x'] + 4, o['y'] - 96)
        if 60 < x and 60 < y and not any(x < q['x'] + q['w'] and x + 92 > q['x'] and y < q['y'] + q['h'] and y + 92 > q['y'] for q in obs):
            add(x, y, 92, 92, step_kind)


def map_halle():
    W, H, C = 4400, 3000, 700
    hz = {'mur': C, 'four': 220, 'convoyeur': 40, 'bureau': 190, 'silo': 320, 'pilier': C, 'moules': 90, 'conteneur': 150, 'poche': 120, 'palette': 28}
    rnd, obs = random.Random(1012), []
    add = lambda x, y, w, h, k: obs.append({'x': x, 'y': y, 'w': w, 'h': h, 'k': k, 'z': hz[k]})
    walls(add, W, H)
    for i in range(5):
        add(1060 + i * 500, 480, 170, 170, 'four')
    add(960, 1440, 1000, 60, 'convoyeur'); add(2440, 1440, 1000, 60, 'convoyeur')
    add(160, 2560, 420, 300, 'bureau'); add(160, 2100, 160, 220, 'silo')
    for i in range(3):
        add(3800 + i * 150, 140, 110, 110, 'silo')
    pillars(obs, add, W, H)
    scatter(rnd, obs, add, W, H, [('moules', 110, 110), ('moules', 90, 160), ('conteneur', 240, 100), ('conteneur', 100, 240), ('poche', 90, 90), ('palette', 120, 70)], 170)
    steps_to(obs, add, 'conteneur')
    return Arena('halle', 'Halle de coulée', W, H, C, obs)


def map_forge():
    W, H, C = 3600, 3600, 620
    hz = {'mur': C, 'pilon': 380, 'foyer': 110, 'enclume': 45, 'barres': 120, 'cuve': 60, 'etabli': 80, 'pilier': C, 'palette': 28, 'moules': 90}
    rnd, obs = random.Random(2077), []
    add = lambda x, y, w, h, k: obs.append({'x': x, 'y': y, 'w': w, 'h': h, 'k': k, 'z': hz[k]})
    walls(add, W, H)
    # îlots de forge : un marteau-pilon, son foyer, une enclume et une cuve de trempe
    for cx in (700, 1800, 2900):
        for cy in (700, 1800, 2900):
            if (cx, cy) == (1800, 1800):
                continue
            add(cx - 80, cy - 60, 160, 120, 'pilon')
            add(cx - 230, cy - 70, 120, 140, 'foyer')
            add(cx + 130, cy - 20, 70, 40, 'enclume')
            add(cx - 60, cy + 150, 160, 90, 'cuve')
    add(1640, 1640, 320, 320, 'pilon')        # le gros pilon au centre
    pillars(obs, add, W, H, 700, 400)
    scatter(rnd, obs, add, W, H, [('barres', 220, 60), ('barres', 60, 220), ('etabli', 160, 70), ('enclume', 70, 40), ('palette', 120, 70), ('moules', 92, 92)], 150)
    steps_to(obs, add, 'barres', 'palette', 3)
    return Arena('forge', 'La Forge', W, H, C, obs)


def map_laminoir():
    W, H, C = 5600, 2400, 800
    hz = {'mur': C, 'cage': 260, 'rouleaux': 30, 'bobine': 120, 'brames': 70, 'cabine': 220, 'pilier': C, 'conteneur': 150, 'palette': 28}
    rnd, obs = random.Random(3141), []
    add = lambda x, y, w, h, k: obs.append({'x': x, 'y': y, 'w': w, 'h': h, 'k': k, 'z': hz[k]})
    walls(add, W, H)
    # le train de laminage : cages espacées et tables à rouleaux entre elles
    y = H / 2 - 130
    for i in range(10):
        x = 500 + i * 470
        add(x, y, 140, 260, 'cage')
        if i < 9:
            add(x + 140, y + 95, 330, 70, 'rouleaux')
    add(260, 260, 260, 200, 'cabine'); add(W - 520, H - 460, 260, 200, 'cabine')
    pillars(obs, add, W, H, 700, 400)
    scatter(rnd, obs, add, W, H, [('bobine', 120, 120), ('bobine', 120, 120), ('brames', 260, 120), ('brames', 120, 260), ('conteneur', 240, 100), ('palette', 120, 70)], 160)
    steps_to(obs, add, 'conteneur', 'brames', 2)
    return Arena('laminoir', 'Le Laminoir', W, H, C, obs)


def map_ferraille():
    W, H, C = 4200, 4200, 1300
    hz = {'cloture': 300, 'tas': 160, 'cube': 100, 'conteneur': 150, 'grue': 900, 'benne': 110, 'presse': 220, 'palette': 28, 'pilier': 900}
    rnd, obs = random.Random(4242), []
    add = lambda x, y, w, h, k: obs.append({'x': x, 'y': y, 'w': w, 'h': h, 'k': k, 'z': hz[k]})
    walls(add, W, H, 'cloture')
    for x, y in ((1000, 1000), (3100, 1100), (2100, 3100)):
        add(x, y, 90, 90, 'grue')
    add(1900, 1900, 320, 200, 'presse')
    # allées de cubes compactés empilés
    for row in range(3):
        for k in range(6):
            add(600 + k * 130, 2900 + row * 130, 100, 100, 'cube')
    scatter(rnd, obs, add, W, H, [('tas', 260, 260), ('tas', 200, 200), ('cube', 100, 100), ('conteneur', 240, 100), ('conteneur', 100, 240), ('benne', 240, 120), ('palette', 120, 70)], 150, gap=80)
    steps_to(obs, add, 'conteneur', 'cube', 2)
    return Arena('ferraille', 'Parc à ferraille', W, H, C, obs, sky=True)


MAPS = {m.key: m for m in (map_halle(), map_forge(), map_laminoir(), map_ferraille())}


def physics(p, wx, wy, run, jump, dt, M, mp):
    """Un pas de physique : accélération vers la vitesse voulue, inertie, saut, gravité, vol plané, collisions."""
    glide = p.get('gl')
    sp = GLIDE_SPEED if glide else WALK * M.get('speed', 1.0) * (SPRINT if run else 1.0)
    k = min(1.0, (3.0 if glide else ACC_GROUND if p['gd'] else ACC_AIR) * dt)
    p['vx'] += (wx * sp - p['vx']) * k
    p['vy'] += (wy * sp - p['vy']) * k
    if jump and p['gd']:
        p['vz'] = JUMP_V * M.get('jump', 1.0)
        p['gd'] = False
    p['vz'] -= GRAVITY * dt
    if glide:
        p['vz'] = max(p['vz'], -GLIDE_FALL)
    for axis, v in (('x', 'vx'), ('y', 'vy')):
        old = p[axis]
        p[axis] += p[v] * dt
        if mp.body_blocked(p['x'], p['y'], p['z']):
            p[axis] = old
            p[v] = 0.0
    p['z'] += p['vz'] * dt
    g = mp.ground_at(p['x'], p['y'], max(p['z'], 0))
    if p['z'] <= g:
        p['z'], p['vz'], p['gd'] = float(g), 0.0, True
        p['gl'] = False
    else:
        p['gd'] = False
    if p['z'] + BODY > mp.ceil:
        p['z'], p['vz'] = mp.ceil - BODY, min(0.0, p['vz'])


def roll_rarity(rnd, bonus=0):
    weights = [x[3] * (1 + bonus * i) for i, x in enumerate(RARITY)]
    r = rnd.uniform(0, sum(weights))
    for i, w in enumerate(weights):
        r -= w
        if r <= 0:
            return i
    return 0


def wrap(a):
    return math.atan2(math.sin(a), math.cos(a))


class Royale:
    kind = 'royale'
    max_seats = 16
    min_seats = 10
    stream = True
    send_every = 2           # état envoyé 15 fois par seconde (les navigateurs interpolent)

    def __init__(self, seats):
        self.rnd = random.Random()
        want = next(((s.get('opt') or {}).get('map') for s in seats if not s['bot'] and (s.get('opt') or {}).get('map')), None)
        self.mp = MAPS.get(want) or self.rnd.choice(list(MAPS.values()))
        mp = self.mp
        metiers = list(METIERS)
        self.p = []
        for i, s in enumerate(seats):
            m = (s.get('opt') or {}).get('char')
            if m not in METIERS:
                m = metiers[i % len(metiers)] if s['bot'] else 'fondeur'
            # chacun a sa place le long du pont roulant (axe y), qui avance ensuite le long de la carte (axe x)
            y = 260 + (mp.h - 520) * (i + 0.5) / len(seats) + self.rnd.uniform(-40, 40)
            M = METIERS[m]
            self.p.append({'name': s['name'], 'bot': s['bot'], 'm': m, 'x': 200.0, 'y': y, 'z': float(mp.bus_z), 'bus': True, 'gl': False, 'lane': y,
                           'vx': 0.0, 'vy': 0.0, 'vz': 0.0, 'gd': False,
                           'yaw': 0.0, 'pitch': 0.0, 'hp': 100.0, 'ar': float(M.get('armor', 0)),
                           'slots': [None, None], 'cur': 0, 'cd': 0.0, 'alive': True, 'kills': 0, 'died': None, 'by': None,
                           'swing': 0.0, 'tp': 1, 'srv': s['bot'], 'seen': 0.0, 'kbt': 0.0,
                           'ai': {'t': 0, 'goal': None, 'side': 1, 'react': 0, 'stuck': 0, 'last': None, 'drop': self.rnd.uniform(1.0, BUS_TIME - 1.5)}})
        self.inputs = [{'k': 0, 'press': 0} for _ in self.p]
        self.loot = []
        self.lid = 0
        # coffres : la plupart au sol, quelques-uns sur les toits pour ceux qui grimpent
        self.chests = []
        tops = [o for o in mp.obs if 60 <= o['z'] <= 230 and o['w'] >= 90 and o['h'] >= 90]
        n_chests = int(mp.w * mp.h / 300000)
        for n in range(n_chests):
            if n % 7 == 0 and tops:
                o = self.rnd.choice(tops)
                x, y, z = o['x'] + o['w'] / 2, o['y'] + o['h'] / 2, o['z']
            else:
                (x, y), z = mp.free_spot(self.rnd, 45), 0
            self.chests.append({'id': n, 'x': round(x), 'y': round(y), 'z': round(z), 'a': round(self.rnd.uniform(-math.pi, math.pi), 2),
                                'open': False, 'bonus': 0.6 if z else 0.25})
        self.chests_dirty = True
        self.proj = []
        self.crane = 200.0
        self.events, self.eid = [], 0
        r0 = math.hypot(mp.w, mp.h) / 2 + 150
        k = min(mp.w, mp.h) / 3000
        self.phases = [(45, 25, 1850 * k, 1), (25, 22, 1120 * k, 3), (20, 20, 600 * k, 6), (15, 18, 240 * k, 10), (10, 15, 0, 16)]
        self.zone = {'cx': mp.w / 2, 'cy': mp.h / 2, 'r': r0, 'phase': 0, 't': self.phases[0][0], 'shrink': False,
                     'from': (mp.w / 2, mp.h / 2, r0), 'to': None, 'dps': 0}
        self.next_zone_target()
        self.phase, self.pt = 'count', COUNTDOWN
        self.time = 0.0
        self.acc = 0.0
        self.frame = 0
        self.loot_dirty = True
        self.finished = None
        self.dirty = True

    # ---------------- butin : coffres et armes au sol ----------------
    def spawn_loot(self, x, y, z, wid=None, rar=None, bonus=0.0):
        self.lid += 1
        self.loot.append({'id': self.lid, 'x': round(x), 'y': round(y), 'z': round(z),
                          'w': wid or self.rnd.choice(LOOT_WEAPONS), 'r': roll_rarity(self.rnd, bonus) if rar is None else rar})
        self.loot_dirty = True

    def open_chest(self, i, c):
        c['open'] = True
        self.chests_dirty = True
        for k in range(CHEST_ITEMS):
            a = c['a'] + (k - (CHEST_ITEMS - 1) / 2) * 0.9
            x, y = c['x'] + math.cos(a) * 46, c['y'] + math.sin(a) * 46
            if self.mp.body_blocked(x, y, c['z']):
                x, y = c['x'], c['y']
            self.spawn_loot(x, y, self.mp.ground_at(x, y, c['z'] + 5), bonus=c['bonus'])
        self.event('chest', c['x'], c['y'], c['z'], seat=i, cid=c['id'])

    def interact(self, i):
        """E : ramasse l'arme la plus proche, sinon ouvre le coffre le plus proche."""
        p = self.p[i]
        near = lambda o, r: (o['x'] - p['x']) ** 2 + (o['y'] - p['y']) ** 2 <= r * r and abs(o['z'] - p['z']) < 70
        items = sorted((it for it in self.loot if near(it, REACH_ITEM)), key=lambda it: (it['x'] - p['x']) ** 2 + (it['y'] - p['y']) ** 2)
        if items:
            it = items[0]
            slot = p['cur'] if p['slots'][p['cur']] is None else (1 - p['cur'] if p['slots'][1 - p['cur']] is None else p['cur'])
            old = p['slots'][slot]
            p['slots'][slot] = {'w': it['w'], 'r': it['r']}
            p['cur'] = slot
            self.loot.remove(it)
            self.loot_dirty = True
            if old:
                self.spawn_loot(it['x'], it['y'], it['z'], old['w'], old['r'])
            self.event('pick', p['x'], p['y'], p['z'], seat=i, w=it['w'], r=it['r'])
            return
        chests = sorted((c for c in self.chests if not c['open'] and near(c, REACH_CHEST)), key=lambda c: (c['x'] - p['x']) ** 2 + (c['y'] - p['y']) ** 2)
        if chests:
            self.open_chest(i, chests[0])

    def drop_weapon(self, i):
        """G : lâche l'arme tenue devant soi (on repasse aux poings)."""
        p = self.p[i]
        s = p['slots'][p['cur']]
        if not s:
            return
        p['slots'][p['cur']] = None
        x, y = p['x'] + math.cos(p['yaw']) * 40, p['y'] + math.sin(p['yaw']) * 40
        if self.mp.body_blocked(x, y, p['z']):
            x, y = p['x'], p['y']
        self.spawn_loot(x, y, self.mp.ground_at(x, y, p['z'] + 5), s['w'], s['r'])
        self.event('throw', p['x'], p['y'], p['z'], seat=i, w=s['w'])

    # ---------------- zone de fonte ----------------
    def next_zone_target(self):
        z, mp = self.zone, self.mp
        if z['phase'] >= len(self.phases):
            return
        tr = self.phases[z['phase']][2]
        for _ in range(50):
            a, d = self.rnd.uniform(0, math.tau), self.rnd.uniform(0, max(0, min(z['r'], 1500) - tr))
            cx, cy = z['cx'] + math.cos(a) * d, z['cy'] + math.sin(a) * d
            if 400 < cx < mp.w - 400 and 400 < cy < mp.h - 400:
                break
        else:
            cx, cy = mp.w / 2, mp.h / 2
        z['to'] = (cx, cy, float(tr))

    def update_zone(self, dt):
        z = self.zone
        if z['phase'] >= len(self.phases):
            return
        wait, dur, _, dps = self.phases[z['phase']]
        z['t'] -= dt
        if not z['shrink'] and z['t'] <= 0:
            z['shrink'], z['t'], z['from'] = True, dur, (z['cx'], z['cy'], z['r'])
            z['dps'] = dps
            self.event('zone', 0, 0, msg='La fonte avance !')
        elif z['shrink']:
            k = 1 - max(0.0, z['t']) / dur
            f, to = z['from'], z['to']
            z['cx'], z['cy'], z['r'] = f[0] + (to[0] - f[0]) * k, f[1] + (to[1] - f[1]) * k, f[2] + (to[2] - f[2]) * k
            if z['t'] <= 0:
                z['shrink'] = False
                z['phase'] += 1
                if z['phase'] < len(self.phases):
                    z['t'] = self.phases[z['phase']][0]
                    self.next_zone_target()

    # ---------------- entrées ----------------
    def handle(self, seat, data):
        if seat >= len(self.p) or data.get('a') != 'input':
            return
        try:
            k = int(data.get('k', 0)) & 1023
            yaw = float(data.get('yaw', 0.0))
            pitch = max(-1.45, min(1.45, float(data.get('pitch', 0.0))))
            pos = data.get('pos')
            tp = int(data.get('tp', 0))
        except (TypeError, ValueError):
            return
        if not (math.isfinite(yaw) and math.isfinite(pitch)):
            return
        p = self.p[seat]
        inp = self.inputs[seat]
        inp['press'] |= k & ~inp['k']
        inp['k'] = k
        p['yaw'], p['pitch'] = wrap(yaw), pitch
        if pos is not None:
            self.client_move(p, pos, tp)

    def client_move(self, p, pos, tp):
        """Le navigateur annonce sa position prédite : acceptée si elle est atteignable, sinon le joueur est recalé."""
        now = time.monotonic()
        if not p['alive'] or self.phase != 'play' or p['bus']:
            return
        if p['srv']:   # reprise de contrôle après une déconnexion : on recale d'abord le navigateur
            p['srv'] = False
            p['tp'] += 1
            p['seen'] = now
            return
        if tp != p['tp']:
            return     # message parti avant le dernier recalage
        try:
            x, y, z, vz = (float(v) for v in pos[:4])
        except (TypeError, ValueError):
            return
        if not all(math.isfinite(v) for v in (x, y, z, vz)):
            return
        mp = self.mp
        el = min(0.6, max(0.0, now - p['seen'])) if p['seen'] else 0.1
        allowed = (GLIDE_SPEED * 1.15 if p['gl'] else WALK * SPRINT * 1.12) * el + 30 + (180 if p['kbt'] > 0 else 0)
        gz = mp.ground_at(x, y, z)
        p['air'] = 0.0 if p['gl'] or z <= gz + 2 else p.get('air', 0.0) + el
        ok = (math.hypot(x - p['x'], y - p['y']) <= allowed and z >= 0 and not mp.body_blocked(x, y, z)
              and z <= p['z'] + JUMP_V * 1.25 * el + STEP + 10      # on ne monte pas plus vite qu'un saut
              and (z <= gz + 95 or z <= p['z'] + 1)                  # très haut : seulement en retombant
              and p['air'] < 2.0)                                    # pas de vol plané hors largage
        if ok:
            p['vx'], p['vy'] = (x - p['x']) / max(el, 1 / FPS), (y - p['y']) / max(el, 1 / FPS)
            p['x'], p['y'], p['z'], p['vz'] = x, y, z, vz
            p['gd'] = z <= mp.ground_at(x, y, z) + 1
            if p['gd']:
                p['gl'] = False
        else:
            p['tp'] += 1
            p['vx'] = p['vy'] = 0.0
            p['air'] = 0.0
        p['seen'] = now

    def tick(self, dt, connected):
        self.acc += dt
        steps = 0
        while self.acc >= 1 / FPS and steps < 4:
            self.acc -= 1 / FPS
            steps += 1
            self.step(connected)
        if steps == 4:
            self.acc = 0.0

    def event(self, kind, x, y, z=0, **kw):
        self.eid += 1
        self.events.append({'id': self.eid, 'k': kind, 'x': round(x), 'y': round(y), 'z': round(z), **kw})
        self.events = self.events[-40:]

    # ---------------- simulation ----------------
    def step(self, connected):
        dt = 1 / FPS
        self.frame += 1
        if self.finished is not None:
            return
        if self.phase == 'count':
            self.pt -= dt
            if self.pt <= 0:
                self.phase = 'play'
                now = time.monotonic()
                for p in self.p:
                    p['seen'] = now
            return
        self.time += dt
        self.update_zone(dt)
        z, mp = self.zone, self.mp
        self.crane = 200 + (mp.w - 400) * min(1.0, self.time / BUS_TIME)
        for i, p in enumerate(self.p):
            if not p['alive']:
                continue
            M = METIERS[p['m']]
            inp = self.inputs[i]
            if p['bus']:   # accroché au pont roulant : Espace pour sauter (automatique en bout de course)
                p['x'], p['y'], p['z'], p['vx'], p['vy'], p['vz'] = self.crane, p['lane'], float(mp.bus_z), 0.0, 0.0, 0.0
                press = inp['press']
                inp['press'] = 0
                auto = (p['bot'] or not connected(i)) and self.time >= p['ai']['drop']
                if press & JUMP or auto or self.time >= BUS_TIME:
                    p['bus'], p['gl'], p['gd'] = False, True, False
                    p['tp'] += 1
                    p['seen'] = time.monotonic()
                    self.event('drop', p['x'], p['y'], p['z'], seat=i)
                continue
            if p['bot'] or not connected(i):
                if not p['srv']:
                    p['srv'] = True
                wish = self.ai(i)
            else:
                wish = None
            k, press = inp['k'], inp['press']
            inp['press'] = 0
            if p['srv']:
                wx, wy = wish if wish else (0.0, 0.0)
                physics(p, wx, wy, bool(k & RUN), bool(k & JUMP), dt, M, mp)
            p['kbt'] = max(0.0, p['kbt'] - dt)
            if press & SWAP:
                p['cur'] = 1 - p['cur']
            if press & PICK:
                self.interact(i)
            if press & DROP:
                self.drop_weapon(i)
            p['cd'] -= dt
            p['swing'] = max(0.0, p['swing'] - dt)
            if k & FIRE and p['cd'] <= 0 and not p['gl']:
                self.attack(i)
            if math.hypot(p['x'] - z['cx'], p['y'] - z['cy']) > z['r']:
                self.damage(None, i, max(1, z['dps']) * M.get('zone', 1.0) * dt, zone=True)
        self.update_proj(dt)
        alive = [i for i, p in enumerate(self.p) if p['alive']]
        if len(alive) <= 1:
            self.finished = alive + sorted([i for i, p in enumerate(self.p) if not p['alive']], key=lambda i: -self.p[i]['died'])
            self.phase = 'over'
            if alive:
                w = self.p[alive[0]]
                self.event('win', w['x'], w['y'], w['z'], msg=f"{w['name']} est le dernier debout !")

    def weapon(self, p):
        s = p['slots'][p['cur']]
        return (s['w'], s['r']) if s else ('poings', 0)

    def attack(self, i):
        p, mp = self.p[i], self.mp
        wid, rar = self.weapon(p)
        Wp = WEAPONS[wid]
        M = METIERS[p['m']]
        mult = RARITY[rar][1]
        p['cd'] = Wp['cd'] * M.get('rate', 1.0)
        yaw, pitch = p['yaw'], p['pitch']
        ex, ey, ez = p['x'], p['y'], p['z'] + EYE
        if Wp['kind'] == 'melee':
            p['swing'] = 0.25
            dmg = Wp['dmg'] * mult * M.get('melee', 1.0)
            self.event('swing', p['x'], p['y'], p['z'], seat=i, w=wid)
            for j, o in enumerate(self.p):
                if j == i or not o['alive'] or o['bus']:
                    continue
                dx, dy = o['x'] - p['x'], o['y'] - p['y']
                dist = math.hypot(dx, dy)
                if dist > Wp['range'] + PR or abs(o['z'] - p['z']) > 75:
                    continue
                if abs(wrap(math.atan2(dy, dx) - yaw)) <= Wp['arc'] / 2 + 0.3 and mp.seg_clear(ex, ey, ez - 30, o['x'], o['y'], o['z'] + 55):
                    self.damage(i, j, dmg)
                    if Wp.get('kb') and o['alive']:
                        kv = Wp['kb']
                        kx, ky = dx / max(dist, 1) * kv, dy / max(dist, 1) * kv
                        o['kbt'] = 0.6
                        if o['srv']:
                            o['vx'] += kx; o['vy'] += ky; o['vz'] = 260; o['gd'] = False
                        self.event('kb', o['x'], o['y'], o['z'], seat=j, vx=round(kx), vy=round(ky), vz=260)
            return
        dmg = Wp['dmg'] * mult * (M.get('fire', 1.0) if wid in ('chalumeau', 'louche') else 1.0)
        cp = math.cos(pitch)
        sx, sy, sz = ex + math.cos(yaw) * cp * 20, ey + math.sin(yaw) * cp * 20, ez - 8 + math.sin(pitch) * 20
        for _ in range(Wp['pellets']):
            a = yaw + self.rnd.gauss(0, Wp['spread'])
            b = pitch + self.rnd.gauss(0, Wp['spread'] * 0.7)
            sp = Wp['speed'] * self.rnd.uniform(0.94, 1.04)
            self.proj.append([sx, sy, sz, math.cos(a) * math.cos(b) * sp, math.sin(a) * math.cos(b) * sp, math.sin(b) * sp,
                              Wp['life'], i, dmg, Wp['proj'], Wp.get('splash', 0), rar, Wp['grav']])
        self.event('shot', p['x'], p['y'], p['z'], seat=i, w=wid)

    def body_hit(self, owner, x, y, z, rad):
        for j, o in enumerate(self.p):
            if j != owner and o['alive'] and not o['bus'] and (o['x'] - x) ** 2 + (o['y'] - y) ** 2 < (PR + rad) ** 2 and o['z'] - rad <= z <= o['z'] + BODY + rad:
                return j, z >= o['z'] + HEAD
        return None, False

    def update_proj(self, dt):
        keep = []
        for pr in self.proj:
            sub = max(1, int(math.hypot(pr[3], pr[4], pr[5]) * dt // 14) + 1)
            h = dt / sub
            hit = None
            rad = 10 if pr[9] in ('blob', 'flame') else 3
            for _ in range(sub):
                pr[5] -= pr[12] * h
                pr[0] += pr[3] * h; pr[1] += pr[4] * h; pr[2] += pr[5] * h
                pr[6] -= h
                if pr[6] <= 0:
                    hit = 'fade'
                    break
                if self.mp.point_blocked(pr[0], pr[1], pr[2]):
                    hit = 'wall'
                    break
                j, head = self.body_hit(pr[7], pr[0], pr[1], pr[2], rad)
                if j is not None:
                    self.damage(pr[7], j, pr[8] * (1.5 if head else 1.0), head=head)
                    hit = 'player'
                    break
            if hit:
                if pr[9] == 'blob' and hit != 'fade':
                    self.event('splash', pr[0], pr[1], pr[2])
                    for j, o in enumerate(self.p):
                        if j != pr[7] and o['alive'] and hit != 'player' and \
                                (o['x'] - pr[0]) ** 2 + (o['y'] - pr[1]) ** 2 + (o['z'] + 50 - pr[2]) ** 2 < pr[10] ** 2:
                            self.damage(pr[7], j, pr[8] * 0.5)
                elif hit == 'wall' and pr[9] in ('rivet', 'pellet'):
                    self.event('spark', pr[0], pr[1], pr[2])
                continue
            keep.append(pr)
        self.proj = keep

    def damage(self, src, dst, amount, zone=False, head=False):
        d = self.p[dst]
        if not d['alive'] or amount <= 0 or d['bus']:
            return
        if not zone:
            amount *= METIERS[d['m']].get('tough', 1.0)
            absorbed = min(d['ar'], amount * 0.6)
            d['ar'] -= absorbed
            amount -= absorbed
        d['hp'] -= amount
        if not zone:
            self.event('hit', d['x'], d['y'], d['z'], seat=dst, by=src, dmg=round(amount + 0.0, 1), hs=head)
            if src is not None:
                d['ai']['alert'], d['ai']['foe'] = 90, src
        if d['hp'] <= 0:
            d['hp'], d['alive'], d['died'], d['by'] = 0.0, False, self.time, src
            if src is not None:
                self.p[src]['kills'] += 1
                self.p[src]['hp'] = min(100.0, self.p[src]['hp'] + KILL_HEAL)
            g = self.mp.ground_at(d['x'], d['y'], d['z'])
            for s in d['slots']:
                if s:
                    self.spawn_loot(d['x'] + self.rnd.uniform(-30, 30), d['y'] + self.rnd.uniform(-30, 30), g, s['w'], s['r'])
            alive = sum(1 for p in self.p if p['alive'])
            killer = self.p[src]['name'] if src is not None else 'la fonte'
            self.event('kill', d['x'], d['y'], d['z'], seat=dst, by=src, hs=head,
                       msg=f"{killer} ✖ {d['name']}" + (f" ({WEAPONS[self.weapon(self.p[src])[0]]['name']})" if src is not None else ''),
                       left=alive)

    # ---------------- robots ----------------
    def ai(self, i):
        """Décide des touches du robot ; renvoie la direction voulue (x, y) pour la physique."""
        p, mp = self.p[i], self.mp
        ai = p['ai']
        inp = self.inputs[i]
        ai['t'] -= 1
        z = self.zone
        wid, rar = self.weapon(p)
        Wp = WEAPONS[wid]
        # ne remarque que ce qui est devant lui (ou tout près, ou qui vient de le toucher) ;
        # en début de partie il préfère s'équiper plutôt que de se battre de loin
        ai['alert'] = ai.get('alert', 0) - 1
        reach = 220 if self.time < 30 else 480
        best, bd = None, 1e9
        for j, o in enumerate(self.p):
            if j == i or not o['alive'] or o['bus']:
                continue
            d = math.hypot(o['x'] - p['x'], o['y'] - p['y'])
            foe = ai['alert'] > 0 and ai.get('foe') == j
            ahead = abs(wrap(math.atan2(o['y'] - p['y'], o['x'] - p['x']) - p['yaw'])) < 1.1
            if d < bd and (d < 150 or (foe and d < 700) or (ahead and d < reach)):
                best, bd = o, d
        mask = 0
        dz = math.hypot(p['x'] - z['cx'], p['y'] - z['cy'])
        target = None
        look = None
        seen = best is not None and not p['gl'] and mp.seg_clear(p['x'], p['y'], p['z'] + EYE, best['x'], best['y'], best['z'] + 60)
        if not seen:
            ai['react'] = 14 + self.rnd.randrange(14)      # temps de réaction quand quelqu'un apparaît
        if dz > z['r'] * 0.85 and (z['shrink'] or dz > z['r']):
            target = (z['cx'], z['cy'])
            mask |= RUN
        elif seen and (wid != 'poings' or bd < 220):
            ai['react'] -= 1
            yaw = math.atan2(best['y'] - p['y'], best['x'] - p['x'])
            pitch = math.atan2(best['z'] + 55 - (p['z'] + EYE), max(bd, 1))
            if Wp.get('grav'):
                pitch += 0.5 * math.asin(max(-1, min(1, Wp['grav'] * bd / Wp['speed'] ** 2)))
            look = (yaw + self.rnd.gauss(0, 0.085), pitch + self.rnd.gauss(0, 0.06))
            want = (Wp['range'] * 0.7) if Wp['kind'] == 'melee' else 300
            if bd > want + 40:
                target = (best['x'], best['y'])
                mask |= RUN if Wp['kind'] == 'melee' else 0
            elif bd < want - 80 and Wp['kind'] == 'gun':
                target = (2 * p['x'] - best['x'], 2 * p['y'] - best['y'])
            else:
                perp = yaw + math.pi / 2 * ai['side']
                target = (p['x'] + math.cos(perp) * 100, p['y'] + math.sin(perp) * 100)
                if self.rnd.random() < 0.02:
                    ai['side'] *= -1
                if self.rnd.random() < 0.012:
                    mask |= JUMP
            rng = Wp['speed'] * Wp['life'] * 0.9 if Wp['kind'] == 'gun' else Wp['range'] + PR + 6
            if bd < rng and ai['react'] <= 0 and self.rnd.random() < 0.7:
                mask |= FIRE
        else:
            # va vers une arme au sol intéressante ou un coffre fermé
            g = ai['goal']
            stale = g is None or ai['t'] <= 0 or (g[0] == 'it' and g[1] not in self.loot) or (g[0] == 'ch' and g[1]['open'])
            if stale:
                cands = []
                inside = lambda o: math.hypot(o['x'] - z['cx'], o['y'] - z['cy']) < z['r'] * 0.9 and o['z'] <= 40
                cur = p['slots'][p['cur']]
                for it in self.loot:
                    d = math.hypot(it['x'] - p['x'], it['y'] - p['y'])
                    if d > 1100 or not inside(it):
                        continue
                    val = 2 + it['r'] - (cur['r'] + 1 if cur else -1) if (None in p['slots'] or (cur and it['r'] > cur['r'])) else -1
                    if val > 0:
                        cands.append((d / (val + 0.5), ('it', it)))
                if None in p['slots'] or (cur and cur['r'] < 2):
                    for c in self.chests:
                        d = math.hypot(c['x'] - p['x'], c['y'] - p['y'])
                        if not c['open'] and d < 1300 and inside(c):
                            cands.append((d / 2.5, ('ch', c)))
                ai['goal'] = g = min(cands, key=lambda c: c[0])[1] if cands else None
                ai['t'] = 30
            if g is not None:
                o = g[1]
                dist = math.hypot(o['x'] - p['x'], o['y'] - p['y'])
                target = (o['x'], o['y'])
                if dist < (REACH_ITEM - 12 if g[0] == 'it' else REACH_CHEST - 15) and self.frame % 2:
                    mask |= PICK
                mask |= RUN if dist > 300 else 0
            else:
                # rôde vers un point à lui dans la zone, et s'y poste un moment
                ro = ai.get('roam')
                if ro is None or ai.get('rt', 0) <= 0 or math.hypot(ro[0] - z['cx'], ro[1] - z['cy']) > z['r'] * 0.8:
                    a, d = self.rnd.uniform(0, math.tau), self.rnd.uniform(0.2, 0.75) * min(z['r'], 1800)
                    ai['roam'] = ro = (min(mp.w - 200, max(200, z['cx'] + math.cos(a) * d)), min(mp.h - 200, max(200, z['cy'] + math.sin(a) * d)))
                    ai['rt'] = 30 * self.rnd.uniform(8, 16)
                ai['rt'] -= 1
                if math.hypot(ro[0] - p['x'], ro[1] - p['y']) > 60:
                    target = ro
                elif self.frame % 45 == i % 45:
                    p['yaw'] = wrap(p['yaw'] + self.rnd.uniform(-2, 2))
        wish = (0.0, 0.0)
        if target is not None:
            dx, dy = target[0] - p['x'], target[1] - p['y']
            if ai['stuck'] > 0:      # bloqué : saute et contourne un moment
                ai['stuck'] -= 1
                dx, dy = -dy * ai['side'], dx * ai['side']
                if ai['stuck'] == 14:
                    mask |= JUMP
            elif ai['last'] and math.hypot(p['x'] - ai['last'][0], p['y'] - ai['last'][1]) < 1.2 and math.hypot(dx, dy) > 20 and not p['gl']:
                ai['stuck'] = 15
                if self.rnd.random() < 0.3:
                    ai['side'] *= -1
            ai['last'] = (p['x'], p['y'])
            n = math.hypot(dx, dy)
            if n > 8:
                wish = (dx / n, dy / n)
                if look is None:
                    look = (math.atan2(dy, dx), 0.0)
        if look:
            p['yaw'] = wrap(p['yaw'] + wrap(look[0] - p['yaw']) * 0.35)
            p['pitch'] = look[1]
        if p['slots'][p['cur']] is None and p['slots'][1 - p['cur']] is not None:
            mask |= SWAP
        inp['press'] |= mask & ~inp['k']
        inp['k'] = mask
        return wish

    # ---------------- état envoyé ----------------
    def completed(self, seat):
        return True

    def init_payload(self):
        mp = self.mp
        return {'map': {'key': mp.key, 'title': mp.title, 'w': mp.w, 'h': mp.h, 'obs': mp.obs, 'ceil': mp.ceil, 'sky': mp.sky, 'busZ': mp.bus_z},
                'phys': {'walk': WALK, 'sprint': SPRINT, 'accG': ACC_GROUND, 'accA': ACC_AIR, 'jump': JUMP_V, 'grav': GRAVITY,
                         'step': STEP, 'pr': PR, 'body': BODY, 'eye': EYE, 'head': HEAD, 'glide': GLIDE_SPEED, 'fall': GLIDE_FALL},
                'busTime': BUS_TIME, 'reach': {'item': REACH_ITEM, 'chest': REACH_CHEST},
                'weapons': {k: {'name': v['name'], 'kind': v['kind'], 'grav': v.get('grav', 0)} for k, v in WEAPONS.items()},
                'rarity': [{'name': r[0], 'mult': r[1], 'color': r[2]} for r in RARITY],
                'metiers': {k: {'name': v['name'], 'color': v['color'], 'perk': v['perk'], 'speed': v.get('speed', 1), 'jump': v.get('jump', 1)}
                            for k, v in METIERS.items()}}

    def view(self):
        z = self.zone
        out = {
            'phase': self.phase, 'countdown': round(max(0.0, self.pt), 1), 'time': round(self.time, 1),
            'p': [{'n': p['name'], 'm': p['m'], 'x': round(p['x'], 1), 'y': round(p['y'], 1), 'z': round(p['z'], 1),
                   'a': round(p['yaw'], 3), 'pt': round(p['pitch'], 2), 'hp': round(p['hp']), 'ar': round(p['ar']), 'al': p['alive'],
                   'k': p['kills'], 'b': p['bot'], 's': p['slots'], 'c': p['cur'], 'sw': p['swing'] > 0, 'by': p['by'], 'tp': p['tp'],
                   'bu': p['bus'], 'gl': p['gl']}
                  for p in self.p],
            'pr': [[round(q[0]), round(q[1]), round(q[2]), round(q[3]), round(q[4]), round(q[5]), q[9], q[11]] for q in self.proj],
            'z': {'x': round(z['cx']), 'y': round(z['cy']), 'r': round(z['r']), 'sh': z['shrink'], 't': round(max(0, z['t'])),
                  'to': [round(v) for v in z['to']] if z['to'] else None, 'ph': z['phase'], 'dps': z['dps']},
            'ev': self.events[-14:],
            'alive': sum(1 for p in self.p if p['alive']),
            'finished': self.finished,
            'crane': round(self.crane),
        }
        self.vcount = getattr(self, 'vcount', 0) + 1
        if self.chests_dirty or self.vcount % 45 == 1:
            out['ch'] = [[c['id'], c['x'], c['y'], c['z'], c['a'], int(c['open'])] for c in self.chests]
            self.chests_dirty = False
        if self.loot_dirty or self.vcount % 45 == 1:
            out['loot'] = [[it['id'], it['x'], it['y'], it['z'], it['w'], it['r']] for it in self.loot]
            self.loot_dirty = False
        return out
