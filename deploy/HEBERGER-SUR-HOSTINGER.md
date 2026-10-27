# Mettre Arcade 101 en ligne sur Hostinger

Objectif : la borne accessible sur **https://arcade.esff2027.shop**, avec un bouton « Jouer » sur la boutique.

> **Pourquoi un VPS ?** Ton site esff2027.shop est fait avec le Website Builder d'Hostinger. Ce type d'offre (comme l'hébergement web mutualisé) ne sait pas faire tourner un serveur Python allumé en permanence. Or la borne en a besoin pour les jeux en ligne, les tickets et le classement. Il faut donc une offre **VPS** chez Hostinger. Le plus petit modèle (KVM 1) suffit largement.

## 1. Prendre le VPS (toi, dans hPanel)

1. hPanel → **VPS** → choisir le plus petit modèle, emplacement **France** ou **Europe**.
2. Système : **Ubuntu 24.04** (ou 22.04), sans panneau de contrôle.
3. Choisir un **mot de passe root** et le noter.
4. Une fois le VPS prêt, noter son **adresse IP** (page « Aperçu » du VPS).

## 2. Créer le sous-domaine arcade.esff2027.shop (toi, dans hPanel)

1. hPanel → **Domaines** → esff2027.shop → **DNS / Serveurs de noms**.
2. Ajouter un enregistrement :
   - Type : **A**
   - Nom : **arcade**
   - Pointe vers : **l'IP du VPS**
   - TTL : laisser par défaut
3. Attendre quelques minutes (parfois jusqu'à 1 h) que le sous-domaine soit actif.

## 3. Envoyer la borne sur le VPS (depuis ton PC)

Ouvre PowerShell dans le dossier `esff-arcade\deploy` (ou le terminal Claude), puis :

```bash
scp esff-arcade.zip install-hostinger-vps.sh root@IP_DU_VPS:/root/
```

Remplace `IP_DU_VPS` par l'IP notée à l'étape 1. Tape `yes` à la première connexion, puis le mot de passe root.

## 4. Lancer l'installation (sur le VPS)

Connecte-toi au VPS :

```bash
ssh root@IP_DU_VPS
```

Tu peux aussi utiliser le **terminal du navigateur** dans hPanel → VPS. Puis lance :

```bash
bash /root/install-hostinger-vps.sh arcade.esff2027.shop 'TON-CODE-PROMO' ton-email@exemple.com
```

- Garde les **apostrophes** autour du code promo (à cause du `<`).
- L'e-mail sert uniquement au certificat HTTPS gratuit.

Après 2 à 3 minutes, le script affiche : **Arcade 101 est en ligne : https://arcade.esff2027.shop**

## 5. Ajouter le lien sur la boutique (toi, dans le Website Builder)

Dans l'éditeur de esff2027.shop, ajoute un bouton (par exemple « 🎮 Joue et gagne -10 % ») avec le lien :

```
https://arcade.esff2027.shop
```

## Mettre à jour la borne plus tard

Je régénère `esff-arcade.zip`, tu refais l'étape 3, puis tu relances la commande de l'étape 4. Les tickets, pseudos et classements sont conservés, car ils sont stockés à part dans `/var/lib/esff-arcade`.

## En cas de souci

| Problème | Commande sur le VPS |
|---|---|
| Voir si la borne tourne | `systemctl status esff-arcade` |
| Lire le journal du serveur | `journalctl -u esff-arcade -f` |
| Redémarrer la borne | `systemctl restart esff-arcade` |
| Le HTTPS échoue | vérifier que `arcade.esff2027.shop` pointe bien vers l'IP du VPS, puis relancer la commande de l'étape 4 |
