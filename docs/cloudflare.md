# Running on Cloudflare

Written 11 September 2026. Everything marked verified below was measured on
this machine against the real `workerd` runtime, not read in documentation.

**It works.** The app builds for Cloudflare Workers, runs there, and fits the
free plan's size limit. The database driver, TCP and TLS all work inside the
runtime. There is one condition: password hashing needs the $5/month plan, for
the reason below.

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

## The database driver: verified as far as it can be without a database

The app talks to Postgres through `pg`, which opens a TCP socket and then
negotiates TLS. Both were probed inside `workerd`:

```
pg loads in a Worker                      yes
TCP connect to a closed port              "cannot connect to the specified
                                           address" — the socket layer ran
node:tls available                        yes, tls.connect is a function
TLS handshake to a real host on 443       secureConnect, authorized = true
```

The connection error is the informative one. It is workerd's socket layer
reporting that nothing was listening, not a complaint about an unimplemented
API, so the driver loaded, ran, and opened a real socket. And the TLS
handshake completed with the certificate chain validated, which is what Neon
and Supabase both require.

What is left is the end-to-end connection to a real database, which needs a
`DATABASE_URL` to exist. Every layer under it works.

If `pg` does turn out to misbehave against a managed host, Neon publishes
`@neondatabase/serverless` with the same API over HTTP, and
`src/lib/db/postgres.ts` is the only file that would change.

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

Nothing is deployed yet. The order is:

1. Create the database (Neon or Supabase, free) and apply `schema.sql`.
2. Set `DATABASE_URL` and `APP_URL` as Worker secrets.
3. Take Workers Paid, for the CPU reason above. Signing in fails without it,
   and it fails in a way that looks like a broken form.
4. `npx wrangler deploy`, then check `/login` actually signs in — that is the
   one path none of this has been able to exercise without a real database.
