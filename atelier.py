"""L'Atelier de Coulée : jeu coopératif en ligne façon « cuisine en équipe », sur le thème d'une fonderie
équipée d'une ligne de moulage Disamatic (1 à 4 ouvriers, apprentis robots en renfort), simulé par le serveur.

La machine DISA presse des mottes de sable sans châssis qui avancent en chaîne sur le convoyeur :
  - on remplit sa trémie de sable et on pose les noyaux dans le pose-noyau avant de presser ;
  - on fond la ferraille (et le ferroalliage) au four à induction, on remplit la poche et on coule chaque motte
    quand elle passe devant la zone de coulée (sinon elle part vide) ;
  - le tambour de décochage sort les pièces brutes, qu'on ébarbe à la meuleuse puis qu'on expédie ;
  - un four oublié s'emballe et prend feu : on l'éteint avec un seau de sable.
On peut poser n'importe quel objet sur n'importe quel comptoir. Score en étoiles.
Deux modes de production au choix : petite série (grosses pièces, plus de préparation, beaucoup de points)
ou grande série (petites pièces vite préparées, beaucoup de commandes)."""
from __future__ import annotations
import math
import random
import time

FPS = 30
T = 100
COLS, ROWS = 16, 10
W, H = COLS * T, ROWS * T
PR = 26
SPEED = 300
REACH = 120
ROUND = 210.0
STARS = (120, 260, 400)      # paliers des étoiles ; 2 étoiles = victoire de l'équipe
GOAL = STARS[1]
COUNTDOWN = 3.0
WORK = 1

# convoyeur de la ligne DISA : de la sortie de la machine (x = 3 cases) au tambour (x = 13 cases), sur la rangée 2
BELT_Y = 2
BELT_X0, BELT_X1 = 3 * T, 13 * T
BELT_LEN = BELT_X1 - BELT_X0
BELT_SPEED = 26              # unités par seconde
MOULD = 92                   # longueur d'une motte
POUR_X = (6 * T, 10 * T)     # zone de coulée (on coule depuis la rangée 3)
OUT_CAP = 3                  # pièces en attente à la sortie du tambour

PARTS = {0: 'Disque de frein', 1: 'Collecteur', 2: 'Carter'}       # nombre de noyaux = type de pièce
# modes de production : temps des postes, fonte par motte, commandes, points
MODES = {
    'grande': {'name': 'Grande série', 'desc': 'Petites pièces, préparation rapide, beaucoup de commandes',
               'parts': {0: 'Bride', 1: 'Raccord'}, 'mix': [0, 0, 1], 'press': 0.8, 'core': 1.5, 'grind': 1.6, 'pour': 0.8,
               'metal': 1, 'ladle': 4, 'every': 13.0, 'max': 5, 'lim': 70, 'lim_t': 10, 'pts': 42, 'pts_t': 16, 'big': 0},
    'petite': {'name': 'Petite série', 'desc': 'Grosses pièces : plus de préparation, plus de fonte, plus de points',
               'parts': {1: 'Collecteur', 2: 'Bloc moteur'}, 'mix': [1, 2, 2], 'press': 1.8, 'core': 3.0, 'grind': 4.0, 'pour': 1.8,
               'metal': 2, 'ladle': 4, 'every': 30.0, 'max': 3, 'lim': 130, 'lim_t': 20, 'pts': 75, 'pts_t': 35, 'big': 1},
}
ITEMS = {'sable': 'Seau de sable', 'noyau': 'Noyau', 'ferraille': 'Ferraille', 'alliage': 'Ferroalliage', 'poche': 'Poche de coulée',
         'brute': 'Pièce brute', 'ebarbee': 'Pièce ébarbée'}
DEFECTS = {
    'froide': ('Coulée froide', 'La poche avait refroidi sous 1330 °C : reprises et manques à la surface.'),
    'nuance': ('Mauvaise nuance', 'Fonte sans ferroalliage : la composition n’est pas celle demandée.'),
}

# postes (case, type) ; les comptoirs reçoivent n'importe quel objet
STATIONS = [
    (0, 1, 'sable'), (0, 2, 'sable'), (0, 5, 'noyauteuse'), (0, 7, 'comptoir'), (0, 8, 'expedition'),
    (2, 1, 'tremie'), (2, 2, 'disa'), (2, 3, 'posenoyau'),
    *[(x, BELT_Y, 'tapis') for x in range(3, 13)],
    (13, 2, 'tambour'), (14, 2, 'sortie'),
    (13, 6, 'four'), (12, 6, 'comptoir'), (15, 5, 'ferraille'), (15, 7, 'alliage'),
    (7, 9, 'comptoir'), (8, 9, 'meuleuse'), (9, 9, 'comptoir'), (11, 9, 'poubelle'),
    (5, 5, 'comptoir'), (6, 5, 'comptoir'), (9, 5, 'comptoir'), (10, 5, 'comptoir'), (3, 7, 'comptoir'), (15, 1, 'comptoir'),
]
PILES = {'sable': 'sable', 'ferraille': 'ferraille', 'alliage': 'alliage'}


def st_center(tx, ty):
    return tx * T + T / 2, ty * T + T / 2


def st_front(tx, ty):
    x, y = st_center(tx, ty)
    if (tx, ty) in ((2, 1), (2, 2)):          # trémie et pupitre de la DISA : on y accède par la gauche
        return x - T * 0.85, y
    if tx == 0:
        return x + T * 0.85, y
    if tx == COLS - 1:
        return x - T * 0.85, y
    if ty == 0:
        return x, y + T * 0.85
    if ty == ROWS - 1:
        return x, y - T * 0.85
    if ty == BELT_Y or (tx, ty) in ((2, 1), (13, 2), (14, 2)):
        return x, y + T * 0.85 if ty >= BELT_Y else y - T * 0.85
    return x, y + T * 0.85


class Atelier:
    kind = 'atelier'
    max_seats = 4
    min_seats = 3              # seul, deux apprentis robots (fondeur et mouleur) viennent aider
    stream = True
    send_every = 2
    coop = True

    def __init__(self, seats):
        self.rnd = random.Random()
        want = next(((s.get('opt') or {}).get('map') for s in seats if not s['bot'] and (s.get('opt') or {}).get('map') in MODES), 'grande')
        self.mode_id = want
        self.M = MODES[want]
        self.st = [{'id': i, 'tx': tx, 'ty': ty, 'k': k, 'item': None} for i, (tx, ty, k) in enumerate(STATIONS)]
        self.solid = {(s['tx'], s['ty']) for s in self.st}
        self.p = []
        bots = 0
        for i, s in enumerate(seats):
            role = None
            if s['bot']:
                role = ('fondeur', 'mouleur')[bots % 2]
                bots += 1
            x, y = 6 * T + (i % 2) * 120 + 50, 7 * T + (i // 2) * 100 + 50
            m = (s.get('opt') or {}).get('char') or ('fondeur' if role == 'fondeur' else 'mouleur' if s['bot'] else 'forgeron')
            self.p.append({'name': s['name'], 'bot': s['bot'], 'm': m, 'role': role, 'x': x, 'y': y, 'a': -math.pi / 2, 'carry': None,
                           'work': False, 'seen': 0.0, 'tp': 1, 'act': 0.0, 'cool': 0.0})
        self.inputs = [{'k': 0} for _ in self.p]
        # la poche attend sur le comptoir à côté du four
        self.station('comptoir', 12, 6)['item'] = {'it': 'poche', 'metal': 0, 'temp': 0.0, 'alloy': False}
        self.hopper = 2
        self.setter = 0
        self.press = 0.0
        self.moulds = []
        self.mid = 0
        self.out = []              # pièces brutes sorties du tambour
        self.furnace = {'ferraille': 0, 'alliage': 0, 'state': 'vide', 't': 0.0, 'alloy': False}
        self.core = {'sand': False, 'p': 0.0, 'ready': False}
        self.grind = 0.0
        self.orders = []
        self.oid = 0
        self.next_order = self.M['every'] + 6
        self.score = 0
        self.done = 0
        self.events, self.eid = [], 0
        self.phase, self.pt = 'count', COUNTDOWN
        self.time = 0.0
        self.acc = 0.0
        self.frame = 0
        self.finished = None
        self.success = False
        self.dirty = True
        for t in sorted(self.M['parts'])[:2]:
            self.add_order(t)

    def station(self, k, tx, ty):
        return next(s for s in self.st if s['k'] == k and s['tx'] == tx and s['ty'] == ty)

    def add_order(self, typ=None):
        self.oid += 1
        typ = self.rnd.choice(self.M['mix']) if typ is None else typ
        lim = self.M['lim'] + self.M['lim_t'] * typ
        self.orders.append({'id': self.oid, 'type': typ, 'left': float(lim), 'lim': lim})

    def event(self, kind, x=0, y=0, **kw):
        self.eid += 1
        self.events.append({'id': self.eid, 'k': kind, 'x': round(x), 'y': round(y), **kw})
        self.events = self.events[-30:]

    def station_near(self, p):
        fx, fy = p['x'] + math.cos(p['a']) * 55, p['y'] + math.sin(p['a']) * 55
        best, bd = None, 1e9
        for s in self.st:
            cx, cy = st_center(s['tx'], s['ty'])
            if math.hypot(cx - p['x'], cy - p['y']) > REACH:
                continue
            d = math.hypot(cx - fx, cy - fy)
            if d < bd:
                best, bd = s, d
        return best

    # ---------------- entrées ----------------
    def handle(self, seat, data):
        if seat >= len(self.p) or self.phase != 'play':
            return
        p = self.p[seat]
        if data.get('a') == 'use':
            self.interact(seat)
            return
        if data.get('a') != 'in':
            return
        try:
            k = int(data.get('k', 0))
            pos = data.get('pos')
            tp = int(data.get('tp', 0))
        except (TypeError, ValueError):
            return
        p['work'] = bool(k & WORK)
        if pos and tp == p['tp']:
            try:
                x, y, ang = float(pos[0]), float(pos[1]), float(pos[2])
            except (TypeError, ValueError, IndexError):
                return
            now = time.monotonic()
            el = min(0.6, max(0.02, now - p['seen'])) if p['seen'] else 0.1
            p['seen'] = now
            if math.hypot(x - p['x'], y - p['y']) <= SPEED * 2.2 * el + 40 and not self.blocked(x, y):   # la ruée va vite
                p['x'], p['y'], p['a'] = x, y, ang
            else:
                p['tp'] += 1

    def blocked(self, x, y):
        if x < PR or y < PR or x > W - PR or y > H - PR:
            return True
        for (tx, ty) in self.solid:
            nx = min(max(x, tx * T + 4), tx * T + T - 4)
            ny = min(max(y, ty * T + 4), ty * T + T - 4)
            if (x - nx) ** 2 + (y - ny) ** 2 < PR * PR:
                return True
        return False

    def interact(self, i):
        """E : prendre, poser, charger, livrer, éteindre…"""
        p = self.p[i]
        s = self.station_near(p)
        if s is None:
            return
        k, c = s['k'], p['carry']
        it = c and c['it']
        sx, sy = st_center(s['tx'], s['ty'])
        if k in PILES:
            if c is None:
                p['carry'] = {'it': PILES[k]}
                self.event('take', sx, sy, seat=i, it=PILES[k])
            elif it == PILES[k]:
                p['carry'] = None
            return
        if k == 'comptoir':
            if c is None and s['item']:
                p['carry'], s['item'] = s['item'], None
            elif c is not None and s['item'] is None:
                s['item'], p['carry'] = c, None
                self.event('put', sx, sy, seat=i)
            return
        if k == 'poubelle' and c is not None:
            if it == 'poche':
                c.update(metal=0, temp=0.0, alloy=False)        # on vide la poche, on la garde
            else:
                p['carry'] = None
            self.event('trash', sx, sy, seat=i)
            return
        if k == 'tremie' and it == 'sable' and self.hopper < 4:
            self.hopper += 1; p['carry'] = None; self.event('hopper', sx, sy, seat=i); return
        if k == 'posenoyau':
            if it == 'noyau' and self.setter < 2:
                self.setter += 1; p['carry'] = None; self.event('core', sx, sy, seat=i)
            elif c is None and self.setter > 0:
                self.setter -= 1; p['carry'] = {'it': 'noyau'}
            return
        if k == 'noyauteuse':
            co = self.core
            if it == 'sable' and not co['sand'] and not co['ready']:
                co['sand'], co['p'] = True, 0.0; p['carry'] = None
            elif c is None and co['ready']:
                co['ready'] = False; p['carry'] = {'it': 'noyau'}
            return
        if k == 'four':
            f = self.furnace
            if f['state'] == 'feu':
                if it == 'sable':
                    p['carry'] = None
                    f.update(state='vide', ferraille=0, alliage=0, t=0.0)
                    self.event('extinct', sx, sy, seat=i)
                return
            if it in ('ferraille', 'alliage') and f['state'] == 'vide' and f['ferraille'] + f['alliage'] < 3:
                f[it] += 1; p['carry'] = None; self.event('charge', sx, sy, seat=i, it=it); return
            if it == 'poche' and f['state'] == 'pret' and c['metal'] == 0:
                c.update(metal=self.M['ladle'], temp=1460.0, alloy=f['alloy'])
                f.update(state='vide', ferraille=0, alliage=0, t=0.0)
                self.event('tap', sx, sy, seat=i)
            return
        if k == 'sortie' and c is None and self.out:
            p['carry'] = self.out.pop(0)
            return
        if k == 'meuleuse':
            if c is None and s['item']:
                p['carry'], s['item'] = s['item'], None
            elif it in ('brute', 'ebarbee') and s['item'] is None:
                s['item'], p['carry'] = c, None; self.grind = 0.0
            return
        if k == 'expedition' and it == 'ebarbee':
            self.deliver(i, c); p['carry'] = None
            return

    def deliver(self, i, pc):
        typ = pc['type']
        o = next((o for o in self.orders if o['type'] == typ), None)
        x, y = st_center(0, 8)
        if o is None:
            self.event('deliver', x, y, seat=i, pts=0, ok=False, type=typ, defects=pc.get('defects', []))
            return
        self.orders.remove(o)
        pts = self.M['pts'] + self.M['pts_t'] * typ + round(self.M['pts'] * 0.5 * o['left'] / o['lim'])
        if pc.get('defects'):
            pts //= 2
        self.score += pts
        self.done += 1
        self.event('deliver', x, y, seat=i, pts=pts, ok=True, type=typ, defects=pc.get('defects', []))

    # ---------------- simulation ----------------
    def tick(self, dt, connected):
        self.acc += dt
        steps = 0
        while self.acc >= 1 / FPS and steps < 4:
            self.acc -= 1 / FPS
            steps += 1
            self.step(connected)
        if steps == 4:
            self.acc = 0.0

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
        # commandes
        self.next_order -= dt
        if self.next_order <= 0 and len(self.orders) < self.M['max']:
            self.add_order()
            self.next_order = self.M['every']
        for o in list(self.orders):
            o['left'] -= dt
            if o['left'] <= 0:
                self.orders.remove(o)
                self.score = max(0, self.score - 10)
                self.event('expire', 0, 0, type=o['type'])
        for i, p in enumerate(self.p):
            if p['bot'] or not connected(i):
                self.bot(i, dt)
        # convoyeur : la chaîne de mottes avance ; elle s'arrête si la sortie du tambour est pleine
        self.moulds.sort(key=lambda m: -m['u'])
        lead = BELT_LEN + MOULD
        for m in self.moulds:
            limit = lead - MOULD
            if m['u'] >= BELT_LEN - MOULD / 2 and len(self.out) >= OUT_CAP:
                limit = min(limit, BELT_LEN - MOULD / 2)
            m['u'] = min(m['u'] + BELT_SPEED * dt, limit)
            lead = m['u']
            if m['poured']:
                m['cool'] += dt
        for m in list(self.moulds):
            if m['u'] >= BELT_LEN - MOULD / 2 and len(self.out) < OUT_CAP:   # le tambour casse la motte
                self.moulds.remove(m)
                x, y = st_center(13, 2)
                if m['poured']:
                    defects = (['froide'] if m['temp'] < 1330 else []) + ([] if m['alloy'] else ['nuance'])
                    self.out.append({'it': 'brute', 'type': m['cores'], 'defects': defects})
                    self.event('shake', x, y, type=m['cores'], defects=defects)
                else:
                    self.event('empty', x, y)
        # four à induction
        f = self.furnace
        if f['state'] == 'vide' and (f['ferraille'] >= 3 or (f['ferraille'] >= 2 and f['alliage'] >= 1)):
            f['state'], f['t'], f['alloy'] = 'fusion', 0.0, f['alliage'] >= 1
        elif f['state'] == 'fusion':
            f['t'] += dt
            if f['t'] >= 9:
                f['state'], f['t'] = 'pret', 0.0
                self.event('ready', *st_center(13, 6))
        elif f['state'] == 'pret':
            f['t'] += dt
            if f['t'] >= 22:
                f['state'], f['t'] = 'feu', 0.0
                self.event('fire', *st_center(13, 6))
        # poches : la fonte refroidit, puis se fige
        for holder in [p['carry'] for p in self.p] + [s['item'] for s in self.st]:
            if holder and holder['it'] == 'poche' and holder['metal'] > 0:
                holder['temp'] -= 3.2 * dt
                if holder['temp'] < 1250:
                    holder.update(metal=0, temp=0.0, alloy=False)
                    self.event('frozen', 0, 0)
        # travail maintenu (Espace)
        pressing = False
        for i, p in enumerate(self.p):
            if not p['work']:
                continue
            s = self.station_near(p)
            c = p['carry']
            # couler : poche pleine, devant la zone de coulée, une motte non coulée en face
            if c and c['it'] == 'poche' and c['metal'] >= self.M['metal'] and POUR_X[0] - 40 <= p['x'] <= POUR_X[1] + 40 and p['y'] < (BELT_Y + 1) * T + 80:
                m = min((m for m in self.moulds if not m['poured']), key=lambda m: abs(BELT_X0 + m['u'] - MOULD / 2 - p['x']), default=None)
                if m and abs(BELT_X0 + m['u'] - MOULD / 2 - p['x']) < 70 and POUR_X[0] <= BELT_X0 + m['u'] - MOULD / 2 <= POUR_X[1]:
                    m['pp'] += dt
                    p['act'] = 0.2
                    if m['pp'] >= self.M['pour']:
                        m.update(poured=True, temp=c['temp'], alloy=c['alloy'])
                        c['metal'] -= self.M['metal']
                        if c['metal'] <= 0:
                            c.update(metal=0, temp=0.0, alloy=False)
                        self.event('poured', BELT_X0 + m['u'] - MOULD / 2, BELT_Y * T + 50)
                continue
            if s is None or c is not None:
                continue
            if s['k'] == 'disa' and self.hopper > 0 and (not self.moulds or min(m['u'] for m in self.moulds) >= MOULD):
                pressing = True
                self.press += dt / 2           # à deux sur le levier, ça va deux fois plus vite
                if self.press >= self.M['press']:
                    self.press = 0.0
                    self.hopper -= 1
                    self.mid += 1
                    self.moulds.append({'id': self.mid, 'u': 0.0, 'cores': self.setter, 'poured': False, 'pp': 0.0, 'temp': 0.0, 'alloy': False, 'cool': 0.0})
                    self.event('press', *st_center(2, 2), cores=self.setter)
                    self.setter = 0
            elif s['k'] == 'noyauteuse' and self.core['sand'] and not self.core['ready']:
                self.core['p'] += dt
                if self.core['p'] >= self.M['core']:
                    self.core.update(sand=False, ready=True, p=0.0)
                    self.event('coreok', *st_center(0, 5))
            elif s['k'] == 'meuleuse' and s['item'] and s['item']['it'] == 'brute':
                self.grind += dt
                if self.grind >= self.M['grind']:
                    s['item']['it'] = 'ebarbee'
                    self.grind = 0.0
                    self.event('ground', *st_center(8, 9))
        if self.time >= ROUND:
            self.phase = 'over'
            self.success = self.score >= GOAL
            self.finished = sorted(range(len(self.p)), key=lambda i: self.p[i]['bot'])
            self.event('end', 0, 0, score=self.score, ok=self.success, stars=sum(1 for s in STARS if self.score >= s))

    # ---------------- apprentis robots ----------------
    def path_next(self, sx, sy, gx, gy):
        """Prochaine case à viser pour aller de (sx, sy) à (gx, gy) en contournant les postes (parcours en largeur)."""
        start, goal = (int(sx // T), int(sy // T)), (int(gx // T), int(gy // T))
        if start == goal:
            return None
        prev = {start: None}
        queue = [start]
        while queue:
            cur = queue.pop(0)
            if cur == goal:
                break
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (cur[0] + dx, cur[1] + dy)
                if 0 <= n[0] < COLS and 0 <= n[1] < ROWS and n not in prev and n not in self.solid:
                    prev[n] = cur
                    queue.append(n)
        if goal not in prev:
            return None
        node = goal
        while prev[node] != start and prev[node] is not None:
            node = prev[node]
        return node

    def go(self, p, tx, ty, dt):
        gx, gy = st_front(tx, ty)
        cx, cy = st_center(tx, ty)
        nxt = self.path_next(p['x'], p['y'], gx, gy)
        wx, wy = (nxt[0] * T + T / 2, nxt[1] * T + T / 2) if nxt else (gx, gy)
        dx, dy = wx - p['x'], wy - p['y']
        d = math.hypot(dx, dy)
        if not nxt and d < 14:
            p['a'] = math.atan2(cy - p['y'], cx - p['x'])
            return True
        sp = min(d, 240 * dt)
        if d > 0:
            nx, ny = p['x'] + dx / d * sp, p['y'] + dy / d * sp
            if not self.blocked(nx, ny):
                p['x'], p['y'] = nx, ny
            else:                      # recentre sur sa case pour ne pas frotter les coins
                bx, by = (int(p['x'] // T) + 0.5) * T, (int(p['y'] // T) + 0.5) * T
                p['x'] += (bx - p['x']) * min(1, 6 * dt); p['y'] += (by - p['y']) * min(1, 6 * dt)
            p['a'] = math.atan2(dy, dx)
        return False

    def first(self, k):
        return next(s for s in self.st if s['k'] == k)

    def bot(self, i, dt):
        p = self.p[i]
        p['work'] = False
        p['act'] = max(0.0, p['act'] - dt)
        if p['act'] > 0:
            return
        def at(s, use=False, work=False):
            if self.go(p, s['tx'], s['ty'], dt):
                if use:
                    self.interact(i)
                    p['act'] = 0.35
                p['work'] = work
        c = p['carry']
        f = self.furnace
        if p['role'] == 'fondeur':     # garde le four chargé et l'éteint s'il prend feu
            if c and c['it'] in ('ferraille', 'alliage'):
                at(self.first('four'), use=True); return
            if c and c['it'] == 'sable':
                at(self.first('four'), use=True); return
            if f['state'] == 'feu':
                at(self.first('sable'), use=True); return
            # remplit la poche quand le four est prêt, puis la pose près de la zone de coulée
            if c and c['it'] == 'poche':
                if c['metal'] == 0 and f['state'] == 'pret':
                    at(self.first('four'), use=True); return
                spot = next((s for s in self.st if s['k'] == 'comptoir' and s['ty'] == 5 and 5 <= s['tx'] <= 10 and s['item'] is None), None)
                if c['metal'] > 0 and spot:
                    at(spot, use=True); return
                at(self.station('comptoir', 12, 6), use=True); return
            ladle = next((s for s in self.st if s['item'] and s['item']['it'] == 'poche'), None)
            if f['state'] == 'pret' and ladle and ladle['item']['metal'] == 0:
                at(ladle, use=True); return
            if f['state'] == 'vide':
                at(self.first('alliage' if f['alliage'] < 1 else 'ferraille'), use=True)
                return
            self.go(p, 12, 7, dt)
        else:                          # mouleur : trémie pleine, noyaux pour les commandes, presse la DISA
            # prépare la plus ancienne commande qui n'a pas encore sa motte sur la ligne
            on_line = [m['cores'] for m in self.moulds] + [o for o in []]
            pending = [o['type'] for o in self.orders]
            for t in on_line:
                if t in pending:
                    pending.remove(t)
            need = pending[0] if pending else min(self.M['parts'])
            if c and c['it'] == 'sable':
                if self.hopper < 3:
                    at(self.first('tremie'), use=True)
                else:
                    at(self.first('noyauteuse'), use=True)
                return
            if c and c['it'] == 'noyau':
                at(self.first('posenoyau'), use=True); return
            if self.core['ready'] and self.setter < need:
                at(self.first('noyauteuse'), use=True); return
            if self.core['sand'] and not self.core['ready']:
                at(self.first('noyauteuse'), work=True); return
            if self.hopper < 2:
                at(self.first('sable'), use=True); return
            if self.setter < need and not self.core['sand']:
                at(self.first('sable'), use=True); return
            free = not self.moulds or min(m['u'] for m in self.moulds) >= MOULD
            if free and len(self.moulds) < 4:
                at(self.first('disa'), work=True); return
            self.go(p, 3, 4, dt)

    # ---------------- état envoyé ----------------
    def completed(self, seat):
        return True

    def init_payload(self):
        return {'grid': {'cols': COLS, 'rows': ROWS, 'tile': T}, 'stations': [{k: s[k] for k in ('id', 'tx', 'ty', 'k')} for s in self.st],
                'parts': self.M['parts'], 'items': ITEMS,
                'mode': {'id': self.mode_id, 'name': self.M['name'], 'desc': self.M['desc'], 'press': self.M['press'], 'core': self.M['core'],
                         'grind': self.M['grind'], 'pour': self.M['pour'], 'metal': self.M['metal'], 'ladle': self.M['ladle'], 'big': self.M['big']}, 'defects': {k: list(v) for k, v in DEFECTS.items()}, 'round': ROUND, 'goal': GOAL,
                'stars': STARS, 'pr': PR, 'speed': SPEED, 'reach': REACH,
                'belt': {'y': BELT_Y, 'x0': BELT_X0, 'len': BELT_LEN, 'mould': MOULD, 'pour': POUR_X}}

    def view(self):
        f = self.furnace
        return {
            'phase': self.phase, 'countdown': round(max(0.0, self.pt), 1), 'time': round(self.time, 1), 'score': self.score, 'done': self.done,
            'p': [{'n': p['name'], 'm': p['m'], 'b': p['bot'], 'x': round(p['x'], 1), 'y': round(p['y'], 1), 'a': round(p['a'], 2),
                   'c': p['carry'], 'w': p['work'] or p['act'] > 0, 'tp': p['tp']} for p in self.p],
            'items': {s['id']: s['item'] for s in self.st if s['item']},
            'moulds': [{'id': m['id'], 'u': round(m['u'], 1), 'cores': m['cores'], 'poured': m['poured'], 'pp': round(m['pp'], 2), 'cool': round(m['cool'], 1)} for m in self.moulds],
            'hopper': self.hopper, 'setter': self.setter, 'press': round(self.press, 2), 'out': [o['type'] for o in self.out],
            'core': {'sand': self.core['sand'], 'p': round(self.core['p'], 2), 'ready': self.core['ready']}, 'grind': round(self.grind, 2),
            'furnace': {'fe': f['ferraille'], 'al': f['alliage'], 'state': f['state'], 't': round(f['t'], 1), 'alloy': f['alloy']},
            'orders': [{'id': o['id'], 'type': o['type'], 'left': round(o['left']), 'lim': o['lim']} for o in self.orders],
            'ev': self.events[-12:],
            'finished': self.finished,
        }
