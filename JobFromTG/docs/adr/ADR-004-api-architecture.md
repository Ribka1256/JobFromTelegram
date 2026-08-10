# ADR-004: Layered Express API Architecture

**Status:** Accepted  
**Date:** 2026-07-28  
**Deciders:** Engineering Team

---

## Context

The current `server.js` is 51 lines that:
1. Reads `jobs.json` on every request
2. Has a single `GET /jobs` endpoint
3. Has a `POST /apply` stub that logs and returns `{ success: true }`
4. Has no error handling middleware
5. Has no request validation
6. Has no pagination (returns all jobs in one response)
7. Has no layering — all logic is in request handlers

This cannot support the required feature set: pagination, filtering, sorting, full-text search, saved jobs, statistics, today's jobs, trending categories, or company endpoints.

---

## Decision

Refactor into a **4-layer Express architecture:**

```
Request → Route → Controller → Service → Repository → Database
```

| Layer | Responsibility | What it must NOT do |
|---|---|---|
| **Route** | Define URL patterns and attach middleware | Business logic |
| **Controller** | Parse req, call service, format res | Database queries |
| **Service** | Business logic, orchestration | HTTP concerns (req/res) |
| **Repository** | All Prisma queries | Business logic |

---

## API Versioning

All endpoints are prefixed with `/api/v1/` to allow non-breaking API evolution.

Existing frontend calls `http://localhost:5000/jobs` — this will be updated to `/api/v1/jobs` in Phase 5. Old `/jobs` route will be preserved as a redirect during transition.

---

## Endpoints Defined

### Jobs
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/jobs` | List jobs with pagination, filter, sort, search |
| `GET` | `/api/v1/jobs/today` | Jobs posted today |
| `GET` | `/api/v1/jobs/recent` | Jobs from the last 7 days |
| `GET` | `/api/v1/jobs/:id` | Single job detail |

### Companies
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/companies` | List all companies |
| `GET` | `/api/v1/companies/:id/jobs` | Jobs for a specific company |

### Channels
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/channels` | List all scraped Telegram channels |

### Statistics
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/stats` | Total jobs, companies, categories, today count |
| `GET` | `/api/v1/stats/categories` | Job counts grouped by category |

---

## Query Parameters (GET /api/v1/jobs)

```
?page=1          — page number (default: 1)
?limit=20        — items per page (default: 20, max: 100)
?q=engineer      — full-text search (title + description)
?category=Engineering
?location=Addis Ababa
?employment_type=FULL_TIME
?experience_level=SENIOR
?sort=posted_at  — field to sort by
?order=desc      — asc | desc
?channel=fanajobs
?today=true      — only today's jobs
```

---

## Alternatives Considered

| Option | Decision |
|---|---|
| NestJS | ❌ Requires TypeScript migration; over-engineered for this scale |
| Fastify | ❌ Team unfamiliar; no benefit over Express for this use case |
| GraphQL | ❌ No frontend requires flexible queries; REST is sufficient |
| **Express + layered architecture** | ✅ Preserves existing stack; clean separation; familiar |

---

## Consequences

- **Positive:** Each layer is independently testable with mocks.
- **Positive:** Adding new endpoints (recruiter accounts, resume matching) requires only new routes/controllers/services — no core changes.
- **Positive:** Validation middleware (input sanitization) can be added globally without touching controllers.
- **Migration note:** The existing `/jobs` endpoint is preserved and works during transition. Frontend updated in Phase 5.
