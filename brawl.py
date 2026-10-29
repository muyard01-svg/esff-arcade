"""Forge Fighters : bagarre de bonshommes-bâtons sur des plateformes de fonderie, de 2 à 4 joueurs.

Simulé par le serveur à 30 images/s. On se bat aux poings, on bloque, on ramasse les armes qui tombent du ciel
dans des caisses (masse, riveteuse, lance thermique, tromblon à grenaille, boulet de fonte) et on peut les lancer.
Tomber dans la fonte en bas de l'écran, c'est perdu. Le dernier debout gagne la manche ; à chaque manche la
carte change ; le premier à 3 manches gagne la partie. Le corps (pantin désarticulé) est animé par le navigateur.
"""
from __future__ import annotations
import math
import random

FPS = 30
W, H = 1280, 720
GRAV = 1.5
MAXFALL = 26
RUN = 7.5
JUMP, JUMP2 = -21, -17
HALF = 14                   # demi-largeur du corps
TALL = 96                   # hauteur du corps (pieds → sommet du crâne)
ROUNDS_TO_WIN = 3
MAX_ROUNDS = 9
LAVA_AT = 35 * FPS          # au bout de 35 s, la fonte monte
L, R, U, D, A, B, T = 1, 2, 4, 8, 16, 32, 64

CHARS = ('fondeur', 'forgeronne', 'mouleur', 'ebarbeuse')

# armes : munitions, cadence (images), dégâts, recul infligé
WEAPONS = {
    'masse':     {'name': 'Masse de forgeron',    'ammo': 6,  'cd': 16, 'dmg': 30, 'kb': 20},
    'riveteuse': {'name': 'Riveteuse',            'ammo': 12, 'cd': 7,  'dmg': 13, 'kb': 6},
    'lance':     {'name': 'Lance thermique',      'ammo': 75, 'cd': 0,  'dmg': 1.5, 'kb': 0.7},
    'tromblon':  {'name': 'Tromblon à grenaille', 'ammo': 4,  'cd': 22, 'dmg': 9,  'kb': 5},
    'boulet':    {'name': 'Boulet de fonte',      'ammo': 1,  'cd': 10, 'dmg': 70, 'kb': 26},
}

# cartes : plateformes [x, y, l, h, options] ; g = sol (on ne peut pas passer à travers vers le bas)
MAPS = {
    'halle': {'name': 'La Halle de coulée', 'spawn': [(260, 560), (1020, 560), (440, 300), (840, 300)],
              'plat': [[140, 560, 380, 40, {'g': 1}], [760, 560, 380, 40, {'g': 1}], [520, 420, 240, 24, {}],
                       [200, 300, 180, 24, {}], [900, 300, 180, 24, {}], [560, 180, 160, 20, {}]],
              'pour': {'x': 640, 'w': 40, 'period': 9 * FPS, 'on': 2 * FPS}},
    'pont': {'name': 'Le Pont roulant', 'spawn': [(330, 600), (950, 600), (140, 440), (1140, 440)],
             'plat': [[260, 600, 760, 36, {'g': 1}], [540, 360, 200, 22, {'move': (340, 8 * FPS)}],
                      [80, 440, 140, 24, {}], [1060, 440, 140, 24, {}], [540, 190, 200, 20, {}]]},
    'laminoir': {'name': 'Le Laminoir', 'spawn': [(220, 580), (1060, 580), (400, 420), (880, 420)],
                 'plat': [[100, 580, 1080, 40, {'g': 1, 'belt': 3.5}], [300, 420, 200, 24, {'belt': -3}],
                          [780, 420, 200, 24, {'belt': 3}], [540, 260, 200, 22, {}]]},
    'ferraille': {'name': 'Le Parc à ferraille', 'spawn': [(240, 520), (1040, 520), (370, 380), (910, 380)],
                  'plat': [[160, 520, 160, 30, {'g': 1}], [420, 600, 200, 30, {'g': 1}], [660, 600, 200, 30, {'g': 1}],
                           [960, 520, 160, 30, {'g': 1}], [300, 380, 140, 24, {}], [840, 380, 140, 24, {}],
                           [570, 300, 140, 24, {'move': (0, 6 * FPS, 90)}], [560, 140, 160, 20, {}]]},
}
MAP_ORDER = ('halle', 'pont', 'laminoir', 'ferraille')


class Body:
    def __init__(self, name, bot, char):
        self.name, self.bot, self.char = name, bot, char
        self.wins = 0
        self.kills = 0

    def reset(self, x, y, fc):
        self.x, self.y, self.vx, self.vy = float(x), float(y), 0.0, 0.0
        self.fc = fc
        self.ground = False
        self.plat = -1
        self.jumps = 0
        self.hp = 100.0
        self.alive = True
        self.weapon: dict | None = None
        self.cd = 0
        self.atk = 0               # images restantes de l'animation de coup
        self.atype = ''
        self.hand = 0              # poing gauche / droit en alternance
        self.block = False
        self.stam = 100.0          # endurance de la garde
        self.stun = 0
        self.drop = 0
        self.flame = False
        self.aim = 0
        self.flash = 0
        self.last_hit = -1         # dernier joueur à l'avoir touché (pour compter les éliminations)


class Brawl:
    kind = 'fighter'
    max_seats = 4
    min_seats = 4                # partie rapide : trois robots pour une vraie mêlée
    fill_only_quick = True
    stream = True

    def __init__(self, seats):
        taken = []
        self.b: list[Body] = []
        for s in seats[:4]:
            want = (s.get('opt') or {}).get('char')
            if want not in CHARS or want in taken:
                want = random.choice([c for c in CHARS if c not in taken] or list(CHARS))
            taken.append(want)
            self.b.append(Body(s['name'], s['bot'], want))
        n = len(self.b)
        self.inputs, self.press = [0] * n, [0] * n
        self.ai_t = [0] * n
        self.ai_mask = [0] * n
        self.round = 0
        self.order = list(MAP_ORDER)
        random.shuffle(self.order)
        self.events: list[dict] = []
        self.eid = 0
        self.acc = 0.0
        self.finished: list[int] | None = None
        self.dirty = True
        self.banner = ''
        self.next_round()

    # ---------------- manches ----------------
    def next_round(self):
        if any(b.wins >= ROUNDS_TO_WIN for b in self.b) or self.round >= MAX_ROUNDS:
            order = sorted(range(len(self.b)), key=lambda i: (self.b[i].wins, self.b[i].kills), reverse=True)
            self.finished = order
            self.phase = 'over'
            self.banner = f'{self.b[order[0]].name} GAGNE LA BAGARRE !'
            self.dirty = True
            return
        self.round += 1
        self.map = self.order[(self.round - 1) % len(self.order)]
        M = MAPS[self.map]
        spawns = list(M['spawn'])
        for i, b in enumerate(self.b):
            x, y = spawns[i % len(spawns)]
            b.reset(x, y, 1 if x < W / 2 else -1)
        self.plats = [{'x': p[0], 'y': p[1], 'w': p[2], 'h': p[3], 'x0': p[0], 'y0': p[1], 'dx': 0.0, 'dy': 0.0, **p[4]} for p in M['plat']]
        self.belt_sign = 1
        self.proj: list[dict] = []
        self.crates: list[dict] = []
        self.t = 0
        self.crate_t = FPS
        self.lava = H + 30.0
        self.phase, self.pt = 'intro', int(2.0 * FPS)
        final = sum(1 for b in self.b if b.wins == ROUNDS_TO_WIN - 1) >= 2
        self.banner = f"{'MANCHE DÉCISIVE' if final else f'MANCHE {self.round}'} · {M['name'].upper()}"
        self.event('round', W / 2, 200, map=self.map)

    def end_round(self):
        alive = [i for i, b in enumerate(self.b) if b.alive]
        if len(alive) == 1:
            w = self.b[alive[0]]
            w.wins += 1
            self.banner = f'{w.name} GAGNE LA MANCHE'
            self.event('win', w.x, w.y - 120, seat=alive[0])
        else:
            self.banner = 'TOUT LE MONDE AU TAPIS'
            self.event('win', W / 2, 200, seat=-1)
        self.phase, self.pt = 'ko', int(2.6 * FPS)

    # ---------------- entrées ----------------
    def handle(self, seat, data):
        if data.get('a') != 'input' or seat >= len(self.b):
            return
        try:
            m = int(data.get('k', 0)) & 127
        except (TypeError, ValueError):
            return
        self.press[seat] |= m & ~self.inputs[seat] & (U | A | T | D)
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

    def event(self, kind, x, y, **kw):
        self.eid += 1
        self.events.append({'id': self.eid, 'k': kind, 'x': round(x), 'y': round(y), **kw})
        self.events = self.events[-16:]

    # ---------------- simulation ----------------
    def step(self, connected):
        if self.phase == 'over':
            return
        for i, b in enumerate(self.b):
            if b.bot or not connected(i):
                self.ai(i)
        self.move_plats()
        if self.phase == 'intro':
            self.pt -= 1
            for i, b in enumerate(self.b):     # on peut déjà se placer, pas encore frapper
                self.move_body(i, b, self.inputs[i] & (L | R), 0)
            self.press = [0] * len(self.b)
            if self.pt <= 0:
                self.phase = 'fight'
                self.event('go', W / 2, 300)
            return
        self.t += 1
        if self.t > LAVA_AT:
            self.lava = max(380.0, self.lava - 0.9)
        if self.map == 'laminoir' and self.t % (10 * FPS) == 0:
            self.belt_sign *= -1
            self.event('belt', W / 2, 580, s=self.belt_sign)
        # caisses d'armes larguées par le pont roulant
        self.crate_t -= 1
        if self.crate_t <= 0 and len(self.crates) < 3 and self.phase == 'fight':
            self.crate_t = random.randint(3 * FPS, 5 * FPS)
            self.crates.append({'x': random.uniform(160, W - 160), 'y': -40.0, 'vy': 0.0, 'w': random.choice(list(WEAPONS)), 'land': False})
        for c in self.crates:
            if c['land'] and 0 <= c.get('p', -1) < len(self.plats):
                p = self.plats[c['p']]
                c['x'] += p['dx']; c['y'] = p['y']
                continue
            c['vy'] = min(10.0, c['vy'] + 0.6)
            prev = c['y']; c['y'] += c['vy']
            for k, p in enumerate(self.plats):
                if prev <= p['y'] <= c['y'] and p['x'] - 10 <= c['x'] <= p['x'] + p['w'] + 10:
                    c.update(y=p['y'], land=True, p=k)
                    break
        self.crates = [c for c in self.crates if c['y'] < self.lava]
        for i, b in enumerate(self.b):
            if not b.alive:
                continue
            press = self.press[i]
            self.move_body(i, b, self.inputs[i], press)
            self.act(i, b, self.inputs[i], press)
        self.press = [0] * len(self.b)
        self.step_proj()
        # la coulée de la halle : un jet de fonte qui tombe du chenal par intermittence
        pour = MAPS[self.map].get('pour')
        if pour and self.pour_on():
            for i, b in enumerate(self.b):
                if b.alive and abs(b.x - pour['x']) < pour['w'] / 2 + HALF:
                    self.hurt(i, 2.2, 0, -1, None, quiet=True)
        if self.phase == 'fight' and sum(1 for b in self.b if b.alive) <= 1:
            self.phase, self.pt = 'end', int(0.9 * FPS)
        elif self.phase == 'end':
            self.pt -= 1
            if self.pt <= 0:
                self.end_round()
        elif self.phase == 'ko':
            self.pt -= 1
            if self.pt <= 0:
                self.next_round()
        self.dirty = True

    def pour_on(self):
        pour = MAPS[self.map].get('pour')
        return bool(pour) and self.t % pour['period'] >= pour['period'] - pour['on']

    def move_plats(self):
        for p in self.plats:
            mv = p.get('move')
            if not mv:
                continue
            amp, period = mv[0], mv[1]
            ph = math.sin(self.t * 2 * math.pi / period)
            nx = p['x0'] + amp / 2 * ph if amp else p['x0']
            ny = p['y0'] + (mv[2] / 2 * ph if len(mv) > 2 else 0)
            p['dx'], p['dy'] = nx - p['x'], ny - p['y']
            p['x'], p['y'] = nx, ny

    def move_body(self, i, b, inp, press):
        if not b.alive:
            return
        b.flash = max(0, b.flash - 1)
        b.stun = max(0, b.stun - 1)
        b.drop = max(0, b.drop - 1)
        ctrl = b.stun == 0
        want = ((1 if inp & R else 0) - (1 if inp & L else 0)) if ctrl else 0
        b.block = bool(inp & B) and ctrl and b.stam > 5 and b.atk == 0
        b.stam = max(0.0, b.stam - 2.2) if b.block else min(100.0, b.stam + 0.8)
        top = RUN * (0.4 if b.block else 1)
        if want:
            b.vx += max(-1.7 if b.ground else -0.9, min(1.7 if b.ground else 0.9, want * top - b.vx))
            if b.atk == 0 and not b.flame:
                b.fc = want
        elif b.ground:
            b.vx *= 0.72
        else:
            b.vx *= 0.97
        b.aim = (-1 if inp & U else 1 if inp & D and not b.ground else 0) if ctrl else 0
        if press & U and ctrl:
            if b.ground:
                b.vy = JUMP; b.jumps = 1; b.ground = False
                self.event('jump', b.x, b.y)
            elif b.jumps < 2:
                b.vy = JUMP2; b.jumps = 2
                self.event('jump', b.x, b.y, d=1)
        if press & D and b.ground and 0 <= b.plat < len(self.plats) and not self.plats[b.plat].get('g'):
            b.drop = 8; b.ground = False
        b.vy = min(MAXFALL, b.vy + GRAV)
        # entraîné par la plateforme sur laquelle on se tient (pont roulant, rouleaux du laminoir)
        if b.ground and 0 <= b.plat < len(self.plats):
            p = self.plats[b.plat]
            b.x += p['dx'] + p.get('belt', 0) * self.belt_sign
        prev_y = b.y
        b.x += b.vx
        b.y += b.vy
        b.ground = False
        if b.vy >= 0:
            for k, p in enumerate(self.plats):
                if b.drop and not p.get('g'):
                    continue
                top_y = p['y']
                if prev_y - p['dy'] <= top_y + 1 and b.y >= top_y and p['x'] - HALF < b.x < p['x'] + p['w'] + HALF:
                    b.y, b.vy, b.ground, b.jumps, b.plat = top_y, 0.0, True, 0, k
                    break
        if b.y > H + 80 or b.y - 20 > self.lava or b.x < -200 or b.x > W + 200:
            self.kill(i, b, 'fonte' if b.y - 20 > self.lava or b.y > H else 'chute')

    def act(self, i, b, inp, press):
        b.cd = max(0, b.cd - 1)
        b.flame = False
        if b.atk > 0:
            b.atk -= 1
            if b.atype == 'punch' and b.atk == 5:
                self.melee(i, b, 70, 10, 11, -7)
            elif b.atype == 'masse' and b.atk == 8:
                self.melee(i, b, 100, WEAPONS['masse']['dmg'], WEAPONS['masse']['kb'], -12, big=True)
        if b.stun:
            return
        # ramasser une caisse en passant dessus (mains vides)
        if b.weapon is None:
            for c in self.crates:
                if abs(c['x'] - b.x) < 40 and -20 < b.y - c['y'] < 80:
                    b.weapon = {'w': c['w'], 'ammo': WEAPONS[c['w']]['ammo']}
                    self.crates.remove(c)
                    self.event('pick', b.x, b.y - 60, seat=i, w=c['w'])
                    break
        if press & T and b.weapon:   # lancer l'arme sur quelqu'un
            self.proj.append({'k': 'jet', 'w': b.weapon['w'], 'x': b.x + b.fc * 20, 'y': b.y - 60, 'vx': b.fc * 24.0, 'vy': -5.0 + b.aim * 6, 'o': i, 'life': 60})
            b.weapon = None
            self.event('throw', b.x, b.y - 60)
            return
        if b.block:
            return
        w = b.weapon['w'] if b.weapon else None
        if w == 'lance':
            if inp & A and b.weapon['ammo'] > 0:
                b.flame = True
                b.weapon['ammo'] -= 1
                ang = self.aim_angle(b)
                ox, oy = b.x + b.fc * 20, b.y - 62
                for j, o in enumerate(self.b):
                    if j == i or not o.alive:
                        continue
                    dx, dy = o.x - ox, (o.y - 50) - oy
                    d = math.hypot(dx, dy)
                    if d < 180 and abs(math.atan2(math.sin(math.atan2(dy, dx) - ang), math.cos(math.atan2(dy, dx) - ang))) < 0.35:
                        self.hurt(j, WEAPONS['lance']['dmg'], math.cos(ang) * 0.7, math.sin(ang) * 0.4, i, quiet=True)
                if b.weapon['ammo'] <= 0:
                    b.weapon = None
            return
        if not press & A or b.cd > 0 or b.atk > 0:
            return
        if w is None:
            b.atk, b.atype, b.cd = 9, 'punch', 9
            b.hand ^= 1
            b.vx += b.fc * 2.5
            self.event('swing', b.x, b.y - 60)
        elif w == 'masse':
            b.atk, b.atype, b.cd = 14, 'masse', WEAPONS['masse']['cd']
            self.use_ammo(b)
        elif w in ('riveteuse', 'tromblon'):
            ang = self.aim_angle(b)
            ox, oy = b.x + b.fc * 34, b.y - 62
            n = 5 if w == 'tromblon' else 1
            for k in range(n):
                a = ang + (random.uniform(-0.22, 0.22) if n > 1 else random.uniform(-0.03, 0.03))
                self.proj.append({'k': 'balle', 'w': w, 'x': ox, 'y': oy, 'vx': math.cos(a) * 36, 'vy': math.sin(a) * 36, 'o': i, 'life': 40})
            b.vx -= b.fc * (9 if n > 1 else 2)
            b.atk, b.atype, b.cd = 5, 'tir', WEAPONS[w]['cd']
            self.event('shot', ox, oy, w=w)
            self.use_ammo(b)
        elif w == 'boulet':
            ang = self.aim_angle(b)
            self.proj.append({'k': 'boulet', 'w': w, 'x': b.x + b.fc * 20, 'y': b.y - 70, 'vx': b.fc * 15.0, 'vy': -12.0 + b.aim * 7, 'o': i, 'life': 48})
            b.atk, b.atype, b.cd = 8, 'lancer', 10
            b.weapon = None
            self.event('throw', b.x, b.y - 60)

    def aim_angle(self, b):
        a = -0.6 if b.aim < 0 else 0.6 if b.aim > 0 else 0.0
        return a if b.fc > 0 else math.pi - a

    def use_ammo(self, b):
        b.weapon['ammo'] -= 1
        if b.weapon['ammo'] <= 0:
            b.weapon = None

    def melee(self, i, b, reach, dmg, kb, kvy, big=False):
        for j, o in enumerate(self.b):
            if j == i or not o.alive:
                continue
            dx = (o.x - b.x) * b.fc
            if -10 < dx < reach and abs((o.y - 50) - (b.y - 50)) < 70:
                self.hurt(j, dmg, b.fc * kb, kvy, i, big=big)

    def hurt(self, j, dmg, kx, ky, src, big=False, quiet=False):
        o = self.b[j]
        if not o.alive:
            return
        if o.block and src is not None and ((self.b[src].x - o.x) * o.fc > 0) and not quiet:
            o.vx += kx * 0.3
            o.stam = max(0.0, o.stam - dmg * 1.5)
            self.event('block', o.x, o.y - 60)
            return
        o.hp -= dmg
        o.vx += kx
        if ky:
            o.vy = min(o.vy, ky) if ky < 0 else o.vy + ky
            if ky < 0:
                o.ground = False
        if src is not None:
            o.last_hit = src
        if not quiet:
            o.flash = 4
            o.stun = 6 if big else 3
            self.event('hit', o.x, o.y - 60, big=big, d=round(dmg))
        if o.hp <= 0:
            self.kill(j, o, 'coup', kx, ky)

    def kill(self, j, o, how, kx=0.0, ky=0.0):
        if not o.alive:
            return
        o.alive = False
        o.hp = 0
        o.weapon = None
        if o.last_hit >= 0 and o.last_hit != j:
            self.b[o.last_hit].kills += 1
        self.event('die', o.x, o.y, seat=j, how=how, vx=round(o.vx + kx, 1), vy=round(min(o.vy, ky) if ky < 0 else o.vy, 1))

    def step_proj(self):
        keep = []
        for p in self.proj:
            p['life'] -= 1
            if p['k'] in ('boulet', 'jet'):
                p['vy'] += 1.0 if p['k'] == 'boulet' else 0.6
            px, py = p['x'], p['y']
            p['x'] += p['vx']; p['y'] += p['vy']
            hit_plat = any(q['x'] <= p['x'] <= q['x'] + q['w'] and q['y'] <= p['y'] <= q['y'] + q['h'] for q in self.plats)
            if p['k'] == 'boulet':
                if hit_plat:            # le boulet rebondit, puis explose à la fin de la mèche
                    p['y'] = py; p['vy'] *= -0.45; p['vx'] *= 0.7
                if p['life'] <= 0:
                    self.explode(p)
                    continue
                keep.append(p)
                continue
            if hit_plat or p['life'] <= 0 or not (-100 < p['x'] < W + 100 and p['y'] < H + 100):
                if hit_plat:
                    self.event('spark', p['x'], p['y'])
                continue
            hit = False
            for j, o in enumerate(self.b):
                if j == p['o'] or not o.alive:
                    continue
                # segment parcouru contre la boîte du corps
                for s in (0.0, 0.5, 1.0):
                    x, y = px + (p['x'] - px) * s, py + (p['y'] - py) * s
                    if abs(x - o.x) < HALF + 6 and o.y - TALL < y < o.y:
                        sgn = 1 if p['vx'] > 0 else -1
                        if p['k'] == 'jet':
                            self.hurt(j, 16, sgn * 14, -6, p['o'], big=True)
                        else:
                            self.hurt(j, WEAPONS[p['w']]['dmg'], sgn * WEAPONS[p['w']]['kb'], -2, p['o'])
                        hit = True
                        break
                if hit:
                    break
            if not hit:
                keep.append(p)
        self.proj = keep

    def explode(self, p):
        self.event('boom', p['x'], p['y'])
        for j, o in enumerate(self.b):
            if not o.alive:
                continue
            dx, dy = o.x - p['x'], (o.y - 50) - p['y']
            d = math.hypot(dx, dy)
            if d < 150:
                k = 1 - d / 150
                n = max(1.0, d)
                self.hurt(j, WEAPONS['boulet']['dmg'] * k, dx / n * WEAPONS['boulet']['kb'] * (0.4 + k), -10 - 12 * k, p['o'], big=True)

    # ---------------- robots ----------------
    def ground_below(self, x, y):
        return any(p['x'] - 4 <= x <= p['x'] + p['w'] + 4 and y - 4 <= p['y'] <= y + 260 and p['y'] < self.lava for p in self.plats)

    def ai(self, i):
        b = self.b[i]
        if not b.alive or self.phase not in ('fight', 'intro'):
            self.inputs[i] = 0
            return
        self.ai_t[i] -= 1
        foes = [o for j, o in enumerate(self.b) if j != i and o.alive]
        mask = 0
        if foes:
            tgt = min(foes, key=lambda o: abs(o.x - b.x) + abs(o.y - b.y) * 1.5)
            tx, ty = tgt.x, tgt.y
            w = b.weapon['w'] if b.weapon else None
            if w is None:
                landed = [c for c in self.crates if c['land']]
                if landed:
                    c = min(landed, key=lambda c: abs(c['x'] - b.x) + abs(c['y'] - b.y))
                    if abs(c['x'] - b.x) + abs(c['y'] - b.y) < 0.8 * (abs(tx - b.x) + abs(ty - b.y)):
                        tx, ty = c['x'], c['y']
            dx, dy = tx - b.x, ty - b.y
            ranged = w in ('riveteuse', 'tromblon', 'boulet')
            want = 260 if w == 'riveteuse' else 170 if w in ('tromblon', 'boulet') else 120 if w == 'lance' else 40
            if abs(dx) > want:
                mask |= R if dx > 0 else L
            elif ranged and abs(dx) < want * 0.5:
                mask |= L if dx > 0 else R          # garde ses distances
            elif dx * b.fc < 0:
                mask |= R if dx > 0 else L          # se retourne vers la cible
            step_dir = 1 if mask & R else -1 if mask & L else 0
            if b.ground and step_dir and not self.ground_below(b.x + step_dir * 50, b.y):
                if dy < -40 or (abs(dx) > 120 and self.ground_below(b.x + step_dir * 200, b.y - 120)):
                    mask |= U
                else:
                    mask &= ~(L | R)
            if b.ground and dy < -90 and abs(dx) < 260 and random.random() < 0.08:
                mask |= U
            if not b.ground and b.vy > 4 and b.jumps < 2 and not self.ground_below(b.x, b.y):
                mask |= U
                plat = min(self.plats, key=lambda p: abs(p['x'] + p['w'] / 2 - b.x) + abs(p['y'] - b.y))
                mask = (mask & ~(L | R)) | (R if plat['x'] + plat['w'] / 2 > b.x else L)
            if ranged and abs(tgt.y - b.y) > 60:
                mask |= U if tgt.y < b.y else 0
            close = abs(tgt.x - b.x) < (90 if w == 'masse' else 60) and abs(tgt.y - b.y) < 60
            if self.ai_t[i] <= 0:
                self.ai_t[i] = random.randint(3, 9)
                facing = (tgt.x - b.x) * b.fc > 0
                if close and facing and w in (None, 'masse') and random.random() < 0.7:
                    mask |= A
                elif ranged and facing and abs(tgt.y - b.y) < 70 and random.random() < 0.6:
                    mask |= A
                if tgt.atk > 0 and abs(tgt.x - b.x) < 90 and random.random() < 0.3:
                    mask |= B
            if w == 'lance' and abs(tgt.x - b.x) < 170 and abs(tgt.y - b.y) < 70 and (tgt.x - b.x) * b.fc > 0:
                mask |= A
            if self.phase == 'intro':
                mask &= L | R
        if self.inputs[i] & U and mask & U and b.ground:
            mask &= ~U          # relâcher pour pouvoir ressauter
        self.press[i] |= mask & ~self.inputs[i] & (U | A | T | D)
        self.inputs[i] = mask

    # ---------------- état envoyé ----------------
    def completed(self, seat):
        return True

    def init_payload(self):
        return {'arena': {'w': W, 'h': H, 'tall': TALL, 'toWin': ROUNDS_TO_WIN,
                          'maps': {k: {'name': m['name'], 'pour': m.get('pour')} for k, m in MAPS.items()},
                          'weapons': {k: v['name'] for k, v in WEAPONS.items()}}}

    def view(self):
        return {
            'phase': self.phase, 'round': self.round, 'map': self.map, 'banner': self.banner, 'lava': round(self.lava),
            'pour': self.pour_on(), 'belt': self.belt_sign, 't': self.t,
            'plats': [[round(p['x'], 1), round(p['y'], 1), p['w'], p['h'], 1 if p.get('g') else 0, p.get('belt', 0), 1 if p.get('move') else 0] for p in self.plats],
            'b': [{'n': b.name, 'ch': b.char, 'x': round(b.x, 1), 'y': round(b.y, 1), 'vx': round(b.vx, 1), 'vy': round(b.vy, 1),
                   'fc': b.fc, 'hp': round(b.hp), 'al': b.alive, 'g': b.ground, 'w': b.weapon['w'] if b.weapon else None,
                   'am': b.weapon['ammo'] if b.weapon else 0, 'atk': b.atk, 'at': b.atype, 'hd': b.hand, 'bl': b.block,
                   'fl': b.flame, 'aim': b.aim, 'st': b.stun, 'f': b.flash, 'wins': b.wins, 'k': b.kills, 'bot': b.bot} for b in self.b],
            'proj': [[round(p['x']), round(p['y']), p['k'], p['w'], round(p['vx'])] for p in self.proj],
            'crates': [[round(c['x']), round(c['y']), c['w'], 1 if c['land'] else 0] for c in self.crates],
            'ev': self.events[-10:], 'finished': self.finished, 'toWin': ROUNDS_TO_WIN,
        }
