"""Grand Prix de la Coulée : course de voitures en ligne vue du dessus (2 à 6 pilotes).

Chaque navigateur simule sa propre voiture et envoie sa position ; le serveur relaie,
fait rouler les robots, valide les arrivées et établit le classement."""
from __future__ import annotations
import math
import random
import time

LAPS = 3
COUNTDOWN = 4.0
MAX_SPEED = 380          # px/s, doit rester aligné avec online.js
TRACK_WIDTH = 120
AFTER_FIRST = 30.0       # secondes laissées aux autres après le premier arrivé
RACE_LIMIT = 300.0
COLORS = ['#EC641E', '#BA2C3A', '#8A8D91', '#F2F4F7', '#F5B700', '#5AA8FF']

CONTROL = [(400, 300), (1000, 200), (1600, 260), (1900, 520), (1820, 900), (1480, 1040),
           (1150, 900), (880, 1060), (940, 1300), (560, 1380), (240, 1180), (220, 700)]


def catmull(points, per_seg=18):
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


PATH = catmull(CONTROL)
SEG = [math.dist(PATH[i], PATH[(i + 1) % len(PATH)]) for i in range(len(PATH))]
LENGTH = sum(SEG)
MIN_RACE_TIME = LAPS * LENGTH / MAX_SPEED * 0.9


def point_at(s):
    s %= LENGTH
    for i, L in enumerate(SEG):
        if s <= L:
            a, b = PATH[i], PATH[(i + 1) % len(PATH)]
            t = s / L if L else 0
            return a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, math.atan2(b[1] - a[1], b[0] - a[0])
        s -= L
    return PATH[0][0], PATH[0][1], 0.0


def grid_slot(i):
    """Position de départ derrière la ligne, en quinconce."""
    x, y, a = point_at(LENGTH - 60 - (i // 2) * 70)
    side = -1 if i % 2 == 0 else 1
    return x + math.cos(a + math.pi / 2) * side * 28, y + math.sin(a + math.pi / 2) * side * 28, a


class Race:
    kind = 'course'
    max_seats = 6

    def __init__(self, seats):
        self.cars = []
        for i, s in enumerate(seats):
            x, y, a = grid_slot(i)
            self.cars.append({'name': s['name'], 'bot': s['bot'], 'color': COLORS[i % len(COLORS)],
                              'x': x, 'y': y, 'a': a, 'lap': 0, 'prog': 0.0, 'fin': None,
                              's': LENGTH - 60 - (i // 2) * 70, 'v': 0.0, 'vmax': random.uniform(235, 300),
                              'wob': random.uniform(0, 6)})
        self.phase = 'count'
        self.t0 = time.monotonic()
        self.start = self.t0 + COUNTDOWN
        self.first_finish = None
        self.finished: list[int] | None = None
        self.dirty = True

    def init_payload(self):
        return {'path': PATH, 'width': TRACK_WIDTH, 'laps': LAPS, 'maxSpeed': MAX_SPEED}

    def handle(self, seat, data):
        if data.get('a') != 'pos' or self.phase != 'race':
            return
        c = self.cars[seat]
        if c['bot'] or c['fin'] is not None:
            return
        try:
            c['x'], c['y'], c['a'] = float(data['x']), float(data['y']), float(data['ang'])
            lap, prog = int(data['lap']), float(data['prog'])
        except (KeyError, TypeError, ValueError):
            return
        c['lap'] = max(c['lap'], min(lap, LAPS))
        c['prog'] = max(0.0, min(1.0, prog))
        elapsed = time.monotonic() - self.start
        if c['lap'] >= LAPS and elapsed >= MIN_RACE_TIME:
            c['fin'] = round(elapsed, 2)
            if self.first_finish is None:
                self.first_finish = time.monotonic()

    def tick(self, dt, connected):
        now = time.monotonic()
        if self.phase == 'count':
            if now >= self.start:
                self.phase = 'race'
            return
        if self.phase != 'race':
            return
        for c in self.cars:
            if not c['bot'] or c['fin'] is not None:
                continue
            c['v'] = min(c['vmax'], c['v'] + 200 * dt)
            c['s'] += c['v'] * dt
            dist = c['s'] - LENGTH  # la ligne d'arrivée est à s = LENGTH
            x, y, a = point_at(c['s'])
            off = math.sin(now * 0.7 + c['wob']) * 22
            c['x'], c['y'], c['a'] = x + math.cos(a + math.pi / 2) * off, y + math.sin(a + math.pi / 2) * off, a
            c['lap'] = int(dist // LENGTH) if dist >= 0 else 0  # tours bouclés
            c['prog'] = (dist % LENGTH) / LENGTH if dist >= 0 else 0.0
            if c['lap'] >= LAPS:
                c['fin'] = round(now - self.start, 2)
                if self.first_finish is None:
                    self.first_finish = now
        humans = [i for i, c in enumerate(self.cars) if not c['bot'] and connected(i)]
        all_humans_done = humans and all(self.cars[i]['fin'] is not None for i in humans)
        late = self.first_finish is not None and now - self.first_finish > AFTER_FIRST
        if all_humans_done or late or not humans or now - self.start > RACE_LIMIT:
            self.finish()

    def finish(self):
        self.phase = 'over'
        def key(i):
            c = self.cars[i]
            return (0, c['fin']) if c['fin'] is not None else (1, -(c['lap'] + c['prog']))
        self.finished = sorted(range(len(self.cars)), key=key)

    def completed(self, seat):
        return self.cars[seat]['fin'] is not None

    def view(self):
        now = time.monotonic()
        return {
            'phase': self.phase,
            'countdown': max(0.0, round(self.start - now, 2)),
            'elapsed': max(0.0, round(now - self.start, 2)),
            'cars': [{k: c[k] for k in ('name', 'bot', 'color', 'x', 'y', 'a', 'lap', 'prog', 'fin')} for c in self.cars],
            'finished': self.finished,
        }
