"""Forgeopoly : les règles complètes du jeu de plateau « monopole » (2 à 4 joueurs), sur le thème de la fonderie.

Plateau de 40 cases, 8 groupes de couleur, navettes (gares), réseaux (compagnies), cartes Coulée surprise (Chance)
et Caisse de la promo (Caisse de communauté), doubles, prison, maisons et hôtels, hypothèques, enchères, faillite.
Les prix et loyers suivent la mécanique du jeu classique ; les noms et l'univers sont ceux de l'ESFF.
Le serveur publie aussi une file d'animations (dés, déplacements, cartes, argent) que les navigateurs rejouent."""
from __future__ import annotations
import random
import time

START_CASH = 1500
GO_SALARY = 200
JAIL = 10
JAIL_FINE = 50
MAX_ROUNDS = 30          # au-delà, le plus riche gagne (parties d'arcade)
TURN_TIMEOUT = 35
AUCTION_TIME = 7.0
HOUSES_TOTAL, HOTELS_TOTAL = 32, 12

GROUPS = {
    'brun':   {'color': '#8B5A2B', 'house': 50},
    'ciel':   {'color': '#9ED4F0', 'house': 50},
    'rose':   {'color': '#D9488F', 'house': 100},
    'orange': {'color': '#EC641E', 'house': 100},
    'rouge':  {'color': '#BA2C3A', 'house': 150},
    'jaune':  {'color': '#F5B700', 'house': 150},
    'vert':   {'color': '#2E9E5B', 'house': 200},
    'bleu':   {'color': '#2B4FA8', 'house': 200},
}


def P(name, group, price, rents):
    return {'type': 'prop', 'name': name, 'group': group, 'color': GROUPS[group]['color'], 'price': price,
            'rents': rents, 'house': GROUPS[group]['house']}


def ST(name):
    return {'type': 'station', 'name': name, 'price': 200}


def UT(name):
    return {'type': 'utility', 'name': name, 'price': 150}


BOARD = [
    {'type': 'go', 'name': 'Départ'},
    P('Sablerie', 'brun', 60, [2, 10, 30, 90, 160, 250]),
    {'type': 'cc', 'name': 'Caisse de la promo'},
    P('Noyauterie', 'brun', 60, [4, 20, 60, 180, 320, 450]),
    {'type': 'tax', 'name': 'Cotisation BDE', 'amount': 200},
    ST('Navette Gare de Châlons'),
    P('Atelier modèles', 'ciel', 100, [6, 30, 90, 270, 400, 550]),
    {'type': 'chance', 'name': 'Coulée surprise'},
    P('Moulage main', 'ciel', 100, [6, 30, 90, 270, 400, 550]),
    P('Moulage machine', 'ciel', 120, [8, 40, 100, 300, 450, 600]),
    {'type': 'jail', 'name': 'Retouche (simple visite)'},
    P('Décochage', 'rose', 140, [10, 50, 150, 450, 625, 750]),
    UT('Réseau électrique'),
    P('Ébarbage', 'rose', 140, [10, 50, 150, 450, 625, 750]),
    P('Grenaillage', 'rose', 160, [12, 60, 180, 500, 700, 900]),
    ST('Navette de Reims'),
    P('Four à arc', 'orange', 180, [14, 70, 200, 550, 750, 950]),
    {'type': 'cc', 'name': 'Caisse de la promo'},
    P('Cubilot', 'orange', 180, [14, 70, 200, 550, 750, 950]),
    P('Four à induction', 'orange', 200, [16, 80, 220, 600, 800, 1000]),
    {'type': 'free', 'name': 'Pause café'},
    P('Forge libre', 'rouge', 220, [18, 90, 250, 700, 875, 1050]),
    {'type': 'chance', 'name': 'Coulée surprise'},
    P('Estampage', 'rouge', 220, [18, 90, 250, 700, 875, 1050]),
    P('Matriçage', 'rouge', 240, [20, 100, 300, 750, 925, 1100]),
    ST('Navette Paris-Est'),
    P('Traitement thermique', 'jaune', 260, [22, 110, 330, 800, 975, 1150]),
    P('Usinage', 'jaune', 260, [22, 110, 330, 800, 975, 1150]),
    UT('Réseau de gaz'),
    P('Contrôle qualité', 'jaune', 280, [24, 120, 360, 850, 1025, 1200]),
    {'type': 'gojail', 'name': 'Direction retouche'},
    P('Labo métallo', 'vert', 300, [26, 130, 390, 900, 1100, 1275]),
    P('Bureau d\'études', 'vert', 300, [26, 130, 390, 900, 1100, 1275]),
    {'type': 'cc', 'name': 'Caisse de la promo'},
    P('Halle d\'essais', 'vert', 320, [28, 150, 450, 1000, 1200, 1400]),
    ST('Navette de Charleville'),
    {'type': 'chance', 'name': 'Coulée surprise'},
    P('Grand amphi de la 101', 'bleu', 350, [35, 175, 500, 1100, 1300, 1500]),
    {'type': 'tax', 'name': 'Casse d\'outillage', 'amount': 100},
    P('Direction de l\'ESFF', 'bleu', 400, [50, 200, 600, 1400, 1700, 2000]),
]
STATIONS = [i for i, s in enumerate(BOARD) if s['type'] == 'station']
UTILITIES = [i for i, s in enumerate(BOARD) if s['type'] == 'utility']
GROUP_SQ = {g: [i for i, s in enumerate(BOARD) if s.get('group') == g] for g in GROUPS}

# Cartes : (texte, effet, valeur). Même mécanique que les jeux du classique.
CHANCE = [
    ('Avance jusqu\'à la Direction de l\'ESFF.', 'goto', 39),
    ('Avance jusqu\'au Départ et reçois 200.', 'goto', 0),
    ('Avance jusqu\'au Matriçage. Si tu passes par le Départ, reçois 200.', 'goto', 24),
    ('Avance jusqu\'au Décochage. Si tu passes par le Départ, reçois 200.', 'goto', 11),
    ('Avance jusqu\'à la navette la plus proche. Si elle a un propriétaire, paie-lui le double du loyer.', 'station', 2),
    ('Avance jusqu\'à la navette la plus proche. Si elle a un propriétaire, paie-lui le double du loyer.', 'station', 2),
    ('Avance jusqu\'au réseau le plus proche. S\'il a un propriétaire, paie 10 fois le résultat des dés.', 'utility', 10),
    ('Le BDE te verse un dividende de 50.', 'cash', 50),
    ('Carte « sortie de retouche » : garde-la, elle te libère gratuitement.', 'jailcard', 0),
    ('Recule de trois cases.', 'back', 3),
    ('Défaut de coulée : va directement en retouche, sans passer par le Départ.', 'jail', 0),
    ('Révision générale des fours : paie 25 par maison et 100 par hôtel.', 'repairs', (25, 100)),
    ('Excès de vitesse sur le parking de l\'école : amende de 15.', 'cash', -15),
    ('Prends la Navette Gare de Châlons. Si tu passes par le Départ, reçois 200.', 'goto', 5),
    ('Tu es élu délégué de promo : verse 50 à chaque joueur.', 'payeach', 50),
    ('Ton prêt de matériel arrive à échéance : reçois 150.', 'cash', 150),
]
CHEST = [
    ('Avance jusqu\'au Départ et reçois 200.', 'goto', 0),
    ('Erreur de la banque en ta faveur : reçois 200.', 'cash', 200),
    ('Visite chez le médecin du travail : paie 50.', 'cash', -50),
    ('Tu revends tes vieux bleus de travail : reçois 50.', 'cash', 50),
    ('Carte « sortie de retouche » : garde-la, elle te libère gratuitement.', 'jailcard', 0),
    ('Pièce non conforme : va directement en retouche, sans passer par le Départ.', 'jail', 0),
    ('Ta prime de stage arrive : reçois 100.', 'cash', 100),
    ('Remboursement de frais de déplacement : reçois 20.', 'cash', 20),
    ('C\'est ton anniversaire : chaque joueur te donne 10.', 'collect', 10),
    ('Ton assurance vie arrive à échéance : reçois 100.', 'cash', 100),
    ('Brûlure à l\'atelier, frais d\'hôpital : paie 100.', 'cash', -100),
    ('Frais de scolarité de l\'ESFF : paie 50.', 'cash', -50),
    ('Mission de conseil pour une fonderie : reçois 25.', 'cash', 25),
    ('Réfection de la voirie de l\'usine : paie 40 par maison et 115 par hôtel.', 'repairs', (40, 115)),
    ('Deuxième prix du concours de moulage : reçois 10.', 'cash', 10),
    ('Tu hérites de l\'outillage d\'un vieux fondeur : reçois 100.', 'cash', 100),
]

COLORS = ['#EC641E', '#BA2C3A', '#8A8D91', '#F2F4F7']
TOKENS = ['louche', 'marteau', 'creuset', 'enclume']


class Forgeopoly:
    kind = 'forgeopoly'
    max_seats = 4
    min_seats = 2

    def __init__(self, seats):
        self.players = [{'name': s['name'], 'bot': s['bot'], 'cash': START_CASH, 'pos': 0, 'out': False,
                         'jail': 0, 'jailcards': 0, 'doubles': 0, 'color': COLORS[i % 4], 'token': TOKENS[i % 4]}
                        for i, s in enumerate(seats)]
        self.owner: dict[int, int] = {}
        self.houses = [0] * len(BOARD)          # 5 = hôtel
        self.mortgaged = [False] * len(BOARD)
        self.chance = random.sample(CHANCE, len(CHANCE))
        self.chest = random.sample(CHEST, len(CHEST))
        self.turn = 0
        self.round = 1
        self.phase = 'roll'
        self.dice = [1, 1]
        self.rolled_double = False
        self.log: list[str] = ['La partie commence. Chacun reçoit 1 500 lingots.']
        self.card = None
        self.debt = None                         # {'to': seat|None, 'amount': n}
        self.auction = None
        self.offer = None                        # échange proposé : {'from','to','give','take','cash','until'}
        self.last_offer = {}                     # tour de la dernière proposition d'un robot à chaque joueur
        self.anims: list[dict] = []
        self.aid = 0
        self.wait = 0.0                          # laisse le temps aux animations avant l'action suivante
        self.deadline = time.monotonic() + TURN_TIMEOUT
        self.bot_wait = 1.2
        self.dirty = True
        self.finished: list[int] | None = None
        self._connected = lambda i: True

    # ---------------- outils ----------------
    @property
    def cur(self):
        return self.players[self.turn]

    def say(self, msg):
        self.log.append(msg)
        self.log = self.log[-40:]
        self.dirty = True

    def anim(self, kind, **kw):
        self.aid += 1
        self.anims.append({'id': self.aid, 'k': kind, **kw})
        self.anims = self.anims[-30:]
        self.dirty = True

    def owns_group(self, seat, group):
        return all(self.owner.get(i) == seat for i in GROUP_SQ[group])

    def houses_left(self):
        return HOUSES_TOTAL - sum(h for h in self.houses if h < 5)

    def hotels_left(self):
        return HOTELS_TOTAL - sum(1 for h in self.houses if h == 5)

    def worth(self, seat):
        p = self.players[seat]
        if p['out']:
            return -1
        w = p['cash']
        for i, o in self.owner.items():
            if o == seat:
                sq = BOARD[i]
                w += sq['price'] // 2 if self.mortgaged[i] else sq['price']
                if sq['type'] == 'prop':
                    w += self.houses[i] * sq['house']
        return w

    def set_phase(self, phase, timeout=TURN_TIMEOUT):
        self.phase = phase
        self.deadline = time.monotonic() + timeout
        self.dirty = True

    # ---------------- entrées ----------------
    def handle(self, seat, data):
        if self.finished is not None:
            return
        a = data.get('a')
        sq = data.get('sq')
        if a == 'bid':
            return self.bid(seat, data.get('v'))
        if a in ('accept', 'refuse'):
            return self.answer_offer(seat, a == 'accept')
        if a == 'offer' and seat == self.turn and self.phase in ('roll', 'end', 'jail'):
            return self.make_offer(seat, data)
        if seat != self.turn:
            return
        if self.wait > 0 and a in ('roll', 'end'):
            return
        if a == 'roll' and self.phase in ('roll', 'jail'):
            self.roll()
        elif a == 'jail_pay' and self.phase == 'jail':
            self.leave_jail_pay()
        elif a == 'jail_card' and self.phase == 'jail' and self.cur['jailcards'] > 0:
            self.cur['jailcards'] -= 1
            self.cur['jail'] = 0
            self.say(f"{self.cur['name']} utilise sa carte et sort de retouche.")
            self.set_phase('roll')
        elif a == 'buy' and self.phase == 'buy':
            self.buy()
        elif a == 'pass' and self.phase == 'buy':
            self.start_auction()
        elif a == 'build' and isinstance(sq, int):
            self.build(seat, sq)
        elif a == 'sell' and isinstance(sq, int):
            self.sell(seat, sq)
        elif a == 'mortgage' and isinstance(sq, int):
            self.mortgage(seat, sq)
        elif a == 'unmortgage' and isinstance(sq, int):
            self.unmortgage(seat, sq)
        elif a == 'end' and self.phase == 'end':
            self.end_turn()
        elif a == 'bankrupt' and self.phase == 'debt':
            self.go_bankrupt()
        self.check_debt()

    # ---------------- déroulé du tour ----------------
    def roll(self):
        p = self.cur
        d = [random.randint(1, 6), random.randint(1, 6)]
        self.dice = d
        self.card = None
        double = d[0] == d[1]
        self.anim('dice', seat=self.turn, d=d)
        self.wait = 1.0
        if p['jail']:
            if double:
                p['jail'] = 0
                self.say(f"{p['name']} fait un double ({d[0]}+{d[1]}) et sort de retouche.")
                self.rolled_double = False      # sortie par double : on ne rejoue pas
                return self.move(sum(d))
            p['jail'] += 1
            if p['jail'] > 3:
                self.say(f"{p['name']} rate son 3e essai : paie {JAIL_FINE} et sort.")
                p['jail'] = 0
                self.charge(self.turn, None, JAIL_FINE)
                self.rolled_double = False
                return self.move(sum(d))
            self.say(f"{p['name']} lance {d[0]}+{d[1]} : pas de double, reste en retouche.")
            return self.set_phase('end')
        if double:
            p['doubles'] += 1
            if p['doubles'] >= 3:
                self.say(f"{p['name']} fait trois doubles de suite : direction la retouche !")
                p['doubles'] = 0
                self.rolled_double = False
                return self.go_jail()
        else:
            p['doubles'] = 0
        self.rolled_double = double
        self.say(f"{p['name']} lance {d[0]} + {d[1]}{' (double !)' if double else ''}.")
        self.move(sum(d))

    def move(self, steps):
        p = self.cur
        start = p['pos']
        target = (start + steps) % len(BOARD)
        self.anim('move', seat=self.turn, frm=start, to=target, steps=steps)
        self.wait += 0.18 * steps
        if target < start:
            self.collect(self.turn, GO_SALARY, 'passe par le Départ')
        p['pos'] = target
        self.land()

    def move_to(self, target, salary=True):
        p = self.cur
        start = p['pos']
        steps = (target - start) % len(BOARD)
        self.anim('move', seat=self.turn, frm=start, to=target, steps=steps)
        self.wait += 0.12 * steps
        if salary and target < start:
            self.collect(self.turn, GO_SALARY, 'passe par le Départ')
        p['pos'] = target

    def land(self, rent_mult=1, util_mult=None):
        p = self.cur
        i = p['pos']
        sq = BOARD[i]
        t = sq['type']
        if t in ('prop', 'station', 'utility'):
            owner = self.owner.get(i)
            if owner is None:
                self.set_phase('buy')
                return
            if owner != self.turn and not self.mortgaged[i] and not self.players[owner]['out']:
                rent = self.rent(i, util_mult) * rent_mult
                self.say(f"{p['name']} paie {rent} de loyer à {self.players[owner]['name']} ({sq['name']}).")
                self.charge(self.turn, owner, rent)
        elif t == 'tax':
            self.say(f"{p['name']} paie {sq['amount']} : {sq['name']}.")
            self.charge(self.turn, None, sq['amount'])
        elif t == 'gojail':
            return self.go_jail()
        elif t in ('chance', 'cc'):
            return self.draw(t)
        self.after_action()

    def after_action(self):
        if self.debt:
            return self.set_phase('debt')
        if self.phase in ('buy', 'auction'):
            return
        self.set_phase('roll' if self.rolled_double and not self.cur['jail'] else 'end')

    def draw(self, deck):
        cards = self.chance if deck == 'chance' else self.chest
        if not cards:
            cards.extend(random.sample(CHANCE if deck == 'chance' else CHEST, 16))
        text, kind, val = cards.pop()
        p = self.cur
        self.card = {'deck': deck, 'text': text}
        self.anim('card', seat=self.turn, deck=deck, text=text)
        self.wait += 2.2
        self.say(f"{'Coulée surprise' if deck == 'chance' else 'Caisse de la promo'} : {text}")
        if kind == 'goto':
            self.move_to(val)
            return self.land()
        if kind == 'station':
            nxt = min((s for s in STATIONS if s > p['pos']), default=STATIONS[0])
            self.move_to(nxt)
            return self.land(rent_mult=2)
        if kind == 'utility':
            nxt = min((u for u in UTILITIES if u > p['pos']), default=UTILITIES[0])
            self.move_to(nxt)
            return self.land(util_mult=10)
        if kind == 'back':
            target = (p['pos'] - val) % len(BOARD)
            self.anim('move', seat=self.turn, frm=p['pos'], to=target, steps=-val)
            p['pos'] = target
            return self.land()
        if kind == 'jail':
            return self.go_jail()
        if kind == 'jailcard':
            p['jailcards'] += 1
        elif kind == 'cash':
            if val >= 0:
                self.collect(self.turn, val)
            else:
                self.charge(self.turn, None, -val)
        elif kind == 'repairs':
            h = sum(self.houses[i] for i, o in self.owner.items() if o == self.turn and self.houses[i] < 5)
            ho = sum(1 for i, o in self.owner.items() if o == self.turn and self.houses[i] == 5)
            cost = h * val[0] + ho * val[1]
            if cost:
                self.charge(self.turn, None, cost)
        elif kind == 'payeach':
            for j, o in enumerate(self.players):
                if j != self.turn and not o['out']:
                    self.charge(self.turn, j, val)
        elif kind == 'collect':
            for j, o in enumerate(self.players):
                if j != self.turn and not o['out']:
                    self.charge(j, self.turn, val)
        self.after_action()

    def go_jail(self):
        p = self.cur
        self.anim('move', seat=self.turn, frm=p['pos'], to=JAIL, steps=0, jump=True)
        self.wait += 0.8
        p['pos'] = JAIL
        p['jail'] = 1
        p['doubles'] = 0
        self.rolled_double = False
        self.say(f"{p['name']} part en retouche.")
        self.set_phase('end')

    def leave_jail_pay(self):
        p = self.cur
        if p['cash'] < JAIL_FINE:
            return
        self.charge(self.turn, None, JAIL_FINE)
        p['jail'] = 0
        self.say(f"{p['name']} paie {JAIL_FINE} et sort de retouche.")
        self.set_phase('roll')

    # ---------------- loyers, achats, enchères ----------------
    def rent(self, i, util_mult=None):
        sq = BOARD[i]
        o = self.owner[i]
        if sq['type'] == 'station':
            n = sum(1 for s in STATIONS if self.owner.get(s) == o and not self.mortgaged[s])
            return 25 * 2 ** (n - 1)
        if sq['type'] == 'utility':
            n = sum(1 for u in UTILITIES if self.owner.get(u) == o and not self.mortgaged[u])
            mult = util_mult or (10 if n == 2 else 4)
            return mult * sum(self.dice)
        h = self.houses[i]
        if h:
            return sq['rents'][h]
        base = sq['rents'][0]
        return base * 2 if self.owns_group(o, sq['group']) else base

    def buy(self):
        p = self.cur
        i = p['pos']
        sq = BOARD[i]
        if p['cash'] < sq['price']:
            return self.start_auction()
        p['cash'] -= sq['price']
        self.owner[i] = self.turn
        self.anim('money', seat=self.turn, amt=-sq['price'])
        self.anim('buy', seat=self.turn, sq=i)
        self.say(f"{p['name']} achète {sq['name']} pour {sq['price']}.")
        self.phase = 'resolved'
        self.after_action()

    def start_auction(self):
        i = self.cur['pos']
        self.auction = {'sq': i, 'bid': 0, 'by': None, 'end': time.monotonic() + AUCTION_TIME, 'bots': {}}
        for j, o in enumerate(self.players):
            if o['bot'] and not o['out']:
                self.auction['bots'][j] = int(BOARD[i]['price'] * random.uniform(0.55, 1.1))
        self.say(f"{BOARD[i]['name']} part aux enchères !")
        self.anim('auction', sq=i)
        self.set_phase('auction', AUCTION_TIME)

    def bid(self, seat, v):
        a = self.auction
        if self.phase != 'auction' or not a or self.players[seat]['out']:
            return
        try:
            v = int(v)
        except (TypeError, ValueError):
            return
        if v <= a['bid'] or v > self.players[seat]['cash'] or v - a['bid'] > 500:
            return
        a['bid'], a['by'] = v, seat
        a['end'] = max(a['end'], time.monotonic() + 3.0)
        self.say(f"{self.players[seat]['name']} enchérit à {v}.")
        self.dirty = True

    def close_auction(self):
        a = self.auction
        self.auction = None
        sq = BOARD[a['sq']]
        if a['by'] is None:
            self.say(f"Personne n'enchérit : {sq['name']} reste à la banque.")
        else:
            w = self.players[a['by']]
            w['cash'] -= a['bid']
            self.owner[a['sq']] = a['by']
            self.anim('money', seat=a['by'], amt=-a['bid'])
            self.anim('buy', seat=a['by'], sq=a['sq'])
            self.say(f"{w['name']} remporte {sq['name']} pour {a['bid']}.")
        self.phase = 'resolved'
        self.after_action()

    # ---------------- argent et dettes ----------------
    def collect(self, seat, amount, why=''):
        self.players[seat]['cash'] += amount
        self.anim('money', seat=seat, amt=amount)
        if why:
            self.say(f"{self.players[seat]['name']} {why} : +{amount}.")

    def charge(self, frm, to, amount):
        """Fait payer `frm`. S'il n'a pas assez, une dette est ouverte : il doit hypothéquer, vendre ou faire faillite."""
        p = self.players[frm]
        if p['out'] or amount <= 0:
            return
        p['cash'] -= amount
        self.anim('money', seat=frm, amt=-amount)
        if to is not None:
            self.players[to]['cash'] += amount
            self.anim('money', seat=to, amt=amount)
        if p['cash'] < 0 and frm == self.turn:
            self.debt = {'to': to, 'amount': -p['cash']}
        elif p['cash'] < 0:
            # un autre joueur (anniversaire) : il règle tout de suite en hypothéquant, sinon faillite
            self.auto_raise(frm)
            if p['cash'] < 0:
                self.bankrupt(frm, self.turn)

    def check_debt(self):
        if self.debt and self.cur['cash'] >= 0:
            self.debt = None
            self.say(f"{self.cur['name']} a réglé sa dette.")
            self.after_action()

    def go_bankrupt(self):
        to = self.debt['to'] if self.debt else None
        self.debt = None
        self.bankrupt(self.turn, to)
        if self.finished is None:
            self.end_turn()

    def bankrupt(self, seat, creditor):
        p = self.players[seat]
        p['out'] = True
        cash = max(0, p['cash'])
        p['cash'] = 0
        for i in [i for i, o in self.owner.items() if o == seat]:
            self.houses[i] = 0
            if creditor is not None:
                self.owner[i] = creditor
            else:
                del self.owner[i]
                self.mortgaged[i] = False
        if creditor is not None:
            self.players[creditor]['cash'] += cash
            self.players[creditor]['jailcards'] += p['jailcards']
        self.anim('bankrupt', seat=seat)
        self.say(f"💥 {p['name']} fait faillite{' au profit de ' + self.players[creditor]['name'] if creditor is not None else ''}.")
        alive = [j for j, o in enumerate(self.players) if not o['out']]
        if len(alive) <= 1:
            self.finish()

    def auto_raise(self, seat):
        """Vend maisons et hypothèque jusqu'à repasser en positif (robots et joueurs absents)."""
        p = self.players[seat]
        mine = sorted([i for i, o in self.owner.items() if o == seat], key=lambda i: BOARD[i]['price'])
        while p['cash'] < 0:
            built = [i for i in mine if self.houses[i] > 0]
            if built:
                if not self.sell(seat, max(built, key=lambda i: self.houses[i])):
                    break
                continue
            free = [i for i in mine if not self.mortgaged[i]]
            if not free:
                break
            self.mortgage(seat, free[0])

    # ---------------- maisons et hypothèques ----------------
    def can_manage(self, seat, i):
        return 0 <= i < len(BOARD) and self.owner.get(i) == seat and self.finished is None

    def build(self, seat, i):
        if not self.can_manage(seat, i) or BOARD[i]['type'] != 'prop':
            return False
        sq, p = BOARD[i], self.players[seat]
        grp = GROUP_SQ[sq['group']]
        if not self.owns_group(seat, sq['group']) or any(self.mortgaged[j] for j in grp):
            return False
        h = self.houses[i]
        if h >= 5 or h > min(self.houses[j] for j in grp) or p['cash'] < sq['house']:
            return False   # construction équilibrée : pas plus d'une maison d'écart dans le groupe
        if (h == 4 and self.hotels_left() <= 0) or (h < 4 and self.houses_left() <= 0):
            return False
        p['cash'] -= sq['house']
        self.houses[i] += 1
        self.anim('build', sq=i, n=self.houses[i])
        self.anim('money', seat=seat, amt=-sq['house'])
        self.say(f"{p['name']} construit {'un hôtel' if self.houses[i] == 5 else 'une maison'} sur {sq['name']}.")
        return True

    def sell(self, seat, i):
        if not self.can_manage(seat, i) or self.houses[i] == 0:
            return False
        sq = BOARD[i]
        grp = GROUP_SQ[sq['group']]
        if self.houses[i] < max(self.houses[j] for j in grp):
            return False
        self.houses[i] -= 1
        self.players[seat]['cash'] += sq['house'] // 2
        self.anim('build', sq=i, n=self.houses[i])
        self.anim('money', seat=seat, amt=sq['house'] // 2)
        self.say(f"{self.players[seat]['name']} revend une construction sur {sq['name']}.")
        return True

    def mortgage(self, seat, i):
        if not self.can_manage(seat, i) or self.mortgaged[i]:
            return False
        sq = BOARD[i]
        if sq['type'] == 'prop' and any(self.houses[j] for j in GROUP_SQ[sq['group']]):
            return False
        self.mortgaged[i] = True
        self.players[seat]['cash'] += sq['price'] // 2
        self.anim('money', seat=seat, amt=sq['price'] // 2)
        self.say(f"{self.players[seat]['name']} hypothèque {sq['name']} (+{sq['price'] // 2}).")
        return True

    def unmortgage(self, seat, i):
        if not self.can_manage(seat, i) or not self.mortgaged[i]:
            return False
        cost = int(BOARD[i]['price'] / 2 * 1.1)
        p = self.players[seat]
        if p['cash'] < cost:
            return False
        p['cash'] -= cost
        self.mortgaged[i] = False
        self.anim('money', seat=seat, amt=-cost)
        self.say(f"{p['name']} lève l'hypothèque de {BOARD[i]['name']} (-{cost}).")
        return True

    # ---------------- échanges entre joueurs ----------------
    def tradeable(self, seat, i):
        if self.owner.get(i) != seat or BOARD[i]['type'] not in ('prop', 'station', 'utility'):
            return False
        return not (BOARD[i]['type'] == 'prop' and any(self.houses[j] for j in GROUP_SQ[BOARD[i]['group']]))

    def make_offer(self, seat, data):
        if self.offer:
            return
        try:
            to = int(data.get('to'))
            give = [int(x) for x in data.get('give', [])][:6]
            take = [int(x) for x in data.get('take', [])][:6]
            cash = int(data.get('cash', 0))
        except (TypeError, ValueError):
            return
        if not (0 <= to < len(self.players)) or to == seat or self.players[to]['out'] or not (give or take or cash):
            return
        if not all(self.tradeable(seat, i) for i in give) or not all(self.tradeable(to, i) for i in take):
            return
        if cash > self.players[seat]['cash'] or -cash > self.players[to]['cash']:
            return
        self.offer = {'from': seat, 'to': to, 'give': give, 'take': take, 'cash': cash, 'until': time.monotonic() + 30}
        self.say(f"{self.players[seat]['name']} propose un échange à {self.players[to]['name']}.")
        self.anim('offer', frm=seat, to=to)

    def answer_offer(self, seat, ok):
        o = self.offer
        if not o or seat != o['to']:
            return
        self.offer = None
        a, b = self.players[o['from']], self.players[o['to']]
        if not ok:
            self.say(f"{b['name']} refuse l'échange.")
            return
        # revérifie : les terrains ont pu changer entre-temps
        if (not all(self.tradeable(o['from'], i) for i in o['give']) or not all(self.tradeable(o['to'], i) for i in o['take'])
                or o['cash'] > a['cash'] or -o['cash'] > b['cash']):
            self.say("L'échange n'est plus possible.")
            return
        for i in o['give']:
            self.owner[i] = o['to']
            self.anim('buy', seat=o['to'], sq=i)
        for i in o['take']:
            self.owner[i] = o['from']
            self.anim('buy', seat=o['from'], sq=i)
        cash = o['cash']
        a['cash'] -= cash
        b['cash'] += cash
        if cash:
            self.anim('money', seat=o['from'], amt=-cash)
            self.anim('money', seat=o['to'], amt=cash)
        names = lambda l: ', '.join(BOARD[i]['name'] for i in l) or 'rien'
        extra_a = f' + {cash} lingots' if cash > 0 else ''
        extra_b = f' + {-cash} lingots' if cash < 0 else ''
        self.say(f"🤝 Échange : {a['name']} donne {names(o['give'])}{extra_a} ; {b['name']} donne {names(o['take'])}{extra_b}.")

    def completes(self, seat, add, remove):
        """Nombre de groupes de couleur que `seat` complète (positif) ou casse (négatif) avec cet échange."""
        n = 0
        for sqs in GROUP_SQ.values():
            own = {i for i in sqs if self.owner.get(i) == seat}
            before = len(own) == len(sqs)
            after = len((own | set(add)) - set(remove)) == len(sqs)
            n += int(after and not before) - int(before and not after)
        return n

    def bot_answer(self):
        o = self.offer
        if not o:
            return
        to = o['to']
        if self.players[to]['bot'] or not self._connected(to):
            gets, gives = o['give'], o['take']
            v = sum(BOARD[i]['price'] for i in gets) - sum(BOARD[i]['price'] for i in gives) + o['cash']
            v += 450 * self.completes(to, gets, gives)
            v -= 350 * self.completes(o['from'], gives, gets)
            self.answer_offer(to, v > 40)
        elif time.monotonic() > o['until']:
            self.answer_offer(to, False)

    def bot_propose(self):
        """Un robot cherche le terrain qui lui manque pour compléter un groupe et fait une offre."""
        me = self.turn
        if self.offer:
            return
        for g, sqs in GROUP_SQ.items():
            mine = [i for i in sqs if self.owner.get(i) == me]
            missing = [i for i in sqs if self.owner.get(i) != me]
            if len(missing) != 1 or not mine:
                continue
            i = missing[0]
            other = self.owner.get(i)
            if other is None or self.players[other]['out'] or not self.tradeable(other, i):
                continue
            if self.round - self.last_offer.get((me, other), -99) < 5:
                continue
            self.last_offer[(me, other)] = self.round
            # un terrain isolé (qui ne lui sert à rien) + de l'argent si besoin
            spare = [j for j, o in self.owner.items() if o == me and j != i and self.tradeable(me, j)
                     and BOARD[j].get('group') != g
                     and not any(self.owner.get(k) == me for k in GROUP_SQ.get(BOARD[j].get('group'), []) if k != j)]
            give = spare[:1]
            gap = BOARD[i]['price'] * 1.6 - sum(BOARD[j]['price'] for j in give)
            cash = int(max(0, min(gap, self.cur['cash'] - 150)) // 10 * 10)
            if not give and cash < BOARD[i]['price']:
                continue
            self.make_offer(me, {'to': other, 'give': give, 'take': [i], 'cash': cash})
            return

    # ---------------- fin de tour, fin de partie ----------------
    def end_turn(self):
        if self.finished is not None:
            return
        n = len(self.players)
        j = self.turn
        for _ in range(n):
            nxt = (j + 1) % n
            if nxt <= j:
                self.round += 1
            j = nxt
            if not self.players[j]['out']:
                break
        if self.round > MAX_ROUNDS:
            return self.finish()
        self.turn = j
        self.card = None
        self.rolled_double = False
        self.players[j]['doubles'] = 0
        self.bot_wait = 1.0
        self.set_phase('jail' if self.players[j]['jail'] else 'roll')

    def finish(self):
        self.finished = sorted(range(len(self.players)), key=self.worth, reverse=True)
        self.phase = 'over'
        self.say(f"🏆 Fin de partie ! {self.players[self.finished[0]]['name']} remporte le Forgeopoly.")
        self.dirty = True

    def completed(self, seat):
        return True

    # ---------------- horloge, robots, absents ----------------
    def tick(self, dt, connected):
        if self.finished is not None:
            return
        if self.wait > 0:          # animations en cours : le chrono du joueur est mis en pause
            self.wait -= dt
            self.deadline += dt
            if self.auction:
                self.auction['end'] += dt
            return
        now = time.monotonic()
        self._connected = connected
        if self.offer:
            self.bot_answer()
        if self.phase == 'auction':
            a = self.auction
            for j, limit in list(a['bots'].items()):
                if a['by'] != j and a['bid'] + 10 <= min(limit, self.players[j]['cash']) and random.random() < 0.08:
                    self.bid(j, a['bid'] + random.choice((10, 10, 20, 50)))
            if now > a['end']:
                self.close_auction()
            return
        p = self.cur
        auto = p['bot'] or not connected(self.turn)
        if auto:
            self.bot_wait -= dt
            if self.bot_wait <= 0:
                self.bot_wait = 0.9
                self.bot_act()
        elif now > self.deadline:
            self.timeout_act()

    def timeout_act(self):
        if self.phase in ('roll', 'jail'):
            self.roll()
        elif self.phase == 'buy':
            self.start_auction()
        elif self.phase == 'end':
            self.end_turn()
        elif self.phase == 'debt':
            self.auto_raise(self.turn)
            self.check_debt()
            if self.debt:
                self.go_bankrupt()

    def bot_act(self):
        p = self.cur
        ph = self.phase
        if ph == 'debt':
            self.auto_raise(self.turn)
            self.check_debt()
            if self.debt:
                self.go_bankrupt()
            return
        if ph == 'jail':
            if p['jailcards']:
                self.handle(self.turn, {'a': 'jail_card'})
            elif p['cash'] > 400 and self.round < 12:
                self.leave_jail_pay()
            else:
                self.roll()
            return
        if ph == 'roll':
            if random.random() < 0.5:
                self.bot_propose()
            self.bot_manage()
            self.roll()
        elif ph == 'buy':
            price = BOARD[p['pos']]['price']
            if p['cash'] - price >= 120 or (p['cash'] >= price and random.random() < 0.35):
                self.buy()
            else:
                self.start_auction()
        elif ph == 'end':
            self.bot_manage()
            self.end_turn()

    def bot_manage(self):
        p = self.cur
        for _ in range(6):   # construit tant qu'il garde une réserve
            cands = [i for i, o in self.owner.items() if o == self.turn and BOARD[i]['type'] == 'prop'
                     and self.owns_group(self.turn, BOARD[i]['group'])]
            cands.sort(key=lambda i: (self.houses[i], -BOARD[i]['price']))
            if not cands or p['cash'] - BOARD[cands[0]]['house'] < 250 or not self.build(self.turn, cands[0]):
                break
        for i in [i for i, o in self.owner.items() if o == self.turn and self.mortgaged[i]]:
            if p['cash'] > 600:
                self.unmortgage(self.turn, i)

    # ---------------- état envoyé ----------------
    def view(self):
        a = self.auction
        return {
            'board': BOARD,
            'players': [{**p, 'worth': max(0, self.worth(i))} for i, p in enumerate(self.players)],
            'owner': {str(k): v for k, v in self.owner.items()},
            'houses': self.houses, 'mortgaged': self.mortgaged,
            'turn': self.turn, 'round': min(self.round, MAX_ROUNDS), 'maxRounds': MAX_ROUNDS,
            'phase': self.phase, 'dice': self.dice, 'card': self.card,
            'debt': self.debt,
            'offer': {k: v for k, v in self.offer.items() if k != 'until'} if self.offer else None,
            'auction': {'sq': a['sq'], 'bid': a['bid'], 'by': a['by'], 'left': max(0, round(a['end'] - time.monotonic(), 1))} if a else None,
            'log': self.log[-10:], 'anims': self.anims,
            'timeLeft': max(0, int(self.deadline - time.monotonic())),
            'housesLeft': self.houses_left(), 'hotelsLeft': self.hotels_left(),
            'finished': self.finished,
        }
