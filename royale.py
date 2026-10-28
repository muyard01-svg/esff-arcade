"""Coulée Royale : battle royale des métiers de la métallurgie, simulé par le serveur (30 images/s).

Carte : une grande halle de fonderie (fours, piles de moules, conteneurs, poches de coulée, piliers).
Chacun commence à mains nues avec 100 PV, ramasse des armes de la métallurgie de rareté variable,
et la fonte en fusion envahit la halle par l'extérieur (la zone se resserre). Le dernier debout gagne."""
from __future__ import annotations
import math
import random

FPS = 30
W, H = 3200, 2200
PR = 18                      # rayon d'un joueur
SPEED = 230
CELL = 200
COUNTDOWN = 3.0

L, R, U, D, FIRE, PICK, SWAP = 1, 2, 4, 8, 16, 32, 64

RARITY = [  # nom, multiplicateur de dégâts, couleur, poids d'apparition
    ('commun', 1.0, '#b8bcc2', 55),
    ('rare', 1.2, '#5AA8FF', 28),
    ('épique', 1.45, '#C77DFF', 13),
    ('légendaire', 1.8, '#F5B700', 4),
]

WEAPONS = {
    'poings':    dict(name='Poings', kind='melee', dmg=6, cd=0.45, range=48, arc=1.2),
    'pince':     dict(name='Pince de forgeron', kind='melee', dmg=11, cd=0.28, range=58, arc=1.2),
    'marteau':   dict(name='Marteau de forge', kind='melee', dmg=20, cd=0.55, range=66, arc=1.3),
    'masse':     dict(name='Masse à frapper', kind='melee', dmg=34, cd=1.1, range=76, arc=1.4, kb=260),
    'ringard':   dict(name='Ringard', kind='melee', dmg=17, cd=0.6, range=110, arc=0.45),
    'riveteuse': dict(name='Riveteuse', kind='gun', dmg=9, cd=0.14, speed=950, life=0.7, spread=0.06, pellets=1, proj='rivet'),
    'grenaille': dict(name='Canon à grenaille', kind='gun', dmg=7, cd=0.9, speed=800, life=0.42, spread=0.34, pellets=7, proj='pellet'),
    'louche':    dict(name='Louche de fonte', kind='gun', dmg=26, cd=1.15, speed=540, life=0.95, spread=0.02, pellets=1, proj='blob', splash=75),
    'chalumeau': dict(name='Chalumeau', kind='gun', dmg=3.4, cd=0.06, speed=430, life=0.36, spread=0.24, pellets=1, proj='flame'),
}
LOOT_WEAPONS = [k for k in WEAPONS if k != 'poings']

METIERS = {
    'forgeron':      {'name': 'Forgeron', 'color': '#BA2C3A', 'perk': '+15 % de dégâts en mêlée', 'melee': 1.15},
    'fondeur':       {'name': 'Fondeur', 'color': '#EC641E', 'perk': '-40 % de dégâts dans la fonte', 'zone': 0.6},
    'mouleur':       {'name': 'Mouleur', 'color': '#8A8D91', 'perk': '+8 % de vitesse', 'speed': 1.08},
    'noyauteur':     {'name': 'Noyauteur', 'color': '#C4A06E', 'perk': 'soins +40 %', 'heal': 1.4},
    'ebarbeur':      {'name': 'Ébarbeur', 'color': '#2E3238', 'perk': 'cadence de tir +12 %', 'rate': 0.88},
    'lamineur':      {'name': 'Lamineur', 'color': '#5AA8FF', 'perk': 'commence avec 25 d\'armure', 'armor': 25},
    'chaudronnier':  {'name': 'Chaudronnier', 'color': '#7FD48A', 'perk': 'tabliers +30 %', 'armorMult': 1.3},
    'soudeur':       {'name': 'Soudeur', 'color': '#F5B700', 'perk': '+20 % au chalumeau et à la louche', 'fire': 1.2},
    'metallurgiste': {'name': 'Métallurgiste', 'color': '#C77DFF', 'perk': 'voit les armes rares sur la mini-carte', 'sight': True},
}

# phases de la fonte : (attente s, durée du resserrement s, rayon final, dégâts/s hors zone)
PHASES = [(40, 25, 1350, 1), (25, 22, 820, 3), (20, 20, 440, 6), (15, 18, 170, 10), (10, 15, 0, 16)]


def build_map(seed=1012):
    """Halle de fonderie : murs, rangée de fours, piles de moules, conteneurs, poches, piliers, bureaux."""
    rnd = random.Random(seed)
    obs = []
    add = lambda x, y, w, h, k: obs.append({'x': x, 'y': y, 'w': w, 'h': h, 'k': k})
    t = 40
    add(0, 0, W, t, 'mur'); add(0, H - t, W, t, 'mur'); add(0, 0, t, H, 'mur'); add(W - t, 0, t, H, 'mur')
    # ligne de fours de fusion au centre-nord
    for i in range(5):
        add(760 + i * 360, 360, 170, 170, 'four')
    # chaîne de moulage (convoyeurs) au centre
    add(700, 1040, 760, 60, 'convoyeur'); add(1740, 1040, 760, 60, 'convoyeur')
    # bureaux et labo au sud-ouest
    add(160, 1640, 420, 300, 'bureau'); add(160, 1300, 160, 220, 'silo')
    # silos à sable au nord-est
    for i in range(3):
        add(2650 + i * 150, 140, 110, 110, 'silo')
    # piliers de charpente en grille
    for gx in range(400, W - 200, 600):
        for gy in range(700, H - 200, 600):
            if not any(abs(gx - (o['x'] + o['w'] / 2)) < o['w'] / 2 + 60 and abs(gy - (o['y'] + o['h'] / 2)) < o['h'] / 2 + 60 for o in obs):
                add(gx - 22, gy - 22, 44, 44, 'pilier')
    # piles de moules, conteneurs et poches de coulée dispersés
    kinds = [('moules', 110, 110), ('moules', 90, 160), ('conteneur', 240, 100), ('conteneur', 100, 240), ('poche', 90, 90), ('palette', 120, 70)]
    tries = 0
    while len(obs) < 95 and tries < 3000:
        tries += 1
        k, w, h = rnd.choice(kinds)
        x, y = rnd.uniform(80, W - 80 - w), rnd.uniform(80, H - 80 - h)
        if any(x < o['x'] + o['w'] + 70 and x + w + 70 > o['x'] and y < o['y'] + o['h'] + 70 and y + h + 70 > o['y'] for o in obs):
            continue
        add(round(x), round(y), w, h, k)
    return obs


OBSTACLES = build_map()
GRID: dict[tuple, list] = {}
for _i, _o in enumerate(OBSTACLES):
    for gx in range(int(_o['x'] // CELL), int((_o['x'] + _o['w']) // CELL) + 1):
        for gy in range(int(_o['y'] // CELL), int((_o['y'] + _o['h']) // CELL) + 1):
            GRID.setdefault((gx, gy), []).append(_o)


def near_obstacles(x, y):
    return GRID.get((int(x // CELL), int(y // CELL)), ())


def point_blocked(x, y):
    if x < 0 or y < 0 or x > W or y > H:
        return True
    return any(o['x'] <= x <= o['x'] + o['w'] and o['y'] <= y <= o['y'] + o['h'] for o in near_obstacles(x, y))


def free_spot(rnd, margin=40):
    for _ in range(500):
        x, y = rnd.uniform(80, W - 80), rnd.uniform(80, H - 80)
        if not any(abs(x - (o['x'] + o['w'] / 2)) < o['w'] / 2 + margin and abs(y - (o['y'] + o['h'] / 2)) < o['h'] / 2 + margin
                   for gx in (-1, 0, 1) for gy in (-1, 0, 1) for o in GRID.get((int(x // CELL) + gx, int(y // CELL) + gy), ())):
            return x, y
    return W / 2, H / 2


def line_clear(x1, y1, x2, y2):
    n = int(math.hypot(x2 - x1, y2 - y1) // 30) + 1
    return not any(point_blocked(x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n) for k in range(1, n))


def roll_rarity(rnd):
    r = rnd.uniform(0, sum(x[3] for x in RARITY))
    for i, x in enumerate(RARITY):
        r -= x[3]
        if r <= 0:
            return i
    return 0


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
            x, y = free_spot(self.rnd, 60)
            M = METIERS[m]
            self.p.append({'name': s['name'], 'bot': s['bot'], 'm': m, 'x': x, 'y': y, 'ang': 0.0, 'hp': 100.0,
                           'ar': float(M.get('armor', 0)), 'slots': [None, None], 'cur': 0, 'cd': 0.0, 'alive': True,
                           'kills': 0, 'died': None, 'by': None, 'swing': 0.0, 'ai': {'t': 0, 'mask': 0, 'goal': None, 'side': 1}})
        self.inputs = [{'k': 0, 'ang': 0.0, 'prev': 0} for _ in self.p]
        self.loot = []
        self.lid = 0
        for _ in range(68):
            self.spawn_loot('arme')
        for _ in range(16):
            self.spawn_loot('soin')
        for _ in range(11):
            self.spawn_loot('tablier')
        self.proj = []
        self.events, self.eid = [], 0
        self.zone = {'cx': W / 2, 'cy': H / 2, 'r': 2300.0, 'phase': 0, 't': PHASES[0][0], 'shrink': False,
                     'from': (W / 2, H / 2, 2300.0), 'to': None, 'dps': 0}
        self.next_zone_target()
        self.phase, self.pt = 'count', COUNTDOWN
        self.time = 0.0
        self.acc = 0.0
        self.frame = 0
        self.loot_dirty = True
        self.finished = None
        self.dirty = True

    # ---------------- butin ----------------
    def spawn_loot(self, kind, x=None, y=None, wid=None, rar=None):
        if x is None:
            x, y = free_spot(self.rnd, 30)
        self.lid += 1
        item = {'id': self.lid, 'x': round(x), 'y': round(y), 't': kind}
        if kind == 'arme':
            item['w'] = wid or self.rnd.choice(LOOT_WEAPONS)
            item['r'] = roll_rarity(self.rnd) if rar is None else rar
        self.loot.append(item)
        self.loot_dirty = True

    # ---------------- zone de fonte ----------------
    def next_zone_target(self):
        z = self.zone
        if z['phase'] >= len(PHASES):
            return
        tr = PHASES[z['phase']][2]
        # nouveau centre tiré à l'intérieur du cercle actuel
        for _ in range(50):
            a, d = self.rnd.uniform(0, math.tau), self.rnd.uniform(0, max(0, min(z['r'], 1100) - tr))
            cx, cy = z['cx'] + math.cos(a) * d, z['cy'] + math.sin(a) * d
            if 300 < cx < W - 300 and 300 < cy < H - 300:
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
        if data.get('a') != 'input' or seat >= len(self.p):
            return
        try:
            k = int(data.get('k', 0)) & 127
            ang = float(data.get('ang', 0.0))
        except (TypeError, ValueError):
            return
        inp = self.inputs[seat]
        inp['press'] = inp.get('press', 0) | (k & ~inp['k'])
        inp['k'], inp['ang'] = k, ang

    def tick(self, dt, connected):
        self.acc += dt
        steps = 0
        while self.acc >= 1 / FPS and steps < 4:
            self.acc -= 1 / FPS
            steps += 1
            self.step(connected)
        if steps == 4:
            self.acc = 0.0

    def event(self, kind, x, y, **kw):
        self.eid += 1
        self.events.append({'id': self.eid, 'k': kind, 'x': round(x), 'y': round(y), **kw})
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
            return
        self.time += dt
        self.update_zone(dt)
        z = self.zone
        for i, p in enumerate(self.p):
            if not p['alive']:
                continue
            if p['bot'] or not connected(i):
                self.ai(i)
            inp = self.inputs[i]
            k, press = inp['k'], inp.pop('press', 0)
            M = METIERS[p['m']]
            p['ang'] = inp['ang']
            mx = (1 if k & R else 0) - (1 if k & L else 0)
            my = (1 if k & D else 0) - (1 if k & U else 0)
            if mx or my:
                n = math.hypot(mx, my)
                sp = SPEED * M.get('speed', 1.0) * dt
                self.move(p, mx / n * sp, my / n * sp)
            if press & SWAP:
                p['cur'] = 1 - p['cur']
            if press & PICK:
                self.pickup(i, manual=True)
            self.pickup(i, manual=False)
            p['cd'] -= dt
            p['swing'] = max(0.0, p['swing'] - dt)
            if k & FIRE and p['cd'] <= 0:
                self.attack(i)
            # fonte : dégâts hors de la zone
            if math.hypot(p['x'] - z['cx'], p['y'] - z['cy']) > z['r']:
                self.damage(None, i, max(1, z['dps']) * M.get('zone', 1.0) * dt, zone=True)
        self.update_proj(dt)
        alive = [i for i, p in enumerate(self.p) if p['alive']]
        if len(alive) <= 1:
            order = alive + sorted([i for i, p in enumerate(self.p) if not p['alive']], key=lambda i: -self.p[i]['died'])
            self.finished = order
            self.phase = 'over'
            if alive:
                self.event('win', self.p[alive[0]]['x'], self.p[alive[0]]['y'], msg=f"{self.p[alive[0]]['name']} est le dernier debout !")

    def move(self, p, dx, dy):
        for axis, d in (('x', dx), ('y', dy)):
            p[axis] += d
            for o in [o for gx in (-1, 0, 1) for gy in (-1, 0, 1) for o in GRID.get((int(p['x'] // CELL) + gx, int(p['y'] // CELL) + gy), ())]:
                nx = min(max(p['x'], o['x']), o['x'] + o['w'])
                ny = min(max(p['y'], o['y']), o['y'] + o['h'])
                if (p['x'] - nx) ** 2 + (p['y'] - ny) ** 2 < PR * PR:
                    if axis == 'x':
                        p['x'] = o['x'] - PR if d > 0 else o['x'] + o['w'] + PR
                    else:
                        p['y'] = o['y'] - PR if d > 0 else o['y'] + o['h'] + PR
        p['x'] = min(max(p['x'], 60), W - 60)
        p['y'] = min(max(p['y'], 60), H - 60)

    def weapon(self, p):
        s = p['slots'][p['cur']]
        return (s['w'], s['r']) if s else ('poings', 0)

    def pickup(self, i, manual):
        p = self.p[i]
        M = METIERS[p['m']]
        for it in list(self.loot):
            if (it['x'] - p['x']) ** 2 + (it['y'] - p['y']) ** 2 > 42 ** 2:
                continue
            if it['t'] == 'soin' and p['hp'] < 100:
                p['hp'] = min(100.0, p['hp'] + 30 * M.get('heal', 1.0))
                self.loot.remove(it); self.loot_dirty = True
                self.event('heal', p['x'], p['y'], seat=i)
            elif it['t'] == 'tablier' and p['ar'] < 100:
                p['ar'] = min(100.0, p['ar'] + 40 * M.get('armorMult', 1.0))
                self.loot.remove(it); self.loot_dirty = True
                self.event('armor', p['x'], p['y'], seat=i)
            elif it['t'] == 'arme':
                empty = [k for k in (0, 1) if p['slots'][k] is None]
                if empty and not manual:
                    p['slots'][empty[0]] = {'w': it['w'], 'r': it['r']}
                    p['cur'] = empty[0]
                elif manual:
                    old = p['slots'][p['cur']]
                    p['slots'][p['cur']] = {'w': it['w'], 'r': it['r']}
                    if old:
                        self.spawn_loot('arme', p['x'] + 26, p['y'] + 10, old['w'], old['r'])
                else:
                    continue
                self.loot.remove(it); self.loot_dirty = True
                self.event('pick', p['x'], p['y'], seat=i, w=it['w'], r=it['r'])
                return

    def attack(self, i):
        p = self.p[i]
        wid, rar = self.weapon(p)
        Wp = WEAPONS[wid]
        M = METIERS[p['m']]
        mult = RARITY[rar][1]
        p['cd'] = Wp['cd'] * M.get('rate', 1.0)
        ang = p['ang']
        if Wp['kind'] == 'melee':
            p['swing'] = 0.25
            dmg = Wp['dmg'] * mult * M.get('melee', 1.0)
            self.event('swing', p['x'], p['y'], seat=i, w=wid)
            for j, o in enumerate(self.p):
                if j == i or not o['alive']:
                    continue
                dx, dy = o['x'] - p['x'], o['y'] - p['y']
                dist = math.hypot(dx, dy)
                if dist > Wp['range'] + PR:
                    continue
                da = abs(math.atan2(math.sin(math.atan2(dy, dx) - ang), math.cos(math.atan2(dy, dx) - ang)))
                if da <= Wp['arc'] / 2 + 0.25 and line_clear(p['x'], p['y'], o['x'], o['y']):
                    self.damage(i, j, dmg)
                    if Wp.get('kb') and o['alive']:
                        self.move(o, dx / max(dist, 1) * Wp['kb'] * 0.12, dy / max(dist, 1) * Wp['kb'] * 0.12)
            return
        dmg = Wp['dmg'] * mult * (M.get('fire', 1.0) if wid in ('chalumeau', 'louche') else 1.0)
        for _ in range(Wp['pellets']):
            a = ang + self.rnd.uniform(-Wp['spread'], Wp['spread'])
            sp = Wp['speed'] * self.rnd.uniform(0.9, 1.05)
            sx, sy = p['x'] + math.cos(ang) * (PR + 6), p['y'] + math.sin(ang) * (PR + 6)
            self.proj.append([sx, sy, math.cos(a) * sp, math.sin(a) * sp, Wp['life'], i, dmg, Wp['proj'], Wp.get('splash', 0), rar])
        self.event('shot', p['x'], p['y'], seat=i, w=wid)

    def update_proj(self, dt):
        keep = []
        for pr in self.proj:
            pr[0] += pr[2] * dt
            pr[1] += pr[3] * dt
            pr[4] -= dt
            hit = None
            if pr[4] <= 0 or point_blocked(pr[0], pr[1]):
                hit = 'wall'
            else:
                for j, o in enumerate(self.p):
                    if j != pr[5] and o['alive'] and (o['x'] - pr[0]) ** 2 + (o['y'] - pr[1]) ** 2 < (PR + 4) ** 2:
                        self.damage(pr[5], j, pr[6])
                        hit = 'player'
                        break
            if hit:
                if pr[7] == 'blob':   # éclaboussure de fonte
                    self.event('splash', pr[0], pr[1])
                    for j, o in enumerate(self.p):
                        if j != pr[5] and o['alive'] and (o['x'] - pr[0]) ** 2 + (o['y'] - pr[1]) ** 2 < pr[8] ** 2 and hit != 'player':
                            self.damage(pr[5], j, pr[6] * 0.5)
                continue
            keep.append(pr)
        self.proj = keep

    def damage(self, src, dst, amount, zone=False):
        d = self.p[dst]
        if not d['alive'] or amount <= 0:
            return
        if not zone:
            absorbed = min(d['ar'], amount * 0.6)
            d['ar'] -= absorbed
            amount -= absorbed
        d['hp'] -= amount
        if not zone:
            self.event('hit', d['x'], d['y'], seat=dst, by=src, dmg=round(amount + 0.0, 1))
        if d['hp'] <= 0:
            d['hp'], d['alive'], d['died'], d['by'] = 0.0, False, self.time, src
            if src is not None:
                self.p[src]['kills'] += 1
            # lâche son équipement
            for s in d['slots']:
                if s:
                    self.spawn_loot('arme', d['x'] + self.rnd.uniform(-30, 30), d['y'] + self.rnd.uniform(-30, 30), s['w'], s['r'])
            alive = sum(1 for p in self.p if p['alive'])
            killer = self.p[src]['name'] if src is not None else 'la fonte'
            self.event('kill', d['x'], d['y'], seat=dst, by=src,
                       msg=f"{killer} ✖ {d['name']}" + (f" ({WEAPONS[self.weapon(self.p[src])[0]]['name']})" if src is not None else ''),
                       left=alive)

    # ---------------- robots ----------------
    def ai(self, i):
        p = self.p[i]
        ai = p['ai']
        inp = self.inputs[i]
        ai['t'] -= 1
        z = self.zone
        wid, rar = self.weapon(p)
        Wp = WEAPONS[wid]
        # cible la plus proche visible
        best, bd = None, 1e9
        for j, o in enumerate(self.p):
            if j == i or not o['alive']:
                continue
            d = math.hypot(o['x'] - p['x'], o['y'] - p['y'])
            if d < bd and d < 560:
                best, bd = o, d
        mask = 0
        dz = math.hypot(p['x'] - z['cx'], p['y'] - z['cy'])
        target = None
        if dz > z['r'] * 0.85 and (z['shrink'] or dz > z['r']):
            target = (z['cx'], z['cy'])
        elif best is not None and (wid != 'poings' or bd < 160) and line_clear(p['x'], p['y'], best['x'], best['y']):
            lead = bd / Wp.get('speed', 1e9) if Wp['kind'] == 'gun' else 0
            aim = math.atan2(best['y'] - p['y'], best['x'] - p['x']) + self.rnd.uniform(-0.12, 0.12)
            inp['ang'] = aim
            want = (Wp['range'] * 0.7) if Wp['kind'] == 'melee' else 260
            if bd > want + 40:
                target = (best['x'], best['y'])
            elif bd < want - 60 and Wp['kind'] == 'gun':
                target = (p['x'] - (best['x'] - p['x']), p['y'] - (best['y'] - p['y']))
            else:   # mitraille en se décalant
                perp = aim + math.pi / 2 * ai['side']
                target = (p['x'] + math.cos(perp) * 100, p['y'] + math.sin(perp) * 100)
                if self.rnd.random() < 0.02:
                    ai['side'] *= -1
            if (Wp['kind'] == 'gun' and bd < Wp['speed'] * Wp['life'] * 0.95) or (Wp['kind'] == 'melee' and bd < Wp['range'] + PR + 6):
                if self.rnd.random() < 0.85:
                    mask |= FIRE
        else:
            # va chercher une meilleure arme, des soins ou de l'armure
            if ai['goal'] is None or ai['goal'] not in self.loot or ai['t'] <= 0:
                cands = []
                for it in self.loot:
                    d = math.hypot(it['x'] - p['x'], it['y'] - p['y'])
                    if d > 1000 or math.hypot(it['x'] - z['cx'], it['y'] - z['cy']) > z['r'] * 0.9:
                        continue
                    if it['t'] == 'arme':
                        cur = p['slots'][p['cur']]
                        val = 2 + it['r'] - (cur['r'] + 1 if cur else -1) if (None in p['slots'] or (cur and it['r'] > cur['r'])) else -1
                    elif it['t'] == 'soin':
                        val = (100 - p['hp']) / 30
                    else:
                        val = (100 - p['ar']) / 50
                    if val > 0:
                        cands.append((d / (val + 0.5), it))
                ai['goal'] = min(cands, key=lambda c: c[0])[1] if cands else None
                ai['t'] = 30
            if ai['goal'] is not None:
                g = ai['goal']
                target = (g['x'], g['y'])
                if math.hypot(g['x'] - p['x'], g['y'] - p['y']) < 40 and g['t'] == 'arme' and None not in p['slots']:
                    mask |= PICK
            else:
                target = (z['cx'] + math.cos(self.frame / 90 + i) * z['r'] * 0.4, z['cy'] + math.sin(self.frame / 90 + i) * z['r'] * 0.4)
        if target is not None:
            dx, dy = target[0] - p['x'], target[1] - p['y']
            # évite les obstacles : si bloqué, contourne un moment
            if ai.get('stuck', 0) > 0:
                ai['stuck'] -= 1
                dx, dy = -dy * ai['side'], dx * ai['side']
            elif ai.get('last') and math.hypot(p['x'] - ai['last'][0], p['y'] - ai['last'][1]) < 1.5 and (dx or dy):
                ai['stuck'] = 15
            ai['last'] = (p['x'], p['y'])
            if abs(dx) > 8:
                mask |= R if dx > 0 else L
            if abs(dy) > 8:
                mask |= D if dy > 0 else U
            if not (mask & FIRE) and best is None:
                inp['ang'] = math.atan2(dy, dx)
        if p['slots'][p['cur']] is None and p['slots'][1 - p['cur']] is not None:
            mask |= SWAP
        inp['press'] = inp.get('press', 0) | (mask & ~inp['k'])
        inp['k'] = mask

    # ---------------- état envoyé ----------------
    def completed(self, seat):
        return True

    def init_payload(self):
        return {'map': {'w': W, 'h': H, 'obs': OBSTACLES}, 'weapons': {k: {'name': v['name'], 'kind': v['kind']} for k, v in WEAPONS.items()},
                'rarity': [{'name': r[0], 'mult': r[1], 'color': r[2]} for r in RARITY],
                'metiers': {k: {'name': v['name'], 'color': v['color'], 'perk': v['perk']} for k, v in METIERS.items()}}

    def view(self):
        z = self.zone
        out = {
            'phase': self.phase, 'countdown': round(max(0.0, self.pt), 1), 'time': round(self.time, 1),
            'p': [{'n': p['name'], 'm': p['m'], 'x': round(p['x'], 1), 'y': round(p['y'], 1), 'a': round(p['ang'], 2),
                   'hp': round(p['hp']), 'ar': round(p['ar']), 'al': p['alive'], 'k': p['kills'], 'b': p['bot'],
                   's': p['slots'], 'c': p['cur'], 'sw': p['swing'] > 0, 'by': p['by']} for p in self.p],
            'pr': [[round(q[0]), round(q[1]), q[7], q[9]] for q in self.proj],
            'z': {'x': round(z['cx']), 'y': round(z['cy']), 'r': round(z['r']), 'sh': z['shrink'], 't': round(max(0, z['t'])),
                  'to': [round(v) for v in z['to']] if z['to'] else None, 'ph': z['phase'], 'dps': z['dps']},
            'ev': self.events[-14:],
            'alive': sum(1 for p in self.p if p['alive']),
            'finished': self.finished,
        }
        if self.loot_dirty or self.frame % 15 == 0:
            out['loot'] = [[it['id'], it['x'], it['y'], it['t'], it.get('w'), it.get('r')] for it in self.loot]
            self.loot_dirty = False
        return out
