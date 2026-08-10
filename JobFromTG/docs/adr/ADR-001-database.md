# ADR-001: PostgreSQL via Supabase with Prisma ORM

**Status:** Accepted  
**Date:** 2026-07-28  
**Deciders:** Engineering Team

---

## Context

The current system stores all scraped job data in a flat `jobs.json` file. This creates:
- No deduplication at the persistence layer
- No relational integrity (jobs reference companies, categories, skills as plain strings)
- No ability to query, sort, paginate, or full-text search
- No transaction support — a crash mid-write corrupts the file
- Scaling ceiling: the file is read in full on every HTTP request

We already have a Supabase project provisioned (`kszwswfervdgsjiefrbt`) with a DATABASE_URL in `.env`.

---

## Decision

Use **PostgreSQL hosted on Supabase** accessed via **Prisma ORM**.

---

## Alternatives Considered

| Option | Pros | Cons | Decision |
|---|---|---|---|
| Continue with JSON | Zero setup | All problems above | ❌ Rejected |
| MongoDB / Mongoose | Flexible schema | No relational integrity; overkill for structured job data | ❌ Rejected |
| SQLite + Prisma | Zero infra | Cannot scale to multi-instance; no cloud dashboard | ❌ Rejected |
| **PostgreSQL + Prisma** | Full relational model, migrations, type safety, Supabase dashboard | Requires schema design upfront | ✅ Accepted |
| Raw `pg` driver | Maximum control | No schema management, no type safety, manual migrations | ❌ Rejected |

---

## Rationale

1. **Supabase already provisioned** — no new infrastructure cost
2. **Prisma** gives typed query builder, auto-migrations, and a schema-as-code workflow
3. **PostgreSQL full-text search** (`tsvector`) eliminates the need for a separate search service (e.g. Elasticsearch) at this scale
4. **Relational model** enables future features: recruiter accounts, company dashboards, job recommendations, resume matching, saved jobs, notifications — all without schema surgery
5. **Prisma generates** a type-safe client automatically from the schema

---

## Consequences

- **Positive:** All data has constraints, foreign keys, unique indexes. Duplicates are rejected at the DB layer.
- **Positive:** Pagination, sorting, full-text search are native SQL — no client-side filtering.
- **Positive:** Future features (recruiter profiles, AI recommendations) fit naturally into the relational model.
- **Negative:** Requires schema migrations to be run when models change. Mitigated by `prisma migrate dev`.
- **Negative:** Requires the scraper to use a Prisma client or REST calls to insert — addressed in `scraper/database.py`.
