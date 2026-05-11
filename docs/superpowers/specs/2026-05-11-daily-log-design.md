# Daily Log App — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A personal daily log at `log.dmytropetryshchuk.com` — journal entries (did today / doing tomorrow) plus flexible habit tracking with a monthly calendar view.

---

## Architecture

Same stack as writing-app:
- **Backend:** Express + TypeScript, compiled to `dist/server.js`, port **4113**
- **Frontend:** Vite + React, built to `public/`, served by Express
- **Database:** PostgreSQL on the VPS — new database `daily_log` on the same instance as `jobsearch`
- **Reverse proxy:** Caddy at `log.dmytropetryshchuk.com` with basic auth
- **Process:** systemd service `daily-log` (`/etc/systemd/system/daily-log.service`)
- **Deploy:** GitHub Actions on push to master — `git pull && npm run build && sudo systemctl restart daily-log`
- **DNS:** A record on Porkbun: `log` → `46.225.78.10`

### VPS setup commands (one-time)
```bash
# On VPS
createdb daily_log   # or: psql -c "CREATE DATABASE daily_log"
cd /home/dima
git clone https://github.com/dpetryshchuk/daily-log-vps.git daily-log
cd daily-log && npm install && npm run build
sudo cp daily-log.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable daily-log && sudo systemctl start daily-log
# Add Caddy vhost block (see VPS-GUIDE.md)
# Add DNS A record on Porkbun: log → 46.225.78.10
```

---

## Data Model

```sql
-- One journal entry per day
CREATE TABLE entries (
  date date PRIMARY KEY,
  did_today text,
  doing_tomorrow text,
  updated_at timestamptz DEFAULT now()
);

-- Habit definitions — add new habits here over time
CREATE TABLE habit_types (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('boolean', 'number')),
  active boolean DEFAULT true,
  created_at date DEFAULT current_date
);

-- One value row per habit per day
CREATE TABLE habit_logs (
  habit_type_id integer REFERENCES habit_types(id),
  date date NOT NULL,
  value jsonb NOT NULL,
  PRIMARY KEY (habit_type_id, date)
);

-- Seed: starting habits
INSERT INTO habit_types (name, kind) VALUES ('creatine', 'boolean');
```

**Flexibility invariant:** When a habit is deactivated, its `habit_logs` rows are preserved unchanged. New habits added later simply have no rows for past dates — shown as "not logged" in the UI, not as false. This means old calendar views remain accurate forever regardless of future habit changes.

---

## API Routes

All routes return `{ ok: true, ...data }` on success or `{ ok: false, error: string }` on failure.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/day/:date` | Entry + all habit logs for one date (`YYYY-MM-DD`) |
| `PUT` | `/api/day/:date` | Upsert journal fields + habit values for one date |
| `GET` | `/api/calendar/:year/:month` | All logged dates in month with habit completion summary |
| `GET` | `/api/habits` | List all habit types (active and inactive) |
| `POST` | `/api/habits` | Create a new habit type |
| `PATCH` | `/api/habits/:id` | Rename or toggle active/inactive |

### PUT /api/day/:date body
```json
{
  "did_today": "Finished the backend routes",
  "doing_tomorrow": "Write tests",
  "habits": { "1": true }
}
```
Keys in `habits` are `habit_type_id` (as string). One round-trip saves both journal and habits.

### GET /api/calendar/:year/:month response
```json
{
  "ok": true,
  "days": [
    { "date": "2026-05-11", "entry": true, "habits": { "1": true } },
    { "date": "2026-05-10", "entry": true, "habits": { "1": false } }
  ]
}
```
Lightweight — only returns dates that have at least an entry or a habit log. Calendar cells with no data are inferred as empty on the frontend.

---

## Frontend

### Layout
Two-column, full-height:
- **Left panel (~360px):** Calendar + weekly stats strip
- **Right panel (flex-1):** Day editor for the selected date

On mobile (< 768px): single column, calendar above, editor below.

### Calendar (left panel)
- Monthly grid (Sun–Sat), prev/next month navigation
- Each day cell: if logged, shows a small dot per active habit (filled = true/non-zero, empty circle = false/zero). Gray cell = no entry at all.
- Today highlighted by default on load
- Clicking any day loads it into the right panel
- **Weekly stats strip** below the grid — current calendar week's habit completion counts for all active habits

### Day editor (right panel)
- Date heading: e.g. "Sunday, May 11"
- **Habits section:** one row per active habit
  - `boolean` kind → checkbox
  - `number` kind → small numeric input
  - Saves immediately on change (debounced 400ms)
- **Journal section:** two `<textarea>` fields — "Today" and "Tomorrow"
  - Autosaves on blur + debounced 800ms on change
- Subtle "Saved" / "Saving…" indicator bottom-right (same pattern as writing-app)

### Habit manager
- Settings gear icon in the page header
- Opens an inline panel (not a separate page)
- Lists all habit types with name, kind badge, active toggle
- "New habit" form: name text input + kind select (boolean / number) + Add button
- Deactivating a habit hides it from the day editor and calendar dots but preserves all historical data

### Visual language
Matches jobsearch VPS app:
- **Font:** Geist Variable (same as jobsearch)
- **Color system:** CSS variables (`--background`, `--foreground`, `--muted`, `--border`, `--card`) — same shadcn/ui-style palette
- White background, clean neutral borders
- Card-based layout for calendar and day editor panels
- No warm stone palette (that's writing-app's style)

---

## Backend File Structure

```
server.ts              — Express app, exports app, listens when main
src/
  types.ts             — shared TypeScript interfaces
  db.ts                — pg Pool setup, reads DATABASE_URL from env
  entries.ts           — getEntry, upsertEntry
  habits.ts            — listHabitTypes, createHabitType, updateHabitType, getHabitLogs, upsertHabitLog
  calendar.ts          — getCalendarMonth (aggregates entries + habit_logs)
tests/
  entries.test.ts
  habits.test.ts
  calendar.test.ts
  server.test.ts
frontend/
  src/
    App.jsx
    lib/api.js
    components/
      Calendar.jsx
      DayEditor.jsx
      HabitManager.jsx
      SaveStatus.jsx
```

---

## Environment

```bash
# .env
DATABASE_URL=postgresql://daily_log:<password>@localhost:5432/daily_log
PORT=4113
```

---

## systemd Service

```ini
[Unit]
Description=Daily Log App
After=network.target

[Service]
Type=simple
User=dima
WorkingDirectory=/home/dima/daily-log
EnvironmentFile=/home/dima/daily-log/.env
ExecStart=/usr/bin/node /home/dima/daily-log/dist/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## GitHub Actions Deploy

```yaml
# .github/workflows/deploy.yml
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
            cd /home/dima/daily-log
            git pull
            npm run build
            sudo systemctl restart daily-log
```

Reuses the same `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` secrets already set on other repos.

---

## Testing Strategy

- Unit tests with Vitest for all backend modules (`entries.ts`, `habits.ts`, `calendar.ts`)
- Integration tests with supertest for all API routes
- `CONTENT_DIR` / `DATABASE_URL` injected per-test via environment (same pattern as writing-app)
- TDD: write failing test → implement → pass
