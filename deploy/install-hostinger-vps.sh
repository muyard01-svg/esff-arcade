#!/usr/bin/env bash
# Installe Arcade 102 sur un VPS Hostinger (Ubuntu 22.04 ou 24.04), derrière nginx avec HTTPS.
#
# Utilisation (en root sur le VPS, dans le dossier où se trouve esff-arcade.zip) :
#   bash install-hostinger-vps.sh arcade.esff2027.shop 'TON-CODE-PROMO' ton-email@exemple.com
#
# 1er argument : le sous-domaine de la borne (son enregistrement DNS A doit déjà pointer vers l'IP du VPS)
# 2e argument  : le code promo -10 % révélé par les tickets gagnants
# 3e argument  : un e-mail pour le certificat HTTPS (Let's Encrypt)
set -euo pipefail

DOMAIN="${1:?Indique le sous-domaine, ex. arcade.esff2027.shop}"
PROMO="${2:?Indique le code promo entre apostrophes, ex. 'TON-CODE-PROMO'}"
EMAIL="${3:?Indique un e-mail pour le certificat HTTPS}"
APP_DIR=/opt/esff-arcade
DATA_DIR=/var/lib/esff-arcade
ZIP="$(dirname "$0")/esff-arcade.zip"

echo "==> Paquets système"
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y python3 python3-venv unzip nginx certbot python3-certbot-nginx

echo "==> Utilisateur dédié et dossiers"
id -u arcade >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin arcade
mkdir -p "$APP_DIR" "$DATA_DIR"
if [ -f "$ZIP" ]; then
  rm -rf "$APP_DIR/app.new" && mkdir -p "$APP_DIR/app.new"
  unzip -q "$ZIP" -d "$APP_DIR/app.new"
  rm -rf "$APP_DIR/app" && mv "$APP_DIR/app.new" "$APP_DIR/app"
else
  echo "Fichier esff-arcade.zip introuvable à côté du script." >&2; exit 1
fi

echo "==> Environnement Python"
python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install --quiet --upgrade pip
"$APP_DIR/venv/bin/pip" install --quiet -r "$APP_DIR/app/requirements.txt"
chown -R arcade:arcade "$APP_DIR" "$DATA_DIR"

echo "==> Service systemd (redémarre tout seul)"
cat > /etc/systemd/system/esff-arcade.service <<UNIT
[Unit]
Description=Arcade 102 - borne de la promo ESFF
After=network.target

[Service]
User=arcade
WorkingDirectory=$APP_DIR/app
Environment=PORT=8090
Environment=ESFF_DB=$DATA_DIR/arcade.db
Environment="ESFF_PROMO_CODE=$PROMO"
Environment=ESFF_WIN_RATE=0.20
ExecStart=$APP_DIR/venv/bin/python server.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now esff-arcade
systemctl restart esff-arcade

echo "==> nginx (avec WebSockets pour les jeux en ligne)"
cat > /etc/nginx/sites-available/esff-arcade <<NGINX
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 2m;

    location /ws {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$remote_addr;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/esff-arcade /etc/nginx/sites-enabled/esff-arcade
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> Pare-feu (si ufw est actif)"
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then ufw allow 'Nginx Full'; fi

echo "==> Certificat HTTPS"
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect

echo
echo "Arcade 102 est en ligne : https://$DOMAIN"
echo "Journal du serveur : journalctl -u esff-arcade -f"
