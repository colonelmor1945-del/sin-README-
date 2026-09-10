# Getting on the Play Store, and being findable

Written 10 September 2026.

Two goals that pull in opposite directions, so they are dealt with separately:
being **installable** (done, below), and being **found when someone searches
"GTA 6"** (possible, but the obvious version of it is the thing most likely to
get the app taken down).

---

## What now works

The app is a real PWA. Verified on a production build, not in dev:

| Piece | State |
|---|---|
| `manifest.webmanifest` | served, standalone, 3 icons, 3 shortcuts |
| Icons | 192, 512, maskable 512, apple-touch 180, favicon 32 |
| Service worker | registers, precaches, serves an offline page |
| `robots.txt` | serves, blocks `/dashboard`, `/admin`, `/api/` |
| `sitemap.xml` | serves, absolute URLs |
| Structured data | `WebApplication` with offers and the disclaimer |
| iOS standalone | `apple-mobile-web-app-capable`, status bar, touch icon |

Regenerate the icons with `npm run icons` if the mark changes. Build without
disturbing a running dev server with `npm run build:check`.

### What the service worker deliberately does not cache

`/dashboard`, `/admin`, `/login`, `/register` and `/api/` are never cached, and
there are tests in `src/lib/pwa/sw.test.ts` that load the real `public/sw.js`
and assert it. On a shared phone a cached dashboard is one person's data served
to the next one — a disclosure bug, not a staleness bug.

It also caches no figures. Offline shows a page that says so. A payout served
from a cache with no date on it is the confident-but-unverified thing the whole
provenance system exists to prevent.

---

## Getting it into Play

The wrapper is a Trusted Web Activity: an Android app that is a full-screen
Chrome pointed at the site, with no browser chrome. Google's own tool builds
it.

**1. Deploy to a real HTTPS domain.** Nothing below works against localhost.
Set `APP_URL` to that origin — canonical URLs, the sitemap, robots and the
OAuth redirect all read it.

**2. Generate the wrapper.**

```
npx @bubblewrap/cli init --manifest=https://YOURDOMAIN/manifest.webmanifest
npx @bubblewrap/cli build
```

It reads the manifest for the name, icon, colours and start URL, which is why
those values matter more than they look.

**3. Prove you own the domain.** Bubblewrap prints the signing key's SHA-256
fingerprint. Serve it at `https://YOURDOMAIN/.well-known/assetlinks.json`.
Without this the app opens with a Chrome address bar across the top and looks
like a browser bookmark rather than an app. **Keep the keystore and its
passwords somewhere safe and out of git**: lose it and you cannot ship an
update to the same listing, ever.

**4. Play Console.** One-off $25 registration, then the listing: title, short
and full description, feature graphic, screenshots, privacy policy URL, content
rating, data safety form.

Two answers on that form we have to get right, because they are declarations:
we collect an email address and a password hash for accounts, and payment is
handled off-device. Both have to be declared. Getting the data safety form
wrong is one of the more common reasons a listing gets pulled.

---

## Being found when someone searches "GTA 6"

This is the part with a real risk in it, so here it is plainly.

**On the web: do it, carefully.** Nothing stops us ranking for "GTA 6 money",
"GTA 6 best missions", "GTA 6 payback" and so on. That is nominative use — we
are describing what the tool is for, which is allowed, and it is what the
structured data, sitemap and canonical URLs shipped here are for. The honest
route is content that actually answers those questions, which is the product we
already have.

**On the Play Store: this is where it can go wrong.** Play's impersonation and
intellectual property policy covers app titles, icons and descriptions that
imply a relationship with someone else's brand. An app called **"GTA 6 Money
Lab"** in the store, ranking for "GTA 6", is squarely in the area that policy
was written about — and Take-Two is unusually active about enforcement.

The realistic outcomes, in order of likelihood:

1. It gets published, and later removed after a complaint. Removal takes the
   ranking, the reviews and the install base with it.
2. It gets rejected at review.
3. It stays up.

What lowers the risk, and none of it is a guarantee:

- **Title without the trademark.** "Money Lab" or "Vice Lab" as the store
  title, with the game named in the description as what the tool is *for*
  rather than what it *is*. This costs the exact search term you asked for.
  That is the trade, and it is a real one.
- **No Rockstar artwork anywhere** — icon, screenshots, feature graphic. The
  icon we generated is our own mark for this reason.
- **The disclaimer visible in the listing**, not buried: independent, fan-made,
  not affiliated with or endorsed by Rockstar Games or Take-Two Interactive.
  It is already in the app and in the structured data.
- **A distinct product.** The calculators, the provenance system and the
  planner are ours. That helps.

**My recommendation:** web first and hard, where using the term is defensible
and nobody can delete you. Play second, under a title that does not lead with
the trademark. Ranking for "GTA 6" inside the Play Store is the single highest
risk thing this project could do, and it is worth being deliberate about rather
than finding out after the listing has an audience on it.

That is a judgement call about your risk appetite, not a technical constraint.
The build works either way — the title lives in `src/app/manifest.ts`.
