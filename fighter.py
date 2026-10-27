"""Forge Fighters : combat 2D en un contre un, entièrement simulé par le serveur (30 images/s).

Les navigateurs n'envoient que leurs touches ; le serveur fait bouger les combattants,
détecte les coups et renvoie l'état à afficher."""
from __future__ import annotations
import math
import random

FPS = 30
STAGE_W = 1000
X_MIN, X_MAX = 60, STAGE_W - 60
GRAVITY = 2.2
JUMP_V = 25
WALK = 8.5
ROUND_TIME = 60
ROUNDS_TO_WIN = 2
MAX_ROUNDS = 5
HALF_W = 34
STAND_H, CROUCH_H = 180, 110

# touches (masque de bits envoyé par le client)
L, R, U, D, P, K, S = 1, 2, 4, 8, 16, 32, 64

CHARS = {
    'fondeur':    {'name': 'Marius',   'title': 'Le Fondeur',    'color': '#EC641E', 'speed': 1.0,  'power': 1.0,  'hp': 100, 'special': 'coulee'},
    'forgeronne': {'name': 'Brigitte', 'title': 'La Forgeronne', 'color': '#BA2C3A', 'speed': 0.88, 'power': 1.02, 'hp': 104, 'special': 'masse'},
    'mouleur':    {'name': 'Sacha',    'title': 'Le Mouleur',    'color': '#8A8D91', 'speed': 0.95, 'power': 1.0,  'hp': 106, 'special': 'sable'},
    'ebarbeuse':  {'name': 'Nina',     'title': "L'Ébarbeuse",   'color': '#3A3D42', 'speed': 1.16, 'power': 1.0,  'hp': 100,  'special': 'meuleuse'},
}

# s/a/r : images de démarrage, actives, récupération. x0..x1 / y0..y1 : zone de frappe.
# lvl : high (bloqué debout ou accroupi), low (accroupi seulement), over (debout seulement)
MOVES = {
    'jab':   dict(s=3, a=3, r=7,  dmg=5,  x0=20, x1=88,  y0=110, y1=155, lvl='high', hs=12, bs=8,  push=6),
    'kick':  dict(s=6, a=3, r=11, dmg=9,  x0=20, x1=112, y0=70,  y1=125, lvl='high', hs=15, bs=10, push=9),
    'low':   dict(s=6, a=3, r=12, dmg=7,  x0=20, x1=108, y0=0,   y1=40,  lvl='low',  hs=14, bs=10, push=7),
    'upper': dict(s=6, a=4, r=18, dmg=12, x0=15, x1=82,  y0=90,  y1=200, lvl='high', hs=0,  bs=12, push=4, launch=True),
    'air':   dict(s=4, a=6, r=6,  dmg=8,  x0=10, x1=96,  y0=30,  y1=110, lvl='over', hs=14, bs=9,  push=6),
    # coups spéciaux (coûtent de la chaleur)
    'coulee':   dict(s=10, a=1, r=16, dmg=13, lvl='high', hs=16, bs=10, push=8, cost=35, proj=True),
    'masse':    dict(s=14, a=4, r=22, dmg=15, x0=20, x1=135, y0=0, y1=175, lvl='over', hs=0, bs=16, push=12, cost=35, launch=True),
    'sable':    dict(s=8,  a=5, r=18, dmg=10, x0=20, x1=165, y0=0, y1=185, lvl='high', hs=26, bs=12, push=24, cost=35),
    'meuleuse': dict(s=5,  a=12, r=14, dmg=4, x0=10, x1=95,  y0=60, y1=150, lvl='high', hs=10, bs=6, push=3, cost=35, dash=13, multi=4),
}
FREE = ('idle', 'walk', 'crouch')


class Fighter:
    def __init__(self, name, bot, char):
        c = CHARS[char]
        self.name, self.bot, self.char = name, bot, char
        self.maxhp = c['hp']
        self.speed, self.power = c['speed'], c['power']
        self.wins = 0
        self.meter = 0.0

    def reset(self, x, facing):
        self.x, self.y, self.vx, self.vy = x, 0.0, 0.0, 0.0
        self.facing = facing
        self.hp = float(self.maxhp)
        self.state, self.t = 'idle', 0
        self.move, self.mv, self.frame = None, None, 0
        self.hit_done, self.hits, self.last_hit = False, 0, -99
        self.blocking = self.low_guard = False
        self.air_used = False
        self.combo = 0

    def start(self, move):
        self.state, self.move, self.mv, self.frame = 'attack', move, MOVES[move], 0
        self.hit_done, self.hits, self.last_hit = False, 0, -99
        if self.y <= 0:
            self.vx = 0.0
        if 'cost' in self.mv:
            self.meter -= self.mv['cost']

    def hurt_top(self):
        crouched = self.state == 'crouch' or (self.state == 'blockstun' and self.low_guard)
        return self.y + (CROUCH_H if crouched else STAND_H)


class Fight:
    kind = 'fighter'
    max_seats = 2
    min_seats = 2
    stream = True

    def __init__(self, seats):
        chosen = []
        self.f: list[Fighter] = []
        for s in seats[:2]:
            want = (s.get('opt') or {}).get('char')
            if want not in CHARS:
                want = random.choice([c for c in CHARS if c not in chosen] or list(CHARS))
            chosen.append(want)
            self.f.append(Fighter(s['name'], s['bot'], want))
        self.inputs, self.press = [0, 0], [0, 0]
        self.ai_mask, self.ai_t, self.ai_seen = [0, 0], [0, 0], [None, None]
        self.round = 1
        self.proj: list[dict] = []
        self.events: list[dict] = []
        self.eid = 0
        self.acc = 0.0
        self.finished: list[int] | None = None
        self.dirty = True
        self.place()

    # ---------------- déroulé des manches ----------------
    def place(self):
        self.f[0].reset(360, 1)
        self.f[1].reset(640, -1)
        self.proj = []
        self.phase, self.pt = 'intro', int(2.2 * FPS)
        self.timer = ROUND_TIME * FPS
        final = all(f.wins == ROUNDS_TO_WIN - 1 for f in self.f)
        self.banner = 'MANCHE FINALE' if final else f'MANCHE {self.round}'

    def end_round(self):
        a, b = self.f
        ko = a.hp <= 0 or b.hp <= 0
        winner = None
        if a.hp > b.hp:
            winner = a
        elif b.hp > a.hp:
            winner = b
        for f in self.f:
            if f is winner:
                f.wins += 1
                if f.state in FREE or f.state == 'jump':
                    f.state = 'win'
            elif f.hp <= 0:
                f.state = 'ko' if f.state != 'down' else 'down'
                f.t = 999
        self.banner = ('K.O. !' if ko else 'TEMPS ÉCOULÉ') if winner else 'ÉGALITÉ'
        self.event('ko' if ko else 'time', STAGE_W / 2, 120)
        self.phase, self.pt = 'ko', int(2.6 * FPS)

    def next_round(self):
        a, b = self.f
        if a.wins >= ROUNDS_TO_WIN or b.wins >= ROUNDS_TO_WIN or self.round >= MAX_ROUNDS:
            order = sorted(range(2), key=lambda i: (self.f[i].wins, self.f[i].hp), reverse=True)
            self.finished = order
            self.phase = 'over'
            self.banner = f"{self.f[order[0]].name} GAGNE !"
            return
        self.round += 1
        self.place()

    # ---------------- entrées ----------------
    def handle(self, seat, data):
        if data.get('a') != 'input' or seat > 1:
            return
        try:
            m = int(data.get('k', 0)) & 127
        except (TypeError, ValueError):
            return
        self.press[seat] |= m & ~self.inputs[seat] & (P | K | S | U)
        self.inputs[seat] = m

    def tick(self, dt, connected):
        self.acc += dt
        steps = 0
        while self.acc >= 1 / FPS and steps < 4:
            self.acc -= 1 / FPS
            steps += 1
            self.step(connected)
        if steps == 4:
            self.acc = 0.0

    def event(self, kind, x, y, big=False):
        self.eid += 1
        self.events.append({'id': self.eid, 'k': kind, 'x': round(x), 'y': round(y), 'big': big})
        self.events = self.events[-12:]

    # ---------------- simulation ----------------
    def step(self, connected):
        if self.phase == 'over':
            return
        for i, f in enumerate(self.f):
            if f.bot or not connected(i):
                self.ai(i)
        if self.phase == 'intro':
            self.pt -= 1
            if self.pt == int(0.8 * FPS):
                self.banner = 'COULEZ !'
            if self.pt <= 0:
                self.phase, self.banner = 'fight', ''
        elif self.phase == 'fight':
            self.timer -= 1
        elif self.phase == 'ko':
            self.pt -= 1
            if self.pt <= 0:
                self.next_round()
                return
        active = self.phase == 'fight'
        for i in (0, 1):
            self.update_fighter(i, active)
        self.separate()
        if active:
            for i in (0, 1):
                self.check_hit(i)
            self.update_proj()
        self.press = [0, 0]
        for i in (0, 1):  # le compteur de combo retombe quand l'adversaire se relève
            if self.f[1 - i].state not in ('hit', 'down'):
                self.f[i].combo = 0
        if active and (self.f[0].hp <= 0 or self.f[1].hp <= 0 or self.timer <= 0):
            self.end_round()

    def update_fighter(self, i, active):
        f, o = self.f[i], self.f[1 - i]
        m = self.inputs[i] if active else 0
        pr = self.press[i] if active else 0
        fwd = R if o.x > f.x else L
        back = L if fwd == R else R

        if f.y > 0 or f.vy > 0:
            f.vy -= GRAVITY
            f.y += f.vy
            if f.y <= 0:
                f.y, f.vy = 0.0, 0.0
        f.x = min(X_MAX, max(X_MIN, f.x + f.vx))
        f.blocking = False
        st = f.state

        if st in ('hit', 'blockstun'):
            f.t -= 1
            f.vx *= 0.78
            if f.t <= 0 and f.y <= 0:
                f.state = 'idle'
            return
        if st == 'down':
            if f.y <= 0:
                f.vx *= 0.8
                f.t -= 1
                if f.t <= 0 and f.hp > 0:
                    f.state, f.t = 'getup', 12
            return
        if st == 'getup':
            f.t -= 1
            if f.t <= 0:
                f.state = 'idle'
            return
        if st in ('ko', 'win'):
            f.vx *= 0.8
            return
        if st == 'attack':
            f.frame += 1
            mv = f.mv
            if mv.get('dash') and f.frame < mv['s'] + mv['a']:
                f.vx = f.facing * mv['dash'] if f.frame >= mv['s'] else 0.0
            elif f.y <= 0:
                f.vx *= 0.6
            if mv.get('proj') and f.frame == mv['s']:
                self.proj.append({'x': f.x + f.facing * 70, 'y': 100.0, 'vx': f.facing * 13.0, 'owner': i})
                self.event('cast', f.x + f.facing * 70, 100)
            if f.move == 'air' and f.y <= 0 and f.frame > 2:
                f.state = 'idle'
            elif f.frame >= mv['s'] + mv['a'] + mv['r']:
                f.state = 'idle' if f.y <= 0 else 'jump'
            return

        if f.y > 0:  # en l'air
            f.state = 'jump'
            if pr & (P | K) and not f.air_used:
                f.air_used = True
                f.start('air')
            return
        f.air_used = False
        f.facing = 1 if o.x > f.x else -1
        special = CHARS[f.char]['special']
        if pr & S and f.meter >= MOVES[special]['cost']:
            f.start(special)
        elif pr & P:
            f.start('upper' if m & D else 'jab')
        elif pr & K:
            f.start('low' if m & D else 'kick')
        elif m & U:
            f.vy, f.y = JUMP_V, 0.01
            d = 1 if m & R else -1 if m & L else 0
            f.vx = d * WALK * 0.85 * f.speed
            f.state = 'jump'
        elif m & D:
            f.state, f.vx = 'crouch', 0.0
            f.blocking = bool(m & back)
        elif m & (L | R):
            d = 1 if m & R else -1
            going_back = d != f.facing
            f.vx = d * WALK * f.speed * (0.72 if going_back else 1.0)
            f.state = 'walk'
            f.blocking = going_back
        else:
            f.state, f.vx = 'idle', 0.0

    def separate(self):
        a, b = self.f
        dx = b.x - a.x
        if abs(dx) < 2 * HALF_W - 6 and abs(a.y - b.y) < 120:
            push = (2 * HALF_W - 6 - abs(dx)) / 2
            sgn = 1 if dx >= 0 else -1
            a.x -= sgn * push
            b.x += sgn * push
            for f, o in ((a, b), (b, a)):
                if f.x < X_MIN:
                    o.x += X_MIN - f.x
                    f.x = X_MIN
                elif f.x > X_MAX:
                    o.x -= f.x - X_MAX
                    f.x = X_MAX

    def check_hit(self, i):
        a, d = self.f[i], self.f[1 - i]
        if a.state != 'attack' or a.mv.get('proj'):
            return
        mv = a.mv
        if not (mv['s'] <= a.frame < mv['s'] + mv['a']):
            return
        if mv.get('multi'):
            if a.hits >= mv['multi'] or a.frame - a.last_hit < 3:
                return
        elif a.hit_done:
            return
        if d.state in ('down', 'getup', 'ko'):
            return
        lo, hi = sorted((a.x + a.facing * mv['x0'], a.x + a.facing * mv['x1']))
        y0, y1 = a.y + mv['y0'], a.y + mv['y1']
        if hi < d.x - HALF_W or lo > d.x + HALF_W or y1 < d.y or y0 > d.hurt_top():
            return
        self.resolve(a, d, mv, (lo + hi) / 2 if a.facing > 0 else (lo + hi) / 2, (max(y0, d.y) + min(y1, d.hurt_top())) / 2)
        a.hit_done, a.last_hit = True, a.frame
        a.hits += 1

    def resolve(self, a, d, mv, hx, hy):
        crouching = d.state == 'crouch' or (d.state == 'blockstun' and d.low_guard)
        can_block = d.y <= 0 and (d.state == 'blockstun' or (d.state in FREE and d.blocking))
        if can_block and ((mv['lvl'] == 'low' and not crouching) or (mv['lvl'] == 'over' and crouching)):
            can_block = False
        if can_block:
            d.state, d.t, d.low_guard = 'blockstun', mv['bs'], crouching
            d.vx = a.facing * mv['push'] * 0.8
            if 'cost' in mv:
                d.hp = max(0.0, d.hp - round(mv['dmg'] * 0.15))
            a.meter = min(100.0, a.meter + 3)
            self.event('block', hx, hy)
            return
        a.combo = a.combo + 1 if d.state in ('hit', 'down') else 1
        dmg = mv['dmg'] * 1.3 * a.power * max(0.5, 1 - 0.1 * (a.combo - 1))
        d.hp = max(0.0, d.hp - dmg)
        a.meter = min(100.0, a.meter + 8)
        d.meter = min(100.0, d.meter + 5)
        if mv.get('launch') or d.hp <= 0 or d.y > 0:
            d.state, d.vy, d.y, d.vx, d.t = 'down', 15.0, max(d.y, 1.0), a.facing * 7.0, int(0.8 * FPS)
        else:
            d.state, d.t, d.vx = 'hit', mv['hs'], a.facing * mv['push']
        self.event('hit', hx, hy, big=dmg >= 11)

    def update_proj(self):
        keep = []
        for p in self.proj:
            p['x'] += p['vx']
            if not X_MIN - 40 < p['x'] < X_MAX + 40:
                continue
            clash = next((q for q in keep if q['owner'] != p['owner'] and abs(q['x'] - p['x']) < 34), None)
            if clash:
                keep.remove(clash)
                self.event('clash', p['x'], p['y'])
                continue
            d = self.f[1 - p['owner']]
            if abs(p['x'] - d.x) < HALF_W + 14 and d.y <= p['y'] <= d.hurt_top() and d.state not in ('down', 'getup', 'ko'):
                a = self.f[p['owner']]
                self.resolve(a, d, MOVES['coulee'], p['x'], p['y'])
                continue
            keep.append(p)
        self.proj = keep

    # ---------------- robot ----------------
    def ai(self, i):
        f, o = self.f[i], self.f[1 - i]
        fwd = R if o.x > f.x else L
        back = L if fwd == R else R
        dist = abs(o.x - f.x)
        mask = self.ai_mask[i]
        self.ai_t[i] -= 1
        threat = o.state == 'attack' and o.frame < o.mv['s'] + o.mv['a'] and dist < o.mv.get('x1', 400) + 70
        incoming = any(p['owner'] != i and abs(p['x'] - f.x) < 260 and (p['x'] - f.x) * p['vx'] < 0 for p in self.proj)
        key = (id(o.mv), o.frame // 30) if threat else None
        if (threat or incoming) and self.ai_seen[i] != key and f.state in FREE:
            self.ai_seen[i] = key
            if random.random() < 0.55:
                low = threat and o.mv['lvl'] == 'low'
                mask = back | (D if low else 0)
                if incoming and random.random() < 0.4:
                    mask = U | fwd
                self.ai_t[i] = 10
        elif self.ai_t[i] <= 0:
            r = random.random()
            special = CHARS[f.char]['special']
            can_special = f.meter >= MOVES[special]['cost']
            if dist > 260:
                mask = fwd
                if r < 0.08:
                    mask = fwd | U
                elif r < 0.2 and can_special and special == 'coulee':
                    mask = S
            elif dist > 125:
                mask = fwd if r < 0.45 else K if r < 0.6 else (fwd | U) if r < 0.68 else (S if can_special and special in ('sable', 'meuleuse', 'masse') and r < 0.76 else back)
            else:
                mask = (P if r < 0.28 else K if r < 0.46 else D | K if r < 0.58 else D | P if r < 0.68
                        else S if r < 0.78 and can_special else back if r < 0.9 else back | D)
            self.ai_t[i] = random.randint(5, 11)
        self.ai_mask[i] = mask
        self.press[i] |= mask & ~self.inputs[i] & (P | K | S | U)
        self.inputs[i] = mask

    # ---------------- état envoyé aux navigateurs ----------------
    def completed(self, seat):
        return True

    def view(self):
        out = []
        for f in self.f:
            ph, prog = 0, 0.0
            if f.state == 'attack':
                mv = f.mv
                total = mv['s'] + mv['a'] + mv['r']
                ph = 0 if f.frame < mv['s'] else 1 if f.frame < mv['s'] + mv['a'] else 2
                prog = round(f.frame / total, 3)
            out.append({'x': round(f.x, 1), 'y': round(f.y, 1), 'fc': f.facing, 'st': f.state, 'mv': f.move,
                        'ph': ph, 'p': prog, 'hp': round(f.hp, 1), 'max': f.maxhp, 'm': round(f.meter),
                        'ch': f.char, 'n': f.name, 'w': f.wins, 'cb': f.combo, 'bl': f.blocking or f.state == 'blockstun',
                        'lg': f.low_guard, 't': f.t})
        return {'phase': self.phase, 'round': self.round, 'timer': math.ceil(max(0, self.timer) / FPS),
                'banner': self.banner, 'f': out, 'proj': [[round(p['x']), round(p['y']), p['owner']] for p in self.proj],
                'ev': self.events[-8:], 'finished': self.finished, 'toWin': ROUNDS_TO_WIN}
