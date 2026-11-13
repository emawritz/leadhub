# LeadHub

Find local businesses on Google Maps, enrich them with email, WhatsApp, CUIT and socials, and work them in a small CRM — all self-hosted.

![LeadHub explorer (demo data)](docs/screenshot.png)

*Screenshot uses fictional demo data.* · [Leer en español](README.es.md)

## What it does

- **Scrape** Google Maps by query + location with Playwright (CLI or on-demand from the UI), with OpenStreetMap as a no-anti-bot alternative source.
- **Enrich** each lead by visiting its website: email, CUIT (Argentine tax ID), Instagram, Facebook, WhatsApp.
- **Dedup & ingest** into Postgres idempotently — re-running a scrape updates, never duplicates.
- **Explore** with faceted filters (province, city, category, source, has-email/phone/WhatsApp), priority score, URL-synced state and CSV export.
- **Work the leads** in a shared Kanban pipeline with owners, activity timeline and due tasks.

## Stack

| Package | Path | What |
|---|---|---|
| `@leadhub/core` | `packages/core` | Pure logic: dedup, Zod filters, CUIT/email/URL validation, geo, scoring, CSV/JSON export. No I/O. |
| `@leadhub/scraper` | `apps/scraper` | Playwright CLI (`maps-scraper search ...`). |
| `@leadhub/ingest` | `apps/ingest` | Idempotent JSON → Postgres upsert (`leadKey` dedup). |
| `@leadhub/api` | `apps/api` | Fastify + Drizzle + JWT: leads, facets, export, pipeline, tasks, scrape jobs. |
| `@leadhub/web` | `apps/web` | React + Vite explorer and CRM. |

TypeScript end to end, pnpm workspaces, Vitest unit tests and a Playwright e2e (login → filter → export).

## Quick start

Requires Node 20+, pnpm and Docker.

```bash
pnpm install
docker compose up -d db                     # Postgres on host port 5544
cp apps/api/.env.example apps/api/.env      # see below
pnpm --filter @leadhub/api migrate
pnpm --filter @leadhub/api seed:account demo@leadhub.com demo1234 Demo
pnpm --filter @leadhub/scraper build

PORT=4501 pnpm --filter @leadhub/api dev
VITE_API_PROXY_TARGET=http://localhost:4501 pnpm --filter @leadhub/web dev
```

Open http://localhost:5173, log in with the seeded account and go to **Buscar** to run a scrape, or ingest a JSON you already have:

```bash
cd apps/ingest && pnpm dev -- --input ../../output/leads.json
```

`apps/api/.env`:

```bash
DATABASE_URL=postgres://leadhub:leadhub@localhost:5544/leadhub
DATABASE_URL_TEST=postgres://leadhub:leadhub@localhost:5544/leadhub_test
JWT_SECRET=change-me
PORT=4501
```

The scraper runs headless with a persistent browser profile (`.cache/browser-profile`, git-ignored). If Google shows a CAPTCHA, run once with `--headed`, solve it, and later jobs reuse the session.

Full setup, tests, e2e and the pipeline API are documented in [README.es.md](README.es.md) (Spanish).

## Responsible use

Scraping Google Maps may go against Google's Terms of Service. This project is meant for personal research and small-scale prospecting of publicly listed businesses. Respect rate limits, local privacy and anti-spam laws, and opt-out requests. You are responsible for how you use it.

## License

[MIT](LICENSE)
