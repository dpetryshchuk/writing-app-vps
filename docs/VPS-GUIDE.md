# VPS Deploy Guide — dmytropetryshchuk.com

Everything needed to add a new web app to the server.

---

## Server

| | |
|---|---|
| **Provider** | Hetzner CX22 |
| **IP** | `46.225.78.10` |
| **OS** | Ubuntu 22.04 |
| **SSH user** | `dima` |
| **SSH** | `ssh dima@46.225.78.10` |
| **Domain registrar** | Porkbun |
| **Root domain** | `dmytropetryshchuk.com` |

---

## Installed software

- **Node.js** — app runtime (`node`, `npm`)
- **Caddy** — reverse proxy + automatic HTTPS (`/etc/caddy/Caddyfile`)
- **systemd** — process management (`/etc/systemd/system/`)

---

## Running apps

| App | Port | Domain | Service | Repo path |
|---|---|---|---|---|
| jobsearch CRM | 4111 | `jobsearch.dmytropetryshchuk.com` | `jobsearch` | `/home/dima/jobsearch` |
| writing app | 4112 | `write.dmytropetryshchuk.com` | `writing` | `/home/dima/writing-app` |
| daily log | 4113 | `log.dmytropetryshchuk.com` | `daily-log` | `/home/dima/daily-log` |

**Next available port:** 4114

---

## Adding a new app — checklist

### 1. Clone the repo on the VPS

```bash
ssh dima@46.225.78.10
cd /home/dima
git clone https://github.com/dpetryshchuk/<repo-name>.git <app-name>
cd <app-name>
npm install
```

Create `.env` if needed:
```bash
nano .env
# PORT=4113
# CONTENT_DIR=/home/dima/<app-name>/data
```

### 2. Build (if applicable)

```bash
npm run build   # runs tsc + frontend build
```

### 3. Create the systemd service

```bash
sudo nano /etc/systemd/system/<app-name>.service
```

Paste (adjust `<app-name>`, port, entry point):

```ini
[Unit]
Description=<App Display Name>
After=network.target

[Service]
Type=simple
User=dima
WorkingDirectory=/home/dima/<app-name>
EnvironmentFile=/home/dima/<app-name>/.env
ExecStart=/usr/bin/node /home/dima/<app-name>/dist/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable <app-name>
sudo systemctl start <app-name>
sudo systemctl status <app-name>   # verify it's running
```

### 4. Add a Caddy vhost

```bash
sudo nano /etc/caddy/Caddyfile
```

Append a new block (adjust domain and port):

```caddy
<subdomain>.dmytropetryshchuk.com {
  basic_auth {
    dima <bcrypt-hash>
  }
  reverse_proxy localhost:<port>
}
```

To generate a bcrypt password hash:
```bash
caddy hash-password --plaintext yourpassword
```

**Important — writing hashes to the Caddyfile:** bcrypt hashes contain `$` signs (`$2a$14$...`). Never embed them in a shell heredoc with double quotes — bash expands `$2`, `$14` etc. as variables and silently mangles the hash. Write the file with a text editor (`nano`) or via Python/sftp. Always validate before reloading:

```bash
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Then reload Caddy:
```bash
sudo systemctl reload caddy
```

**If a reload fails:** Caddy gets stuck in a reload-timeout loop every ~90 seconds. Fix the Caddyfile, validate it, then do a **full restart** (not reload) to recover:
```bash
sudo systemctl restart caddy
```

Caddy handles HTTPS automatically (Let's Encrypt). No cert setup needed.

### 5. Add DNS record on Porkbun

1. Go to porkbun.com → DNS → `dmytropetryshchuk.com`
2. Add an **A record**:
   - Host: `<subdomain>` (e.g. `write`, `notes`, `tools`)
   - Answer: `46.225.78.10`
   - TTL: 600
3. Wait ~2 minutes for propagation

Caddy will fetch the TLS cert automatically once DNS resolves.

### 6. Set up GitHub Actions auto-deploy

Add `.github/workflows/deploy.yml` to the repo:

```yaml
name: Deploy

on:
  push:
    branches: [master]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            set -e
            cd /home/dima/<app-name>
            git fetch origin master
            git reset --hard origin/master
            npm install
            npm run build
            sudo systemctl restart <app-name>
```

**Use `git fetch + git reset --hard` instead of `git pull`.** `npm install` modifies `package-lock.json`, making the working tree dirty — `git pull` then fails on subsequent deploys. `reset --hard` discards local changes before pulling.

Add secrets in GitHub → repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `VPS_HOST` | `46.225.78.10` |
| `VPS_USER` | `dima` |
| `VPS_SSH_KEY` | Private key for a keypair whose public key is in `/home/dima/.ssh/authorized_keys` |

**Generating a dedicated deploy keypair** (recommended — one key per app):

On the VPS:
```bash
ssh-keygen -t ed25519 -C "github-actions-<app-name>" -f ~/.ssh/<app-name>_deploy -N ""
cat ~/.ssh/<app-name>_deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/<app-name>_deploy   # copy this — it's the VPS_SSH_KEY secret value
```

Then set the secrets locally with `gh`:
```bash
gh secret set VPS_HOST --repo dpetryshchuk/<repo> --body "46.225.78.10"
gh secret set VPS_USER --repo dpetryshchuk/<repo> --body "dima"
gh secret set VPS_SSH_KEY --repo dpetryshchuk/<repo> < ~/.ssh/<app-name>_deploy
```

**VPS → GitHub auth (for private repos):** The deploy script runs `git fetch` on the VPS, which also needs GitHub auth. Generate a separate keypair for this:

```bash
# On VPS:
ssh-keygen -t ed25519 -C "vps-<app-name>-github" -f ~/.ssh/id_<app-name>_github -N ""
cat ~/.ssh/id_<app-name>_github.pub   # add this as a Deploy Key in GitHub repo Settings
```

Add to `~/.ssh/config` on the VPS:
```
Host github-<app-name>
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_<app-name>_github
  IdentitiesOnly yes
```

Set the remote to use the SSH alias:
```bash
git remote set-url origin git@github-<app-name>:dpetryshchuk/<repo>.git
```

Add the public key to GitHub: repo → Settings → Deploy keys → Add deploy key (read-only).

---

## Common commands

```bash
# SSH in
ssh dima@46.225.78.10

# View all running services
systemctl list-units --type=service --state=running

# Tail logs for a service
journalctl -u <app-name> -f

# Restart a service
sudo systemctl restart <app-name>

# Reload Caddy after config changes
sudo systemctl reload caddy

# Check Caddy config syntax
caddy validate --config /etc/caddy/Caddyfile

# View Caddyfile
cat /etc/caddy/Caddyfile
```

---

## Full Caddyfile (current state)

```caddy
jobsearch.dmytropetryshchuk.com {
  basicauth {
    dima <hash>
  }
  handle /api/* {
    reverse_proxy localhost:4111
  }
  handle {
    root * /home/dima/jobsearch/public
    file_server
  }
}

write.dmytropetryshchuk.com {
  basicauth {
    dima <hash>
  }
  reverse_proxy localhost:4112
}
```

---

## Node.js / npm version check

```bash
node --version    # should be v18+
npm --version
```

If Node.js needs upgrading:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## Gotchas

**`__dirname` in compiled TypeScript points to `dist/`, not project root.**
If `outDir` is `dist/` and you serve static files from `public/`, use `path.join(__dirname, '..', 'public')` — not `path.join(__dirname, 'public')`.

**Bcrypt hashes with `$` in shell scripts get mangled.**
Shell (even in single-arg strings) expands `$2`, `$14`, etc. in `$2a$14$...` bcrypt hashes. Always write the Caddyfile with `nano` or validate after writing. Run `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile` before every reload.

**Failed Caddy reload → stuck in timeout loop.**
If `systemctl reload caddy` errors (bad config), Caddy enters a reload-timeout loop visible in `journalctl`. Fix the config and use `systemctl restart caddy` (full restart) to break out of the loop.

**`git pull` fails after `npm install` modifies `package-lock.json`.**
Use `git fetch origin master && git reset --hard origin/master` in deploy scripts instead of `git pull`.

**`basicauth` is deprecated in newer Caddy** — use `basic_auth` (with underscore). Both work but `basicauth` prints a warning on every reload.

**Two separate SSH keys are needed per app:**
- GitHub→VPS key (`VPS_SSH_KEY` secret): allows Actions to SSH into the VPS
- VPS→GitHub key (deploy key in repo settings): allows the VPS to `git fetch` from a private repo

---

## Port allocation log

| Port | App |
|---|---|
| 4111 | jobsearch |
| 4112 | writing-app |
| 4113 | daily-log |
| 4114 | next available |
