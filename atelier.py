"""L'Atelier de Coulée : jeu coopératif en ligne (1 à 4 ouvriers, apprentis robots en renfort), simulé par le serveur.

L'équipe doit honorer des commandes de pièces en fonte en enchaînant tous les métiers de la fonderie :
  - moulage : apporter le sable au châssis, le tasser (plus vite à plusieurs), poser les noyaux, fermer le moule ;
  - pont roulant : un ouvrier le pilote au pupitre pendant qu'un autre accroche et décroche moules et poche ;
  - cubilot : le charger en fonte, coke et castine dans le bon dosage, lancer la soufflerie, percer au trou de coulée ;
  - dosage métallurgique : inoculer la poche au ferrosilicium (1 pour 2 unités de fonte), couler avant qu'elle refroidisse ;
  - coulée, refroidissement, décochage sur la grille, livraison.
La qualité de chaque pièce dépend du dosage, de la température et de la régularité de la coulée."""
from __future__ import annotations
import math
import random
import time

FPS = 30
T = 100                     # côté d'une case
COLS, ROWS = 16, 10
W, H = COLS * T, ROWS * T
PR = 26                     # rayon d'un ouvrier
SPEED = 300
REACH = 120                 # portée d'interaction
HOOK_REACH = 75             # le crochet doit être au-dessus de l'objet
CRANE_SPEED = 280
ROUND = 240.0
GOAL = 300                  # score d'équipe pour la victoire collective
COUNTDOWN = 3.0

# touches envoyées par le navigateur
WORK = 1                    # maintenir : tasser, percer, couler, décocher

PARTS = {1: 'Roue de wagonnet', 2: 'Carter de pompe', 3: 'Bloc-cylindres'}   # nombre de noyaux = type de pièce
ITEMS = {'sable': 'Sable de moulage', 'noyau': 'Noyau', 'coke': 'Coke', 'fonte': 'Gueuse de fonte', 'castine': 'Castine',
         'fesi': 'Ferrosilicium', 'piece': 'Pièce brute'}

# postes de travail (case, type) : contre les murs ou au milieu de la halle
STATIONS = [
    (0, 1, 'sable'), (0, 3, 'noyaux'), (0, 7, 'livraison'),
    (3, 2, 'etabli'), (3, 5, 'etabli'),
    (5, 9, 'grille'),
    (7, 0, 'coulee'), (8, 0, 'coulee'), (9, 0, 'coulee'),
    (7, 9, 'pupitre'),
    (13, 0, 'bec'), (14, 0, 'cubilot'),
    (15, 2, 'soufflerie'), (15, 5, 'coke'), (15, 6, 'fonte'), (15, 7, 'castine'),
    (12, 9, 'fesi'),
]
PILES = {'sable': 'sable', 'noyaux': 'noyau', 'coke': 'coke', 'fonte': 'fonte', 'castine': 'castine', 'fesi': 'fesi'}
DEFECTS = {
    'malvenue': ('Malvenue', True, 'Fonte trop froide à la coulée : la pièce ne s’est pas remplie.'),
    'reprise': ('Reprise de coulée', False, 'Coulée tiède ou interrompue : deux fronts de métal se sont mal soudés.'),
    'trempe': ('Fonte blanche (trempe)', True, 'Pas assez de ferrosilicium : la fonte a durci en blanc, cassante et inusinable.'),
    'surinoc': ('Surinoculation', False, 'Trop de ferrosilicium : fonte trop siliceuse, à corriger.'),
    'laitier': ('Inclusions de laitier', False, 'Pas assez de castine dans le cubilot : laitier épais entraîné dans la pièce.'),
    'carbone': ('Fonte trop carburée', False, 'Trop de coke : fonte trop riche en carbone, graphite grossier.'),
}


def st_center(tx, ty):
    return tx * T + T / 2, ty * T + T / 2


def st_front(tx, ty):
    """Point où se placer pour travailler à un poste (côté halle)."""
    x, y = st_center(tx, ty)
    if tx == 0:
        return x + T * 0.85, y
    if tx == COLS - 1:
        return x - T * 0.85, y
    if ty == 0:
        return x, y + T * 0.85
    if ty == ROWS - 1:
        return x, y - T * 0.85
    return x + T * 0.85, y


class Atelier:
    kind = 'atelier'
    max_seats = 4
    min_seats = 2              # seul, un apprenti robot vient aider
    stream = True
    send_every = 2
    coop = True

    def __init__(self, seats):
        self.rnd = random.Random()
        self.st = [{'id': i, 'tx': tx, 'ty': ty, 'k': k} for i, (tx, ty, k) in enumerate(STATIONS)]
        self.solid = {(s['tx'], s['ty']) for s in self.st}
        self.p = []
        bots = 0
        for i, s in enumerate(seats):
            role = None
            if s['bot']:
                role = ('fondeur', 'mouleur')[bots % 2]
                bots += 1
            x, y = 6 * T + (i % 2) * 120, 4 * T + (i // 2) * 120
            m = (s.get('opt') or {}).get('char') or ('fondeur' if role == 'fondeur' else 'mouleur' if s['bot'] else 'forgeron')
            self.p.append({'name': s['name'], 'bot': s['bot'], 'm': m, 'role': role, 'x': x, 'y': y, 'a': 0.0, 'carry': None,
                           'op': False, 'work': False, 'seen': 0.0, 'tp': 1, 'mx': 0.0, 'my': 0.0, 'goal': None, 'act': 0.0})
        self.inputs = [{'k': 0, 'press': 0} for _ in self.p]
        self.crane = {'x': 8 * T, 'y': 4 * T, 'vx': 0.0, 'vy': 0.0, 'obj': None}
        self.moulds = []
        self.mid = 0
        for s in self.st:
            if s['k'] == 'etabli':
                self.new_mould(s)
        self.ladle = {'loc': 'bec', 'metal': 0.0, 'temp': 0.0, 'fesi': 0, 'tapped': 0.0, 'slag': 1.0, 'carb': 0.5}
        self.cupola = {'coke': 2, 'fonte': 3, 'castine': 1, 'blow': False, 'metal': 0.0, 'temp': 1150.0, 'slag': 1.0, 'carb': 0.5}
        self.floor = []          # objets posés par terre : {id, it, x, y, data}
        self.fid = 0
        self.orders = []
        self.oid = 0
        self.next_order = 0.0
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
        for _ in range(2):
            self.add_order()

    # ---------------- objets ----------------
    def new_mould(self, s):
        self.mid += 1
        x, y = st_center(s['tx'], s['ty'])
        self.moulds.append({'id': self.mid, 'loc': ('st', s['id']), 'x': x, 'y': y, 'sand': 0, 'ram': 0.0, 'cores': 0, 'closed': False,
                            'need': 0, 'metal': 0.0, 'tmin': 9999.0, 'gap': 0.0, 'broke': False, 'inoc': None, 'slag': 1.0, 'carb': 0.5,
                            'cool': 0.0, 'shake': 0.0})

    def add_order(self):
        self.oid += 1
        typ = self.rnd.choice([1, 1, 2, 2, 3])
        lim = 120 + 30 * typ
        self.orders.append({'id': self.oid, 'type': typ, 'left': float(lim), 'lim': lim})

    def event(self, kind, x=0, y=0, **kw):
        self.eid += 1
        self.events.append({'id': self.eid, 'k': kind, 'x': round(x), 'y': round(y), **kw})
        self.events = self.events[-30:]

    def mould_at(self, sid):
        return next((m for m in self.moulds if m['loc'] == ('st', sid)), None)

    def station_near(self, p):
        """Poste devant l'ouvrier (le plus proche du point visé)."""
        fx, fy = p['x'] + math.cos(p['a']) * 55, p['y'] + math.sin(p['a']) * 55
        best, bd = None, 1e9
        for s in self.st:
            cx, cy = st_center(s['tx'], s['ty'])
            d = math.hypot(cx - p['x'], cy - p['y'])
            if d > REACH:
                continue
            d2 = math.hypot(cx - fx, cy - fy)
            if d2 < bd:
                best, bd = s, d2
        return best

    # ---------------- entrées ----------------
    def handle(self, seat, data):
        if seat >= len(self.p) or self.phase != 'play':
            return
        p = self.p[seat]
        a = data.get('a')
        if a == 'use':
            self.interact(seat)
            return
        if a != 'in':
            return
        try:
            k = int(data.get('k', 0))
            mx, my = float(data.get('mx', 0)), float(data.get('my', 0))
            pos = data.get('pos')
            tp = int(data.get('tp', 0))
        except (TypeError, ValueError):
            return
        p['work'] = bool(k & WORK)
        n = math.hypot(mx, my)
        p['mx'], p['my'] = (mx / n, my / n) if n > 1 else (mx, my)
        if pos and not p['op'] and tp == p['tp']:
            try:
                x, y, ang = float(pos[0]), float(pos[1]), float(pos[2])
            except (TypeError, ValueError, IndexError):
                return
            now = time.monotonic()
            el = min(0.6, max(0.02, now - p['seen'])) if p['seen'] else 0.1
            p['seen'] = now
            if math.hypot(x - p['x'], y - p['y']) <= SPEED * 1.3 * el + 40 and not self.blocked(x, y):
                p['x'], p['y'], p['a'] = x, y, ang
            else:
                p['tp'] += 1

    def blocked(self, x, y):
        if x < PR or y < PR or x > W - PR or y > H - PR:
            return True
        for (tx, ty) in self.solid:
            nx = min(max(x, tx * T + 6), tx * T + T - 6)
            ny = min(max(y, ty * T + 6), ty * T + T - 6)
            if (x - nx) ** 2 + (y - ny) ** 2 < PR * PR:
                return True
        return False

    def give(self, p, it, data=None):
        p['carry'] = {'it': it, **(data or {})}

    def interact(self, i):
        """E : prendre, poser, accrocher au pont, piloter le pont, charger le cubilot…"""
        p = self.p[i]
        if p['op']:
            p['op'] = False
            self.event('op', p['x'], p['y'], seat=i, on=False)
            return
        s = self.station_near(p)
        c = self.crane
        carry = p['carry']
        if s is not None:
            k = s['k']
            sx, sy = st_center(s['tx'], s['ty'])
            hook_here = math.hypot(c['x'] - sx, c['y'] - sy) < HOOK_REACH
            # --- pont roulant : accrocher / décrocher l'objet sous le crochet
            if hook_here and carry is None:
                if c['obj'] is None:
                    m = self.mould_at(s['id'])
                    if m and k in ('etabli', 'coulee', 'grille') and (m['closed'] or k != 'etabli') and m['shake'] <= 0:
                        if k == 'coulee' and 0 < m['metal'] < m['need']:
                            pass        # on ne déplace pas un moule en cours de coulée
                        else:
                            m['loc'] = ('crane',)
                            c['obj'] = ('mould', m['id'])
                            self.event('hook', sx, sy, seat=i)
                            if k == 'etabli':
                                s['respawn'] = 3.0
                            return
                    if k == 'bec' and self.ladle['loc'] == 'bec':
                        self.ladle['loc'] = 'crane'
                        c['obj'] = ('ladle', 0)
                        self.event('hook', sx, sy, seat=i)
                        return
                else:
                    kind, oid = c['obj']
                    if kind == 'mould' and k in ('coulee', 'grille') and self.mould_at(s['id']) is None:
                        m = next(mm for mm in self.moulds if mm['id'] == oid)
                        m['loc'], m['x'], m['y'] = ('st', s['id']), sx, sy
                        c['obj'] = None
                        self.event('unhook', sx, sy, seat=i)
                        return
                    if kind == 'ladle' and k == 'bec':
                        self.ladle['loc'] = 'bec'
                        c['obj'] = None
                        self.event('unhook', sx, sy, seat=i)
                        return
            # --- pupitre : prendre les commandes du pont
            if k == 'pupitre' and carry is None:
                if not any(q['op'] for q in self.p):
                    p['op'] = True
                    self.event('op', sx, sy, seat=i, on=True)
                return
            # --- tas et réserves
            if k in PILES:
                if carry is None:
                    self.give(p, PILES[k])
                    self.event('take', sx, sy, seat=i, it=PILES[k])
                elif carry['it'] == PILES[k]:
                    p['carry'] = None
                return
            if carry is not None:
                it = carry['it']
                if k == 'etabli':
                    m = self.mould_at(s['id'])
                    if m and not m['closed']:
                        if it == 'sable' and m['sand'] < 2:
                            m['sand'] += 1; p['carry'] = None; self.event('sand', sx, sy, seat=i); return
                        if it == 'noyau' and m['ram'] >= 1 and m['cores'] < 3:
                            m['cores'] += 1; p['carry'] = None; self.event('core', sx, sy, seat=i); return
                if k == 'cubilot' and it in ('coke', 'fonte', 'castine'):
                    cu = self.cupola
                    if cu['coke'] + cu['fonte'] + cu['castine'] < 14:
                        cu[it] += 1; p['carry'] = None; self.event('charge', sx, sy, seat=i, it=it)
                    return
                if k == 'bec' and it == 'fesi' and self.ladle['loc'] == 'bec':
                    self.ladle['fesi'] += 1; p['carry'] = None; self.event('fesi', sx, sy, seat=i); return
                if k == 'livraison' and it == 'piece':
                    self.deliver(i, carry); p['carry'] = None; return
            else:
                if k == 'soufflerie':
                    self.cupola['blow'] = not self.cupola['blow']
                    self.event('blow', sx, sy, seat=i, on=self.cupola['blow'])
                    return
                if k == 'etabli':
                    m = self.mould_at(s['id'])
                    if m and not m['closed'] and m['ram'] >= 1 and m['cores'] >= 1:
                        m['closed'] = True; m['need'] = m['cores']
                        self.event('close', sx, sy, seat=i, cores=m['cores'])
                        return
                if k == 'grille':
                    pc = next((f for f in self.floor if f['st'] == s['id']), None)
                    if pc:
                        self.floor.remove(pc)
                        p['carry'] = {'it': 'piece', **pc['data']}
                        return
        # --- rien à faire ici : on pose / ramasse par terre
        if carry is not None:
            self.fid += 1
            self.floor.append({'id': self.fid, 'it': carry['it'], 'x': p['x'] + math.cos(p['a']) * 40, 'y': p['y'] + math.sin(p['a']) * 40,
                               'data': {k2: v for k2, v in carry.items() if k2 != 'it'}, 'st': None})
            p['carry'] = None
        else:
            f = min((f for f in self.floor if f['st'] is None), key=lambda f: math.hypot(f['x'] - p['x'], f['y'] - p['y']), default=None)
            if f and math.hypot(f['x'] - p['x'], f['y'] - p['y']) < 80:
                self.floor.remove(f)
                p['carry'] = {'it': f['it'], **f['data']}

    def deliver(self, i, pc):
        typ = pc.get('type', 1)
        o = next((o for o in self.orders if o['type'] == typ), None)
        defects = pc.get('defects', [])
        crit = any(DEFECTS[d][1] for d in defects)
        if crit:
            pts = 0
            verdict = 'rebut'
        else:
            pts = 100 - 25 * len(defects) + (round(30 * o['left'] / o['lim']) if o else 0)
            verdict = 'retouche' if defects else 'conforme'
            if o is None:
                pts = 20
        if o is not None and not crit:
            self.orders.remove(o)
            self.done += 1
        self.score += pts
        x, y = st_center(0, 7)
        self.event('deliver', x, y, seat=i, pts=pts, verdict=verdict, type=typ, defects=defects)

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
        if self.next_order <= 0 and len(self.orders) < 4:
            self.add_order()
            self.next_order = 35.0
        for o in list(self.orders):
            o['left'] -= dt
            if o['left'] <= 0:
                self.orders.remove(o)
                self.score -= 20
                self.event('expire', 0, 0, type=o['type'])
        # robots
        for i, p in enumerate(self.p):
            if p['bot'] or not connected(i):
                self.bot(i, dt)
        # pont roulant : piloté par l'ouvrier au pupitre
        c = self.crane
        op = next((p for p in self.p if p['op']), None)
        tx, ty = (op['mx'], op['my']) if op else (0.0, 0.0)
        c['vx'] += (tx * CRANE_SPEED - c['vx']) * min(1.0, 5 * dt)
        c['vy'] += (ty * CRANE_SPEED - c['vy']) * min(1.0, 5 * dt)
        c['x'] = min(W - 60, max(60, c['x'] + c['vx'] * dt))
        c['y'] = min(H - 60, max(60, c['y'] + c['vy'] * dt))
        if c['obj'] and c['obj'][0] == 'mould':
            m = next(mm for mm in self.moulds if mm['id'] == c['obj'][1])
            m['x'], m['y'] = c['x'], c['y']
        # cubilot : fusion quand la soufflerie tourne
        cu = self.cupola
        if cu['blow'] and cu['fonte'] > 0 and cu['coke'] > 0 and cu['metal'] < 6:
            ratio = cu['coke'] / max(1, cu['fonte'])
            target = 1260 + min(1.0, ratio / 0.5) * 200 + max(0.0, ratio - 0.5) * 60
            cu['temp'] += (target - cu['temp']) * min(1.0, 0.35 * dt)
            melt = 0.22 * dt
            cu['metal'] += melt
            cu['_f'] = cu.get('_f', 0.0) + melt
            if cu['_f'] >= 1:                    # une gueuse fondue consomme le combustible et le fondant
                cu['_f'] -= 1
                cu['fonte'] -= 1
                cu['coke'] = max(0, cu['coke'] - (1 if self.rnd.random() < 0.5 else 0))
                slag_ok = cu['castine'] > 0
                if slag_ok and self.rnd.random() < 0.35:
                    cu['castine'] -= 1
                cu['slag'] += ((1.0 if slag_ok else 0.2) - cu['slag']) * 0.5
                cu['carb'] += (min(1.0, ratio) - cu['carb']) * 0.5
        else:
            cu['temp'] = max(1150.0, cu['temp'] - (12 if not cu['blow'] else 4) * dt)
        # poche : elle refroidit tant qu'elle contient de la fonte
        la = self.ladle
        if la['metal'] > 0:
            la['temp'] -= 3 * dt
        # établis : un nouveau châssis arrive quand le moule est parti
        for s in self.st:
            if s['k'] == 'etabli' and s.get('respawn'):
                s['respawn'] -= dt
                if s['respawn'] <= 0:
                    s['respawn'] = 0
                    if self.mould_at(s['id']) is None:
                        self.new_mould(s)
        # travail maintenu (Espace)
        for i, p in enumerate(self.p):
            if not p['work'] or p['op'] or p['carry'] is not None:
                continue
            s = self.station_near(p)
            if s is None:
                continue
            k = s['k']
            m = self.mould_at(s['id'])
            if k == 'etabli' and m and m['sand'] >= 2 and m['ram'] < 1:
                m['ram'] = min(1.0, m['ram'] + dt / 5)          # 5 s seul, 2,5 s à deux…
                if m['ram'] >= 1:
                    self.event('rammed', *st_center(s['tx'], s['ty']))
            elif k == 'bec' and la['loc'] == 'bec' and cu['metal'] > 0.02 and la['metal'] < 4:
                q = min(cu['metal'], 0.8 * dt, 4 - la['metal'])
                la['temp'] = (la['temp'] * la['metal'] + cu['temp'] * q) / (la['metal'] + q)
                la['slag'] = (la['slag'] * la['metal'] + cu['slag'] * q) / (la['metal'] + q)
                la['carb'] = (la['carb'] * la['metal'] + cu['carb'] * q) / (la['metal'] + q)
                la['metal'] += q; la['tapped'] += q; cu['metal'] -= q
                p['act'] = 0.2
            elif k == 'coulee' and m and m['closed'] and m['metal'] < m['need'] and c['obj'] == ('ladle', 0) \
                    and math.hypot(c['x'] - m['x'], c['y'] - m['y']) < HOOK_REACH and la['metal'] > 0:
                q = min(la['metal'], 0.7 * dt, m['need'] - m['metal'])
                m['metal'] += q; la['metal'] -= q
                m['tmin'] = min(m['tmin'], la['temp'])
                m['gap'] = 0.0
                m['slag'] = min(m['slag'], la['slag']); m['carb'] = max(m['carb'], la['carb'])
                if m['inoc'] is None:
                    m['inoc'] = la['fesi'] / max(0.5, la['tapped'])
                if m['metal'] >= m['need'] - 1e-6:
                    m['metal'] = m['need']
                    self.event('full', m['x'], m['y'])
                if la['metal'] <= 1e-3:
                    la.update(metal=0.0, fesi=0, tapped=0.0, temp=0.0)
            elif k == 'grille' and m and m['cool'] >= 12 and m['metal'] >= m['need']:
                m['shake'] += dt
                if m['shake'] >= 2:
                    self.shake_out(m, s)
        # moules en cours de coulée ou en refroidissement
        for m in self.moulds:
            if m['metal'] > 0 and m['metal'] < m['need']:
                m['gap'] += dt
                if m['gap'] > 2.5:
                    m['broke'] = True
            if m['metal'] >= m['need'] > 0:
                m['cool'] += dt
        if self.time >= ROUND:
            self.phase = 'over'
            self.success = self.score >= GOAL
            self.finished = sorted(range(len(self.p)), key=lambda i: self.p[i]['bot'])
            self.event('end', 0, 0, score=self.score, ok=self.success)

    def shake_out(self, m, s):
        defects = []
        if m['tmin'] < 1280:
            defects.append('malvenue')
        elif m['tmin'] < 1330 or m['broke']:
            defects.append('reprise')
        inoc = m['inoc'] or 0
        if inoc < 0.25:
            defects.append('trempe')
        elif inoc > 0.95:
            defects.append('surinoc')
        if m['slag'] < 0.6:
            defects.append('laitier')
        if m['carb'] > 0.95:
            defects.append('carbone')
        self.moulds.remove(m)
        x, y = st_center(s['tx'], s['ty'])
        self.fid += 1
        self.floor.append({'id': self.fid, 'it': 'piece', 'x': x, 'y': y, 'st': s['id'], 'data': {'type': m['need'], 'defects': defects}})
        self.event('shake', x, y, type=m['need'], defects=defects)

    # ---------------- apprentis robots ----------------
    def go(self, p, tx, ty, dt):
        """Avance vers une case de travail ; renvoie True une fois sur place (et tourné vers le poste)."""
        gx, gy = st_front(tx, ty)
        dx, dy = gx - p['x'], gy - p['y']
        d = math.hypot(dx, dy)
        cx, cy = st_center(tx, ty)
        if d < 14:
            p['a'] = math.atan2(cy - p['y'], cx - p['x'])
            return True
        sp = min(d, 250 * dt)
        nx, ny = p['x'] + dx / d * sp, p['y'] + dy / d * sp
        if self.blocked(nx, ny):           # contourne par le côté
            nx, ny = p['x'] - dy / d * sp, p['y'] + dx / d * sp
            if self.blocked(nx, ny):
                nx, ny = p['x'] + dy / d * sp, p['y'] - dx / d * sp
        if not self.blocked(nx, ny):
            p['x'], p['y'] = nx, ny
        p['a'] = math.atan2(dy, dx)
        return False

    def st_of(self, k, pick=0):
        return [s for s in self.st if s['k'] == k][pick]

    def bot(self, i, dt):
        p = self.p[i]
        p['work'] = False
        p['act'] = max(0.0, p['act'] - dt)
        if p['act'] > 0:
            return
        cu, la = self.cupola, self.ladle
        role = p['role'] or 'fondeur'
        def act_at(st, use=False, work=False):
            if self.go(p, st['tx'], st['ty'], dt):
                if use:
                    self.interact(i)
                    p['act'] = 0.35
                p['work'] = work
                return True
            return False
        if role == 'fondeur':
            carry = p['carry']
            if carry:
                target = 'cubilot' if carry['it'] in ('coke', 'fonte', 'castine') else 'bec'
                act_at(self.st_of(target), use=True)
                return
            if not cu['blow']:
                act_at(self.st_of('soufflerie'), use=True)
                return
            if la['loc'] == 'bec' and la['tapped'] > 0 and la['fesi'] < la['tapped'] * 0.5 - 0.2:
                act_at(self.st_of('fesi'), use=True)
                return
            if la['loc'] == 'bec' and cu['metal'] > 0.4 and la['metal'] < 3.6:
                act_at(self.st_of('bec'), work=True)
                return
            if cu['coke'] + cu['fonte'] + cu['castine'] < 9:
                # dosage : 1 coke pour 2 gueuses, 1 castine pour 4
                if cu['fonte'] < 4:
                    need = 'fonte'
                elif cu['coke'] * 2 < cu['fonte']:
                    need = 'coke'
                elif cu['castine'] * 4 < cu['fonte']:
                    need = 'castine'
                else:
                    need = 'fonte'
                act_at(self.st_of(need), use=True)
                return
            # attend près du cubilot
            self.go(p, 13, 2, dt)
        else:   # mouleur : sable et serrage
            carry = p['carry']
            benches = [s for s in self.st if s['k'] == 'etabli']
            for b in benches:
                m = self.mould_at(b['id'])
                if not m or m['closed']:
                    continue
                if carry and carry['it'] == 'sable' and m['sand'] < 2:
                    act_at(b, use=True); return
                if not carry and m['sand'] < 2:
                    act_at(self.st_of('sable'), use=True); return
                if not carry and m['sand'] >= 2 and m['ram'] < 1:
                    act_at(b, work=True); return
            if carry:
                act_at(self.st_of('sable'), use=True)   # remet le sable en trop
                return
            self.go(p, 4, 4, dt)

    # ---------------- état envoyé ----------------
    def completed(self, seat):
        return True

    def init_payload(self):
        return {'grid': {'cols': COLS, 'rows': ROWS, 'tile': T}, 'stations': self.st, 'parts': PARTS, 'items': ITEMS,
                'defects': {k: list(v) for k, v in DEFECTS.items()}, 'round': ROUND, 'goal': GOAL, 'pr': PR, 'speed': SPEED,
                'reach': REACH, 'hook': HOOK_REACH}

    def view(self):
        c, la, cu = self.crane, self.ladle, self.cupola
        return {
            'phase': self.phase, 'countdown': round(max(0.0, self.pt), 1), 'time': round(self.time, 1), 'score': self.score, 'done': self.done,
            'p': [{'n': p['name'], 'm': p['m'], 'b': p['bot'], 'x': round(p['x'], 1), 'y': round(p['y'], 1), 'a': round(p['a'], 2),
                   'c': p['carry'], 'op': p['op'], 'w': p['work'] or p['act'] > 0, 'tp': p['tp']} for p in self.p],
            'crane': {'x': round(c['x']), 'y': round(c['y']), 'o': c['obj']},
            'moulds': [{'id': m['id'], 'loc': m['loc'], 'x': round(m['x']), 'y': round(m['y']), 'sand': m['sand'], 'ram': round(m['ram'], 2),
                        'cores': m['cores'], 'closed': m['closed'], 'need': m['need'], 'metal': round(m['metal'], 2),
                        'cool': round(m['cool'], 1), 'shake': round(m['shake'], 2)} for m in self.moulds],
            'ladle': {'loc': la['loc'], 'metal': round(la['metal'], 2), 'temp': round(la['temp']), 'fesi': la['fesi'], 'tapped': round(la['tapped'], 2)},
            'cupola': {'coke': cu['coke'], 'fonte': cu['fonte'], 'castine': cu['castine'], 'blow': cu['blow'], 'metal': round(cu['metal'], 2),
                       'temp': round(cu['temp'])},
            'floor': [[f['id'], f['it'], round(f['x']), round(f['y'])] for f in self.floor],
            'orders': [{'id': o['id'], 'type': o['type'], 'left': round(o['left']), 'lim': o['lim']} for o in self.orders],
            'ev': self.events[-12:],
            'finished': self.finished,
        }
