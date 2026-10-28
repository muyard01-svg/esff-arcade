"""Combos nommés des deux jeux de combat (Forge Fighters 2D et Poing de Fonte 3D).

Un combo est une suite de coups qui touchent sans que l'adversaire puisse se remettre (même chaîne
que le compteur « N COUPS »). Quand la fin de la chaîne correspond à un motif, le serveur annonce le
combo (événement 'combo'), qui déclenche la grande animation dans le navigateur, et ajoute un bonus.
Dans les motifs : '*' = n'importe quel coup, 'S' = le coup spécial du personnage.
Les mêmes listes sont affichées dans le guide des combos (public/combos.js)."""

FIGHTER_COMBOS = [   # du plus long au plus court
    ('SIG', ['jab', 'kick', 'S']),
    ('Forge infernale', ['jab', 'jab', 'kick', 'low']),
    ('Martelage', ['jab', 'jab', 'kick']),
    ('Fauchage', ['low', 'upper']),
    ('Coup de trempe', ['jab', 'upper']),
]
FIGHTER_SIGNATURES = {'fondeur': 'Déluge de fonte', 'forgeronne': 'Écrasement du pilon',
                      'mouleur': 'Tempête de sable noir', 'ebarbeuse': 'Ébarbage total'}

TEKKEN_COMBOS = [   # '12' = l'enchaînement 1,2
    ('Coulée continue', ['12', 'd3', '4']),
    ('Trempe aérienne', ['df2', '*', '*']),
    ('SIG', ['12', 'S']),
    ('Martelage', ['12', 'f3']),
    ('Fauchage', ['d3', '4']),
    ('Enclume', ['f3', '1']),
]
TEKKEN_SIG_MOVE = {'lamineur': 'f4'}   # son spécial est une projection : sa signature finit par avant + 4
TEKKEN_SIGNATURES = {'fondeur': 'Déluge de fonte', 'forgeronne': 'Écrasement du pilon', 'mouleur': 'Tempête de sable noir',
                     'ebarbeuse': 'Ébarbage total', 'lamineur': 'Laminage à chaud', 'chaudronniere': 'Rivetage express'}

BONUS = 4   # dégâts en plus quand un combo nommé passe


def register(f, move, new_attack, special, table, signatures):
    """À appeler après la mise à jour de f.combo ; renvoie le nom du combo qui vient de passer, sinon None."""
    if f.combo <= 1:
        f.chain = []
    if not new_attack:          # coups multiples d'une même attaque : un seul maillon
        return None
    f.chain = (getattr(f, 'chain', None) or []) + [move]
    chain = f.chain
    for name, pat in table:
        if len(chain) < len(pat):
            continue
        tail = chain[-len(pat):]
        if all(p == '*' or p == c or (p == 'S' and c == special) for p, c in zip(pat, tail)):
            return signatures.get(f.char, 'Coup de maître') if name == 'SIG' else name
    return None
