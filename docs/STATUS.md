# Project status

Last reviewed: 21 September 2026. Launch target is 19 November 2026, which is
**59 days out**.

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
| Reading a Reddit thread inside the app, body and comments | Done |
| Content pipeline: bulk CSV in and out, audit log, queue handoff | Done |
| Account deletion, real erasure rather than a flag | Done |
| Short-form video: cut planning, framing, encoder settings | Planning layer done, render layer not written |

17,500 lines across 25 pages and 8 API routes. 309 tests.

---

## What is left, in the order I would do it

The content pipeline that used to sit at step 5 is built: every dataset table
has an editor, bulk CSV import and export with per-row errors reported by line
number, and every edit is written to `audit_log`. Imported rows go through the
same Zod schema and the same Verified-citation guard as a hand edit, so bulk
entry cannot be used as a way around the provenance rule.

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

### 5. The video render layer

`src/lib/video/` plans a vertical cut from a Creator Lab script, decides how a
landscape frame becomes a 9:16 one, and carries encoder settings that were
measured in a browser rather than copied from a tutorial. 75 tests. What is
missing is the thin part that actually runs it: `VideoDecoder` and
`VideoEncoder` with a muxer, driven by those plans.

Two findings from the measurement worth not rediscovering. The codec string
every example uses, `avc1.42001f`, is baseline **level 3.1** and is refused at
1080x1920; level 4.2 is the one that works. And at that size the encode runs
around 7 to 13 frames a second, so a 60-second short takes minutes, not
seconds -- whatever starts it needs visible progress and a way to cancel.

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
  local testing and returns nothing in production. The `.rss` feed of the
  same listing does answer (checked 21 September 2026), with a tiny anonymous
  budget: about one request a minute per IP. `src/lib/social/reddit.ts` uses
  the OAuth API when credentials exist and the RSS feed, cached and with the
  last good answer kept, when they do not.
- **YouTube channel RSS (`/feeds/videos.xml`) has returned 404 for every
  channel since February 2026**, YouTube's own included. A platform-wide
  outage, not a block on us. oEmbed still answers, so the keyless fallback is
  now a short list of official Rockstar trailers verified through it. The real
  fix is a free `YOUTUBE_API_KEY`.
- **Discord needs no bot and no widget for a member count.** The public invite
  endpoint returns approximate member and online counts for any valid invite,
  so `NEXT_PUBLIC_DISCORD_INVITE` alone is enough.
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
