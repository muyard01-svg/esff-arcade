"""Escadrille 101 : combat d'avions en ligne vu du dessus, chacun pour soi (4 à 8 avions).

Le serveur simule tout à 30 images/s ; les navigateurs envoient leurs touches."""
from __future__ import annotations
import math
import random

FPS = 30
W, H = 2400, 1600
MATCH = 180            # secondes
KILLS_TO_WIN = 15
COUNTDOWN = 3
TURN = 2.6             # rad/s
SPEEDS = (170, 240, 330)
BULLET_V = 700
BULLET_LIFE = int(1.0 * FPS)
BULLET_DMG = 8
HIT_R = 24
FIRE_CD = 4
RESPAWN = 3 * FPS
SHIELD = 2 * FPS

L, R, U, D, F = 1, 2, 4, 8, 16
COLORS = ['#EC641E', '#BA2C3A', '#8A8D91', '#F2F4F7', '#F5B700', '#5AA8FF', '#7FD48A', '#C77DFF']


def wrap_delta(ax, ay, bx, by):
    dx = (bx - ax + W / 2) % W - W / 2
    dy = (by - ay + H / 2) % H - H / 2
    return dx, dy


def angle_diff(a, b):
    return math.atan2(math.sin(b - a), math.cos(b - a))


class Plane:
    def __init__(self, name, bot, color):
        self.name, self.bot, self.color = name, bot, color
        self.kills = self.deaths = 0
        self.skill = random.uniform(0.6, 1.0)
        self.noise = 0.0
        self.evade = 0
        self.spawn()

    def spawn(self):
        self.x, self.y = random.uniform(0, W), random.uniform(0, H)
        self.a = random.uniform(-math.pi, math.pi)
        self.v = SPEEDS[1]
        self.hp = 100
        self.alive = True
        self.respawn = 0
        self.shield = SHIELD
        self.cd = 0
        self.firing = False


class Dogfight:
    kind = 'planes'
    max_seats = 8
    min_seats = 4
    stream = True

    def __init__(self, seats):
        self.p = [Plane(s['name'], s['bot'], COLORS[i % len(COLORS)]) for i, s in enumerate(seats)]
        self.inputs = [0] * len(self.p)
        self.bullets: list[list] = []   # x, y, vx, vy, owner, life
        self.feed: list[dict] = []
        self.eid = 0
        self.phase, self.pt = 'count', COUNTDOWN * FPS
        self.time = MATCH * FPS
        self.acc = 0.0
        self.finished: list[int] | None = None
        self.dirty = True
        self.ai_tick = 0

    def handle(self, seat, data):
        if data.get('a') != 'input' or seat >= len(self.p):
            return
        try:
            self.inputs[seat] = int(data.get('k', 0)) & 31
        except (TypeError, ValueError):
            pass

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
        if self.phase == 'over':
            return
        if self.phase == 'count':
            self.pt -= 1
            if self.pt <= 0:
                self.phase = 'play'
            return
        self.time -= 1
        self.ai_tick += 1
        for i, p in enumerate(self.p):
            if p.bot or not connected(i):
                self.ai(i)
        for i, p in enumerate(self.p):
            if not p.alive:
                p.respawn -= 1
                if p.respawn <= 0:
                    p.spawn()
                continue
            m = self.inputs[i]
            p.a += ((1 if m & R else 0) - (1 if m & L else 0)) * TURN / FPS
            target = SPEEDS[2] if m & U else SPEEDS[0] if m & D else SPEEDS[1]
            p.v += max(-8, min(8, target - p.v))
            p.x = (p.x + math.cos(p.a) * p.v / FPS) % W
            p.y = (p.y + math.sin(p.a) * p.v / FPS) % H
            p.shield = max(0, p.shield - 1)
            p.cd -= 1
            p.firing = bool(m & F)
            if p.firing and p.cd <= 0:
                p.cd = FIRE_CD
                nx, ny = p.x + math.cos(p.a) * 26, p.y + math.sin(p.a) * 26
                spread = random.uniform(-0.03, 0.03)
                bv = BULLET_V + p.v
                self.bullets.append([nx, ny, math.cos(p.a + spread) * bv / FPS, math.sin(p.a + spread) * bv / FPS, i, BULLET_LIFE])
        keep = []
        for b in self.bullets:
            b[0] = (b[0] + b[2]) % W
            b[1] = (b[1] + b[3]) % H
            b[5] -= 1
            if b[5] <= 0:
                continue
            hit = False
            for j, p in enumerate(self.p):
                if j == b[4] or not p.alive or p.shield:
                    continue
                dx, dy = wrap_delta(b[0], b[1], p.x, p.y)
                if dx * dx + dy * dy < HIT_R * HIT_R:
                    hit = True
                    p.hp -= BULLET_DMG
                    if p.hp <= 0:
                        self.kill(b[4], j)
                    break
            if not hit:
                keep.append(b)
        self.bullets = keep
        if self.time <= 0 or max(p.kills for p in self.p) >= KILLS_TO_WIN:
            self.phase = 'over'
            self.finished = sorted(range(len(self.p)), key=lambda i: (-self.p[i].kills, self.p[i].deaths))

    def kill(self, killer, victim):
        v, k = self.p[victim], self.p[killer]
        v.alive, v.hp, v.respawn = False, 0, RESPAWN
        v.deaths += 1
        k.kills += 1
        self.eid += 1
        self.feed.append({'id': self.eid, 'k': k.name, 'v': v.name, 'x': round(v.x), 'y': round(v.y)})
        self.feed = self.feed[-6:]

    def ai(self, i):
        p = self.p[i]
        if not p.alive:
            self.inputs[i] = 0
            return
        if self.ai_tick % FPS == i % FPS:
            p.noise = random.uniform(-0.18, 0.18) * (1.2 - p.skill)
        best, bd, bdx, bdy = None, 1e18, 0, 0
        for j, o in enumerate(self.p):
            if j == i or not o.alive:
                continue
            dx, dy = wrap_delta(p.x, p.y, o.x, o.y)
            d = dx * dx + dy * dy
            if d < bd:
                best, bd, bdx, bdy = o, d, dx, dy
        if best is None:
            self.inputs[i] = 0
            return
        dist = math.sqrt(bd)
        t = dist / BULLET_V
        lx = bdx + math.cos(best.a) * best.v * t
        ly = bdy + math.sin(best.a) * best.v * t
        want = math.atan2(ly, lx) + p.noise
        if p.hp < 35 and p.evade <= 0 and random.random() < 0.02:
            p.evade = int(1.2 * FPS)
        if p.evade > 0:
            p.evade -= 1
            want += math.pi * 0.7
        diff = angle_diff(p.a, want)
        m = R if diff > 0.05 else L if diff < -0.05 else 0
        m |= U if dist > 500 else D if dist < 170 else 0
        if abs(diff) < 0.22 and dist < 560 and random.random() < p.skill and p.evade <= 0:
            m |= F
        self.inputs[i] = m

    def completed(self, seat):
        return True

    def view(self):
        return {
            'phase': self.phase,
            'countdown': round(self.pt / FPS, 2) if self.phase == 'count' else 0,
            'time': math.ceil(max(0, self.time) / FPS),
            'p': [{'x': round(p.x, 1), 'y': round(p.y, 1), 'a': round(p.a, 3), 'hp': p.hp, 'al': p.alive,
                   'sh': p.shield > 0, 'k': p.kills, 'd': p.deaths, 'n': p.name, 'c': p.color, 'b': p.bot,
                   'f': p.firing and p.alive, 'v': round(p.v), 'rs': math.ceil(p.respawn / FPS) if not p.alive else 0}
                  for p in self.p],
            'b': [[round(b[0]), round(b[1]), round(b[2], 1), round(b[3], 1)] for b in self.bullets],
            'feed': self.feed,
            'finished': self.finished,
            'world': [W, H],
            'killsToWin': KILLS_TO_WIN,
        }
