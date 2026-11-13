# Deploying the portal to a Hostinger VPS (CI/CD)

After this one-time setup, every push to `main` is checked on GitHub and then deployed to the server by
`.github/workflows/deploy.yml`. Pull requests are checked but never deployed.

How a deploy works:

1. GitHub runs lint, typecheck, tests and a build. Any failure stops the pipeline and the live site is untouched.
2. GitHub uploads exactly that commit to the server over SSH (the server needs no GitHub access).
3. `deploy/deploy.sh` backs up the SQLite database, builds the commit in a new `releases/` folder, switches the
   `current` link and restarts the service.
4. If the new release does not answer on `/login`, the script switches back to the previous release.

## 1. Server (once, as root)

Use Ubuntu 24.04. Replace `portal.example.com` with your domain and point its DNS A record at the VPS first.

```bash
apt update && apt upgrade -y
adduser --disabled-password --gecos "" deploy
apt install -y curl git sqlite3 caddy
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs

ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

mkdir -p /opt/ark_portal/{shared,releases,incoming,backups} /var/lib/ark-portal
chown -R deploy:deploy /opt/ark_portal /var/lib/ark-portal
```

Copy the files from this folder to the server (from your PC, in the repo folder):

```bash
scp deploy/ark-portal.service root@SERVER_IP:/etc/systemd/system/ark-portal.service
scp deploy/sudoers-ark-portal root@SERVER_IP:/etc/sudoers.d/ark-portal
scp deploy/Caddyfile root@SERVER_IP:/etc/caddy/Caddyfile
```

On the server, edit `/etc/caddy/Caddyfile` to use your domain, then:

```bash
chmod 440 /etc/sudoers.d/ark-portal && visudo -c
systemctl daemon-reload && systemctl enable ark-portal
systemctl reload caddy
```

## 2. Secrets file on the server (once)

Create `/opt/ark_portal/shared/.env.local` as the `deploy` user and run `chmod 600` on it:

```
EXTRACTION_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
FLIGHT_PROVIDER=duffel
DUFFEL_ENV=test
DUFFEL_TEST_ACCESS_TOKEN=...
DUFFEL_LIVE_ACCESS_TOKEN=...
PORTAL_DATABASE_PATH=/var/lib/ark-portal/portal.sqlite
PORTAL_SETUP_KEY=<output of: openssl rand -hex 32>
```

Use new keys here, not ones that have been pasted into chats. Start with `DUFFEL_ENV=test` and switch to `live` when ready.

## 3. SSH key for GitHub (once)

On your PC:

```bash
ssh-keygen -t ed25519 -f ark-deploy -N "" -C "github-actions-deploy"
```

- Append `ark-deploy.pub` to `/home/deploy/.ssh/authorized_keys` on the server (create the folder with mode 700, the file with 600, owned by `deploy`).
- Get the server's host key: `ssh-keyscan -t ed25519 SERVER_IP`
- Then delete the private key file from your PC once it is stored in GitHub.

## 4. GitHub settings (once)

In the repo, go to Settings, Environments, and create an environment named `ark-portal` (the name used by `environment:` in the workflow). Optionally add yourself as a
required reviewer there if you want to approve each deploy. Add these **environment secrets**:

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | server IP or domain |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | full contents of the private key file `ark-deploy` |
| `DEPLOY_KNOWN_HOSTS` | the line printed by `ssh-keyscan` |
| `DEPLOY_PORT` | only if SSH is not on port 22 |

Also turn on branch protection for `main` (Settings, Branches) and require the "Lint, typecheck, test, build"
check, so broken code cannot reach `main`.

## 5. First deploy and admin account

Push to `main` (or run the workflow from the Actions tab). When it is green, open `https://your-domain/login`
and create the administrator with the setup key. Then remove `PORTAL_SETUP_KEY` from
`/opt/ark_portal/shared/.env.local` and run `sudo systemctl restart ark-portal`.

## Everyday use

- Deploy: merge or push to `main`.
- Logs: `journalctl -u ark-portal -f`
- Roll back by hand: point `current` at an older folder in `/opt/ark_portal/releases/` and restart, for example
  `ln -sfn /opt/ark_portal/releases/<folder> /opt/ark_portal/current && sudo systemctl restart ark-portal`.
- Database backups from each deploy are in `/opt/ark_portal/backups/`. Rolling back code does not roll back
  data, so restore a backup only if a release changed the data it should not have.
