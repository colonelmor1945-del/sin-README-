# Project status

Last reviewed: 10 September 2026. Launch target is 19 November 2026, which is
**70 days out**.

If you are joining the project, read this first, then `README.md` for the
architecture.

---

## Getting it running

```bash
npm install
npm run dev
```

That is the whole setup. **No API keys are required** to run everything: with no
`ANTHROPIC_API_KEY` the AI falls back to a deterministic local analyst that uses
the same formulas the model is asked to reason over, so every screen works.

Copy `.env.example` to `.env.local` to switch on the optional integrations. Every
key listed there is free.

---

## The one rule that governs the codebase

GTA 6 has not shipped a stable public economy. Everything in the dataset is
placeholder, and **nothing currently carries the Verified label except the launch
date**.

So: every game figure renders with a provenance tag (Verified, Community,
Estimated, AI projection) and that tag travels with the number wherever it goes.
The system prompt binds the model to the same rule, and it may not invent a
mission, asset or price outside the dataset it is handed.

Anything you build has to hold this line. It is the only thing that separates
this from every other GTA guide site, and it is not decoration.

Two corollaries that have already caught us out:

- Figures a player might plan around are **ranges**, not point estimates. See
  `hourlyRange` and `paybackRange` in `src/lib/calc.ts`.
- Words like "unlimited" have to be literally true. The tiers previously said
  unlimited while a rate limiter said otherwise; that is now a real number per
  tier.

---

## What is done

| Area | State |
|---|---|
| Landing page, 3D WebGL backdrop, launch countdown | Done |
| Auth: email and password, plus Google sign-in | Done |
| Dashboard, AI assistant, money plan generator | Done |
| Money calculator, mission intelligence, economy tracker | Done |
| Interactive map, intel feed, Creator Lab | Done |
| Community feed: YouTube Shorts, Reddit, Discord | Done |
| Pricing tiers, discount engine, Lab Credits | Done |
| Admin panel, legal page, Fund the Lab page | Done |
| PostgreSQL schema and adapter | Done. Needs a DATABASE_URL |
| Spotify playlist embed | Done |
| Payments | Interface and webhook verification written, no processor |
| PWA: manifest, icons, service worker, offline page | Done |
| SEO: robots, sitemap, canonical URLs, structured data | Done |
| Local PostgreSQL for development, on disk, no install | Done |

17,500 lines across 24 pages and 8 API routes. 118 tests.

---

## What is left, in the order I would do it

### 1. Provision a database

The adapter is written (`src/lib/db/postgres.ts`). What is left is
operational: create a Postgres instance, apply `src/lib/db/schema.sql`, set
`DATABASE_URL`. `getStore()` picks the adapter automatically, and refuses to
fall back to the in-memory store in production.

Writing the adapter surfaced two gaps in the original schema, both now fixed:
there was no `sessions` table and no `password_hash` column, because the
schema was written before authentication existed.

### 2. Payments

The provider interface, status machine and signature-verified webhook handling
are written and tested against forged requests. What is missing is a live
processor: `createIntent` throws rather than pretending to work.

- Card and subscriptions: Stripe.
- Crypto: BTCPay Server, self-hosted. The founder wants most revenue in crypto,
  so this is not the secondary path.

Entitlements must only ever be granted on a confirmed webhook. Never from
anything the browser reports.

### 3. Deploy

Needs a host, a domain, `APP_URL` set, and the Google OAuth redirect URI
registered against the real origin. Nothing is deployed yet.

### 4. Rate limiting across more than one node

`src/lib/ratelimit.ts` is in-process. Correct for one instance, wrong for a
fleet. Swap the Map for Redis; the call signature does not change.

### 5. Content pipeline

Right now the dataset is a set of TypeScript files. Before launch it needs an
editor UI over `missions`, `assets`, `map_locations` and `news_items`, and a
verification queue so community submissions can be promoted to Verified with a
citable source. This is what makes the platform useful on day one rather than a
week later.

---

## Known gaps, stated plainly

- **Test coverage is deep in places and absent in others.** 118 tests, and they
  are concentrated where being wrong is expensive: the formulas in `calc.ts`,
  pricing, the ingestion trust ceilings, the payment state machine, the service
  worker's caching rules, and the schema itself against a real PostgreSQL.
  There is nothing covering the React components or the server actions, so a
  broken form is still something you find by opening it.
- **No email.** No verification, no password reset. A forgotten password is
  currently unrecoverable.
- **Rate limits and the Reddit token still live in process memory**, so they
  reset on restart and are per-instance. Accounts and sessions no longer do:
  `npm run dev:db` runs a real PostgreSQL on disk, and production requires one.
- **No analytics.** The admin panel shows business metrics as unavailable rather
  than as zero, because a zero reads as a measurement.

---

## Things that were tried and do not work

Recording these so nobody spends a day rediscovering them.

- **Reddit's public `.json` listings return 403** to server-side requests since
  the 2023 API changes. They still work from a browser, so this looks fine in
  local testing and returns nothing in production. Use the OAuth API, as
  `src/lib/social/reddit.ts` now does.
- **There is no public API to browse TikTok or Instagram by topic.** TikTok's
  Display API and Instagram's oEmbed only reach content you own or a specific
  post you already have the URL for. An endless topic feed can only come from
  scraping, which breaks their terms. We link to those platforms and say so.
- **"Sign in with Instagram" does not exist** as a general auth method. Basic
  Display is discontinued; what remains is Facebook Login for Business, for
  business accounts, behind app review.

---

## Legal posture, do not erode it

GTA 6 Money Lab is an independent fan-made platform, not affiliated with,
endorsed by, or associated with Rockstar Games or Take-Two Interactive.

- No Rockstar artwork, logos, logotypes, screenshots or map assets. The map is an
  abstract shape drawn in code; the backdrop is a shader; photography is licensed
  placeholder imagery.
- The palette is drawn from Miami-at-dusk generally. Colours are not owned.
- The disclaimer appears on the landing page, the sign-up screen, the footer and
  the legal page.
- Lab Credits are platform usage credits. Not cryptocurrency, not an investment,
  not transferable, not a security. That wording is deliberate and load-bearing.

`docs/rockstar-outreach.md` holds a draft approach to Rockstar and the reasons
to keep it small. Nothing has been sent.
