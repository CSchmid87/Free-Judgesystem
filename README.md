# Free Judgesystem

A free, self-hosted judging system for freestyle sport events (e.g. ski, snowboard, MTB). Runs on a single laptop over a local network — no internet required. Built with Next.js 15, React 19, and file-based JSON persistence.

## Overview

| Role | URL | Auth |
|------|-----|------|
| **Admin** | `/admin?key=<adminKey>` | Admin key (shown at event creation) |
| **Admin — Create Event** | `/admin/create` | None (first time) / Admin key (overwrite) |
| **Admin — Live Controls** | `/admin/live?key=<adminKey>` | Admin key |
| **Admin — Results** | `/admin/results?key=<adminKey>` | Admin key |
| **Judge** | `/judge?key=<judgeKey>` | Per-judge key (J1 / J2 / J3) |
| **Public** | `/` | None |

## Scoring Model

- **3 judges** (J1, J2, J3), scores **1–100** (integer)
- **2 runs** per category, multiple attempts per run (re-run possible)
- Best attempt per run → best-of-two-runs → final score
- Dense ranking with tie detection

---

## LAN Setup

### Prerequisites

- Node.js 18+ and npm
- A laptop or small server to host the app
- A Wi-Fi router or access point (no internet needed)
- Judges' devices: phones, tablets, or laptops with a browser

### Install & Build

```sh
git clone <repo-url> && cd Free-Judgesystem
npm install
npm run build
```

### Start the Server

```sh
# Default port 3000
npm start

# Custom port
PORT=8080 npx next start -p 8080
```

### Find Your LAN IP

```sh
# macOS
ipconfig getifaddr en0

# Linux
hostname -I | awk '{print $1}'

# Windows (PowerShell)
(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias Wi-Fi).IPAddress
```

Example: if the IP is `192.168.1.42` and port is `3000`, the base URL is `http://192.168.1.42:3000`.

### Connect Devices

1. Connect all devices (admin laptop, judge phones) to the **same Wi-Fi network**
2. On the admin device, open `http://<LAN-IP>:<PORT>/admin/create`
3. Create the event — copy the **Admin URL** and all **Judge URLs**
4. Send each judge their personal URL (e.g. via AirDrop, QR code, or just type it)
5. Judges open their URL in any modern browser — no app install needed

### Firewall

If devices can't connect, check the host machine's firewall:

```sh
# macOS — allow Node through the firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add $(which node)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp $(which node)
```

On Windows, allow Node.js through Windows Defender Firewall (inbound TCP on your port).

---

## Event-Day Checklist

### Before the Event

- [ ] Charge all devices (host laptop, judge phones)
- [ ] Set up the Wi-Fi router / access point
- [ ] Start the server: `npm run build && npm start`
- [ ] Open `/admin/create` and create the event
- [ ] **Save the admin URL** — you need it for the entire event
- [ ] Add all categories (e.g. "Halfpipe", "Slopestyle")
- [ ] Add athletes to each category (manual or CSV import)
- [ ] Distribute judge URLs to J1, J2, J3
- [ ] Verify each judge can load their page and sees "Waiting for active rider"
- [ ] **Dry-run test**: score one dummy athlete through Run 1 & 2, check results, then delete the category

### During the Event

- [ ] Open **Live Controls** (`/admin/live?key=…`)
- [ ] Select the active category
- [ ] Select Run 1
- [ ] For each athlete:
  1. Select the athlete (or use Next ▶)
  2. Wait for all 3 judge scores to appear (green tiles)
  3. Advance to next athlete
- [ ] When Run 1 is complete, **lock Run 1** to prevent accidental edits
- [ ] Switch to Run 2, repeat
- [ ] Lock Run 2 when done
- [ ] Check results on the **Results** page

### After the Event

- [ ] **Export a backup**: open `http://<LAN-IP>:<PORT>/api/export/json?key=<adminKey>` in your browser → save the JSON file
- [ ] **Export CSV results**: open `http://<LAN-IP>:<PORT>/api/export/csv?key=<adminKey>` in your browser → download for spreadsheets
- [ ] Archive the `data/event.json` file as an additional backup

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Judge page shows "Unauthorized" | Wrong judge key in the URL | Re-copy the correct judge URL from the admin create page |
| Judge page shows "Waiting for active rider" | No category/athlete selected in Live Controls | Admin: select a category and verify an athlete is active |
| Score rejected with 409 | No active category or no athletes | Admin: set active category, ensure athletes are added |
| Score rejected with 423 | Run is locked | Admin: unlock the run in Live Controls |
| Devices can't reach the server | Firewall or wrong network | Check all devices are on the same Wi-Fi; open the port in the firewall |
| `EADDRINUSE` on startup | Another process is using the port | Kill it: `lsof -ti:3000 \| xargs kill` or pick a different port |
| Scores not updating on Live page | Browser cache or poll delay | Wait 2 seconds (auto-poll interval) or hard-refresh (Cmd+Shift+R) |
| Event data lost after restart | `data/event.json` was deleted | Restore from a JSON backup via `POST /api/export/json?key=…` |
| "No event found" on admin page | Server restarted without `data/event.json` | Create a new event or import a backup |
| Build fails with type errors | Code was edited without checking types | Run `npm run build` and fix reported issues |

### Re-run / New Attempt

If a rider needs a re-run (e.g. interference), use the **🔄 Re-run** button in Live Controls. This increments the attempt number — only the best attempt counts.

### Import / Export

- **JSON export** (full backup, no secrets): open `http://<LAN-IP>:<PORT>/api/export/json?key=<adminKey>` in your browser
- **JSON import** (restore from backup): `POST /api/export/json?key=<adminKey>` with the JSON as request body (use `curl` or a REST client)
- **CSV export** (results for spreadsheets): open `http://<LAN-IP>:<PORT>/api/export/csv?key=<adminKey>` in your browser

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/admin/create-event` | None / Admin | Create a new event |
| GET | `/api/admin/categories?key=…` | Admin | List categories |
| POST | `/api/admin/categories?key=…` | Admin | Add category |
| PUT | `/api/admin/categories?key=…` | Admin | Update category |
| DELETE | `/api/admin/categories?key=…&id=…` | Admin | Delete category |
| POST | `/api/admin/categories/[id]/athletes?key=…` | Admin | Add athlete |
| DELETE | `/api/admin/categories/[id]/athletes?key=…&bib=…` | Admin | Delete athlete |
| POST | `/api/admin/categories/[id]/athletes/import?key=…` | Admin | CSV import athletes |
| GET | `/api/admin/live?key=…` | Admin | Get live state |
| PUT | `/api/admin/live?key=…` | Admin | Update live state |
| GET | `/api/admin/results?key=…` | Admin | Get results / leaderboard |
| GET | `/api/event` | None | Public event info |
| GET | `/api/state` | None | Public live state (for spectator view) |
| POST | `/api/score?key=<judgeKey>` | Judge | Submit score |
| GET | `/api/score?key=<judgeKey>` | Judge | Get own current score |
| GET | `/api/export/csv?key=…` | Admin | Download CSV results |
| GET | `/api/export/json?key=…` | Admin | Download JSON backup |
| POST | `/api/export/json?key=…` | Admin | Import JSON backup |

## Tech Stack

- **Next.js 15** — App Router, server-side rendering
- **React 19** — UI components
- **TypeScript 5** — type safety with runtime guards
- **File persistence** — `data/event.json`, atomic temp-file-then-rename writes
- **No database** — zero external dependencies, runs anywhere Node runs

## License

MIT
