#!/bin/sh
# Pull main and roll the running stack forward. Manual deploy for the Mac mini —
# there is no SSH target for GitHub Actions to reach behind the tunnel, and for
# a beta a `git pull` you run yourself is simpler than a self-hosted runner.
#
#   ./deploy/update.sh
#
# Migrations run before the new container replaces the old one, so a migration
# that fails leaves the previous version serving — the same order the CI deploy
# job uses. This holds only while migrations stay additive; one that drops a
# column breaks the running app the moment it lands, and that is a deploy to do
# by hand with the site down.

set -eu

cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.prod.yml -f docker-compose.mac.yml"

BEFORE="$(git rev-parse --short HEAD)"
git fetch --prune origin
git reset --hard origin/main
AFTER="$(git rev-parse --short HEAD)"

if [ "$BEFORE" = "$AFTER" ]; then
  echo "already at $AFTER — nothing to build"
else
  echo "$BEFORE → $AFTER"
fi

$COMPOSE build app
$COMPOSE run --rm app npx prisma migrate deploy
$COMPOSE up -d

# `up -d` returning is not the app answering.
i=0
while [ "$i" -lt 30 ]; do
  if curl -fsS -o /dev/null http://127.0.0.1:3000/; then
    echo "app answering on 127.0.0.1:3000 — now $AFTER"
    exit 0
  fi
  i=$((i + 1))
  sleep 2
done

echo "app did not answer within 60s" >&2
$COMPOSE logs --tail 60 app >&2
echo >&2
echo "rollback:  git reset --hard $BEFORE && $COMPOSE up -d --build" >&2
exit 1
