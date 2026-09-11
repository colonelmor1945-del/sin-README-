# Running on Cloudflare

Written 11 September 2026. Everything marked verified below was measured on
this machine against the real `workerd` runtime, not read in documentation.

**It works.** The app builds for Cloudflare Workers, runs there, and fits the
free plan's size limit. There is one condition and one open question.

---

## Verified

| Question | Answer |
|---|---|
| Does it build? | Yes. `@opennextjs/cloudflare` 1.20.6, exit 0 |
| Does it run? | Yes. `/`, `/legal`, `/login`, `/register`, `/fund`, `/offline` all 200 with real content |
| Manifest, robots, sitemap, icons? | All 200 |
| Does `/dashboard` still redirect when signed out? | Yes, 307 |
| Runtime errors? | None in the log |
| Upload size | **1.81 MB gzipped** (8.9 MB raw) |

The size matters because Workers caps the script: **3 MB gzipped on the free
plan, 10 MB on paid.** 1.81 MB fits free with room to grow.

### The crypto question, which was the one that could have killed it

Password hashing uses `scrypt` from `node:crypto`, and Workers is not Node. So
this was probed directly in `workerd` with `nodejs_compat`:

```
scrypt           function
scryptSync       function
randomBytes      function
timingSafeEqual  function
createHash       function
createPublicKey  function
verify           function

scrypt at N=32768, r=8, p=1:  78 ms
```

Every function the app uses is present, and the real cost parameters run.

---

## The condition: sign-in needs the paid plan

That 78 ms is CPU time, and **Workers limits CPU per request, not wall clock.**
The free plan's limit is far below 78 ms — it has historically been 10 ms —
so signing in or registering would be killed mid-request while every other
page on the site worked fine. Confirm the current figure against Cloudflare's
limits page before relying on this; what is certain is the 78 ms, which was
measured.

Workers Paid is **$5/month** and raises CPU per request to seconds. That is a
quarter of Vercel Pro, and unlike Vercel's free plan it permits commercial use,
which this project needs the moment it charges anyone. See
`docs/platform-viability.md`.

**Do not "fix" this by weakening scrypt.** The cost parameters are what make a
stolen password hash expensive to crack. $5 a month is the cheaper side of that
trade by a wide margin.

---

## Open: the database connection

Untested, because it needs a real connection string.

The app talks to Postgres through `pg`, which opens a TCP socket. Workers
supports TCP, but the well-trodden path on Cloudflare is a driver built for it.
If `pg` gives trouble, Neon publishes `@neondatabase/serverless` with the same
API over HTTP, and `src/lib/db/postgres.ts` is the only file that would change.

This is the next thing to test, and it needs `DATABASE_URL` to exist first.

---

## Also worth knowing

**OpenNext warns it is not fully compatible with Windows** and recommends WSL.
The build completed here anyway, and the result ran. Treat a Windows build as
something to verify rather than trust, and do the real deploys from CI or WSL.

**The `.open-next` output is 44 MB on disk.** Most of that is not uploaded;
what matters is the 1.81 MB gzipped figure above.

---

## Trying it

```bash
npm run cf:build     # build the worker
npm run cf:preview   # run it locally in workerd
npm run cf:size      # what the upload would weigh
```

Deploying needs `npx wrangler deploy`, a Cloudflare account, and
`DATABASE_URL` and `APP_URL` set as Worker secrets rather than in
`wrangler.jsonc`, which is committed.

Nothing is deployed yet. Until the database connection is tested, Netlify or
Vercel remain the paths that are known to work end to end.
