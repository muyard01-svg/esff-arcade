"""Coulée Royale : FPS / TPS battle royale des métiers de la métallurgie (serveur, 30 images/s).

Carte : une grande halle de fonderie en 3D (fours, piles de moules, conteneurs sur lesquels on peut grimper,
poches de coulée, piliers). Chacun arrive à mains nues avec 100 PV : il n'y a au sol que des armes à
looter, de rareté variable. La fonte en fusion envahit la halle par l'extérieur ; le dernier debout gagne.

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
W, H = 4400, 3000
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
CEIL = 700

L, R, U, D, FIRE, PICK, SWAP, JUMP, RUN = 1, 2, 4, 8, 16, 32, 64, 128, 256

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
    'metallurgiste': {'name': 'Métallurgiste', 'color': '#C77DFF', 'perk': 'voit les armes rares sur la mini-carte', 'sight': True},
}
KILL_HEAL = 25               # PV rendus par élimination (il n'y a plus de soins au sol)

# phases de la fonte : (attente s, durée du resserrement s, rayon final, dégâts/s hors zone)
PHASES = [(45, 25, 1850, 1), (25, 22, 1120, 3), (20, 20, 600, 6), (15, 18, 240, 10), (10, 15, 0, 16)]
# constructions (à la manière des battle royale de construction) : grille de tuiles, 3 matériaux
TILE = 150                   # côté d'une tuile de construction
LEVEL = 150                  # hauteur d'un étage
BUILD_HP = {'bois': 90, 'brique': 140, 'acier': 200}
BUILD_COST = 10
MATS = ('bois', 'brique', 'acier')
MAT_CAP = 500
HARVEST = {'palette': 'bois', 'bureau': 'bois', 'moules': 'brique', 'four': 'brique', 'mur': 'brique', 'silo': 'acier',
           'conteneur': 'acier', 'poche': 'acier', 'pilier': 'acier', 'convoyeur': 'acier'}
HARVEST_N = 8
MAX_BUILDS = 450
# largage : tout le monde part du pont roulant qui traverse la halle, puis plane jusqu'au sol
BUS_Z = 560
BUS_TIME = 16.0
GLIDE_SPEED = 430
GLIDE_FALL = 200

HEIGHTS = {'mur': CEIL, 'four': 220, 'convoyeur': 40, 'bureau': 190, 'silo': 320, 'pilier': CEIL,
           'moules': 90, 'conteneur': 150, 'poche': 120, 'palette': 28}


def build_map(seed=1012):
    """Halle de fonderie : murs, rangée de fours, piles de moules, conteneurs, poches, piliers, bureaux."""
    rnd = random.Random(seed)
    obs = []
    add = lambda x, y, w, h, k: obs.append({'x': x, 'y': y, 'w': w, 'h': h, 'k': k, 'z': HEIGHTS[k]})
    t = 40
    add(0, 0, W, t, 'mur'); add(0, H - t, W, t, 'mur'); add(0, 0, t, H, 'mur'); add(W - t, 0, t, H, 'mur')
    for i in range(5):
        add(1060 + i * 500, 480, 170, 170, 'four')
    add(960, 1440, 1000, 60, 'convoyeur'); add(2440, 1440, 1000, 60, 'convoyeur')
    add(160, 2560, 420, 300, 'bureau'); add(160, 2100, 160, 220, 'silo')
    for i in range(3):
        add(3800 + i * 150, 140, 110, 110, 'silo')
    for gx in range(400, W - 200, 600):
        for gy in range(700, H - 200, 600):
            if not any(abs(gx - (o['x'] + o['w'] / 2)) < o['w'] / 2 + 60 and abs(gy - (o['y'] + o['h'] / 2)) < o['h'] / 2 + 60 for o in obs):
                add(gx - 22, gy - 22, 44, 44, 'pilier')
    kinds = [('moules', 110, 110), ('moules', 90, 160), ('conteneur', 240, 100), ('conteneur', 100, 240), ('poche', 90, 90), ('palette', 120, 70)]
    tries = 0
    while len(obs) < 170 and tries < 5000:
        tries += 1
        k, w, h = rnd.choice(kinds)
        x, y = rnd.uniform(80, W - 80 - w), rnd.uniform(80, H - 80 - h)
        if any(x < o['x'] + o['w'] + 70 and x + w + 70 > o['x'] and y < o['y'] + o['h'] + 70 and y + h + 70 > o['y'] for o in obs):
            continue
        add(round(x), round(y), w, h, k)
    # marches pour grimper sur les conteneurs : une pile de moules ou une palette collée à certains
    for o in [o for o in obs if o['k'] == 'conteneur'][::2]:
        x, y = (o['x'] - 96, o['y'] + 4) if o['w'] < o['h'] else (o['x'] + 4, o['y'] - 96)
        if 60 < x and 60 < y and not any(x < q['x'] + q['w'] and x + 92 > q['x'] and y < q['y'] + q['h'] and y + 92 > q['y'] for q in obs):
            add(x, y, 92, 92, 'moules')
    return obs


OBSTACLES = build_map()
GRID: dict[tuple, list] = {}
for _o in OBSTACLES:
    for gx in range(int(_o['x'] // CELL), int((_o['x'] + _o['w']) // CELL) + 1):
        for gy in range(int(_o['y'] // CELL), int((_o['y'] + _o['h']) // CELL) + 1):
            GRID.setdefault((gx, gy), []).append(_o)


def around(x, y):
    cx, cy = int(x // CELL), int(y // CELL)
    seen = []
    for gx in (cx - 1, cx, cx + 1):
        for gy in (cy - 1, cy, cy + 1):
            for o in GRID.get((gx, gy), ()):
                if o not in seen:
                    seen.append(o)
    return seen


def touches(o, x, y, r):
    nx = min(max(x, o['x']), o['x'] + o['w'])
    ny = min(max(y, o['y']), o['y'] + o['h'])
    return (x - nx) ** 2 + (y - ny) ** 2 < r * r


def piece_box(b):
    """Boîte (x0, y0, z0, x1, y1, z1) d'un mur ou d'un plancher ; pour une rampe : sa tuile sur un étage."""
    x0, y0, base = b['gx'] * TILE, b['gy'] * TILE, b['lv'] * LEVEL
    if b['t'] == 'mur':
        if b['d'] == 0:
            return (x0 + TILE - 5, y0, base, x0 + TILE + 5, y0 + TILE, base + LEVEL)
        return (x0, y0 + TILE - 5, base, x0 + TILE, y0 + TILE + 5, base + LEVEL)
    if b['t'] == 'sol':
        return (x0, y0, base - 8, x0 + TILE, y0 + TILE, base)
    return (x0, y0, base, x0 + TILE, y0 + TILE, base + LEVEL)


def ramp_h(b, x, y):
    fx = min(1.0, max(0.0, (x - b['gx'] * TILE) / TILE))
    fy = min(1.0, max(0.0, (y - b['gy'] * TILE) / TILE))
    return b['lv'] * LEVEL + LEVEL * (fx, fy, 1 - fx, 1 - fy)[b['d']]


class Builds:
    """Constructions posées, indexées par tuile (un mur sur une arête appartient aux deux tuiles voisines)."""
    def __init__(self):
        self.items, self.tiles, self.keys = {}, {}, set()

    @staticmethod
    def tiles_of(b):
        t = [(b['gx'], b['gy'])]
        if b['t'] == 'mur':
            t.append((b['gx'] + 1, b['gy']) if b['d'] == 0 else (b['gx'], b['gy'] + 1))
        return t

    def add(self, b):
        self.items[b['id']] = b
        self.keys.add(b['key'])
        for t in self.tiles_of(b):
            self.tiles.setdefault(t, []).append(b)

    def remove(self, b):
        self.items.pop(b['id'], None)
        self.keys.discard(b['key'])
        for t in self.tiles_of(b):
            lst = self.tiles.get(t)
            if lst and b in lst:
                lst.remove(b)

    def near(self, x, y, r=0.0):
        out = {}
        for gx in range(int((x - r) // TILE), int((x + r) // TILE) + 1):
            for gy in range(int((y - r) // TILE), int((y + r) // TILE) + 1):
                for b in self.tiles.get((gx, gy), ()):
                    out[b['id']] = b
        return out.values()


def box_touch(bx, x, y, r):
    nx = min(max(x, bx[0]), bx[3])
    ny = min(max(y, bx[1]), bx[4])
    return (x - nx) ** 2 + (y - ny) ** 2 < r * r


def ground_at(x, y, z, bi=None):
    """Sol sous les pieds : le plus haut dessus d'obstacle, de plancher ou de rampe atteignable (pas plus haut que z + STEP)."""
    g = 0
    for o in around(x, y):
        if o['z'] <= z + STEP and o['z'] > g and touches(o, x, y, PR * 0.7):
            g = o['z']
    if bi:
        for b in bi.near(x, y, PR):
            if b['t'] == 'sol':
                top = b['lv'] * LEVEL
                if g < top <= z + STEP and box_touch(piece_box(b), x, y, PR * 0.7):
                    g = top
            elif b['t'] == 'rampe' and b['gx'] * TILE <= x <= (b['gx'] + 1) * TILE and b['gy'] * TILE <= y <= (b['gy'] + 1) * TILE:
                h = ramp_h(b, x, y)
                if g < h <= z + STEP:
                    g = h
    return g


def body_blocked(x, y, z, bi=None):
    if x < PR or y < PR or x > W - PR or y > H - PR:
        return True
    if any(o['z'] > z + STEP and touches(o, x, y, PR - 1) for o in around(x, y)):
        return True
    if bi:
        for b in bi.near(x, y, PR):
            if b['t'] != 'rampe':
                bx = piece_box(b)
                if bx[2] < z + BODY and bx[5] > z + STEP and box_touch(bx, x, y, PR - 1):
                    return True
    return False


def build_at(x, y, z, bi):
    """Construction qui occupe ce point, sinon None."""
    if not bi:
        return None
    for b in bi.near(x, y):
        if b['t'] == 'rampe':
            if b['gx'] * TILE <= x <= (b['gx'] + 1) * TILE and b['gy'] * TILE <= y <= (b['gy'] + 1) * TILE and abs(z - ramp_h(b, x, y)) < 9:
                return b
        else:
            bx = piece_box(b)
            if bx[0] <= x <= bx[3] and bx[1] <= y <= bx[4] and bx[2] <= z <= bx[5]:
                return b
    return None


def map_at(x, y, z):
    for o in GRID.get((int(x // CELL), int(y // CELL)), ()):
        if o['x'] <= x <= o['x'] + o['w'] and o['y'] <= y <= o['y'] + o['h'] and z <= o['z']:
            return o
    return None


def point_blocked(x, y, z, bi=None):
    if x < 0 or y < 0 or x > W or y > H or z < 0 or z > CEIL:
        return True
    return map_at(x, y, z) is not None or build_at(x, y, z, bi) is not None


def seg_clear(x1, y1, z1, x2, y2, z2, bi=None):
    n = int(math.hypot(x2 - x1, y2 - y1) // 25) + 1
    return not any(point_blocked(x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n, z1 + (z2 - z1) * k / n, bi) for k in range(1, n))


def physics(p, wx, wy, run, jump, dt, M, bi=None):
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
        was = body_blocked(p['x'], p['y'], p['z'], bi)      # coincé dans une construction : on peut en sortir
        p[axis] += p[v] * dt
        if not was and body_blocked(p['x'], p['y'], p['z'], bi):
            p[axis] = old
            p[v] = 0.0
    p['z'] += p['vz'] * dt
    g = ground_at(p['x'], p['y'], max(p['z'], 0), bi)
    if p['z'] <= g:
        p['z'], p['vz'], p['gd'] = float(g), 0.0, True
        p['gl'] = False
    else:
        p['gd'] = False
    if p['z'] + BODY > CEIL:
        p['z'], p['vz'] = CEIL - BODY, min(0.0, p['vz'])


def free_spot(rnd, margin=40):
    for _ in range(500):
        x, y = rnd.uniform(80, W - 80), rnd.uniform(80, H - 80)
        if not any(abs(x - (o['x'] + o['w'] / 2)) < o['w'] / 2 + margin and abs(y - (o['y'] + o['h'] / 2)) < o['h'] / 2 + margin for o in around(x, y)):
            return x, y
    return W / 2, H / 2


def roll_rarity(rnd):
    r = rnd.uniform(0, sum(x[3] for x in RARITY))
    for i, x in enumerate(RARITY):
        r -= x[3]
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
        metiers = list(METIERS)
        self.p = []
        for i, s in enumerate(seats):
            m = (s.get('opt') or {}).get('char')
            if m not in METIERS:
                m = metiers[i % len(metiers)] if s['bot'] else 'fondeur'
            # chacun a sa place le long du pont roulant (axe y), qui avance ensuite le long de la halle (axe x)
            y = 260 + (H - 520) * (i + 0.5) / len(seats) + self.rnd.uniform(-40, 40)
            x = 200.0
            M = METIERS[m]
            self.p.append({'name': s['name'], 'bot': s['bot'], 'm': m, 'x': x, 'y': y, 'z': float(BUS_Z), 'bus': True, 'gl': False, 'lane': y,
                           'mt': {k: 0 for k in MATS}, 'bcd': 0.0, 'vx': 0.0, 'vy': 0.0, 'vz': 0.0, 'gd': True,
                           'yaw': self.rnd.uniform(-math.pi, math.pi), 'pitch': 0.0, 'hp': 100.0, 'ar': float(M.get('armor', 0)),
                           'slots': [None, None], 'cur': 0, 'cd': 0.0, 'alive': True, 'kills': 0, 'died': None, 'by': None,
                           'swing': 0.0, 'tp': 1, 'srv': s['bot'], 'seen': 0.0, 'kbt': 0.0,
                           'ai': {'t': 0, 'goal': None, 'side': 1, 'react': 0, 'stuck': 0, 'last': None, 'drop': self.rnd.uniform(1.0, BUS_TIME - 1.5)}})
        self.inputs = [{'k': 0, 'press': 0} for _ in self.p]
        self.loot = []
        self.lid = 0
        tops = [o for o in OBSTACLES if o['k'] in ('conteneur', 'bureau', 'moules')]
        for n in range(96):
            if n % 6 == 0 and tops:   # quelques armes sur les toits, pour ceux qui grimpent
                o = self.rnd.choice(tops)
                self.spawn_loot(o['x'] + o['w'] / 2, o['y'] + o['h'] / 2, o['z'])
            else:
                x, y = free_spot(self.rnd, 30)
                self.spawn_loot(x, y, 0)
        self.proj = []
        self.bi = Builds()
        self.bid = 0
        self.bchg, self.brm = set(), []
        self.crane = 200.0
        self.events, self.eid = [], 0
        self.zone = {'cx': W / 2, 'cy': H / 2, 'r': 2700.0, 'phase': 0, 't': PHASES[0][0], 'shrink': False,
                     'from': (W / 2, H / 2, 2700.0), 'to': None, 'dps': 0}
        self.next_zone_target()
        self.phase, self.pt = 'count', COUNTDOWN
        self.time = 0.0
        self.acc = 0.0
        self.frame = 0
        self.loot_dirty = True
        self.finished = None
        self.dirty = True

    # ---------------- butin (des armes, rien d'autre) ----------------
    def spawn_loot(self, x, y, z, wid=None, rar=None):
        self.lid += 1
        self.loot.append({'id': self.lid, 'x': round(x), 'y': round(y), 'z': round(z),
                          'w': wid or self.rnd.choice(LOOT_WEAPONS), 'r': roll_rarity(self.rnd) if rar is None else rar})
        self.loot_dirty = True

    # ---------------- zone de fonte ----------------
    def next_zone_target(self):
        z = self.zone
        if z['phase'] >= len(PHASES):
            return
        tr = PHASES[z['phase']][2]
        for _ in range(50):
            a, d = self.rnd.uniform(0, math.tau), self.rnd.uniform(0, max(0, min(z['r'], 1500) - tr))
            cx, cy = z['cx'] + math.cos(a) * d, z['cy'] + math.sin(a) * d
            if 400 < cx < W - 400 and 400 < cy < H - 400:
                break
        else:
            cx, cy = W / 2, H / 2
        z['to'] = (cx, cy, float(tr))

    def update_zone(self, dt):
        z = self.zone
        if z['phase'] >= len(PHASES):
            return
        wait, dur, _, dps = PHASES[z['phase']]
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
                if z['phase'] < len(PHASES):
                    z['t'] = PHASES[z['phase']][0]
                    self.next_zone_target()

    # ---------------- entrées ----------------
    def handle(self, seat, data):
        if seat >= len(self.p):
            return
        if data.get('a') == 'build':
            self.try_build(seat, data)
            return
        if data.get('a') != 'input':
            return
        try:
            k = int(data.get('k', 0)) & 511
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
        el = min(0.6, max(0.0, now - p['seen'])) if p['seen'] else 0.1
        bi = self.bi
        allowed = (GLIDE_SPEED * 1.15 if p['gl'] else WALK * SPRINT * 1.12) * el + 30 + (180 if p['kbt'] > 0 else 0)
        gz = ground_at(x, y, z, bi)
        p['air'] = 0.0 if p['gl'] or z <= gz + 2 else p.get('air', 0.0) + el
        ok = (math.hypot(x - p['x'], y - p['y']) <= allowed and z >= 0
              and not (body_blocked(x, y, z, bi) and not body_blocked(p['x'], p['y'], p['z'], bi))
              and z <= p['z'] + JUMP_V * 1.25 * el + STEP + 10      # on ne monte pas plus vite qu'un saut
              and (z <= gz + 95 or z <= p['z'] + 1)                  # très haut : seulement en retombant
              and p['air'] < 2.0)                                    # pas de vol plané hors largage
        if ok:
            p['vx'], p['vy'] = (x - p['x']) / max(el, 1 / FPS), (y - p['y']) / max(el, 1 / FPS)
            p['x'], p['y'], p['z'], p['vz'] = x, y, z, vz
            p['gd'] = z <= ground_at(x, y, z, bi) + 1
            if p['gd']:
                p['gl'] = False
        else:
            p['tp'] += 1
            p['vx'] = p['vy'] = 0.0
            p['air'] = 0.0
        p['seen'] = now

    def try_build(self, i, d):
        p = self.p[i]
        if self.phase != 'play' or not p['alive'] or p['bus'] or p['bcd'] > 0:
            return
        try:
            t, m = d.get('piece'), d.get('m')
            gx, gy, lv, dd = int(d.get('gx')), int(d.get('gy')), int(d.get('lv')), int(d.get('d', 0))
        except (TypeError, ValueError):
            return
        if t not in ('mur', 'sol', 'rampe') or m not in MATS or p['mt'][m] < BUILD_COST or not 0 <= lv <= 3 or not 0 <= dd <= 3:
            return
        if t == 'mur' and dd >= 2:            # un mur à l'ouest d'une tuile = le mur à l'est de sa voisine
            gx, gy, dd = (gx - 1, gy, 0) if dd == 2 else (gx, gy - 1, 1)
        if t == 'sol':
            dd = 0
        if not (0 <= gx < W // TILE and 0 <= gy < H // TILE) or len(self.bi.items) >= MAX_BUILDS:
            return
        key = (t, gx, gy, lv, dd if t == 'mur' else 0)
        if key in self.bi.keys:
            return
        b = {'id': 0, 't': t, 'gx': gx, 'gy': gy, 'lv': lv, 'd': dd, 'm': m, 'hp': float(BUILD_HP[m]), 'key': key}
        bx = piece_box(b)
        if math.hypot((bx[0] + bx[3]) / 2 - p['x'], (bx[1] + bx[4]) / 2 - p['y']) > 300 or abs(lv * LEVEL - p['z']) > LEVEL * 1.6:
            return
        if t != 'rampe':   # on ne bâtit pas à travers quelqu'un
            for o in self.p:
                if o['alive'] and not o['bus'] and bx[2] < o['z'] + BODY and bx[5] > o['z'] + STEP and box_touch(bx, o['x'], o['y'], PR - 2):
                    return
        self.bid += 1
        b['id'] = self.bid
        self.bi.add(b)
        self.bchg.add(b['id'])
        p['mt'][m] -= BUILD_COST
        p['bcd'] = 0.1
        self.event('build', (bx[0] + bx[3]) / 2, (bx[1] + bx[4]) / 2, bx[2], seat=i, t=t)

    def hit_build(self, b, dmg):
        b['hp'] -= dmg
        if b['hp'] <= 0:
            self.bi.remove(b)
            self.brm.append(b['id'])
            self.bchg.discard(b['id'])
            bx = piece_box(b)
            self.event('bbreak', (bx[0] + bx[3]) / 2, (bx[1] + bx[4]) / 2, (bx[2] + bx[5]) / 2, m=b['m'])
        else:
            self.bchg.add(b['id'])

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
        z = self.zone
        self.crane = 200 + (W - 400) * min(1.0, self.time / BUS_TIME)
        for i, p in enumerate(self.p):
            if not p['alive']:
                continue
            M = METIERS[p['m']]
            inp = self.inputs[i]
            if p['bus']:   # accroché au pont roulant : Espace pour sauter (automatique en bout de course)
                p['x'], p['y'], p['z'], p['vx'], p['vy'], p['vz'] = self.crane, p['lane'], float(BUS_Z), 0.0, 0.0, 0.0
                press = inp['press']
                inp['press'] = 0
                auto = (p['bot'] or not connected(i)) and self.time >= p['ai']['drop']
                if press & JUMP or auto or self.time >= BUS_TIME:
                    p['bus'], p['gl'], p['gd'] = False, True, False
                    p['tp'] += 1
                    p['seen'] = time.monotonic()
                    self.event('drop', p['x'], p['y'], p['z'], seat=i)
                continue
            p['bcd'] = max(0.0, p['bcd'] - dt)
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
                physics(p, wx, wy, bool(k & RUN), bool(k & JUMP), dt, M, self.bi)
            p['kbt'] = max(0.0, p['kbt'] - dt)
            if press & SWAP:
                p['cur'] = 1 - p['cur']
            self.pickup(i, manual=bool(press & PICK))
            p['cd'] -= dt
            p['swing'] = max(0.0, p['swing'] - dt)
            if k & FIRE and p['cd'] <= 0:
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

    def pickup(self, i, manual):
        p = self.p[i]
        for it in self.loot:
            if (it['x'] - p['x']) ** 2 + (it['y'] - p['y']) ** 2 > 50 ** 2 or abs(it['z'] - p['z']) > 60:
                continue
            empty = [k for k in (0, 1) if p['slots'][k] is None]
            if empty and not manual:
                p['slots'][empty[0]] = {'w': it['w'], 'r': it['r']}
                p['cur'] = empty[0]
            elif manual:
                old = p['slots'][p['cur']]
                p['slots'][p['cur']] = {'w': it['w'], 'r': it['r']}
                if old:
                    self.spawn_loot(p['x'] + math.cos(p['yaw']) * 34, p['y'] + math.sin(p['yaw']) * 34, ground_at(p['x'], p['y'], p['z'], self.bi), old['w'], old['r'])
            else:
                continue
            self.loot.remove(it)
            self.loot_dirty = True
            self.event('pick', p['x'], p['y'], p['z'], seat=i, w=it['w'], r=it['r'])
            return

    def attack(self, i):
        p = self.p[i]
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
                if j == i or not o['alive']:
                    continue
                dx, dy = o['x'] - p['x'], o['y'] - p['y']
                dist = math.hypot(dx, dy)
                if dist > Wp['range'] + PR or abs(o['z'] - p['z']) > 75:
                    continue
                if abs(wrap(math.atan2(dy, dx) - yaw)) <= Wp['arc'] / 2 + 0.3 and seg_clear(ex, ey, ez - 30, o['x'], o['y'], o['z'] + 55, self.bi):
                    self.damage(i, j, dmg)
                    if Wp.get('kb') and o['alive']:
                        kv = Wp['kb']
                        kx, ky = dx / max(dist, 1) * kv, dy / max(dist, 1) * kv
                        o['kbt'] = 0.6
                        if o['srv']:
                            o['vx'] += kx; o['vy'] += ky; o['vz'] = 260; o['gd'] = False
                        self.event('kb', o['x'], o['y'], o['z'], seat=j, vx=round(kx), vy=round(ky), vz=260)
            # devant soi : une construction (abîmée) ou le décor (récolte de matériaux)
            cp = math.cos(pitch)
            for step in range(2, int(Wp['range'] + 20) // 12 + 1):
                d = step * 12
                hx, hy, hz = ex + math.cos(yaw) * cp * d, ey + math.sin(yaw) * cp * d, ez - 20 + math.sin(pitch) * d
                b = build_at(hx, hy, hz, self.bi)
                if b:
                    self.hit_build(b, dmg * 1.5)
                    self.event('bhit', hx, hy, hz, m=b['m'])
                    break
                o = map_at(hx, hy, hz)
                if o:
                    mat = HARVEST.get(o['k'], 'acier')
                    n = min(HARVEST_N, MAT_CAP - p['mt'][mat])
                    if n > 0:
                        p['mt'][mat] += n
                        self.event('harvest', hx, hy, hz, seat=i, m=mat, n=n)
                    break
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
            if j != owner and o['alive'] and (o['x'] - x) ** 2 + (o['y'] - y) ** 2 < (PR + rad) ** 2 and o['z'] - rad <= z <= o['z'] + BODY + rad:
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
                b = build_at(pr[0], pr[1], pr[2], self.bi)
                if b:
                    self.hit_build(b, pr[8] * (0.5 if pr[9] == 'flame' else 1.0))
                    hit = 'wall'
                    break
                if point_blocked(pr[0], pr[1], pr[2]):
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
            g = ground_at(d['x'], d['y'], d['z'], self.bi)
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
        p = self.p[i]
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
            if j == i or not o['alive']:
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
        seen = best is not None and seg_clear(p['x'], p['y'], p['z'] + EYE, best['x'], best['y'], best['z'] + 60, self.bi)
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
            if ai['goal'] is None or ai['goal'] not in self.loot or ai['t'] <= 0:
                cands = []
                for it in self.loot:
                    d = math.hypot(it['x'] - p['x'], it['y'] - p['y'])
                    if d > 1100 or it['z'] > 40 or math.hypot(it['x'] - z['cx'], it['y'] - z['cy']) > z['r'] * 0.9:
                        continue
                    cur = p['slots'][p['cur']]
                    val = 2 + it['r'] - (cur['r'] + 1 if cur else -1) if (None in p['slots'] or (cur and it['r'] > cur['r'])) else -1
                    if val > 0:
                        cands.append((d / (val + 0.5), it))
                ai['goal'] = min(cands, key=lambda c: c[0])[1] if cands else None
                ai['t'] = 30
            if ai['goal'] is not None:
                g = ai['goal']
                target = (g['x'], g['y'])
                if math.hypot(g['x'] - p['x'], g['y'] - p['y']) < 44 and None not in p['slots']:
                    mask |= PICK
                mask |= RUN if math.hypot(g['x'] - p['x'], g['y'] - p['y']) > 300 else 0
            else:
                # rôde vers un point à lui dans la zone, et s'y poste un moment
                ro = ai.get('roam')
                if ro is None or ai.get('rt', 0) <= 0 or math.hypot(ro[0] - z['cx'], ro[1] - z['cy']) > z['r'] * 0.8:
                    a, d = self.rnd.uniform(0, math.tau), self.rnd.uniform(0.2, 0.75) * min(z['r'], 1800)
                    ai['roam'] = ro = (min(W - 200, max(200, z['cx'] + math.cos(a) * d)), min(H - 200, max(200, z['cy'] + math.sin(a) * d)))
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
            elif ai['last'] and math.hypot(p['x'] - ai['last'][0], p['y'] - ai['last'][1]) < 1.2 and math.hypot(dx, dy) > 20:
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
        return {'map': {'w': W, 'h': H, 'obs': OBSTACLES, 'ceil': CEIL},
                'phys': {'walk': WALK, 'sprint': SPRINT, 'accG': ACC_GROUND, 'accA': ACC_AIR, 'jump': JUMP_V, 'grav': GRAVITY,
                         'step': STEP, 'pr': PR, 'body': BODY, 'eye': EYE, 'head': HEAD, 'glide': GLIDE_SPEED, 'fall': GLIDE_FALL},
                'build': {'tile': TILE, 'level': LEVEL, 'hp': BUILD_HP, 'cost': BUILD_COST, 'mats': MATS, 'busZ': BUS_Z, 'busTime': BUS_TIME},
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
                   'mt': [p['mt'][k] for k in MATS], 'bu': p['bus'], 'gl': p['gl']}
                  for p in self.p],
            'pr': [[round(q[0]), round(q[1]), round(q[2]), round(q[3]), round(q[4]), round(q[5]), q[9], q[11]] for q in self.proj],
            'z': {'x': round(z['cx']), 'y': round(z['cy']), 'r': round(z['r']), 'sh': z['shrink'], 't': round(max(0, z['t'])),
                  'to': [round(v) for v in z['to']] if z['to'] else None, 'ph': z['phase'], 'dps': z['dps']},
            'ev': self.events[-14:],
            'alive': sum(1 for p in self.p if p['alive']),
            'finished': self.finished,
        }
        out['crane'] = round(self.crane)
        pack = lambda b: [b['id'], b['t'], b['gx'], b['gy'], b['lv'], b['d'], b['m'], round(b['hp'])]
        self.vcount = getattr(self, 'vcount', 0) + 1
        if self.vcount % 45 == 1:   # liste complète de temps en temps, sinon seulement les changements
            out['B'] = [pack(b) for b in self.bi.items.values()]
        elif self.bchg or self.brm:
            out['bc'] = [pack(self.bi.items[k]) for k in self.bchg if k in self.bi.items]
            out['br'] = self.brm
        self.bchg, self.brm = set(), []
        if self.loot_dirty or self.frame % 90 == 0:
            out['loot'] = [[it['id'], it['x'], it['y'], it['z'], it['w'], it['r']] for it in self.loot]
            self.loot_dirty = False
        return out
