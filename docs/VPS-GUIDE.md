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
  basicauth {
    dima <bcrypt-hash>
  }
  reverse_proxy localhost:<port>
}
```

To generate a bcrypt password hash:
```bash
caddy hash-password --plaintext yourpassword
```

Then reload Caddy:
```bash
sudo systemctl reload caddy
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
            cd /home/dima/<app-name>
            git pull
            npm run build
            sudo systemctl restart <app-name>
```

Add secrets in GitHub → repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `VPS_HOST` | `46.225.78.10` |
| `VPS_USER` | `dima` |
| `VPS_SSH_KEY` | Contents of `~/.ssh/id_ed25519` (local machine) |

The VPS public key must be in `/home/dima/.ssh/authorized_keys` (it already is for existing apps).

To get your local private key:
```bash
cat ~/.ssh/id_ed25519   # run locally, NOT on VPS
```

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

## Port allocation log

| Port | App |
|---|---|
| 4111 | jobsearch |
| 4112 | writing-app |
| 4113 | daily-log |
| 4114 | next available |
