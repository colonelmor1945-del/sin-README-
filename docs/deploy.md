# Getting this online without buying a domain

Written 10 September 2026.

You do not need a domain. You need an **HTTPS origin**, and every host below
gives you one free: `something.vercel.app`, `something.netlify.app`,
`something.pages.dev`. All of them are real origins — a service worker
installs, the PWA installs, Google indexes them, and Digital Asset Links works
for the Play Store wrapper.

Two things are genuinely required, and both have a free tier.

---

## 1. A database

Not optional. Production **refuses to start** without `DATABASE_URL`, on
purpose: the fallback is an in-memory store that loses every account on
restart, and finding that out after launch is not recoverable.

Free tiers that fit: **neon.tech** or **supabase.com**. Either gives a Postgres
connection string on the free plan.

### Applying the schema

**Without installing anything.** Both Neon and Supabase have a SQL editor in
the browser. Open `src/lib/db/schema.sql`, copy the whole file, paste, run.
This is the easier path and it needs no tools at all.

**Or with psql**, if you have it:

```bash
psql "$DATABASE_URL" -f src/lib/db/schema.sql
```

`psql` does not ship with Windows and is not installed here, so use the browser
editor unless you have already installed the PostgreSQL client.

Either way it creates 23 tables, and the first account to register becomes
admin.

**It is safe to run twice.** Every statement is guarded, so if the connection
drops half way through you can paste it again rather than dropping the database
and starting over. There are tests that apply the real file to a real
PostgreSQL — compiled to WebAssembly, so they need no server — and assert
exactly that.

It requires **PostgreSQL 13 or newer** and no extensions. Neon and Supabase are
both well past that.

## 2. A host

```bash
npm run preflight
```

Run this before deploying and after setting the variables. It separates what
stops the app booting from what quietly switches a feature off, and only the
first kind fails. A half-configured deployment otherwise looks exactly like a
working one until somebody tries the missing thing.

### Which host

| Host | Free HTTPS | Next.js support | Commercial use on free tier |
|---|---|---|---|
| Vercel | `*.vercel.app` | native, zero config | **no — Hobby is non-commercial** |
| Netlify | `*.netlify.app` | good | yes |
| Cloudflare Pages | `*.pages.dev` | needs an adapter | yes |
| Railway / Render | subdomain | runs Node directly | yes, small monthly cost |

**The Vercel catch matters here.** Their Hobby plan is for personal,
non-commercial projects, and this one plans to charge for Pro and Elite. Using
it to test costs nothing and breaks nothing; running a paid product on it is a
terms problem, and the fix is $20/month for Pro or a different host. Confirm
the current terms rather than taking this table's word for it — these change.

**Suggested path:** deploy to Vercel free today to get a real origin and prove
everything works end to end. Move before you take the first euro.

### Deploying to Vercel

Import the GitHub repo at vercel.com/new, then set the environment variables in
the project settings. At minimum:

```
DATABASE_URL   the Neon or Supabase connection string
APP_URL        https://your-project.vercel.app
```

`APP_URL` has to be the deployed origin. Left at localhost, the sitemap fills
with localhost URLs, canonical tags point at your laptop and OAuth redirects
break — preflight fails on exactly this case because it is easy to miss.

---

## After it is live

1. **Google Search Console.** Add the property, submit
   `https://YOUR-ORIGIN/sitemap.xml`. This is what actually gets the pages
   indexed; the sitemap alone does nothing until somebody tells Google it
   exists.
2. **Install it on a phone.** Android Chrome offers it; on iOS it is Share,
   then Add to Home Screen. It should open with no browser chrome. If a URL bar
   is visible, the manifest is not being read.
3. **Check `/robots.txt` and `/sitemap.xml`** return your real origin, not
   localhost.
4. Then the Play Store wrapper, in `docs/play-store.md`, which needs the origin
   from step 2.

## About a domain, later

A domain is roughly €10 a year and it is worth having eventually, for two
reasons that are not vanity: `*.vercel.app` is somebody else's namespace, and
if you move host or lose the account, the URL goes with it — along with every
link, every Play Store asset link, and every bit of search ranking attached to
it. Buy one before you have an audience, not after.

It changes nothing technically. Point it at the host and update `APP_URL`.
