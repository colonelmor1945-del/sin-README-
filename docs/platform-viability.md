# Where GTA 6 Money Lab can actually be sold

Written 10 September 2026. The commission and policy figures below move, and
some of them are in active litigation. Treat every number in the "what they
take" column as needing confirmation against the current developer agreement
before anyone signs anything.

The short version: **stay on the web, and do not build the billing on anyone
else's rails.** Everything below is the reasoning.

---

## The numbers we are defending

From `src/lib/pricing.ts`, which is the source of truth:

| Tier | Monthly | Yearly | AI budget |
|---|---|---|---|
| Free | €0 | — | 5 queries/day, 5 credits/mo |
| Pro | €8.99 | €89.90 | 150 queries/day, 80 credits/mo |
| Elite | €15.99 | €159.90 | 500 queries/day, 260 credits/mo |

Credit packs: €2.99 / 10, €11.99 / 50, €19.99 / 100. Founding discount 40%,
closes when the game ships.

Pro is €8.99 for a specific reason, recorded in the code: at €4.99 a heavy user
consumed more in model spend than the subscription brought in. That sentence is
the whole of this document's argument, so hold on to it.

## What each channel takes

| Channel | Their cut | Net on Pro €8.99 |
|---|---|---|
| Stripe (EU cards) | ~1.5% + €0.25 | **€8.61** |
| BTCPay (self-hosted) | network fee only | **~€8.99** |
| Apple App Store, standard | 30% | **€6.29** |
| Apple, Small Business Program | 15% | **€7.64** |
| Google Play, first $1M/yr | 15% | **€7.64** |
| Google Play, above that | 30% | **€6.29** |

Read the fourth row against the paragraph above it. **A 30% store commission
puts Pro's net at €6.29, which is closer to the €4.99 that was already proven
to lose money than it is to the €8.99 we set to stop losing it.** The App Store
does not just cost margin here. It undoes the price correction.

The Small Business Program (15%, for developers under $1M/year) softens that to
€7.64. That is survivable, but it is a rate we would grow out of exactly when
the model spend is highest, and it is not a rate anyone should build a plan on.

## Apple, in detail

Three separate problems, and the second one is fatal to the current design.

**1. Digital subscriptions must use Apple's billing.** An app that unlocks
features in exchange for money has to sell that through In-App Purchase. We
cannot take the user to our own Stripe checkout from inside an iOS app and keep
the 30%.

**2. Crypto is not allowed for this.** Apple's guidelines permit crypto
wallets and exchanges from approved institutions, and specifically do not allow
apps to use cryptocurrency as payment for digital content or unlocks. The
project's own plan is that "la mayoría se cobrará en crypto" — BTCPay,
self-hosted, near-zero fees. **That plan and the App Store are mutually
exclusive.** This is not a rate problem that a bigger volume fixes; it is a
category the store does not accept.

**3. The IP question comes up at review.** More on that below.

There is one legitimate shape that survives all three: an app that sells
nothing, and lets someone who already subscribed on the web sign in and use it.
Apple's rules for multiplatform and reader-style apps allow this, with real
limits on whether and how the app may point at the website. It is a worse
product than a PWA and it exists only to be in a search result.

Steering rules in the US and the EU have been moving — a US injunction and the
EU's Digital Markets Act have both loosened link-outs, on different terms, with
Apple's own fees attached in the EU. **Do not plan around any of that from
memory, including mine.** If we ever want an iOS presence, that is the week to
read the current agreement properly.

## Google Play

The same structural rule — digital goods go through Play Billing — with the
same 15% / 30% split, and the same crypto exclusion. Google is somewhat more
permissive about alternative billing in some markets, again on terms that keep
changing.

The one real difference: **Android does not need the store.** A PWA installs
from the browser with no review, no cut, and no policy exposure. On Android the
store is a distribution choice. On iOS it is closer to the only door, which is
why the iOS question is harder than the Android one.

## Xbox and PlayStation

This one is short, and the answer is no.

Both are closed platforms. Publishing needs a signed developer agreement
(ID@Xbox, PlayStation Partners), the approval process is built around games,
and a non-game companion app from an unknown studio is not a thing either
programme is set up to say yes to.

But the blocker is upstream of that. Console certification includes an IP
review, and this app is named after, built around, and monetised on another
company's game. **Microsoft and Sony are not going to certify a paid
third-party GTA 6 product without Take-Two's sign-off**, and asking them to is
a good way to draw attention we have not prepared for. The project's own rule —
independent, unaffiliated, no Rockstar assets — is the correct posture, and it
is also precisely the posture that a console store cannot accept for a paid app
in someone else's franchise.

Both consoles have browsers. A web app is reachable from them today, for free,
with nobody's permission. That is the console strategy.

## What this leaves

**Web first, and billing that we own.**

1. **PWA, not a native app.** Installable on Android and iOS home screens,
   offline-capable, no store, no commission, no review, no crypto restriction.
   The mobile work already done in this repo is most of the distance.
2. **Stripe for cards, BTCPay for crypto.** €8.61 and ~€8.99 net respectively
   against €6.29 through a store. On 1,000 Pro subscribers that gap is
   €2,317 a month through Stripe and €2,697 through BTCPay — which is model spend, not profit we are choosing to
   forgo.
3. **Revisit iOS only if organic mobile demand proves it**, and go in knowing
   it means a card-only, sign-in-only build, and a 15% floor on everything it
   brings in.
4. **Consoles: never, unless Rockstar is on the other side of the table.** If
   the outreach in `docs/rockstar-outreach.md` ever turns into a real
   conversation, this becomes a different document.

## The founding discount, checked against this

40% off Pro is €5.39, held for as long as the subscriber stays. Through our own
rails that nets €5.06, which is close to the €4.99 the code already records as
below what a heavy user consumes.

That is a deliberate loss on the heaviest founding subscribers, and it is
defensible: they are buying a placeholder dataset before the game ships, the
cohort is capped by the deadline, and the lock-in is the point. **But it only
works on our own rails.** The same discount sold through a store nets €3.78,
which is not a customer acquisition cost, it is a subsidy with no ceiling.

If the founding tier ever appears inside an app store, it has to be repriced.

## What to verify before acting

- Current Apple and Google commission tiers and Small Business eligibility.
- The current state of external-purchase links in the US and under the DMA,
  including Apple's EU fee structure.
- Whether Apple's crypto restriction has moved. Assume it has not.
- Stripe's current EU card rate for our volume and country.
