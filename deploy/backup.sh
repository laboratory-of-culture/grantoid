#!/bin/sh
# Database and uploaded files, backed up together.
#
#   deploy/backup.sh /Volumes/backup
#
# The two must be copied as one job: the database without the files is links to
# documents that 404, the files without the database are documents nobody can
# reach. docs/MAC.md §7.
#
# A copy on the same disk is not a copy — point the target at an external
# volume. If FileVault is off (docs/MAC.md §4), encrypt the output before it
# leaves the room: pipe through `age -r <key>` or keep the target an encrypted
# volume.

set -eu

DEST="${1:-/Volumes/backup}"
DOCKER="${DOCKER:-/usr/local/bin/docker}"
[ -x "$DOCKER" ] || DOCKER="docker"   # fall back to PATH
COMPOSE="$DOCKER compose -f docker-compose.prod.yml -f docker-compose.mac.yml"
STAMP="$(date +%F)"

if [ ! -d "$DEST" ]; then
  echo "backup target does not exist: $DEST" >&2
  echo "mount the external volume, or pass the path as the first argument" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

echo "→ database"
$COMPOSE exec -T db pg_dump -U grant grant_assistant | gzip > "$DEST/db-$STAMP.sql.gz"

echo "→ storage volume"
"$DOCKER" run --rm \
  -v grant-assistant_storage:/data \
  -v "$DEST":/backup \
  alpine tar czf "/backup/storage-$STAMP.tar.gz" -C /data .

echo "done: $DEST/db-$STAMP.sql.gz, $DEST/storage-$STAMP.tar.gz"

# A backup that has never been restored is a guess. At least once, restore
# db-*.sql.gz into an empty database and confirm the app reads it.
