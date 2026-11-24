#!/usr/bin/env bash
set -euo pipefail
umask 027

domain=stop-jir.gncp.work
app=/opt/stop-jir
archive=/root/.stop-jir-release.tar
secret=/root/.stop-jir-owner
site=/etc/nginx/sites-available/$domain
enabled=/etc/nginx/sites-enabled/$domain
auth=/etc/nginx/stop-jir.htpasswd
cert=/etc/letsencrypt/live/$domain
port=18082

trap 'rm -f -- "$secret" "$archive"' EXIT
if [[ ! -r "$cert/fullchain.pem" || ! -r "$cert/privkey.pem" ]]; then
  echo "Certificate not found for $domain" >&2
  exit 1
fi
openssl x509 -in "$cert/fullchain.pem" -noout -checkhost "$domain"
install -d -m 0750 "$app"
install -d -m 0755 "/var/www/$domain/.well-known/acme-challenge"
tar -xf "$archive" -C "$app"
if [[ ! -s "$auth" ]]; then
  [[ -s "$secret" ]]
  hash=$(openssl passwd -6 -stdin < "$secret")
  printf 'owner:%s\n' "$hash" > "$auth"
  chown root:www-data "$auth"
  chmod 0640 "$auth"
fi

cd "$app"
APP_PORT=$port docker compose up --build -d
for attempt in {1..15}; do
  if curl -fsS -o /dev/null "http://127.0.0.1:$port/"; then break; fi
  sleep 1
done
curl -fsS -o /dev/null "http://127.0.0.1:$port/more"

backup=$(mktemp)
if [[ -e "$site" ]]; then cp -p "$site" "$backup"; had_site=1; else had_site=0; fi
had_link=0
if [[ -L "$enabled" && "$(readlink -f "$enabled")" == "$site" ]]; then had_link=1; elif [[ -e "$enabled" || -L "$enabled" ]]; then exit 1; fi
cat > "$site" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $domain;
    location ^~ /.well-known/acme-challenge/ { root /var/www/$domain; }
    location / { return 301 https://$domain\$request_uri; }
}
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $domain;
    ssl_certificate $cert/fullchain.pem;
    ssl_certificate_key $cert/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    auth_basic "Stop Jir";
    auth_basic_user_file $auth;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy same-origin always;
    location / {
        proxy_set_header Host \$host;
        proxy_set_header Authorization "";
        proxy_pass http://127.0.0.1:$port;
    }
}
EOF
if (( ! had_link )); then ln -s "$site" "$enabled"; fi
if ! nginx -t || ! systemctl reload nginx; then
  if (( had_site )); then cp -p "$backup" "$site"; else rm -f -- "$site"; fi
  if (( ! had_link )); then rm -f -- "$enabled"; fi
  rm -f -- "$backup"
  exit 1
fi
rm -f -- "$backup"
test "$(curl -sS -o /dev/null -w '%{http_code}' --resolve "$domain:443:127.0.0.1" "https://$domain/")" = 401
if [[ -s "$secret" ]]; then
  actual=$(printf 'user = "owner:%s"\n' "$(cat "$secret")" | curl --config - -sS -o /dev/null -w '%{http_code}' --resolve "$domain:443:127.0.0.1" "https://$domain/")
  test "$actual" = 200
fi
install -d /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/stop-jir-nginx <<'HOOK'
#!/bin/sh
case " ${RENEWED_DOMAINS:-} " in
  *" stop-jir.gncp.work "*) nginx -t && systemctl reload nginx ;;
esac
HOOK
chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/stop-jir-nginx
echo "HTTPS and authentication verified for $domain."
