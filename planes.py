"""Escadrille 102 : combat aérien en 3D au-dessus de la vallée des fonderies, chacun pour soi (4 à 8 avions).

Pilotage arcade : cap et assiette (on vire en inclinant, on monte et on pique), postcombustion et aérofreins.
Canon, missiles à verrouillage (il faut garder la cible dans le viseur pour l'accrocher) et leurres pour
décrocher un missile. Le serveur simule tout à 30 images/s ; les navigateurs envoient leurs commandes."""
from __future__ import annotations
import math
import random

FPS = 30
DT = 1 / FPS
ARENA = 4200.0           # rayon de la zone de combat (m)
CEIL = 2600.0
FLOOR = 18.0
MATCH = 180              # secondes
KILLS_TO_WIN = 12
COUNTDOWN = 3
TURN = 1.25              # rad/s de virage
PITCH = 1.0              # rad/s à cabrer / piquer
MAX_PITCH = 1.25
SPEED = (150.0, 230.0, 360.0)   # aérofreins, croisière, postcombustion (m/s)
GUN_V = 900.0
GUN_LIFE = int(1.2 * FPS)
GUN_DMG = 5
GUN_R = 20.0
GUN_CD = 3
MSL_SLOTS = 2
MSL_RELOAD = 3.5 * FPS
MSL_V = 560.0
MSL_TURN = 2.4
MSL_LIFE = int(6 * FPS)
MSL_DMG = 65
MSL_PROX = 32.0
LOCK_RANGE = 1900.0
LOCK_CONE = 0.42         # rad autour du nez
LOCK_TIME = 0.6 * FPS
FLARES = 3
FLARE_RELOAD = 12 * FPS
RESPAWN = 3 * FPS
SHIELD = 2 * FPS

L, R, U, D, F, M, B, BR, FL = 1, 2, 4, 8, 16, 32, 64, 128, 256
COLORS = ['#EC641E', '#BA2C3A', '#8A8D91', '#F2F4F7', '#F5B700', '#5AA8FF', '#7FD48A', '#C77DFF']
CALLSIGNS = ['Cubilot', 'Masselotte', 'Noyau', 'Laitier', 'Coquille', 'Lingot', 'Trempe', 'Bavure']


def fwd(h, p):
    return math.cos(p) * math.cos(h), math.sin(p), math.cos(p) * math.sin(h)


def angle_diff(a, b):
    return math.atan2(math.sin(b - a), math.cos(b - a))


class Plane:
    def __init__(self, name, bot, color):
        self.name, self.bot, self.color = name, bot, color
        self.kills = self.deaths = 0
        self.skill = random.uniform(0.55, 1.0)
        self.evade = 0
        self.spawn()

    def spawn(self):
        a = random.uniform(-math.pi, math.pi)
        r = ARENA * random.uniform(0.55, 0.8)
        self.x, self.z = math.cos(a) * r, math.sin(a) * r
        self.y = random.uniform(900, 1500)
        self.h = a + math.pi + random.uniform(-0.4, 0.4)      # cap vers le centre
        self.p = 0.0
        self.roll = 0.0
        self.v = SPEED[1]
        self.hp = 100
        self.alive = True
        self.respawn = 0
        self.shield = SHIELD
        self.cd = 0
        self.firing = False
        self.msl = [0, 0]           # temps de rechargement de chaque rail
        self.flares = FLARES
        self.flare_t = 0
        self.lock, self.lock_t = -1, 0
        self.last_hit, self.last_hit_t = -1, 0


class Dogfight:
    kind = 'planes'
    max_seats = 8
    min_seats = 6
    stream = True

    def __init__(self, seats):
        self.p = []
        for i, s in enumerate(seats):
            name = s['name'] if not s['bot'] else f"{CALLSIGNS[i % len(CALLSIGNS)]}"
            self.p.append(Plane(name, s['bot'], COLORS[i % len(COLORS)]))
        self.inputs = [0] * len(self.p)
        self.prev_in = [0] * len(self.p)
        self.bullets: list[list] = []     # x, y, z, vx, vy, vz, owner, life
        self.missiles: list[dict] = []
        self.mid = 0
        self.events: list[dict] = []
        self.eid = 0
        self.phase, self.pt = 'count', COUNTDOWN * FPS
        self.time = MATCH * FPS
        self.acc = 0.0
        self.frame = 0
        self.finished: list[int] | None = None
        self.dirty = True

    def handle(self, seat, data):
        if data.get('a') != 'input' or seat >= len(self.p):
            return
        try:
            self.inputs[seat] = int(data.get('k', 0)) & 511
        except (TypeError, ValueError):
            pass

    def tick(self, dt, connected):
        self.acc += dt
        steps = 0
        while self.acc >= DT and steps < 4:
            self.acc -= DT
            steps += 1
            self.step(connected)
        if steps == 4:
            self.acc = 0.0

    def event(self, kind, **kw):
        self.eid += 1
        self.events.append({'id': self.eid, 'k': kind, **{k: (round(v, 1) if isinstance(v, float) else v) for k, v in kw.items()}})
        self.events = self.events[-24:]

    # ---------------- simulation ----------------
    def step(self, connected):
        if self.phase == 'over':
            return
        self.frame += 1
        for i, p in enumerate(self.p):
            if p.bot or not connected(i):
                self.ai(i)
        if self.phase == 'count':
            self.pt -= 1
            for p in self.p:          # on vole déjà, en ligne droite
                self.fly(p, 0)
            if self.pt <= 0:
                self.phase = 'play'
            return
        self.time -= 1
        for i, p in enumerate(self.p):
            if not p.alive:
                p.respawn -= 1
                if p.respawn <= 0:
                    p.spawn()
                    self.event('spawn', i=i)
                continue
            m = self.inputs[i]
            press = m & ~self.prev_in[i]
            self.prev_in[i] = m
            self.fly(p, m)
            if not p.alive:
                continue
            p.shield = max(0, p.shield - 1)
            p.last_hit_t = max(0, p.last_hit_t - 1)
            # canon
            p.cd -= 1
            p.firing = bool(m & F)
            if p.firing and p.cd <= 0:
                p.cd = GUN_CD
                fx, fy, fz = fwd(p.h + random.uniform(-0.012, 0.012), p.p + random.uniform(-0.012, 0.012))
                bv = GUN_V + p.v
                self.bullets.append([p.x + fx * 12, p.y + fy * 12, p.z + fz * 12, fx * bv * DT, fy * bv * DT, fz * bv * DT, i, GUN_LIFE])
            # verrouillage et missiles
            self.update_lock(i, p)
            p.msl = [max(0, r - 1) for r in p.msl]
            if press & M:
                rail = next((k for k, r in enumerate(p.msl) if r == 0), None)
                if rail is not None:
                    p.msl[rail] = MSL_RELOAD
                    fx, fy, fz = fwd(p.h, p.p)
                    self.mid += 1
                    tgt = p.lock if p.lock >= 0 and p.lock_t >= LOCK_TIME else -1
                    self.missiles.append({'id': self.mid, 'x': p.x + fx * 10, 'y': p.y - 4, 'z': p.z + fz * 10, 'h': p.h, 'p': p.p,
                                          'v': p.v + 60, 'o': i, 't': tgt, 'life': MSL_LIFE, 'decoy': None})
                    self.event('missile', i=i, t=tgt)
            # leurres
            p.flare_t = max(0, p.flare_t - 1)
            if p.flares < FLARES and p.flare_t == 0:
                p.flares += 1
                p.flare_t = FLARE_RELOAD if p.flares < FLARES else 0
            if press & FL and p.flares > 0:
                p.flares -= 1
                if p.flare_t == 0:
                    p.flare_t = FLARE_RELOAD
                self.event('flare', i=i, x=p.x, y=p.y, z=p.z)
                for ms in self.missiles:
                    if ms['t'] == i and random.random() < 0.75:
                        ms['t'] = -1
                        ms['decoy'] = (p.x, p.y - 30, p.z)
        self.step_bullets()
        self.step_missiles()
        if self.time <= 0 or max(p.kills for p in self.p) >= KILLS_TO_WIN:
            self.phase = 'over'
            self.finished = sorted(range(len(self.p)), key=lambda i: (-self.p[i].kills, self.p[i].deaths))
        self.dirty = True

    def fly(self, p, m):
        if not p.alive:
            return
        turn = (1 if m & R else 0) - (1 if m & L else 0)
        climb = (1 if m & U else 0) - (1 if m & D else 0)
        # zone de combat : au-delà, l'avion est ramené vers le centre
        r = math.hypot(p.x, p.z)
        if r > ARENA:
            want = math.atan2(-p.z, -p.x)
            turn = 1 if angle_diff(p.h, want) > 0 else -1
        if p.y > CEIL:
            climb = -1
        p.h += turn * TURN * DT * (0.75 + 0.25 * SPEED[1] / max(120.0, p.v))
        p.p = max(-MAX_PITCH, min(MAX_PITCH, p.p + climb * PITCH * DT))
        if not climb:
            p.p *= 0.985                         # l'avion se remet doucement à plat
        p.roll += (turn * 1.05 - p.roll) * min(1.0, 5 * DT)
        target = SPEED[2] if m & B else SPEED[0] if m & BR else SPEED[1]
        p.v += max(-90 * DT, min(70 * DT, target - p.v)) - math.sin(p.p) * 55 * DT
        p.v = max(120.0, min(420.0, p.v))
        fx, fy, fz = fwd(p.h, p.p)
        p.x += fx * p.v * DT
        p.y += fy * p.v * DT
        p.z += fz * p.v * DT
        if p.y < FLOOR:
            self.crash(p)

    def update_lock(self, i, p):
        fx, fy, fz = fwd(p.h, p.p)
        best, bscore = -1, 1e9
        for j, o in enumerate(self.p):
            if j == i or not o.alive:
                continue
            dx, dy, dz = o.x - p.x, o.y - p.y, o.z - p.z
            d = math.sqrt(dx * dx + dy * dy + dz * dz) or 1
            if d > LOCK_RANGE:
                continue
            ang = math.acos(max(-1, min(1, (dx * fx + dy * fy + dz * fz) / d)))
            if ang < LOCK_CONE:
                sc = ang * 1000 + d * 0.2
                if sc < bscore:
                    best, bscore = j, sc
        if best != p.lock:
            p.lock, p.lock_t = best, 0
        elif best >= 0:
            p.lock_t = min(LOCK_TIME, p.lock_t + 1)

    def step_bullets(self):
        keep = []
        for b in self.bullets:
            ox, oy, oz = b[0], b[1], b[2]
            b[0] += b[3]; b[1] += b[4]; b[2] += b[5]
            b[7] -= 1
            if b[7] <= 0 or b[1] < 0:
                continue
            hit = False
            sx, sy, sz = b[3], b[4], b[5]
            ll = sx * sx + sy * sy + sz * sz or 1
            for j, p in enumerate(self.p):
                if j == b[6] or not p.alive or p.shield:
                    continue
                # distance du segment parcouru au centre de l'avion
                t = max(0.0, min(1.0, ((p.x - ox) * sx + (p.y - oy) * sy + (p.z - oz) * sz) / ll))
                cx, cy, cz = ox + sx * t - p.x, oy + sy * t - p.y, oz + sz * t - p.z
                if cx * cx + cy * cy + cz * cz < GUN_R * GUN_R:
                    hit = True
                    self.damage(j, GUN_DMG, b[6], 'canon')
                    break
            if not hit:
                keep.append(b)
        self.bullets = keep

    def step_missiles(self):
        keep = []
        for ms in self.missiles:
            ms['life'] -= 1
            ms['v'] = min(MSL_V + 200, ms['v'] + 260 * DT)
            goal = None
            if ms['t'] >= 0 and self.p[ms['t']].alive:
                o = self.p[ms['t']]
                goal = (o.x, o.y, o.z)
            elif ms['decoy']:
                goal = ms['decoy']
            if goal:
                dx, dy, dz = goal[0] - ms['x'], goal[1] - ms['y'], goal[2] - ms['z']
                want_h = math.atan2(dz, dx)
                want_p = math.atan2(dy, math.hypot(dx, dz))
                lim = MSL_TURN * DT
                ms['h'] += max(-lim, min(lim, angle_diff(ms['h'], want_h)))
                ms['p'] += max(-lim, min(lim, want_p - ms['p']))
            fx, fy, fz = fwd(ms['h'], ms['p'])
            ms['x'] += fx * ms['v'] * DT; ms['y'] += fy * ms['v'] * DT; ms['z'] += fz * ms['v'] * DT
            boom = ms['life'] <= 0 or ms['y'] < 5
            if not boom:
                for j, p in enumerate(self.p):
                    if j == ms['o'] or not p.alive:
                        continue
                    if (p.x - ms['x']) ** 2 + (p.y - ms['y']) ** 2 + (p.z - ms['z']) ** 2 < MSL_PROX ** 2:
                        if not p.shield:
                            self.damage(j, MSL_DMG, ms['o'], 'missile')
                        boom = True
                        break
                if ms['decoy'] and (ms['x'] - ms['decoy'][0]) ** 2 + (ms['y'] - ms['decoy'][1]) ** 2 + (ms['z'] - ms['decoy'][2]) ** 2 < 40 ** 2:
                    boom = True
            if boom:
                self.event('boom', x=ms['x'], y=ms['y'], z=ms['z'], m=1)
            else:
                keep.append(ms)
        self.missiles = keep

    def damage(self, j, dmg, src, how):
        p = self.p[j]
        p.hp -= dmg
        p.last_hit, p.last_hit_t = src, 5 * FPS
        self.event('hit', i=j, s=src, how=how, x=p.x, y=p.y, z=p.z)
        if p.hp <= 0:
            self.kill(src, j, how)

    def crash(self, p):
        j = self.p.index(p)
        src = p.last_hit if p.last_hit_t > 0 else -1
        self.kill(src, j, 'sol')

    def kill(self, killer, victim, how):
        v = self.p[victim]
        if not v.alive:
            return
        v.alive, v.hp, v.respawn = False, 0, RESPAWN
        v.deaths += 1
        if killer >= 0 and killer != victim:
            self.p[killer].kills += 1
        for ms in self.missiles:
            if ms['t'] == victim:
                ms['t'] = -1
        self.event('kill', by=killer, vic=victim, how=how, x=v.x, y=v.y, z=v.z)

    # ---------------- robots ----------------
    def ai(self, i):
        p = self.p[i]
        if not p.alive:
            self.inputs[i] = 0
            return
        best, bd = None, 1e18
        for j, o in enumerate(self.p):
            if j == i or not o.alive:
                continue
            d = (o.x - p.x) ** 2 + (o.y - p.y) ** 2 + (o.z - p.z) ** 2
            if d < bd:
                best, bd = o, d
        m = 0
        incoming = any(ms['t'] == i for ms in self.missiles)
        if best is not None:
            dist = math.sqrt(bd)
            lead = dist / (GUN_V + p.v)
            ofx, ofy, ofz = fwd(best.h, best.p)
            tx, ty, tz = best.x + ofx * best.v * lead, best.y + ofy * best.v * lead, best.z + ofz * best.v * lead
            want_h = math.atan2(tz - p.z, tx - p.x)
            want_p = math.atan2(ty - p.y, math.hypot(tx - p.x, tz - p.z))
            if p.evade > 0 or (incoming and random.random() < 0.02):
                p.evade = p.evade - 1 if p.evade > 0 else int(1.5 * FPS)
                want_h += 1.6
                want_p = 0.5 if p.y < 1200 else -0.4
            dh = angle_diff(p.h, want_h)
            dp = want_p - p.p
            m |= R if dh > 0.06 else L if dh < -0.06 else 0
            m |= U if dp > 0.05 else D if dp < -0.05 else 0
            m |= B if dist > 900 else BR if dist < 250 else 0
            if abs(dh) < 0.12 and abs(dp) < 0.12 and dist < 800 and random.random() < p.skill:
                m |= F
            if p.lock >= 0 and p.lock_t >= LOCK_TIME and random.random() < 0.02 * p.skill:
                m |= M
            if incoming and random.random() < 0.04 * p.skill:
                m |= FL
        if p.y < 350 or (p.p < -0.3 and p.y < 700):
            m = (m & ~D) | U
        self.inputs[i] = m

    # ---------------- état envoyé ----------------
    def completed(self, seat):
        return True

    def view(self):
        inc = {ms['t'] for ms in self.missiles if ms['t'] >= 0}
        return {
            'phase': self.phase,
            'countdown': round(self.pt / FPS, 2) if self.phase == 'count' else 0,
            'time': math.ceil(max(0, self.time) / FPS),
            'p': [{'x': round(p.x, 1), 'y': round(p.y, 1), 'z': round(p.z, 1), 'h': round(p.h, 3), 'pi': round(p.p, 3), 'r': round(p.roll, 2),
                   'v': round(p.v), 'hp': p.hp, 'al': p.alive, 'sh': p.shield > 0, 'k': p.kills, 'd': p.deaths, 'n': p.name, 'c': p.color,
                   'b': p.bot, 'f': p.firing and p.alive, 'ms': sum(1 for r in p.msl if r == 0), 'mr': [round(1 - r / MSL_RELOAD, 2) for r in p.msl],
                   'fl': p.flares, 'lk': p.lock, 'lp': round(p.lock_t / LOCK_TIME, 2), 'inc': i in inc,
                   'oob': math.hypot(p.x, p.z) > ARENA * 0.92, 'rs': math.ceil(p.respawn / FPS) if not p.alive else 0}
                  for i, p in enumerate(self.p)],
            'm': [[ms['id'], round(ms['x']), round(ms['y']), round(ms['z']), round(ms['h'], 2), round(ms['p'], 2), ms['o'], ms['t']] for ms in self.missiles],
            'ev': self.events[-16:],
            'finished': self.finished,
            'arena': ARENA, 'ceil': CEIL,
            'killsToWin': KILLS_TO_WIN,
        }
