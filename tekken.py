"""Poing de Fonte 3D : combat en 3D façon Tekken 2, simulé par le serveur (30 images/s).

Arène ronde, 4 boutons de membres (1 poing gauche, 2 poing droit, 3 pied gauche, 4 pied droit),
coups hauts / moyens / bas, pas de côté, coups qui suivent, projections, jongles, dash."""
from __future__ import annotations
import math
import random

FPS = 30
ARENA_R = 520
GRAVITY = 2.2
WALK_F, WALK_B = 6.5, 5.0
ROUND_TIME = 60
ROUNDS_TO_WIN = 2
MAX_ROUNDS = 5
MIN_DIST = 62
STAND_H, CROUCH_H = 185, 105

# touches : B/F = reculer/avancer (le client met toujours son joueur à gauche), U/D, boutons 1 à 4
B, F, U, D, B1, B2, B3, B4 = 1, 2, 4, 8, 16, 32, 64, 128
BUTTONS = B1 | B2 | B3 | B4

CHARS = {
    'fondeur':        {'name': 'Marius',   'speed': 1.0,  'power': 1.0,  'hp': 140, 'special': 'coulee'},
    'forgeronne':     {'name': 'Brigitte', 'speed': 0.9,  'power': 1.08, 'hp': 144, 'special': 'masse'},
    'mouleur':        {'name': 'Sacha',    'speed': 0.97, 'power': 1.0,  'hp': 142, 'special': 'sable'},
    'ebarbeuse':      {'name': 'Nina',     'speed': 1.14, 'power': 1.02, 'hp': 136, 'special': 'meuleuse'},
    'lamineur':       {'name': 'Yanis',    'speed': 0.9,  'power': 1.12, 'hp': 150, 'special': 'laminage'},
    'chaudronniere':  {'name': 'Léa',      'speed': 1.1,  'power': 1.04, 'hp': 138, 'special': 'rivet'},
}

# s/a/r : images de démarrage / actives / récupération ; reach : portée ; lvl : high, mid, low, throw
# track : le coup suit un adversaire qui fait un pas de côté ; anim/limb : pour l'affichage
def mv(s, a, r, dmg, reach, lvl, hs=12, bs=8, push=8, anim='jab', limb='L', **kw):
    return dict(s=s, a=a, r=r, dmg=dmg, reach=reach, lvl=lvl, hs=hs, bs=bs, push=push, anim=anim, limb=limb, **kw)

MOVES = {
    '1':   mv(4, 2, 6, 7, 95, 'high', hs=10, bs=6, push=6, anim='jab', limb='L', chain='12'),
    '2':   mv(5, 2, 8, 10, 100, 'high', hs=12, bs=7, push=8, anim='jab', limb='R'),
    '12':  mv(5, 2, 9, 11, 105, 'high', hs=14, bs=8, push=10, anim='jab', limb='R'),
    '3':   mv(7, 3, 10, 13, 115, 'mid', hs=14, bs=9, push=10, anim='kick', limb='L'),
    '4':   mv(8, 3, 12, 16, 125, 'high', hs=16, bs=10, push=12, anim='kick', limb='R'),
    'd1':  mv(4, 2, 7, 6, 90, 'low', hs=9, bs=6, push=5, anim='low', limb='L'),
    'd3':  mv(6, 3, 12, 9, 110, 'low', hs=12, bs=8, push=8, anim='low', limb='L'),
    'd4':  mv(9, 3, 16, 13, 120, 'low', hs=0, bs=10, push=10, anim='low', limb='R', kd=True),
    'df2': mv(8, 3, 18, 15, 95, 'mid', hs=0, bs=12, push=4, anim='upper', limb='R', launch=True),
    'f3':  mv(9, 3, 14, 14, 120, 'mid', hs=16, bs=10, push=22, anim='kick', limb='L'),
    'f4':  mv(11, 3, 16, 19, 130, 'high', hs=0, bs=11, push=12, anim='kick', limb='R', kd=True, track=True),
    'j3':  mv(5, 6, 6, 12, 110, 'mid', hs=14, bs=9, push=8, anim='air', limb='L'),
    'throw': mv(4, 2, 18, 30, 72, 'throw', anim='coulee', limb='R'),
    # coups spéciaux (arrière + 2)
    'coulee':   mv(14, 4, 18, 20, 165, 'mid', hs=0, bs=14, push=14, anim='coulee', limb='R', kd=True),
    'masse':    mv(16, 4, 22, 24, 150, 'mid', hs=0, bs=16, push=16, anim='masse', limb='R', kd=True),
    'sable':    mv(9, 5, 18, 12, 180, 'high', hs=30, bs=12, push=26, anim='sable', limb='R', track=True),
    'meuleuse': mv(5, 12, 14, 5, 95, 'mid', hs=10, bs=6, push=3, anim='meuleuse', limb='R', dash=13, multi=4),
    'laminage': mv(6, 2, 20, 38, 80, 'throw', anim='coulee', limb='R', nobreak=True),
    'rivet':    mv(7, 9, 14, 6, 125, 'mid', hs=10, bs=6, push=4, anim='kick', limb='R', multi=3),
}
FREE = ('idle', 'walk', 'crouch')


def unit(x, z):
    d = math.hypot(x, z) or 1.0
    return x / d, z / d


class Fighter:
    def __init__(self, name, bot, char):
        c = CHARS[char]
        self.name, self.bot, self.char = name, bot, char
        self.maxhp, self.speed, self.power = c['hp'], c['speed'], c['power']
        self.wins = 0

    def reset(self, x, z):
        self.x, self.z, self.y, self.vy = x, z, 0.0, 0.0
        self.vx = self.vz = 0.0
        self.yaw = 0.0
        self.hp = float(self.maxhp)
        self.state, self.t = 'idle', 0
        self.move, self.mv, self.frame = None, None, 0
        self.hit_done, self.hits, self.last_hit = False, 0, -99
        self.crouch = False
        self.juggle = 0
        self.combo = 0
        self.chain_ok = False
        self.ss_dir = 0
        self.u_at = self.d_at = -99
        self.last_f = self.last_b = -99
        self.thrown_by = None
        self.tech_window = 0
        self.dir = (1.0, 0.0)
        self.air_used = False
        self.buf, self.buf_at = 0, -1   # boutons en attente (1 image) pour reconnaître les appuis simultanés

    def start(self, move, frame):
        self.state, self.move, self.mv, self.frame = 'attack', move, MOVES[move], 0
        self.hit_done, self.hits, self.last_hit = False, 0, -99
        self.vx = self.vz = 0.0

    def height(self):
        return CROUCH_H if self.crouch else STAND_H


class Tournament:
    kind = 'tekken'
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
        self.inputs, self.prev, self.press = [0, 0], [0, 0], [0, 0]
        self.ai_mask, self.ai_t, self.ai_seen = [0, 0], [0, 0], [None, None]
        self.frame = 0
        self.round = 1
        self.events: list[dict] = []
        self.eid = 0
        self.acc = 0.0
        self.finished: list[int] | None = None
        self.dirty = True
        self.place()

    # ---------------- manches ----------------
    def place(self):
        self.f[0].reset(-150, 0)
        self.f[1].reset(150, 0)
        self.phase, self.pt = 'intro', int(2.2 * FPS)
        self.timer = ROUND_TIME * FPS
        final = all(f.wins == ROUNDS_TO_WIN - 1 for f in self.f)
        self.banner = 'MANCHE FINALE' if final else f'MANCHE {self.round}'

    def end_round(self):
        a, b = self.f
        winner = a if a.hp > b.hp else b if b.hp > a.hp else None
        ko = a.hp <= 0 or b.hp <= 0
        for f in self.f:
            if f is winner:
                f.wins += 1
                if f.state in FREE:
                    f.state = 'win'
        self.banner = ('K.O. !' if ko else 'TEMPS ÉCOULÉ') if winner else 'ÉGALITÉ'
        self.event('ko' if ko else 'time', 0, 120, 0)
        self.phase, self.pt = 'ko', int(2.8 * FPS)

    def next_round(self):
        a, b = self.f
        if a.wins >= ROUNDS_TO_WIN or b.wins >= ROUNDS_TO_WIN or self.round >= MAX_ROUNDS:
            self.finished = sorted(range(2), key=lambda i: (self.f[i].wins, self.f[i].hp), reverse=True)
            self.phase = 'over'
            self.banner = f"{self.f[self.finished[0]].name} GAGNE !"
            return
        self.round += 1
        self.place()

    def event(self, kind, x, y, z, big=False):
        self.eid += 1
        self.events.append({'id': self.eid, 'k': kind, 'x': round(x), 'y': round(y), 'z': round(z), 'big': big})
        self.events = self.events[-12:]

    # ---------------- entrées ----------------
    def handle(self, seat, data):
        if data.get('a') != 'input' or seat > 1:
            return
        try:
            m = int(data.get('k', 0)) & 255
        except (TypeError, ValueError):
            return
        self.press[seat] |= m & ~self.inputs[seat]
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

    def step(self, connected):
        if self.phase == 'over':
            return
        self.frame += 1
        for i, f in enumerate(self.f):
            if f.bot or not connected(i):
                self.ai(i)
        if self.phase == 'intro':
            self.pt -= 1
            if self.pt == int(0.8 * FPS):
                self.banner = 'COMBATTEZ !'
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
            self.update(i, active)
        self.separate()
        if active:
            for i in (0, 1):
                self.check_hit(i)
        for i in (0, 1):
            if self.f[1 - i].state not in ('hit', 'air', 'down'):
                self.f[i].combo = 0
        self.prev = list(self.inputs)
        self.press = [0, 0]
        if active and (self.f[0].hp <= 0 or self.f[1].hp <= 0 or self.timer <= 0):
            self.end_round()

    def update(self, i, active):
        f, o = self.f[i], self.f[1 - i]
        m = self.inputs[i] if active else 0
        pr = self.press[i] if active else 0
        rel = (o.x - f.x, o.z - f.z)
        ax, az = unit(*rel)
        # physique verticale
        if f.y > 0 or f.vy > 0:
            f.vy -= GRAVITY
            f.y += f.vy
            if f.y <= 0:
                f.y, f.vy = 0.0, 0.0
                if f.state == 'air':
                    f.state, f.t = 'down', 22
                    self.event('land', f.x, 10, f.z)
        f.x += f.vx
        f.z += f.vz
        r = math.hypot(f.x, f.z)
        if r > ARENA_R:
            f.x, f.z = f.x / r * ARENA_R, f.z / r * ARENA_R
        st = f.state
        if st in ('hit', 'blockstun'):
            f.t -= 1
            f.vx *= 0.78; f.vz *= 0.78
            if f.t <= 0:
                f.state = 'crouch' if f.crouch else 'idle'
            return
        if st == 'air':
            f.vx *= 0.96; f.vz *= 0.96
            return
        if st == 'down':
            f.vx *= 0.8; f.vz *= 0.8
            f.t -= 1
            if f.t <= 0 and f.hp > 0:
                f.state, f.t, f.juggle = 'getup', 12, 0
            return
        if st == 'getup':
            f.t -= 1
            if f.t <= 0:
                f.state = 'idle'
            return
        if st == 'thrown':
            f.t -= 1
            if f.tech_window > 0:
                f.tech_window -= 1
                if pr & (B1 | B2):          # dégagement de projection
                    thr = self.f[1 - i]
                    f.state, thr.state = 'idle', 'idle'
                    f.vx, f.vz = -ax * 9, -az * 9
                    thr.vx, thr.vz = ax * 9, az * 9
                    self.event('break', (f.x + o.x) / 2, 120, (f.z + o.z) / 2)
                    return
            if f.t <= 0:
                dmg = f.thrown_dmg
                f.hp = max(0.0, f.hp - dmg)
                f.state, f.vy, f.y, f.t = 'air', 10.0, 1.0, 0
                f.vx, f.vz = -ax * 6, -az * 6
                self.event('hit', f.x, 60, f.z, big=True)
            return
        if st in ('ko', 'win'):
            f.vx *= 0.8; f.vz *= 0.8
            return
        if st == 'ss':
            f.t -= 1
            px, pz = -az * f.ss_dir, ax * f.ss_dir
            f.x += px * 11; f.z += pz * 11
            f.dir = (ax, az)
            if f.t <= 0:
                f.state = 'idle'
            return
        if st == 'dash':
            f.t -= 1
            if f.t <= 0:
                f.state, f.vx, f.vz = 'idle', 0.0, 0.0
            return
        if st == 'attack':
            f.frame += 1
            mvd = f.mv
            if mvd.get('track') and f.frame <= mvd['s']:
                f.dir = (ax, az)
            if mvd.get('dash') and f.frame < mvd['s'] + mvd['a']:
                sp = mvd['dash'] if f.frame >= mvd['s'] else 0
                f.vx, f.vz = f.dir[0] * sp, f.dir[1] * sp
            elif f.y <= 0:
                f.vx *= 0.6; f.vz *= 0.6
            # enchaînement 1,2
            if f.move == '1' and pr & B2 and f.frame >= 2:
                f.start('12', self.frame)
                return
            if f.move == 'j3' and f.y <= 0 and f.frame > 2:
                f.state = 'idle'
            elif f.frame >= mvd['s'] + mvd['a'] + mvd['r']:
                f.state = 'idle' if f.y <= 0 else 'jump'
                f.crouch = f.state == 'idle' and bool(m & D)
            return

        # ---- états libres ----
        if f.y > 0:
            f.state = 'jump'
            if pr & BUTTONS and not f.air_used:
                f.air_used = True
                f.start('j3', self.frame)
                f.dir = (ax, az)
            return
        f.dir = (ax, az)
        f.air_used = False
        down = bool(m & D)
        # appuis ↑ / ↓ : un appui bref = pas de côté, maintenu = saut / accroupi
        if pr & U:
            f.u_at = self.frame
        if pr & D:
            f.d_at = self.frame
        released_u = (self.prev[i] & U) and not (m & U)
        released_d = (self.prev[i] & D) and not (m & D)
        if released_u and self.frame - f.u_at <= 5 and not f.crouch:
            f.state, f.t, f.ss_dir = 'ss', 9, -1
            return
        if released_d and self.frame - f.d_at <= 4:
            f.crouch = False
            f.state, f.t, f.ss_dir = 'ss', 9, 1
            return
        if m & U and self.frame - f.u_at == 5:
            f.vy, f.y = 24.0, 0.01
            d = 1 if m & F else -1 if m & B else 0
            f.vx, f.vz = ax * d * 6 * f.speed, az * d * 6 * f.speed
            f.state, f.mv, f.move = 'jump', None, None
            return
        # double appui avant / arrière = dash
        if pr & F:
            if self.frame - f.last_f <= 8:
                f.state, f.t = 'dash', 9
                f.vx, f.vz = ax * 14 * f.speed, az * 14 * f.speed
                f.last_f = -99
                return
            f.last_f = self.frame
        if pr & B:
            if self.frame - f.last_b <= 8:
                f.state, f.t = 'dash', 8
                f.vx, f.vz = -ax * 12, -az * 12
                f.last_b = -99
                return
            f.last_b = self.frame
        # attaques (un appui attend une image pour laisser arriver un second bouton : projections 1+3 / 2+4)
        if pr & BUTTONS:
            f.buf |= pr & BUTTONS
            if f.buf_at < 0:
                f.buf_at = self.frame
        btn = 0
        if f.buf and self.frame - f.buf_at >= 1:
            btn, f.buf, f.buf_at = f.buf, 0, -1
        elif f.buf:
            return
        if btn:
            special = CHARS[f.char]['special']
            chord = btn | (m & BUTTONS)
            if (chord & (B1 | B3)) == (B1 | B3) or (chord & (B2 | B4)) == (B2 | B4):
                f.start('laminage' if special == 'laminage' and m & F else 'throw', self.frame)
            elif btn & B2 and m & B and not down:
                f.start(special, self.frame)
            elif btn & B2 and down and m & F:
                f.start('df2', self.frame)
            elif down:
                f.start('d1' if btn & (B1 | B2) else 'd4' if btn & B4 else 'd3', self.frame)
            elif btn & B3 and m & F:
                f.start('f3', self.frame)
            elif btn & B4 and m & F:
                f.start('f4', self.frame)
            else:
                f.start('1' if btn & B1 else '2' if btn & B2 else '3' if btn & B3 else '4', self.frame)
            f.crouch = f.move in ('d1', 'd3', 'd4')
            return
        f.crouch = down
        if down:
            f.state, f.vx, f.vz = 'crouch', 0.0, 0.0
        elif m & F:
            f.state = 'walk'
            f.vx, f.vz = ax * WALK_F * f.speed, az * WALK_F * f.speed
        elif m & B:
            f.state = 'walk'
            f.vx, f.vz = -ax * WALK_B * f.speed, -az * WALK_B * f.speed
        else:
            f.state, f.vx, f.vz = 'idle', 0.0, 0.0

    def separate(self):
        a, b = self.f
        dx, dz = b.x - a.x, b.z - a.z
        d = math.hypot(dx, dz)
        if d < MIN_DIST and abs(a.y - b.y) < 120:
            ux, uz = unit(dx, dz) if d > 0.01 else (1.0, 0.0)
            push = (MIN_DIST - d) / 2
            a.x -= ux * push; a.z -= uz * push
            b.x += ux * push; b.z += uz * push

    def blocking(self, d, lvl):
        """Le défenseur bloque-t-il ? Debout et sans avancer : hauts et moyens. Accroupi : les bas."""
        if d.y > 0 or d.state not in FREE + ('blockstun',):
            return False
        m = self.inputs[self.f.index(d)]
        if m & F and d.state == 'walk':
            return False
        if lvl == 'low':
            return d.crouch
        return not d.crouch

    def check_hit(self, i):
        a, d = self.f[i], self.f[1 - i]
        if a.state != 'attack':
            return
        mvd = a.mv
        if not (mvd['s'] <= a.frame < mvd['s'] + mvd['a']):
            return
        if mvd.get('multi'):
            if a.hits >= mvd['multi'] or a.frame - a.last_hit < 3:
                return
        elif a.hit_done:
            return
        if d.state in ('down', 'getup', 'ko', 'thrown'):
            return
        rx, rz = d.x - a.x, d.z - a.z
        along = rx * a.dir[0] + rz * a.dir[1]
        lateral = abs(rx * a.dir[1] - rz * a.dir[0])
        if along < 0 or along > mvd['reach'] + 34 or lateral > (140 if mvd.get('track') else 40):
            return
        lvl = mvd['lvl']
        hx, hz = a.x + a.dir[0] * min(along, mvd['reach']), a.z + a.dir[1] * min(along, mvd['reach'])
        if lvl == 'throw':
            a.hit_done = True
            if d.state not in FREE or d.y > 0:
                return
            d.state, d.t = 'thrown', 16
            d.tech_window = 0 if mvd.get('nobreak') else 8
            d.thrown_dmg = mvd['dmg'] * a.power
            d.thrown_by = i
            d.vx = d.vz = 0.0
            self.event('grab', hx, 120, hz)
            return
        if lvl == 'high' and d.crouch and d.y <= 0 and d.state != 'air':
            return  # le coup haut passe au-dessus d'un adversaire accroupi
        a.hit_done, a.last_hit = True, a.frame
        a.hits += 1
        hy = {'high': 150, 'mid': 105, 'low': 25}[lvl]
        if d.state != 'air' and self.blocking(d, lvl):
            d.state, d.t = 'blockstun', mvd['bs']
            d.vx, d.vz = a.dir[0] * mvd['push'] * 0.6, a.dir[1] * mvd['push'] * 0.6
            self.event('block', hx, hy, hz)
            return
        juggling = d.state == 'air'
        a.combo = a.combo + 1 if d.state in ('hit', 'air') else 1
        dmg = mvd['dmg'] * a.power * max(0.4, 1 - 0.1 * (a.combo - 1)) * (0.7 if juggling else 1)
        d.hp = max(0.0, d.hp - dmg)
        if juggling:
            d.juggle += 1
            d.vy = max(d.vy, 9.0 if d.juggle < 5 else 0.0)
            d.vx, d.vz = a.dir[0] * 4, a.dir[1] * 4
        elif mvd.get('launch'):
            d.state, d.vy, d.y = 'air', 24.0, 1.0
            d.vx, d.vz = a.dir[0] * 3, a.dir[1] * 3
        elif mvd.get('kd') or d.hp <= 0 or d.y > 0:
            d.state, d.vy, d.y = 'air', 9.0, 1.0
            d.vx, d.vz = a.dir[0] * 8, a.dir[1] * 8
        else:
            d.state, d.t = 'hit', mvd['hs']
            d.vx, d.vz = a.dir[0] * mvd['push'], a.dir[1] * mvd['push']
        self.event('hit', hx, hy if not juggling else d.y + 60, hz, big=dmg >= 14)

    # ---------------- robot ----------------
    def ai(self, i):
        f, o = self.f[i], self.f[1 - i]
        dist = math.hypot(o.x - f.x, o.z - f.z)
        mask = self.ai_mask[i]
        self.ai_t[i] -= 1
        threat = o.state == 'attack' and o.frame < o.mv['s'] + o.mv['a'] and dist < o.mv['reach'] + 60
        key = (id(o.mv), self.frame // 20) if threat else None
        if threat and self.ai_seen[i] != key and f.state in FREE:
            self.ai_seen[i] = key
            r = random.random()
            if r < 0.5:
                mask = D if o.mv['lvl'] == 'low' else 0          # garde (neutre = garde debout)
                self.ai_t[i] = 10
            elif r < 0.62 and not o.mv.get('track'):
                mask = U                                           # pas de côté (appui bref)
                self.ai_t[i] = 2
        elif self.ai_t[i] <= 0:
            r = random.random()
            special = CHARS[f.char]['special']
            if dist > 230:
                mask = F if r < 0.85 else F | U
            elif dist > 140:
                mask = (F if r < 0.4 else F | B4 if r < 0.52 else F | B3 if r < 0.62 else B | B2 if r < 0.7 else B)
            else:
                mask = (B1 if r < 0.18 else B2 if r < 0.3 else B3 if r < 0.42 else B4 if r < 0.5 else D | B3 if r < 0.6
                        else D | F | B2 if r < 0.68 else B1 | B3 if r < 0.74 else B | B2 if r < 0.8 else D if r < 0.88 else B)
            self.ai_t[i] = random.randint(5, 12)
        self.ai_mask[i] = mask
        self.press[i] |= mask & ~self.inputs[i]
        self.inputs[i] = mask

    # ---------------- état envoyé ----------------
    def completed(self, seat):
        return True

    def view(self):
        out = []
        for f in self.f:
            ph, pp = 0, 0.0
            anim = None
            if f.state == 'attack':
                m = f.mv
                anim = m['anim']
                if f.frame < m['s']:
                    ph, pp = 0, f.frame / m['s']
                elif f.frame < m['s'] + m['a']:
                    ph, pp = 1, (f.frame - m['s']) / m['a']
                else:
                    ph, pp = 2, (f.frame - m['s'] - m['a']) / m['r']
            out.append({'x': round(f.x, 1), 'z': round(f.z, 1), 'y': round(f.y, 1), 'dx': round(f.dir[0], 3), 'dz': round(f.dir[1], 3),
                        'st': f.state, 'mv': f.move, 'an': anim, 'lb': f.mv['limb'] if f.mv and f.state == 'attack' else 'L',
                        'ph': ph, 'pp': round(pp, 3), 'hp': round(f.hp, 1), 'max': f.maxhp, 'ch': f.char, 'n': f.name,
                        'w': f.wins, 'cb': f.combo, 'cr': f.crouch, 'ss': f.ss_dir if f.state == 'ss' else 0})
        return {'phase': self.phase, 'round': self.round, 'timer': math.ceil(max(0, self.timer) / FPS),
                'banner': self.banner, 'f': out, 'ev': self.events[-8:], 'finished': self.finished, 'toWin': ROUNDS_TO_WIN}
