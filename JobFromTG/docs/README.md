# JobFeed v2 — Production Architecture

## Quick Start

### 1. Server (Express + Prisma)
```bash
cd server
npm install
npm run db:push          # Apply schema to Supabase (first time)
npm run db:generate      # Generate Prisma client
npm run dev              # Start dev server with --watch
```

### 2. Seed channels into DB
```bash
# With the server running:
cd server
python scripts/seed_channels.py
```

### 3. Migrate existing jobs.json into PostgreSQL
```bash
# Dry run first to preview:
python scripts/migrate_json_to_db.py --dry-run

# Then run the actual migration:
python scripts/migrate_json_to_db.py
```

### 4. Run the scraper
```bash
cd server
pip install -r requirements.txt
# With the Express server running:
python -m scraper.main
```

### 5. Frontend
```bash
cd JobFromTG   # (root of the React app)
npm install
npm run dev
```

---

## Environment Variables

All env vars live in `server/.env`. See the file for all keys.

| Variable | Purpose |
|---|---|
| `PORT` | Express server port (default: 5000) |
| `DATABASE_URL` | Supabase pooler URL (runtime queries) |
| `DIRECT_URL` | Supabase direct URL (migrations) |
| `CEREBRAS_API_KEY` | AI extraction |
| `TELEGRAM_API_ID` | Scraper auth |
| `TELEGRAM_API_HASH` | Scraper auth |
| `TELEGRAM_PHONE` | Scraper auth |

---

## API Endpoints

Base URL: `http://localhost:5000/api/v1`

| Method | Path | Description |
|---|---|---|
| GET | `/jobs` | Paginated jobs list |
| GET | `/jobs?q=engineer` | Full-text search |
| GET | `/jobs?category=Engineering` | Filter by category |
| GET | `/jobs?employment_type=FULL_TIME` | Filter by type |
| GET | `/jobs?experience_level=SENIOR` | Filter by level |
| GET | `/jobs?location=Addis Ababa` | Filter by city |
| GET | `/jobs?page=2&limit=20` | Pagination |
| GET | `/jobs/today` | Today's jobs |
| GET | `/jobs/recent?days=7` | Last N days |
| GET | `/jobs/:id` | Job detail |
| GET | `/companies` | All companies |
| GET | `/companies/:id/jobs` | Jobs by company |
| GET | `/channels` | Telegram channels |
| GET | `/stats` | Overall stats |
| GET | `/stats/categories` | Category breakdown |
| GET | `/stats/locations` | Top locations |

**Legacy redirect:** `GET /jobs` → `GET /api/v1/jobs` (301) for backward compat.

---

## Architecture

```
server/
├── app.js                    Express factory
├── server.js                 HTTP entrypoint + graceful shutdown
├── prisma/schema.prisma      17 normalized Prisma models
├── prisma.config.ts          Prisma 7 connection config
├── requirements.txt          Python dependencies
│
├── src/
│   ├── config/index.js       Centralized env config
│   ├── database/prisma.js    Singleton Prisma client
│   ├── utils/response.js     Standard API response envelope
│   ├── api/
│   │   ├── middleware/       requestLogger, errorHandler
│   │   ├── controllers/      jobs, stats (HTTP layer only)
│   │   └── routes/           jobs, stats, internal, index
│   ├── services/             jobs, stats (business logic)
│   └── repositories/         jobs, companies, channels (Prisma queries)
│
├── scraper/
│   ├── config.py             All env-based config
│   ├── utils.py              Text cleaning, hashing, Jaccard similarity
│   ├── telegram_client.py    Telethon singleton
│   ├── channel_scraper.py    Message fetching
│   ├── duplicate_detector.py 3-strategy dedup
│   ├── job_detector.py       0–100 confidence scoring
│   ├── regex_parser.py       15-field structured extraction
│   ├── cerebras_parser.py    AI extraction for ambiguous posts
│   ├── validator.py          Normalization (location, type, level, salary)
│   ├── database.py           HTTP client to Express API
│   └── main.py               Orchestration pipeline
│
└── scripts/
    ├── seed_channels.py      One-time channel seeder
    └── migrate_json_to_db.py One-time jobs.json importer
```

---

## Docs

Architecture Decision Records: [`docs/adr/`](docs/adr/)

| ADR | Decision |
|---|---|
| [ADR-001](docs/adr/ADR-001-database.md) | PostgreSQL via Supabase + Prisma |
| [ADR-002](docs/adr/ADR-002-scraper-modules.md) | Modular Python scraper |
| [ADR-003](docs/adr/ADR-003-ai-extraction.md) | Regex-first + Cerebras fallback |
| [ADR-004](docs/adr/ADR-004-api-architecture.md) | 4-layer Express architecture |
| [ADR-005](docs/adr/ADR-005-duplicate-detection.md) | 3-strategy deduplication |
