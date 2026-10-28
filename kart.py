"""Grand Prix de la Coulée : course de karts façon « party kart », 2 à 8 pilotes de la métallurgie (serveur, 30 images/s).

Chaque navigateur pilote son propre kart (accélération, dérapage avec mini-turbo, hors-piste qui freine) et
envoie sa position ; le serveur vérifie qu'elle est plausible, fait rouler les robots, gère les caisses à outils,
les objets (lingots, flaques d'huile de trempe, boulets de fonte, poches guidées, bouteilles d'oxygène, tablier
aluminisé, coupure de courant), les collisions, le classement et les arrivées."""
from __future__ import annotations
import math
import random
import time

FPS = 30
LAPS = 3
COUNTDOWN = 4.0
AFTER_FIRST = 25.0       # secondes laissées aux autres après le premier arrivé
RACE_LIMIT = 300.0
TRACK_W = 260            # largeur de la piste
KART_R = 26              # rayon d'un kart pour les collisions

# pilotage (identique dans public/kart.js)
PHYS = {'vmax': 560, 'acc': 420, 'brake': 900, 'drag': 0.35, 'offroad': 0.45, 'steer': 2.3, 'boost': 820, 'star': 680, 'slow': 0.6}

DRIVERS = {   # les pilotes : persos de la métallurgie (mêmes que les jeux de combat)
    'fondeur':       {'name': 'Marius', 'color': '#EC641E', 'speed': 1.0,  'grip': 1.0},
    'forgeronne':    {'name': 'Brigitte', 'color': '#BA2C3A', 'speed': 1.03, 'grip': 0.92},
    'mouleur':       {'name': 'Sacha', 'color': '#8A8D91', 'speed': 0.99, 'grip': 1.05},
    'ebarbeuse':     {'name': 'Nina', 'color': '#3A3D42', 'speed': 0.97, 'grip': 1.12},
    'lamineur':      {'name': 'Yanis', 'color': '#5AA8FF', 'speed': 1.04, 'grip': 0.9},
    'chaudronniere': {'name': 'Léa', 'color': '#7FD48A', 'speed': 0.98, 'grip': 1.08},
}

ITEMS = {   # objets de la métallurgie
    'lingot':    'Lingot d\'acier',          # posé derrière soi : fait déraper
    'huile':     'Flaque d\'huile de trempe',  # grande flaque derrière soi
    'boulet':    'Boulet de fonte',          # tiré droit devant
    'poche':     'Poche de fonte guidée',    # file vers le kart devant
    'oxygene':   'Bouteille d\'oxygène',      # turbo
    'tablier':   'Tablier aluminisé',        # invincible et plus rapide
    'coupure':   'Coupure de courant',       # ralentit tous les autres
}
# chances selon la place (en tête : surtout défense ; derrière : objets puissants)
ITEM_ODDS = {
    'front': [('lingot', 35), ('huile', 20), ('boulet', 30), ('oxygene', 15)],
    'mid':   [('lingot', 15), ('boulet', 25), ('poche', 25), ('oxygene', 25), ('huile', 10)],
    'back':  [('poche', 30), ('oxygene', 30), ('tablier', 25), ('coupure', 10), ('boulet', 5)],
}


def catmull(points, per_seg=20):
    out = []
    n = len(points)
    for i in range(n):
        p0, p1, p2, p3 = points[i - 1], points[i], points[(i + 1) % n], points[(i + 2) % n]
        for k in range(per_seg):
            t = k / per_seg
            t2, t3 = t * t, t * t * t
            out.append(tuple(round(0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2
                                           + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3), 1) for d in (0, 1)))
    return out


class Track:
    def __init__(self, key, title, control, theme):
        self.key, self.title, self.theme = key, title, theme
        self.path = catmull(control)
        n = len(self.path)
        self.seg = [math.dist(self.path[i], self.path[(i + 1) % n]) for i in range(n)]
        self.cum = [0.0]
        for L in self.seg[:-1]:
            self.cum.append(self.cum[-1] + L)
        self.length = sum(self.seg)
        xs, ys = [p[0] for p in self.path], [p[1] for p in self.path]
        self.bounds = (min(xs) - 600, min(ys) - 600, max(xs) + 600, max(ys) + 600)

    def point_at(self, s):
        s %= self.length
        lo, hi = 0, len(self.cum) - 1
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if self.cum[mid] <= s:
                lo = mid
            else:
                hi = mid - 1
        i = lo
        a, b = self.path[i], self.path[(i + 1) % len(self.path)]
        t = (s - self.cum[i]) / self.seg[i] if self.seg[i] else 0
        return a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, math.atan2(b[1] - a[1], b[0] - a[0])

    def locate(self, x, y, hint=None):
        """Projection sur la ligne médiane : (s, distance latérale signée, index)."""
        n = len(self.path)
        idxs = range(n) if hint is None else [(hint + d) % n for d in range(-12, 13)]
        best = (1e18, 0, 0.0, 0.0)
        for i in idxs:
            a, b = self.path[i], self.path[(i + 1) % n]
            dx, dy = b[0] - a[0], b[1] - a[1]
            L2 = dx * dx + dy * dy or 1
            t = max(0.0, min(1.0, ((x - a[0]) * dx + (y - a[1]) * dy) / L2))
            px, py = a[0] + dx * t, a[1] + dy * t
            d2 = (x - px) ** 2 + (y - py) ** 2
            if d2 < best[0]:
                side = 1 if dx * (y - a[1]) - dy * (x - a[0]) > 0 else -1
                best = (d2, i, self.cum[i] + self.seg[i] * t, side * math.sqrt(d2))
        return best[2], best[3], best[1]


TRACKS = {t.key: t for t in (
    Track('coulee', 'Circuit de la Coulée',
          [(x * 2.5, y * 2.5) for x, y in [(1000, 200), (1600, 260), (1900, 520), (1820, 900), (1480, 1040), (1150, 900),
                                           (880, 1060), (940, 1300), (560, 1380), (240, 1180), (220, 700), (400, 300)]], 'fonderie'),
    Track('laminoir', 'Boucle du Laminoir',
          [(x * 0.78, y * 0.78) for x, y in [(2500, 600), (4800, 700), (5400, 1300), (5000, 1900), (3500, 1800), (3000, 2400), (3600, 3000), (5200, 3100),
                                             (5500, 3700), (4600, 4200), (2200, 4100), (900, 3700), (600, 2800), (1400, 2200), (900, 1600), (500, 800)]], 'acierie'),
)}


def pick_item(rnd, place, n):
    band = 'front' if place == 0 else 'back' if place >= max(2, n * 0.6) else 'mid'
    table = ITEM_ODDS[band]
    r = rnd.uniform(0, sum(w for _, w in table))
    for k, w in table:
        r -= w
        if r <= 0:
            return k
    return table[0][0]


class Kart:
    kind = 'course'
    max_seats = 8
    min_seats = 6
    stream = True
    send_every = 2

    def __init__(self, seats):
        self.rnd = random.Random()
        want = next(((s.get('opt') or {}).get('map') for s in seats if not s['bot'] and (s.get('opt') or {}).get('map') in TRACKS), None)
        self.tr = TRACKS.get(want) or self.rnd.choice(list(TRACKS.values()))
        tr = self.tr
        chars = list(DRIVERS)
        taken = []
        self.k = []
        for i, s in enumerate(seats):
            ch = (s.get('opt') or {}).get('char')
            if ch not in DRIVERS or s['bot']:
                free = [c for c in chars if c not in taken] or chars
                ch = ch if ch in DRIVERS and not s['bot'] else self.rnd.choice(free)
            taken.append(ch)
            s0 = tr.length - 90 - (i // 2) * 80
            x, y, a = tr.point_at(s0)
            side = -1 if i % 2 == 0 else 1
            lat = side * 55
            x += math.cos(a + math.pi / 2) * lat
            y += math.sin(a + math.pi / 2) * lat
            D = DRIVERS[ch]
            self.k.append({'name': s['name'], 'bot': s['bot'], 'ch': ch, 'x': x, 'y': y, 'a': a, 'v': 0.0,
                           'lap': 0, 's': s0 - tr.length, 'fin': None, 'item': None, 'star': 0.0, 'spin': 0.0, 'boost': 0.0, 'slow': 0.0,
                           'hint': None, 'seen': 0.0, 'tp': 1,
                           'ai': {'lane': lat, 'skill': self.rnd.uniform(0.9, 1.0) * D['speed'], 'use': 0.0, 'aim': self.rnd.uniform(-70, 70)}})
        # caisses à outils : trois rangées de quatre en travers de la piste
        self.boxes = []
        for frac in (0.17, 0.48, 0.76):
            x, y, a = tr.point_at(tr.length * frac)
            for lat in (-90, -30, 30, 90):
                self.boxes.append({'x': x + math.cos(a + math.pi / 2) * lat, 'y': y + math.sin(a + math.pi / 2) * lat, 'back': 0.0})
        self.objs = []        # objets sur la piste (pièges et projectiles)
        self.oid = 0
        self.events, self.eid = [], 0
        self.phase = 'count'
        self.t0 = time.monotonic()
        self.start = self.t0 + COUNTDOWN
        self.first_finish = None
        self.finished = None
        self.acc = 0.0
        self.frame = 0
        self.dirty = True

    def event(self, kind, x=0, y=0, **kw):
        self.eid += 1
        self.events.append({'id': self.eid, 'k': kind, 'x': round(x), 'y': round(y), **kw})
        self.events = self.events[-30:]

    def init_payload(self):
        tr = self.tr
        return {'track': {'key': tr.key, 'title': tr.title, 'theme': tr.theme, 'path': tr.path, 'width': TRACK_W, 'length': tr.length},
                'laps': LAPS, 'phys': PHYS, 'kartR': KART_R, 'items': ITEMS,
                'drivers': DRIVERS, 'boxes': [[round(b['x']), round(b['y'])] for b in self.boxes]}

    # ---------------- entrées ----------------
    def handle(self, seat, data):
        if seat >= len(self.k):
            return
        k = self.k[seat]
        if k['bot'] or k['fin'] is not None or self.phase != 'race':
            return
        a = data.get('a')
        if a == 'use':
            self.use_item(seat)
            return
        if a != 'pos':
            return
        try:
            x, y, ang, v = float(data['x']), float(data['y']), float(data['ang']), float(data['v'])
            lap = int(data['lap'])
        except (KeyError, TypeError, ValueError):
            return
        if not all(math.isfinite(q) for q in (x, y, ang, v)):
            return
        now = time.monotonic()
        el = min(0.6, max(0.0, now - k['seen'])) if k['seen'] else 0.1
        k['seen'] = now
        if math.hypot(x - k['x'], y - k['y']) > PHYS['boost'] * 1.3 * el + 80:
            k['tp'] += 1     # trop loin d'un coup : le navigateur est recalé
            return
        s, lat, k['hint'] = self.tr.locate(x, y, k['hint'])
        k['x'], k['y'], k['a'], k['v'] = x, y, ang, max(-200.0, min(PHYS['boost'] * 1.1, v))
        # tours : on accepte le tour annoncé s'il colle à la position sur la piste
        prog = k['lap'] * self.tr.length + (k['s'] % self.tr.length if k['s'] >= 0 else k['s'])
        new = lap * self.tr.length + s
        if abs(new - prog) < self.tr.length * 0.4 and lap <= LAPS:
            k['lap'], k['s'] = lap, s
        if k['lap'] >= LAPS and k['fin'] is None:
            self.finish_kart(seat)

    def finish_kart(self, i):
        k = self.k[i]
        k['fin'] = round(time.monotonic() - self.start, 2)
        if self.first_finish is None:
            self.first_finish = time.monotonic()
        self.event('finish', k['x'], k['y'], seat=i, place=sum(1 for q in self.k if q['fin'] is not None))

    # ---------------- objets ----------------
    def ranking(self):
        return sorted(range(len(self.k)), key=lambda i: (self.k[i]['fin'] if self.k[i]['fin'] is not None else 1e9,
                                                         -(self.k[i]['lap'] * self.tr.length + self.k[i]['s'])))

    def use_item(self, i):
        k = self.k[i]
        it = k['item']
        if not it or k['spin'] > 0:
            return
        k['item'] = None
        ca, sa = math.cos(k['a']), math.sin(k['a'])
        self.oid += 1
        if it in ('lingot', 'huile'):
            self.objs.append({'id': self.oid, 'k': it, 'x': k['x'] - ca * 55, 'y': k['y'] - sa * 55, 'r': 22 if it == 'lingot' else 46,
                              'owner': i, 'life': 25.0 if it == 'lingot' else 14.0, 'safe': 0.6})
        elif it == 'boulet':
            sp = 1050 + max(0.0, k['v'])
            self.objs.append({'id': self.oid, 'k': it, 'x': k['x'] + ca * 50, 'y': k['y'] + sa * 50, 'vx': ca * sp, 'vy': sa * sp,
                              'r': 16, 'owner': i, 'life': 3.0, 'safe': 0.0})
        elif it == 'poche':
            rank = self.ranking()
            pos = rank.index(i)
            target = rank[pos - 1] if pos > 0 else None
            s, _, _ = self.tr.locate(k['x'], k['y'], k['hint'])
            self.objs.append({'id': self.oid, 'k': it, 'x': k['x'] + ca * 50, 'y': k['y'] + sa * 50, 's': s + 50, 'r': 18,
                              'owner': i, 'target': target, 'life': 7.0, 'safe': 0.0})
        elif it == 'oxygene':
            k['boost'] = 1.4
        elif it == 'tablier':
            k['star'] = 6.0
        elif it == 'coupure':
            for j, o in enumerate(self.k):
                if j != i and o['fin'] is None and o['star'] <= 0:
                    o['slow'] = 3.0
        self.event('use', k['x'], k['y'], seat=i, it=it)

    def hit(self, j, by, why):
        o = self.k[j]
        if o['star'] > 0 or o['spin'] > 0 or o['fin'] is not None:
            return False
        o['spin'] = 1.1
        o['v'] *= 0.2
        self.event('spin', o['x'], o['y'], seat=j, by=by, why=why)
        return True

    def update_objs(self, dt):
        tr = self.tr
        keep = []
        for ob in self.objs:
            ob['life'] -= dt
            ob['safe'] = max(0.0, ob['safe'] - dt)
            if ob['life'] <= 0:
                continue
            if ob['k'] == 'boulet':
                ob['x'] += ob['vx'] * dt
                ob['y'] += ob['vy'] * dt
                _, lat, _ = tr.locate(ob['x'], ob['y'])
                if abs(lat) > TRACK_W / 2 + 120:
                    self.event('pop', ob['x'], ob['y'], it='boulet')
                    continue
            elif ob['k'] == 'poche':
                tgt = self.k[ob['target']] if ob['target'] is not None else None
                if tgt is not None and math.hypot(tgt['x'] - ob['x'], tgt['y'] - ob['y']) < 320:
                    d = math.hypot(tgt['x'] - ob['x'], tgt['y'] - ob['y']) or 1
                    ob['x'] += (tgt['x'] - ob['x']) / d * 1150 * dt
                    ob['y'] += (tgt['y'] - ob['y']) / d * 1150 * dt
                else:          # suit la piste
                    ob['s'] += 1150 * dt
                    ob['x'], ob['y'], _ = tr.point_at(ob['s'])
            hit = False
            for j, o in enumerate(self.k):
                if (j == ob['owner'] and ob['safe'] > 0) or o['fin'] is not None:
                    continue
                if (o['x'] - ob['x']) ** 2 + (o['y'] - ob['y']) ** 2 < (KART_R + ob['r']) ** 2:
                    if self.hit(j, ob['owner'], ob['k']) or o['star'] > 0:
                        hit = True
                        break
            if hit:
                self.event('pop', ob['x'], ob['y'], it=ob['k'])
                continue
            keep.append(ob)
        self.objs = keep

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
        now = time.monotonic()
        if self.phase == 'count':
            if now >= self.start:
                self.phase = 'race'
                for k in self.k:
                    k['seen'] = now
            return
        if self.phase != 'race':
            return
        tr = self.tr
        rank = self.ranking()
        for i, k in enumerate(self.k):
            for key in ('star', 'spin', 'boost', 'slow'):
                k[key] = max(0.0, k[key] - dt)
            if k['fin'] is not None:
                continue
            if k['bot'] or not connected(i):
                self.drive_bot(i, rank, dt)
            # caisses à outils
            if k['item'] is None:
                for b in self.boxes:
                    if b['back'] <= 0 and (b['x'] - k['x']) ** 2 + (b['y'] - k['y']) ** 2 < (KART_R + 30) ** 2:
                        b['back'] = 2.5
                        k['item'] = pick_item(self.rnd, rank.index(i), len(self.k))
                        self.event('box', b['x'], b['y'], seat=i, it=k['item'])
                        if k['bot']:
                            k['ai']['use'] = self.rnd.uniform(0.6, 3.0)
                        break
            # tablier : on bouscule ceux qu'on touche
            if k['star'] > 0:
                for j, o in enumerate(self.k):
                    if j != i and (o['x'] - k['x']) ** 2 + (o['y'] - k['y']) ** 2 < (KART_R * 2) ** 2:
                        self.hit(j, i, 'tablier')
        for b in self.boxes:
            b['back'] = max(0.0, b['back'] - dt)
        self.update_objs(dt)
        humans = [i for i, k in enumerate(self.k) if not k['bot'] and connected(i)]
        done = humans and all(self.k[i]['fin'] is not None for i in humans)
        late = self.first_finish is not None and now - self.first_finish > AFTER_FIRST
        if done or late or not humans or now - self.start > RACE_LIMIT:
            self.phase = 'over'
            self.finished = self.ranking()

    def drive_bot(self, i, rank, dt):
        """Robot : suit sa trajectoire, accélère selon son niveau (avec un peu d'élastique) et utilise ses objets."""
        k, tr, ai = self.k[i], self.tr, self.k[i]['ai']
        place = rank.index(i)
        lead = self.k[rank[0]]
        gap = (lead['lap'] * tr.length + lead['s']) - (k['lap'] * tr.length + k['s'])
        rubber = 1.0 + max(-0.06, min(0.08, gap / 6000))
        vmax = PHYS['vmax'] * ai['skill'] * rubber
        if k['boost'] > 0:
            vmax = PHYS['boost']
        if k['star'] > 0:
            vmax = max(vmax, PHYS['star'])
        if k['slow'] > 0:
            vmax *= PHYS['slow']
        if k['spin'] > 0:
            k['v'] = max(0.0, k['v'] - 900 * dt)
        else:
            k['v'] += (vmax - k['v']) * min(1.0, 1.2 * dt)
        # virage : on lève le pied dans les courbes serrées
        _, _, a1 = tr.point_at(k['s'] + 60)
        _, _, a2 = tr.point_at(k['s'] + 260)
        bend = abs(math.atan2(math.sin(a2 - a1), math.cos(a2 - a1)))
        k['v'] = min(k['v'], vmax * (1 - min(0.35, bend * 0.45)))
        k['s'] += k['v'] * dt
        while k['s'] >= tr.length:
            k['s'] -= tr.length
            k['lap'] += 1
        ai['lane'] += (ai['aim'] - ai['lane']) * min(1.0, 0.8 * dt)
        if self.rnd.random() < 0.01:
            ai['aim'] = self.rnd.uniform(-80, 80)
        x, y, a = tr.point_at(k['s'])
        k['x'], k['y'] = x + math.cos(a + math.pi / 2) * ai['lane'], y + math.sin(a + math.pi / 2) * ai['lane']
        k['a'] = a + (math.sin(self.frame / 4) * 1.2 if k['spin'] > 0 else 0)
        if k['lap'] >= LAPS and k['fin'] is None:
            self.finish_kart(i)
            return
        # objets
        if k['item']:
            ai['use'] -= dt
            behind = place < len(rank) - 1
            if ai['use'] <= 0 and (k['item'] not in ('lingot', 'huile') or behind):
                if k['item'] == 'boulet' and place > 0:
                    ahead = self.k[rank[place - 1]]
                    ai['aim'] = max(-90, min(90, tr.locate(ahead['x'], ahead['y'])[1]))
                self.use_item(i)

    def completed(self, seat):
        return self.k[seat]['fin'] is not None

    def view(self):
        now = time.monotonic()
        rank = self.ranking()
        return {
            'phase': self.phase,
            'countdown': max(0.0, round(self.start - now, 2)),
            'elapsed': max(0.0, round(now - self.start, 2)),
            'k': [{'n': k['name'], 'b': k['bot'], 'ch': k['ch'], 'x': round(k['x'], 1), 'y': round(k['y'], 1), 'a': round(k['a'], 3),
                   'v': round(k['v']), 'lap': k['lap'], 'fin': k['fin'], 'it': k['item'], 'st': round(k['star'], 1), 'sp': round(k['spin'], 2),
                   'bo': round(k['boost'], 2), 'sl': round(k['slow'], 1), 'rk': rank.index(i) + 1, 'tp': k['tp']} for i, k in enumerate(self.k)],
            'o': [[ob['id'], ob['k'], round(ob['x']), round(ob['y'])] for ob in self.objs],
            'bx': ''.join('1' if b['back'] <= 0 else '0' for b in self.boxes),
            'ev': self.events[-12:],
            'finished': self.finished,
        }
