# Daily Log App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal daily log at `log.dmytropetryshchuk.com` — journal entries (did today / doing tomorrow) plus flexible habit tracking with a monthly calendar view.

**Architecture:** Express + TypeScript backend on port 4113, Vite + React frontend built to `public/`, PostgreSQL `daily_log` database on the VPS. Caddy reverse proxy with basic auth. GitHub Actions auto-deploy on push to master.

**Tech Stack:** Node 20, TypeScript 5, Express 4, pg, Vitest, supertest, Vite, React 18, Tailwind CSS 3, `@fontsource-variable/geist`

---

## File Map

**New repo: `daily-log-vps` (standalone, NOT inside writing-app)**

```
package.json
tsconfig.json
vitest.config.ts
server.ts                        — Express app entry point
src/
  types.ts                       — shared TypeScript interfaces
  db.ts                          — pg Pool singleton
  entries.ts                     — getEntry, upsertEntry
  habits.ts                      — listHabitTypes, createHabitType, updateHabitType, getHabitLogs, upsertHabitLog
  calendar.ts                    — getCalendarMonth
tests/
  entries.test.ts
  habits.test.ts
  calendar.test.ts
  server.test.ts
schema.sql                       — DDL for all 3 tables + seed
.env.example
daily-log.service                — systemd unit file
.github/
  workflows/
    deploy.yml
frontend/
  package.json
  vite.config.js
  tailwind.config.js
  index.html
  src/
    main.jsx
    App.jsx
    index.css
    lib/
      api.js
    components/
      Calendar.jsx
      DayEditor.jsx
      HabitManager.jsx
      SaveStatus.jsx
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `schema.sql`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `daily-log.service`
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "daily-log-vps",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "npx ts-node-dev --respawn server.ts",
    "build": "tsc -p tsconfig.json && npm run build:frontend",
    "build:frontend": "cd frontend && npm run build && cp -r dist/* ../public/",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/pg": "^8.11.0",
    "@types/node": "^20.11.0",
    "@types/supertest": "^6.0.2",
    "supertest": "^6.3.4",
    "typescript": "^5.3.3",
    "ts-node-dev": "^2.0.0",
    "vitest": "^1.2.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["server.ts", "src/**/*"],
  "exclude": ["node_modules", "dist", "frontend", "tests"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      DATABASE_URL: 'postgresql://localhost/daily_log_test',
      PORT: '4114'
    },
    sequence: { concurrent: false }
  }
})
```

- [ ] **Step 4: Create schema.sql**

```sql
CREATE TABLE IF NOT EXISTS entries (
  date date PRIMARY KEY,
  did_today text,
  doing_tomorrow text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS habit_types (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('boolean', 'number')),
  active boolean DEFAULT true,
  created_at date DEFAULT current_date
);

CREATE TABLE IF NOT EXISTS habit_logs (
  habit_type_id integer REFERENCES habit_types(id),
  date date NOT NULL,
  value jsonb NOT NULL,
  PRIMARY KEY (habit_type_id, date)
);

INSERT INTO habit_types (name, kind) VALUES ('creatine', 'boolean')
  ON CONFLICT (name) DO NOTHING;
```

- [ ] **Step 5: Create .env.example**

```
DATABASE_URL=postgresql://daily_log:<password>@localhost:5432/daily_log
PORT=4113
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
public/
.env
*.js.map
frontend/node_modules/
frontend/dist/
```

- [ ] **Step 7: Create daily-log.service**

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

- [ ] **Step 8: Create .github/workflows/deploy.yml**

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
            cd /home/dima/daily-log
            git pull
            npm install
            npm run build
            sudo systemctl restart daily-log
```

- [ ] **Step 9: Initialize git and commit**

```bash
git init
git add .
git commit -m "chore: project scaffold"
```

---

### Task 2: Backend Types and DB Layer

**Files:**
- Create: `src/types.ts`
- Create: `src/db.ts`

- [ ] **Step 1: Create src/types.ts**

```typescript
export interface Entry {
  date: string          // YYYY-MM-DD
  did_today: string | null
  doing_tomorrow: string | null
  updated_at: string
}

export interface HabitType {
  id: number
  name: string
  kind: 'boolean' | 'number'
  active: boolean
  created_at: string
}

export interface HabitLog {
  habit_type_id: number
  date: string
  value: boolean | number
}

export interface DayData {
  date: string
  entry: Entry | null
  habits: HabitLog[]
}

export interface CalendarDay {
  date: string
  entry: boolean
  habits: Record<string, boolean | number>
}

export interface UpsertDayBody {
  did_today?: string
  doing_tomorrow?: string
  habits?: Record<string, boolean | number>
}
```

- [ ] **Step 2: Create src/db.ts**

```typescript
import { Pool } from 'pg'

let _pool: Pool | null = null

export function getPool(url?: string): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: url ?? process.env.DATABASE_URL })
  }
  return _pool
}

export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end()
    _pool = null
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types.ts src/db.ts
git commit -m "feat: types and db pool"
```

---

### Task 3: Entries Module (TDD)

**Files:**
- Create: `src/entries.ts`
- Create: `tests/entries.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/entries.test.ts`:

```typescript
import { beforeEach, afterAll, describe, it, expect } from 'vitest'
import { Pool } from 'pg'
import { getEntry, upsertEntry } from '../src/entries'
import { closePool } from '../src/db'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

beforeEach(async () => {
  await pool.query('TRUNCATE habit_types, entries, habit_logs RESTART IDENTITY CASCADE')
  await pool.query("INSERT INTO habit_types (name, kind) VALUES ('creatine', 'boolean')")
})

afterAll(async () => {
  await pool.end()
  await closePool()
})

describe('getEntry', () => {
  it('returns null for a date with no entry', async () => {
    const result = await getEntry('2026-05-01', pool)
    expect(result).toBeNull()
  })

  it('returns the entry when it exists', async () => {
    await pool.query(
      "INSERT INTO entries (date, did_today) VALUES ('2026-05-01', 'wrote tests')"
    )
    const result = await getEntry('2026-05-01', pool)
    expect(result).not.toBeNull()
    expect(result!.did_today).toBe('wrote tests')
    expect(result!.doing_tomorrow).toBeNull()
  })
})

describe('upsertEntry', () => {
  it('creates a new entry', async () => {
    await upsertEntry('2026-05-02', { did_today: 'did stuff', doing_tomorrow: 'do more' }, pool)
    const result = await getEntry('2026-05-02', pool)
    expect(result!.did_today).toBe('did stuff')
    expect(result!.doing_tomorrow).toBe('do more')
  })

  it('updates an existing entry', async () => {
    await pool.query("INSERT INTO entries (date, did_today) VALUES ('2026-05-03', 'original')")
    await upsertEntry('2026-05-03', { did_today: 'updated' }, pool)
    const result = await getEntry('2026-05-03', pool)
    expect(result!.did_today).toBe('updated')
  })

  it('preserves existing fields when only some are provided', async () => {
    await pool.query(
      "INSERT INTO entries (date, did_today, doing_tomorrow) VALUES ('2026-05-04', 'did', 'will do')"
    )
    await upsertEntry('2026-05-04', { did_today: 'revised' }, pool)
    const result = await getEntry('2026-05-04', pool)
    expect(result!.did_today).toBe('revised')
    expect(result!.doing_tomorrow).toBe('will do')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/entries.test.ts
```

Expected: FAIL — `Cannot find module '../src/entries'`

- [ ] **Step 3: Create src/entries.ts**

```typescript
import { Pool } from 'pg'
import { getPool } from './db'
import type { Entry } from './types'

export async function getEntry(date: string, pool?: Pool): Promise<Entry | null> {
  const db = pool ?? getPool()
  const { rows } = await db.query<Entry>(
    'SELECT date::text, did_today, doing_tomorrow, updated_at::text FROM entries WHERE date = $1',
    [date]
  )
  return rows[0] ?? null
}

export async function upsertEntry(
  date: string,
  data: { did_today?: string; doing_tomorrow?: string },
  pool?: Pool
): Promise<Entry> {
  const db = pool ?? getPool()
  const { rows } = await db.query<Entry>(
    `INSERT INTO entries (date, did_today, doing_tomorrow)
     VALUES ($1, $2, $3)
     ON CONFLICT (date) DO UPDATE SET
       did_today = COALESCE($2, entries.did_today),
       doing_tomorrow = COALESCE($3, entries.doing_tomorrow),
       updated_at = now()
     RETURNING date::text, did_today, doing_tomorrow, updated_at::text`,
    [date, data.did_today ?? null, data.doing_tomorrow ?? null]
  )
  return rows[0]
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/entries.test.ts
```

Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/entries.ts tests/entries.test.ts
git commit -m "feat: entries module (TDD)"
```

---

### Task 4: Habits Module (TDD)

**Files:**
- Create: `src/habits.ts`
- Create: `tests/habits.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/habits.test.ts`:

```typescript
import { beforeEach, afterAll, describe, it, expect } from 'vitest'
import { Pool } from 'pg'
import {
  listHabitTypes,
  createHabitType,
  updateHabitType,
  getHabitLogs,
  upsertHabitLog
} from '../src/habits'
import { closePool } from '../src/db'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

beforeEach(async () => {
  await pool.query('TRUNCATE habit_types, entries, habit_logs RESTART IDENTITY CASCADE')
  await pool.query("INSERT INTO habit_types (name, kind) VALUES ('creatine', 'boolean')")
})

afterAll(async () => {
  await pool.end()
  await closePool()
})

describe('listHabitTypes', () => {
  it('returns the seeded habit', async () => {
    const result = await listHabitTypes(pool)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('creatine')
    expect(result[0].kind).toBe('boolean')
    expect(result[0].active).toBe(true)
  })

  it('returns both active and inactive habits', async () => {
    await pool.query("INSERT INTO habit_types (name, kind, active) VALUES ('sleep', 'number', false)")
    const result = await listHabitTypes(pool)
    expect(result).toHaveLength(2)
  })
})

describe('createHabitType', () => {
  it('creates a new boolean habit', async () => {
    const habit = await createHabitType('pushups', 'boolean', pool)
    expect(habit.name).toBe('pushups')
    expect(habit.kind).toBe('boolean')
    expect(habit.active).toBe(true)
    expect(habit.id).toBeTypeOf('number')
  })

  it('creates a new number habit', async () => {
    const habit = await createHabitType('sleep hours', 'number', pool)
    expect(habit.kind).toBe('number')
  })

  it('rejects duplicate names', async () => {
    await expect(createHabitType('creatine', 'boolean', pool)).rejects.toThrow()
  })
})

describe('updateHabitType', () => {
  it('renames a habit', async () => {
    const habits = await listHabitTypes(pool)
    const updated = await updateHabitType(habits[0].id, { name: 'creatine monohydrate' }, pool)
    expect(updated.name).toBe('creatine monohydrate')
  })

  it('deactivates a habit', async () => {
    const habits = await listHabitTypes(pool)
    const updated = await updateHabitType(habits[0].id, { active: false }, pool)
    expect(updated.active).toBe(false)
  })

  it('reactivates a habit', async () => {
    const habits = await listHabitTypes(pool)
    await updateHabitType(habits[0].id, { active: false }, pool)
    const updated = await updateHabitType(habits[0].id, { active: true }, pool)
    expect(updated.active).toBe(true)
  })

  it('throws when habit not found', async () => {
    await expect(updateHabitType(9999, { name: 'ghost' }, pool)).rejects.toThrow()
  })
})

describe('getHabitLogs', () => {
  it('returns empty array when no logs exist', async () => {
    const result = await getHabitLogs('2026-05-01', pool)
    expect(result).toEqual([])
  })

  it('returns logs for a date', async () => {
    const habits = await listHabitTypes(pool)
    await pool.query(
      'INSERT INTO habit_logs (habit_type_id, date, value) VALUES ($1, $2, $3)',
      [habits[0].id, '2026-05-01', JSON.stringify(true)]
    )
    const result = await getHabitLogs('2026-05-01', pool)
    expect(result).toHaveLength(1)
    expect(result[0].value).toBe(true)
    expect(result[0].habit_type_id).toBe(habits[0].id)
  })
})

describe('upsertHabitLog', () => {
  it('creates a habit log', async () => {
    const habits = await listHabitTypes(pool)
    await upsertHabitLog(habits[0].id, '2026-05-02', true, pool)
    const logs = await getHabitLogs('2026-05-02', pool)
    expect(logs[0].value).toBe(true)
  })

  it('updates an existing log', async () => {
    const habits = await listHabitTypes(pool)
    await upsertHabitLog(habits[0].id, '2026-05-03', true, pool)
    await upsertHabitLog(habits[0].id, '2026-05-03', false, pool)
    const logs = await getHabitLogs('2026-05-03', pool)
    expect(logs[0].value).toBe(false)
  })

  it('stores number values', async () => {
    await pool.query("INSERT INTO habit_types (name, kind) VALUES ('sleep', 'number')")
    const habits = await listHabitTypes(pool)
    const sleepHabit = habits.find(h => h.name === 'sleep')!
    await upsertHabitLog(sleepHabit.id, '2026-05-04', 7.5, pool)
    const logs = await getHabitLogs('2026-05-04', pool)
    const sleepLog = logs.find(l => l.habit_type_id === sleepHabit.id)!
    expect(sleepLog.value).toBe(7.5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/habits.test.ts
```

Expected: FAIL — `Cannot find module '../src/habits'`

- [ ] **Step 3: Create src/habits.ts**

```typescript
import { Pool } from 'pg'
import { getPool } from './db'
import type { HabitType, HabitLog } from './types'

export async function listHabitTypes(pool?: Pool): Promise<HabitType[]> {
  const db = pool ?? getPool()
  const { rows } = await db.query<HabitType>(
    'SELECT id, name, kind, active, created_at::text FROM habit_types ORDER BY id'
  )
  return rows
}

export async function createHabitType(
  name: string,
  kind: 'boolean' | 'number',
  pool?: Pool
): Promise<HabitType> {
  const db = pool ?? getPool()
  const { rows } = await db.query<HabitType>(
    `INSERT INTO habit_types (name, kind)
     VALUES ($1, $2)
     RETURNING id, name, kind, active, created_at::text`,
    [name, kind]
  )
  return rows[0]
}

export async function updateHabitType(
  id: number,
  data: { name?: string; active?: boolean },
  pool?: Pool
): Promise<HabitType> {
  const db = pool ?? getPool()
  const { rows } = await db.query<HabitType>(
    `UPDATE habit_types SET
       name = COALESCE($2, name),
       active = COALESCE($3, active)
     WHERE id = $1
     RETURNING id, name, kind, active, created_at::text`,
    [id, data.name ?? null, data.active ?? null]
  )
  if (!rows[0]) throw new Error(`Habit type ${id} not found`)
  return rows[0]
}

export async function getHabitLogs(date: string, pool?: Pool): Promise<HabitLog[]> {
  const db = pool ?? getPool()
  const { rows } = await db.query<{ habit_type_id: number; date: string; value: string }>(
    'SELECT habit_type_id, date::text, value FROM habit_logs WHERE date = $1',
    [date]
  )
  return rows.map(r => ({ ...r, value: r.value as unknown as boolean | number }))
}

export async function upsertHabitLog(
  habitTypeId: number,
  date: string,
  value: boolean | number,
  pool?: Pool
): Promise<void> {
  const db = pool ?? getPool()
  await db.query(
    `INSERT INTO habit_logs (habit_type_id, date, value)
     VALUES ($1, $2, $3)
     ON CONFLICT (habit_type_id, date) DO UPDATE SET value = $3`,
    [habitTypeId, date, JSON.stringify(value)]
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/habits.test.ts
```

Expected: PASS — 12 tests

- [ ] **Step 5: Commit**

```bash
git add src/habits.ts tests/habits.test.ts
git commit -m "feat: habits module (TDD)"
```

---

### Task 5: Calendar Module (TDD)

**Files:**
- Create: `src/calendar.ts`
- Create: `tests/calendar.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/calendar.test.ts`:

```typescript
import { beforeEach, afterAll, describe, it, expect } from 'vitest'
import { Pool } from 'pg'
import { getCalendarMonth } from '../src/calendar'
import { closePool } from '../src/db'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

beforeEach(async () => {
  await pool.query('TRUNCATE habit_types, entries, habit_logs RESTART IDENTITY CASCADE')
  await pool.query("INSERT INTO habit_types (name, kind) VALUES ('creatine', 'boolean')")
})

afterAll(async () => {
  await pool.end()
  await closePool()
})

describe('getCalendarMonth', () => {
  it('returns empty array for a month with no data', async () => {
    const result = await getCalendarMonth(2026, 5, pool)
    expect(result).toEqual([])
  })

  it('includes dates that have journal entries', async () => {
    await pool.query("INSERT INTO entries (date, did_today) VALUES ('2026-05-10', 'something')")
    const result = await getCalendarMonth(2026, 5, pool)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-05-10')
    expect(result[0].entry).toBe(true)
  })

  it('includes dates that have habit logs only', async () => {
    const { rows } = await pool.query<{ id: number }>('SELECT id FROM habit_types LIMIT 1')
    await pool.query(
      'INSERT INTO habit_logs (habit_type_id, date, value) VALUES ($1, $2, $3)',
      [rows[0].id, '2026-05-11', JSON.stringify(true)]
    )
    const result = await getCalendarMonth(2026, 5, pool)
    expect(result).toHaveLength(1)
    expect(result[0].entry).toBe(false)
    expect(result[0].habits[String(rows[0].id)]).toBe(true)
  })

  it('aggregates both entry and habits on the same date', async () => {
    const { rows } = await pool.query<{ id: number }>('SELECT id FROM habit_types LIMIT 1')
    await pool.query("INSERT INTO entries (date, did_today) VALUES ('2026-05-12', 'stuff')")
    await pool.query(
      'INSERT INTO habit_logs (habit_type_id, date, value) VALUES ($1, $2, $3)',
      [rows[0].id, '2026-05-12', JSON.stringify(false)]
    )
    const result = await getCalendarMonth(2026, 5, pool)
    expect(result).toHaveLength(1)
    expect(result[0].entry).toBe(true)
    expect(result[0].habits[String(rows[0].id)]).toBe(false)
  })

  it('only returns dates within the requested month', async () => {
    await pool.query("INSERT INTO entries (date, did_today) VALUES ('2026-04-30', 'april')")
    await pool.query("INSERT INTO entries (date, did_today) VALUES ('2026-05-01', 'may')")
    await pool.query("INSERT INTO entries (date, did_today) VALUES ('2026-06-01', 'june')")
    const result = await getCalendarMonth(2026, 5, pool)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-05-01')
  })

  it('returns days sorted by date ascending', async () => {
    await pool.query("INSERT INTO entries (date, did_today) VALUES ('2026-05-20', 'later')")
    await pool.query("INSERT INTO entries (date, did_today) VALUES ('2026-05-03', 'earlier')")
    const result = await getCalendarMonth(2026, 5, pool)
    expect(result[0].date).toBe('2026-05-03')
    expect(result[1].date).toBe('2026-05-20')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/calendar.test.ts
```

Expected: FAIL — `Cannot find module '../src/calendar'`

- [ ] **Step 3: Create src/calendar.ts**

```typescript
import { Pool } from 'pg'
import { getPool } from './db'
import type { CalendarDay } from './types'

export async function getCalendarMonth(
  year: number,
  month: number,
  pool?: Pool
): Promise<CalendarDay[]> {
  const db = pool ?? getPool()

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`

  const { rows: entryRows } = await db.query<{ date: string }>(
    `SELECT date::text FROM entries WHERE date >= $1 AND date < $2`,
    [startDate, endDate]
  )
  const { rows: logRows } = await db.query<{ date: string; habit_type_id: number; value: unknown }>(
    `SELECT date::text, habit_type_id, value FROM habit_logs WHERE date >= $1 AND date < $2`,
    [startDate, endDate]
  )

  const dayMap = new Map<string, CalendarDay>()

  for (const { date } of entryRows) {
    if (!dayMap.has(date)) dayMap.set(date, { date, entry: false, habits: {} })
    dayMap.get(date)!.entry = true
  }

  for (const { date, habit_type_id, value } of logRows) {
    if (!dayMap.has(date)) dayMap.set(date, { date, entry: false, habits: {} })
    dayMap.get(date)!.habits[String(habit_type_id)] = value as boolean | number
  }

  return [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date))
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/calendar.test.ts
```

Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/calendar.ts tests/calendar.test.ts
git commit -m "feat: calendar module (TDD)"
```

---

### Task 6: Express Server + API Routes (TDD)

**Files:**
- Create: `server.ts`
- Create: `tests/server.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/server.test.ts`:

```typescript
import { beforeEach, afterAll, describe, it, expect } from 'vitest'
import request from 'supertest'
import { Pool } from 'pg'
import { app } from '../server'
import { closePool } from '../src/db'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

beforeEach(async () => {
  await pool.query('TRUNCATE habit_types, entries, habit_logs RESTART IDENTITY CASCADE')
  await pool.query("INSERT INTO habit_types (name, kind) VALUES ('creatine', 'boolean')")
})

afterAll(async () => {
  await pool.end()
  await closePool()
})

describe('GET /api/day/:date', () => {
  it('returns null entry and empty habits for a new date', async () => {
    const res = await request(app).get('/api/day/2026-05-11')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.entry).toBeNull()
    expect(res.body.habits).toEqual([])
  })

  it('returns existing entry and habits', async () => {
    await pool.query("INSERT INTO entries (date, did_today) VALUES ('2026-05-11', 'wrote code')")
    const { rows } = await pool.query<{ id: number }>('SELECT id FROM habit_types LIMIT 1')
    await pool.query(
      'INSERT INTO habit_logs (habit_type_id, date, value) VALUES ($1, $2, $3)',
      [rows[0].id, '2026-05-11', JSON.stringify(true)]
    )
    const res = await request(app).get('/api/day/2026-05-11')
    expect(res.status).toBe(200)
    expect(res.body.entry.did_today).toBe('wrote code')
    expect(res.body.habits).toHaveLength(1)
    expect(res.body.habits[0].value).toBe(true)
  })
})

describe('PUT /api/day/:date', () => {
  it('saves journal fields', async () => {
    const res = await request(app)
      .put('/api/day/2026-05-12')
      .send({ did_today: 'shipped it', doing_tomorrow: 'rest' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    const check = await request(app).get('/api/day/2026-05-12')
    expect(check.body.entry.did_today).toBe('shipped it')
  })

  it('saves habit logs', async () => {
    const { rows } = await pool.query<{ id: number }>('SELECT id FROM habit_types LIMIT 1')
    const res = await request(app)
      .put('/api/day/2026-05-12')
      .send({ habits: { [rows[0].id]: true } })
    expect(res.status).toBe(200)
    const check = await request(app).get('/api/day/2026-05-12')
    expect(check.body.habits[0].value).toBe(true)
  })
})

describe('GET /api/calendar/:year/:month', () => {
  it('returns empty days for empty month', async () => {
    const res = await request(app).get('/api/calendar/2026/5')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.days).toEqual([])
  })

  it('returns days with data', async () => {
    await pool.query("INSERT INTO entries (date, did_today) VALUES ('2026-05-11', 'logged')")
    const res = await request(app).get('/api/calendar/2026/5')
    expect(res.body.days).toHaveLength(1)
    expect(res.body.days[0].date).toBe('2026-05-11')
    expect(res.body.days[0].entry).toBe(true)
  })
})

describe('GET /api/habits', () => {
  it('returns all habit types', async () => {
    const res = await request(app).get('/api/habits')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.habits).toHaveLength(1)
    expect(res.body.habits[0].name).toBe('creatine')
  })
})

describe('POST /api/habits', () => {
  it('creates a new habit', async () => {
    const res = await request(app)
      .post('/api/habits')
      .send({ name: 'pushups', kind: 'boolean' })
    expect(res.status).toBe(201)
    expect(res.body.ok).toBe(true)
    expect(res.body.habit.name).toBe('pushups')
    expect(res.body.habit.id).toBeTypeOf('number')
  })

  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/api/habits').send({ kind: 'boolean' })
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
  })
})

describe('PATCH /api/habits/:id', () => {
  it('toggles a habit inactive', async () => {
    const { rows } = await pool.query<{ id: number }>('SELECT id FROM habit_types LIMIT 1')
    const res = await request(app)
      .patch(`/api/habits/${rows[0].id}`)
      .send({ active: false })
    expect(res.status).toBe(200)
    expect(res.body.habit.active).toBe(false)
  })

  it('returns 404 for unknown habit id', async () => {
    const res = await request(app).patch('/api/habits/9999').send({ active: false })
    expect(res.status).toBe(404)
    expect(res.body.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/server.test.ts
```

Expected: FAIL — `Cannot find module '../server'`

- [ ] **Step 3: Create server.ts**

```typescript
import express from 'express'
import path from 'path'
import { getEntry, upsertEntry } from './src/entries'
import {
  listHabitTypes, createHabitType, updateHabitType,
  getHabitLogs, upsertHabitLog
} from './src/habits'
import { getCalendarMonth } from './src/calendar'

export const app = express()
app.use(express.json())

// GET /api/day/:date
app.get('/api/day/:date', async (req, res) => {
  try {
    const { date } = req.params
    const [entry, habits] = await Promise.all([
      getEntry(date),
      getHabitLogs(date)
    ])
    res.json({ ok: true, entry, habits })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// PUT /api/day/:date
app.put('/api/day/:date', async (req, res) => {
  try {
    const { date } = req.params
    const { did_today, doing_tomorrow, habits } = req.body as {
      did_today?: string
      doing_tomorrow?: string
      habits?: Record<string, boolean | number>
    }

    await upsertEntry(date, { did_today, doing_tomorrow })

    if (habits) {
      await Promise.all(
        Object.entries(habits).map(([id, value]) =>
          upsertHabitLog(Number(id), date, value)
        )
      )
    }

    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// GET /api/calendar/:year/:month
app.get('/api/calendar/:year/:month', async (req, res) => {
  try {
    const year = Number(req.params.year)
    const month = Number(req.params.month)
    const days = await getCalendarMonth(year, month)
    res.json({ ok: true, days })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// GET /api/habits
app.get('/api/habits', async (_req, res) => {
  try {
    const habits = await listHabitTypes()
    res.json({ ok: true, habits })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// POST /api/habits
app.post('/api/habits', async (req, res) => {
  try {
    const { name, kind } = req.body as { name?: string; kind?: string }
    if (!name || !kind) {
      return res.status(400).json({ ok: false, error: 'name and kind are required' })
    }
    if (kind !== 'boolean' && kind !== 'number') {
      return res.status(400).json({ ok: false, error: 'kind must be boolean or number' })
    }
    const habit = await createHabitType(name, kind)
    res.status(201).json({ ok: true, habit })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// PATCH /api/habits/:id
app.patch('/api/habits/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { name, active } = req.body as { name?: string; active?: boolean }
    const habit = await updateHabitType(id, { name, active })
    res.json({ ok: true, habit })
  } catch (e: any) {
    if (e.message.includes('not found')) {
      return res.status(404).json({ ok: false, error: e.message })
    }
    res.status(500).json({ ok: false, error: e.message })
  }
})

// Serve frontend in production
app.use(express.static(path.join(__dirname, 'public')))
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

if (require.main === module) {
  const PORT = Number(process.env.PORT ?? 4113)
  app.listen(PORT, () => console.log(`daily-log listening on :${PORT}`))
}
```

- [ ] **Step 4: Run all backend tests**

```bash
npx vitest run
```

Expected: PASS — all tests across entries, habits, calendar, server

- [ ] **Step 5: Commit**

```bash
git add server.ts tests/server.test.ts
git commit -m "feat: express server with all API routes (TDD)"
```

---

### Task 7: Frontend Scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/index.css`
- Create: `frontend/src/lib/api.js`

- [ ] **Step 1: Create frontend/package.json**

```json
{
  "name": "daily-log-frontend",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@fontsource-variable/geist": "^5.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.33",
    "tailwindcss": "^3.4.1",
    "vite": "^5.0.12"
  }
}
```

- [ ] **Step 2: Create frontend/vite.config.js**

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist'
  },
  server: {
    proxy: {
      '/api': 'http://localhost:4113'
    }
  }
})
```

- [ ] **Step 3: Create frontend/tailwind.config.js**

```javascript
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: []
}
```

- [ ] **Step 4: Create frontend/postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
}
```

- [ ] **Step 5: Create frontend/index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Daily Log</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create frontend/src/main.jsx**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 7: Create frontend/src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import '@fontsource-variable/geist';

:root {
  --background: #ffffff;
  --foreground: #0f0f0f;
  --muted: #f4f4f5;
  --muted-foreground: #71717a;
  --border: #e4e4e7;
  --card: #ffffff;
  --card-border: #e4e4e7;
  --primary: #0f0f0f;
  --primary-foreground: #ffffff;
  --ring: #d4d4d8;
}

html, body, #root {
  background: var(--background);
  color: var(--foreground);
  height: 100%;
  margin: 0;
  font-family: 'Geist Variable', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
}

* { box-sizing: border-box; }
textarea { font-family: inherit; font-size: inherit; }
```

- [ ] **Step 8: Create frontend/src/lib/api.js**

```javascript
async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(path, opts)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error ?? 'Request failed')
  return data
}

export const api = {
  day: {
    get: (date) => request('GET', `/api/day/${date}`),
    save: (date, body) => request('PUT', `/api/day/${date}`, body)
  },
  calendar: {
    get: (year, month) => request('GET', `/api/calendar/${year}/${month}`)
  },
  habits: {
    list: () => request('GET', '/api/habits'),
    create: (name, kind) => request('POST', '/api/habits', { name, kind }),
    update: (id, data) => request('PATCH', `/api/habits/${id}`, data)
  }
}
```

- [ ] **Step 9: Install frontend dependencies and verify build**

```bash
cd frontend && npm install && npm run build
cd ..
```

Expected: `frontend/dist/` created with `index.html` and assets.

- [ ] **Step 10: Commit**

```bash
git add frontend/
git commit -m "feat: frontend scaffold with Vite + React + Tailwind"
```

---

### Task 8: Calendar Component

**Files:**
- Create: `frontend/src/components/Calendar.jsx`

- [ ] **Step 1: Create frontend/src/components/Calendar.jsx**

```jsx
import { useState, useEffect } from 'react'
import { api } from '../lib/api'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function firstWeekday(year, month) {
  return new Date(year, month - 1, 1).getDay()
}

function pad(n) {
  return String(n).padStart(2, '0')
}

export default function Calendar({ selectedDate, onSelectDate, habits }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [calData, setCalData] = useState([])

  useEffect(() => {
    api.calendar.get(year, month).then(d => setCalData(d.days)).catch(() => {})
  }, [year, month])

  const dayMap = new Map(calData.map(d => [d.date, d]))
  const activeHabits = habits.filter(h => h.active)

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const totalDays = daysInMonth(year, month)
  const startDay = firstWeekday(year, month)
  const cells = []

  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)

  // Weekly stats strip — current calendar week
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  })

  const weekStats = activeHabits.map(h => {
    const count = weekDates.filter(date => {
      const d = dayMap.get(date)
      if (!d) return false
      const v = d.habits[String(h.id)]
      return v === true || (typeof v === 'number' && v > 0)
    }).length
    return { id: h.id, name: h.name, count }
  })

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
        >
          ‹
        </button>
        <span className="text-sm font-medium">{MONTHS[month-1]} {year}</span>
        <button
          onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
        >
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 text-center">
        {DAYS.map(d => (
          <div key={d} className="text-[11px] text-[var(--muted-foreground)] py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />
          const dateStr = `${year}-${pad(month)}-${pad(day)}`
          const data = dayMap.get(dateStr)
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDate

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className={[
                'relative flex flex-col items-center py-1 rounded text-[12px] transition-colors',
                isSelected ? 'bg-[var(--foreground)] text-[var(--primary-foreground)]' : 'hover:bg-[var(--muted)]',
                isToday && !isSelected ? 'font-semibold' : '',
                !data ? 'text-[var(--muted-foreground)]' : ''
              ].join(' ')}
            >
              <span>{day}</span>
              {data && activeHabits.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {activeHabits.map(h => {
                    const v = data.habits[String(h.id)]
                    const done = v === true || (typeof v === 'number' && v > 0)
                    return (
                      <div
                        key={h.id}
                        className={[
                          'w-1 h-1 rounded-full',
                          isSelected
                            ? (done ? 'bg-white' : 'bg-white/40')
                            : (done ? 'bg-[var(--foreground)]' : 'border border-[var(--border)]')
                        ].join(' ')}
                      />
                    )
                  })}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Weekly stats strip */}
      {weekStats.length > 0 && (
        <div className="border-t border-[var(--border)] pt-3 mt-1">
          <div className="text-[11px] text-[var(--muted-foreground)] mb-2">This week</div>
          <div className="flex flex-col gap-1">
            {weekStats.map(s => (
              <div key={s.id} className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--muted-foreground)]">{s.name}</span>
                <span className="font-medium">{s.count}/7</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Calendar.jsx
git commit -m "feat: Calendar component"
```

---

### Task 9: DayEditor and SaveStatus Components

**Files:**
- Create: `frontend/src/components/SaveStatus.jsx`
- Create: `frontend/src/components/DayEditor.jsx`

- [ ] **Step 1: Create frontend/src/components/SaveStatus.jsx**

```jsx
export default function SaveStatus({ status }) {
  const label = {
    idle: '',
    saving: 'Saving…',
    saved: 'Saved',
    error: 'Save failed'
  }[status] ?? ''

  if (!label) return null

  return (
    <div className="text-[11px] text-[var(--muted-foreground)] pointer-events-none select-none">
      {label}
    </div>
  )
}
```

- [ ] **Step 2: Create frontend/src/components/DayEditor.jsx**

```jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api'
import SaveStatus from './SaveStatus'

function formatDateHeading(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function DayEditor({ date, habits }) {
  const [entry, setEntry] = useState(null)
  const [habitValues, setHabitValues] = useState({})
  const [saveStatus, setSaveStatus] = useState('idle')
  const saveTimer = useRef(null)
  const activeHabits = habits.filter(h => h.active)

  useEffect(() => {
    if (!date) return
    setSaveStatus('idle')
    api.day.get(date).then(data => {
      setEntry(data.entry ?? { did_today: '', doing_tomorrow: '' })
      const vals = {}
      for (const log of data.habits) {
        vals[log.habit_type_id] = log.value
      }
      setHabitValues(vals)
    }).catch(() => {})
  }, [date])

  const scheduleSave = useCallback((updatedEntry, updatedHabits, delay) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        setSaveStatus('saving')
        await api.day.save(date, {
          did_today: updatedEntry.did_today || null,
          doing_tomorrow: updatedEntry.doing_tomorrow || null,
          habits: updatedHabits
        })
        setSaveStatus('saved')
      } catch {
        setSaveStatus('error')
      }
    }, delay)
  }, [date])

  function handleHabitChange(id, kind, rawValue) {
    const value = kind === 'boolean' ? rawValue : Number(rawValue)
    const updated = { ...habitValues, [id]: value }
    setHabitValues(updated)
    scheduleSave(entry, updated, 400)
  }

  function handleJournalChange(field, value) {
    const updated = { ...entry, [field]: value }
    setEntry(updated)
    scheduleSave(updated, habitValues, 800)
  }

  function handleJournalBlur(field, value) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const updated = { ...entry, [field]: value }
    setEntry(updated)
    setSaveStatus('saving')
    api.day.save(date, {
      did_today: updated.did_today || null,
      doing_tomorrow: updated.doing_tomorrow || null,
      habits: habitValues
    }).then(() => setSaveStatus('saved')).catch(() => setSaveStatus('error'))
  }

  if (!date) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--muted-foreground)] text-sm">
        Select a day
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto relative max-w-2xl">
      <h2 className="text-base font-semibold mb-5">{formatDateHeading(date)}</h2>

      {/* Habits */}
      {activeHabits.length > 0 && (
        <div className="mb-6">
          <div className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
            Habits
          </div>
          <div className="flex flex-col gap-2">
            {activeHabits.map(h => (
              <div key={h.id} className="flex items-center justify-between py-1">
                <label htmlFor={`habit-${h.id}`} className="text-sm cursor-pointer">
                  {h.name}
                </label>
                {h.kind === 'boolean' ? (
                  <input
                    id={`habit-${h.id}`}
                    type="checkbox"
                    checked={habitValues[h.id] === true}
                    onChange={e => handleHabitChange(h.id, 'boolean', e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--border)] cursor-pointer"
                  />
                ) : (
                  <input
                    id={`habit-${h.id}`}
                    type="number"
                    value={habitValues[h.id] ?? ''}
                    onChange={e => handleHabitChange(h.id, 'number', e.target.value)}
                    className="w-16 text-right border border-[var(--border)] rounded px-2 py-0.5 text-sm bg-[var(--background)] outline-none focus:ring-1 focus:ring-[var(--ring)]"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Journal */}
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
            Today
          </label>
          <textarea
            value={entry?.did_today ?? ''}
            onChange={e => handleJournalChange('did_today', e.target.value)}
            onBlur={e => handleJournalBlur('did_today', e.target.value)}
            placeholder="What did you do today?"
            rows={5}
            className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)] resize-none outline-none focus:ring-1 focus:ring-[var(--ring)] placeholder:text-[var(--muted-foreground)]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
            Tomorrow
          </label>
          <textarea
            value={entry?.doing_tomorrow ?? ''}
            onChange={e => handleJournalChange('doing_tomorrow', e.target.value)}
            onBlur={e => handleJournalBlur('doing_tomorrow', e.target.value)}
            placeholder="What are you doing tomorrow?"
            rows={5}
            className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)] resize-none outline-none focus:ring-1 focus:ring-[var(--ring)] placeholder:text-[var(--muted-foreground)]"
          />
        </div>
      </div>

      {/* Save status */}
      <div className="absolute bottom-4 right-6">
        <SaveStatus status={saveStatus} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SaveStatus.jsx frontend/src/components/DayEditor.jsx
git commit -m "feat: DayEditor and SaveStatus components"
```

---

### Task 10: HabitManager Component

**Files:**
- Create: `frontend/src/components/HabitManager.jsx`

- [ ] **Step 1: Create frontend/src/components/HabitManager.jsx**

```jsx
import { useState } from 'react'
import { api } from '../lib/api'

export default function HabitManager({ habits, onHabitsChange, onClose }) {
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState('boolean')
  const [error, setError] = useState('')

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      await api.habits.create(newName.trim(), newKind)
      setNewName('')
      setError('')
      const data = await api.habits.list()
      onHabitsChange(data.habits)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleToggle(habit) {
    try {
      await api.habits.update(habit.id, { active: !habit.active })
      const data = await api.habits.list()
      onHabitsChange(data.habits)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/20">
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl shadow-lg w-full max-w-sm mx-4 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">Habits</h3>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] text-lg"
          >
            ×
          </button>
        </div>

        {/* Existing habits */}
        <div className="flex flex-col gap-2 mb-5">
          {habits.map(h => (
            <div key={h.id} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="text-sm">{h.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)] uppercase">
                  {h.kind}
                </span>
              </div>
              <button
                onClick={() => handleToggle(h)}
                className={[
                  'relative w-8 h-4 rounded-full transition-colors',
                  h.active ? 'bg-[var(--foreground)]' : 'bg-[var(--border)]'
                ].join(' ')}
              >
                <div
                  className={[
                    'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform',
                    h.active ? 'translate-x-4' : 'translate-x-0.5'
                  ].join(' ')}
                />
              </button>
            </div>
          ))}
          {habits.length === 0 && (
            <p className="text-sm text-[var(--muted-foreground)]">No habits yet.</p>
          )}
        </div>

        {/* New habit form */}
        <form onSubmit={handleCreate} className="flex flex-col gap-2">
          <div className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
            New habit
          </div>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Habit name"
            className="border border-[var(--border)] rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--ring)] bg-[var(--background)]"
          />
          <div className="flex gap-2">
            <select
              value={newKind}
              onChange={e => setNewKind(e.target.value)}
              className="border border-[var(--border)] rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--ring)] bg-[var(--background)] flex-1"
            >
              <option value="boolean">Yes/No</option>
              <option value="number">Number</option>
            </select>
            <button
              type="submit"
              className="px-3 py-1.5 bg-[var(--foreground)] text-[var(--primary-foreground)] rounded text-sm font-medium hover:opacity-90"
            >
              Add
            </button>
          </div>
          {error && <p className="text-[12px] text-red-500">{error}</p>}
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/HabitManager.jsx
git commit -m "feat: HabitManager component"
```

---

### Task 11: App.jsx — Wire Everything Together

**Files:**
- Create: `frontend/src/App.jsx`

- [ ] **Step 1: Create frontend/src/App.jsx**

```jsx
import { useState, useEffect } from 'react'
import { api } from './lib/api'
import Calendar from './components/Calendar'
import DayEditor from './components/DayEditor'
import HabitManager from './components/HabitManager'

function todayStr() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

export default function App() {
  const [habits, setHabits] = useState([])
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [showHabitManager, setShowHabitManager] = useState(false)

  useEffect(() => {
    api.habits.list().then(d => setHabits(d.habits)).catch(() => {})
  }, [])

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left panel — calendar */}
      <div className="w-[360px] flex-shrink-0 border-r border-[var(--border)] p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold text-sm">Daily Log</span>
          <button
            onClick={() => setShowHabitManager(true)}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] text-lg"
            title="Manage habits"
          >
            ⚙
          </button>
        </div>
        <Calendar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          habits={habits}
        />
      </div>

      {/* Right panel — day editor */}
      <div className="flex-1 flex overflow-hidden">
        <DayEditor
          date={selectedDate}
          habits={habits}
        />
      </div>

      {/* Habit manager modal */}
      {showHabitManager && (
        <HabitManager
          habits={habits}
          onHabitsChange={setHabits}
          onClose={() => setShowHabitManager(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build frontend and verify**

```bash
cd frontend && npm run build
cd ..
```

Expected: Builds without errors.

- [ ] **Step 3: Run all backend tests one more time**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: App.jsx wiring — full app complete"
```

---

### Task 12: VPS Deploy

**This task runs on the VPS via SSH and in the Porkbun + GitHub UI.**

- [ ] **Step 1: Create the test database locally first**

```bash
psql -c "CREATE DATABASE daily_log_test"
psql -d daily_log_test -f schema.sql
```

Run all tests to confirm they pass against the real DB:

```bash
npx vitest run
```

Expected: All pass.

- [ ] **Step 2: Push to GitHub and create the repo**

Create repo `daily-log-vps` on GitHub (dpetryshchuk account), then:

```bash
git remote add origin https://github.com/dpetryshchuk/daily-log-vps.git
git push -u origin master
```

- [ ] **Step 3: Add GitHub Actions secrets**

In GitHub → repo → Settings → Secrets and variables → Actions, add (if not already present from other repos):

| Secret | Value |
|---|---|
| `VPS_HOST` | `46.225.78.10` |
| `VPS_USER` | `dima` |
| `VPS_SSH_KEY` | contents of `~/.ssh/id_ed25519` (local machine) |

- [ ] **Step 4: SSH into VPS and set up app**

```bash
ssh dima@46.225.78.10

# Create Postgres database
psql -c "CREATE DATABASE daily_log"
psql -d daily_log -c "CREATE USER daily_log WITH PASSWORD 'choose-a-password'"
psql -d daily_log -c "GRANT ALL PRIVILEGES ON DATABASE daily_log TO daily_log"

# Clone repo
cd /home/dima
git clone https://github.com/dpetryshchuk/daily-log-vps.git daily-log
cd daily-log

# Create .env
cat > .env << 'EOF'
DATABASE_URL=postgresql://daily_log:<password>@localhost:5432/daily_log
PORT=4113
EOF

# Run schema
psql -d daily_log -f schema.sql

# Install and build
npm install
npm run build

# Install systemd service
sudo cp daily-log.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable daily-log
sudo systemctl start daily-log
sudo systemctl status daily-log
```

- [ ] **Step 5: Add Caddy vhost**

```bash
sudo nano /etc/caddy/Caddyfile
```

Append:

```caddy
log.dmytropetryshchuk.com {
  basicauth {
    dima <bcrypt-hash>
  }
  reverse_proxy localhost:4113
}
```

To generate the hash (use same password as other apps or a new one):

```bash
caddy hash-password --plaintext yourpassword
```

Then reload:

```bash
sudo systemctl reload caddy
```

- [ ] **Step 6: Add DNS A record on Porkbun**

1. Go to porkbun.com → DNS → `dmytropetryshchuk.com`
2. Add A record: Host = `log`, Answer = `46.225.78.10`, TTL = 600
3. Wait ~2 minutes

- [ ] **Step 7: Verify**

Visit `https://log.dmytropetryshchuk.com` — should show the Daily Log app with the calendar on the left and day editor on the right.

Test the full flow:
- Click today's date
- Check the creatine habit
- Write something in the Today field, click away
- Confirm "Saved" appears
- Navigate to previous month and back — creatine dot should show

- [ ] **Step 8: Update VPS-GUIDE.md port log**

In `writing-app/docs/VPS-GUIDE.md`, update the port allocation table and running apps table:

```markdown
| daily-log | 4113 | `log.dmytropetryshchyk.com` | `daily-log` | `/home/dima/daily-log` |
```

And update "Next available port" to 4114.

```bash
# commit from writing-app repo
cd C:\Users\Dima\Documents\1. Projects\writing-app
git add docs/VPS-GUIDE.md
git commit -m "docs: add daily-log to VPS port log"
```
