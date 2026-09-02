# deploy/

Machine-specific files for the Mac mini beta. `docs/MAC.md` is the narrative
with the reasoning; these are the templates it points at, versioned so a rebuild
does not start from a blank editor.

Nothing here is read by the application or copied into the Docker image.

## This machine

- Runtime: **OrbStack** (provides `docker` at `/usr/local/bin/docker`).
- Checkout: `~/grantoid` — the paths in the plists are absolute to it.
- The schedule jobs are **LaunchAgents**, not Daemons: OrbStack's docker socket
  lives in the user session, and automatic login keeps that session up across
  reboots (`docs/MAC.md` §4).

## Files

| File | Goes to | Set up by |
|---|---|---|
| `cloudflared/config.yml` | `/etc/cloudflared/config.yml` | `docs/MAC.md` §5 |
| `cloudflared/com.cloudflare.cloudflared.plist` | `/Library/LaunchDaemons/` | `docs/MAC.md` §5 |
| `launchd/ua.grantoid.ollama.plist` | `~/Library/LaunchAgents/` | `docs/MAC.md` §2 |
| `launchd/ua.grantoid.nightly.plist` | `~/Library/LaunchAgents/` | `docs/MAC.md` §6 |
| `launchd/ua.grantoid.digest.plist` | `~/Library/LaunchAgents/` | `docs/MAC.md` §6 |
| `launchd/ua.grantoid.backup.plist` | `~/Library/LaunchAgents/` | `docs/MAC.md` §7 |
| `backup.sh` | run in place from the checkout by the backup job | `docs/MAC.md` §7 |

Load an agent with `launchctl load ~/Library/LaunchAgents/<file>` — no sudo.
The cloudflared daemon is the one root service: `sudo launchctl bootstrap
system /Library/LaunchDaemons/com.cloudflare.cloudflared.plist`.

`APP_BASE_URL`, `POSTGRES_PASSWORD` and the rest live in `.env` on the machine —
see `.env.example`. They are not in this directory because `.env` is gitignored
for a reason and a template that looks like a filled-in one gets copied as is.
