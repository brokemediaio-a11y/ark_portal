#!/usr/bin/env bash
# Runs on the VPS as the "deploy" user. The GitHub Actions workflow pipes this script
# over SSH with the commit SHA after uploading /opt/ark_portal/incoming/<sha>.tgz.
#
# Layout:
#   /opt/ark_portal/shared/.env.local   secrets, kept between releases
#   /opt/ark_portal/releases/<name>/    one folder per deploy, each with its own build
#   /opt/ark_portal/current             symlink to the live release
#   /opt/ark_portal/backups/            SQLite copies taken before each deploy
#
# A failed build never touches the live site. A release that does not answer
# after restart is rolled back automatically.
set -euo pipefail

SHA="${1:?usage: deploy.sh <40-char commit sha>}"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid commit SHA." >&2; exit 2; }

APP=/opt/ark_portal
SERVICE=ark-portal
PORT=3000
KEEP_RELEASES=4
KEEP_BACKUPS=14

ARCHIVE="$APP/incoming/$SHA.tgz"
ENV_FILE="$APP/shared/.env.local"
CURRENT="$APP/current"
NEW="$APP/releases/$(date +%Y%m%d%H%M%S)-${SHA:0:7}"
SWITCHED=0

# Only one deploy at a time.
exec 9>"$APP/.deploy.lock"
flock -n 9 || { echo "Another deploy is already running." >&2; exit 1; }

cleanup() {
  rm -f "$ARCHIVE"
  if [ "$SWITCHED" -eq 0 ] && [ -d "$NEW" ]; then rm -rf "$NEW"; fi
}
trap cleanup EXIT

[ -f "$ARCHIVE" ] || { echo "Missing $ARCHIVE" >&2; exit 1; }
[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE. Create it first (see deploy/SETUP.md)." >&2; exit 1; }

PREVIOUS="$(readlink -f "$CURRENT" 2>/dev/null || true)"

# Back up the SQLite database before anything changes.
DB_PATH="$(grep -E '^PORTAL_DATABASE_PATH=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d "\"'\r")"
if [ -n "$DB_PATH" ] && [ -f "$DB_PATH" ] && command -v sqlite3 >/dev/null 2>&1; then
  mkdir -p "$APP/backups"
  sqlite3 "$DB_PATH" ".backup '$APP/backups/portal-$(date +%Y%m%d%H%M%S).sqlite'"
  ls -1t "$APP"/backups/portal-*.sqlite 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f
fi

echo "==> Unpacking ${SHA:0:7}"
mkdir -p "$NEW"
tar -xzf "$ARCHIVE" -C "$NEW"
ln -s "$ENV_FILE" "$NEW/.env.local"

echo "==> Installing dependencies"
cd "$NEW"
npm ci --no-audit --no-fund

echo "==> Building"
npm run build

switch_to() {
  ln -sfn "$1" "$APP/current.tmp"
  mv -T "$APP/current.tmp" "$CURRENT"
  sudo systemctl restart "$SERVICE"
}

wait_until_healthy() {
  for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/login"; then return 0; fi
    sleep 2
  done
  return 1
}

echo "==> Switching to the new release"
switch_to "$NEW"
SWITCHED=1

if wait_until_healthy; then
  echo "==> Healthy. Deployed ${SHA:0:7}."
else
  echo "!! The new release did not respond. Last service log lines:" >&2
  sudo journalctl -u "$SERVICE" -n 40 --no-pager >&2 || true
  if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    echo "!! Rolling back to $(basename "$PREVIOUS")" >&2
    switch_to "$PREVIOUS"
    wait_until_healthy && echo "!! Rolled back; the previous release is live again." >&2
  fi
  exit 1
fi

# Keep the newest releases, remove the rest. The live one is always the newest.
ls -1dt "$APP"/releases/* | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf
find "$APP/incoming" -type f -mtime +7 -delete 2>/dev/null || true
