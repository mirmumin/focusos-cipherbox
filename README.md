# ⚡ FocusOS — Cipherbox Edition

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Kali%20Linux-557C94?style=for-the-badge&logo=kalilinux&logoColor=white"/>
  <img src="https://img.shields.io/badge/Hardware-Raspberry%20Pi%204%20(8GB)-C51A4A?style=for-the-badge&logo=raspberrypi&logoColor=white"/>
  <img src="https://img.shields.io/badge/Runtime-Node.js%2020-339933?style=for-the-badge&logo=nodedotjs&logoColor=white"/>
  <img src="https://img.shields.io/badge/AI-Groq%20%2B%20Gemini-FF6B35?style=for-the-badge&logo=google&logoColor=white"/>
  <img src="https://img.shields.io/badge/Database-SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white"/>
  <img src="https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white"/>
</p>

> *"Your operating system for deep work — running on custom silicon, inside a hand-built cyberdeck."*

A self-hosted, full-stack personal productivity OS with task management, Pomodoro focus sessions, journaling, AI-powered planning, and real-time analytics. Built to run 24/7 on a custom **Cipherbox** cyberdeck — a Raspberry Pi 4 (8GB) encased in a bespoke hardware shell with a 7-inch touch display. Installable as a PWA on Android for mobile access.

---

## 👤 Developer

**Mir Mumin** — Computer Science & Engineering (CSE) student.

This project was designed, built, and customized from the ground up as a personal productivity infrastructure project. The Cipherbox Edition represents a full-stack systems build: custom hardware assembly, OS-level configuration on Kali Linux, a Node.js/Express backend, a vanilla JS frontend with PWA support, and a hand-crafted Hybrid AI Architecture using two separate LLM providers selected for their distinct performance characteristics.

---

## Table of Contents

1. [What FocusOS Is](#what-focusos-is)
2. [Hybrid AI Architecture](#hybrid-ai-architecture)
3. [Project Structure](#project-structure)
4. [Environment Variables](#environment-variables)
5. [Local Development](#local-development)
6. [Cipherbox Deployment (Kali Linux)](#cipherbox-deployment-kali-linux)
7. [Android PWA Installation](#android-pwa-installation)
8. [Backup and Restore](#backup-and-restore)
9. [SQLite Backup Cron Job](#sqlite-backup-cron-job)
10. [Production Optimizations](#production-optimizations)
11. [Final Deployment Checklist](#final-deployment-checklist)
12. [Daily Backup Strategy](#daily-backup-strategy)
13. [Cipherbox Hardware Specs](#cipherbox-hardware-specs)

---

## What FocusOS Is

FocusOS is a single-owner, self-hosted productivity web application — a personal command center for deep work. No subscriptions, no cloud lock-in, no tracking. Your data lives on hardware you own, in a room you control.

- **Task management** — priorities, difficulty ratings, recurring tasks, subtasks, and tags
- **Focus sessions** — Pomodoro-style timer with interruption tracking and session history
- **Projects & goals** — linked to categories for structured long-term planning
- **Daily journaling** — mood, energy, and productivity ratings with historical trends
- **Hybrid AI planning** — dual-LLM architecture (see below) for coaching, insights, planning, and reflection
- **Analytics dashboard** — pattern recognition across tasks, focus sessions, and journal entries
- **Notes** — tagged, categorized, full-text searchable
- **Admin panel** — user management, server stats, and global settings

The entire backend is a single Node.js/Express process. All data is stored in two SQLite files. There is no external database server to manage or secure.

---

## Hybrid AI Architecture

> **This is the most technically significant design decision in the project.** Instead of routing all AI features through a single provider, FocusOS uses a purpose-built dual-LLM architecture — each model deployed where its specific strengths matter most.

```
┌─────────────────────────────────────────────────────────────────┐
│                    FocusOS AI Request Router                    │
│                      backend/routes/ai.js                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌─────────────────┐             ┌─────────────────────┐
│  GROQ API       │             │  GOOGLE GEMINI API  │
│  Llama 3 (8B)   │             │  Gemini 1.5 Flash   │
│                 │             │                     │
│  Routes:        │             │  Routes:            │
│  • /coach       │             │  • /plan            │
│  • /insight     │             │  • /reflect         │
│                 │             │                     │
│  ⚡ Sub-200ms   │             │  📄 1M token window │
│  real-time      │             │  Strict JSON output │
│  responses      │             │  Heavy data parsing │
└─────────────────┘             └─────────────────────┘
```

### Why Two Models?

| Feature Route | Model | Reason |
|---|---|---|
| `/api/ai/coach` | **Groq — Llama 3 8B** | The AI coach needs to feel instantaneous. Groq's hardware-accelerated inference delivers sub-200ms responses, making the coaching experience feel reactive and real-time on the dashboard. |
| `/api/ai/insight` | **Groq — Llama 3 8B** | Quick analytical summaries of recent activity. Low latency keeps the dashboard snappy. |
| `/api/ai/plan` | **Gemini 1.5 Flash** | Daily planning ingests the full task backlog, journal history, and project context — often 50,000+ tokens. Gemini's 1M-token context window handles this without truncation. |
| `/api/ai/reflect` | **Gemini 1.5 Flash** | Reflection analysis requires parsing and returning large, strictly structured JSON objects. Gemini's instruction-following and JSON formatting reliability is unmatched for this use case. |

### Key Insight

> **Groq is faster. Gemini sees more.** Using the right tool for each job delivers an experience that neither model could provide alone — real-time conversational AI for the coach, and deep-context structured intelligence for planning. This is the kind of architecture decision that separates production systems from demos.

---

## Project Structure

```
focusos/
├── backend/
│   ├── server.js              # Entry point — Express app, session setup, owner seeding
│   ├── ai/
│   │   ├── gemini.js          # Google Gemini 1.5 Flash client (/plan, /reflect routes)
│   │   ├── groq.js            # Groq Llama 3 8B client (/coach, /insight routes)
│   │   └── memory.js          # AI memory, burnout detection, adaptive suggestions
│   ├── auth/
│   │   └── routes.js          # Login, logout, register, /me endpoints
│   ├── database/
│   │   ├── db.js              # SQLite connection, schema creation (better-sqlite3)
│   │   └── session-store.js   # Custom SQLite-backed session store
│   ├── middleware/
│   │   └── auth.js            # requireAuth and requireOwner middleware
│   └── routes/
│       ├── admin.js           # User management, global settings, server stats
│       ├── ai.js              # AI plan, coach, insight, reflect, burnout detection
│       ├── analytics.js       # Productivity analytics endpoints
│       ├── entities.js        # Categories, goals, projects CRUD
│       ├── journal.js         # Reflections and energy logs
│       ├── phase2.js          # Subtasks, widget layouts, timer presets, task tags
│       └── tasks.js           # Tasks CRUD with recurring task support
├── frontend/
│   ├── index.html             # Single-page app shell
│   ├── app.js                 # Core app logic
│   ├── phase2.js              # Subtasks, widgets, timer presets
│   ├── phase3.js              # AI coach, burnout alerts, insight panel
│   ├── style.css              # All styles (dark theme)
│   ├── manifest.json          # PWA manifest (icons, shortcuts, display mode)
│   └── sw.js                  # Service worker for offline caching
├── generate-icons.js          # Script to generate PWA icon PNG files
├── package.json
└── .env.example               # Template for your .env file
```

**npm scripts:**

| Command | What it does |
|---|---|
| `npm start` | Start the server with `node backend/server.js` |
| `npm run dev` | Start with `node --watch` (auto-restarts on file changes) |

**Database files** (auto-created on first run inside `backend/`):

| File | Purpose |
|---|---|
| `backend/planner.db` | All application data |
| `backend/sessions.db` | User login sessions |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | **Yes** | Your Groq API key. Powers the `/coach` and `/insight` routes via Llama 3 8B. Get one free at https://console.groq.com |
| `GEMINI_API_KEY` | **Yes** | Your Google Gemini API key. Powers the `/plan` and `/reflect` routes. Get one free at https://aistudio.google.com |
| `SESSION_SECRET` | **Yes** | A long random string used to sign session cookies. Never share this. |
| `PORT` | No | Port to listen on. Defaults to `3000`. |
| `OWNER_USERNAME` | No | Username for the admin account created on first run. Defaults to `admin`. |
| `OWNER_PASSWORD` | No | Password for the admin account. Defaults to `changeme123`. **Change this immediately.** |
| `NODE_ENV` | No | Set to `production` for all deployments outside local dev. |

**Generating a secure `SESSION_SECRET`:**

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> **Note:** The owner account is created only once — on first startup when no `owner` role user exists. Changing `OWNER_USERNAME` or `OWNER_PASSWORD` in `.env` after the first run has no effect. Use the admin panel to reset credentials after initial setup.

---

## Local Development

### Prerequisites

- Node.js 18 or later (`node --version` to check)
- npm (bundled with Node.js)
- A Groq API key and a Gemini API key (AI routes are skipped gracefully if either is absent)

### Steps

```bash
# 1. Enter the project folder
cd focusos

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env
# Edit .env — at minimum set SESSION_SECRET, GROQ_API_KEY, and GEMINI_API_KEY

# 4. Start in development mode (auto-restarts on file changes)
npm run dev
```

Open `http://localhost:3000` in your browser.

Log in with the credentials set in `.env` (defaults: `admin` / `changeme123`).

### Generating PWA Icons (optional for local dev)

The PWA manifest references `icon-192.png` and `icon-512.png` inside `/assets/`. To generate them:

```bash
node generate-icons.js
```

This creates `frontend/assets/icon-192.png` and `frontend/assets/icon-512.png`.

---

## Cipherbox Deployment (Kali Linux)

This guide targets the **Cipherbox** build: a Raspberry Pi 4 (8GB) running **Kali Linux** (full desktop environment), connected to an official 7-inch Raspberry Pi touch display, enclosed in a custom cyberdeck chassis.

> Unlike a headless Raspberry Pi OS Lite setup, this configuration runs a full GUI. The deployment steps below are calibrated for Kali Linux and the `kali` default user.

### Step 1 — Flash and boot the Cipherbox

Use [Raspberry Pi Imager](https://www.raspberrypi.com/software/) to flash **Kali Linux for Raspberry Pi** onto your SD card or USB SSD. Boot the Cipherbox and complete initial system setup via the touch display.

### Step 2 — Update the system

```bash
sudo apt update && sudo apt full-upgrade -y
```

### Step 3 — Install Node.js

Kali's default Node.js may be outdated. Install a current LTS version via NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # should show v20.x or later
```

### Step 4 — Deploy the project

Clone from your repository or copy from your development machine:

```bash
# Option A: Clone from git
git clone https://your-repo-url.git /home/kali/focusos

# Option B: Copy from your laptop
scp -r ./focusos kali@focusos.local:/home/kali/focusos
```

### Step 5 — Install dependencies and configure

```bash
cd /home/kali/focusos
npm install
cp .env.example .env
nano .env
```

Set the following at minimum:

- `GROQ_API_KEY` — your Groq key (for `/coach` and `/insight`)
- `GEMINI_API_KEY` — your Gemini key (for `/plan` and `/reflect`)
- `SESSION_SECRET` — a long random string
- `OWNER_PASSWORD` — something strong and unique
- `NODE_ENV=production`

### Step 6 — Generate PWA icons

```bash
node generate-icons.js
```

### Step 7 — Set up systemd to run FocusOS automatically

Create a systemd service so FocusOS starts on boot and restarts on crash:

```bash
sudo nano /etc/systemd/system/focusos.service
```

Paste the following:

```ini
[Unit]
Description=FocusOS Productivity Server — Cipherbox Edition
After=network.target

[Service]
Type=simple
User=kali
WorkingDirectory=/home/kali/focusos
ExecStart=/usr/bin/node backend/server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/home/kali/focusos/.env

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable focusos
sudo systemctl start focusos
sudo systemctl status focusos
```

FocusOS is now running on `http://focusos.local:3000`.

### Step 8 — (Optional) Serve on port 80 without root

Use an iptables redirect to avoid running Node as root:

```bash
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3000
# Make it persistent across reboots
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

FocusOS is now accessible at `http://focusos.local` (no port needed).

### Step 9 — (Optional) HTTPS with a self-signed certificate

Install nginx as a reverse proxy:

```bash
sudo apt install -y nginx
```

Create a site config:

```bash
sudo nano /etc/nginx/sites-available/focusos
```

```nginx
server {
    listen 443 ssl;
    server_name focusos.local;

    ssl_certificate     /etc/ssl/certs/focusos.crt;
    ssl_certificate_key /etc/ssl/private/focusos.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Generate the self-signed certificate:

```bash
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/ssl/private/focusos.key \
  -out /etc/ssl/certs/focusos.crt \
  -subj "/CN=focusos.local"

sudo ln -s /etc/nginx/sites-available/focusos /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

### Useful management commands

```bash
# Stream live server logs
sudo journalctl -u focusos -f

# Restart after a code update
sudo systemctl restart focusos

# Stop the server
sudo systemctl stop focusos

# Check service status
sudo systemctl status focusos
```

---

## Android PWA Installation

FocusOS ships with a full PWA manifest and service worker. Once installed it behaves like a native app — no app store required.

### Requirements

- FocusOS must be running and reachable on your local network
- Chrome for Android (version 80+)

### Steps

1. Open Chrome on your Android device
2. Navigate to `http://focusos.local:3000` (or your Cipherbox's local IP)
3. Log in with your credentials
4. Tap the **three-dot menu (⋮)** in the top-right corner
5. Tap **"Add to Home screen"** or **"Install app"**
6. Confirm by tapping **"Add"** / **"Install"**

FocusOS appears on your home screen with its own icon and opens in standalone mode (no browser chrome).

### Shortcuts

Long-pressing the FocusOS icon on Android exposes quick shortcuts:
- **Add Task** — jumps directly to the task input
- **Dashboard** — opens the main analytics dashboard

### Offline behaviour

The service worker caches all static assets (HTML, CSS, JS, manifest). The app shell loads offline. API calls (live data) require a connection to your Cipherbox.

### Troubleshooting PWA installation

If the "Install app" option does not appear:
- Confirm you are on HTTPS or a local network address. Some Android Chrome versions require HTTPS for PWA install prompts on non-localhost addresses.
- Verify that `frontend/assets/icon-192.png` and `icon-512.png` exist (run `node generate-icons.js` if not).
- Check service worker registration: Chrome DevTools → Application → Service Workers.

---

## Backup and Restore

FocusOS stores everything in two SQLite files:

| File | Contents |
|---|---|
| `backend/planner.db` | All tasks, notes, journals, goals, settings |
| `backend/sessions.db` | Active login sessions (safe to delete — users simply log in again) |

### Manual Backup

```bash
# Safe hot-backup using SQLite's built-in .backup command (works while server is running)
sqlite3 /home/kali/focusos/backend/planner.db ".backup '/home/kali/backups/planner-$(date +%Y%m%d).db'"
sqlite3 /home/kali/focusos/backend/sessions.db ".backup '/home/kali/backups/sessions-$(date +%Y%m%d).db'"
```

### Copy Backup to Your Laptop

```bash
# Run from your laptop, not the Cipherbox
scp kali@focusos.local:/home/kali/backups/planner-$(date +%Y%m%d).db ~/focusos-backups/
```

### Restore from Backup

```bash
# 1. Stop the server
sudo systemctl stop focusos

# 2. Replace the database file
cp /home/kali/backups/planner-20240101.db /home/kali/focusos/backend/planner.db

# 3. Restart the server
sudo systemctl start focusos
```

> **Always stop the server before restoring.** Replacing a live SQLite file while the process holds it open can corrupt data.

---

## SQLite Backup Cron Job

Runs every day at 2 AM — creates a safe backup and retains only the 14 most recent copies.

### Setup

```bash
# Create the backup directory
mkdir -p /home/kali/backups

# Open the crontab editor
crontab -e
```

Add the following line:

```
0 2 * * * sqlite3 /home/kali/focusos/backend/planner.db ".backup '/home/kali/backups/planner-$(date +\%Y\%m\%d).db'" && find /home/kali/backups -name "planner-*.db" -mtime +14 -delete
```

### Verify the cron job

```bash
# Confirm cron is running
systemctl status cron

# List your current crontab
crontab -l

# Manually trigger a test backup
sqlite3 /home/kali/focusos/backend/planner.db ".backup '/home/kali/backups/planner-test.db'"
ls -lh /home/kali/backups/
```

### Optional: push backups off the Cipherbox automatically

Add a second crontab line to push backups to another machine via SCP:

```
30 2 * * * scp /home/kali/backups/planner-$(date +\%Y\%m\%d).db user@your-laptop-ip:/backups/focusos/
```

This requires SSH key authentication between the Cipherbox and the destination (no password prompt).

---

## Production Optimizations

Small, high-impact changes to make before relying on FocusOS daily.

### 1. Set `NODE_ENV=production`

Already covered in the `.env` setup. Enables Express performance optimizations and reduces error detail in API responses.

### 2. Set a strong `SESSION_SECRET`

A weak default means any intercepted cookie can be forged. Generate a proper one:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Change the default admin password

The default `changeme123` is in `.env.example` and is public knowledge. Change it in `.env` before first run, or reset it via the admin panel.

### 4. Reduce SD card / SSD writes

SQLite WAL mode (already enabled) significantly reduces write pressure. Additionally, move `/tmp` to RAM:

```bash
sudo nano /etc/fstab
# Add this line:
tmpfs /tmp tmpfs defaults,noatime,nosuid,size=64m 0 0
```

### 5. Keep Node.js up to date

Security patches ship regularly. Check every few months:

```bash
node --version
# Compare against https://nodejs.org/en/download (LTS)
```

### 6. Monitor disk space

SQLite databases grow over time:

```bash
df -h
ls -lh /home/kali/focusos/backend/*.db
```

The admin panel (`/api/admin/stats`) also reports current database size.

### 7. Enable the Pi's hardware watchdog

Automatically reboots the Cipherbox if it freezes — important for an always-on device:

```bash
sudo nano /etc/systemd/system.conf
# Set: RuntimeWatchdogSec=15

sudo nano /boot/firmware/config.txt
# Add: dtparam=watchdog=on

sudo reboot
```

### 8. Lock down the `.env` file

```bash
chmod 600 /home/kali/focusos/.env
```

---

## Final Deployment Checklist

**Server setup**
- [ ] Cipherbox is running Kali Linux with GUI
- [ ] Node.js 20.x (LTS) is installed and verified
- [ ] `npm install` completed without errors inside `focusos/`
- [ ] `.env` file created with all required variables
- [ ] `GROQ_API_KEY` set (for `/coach` and `/insight` routes)
- [ ] `GEMINI_API_KEY` set (for `/plan` and `/reflect` routes)
- [ ] `SESSION_SECRET` is a cryptographically random string
- [ ] `OWNER_PASSWORD` is changed from the default
- [ ] `NODE_ENV=production` is set in `.env`
- [ ] `node generate-icons.js` was run successfully
- [ ] Server starts cleanly: `npm start` shows `FocusOS running on :3000`

**Systemd service**
- [ ] `/etc/systemd/system/focusos.service` created with `User=kali` and `WorkingDirectory=/home/kali/focusos`
- [ ] `sudo systemctl enable focusos` — starts on boot
- [ ] `sudo systemctl start focusos` — running now
- [ ] `sudo systemctl status focusos` — shows `active (running)`
- [ ] `sudo journalctl -u focusos -f` — no errors in logs

**Networking**
- [ ] FocusOS is reachable from another device on the same network
- [ ] Port 80 redirect configured (or access on `:3000` is acceptable)
- [ ] Cipherbox has a static local IP assigned in your router's DHCP settings

**Security**
- [ ] Admin password is strong and unique
- [ ] `.env` file permissions locked: `chmod 600 /home/kali/focusos/.env`
- [ ] FocusOS is not exposed to the public internet (local network only)

**Backups**
- [ ] `/home/kali/backups/` directory created
- [ ] Cron job added and verified working
- [ ] At least one manual backup tested and successfully restored

**PWA (Android)**
- [ ] PWA icons exist at `frontend/assets/icon-192.png` and `icon-512.png`
- [ ] App installs to home screen from Chrome
- [ ] App opens in standalone mode (no browser address bar)
- [ ] Shortcuts work (Add Task, Dashboard)

---

## Daily Backup Strategy

**3-2-1 rule, adapted for home infrastructure:**

- **3 copies** — live database on the Cipherbox, daily backup on the Cipherbox, weekly copy on your laptop
- **2 storage types** — the Cipherbox's SSD and your laptop's drive
- **1 offsite copy** — a USB drive at a separate location, or a private encrypted cloud sync

**Daily automated backup (2 AM)**

The cron job described in [SQLite Backup Cron Job](#sqlite-backup-cron-job) handles this automatically with a 14-day rolling window.

**Weekly copy to your laptop**

```bash
# Run from your laptop
scp kali@focusos.local:/home/kali/backups/planner-$(date +%Y%m%d).db ~/focusos-backups/
```

**Before any major change (code update, OS upgrade, migration)**

Always take a manual snapshot immediately before the change:

```bash
sqlite3 /home/kali/focusos/backend/planner.db ".backup '/home/kali/backups/planner-pre-update.db'"
```

**Recovery time expectation:** Under 2 minutes (stop server → copy file → start server). Maximum data loss in a worst-case failure: 24 hours.

---

## Cipherbox Hardware Specs

This is the exact hardware configuration FocusOS — Cipherbox Edition runs on. It is not the minimum viable setup — it is the *reference* build.

**Cipherbox Reference Build**

| Component | Specification |
|---|---|
| **Board** | Raspberry Pi 4 Model B — **8GB RAM** |
| **Display** | Official Raspberry Pi 7-inch Touch Display (800×480, capacitive multitouch) |
| **Chassis** | Custom **"Cipherbox"** cyberdeck enclosure (hand-built) |
| **OS** | **Kali Linux** — full desktop environment |
| **Storage** | USB SSD (recommended: Samsung T7 or Kingston XS2000, 120GB+) |
| **Power** | Official Raspberry Pi USB-C power supply (5.1V / 3A) |
| **Network** | Ethernet (primary) + onboard Wi-Fi (fallback) |

**Why 8GB RAM?**

With Kali Linux running a full GUI, a Node.js server, and two concurrent AI API integrations, headroom matters. The 8GB configuration ensures the server never competes with the desktop environment for memory, even under peak AI workload.

**Why Kali Linux?**

Kali provides a professional-grade Debian-based environment with an up-to-date package repository, built-in network tooling, and a polished GUI — making it ideal as both a productivity OS and a development/security research platform on the same hardware.

**Why SSD over SD card?**

SQLite writes on every task update, focus session event, and journal entry. SD cards have limited write endurance and are the most common point of failure in Pi deployments. A quality USB SSD lasts years longer, is meaningfully faster, and makes the Cipherbox genuinely reliable as daily infrastructure.

**Booting from USB SSD on Pi 4**

The Pi 4 supports USB boot natively after a one-time bootloader update (no SD card required). Official guide: https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#usb-mass-storage-boot

---

<p align="center">
  Built with obsessive attention to detail by <strong>Mir Mumin</strong> · CSE Student · Cipherbox Edition
</p>
