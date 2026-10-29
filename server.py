"""Arcade 101 — serveur des mini-jeux de la 101e promotion de l'ESFF.

Sert le site, distribue les tickets à gratter, tire les codes promo au sort et héberge
les salons en ligne (Forgeopoly, Grand Prix). Lancement : python server.py
"""
from __future__ import annotations
import asyncio
import json
import os
import random
import re
import secrets
import sqlite3
import string
import time
from datetime import date
from pathlib import Path

from aiohttp import web, WSMsgType

from fighter import Fight
from forgeopoly import Forgeopoly
from planes import Dogfight
from kart import Kart
from atelier import Atelier
from tekken import Tournament
from royale import Royale
from quiz_data import QUESTIONS

BASE = Path(__file__).resolve().parent
PUBLIC = BASE / 'public'

# ---------------- Réglages (modifiables par variables d'environnement) ----------------
# Code -10 % créé dans la boutique : jamais dans le code (dépôt public).
# Il vient de la variable ESFF_PROMO_CODE (hébergeur) ou du fichier local promo_code.txt (non publié).
_PROMO_FILE = BASE / 'promo_code.txt'
PROMO_CODE = (os.environ.get('ESFF_PROMO_CODE') or (_PROMO_FILE.read_text(encoding='utf-8').strip() if _PROMO_FILE.exists() else '')
              or 'CODE-A-CONFIGURER')
WIN_RATE = float(os.environ.get('ESFF_WIN_RATE', '0.20'))  # 1 ticket sur 5 gagnant
DB_PATH = Path(os.environ.get('ESFF_DB', BASE / 'arcade.db'))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
PORT = int(os.environ.get('PORT', '8090'))

# Tickets gagnables par jour, par joueur et par jeu
DAILY = {'coulee': 1, 'moulage': 1, 'enclume': 1, 'teintes': 1, 'poche': 1, 'quiz': 1, 'galaxie': 1, 'usine': 1,
         'royale': 2, 'tekken': 2, 'fighter': 2, 'planes': 2, 'forgeopoly': 2, 'course': 2, 'atelier': 2}
# Score minimum pour gagner un ticket dans les jeux solo
SOLO_THRESHOLDS = {'coulee': 350, 'moulage': 2100, 'enclume': 250, 'teintes': 350, 'poche': 400, 'galaxie': 20000, 'usine': 0}
USINE_MONTHS = 60          # Usine 101 : 5 ans de gestion sans faillite = 1 ticket
QUIZ_LEN = 10
QUIZ_PASS = 7
IP_DAILY_CAP = 25

GAME_TYPES = {'royale': Royale, 'tekken': Tournament, 'fighter': Fight, 'planes': Dogfight, 'forgeopoly': Forgeopoly, 'course': Kart, 'atelier': Atelier}
SOLO_GAMES = ['galaxie', 'usine', 'moulage', 'coulee', 'enclume', 'teintes', 'poche', 'quiz']
ROOMS: dict[str, 'Room'] = {}
TOKEN_RE = re.compile(r'^[A-Za-z0-9_-]{16,40}$')


# ---------------- Base de données ----------------
def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    with db() as con:
        con.executescript('''
            create table if not exists players(id text primary key, created real);
            create table if not exists tickets(
                id integer primary key autoincrement, player text, source text, day text, ip text,
                earned real, scratched real, win integer);
            create index if not exists tickets_player on tickets(player);
            create table if not exists scores(player text, game text, score integer, ts real);
            create index if not exists scores_game on scores(game);
            create table if not exists wins(player text, game text, n integer, primary key(player, game));
        ''')
        cols = [r[1] for r in con.execute('pragma table_info(players)')]
        if 'name' not in cols:
            con.execute('alter table players add column name text')


def client_ip(request):
    fwd = request.headers.get('X-Forwarded-For', '')
    return fwd.split(',')[0].strip() if fwd else (request.remote or '')


def ensure_player(token):
    """Renvoie un identifiant joueur valide, en crée un si besoin."""
    with db() as con:
        if token and TOKEN_RE.match(token) and con.execute('select 1 from players where id=?', (token,)).fetchone():
            return token
        token = secrets.token_urlsafe(18)
        con.execute('insert into players(id, created) values(?, ?)', (token, time.time()))
        return token


def known_player(token):
    if not token or not TOKEN_RE.match(token):
        return False
    with db() as con:
        return con.execute('select 1 from players where id=?', (token,)).fetchone() is not None


def grant(player, source, ip):
    today = date.today().isoformat()
    with db() as con:
        n = con.execute('select count(*) from tickets where player=? and source=? and day=?', (player, source, today)).fetchone()[0]
        if n >= DAILY.get(source, 1):
            return False, "Tu as déjà gagné tous les tickets du jour sur ce jeu. Reviens demain !"
        if ip and con.execute('select count(*) from tickets where ip=? and day=?', (ip, today)).fetchone()[0] >= IP_DAILY_CAP:
            return False, "Limite de tickets du jour atteinte."
        con.execute('insert into tickets(player, source, day, ip, earned) values(?,?,?,?,?)', (player, source, today, ip, time.time()))
    return True, "Ticket à gratter gagné !"


def status(player):
    today = date.today().isoformat()
    with db() as con:
        pending = con.execute('select count(*) from tickets where player=? and scratched is null', (player,)).fetchone()[0]
        wins = con.execute('select count(*) from tickets where player=? and win=1', (player,)).fetchone()[0]
        scratched = con.execute('select count(*) from tickets where player=? and scratched is not null', (player,)).fetchone()[0]
        rows = con.execute('select source, count(*) n from tickets where player=? and day=? group by source', (player, today)).fetchall()
    used = {r['source']: r['n'] for r in rows}
    with db() as con:
        row = con.execute('select name from players where id=?', (player,)).fetchone()
    return {
        'player': player, 'name': row['name'] if row else None, 'tickets': pending, 'scratched': scratched,
        'codes': [PROMO_CODE] if wins else [], 'wins': wins,
        'left': {k: max(0, v - used.get(k, 0)) for k, v in DAILY.items()},
        'thresholds': SOLO_THRESHOLDS, 'quizPass': QUIZ_PASS, 'winRate': WIN_RATE,
    }


def clean_name(raw):
    return re.sub(r'[^\w \-.éèêàçùôîÉÈ]', '', str(raw or ''))[:16].strip()


def record_score(player, game, score):
    with db() as con:
        con.execute('insert into scores(player, game, score, ts) values(?,?,?,?)', (player, game, max(0, min(score, 100000)), time.time()))


def record_win(player, game):
    with db() as con:
        con.execute('insert into wins(player, game, n) values(?,?,1) on conflict(player, game) do update set n = n + 1', (player, game))


# ---------------- API ----------------
async def read_json(request):
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


async def api_hello(request):
    data = await read_json(request)
    return web.json_response(status(ensure_player(data.get('player'))))


async def api_score(request):
    data = await read_json(request)
    player, game = data.get('player'), data.get('game')
    if not known_player(player) or game not in SOLO_THRESHOLDS:
        return web.json_response({'error': 'Requête invalide'}, status=400)
    try:
        score = int(data.get('score', 0))
    except (TypeError, ValueError):
        score = 0
    record_score(player, game, score)
    need = SOLO_THRESHOLDS[game]
    if game == 'usine':  # Usine 101 : le ticket se gagne à la durée de survie, le score sert au classement
        try:
            months = int(data.get('months', 0))
        except (TypeError, ValueError):
            months = 0
        if months < USINE_MONTHS:
            ok, msg = False, f"Tiens {USINE_MONTHS // 12} ans sans faillite pour gagner un ticket à gratter."
        else:
            ok, msg = grant(player, game, client_ip(request))
    elif score < need:
        ok, msg = False, f"Atteins {need} points pour gagner un ticket à gratter."
    else:
        ok, msg = grant(player, game, client_ip(request))
    return web.json_response({'ticket': ok, 'message': msg, **status(player)})


async def api_name(request):
    data = await read_json(request)
    player, name = data.get('player'), clean_name(data.get('name'))
    if not known_player(player) or len(name) < 2:
        return web.json_response({'error': 'Pseudo invalide (2 à 16 caractères).'}, status=400)
    with db() as con:
        con.execute('update players set name=? where id=?', (name, player))
    return web.json_response(status(player))


async def api_leaderboard(request):
    out = {}
    with db() as con:
        for g in SOLO_GAMES:
            rows = con.execute("""select coalesce(p.name, 'Anonyme') name, max(s.score) best from scores s
                                  join players p on p.id = s.player where s.game=? group by s.player
                                  order by best desc limit 10""", (g,)).fetchall()
            out[g] = [{'name': r['name'], 'v': r['best']} for r in rows]
        for g in GAME_TYPES:
            rows = con.execute("""select coalesce(p.name, 'Anonyme') name, w.n from wins w
                                  join players p on p.id = w.player where w.game=? order by w.n desc limit 10""", (g,)).fetchall()
            out[g] = [{'name': r['name'], 'v': r['n']} for r in rows]
    return web.json_response(out)


async def api_quiz(request):
    picks = random.sample(range(len(QUESTIONS)), QUIZ_LEN)
    out = []
    for i in picks:
        q, answers = QUESTIONS[i]
        out.append({'id': i, 'q': q, 'choices': random.sample(answers, len(answers))})
    return web.json_response({'questions': out, 'pass': QUIZ_PASS})


async def api_quiz_answer(request):
    data = await read_json(request)
    player = data.get('player')
    answers = data.get('answers')
    if not known_player(player) or not isinstance(answers, list) or len(answers) != QUIZ_LEN:
        return web.json_response({'error': 'Requête invalide'}, status=400)
    seen, correction, good = set(), [], 0
    for a in answers:
        try:
            qid = int(a.get('id'))
        except (AttributeError, TypeError, ValueError):
            return web.json_response({'error': 'Requête invalide'}, status=400)
        if qid in seen or not 0 <= qid < len(QUESTIONS):
            return web.json_response({'error': 'Requête invalide'}, status=400)
        seen.add(qid)
        q, choices = QUESTIONS[qid]
        ok = a.get('choice') == choices[0]
        good += ok
        correction.append({'id': qid, 'q': q, 'ok': ok, 'answer': choices[0], 'given': a.get('choice')})
    record_score(player, 'quiz', good)
    if good >= QUIZ_PASS:
        ticket, msg = grant(player, 'quiz', client_ip(request))
    else:
        ticket, msg = False, f"Il faut {QUIZ_PASS} bonnes réponses sur {QUIZ_LEN} pour gagner un ticket."
    return web.json_response({'score': good, 'correction': correction, 'ticket': ticket, 'message': msg, **status(player)})


async def api_scratch(request):
    data = await read_json(request)
    player = data.get('player')
    if not known_player(player):
        return web.json_response({'error': 'Requête invalide'}, status=400)
    win = random.random() < WIN_RATE
    with db() as con:
        row = con.execute('select id from tickets where player=? and scratched is null order by id limit 1', (player,)).fetchone()
        if not row:
            return web.json_response({'error': "Tu n'as pas de ticket à gratter."}, status=400)
        con.execute('update tickets set scratched=?, win=? where id=?', (time.time(), int(win), row['id']))
    return web.json_response({'win': win, 'code': PROMO_CODE if win else None, **status(player)})


# ---------------- Salons en ligne ----------------
def room_code():
    while True:
        code = ''.join(random.choices('ABCDEFGHJKLMNPQRSTUVWXYZ', k=4))
        if code not in ROOMS:
            return code


BOT_NAMES = ['Robot Cubilot', 'Robot Masselotte', 'Robot Noyau', 'Robot Laminoir', 'Robot Grenaille',
             'Robot Creuset', 'Robot Tuyère', 'Robot Lingot']


class Room:
    def __init__(self, kind, code):
        self.kind = kind
        self.code = code
        self.seats: list[dict] = []   # {'player','name','bot','ws'}
        self.host = None
        self.game = None
        self.created = time.monotonic()
        self.rewarded = False
        self.quick = False          # partie « contre l'ordi » : les robots complètent les places

    @property
    def cls(self): return GAME_TYPES[self.kind]

    def connected(self, i):
        s = self.seats[i]
        return s['ws'] is not None and not s['ws'].closed

    def lobby(self):
        return {'code': self.code, 'kind': self.kind, 'host': self.host, 'max': self.cls.max_seats,
                'started': self.game is not None,
                'seats': [{'name': s['name'], 'bot': s['bot'], 'online': s['bot'] or self.connected(i), 'opt': s.get('opt') or {}}
                          for i, s in enumerate(self.seats)]}

    def seat_of(self, player):
        return next((i for i, s in enumerate(self.seats) if s['player'] == player), None)

    async def send_all(self, msg):
        text = json.dumps(msg)
        for s in self.seats:
            ws = s['ws']
            if ws is not None and not ws.closed:
                try:
                    await ws.send_str(text)
                except ConnectionResetError:
                    pass

    async def push_lobby(self):
        for i, s in enumerate(self.seats):
            if s['ws'] is not None and not s['ws'].closed:
                await s['ws'].send_json({'t': 'room', 'room': self.lobby(), 'seat': i, 'isHost': s['player'] == self.host})

    def add_bot(self):
        used = {s['name'] for s in self.seats}
        name = next((n for n in BOT_NAMES if n not in used), f'Robot {len(self.seats)}')
        self.seats.append({'player': None, 'name': name, 'bot': True, 'ws': None, 'opt': {}})

    async def start(self, fill=True):
        self.quick = fill
        if getattr(self.cls, 'fill_only_quick', False) and not fill:
            # salon entre amis : seulement les joueurs présents et les robots ajoutés par l'hôte
            if len(self.seats) < 2:
                host = self.seats[self.seat_of(self.host)] if self.seat_of(self.host) is not None else None
                if host and host['ws'] is not None and not host['ws'].closed:
                    await host['ws'].send_json({'t': 'error', 'msg': 'Il faut au moins 2 participants : invite tes amis ou ajoute des robots.'})
                return
        else:
            while len(self.seats) < getattr(self.cls, 'min_seats', 2):
                self.add_bot()
        self.rewarded = False
        self.game = self.cls([{'name': s['name'], 'bot': s['bot'], 'opt': s.get('opt') or {}} for s in self.seats])
        await self.push_lobby()
        if hasattr(self.game, 'init_payload'):
            await self.send_all({'t': 'init', **self.game.init_payload()})
        await self.send_all({'t': 'state', 'state': self.game.view()})

    async def reward(self):
        """Distribue les tickets à la fin d'une partie : 1 pour avoir fini, 1 de plus pour le vainqueur."""
        self.rewarded = True
        order = self.game.finished or []
        for place, i in enumerate(order):
            s = self.seats[i]
            if s['bot'] or not s['player'] or not self.connected(i):
                continue
            if not self.game.completed(i):
                await s['ws'].send_json({'t': 'reward', 'ticket': False, 'place': place + 1,
                                         'message': "Pas de ticket : il faut franchir la ligne d'arrivée.", **status(s['player'])})
                continue
            ip = s.get('ip', '')
            ok, msg = grant(s['player'], self.kind, ip)
            coop = getattr(self.game, 'coop', False)      # jeu en équipe : la victoire est collective
            win = getattr(self.game, 'success', False) if coop else place == 0
            if win:
                record_win(s['player'], self.kind)
            if ok and win:
                ok2, _ = grant(s['player'], self.kind, ip)
                if ok2:
                    msg = "Victoire ! 2 tickets à gratter gagnés."
            try:
                await s['ws'].send_json({'t': 'reward', 'ticket': ok, 'message': msg, 'place': place + 1, **status(s['player'])})
            except ConnectionResetError:
                pass


async def ws_handler(request):
    ws = web.WebSocketResponse(heartbeat=25, max_msg_size=8000)
    await ws.prepare(request)
    player = request.query.get('player')
    if not known_player(player):
        await ws.send_json({'t': 'error', 'msg': 'Joueur inconnu, recharge la page.'})
        await ws.close()
        return ws
    ip = client_ip(request)
    room: Room | None = None

    async def leave():
        nonlocal room
        if room is None:
            return
        i = room.seat_of(player)
        if i is not None:
            if room.game is None:
                room.seats.pop(i)
            else:
                room.seats[i]['ws'] = None
        humans = [s for s in room.seats if not s['bot'] and s['ws'] is not None and not s['ws'].closed]
        if not humans:
            ROOMS.pop(room.code, None)
        else:
            if room.host == player:
                room.host = next(s['player'] for s in room.seats if not s['bot'] and s['ws'] is not None and not s['ws'].closed)
            await room.push_lobby()
        room = None

    try:
        async for msg in ws:
            if msg.type != WSMsgType.TEXT:
                continue
            try:
                data = json.loads(msg.data)
            except ValueError:
                continue
            t = data.get('t')
            name = clean_name(data.get('name')) or 'Fondeur'
            opt = data.get('opt') if isinstance(data.get('opt'), dict) else {}
            # options autorisées : personnage (combats, métier) et carte (battle royale, circuit)
            opt = {k: str(opt[k])[:20] for k in ('char', 'map') if opt.get(k)}
            if t in ('create', 'join'):
                await leave()
                if t == 'create':
                    kind = data.get('kind')
                    if kind not in GAME_TYPES:
                        continue
                    room = Room(kind, room_code())
                    ROOMS[room.code] = room
                    room.host = player
                else:
                    r = ROOMS.get(str(data.get('code', '')).upper().strip())
                    if r is None:
                        await ws.send_json({'t': 'error', 'msg': "Salon introuvable. Vérifie le code."})
                        continue
                    if r.game is not None:
                        await ws.send_json({'t': 'error', 'msg': 'La partie a déjà commencé dans ce salon.'})
                        continue
                    if len(r.seats) >= r.cls.max_seats:
                        await ws.send_json({'t': 'error', 'msg': 'Salon complet.'})
                        continue
                    room = r
                if room.seat_of(player) is None:
                    room.seats.append({'player': player, 'name': name, 'bot': False, 'ws': ws, 'ip': ip, 'opt': opt})
                await room.push_lobby()
            elif room is None:
                continue
            elif t == 'opt' and room.game is None:
                i = room.seat_of(player)
                if i is not None:
                    room.seats[i]['opt'] = opt
                    await room.push_lobby()
            elif t == 'leave':
                await leave()
            elif t == 'bot' and player == room.host and room.game is None and len(room.seats) < room.cls.max_seats:
                room.add_bot()
                await room.push_lobby()
            elif t == 'kick' and player == room.host and room.game is None:
                i = data.get('seat')
                if isinstance(i, int) and 0 <= i < len(room.seats) and room.seats[i]['bot']:
                    room.seats.pop(i)
                    await room.push_lobby()
            elif t == 'start' and player == room.host and room.game is None:
                await room.start(bool(data.get('fill')))
            elif t == 'again' and room.game is not None and room.game.finished is not None:
                # revanche : on relance tout de suite dans le même salon, avec les mêmes réglages
                if room.seat_of(player) is not None:
                    room.seats = [s for i, s in enumerate(room.seats) if s['bot'] or room.connected(i)]
                    if room.seat_of(room.host) is None:
                        room.host = player
                    room.game = None
                    await room.start(room.quick)
            elif t == 'act' and room.game is not None:
                i = room.seat_of(player)
                if i is not None:
                    room.game.handle(i, data)
    finally:
        await leave()
    return ws


async def ticker(app):
    last = time.monotonic()
    frame = 0
    while True:
        await asyncio.sleep(1 / 30)
        frame += 1
        now = time.monotonic()
        dt, last = now - last, now
        for room in list(ROOMS.values()):
            g = room.game
            if g is None:
                continue
            try:
                g.tick(dt, room.connected)
                every = getattr(g, 'send_every', 1)
                stream = (getattr(g, 'stream', False) and frame % every == 0) or (g.kind == 'course' and frame % 2 == 0)
                if stream or g.dirty:
                    g.dirty = False
                    await room.send_all({'t': 'state', 'state': g.view()})
                if g.finished is not None and not room.rewarded:
                    await room.reward()
            except Exception as exc:  # un salon défaillant ne doit pas bloquer les autres
                print('Erreur salon', room.code, exc)


async def on_start(app): app['ticker'] = asyncio.create_task(ticker(app))


async def on_cleanup(app):
    app['ticker'].cancel()


async def index(request): return web.FileResponse(PUBLIC / 'index.html')


async def health(request): return web.json_response({'ok': True, 'rooms': len(ROOMS)})


async def no_cache(request, response):
    # le site évolue souvent : on force le navigateur à revalider les fichiers
    response.headers['Cache-Control'] = 'no-cache'


def build_app():
    init_db()
    app = web.Application()
    app.router.add_get('/', index)
    app.router.add_get('/health', health)
    app.router.add_post('/api/hello', api_hello)
    app.router.add_post('/api/score', api_score)
    app.router.add_post('/api/name', api_name)
    app.router.add_get('/api/leaderboard', api_leaderboard)
    app.router.add_get('/api/quiz', api_quiz)
    app.router.add_post('/api/quiz', api_quiz_answer)
    app.router.add_post('/api/scratch', api_scratch)
    app.router.add_get('/ws', ws_handler)
    app.router.add_static('/', PUBLIC)
    app.on_response_prepare.append(no_cache)
    app.on_startup.append(on_start)
    app.on_cleanup.append(on_cleanup)
    return app


if __name__ == '__main__':
    print(f'Arcade 101 sur http://localhost:{PORT}  (code promo distribué : {PROMO_CODE}, gain {int(WIN_RATE * 100)} %)')
    web.run_app(build_app(), port=PORT, print=None)
