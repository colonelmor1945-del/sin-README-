import Image from "next/image";
import Link from "next/link";

import { ProvenanceTag } from "@/components/ProvenanceTag";
import { LaunchCountdown } from "@/components/LaunchCountdown";
import { Reveal } from "@/components/Reveal";
import { VicePlayground } from "@/components/VicePlayground";
import { SiteFooter, SiteNav } from "@/components/landing/Chrome";
import { HeroTerminal } from "@/components/landing/HeroTerminal";
import { ButtonLink, Panel } from "@/components/ui/primitives";
import { PROVENANCE_META } from "@/lib/provenance";
import { TIERS } from "@/lib/entitlements";
import { effectiveHourly, moneyPerHour, paybackDays, sortMissions } from "@/lib/calc";
import { ASSETS } from "@/lib/data/assets";
import { MISSIONS } from "@/lib/data/missions";
import { moneyShort, price } from "@/lib/format";
import type { Provenance } from "@/lib/types";

export default function LandingPage() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <Countdown />
        <DataHonesty />
        <Capabilities />
        <HowItWorks />
        <MissionPreview />
        <Pricing />
        <FundBand />
      </main>
      <SiteFooter />
    </>
  );
}

/* 1. Hero, asymmetric split ---------------------------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line">
      {/* Real 3D backdrop. Decorative, inert, and it stops when off screen. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <VicePlayground className="h-full w-full" />
        {/*
          Contrast is bought locally rather than by dimming the whole scene: a
          soft pool behind the headline column, and a fade where the section
          meets the next one. The right half of the frame stays bright.
        */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgb(6 4 11 / 0.96) 0%, rgb(6 4 11 / 0.88) 26%, rgb(6 4 11 / 0.55) 48%, rgb(6 4 11 / 0.15) 72%, transparent 100%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-40"
          style={{
            background: "linear-gradient(to top, var(--color-ground), transparent)",
          }}
        />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100dvh-4rem)] max-w-[1400px] items-center gap-12 px-4 pt-16 pb-20 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pt-24">
        <div>
          <h1 className="text-4xl leading-[1.05] font-semibold tracking-tighter text-ink md:text-6xl lg:text-[68px]">
            Make money.
            <br />
            <span className="text-accent">Dominate Vice City.</span>
          </h1>

          <p className="mt-6 max-w-[52ch] text-base leading-relaxed text-ink-muted">
            The AI intelligence platform that helps you plan smarter, earn
            faster and stay ahead in GTA 6.
          </p>

          {/*
            The clock sits above the fold on purpose. It is the single thing
            every visitor to a pre-launch site wants, and burying it below a
            scroll would be the wrong call however tidy it looks.
          */}
          <div className="mt-8">
            <LaunchCountdown />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/register" size="lg">
              Start free
            </ButtonLink>
            <ButtonLink href="/dashboard/assistant" size="lg" variant="outline">
              Try the AI
            </ButtonLink>
          </div>
        </div>

        <Reveal delay={0.1}>
          <HeroTerminal />
        </Reveal>
      </div>
    </section>
  );
}

/**
 * Stat tiles sitting over the 3D scene.
 *
 * Every figure is computed at render time from the dataset, so these move when
 * the data does. None of them is a marketing number: there is no user count
 * and no satisfaction percentage, because this has not launched and inventing
 * either would be the exact dishonesty the product exists to avoid.
 */
function HeroStats() {
  const best = sortMissions(MISSIONS, "best-hourly")[0];
  const fastest = ASSETS.filter((a) => a.dailyNet > 0).sort(
    (a, b) => (paybackDays(a) ?? 1e9) - (paybackDays(b) ?? 1e9),
  )[0];

  const tiles = [
    {
      label: "Best rate tracked",
      value: `${moneyShort(effectiveHourly(best))}/h`,
      foot: best.name,
    },
    {
      label: "Fastest payback",
      value: `${paybackDays(fastest)?.toFixed(1)}d`,
      foot: fastest.name,
    },
    {
      label: "Missions analysed",
      value: String(MISSIONS.length),
      foot: `${ASSETS.length} assets tracked`,
    },
  ];

  return (
    <dl className="grid max-w-xl grid-cols-3 gap-px overflow-hidden rounded-[14px] border border-line/80 bg-line/60 backdrop-blur-md">
      {tiles.map((t) => (
        <div key={t.label} className="bg-surface/70 px-4 py-3.5">
          <dt className="text-[10px] tracking-wide text-ink-faint">{t.label}</dt>
          <dd className="tabular mt-1 text-lg leading-none text-ink">{t.value}</dd>
          <dd className="mt-1.5 truncate text-[11px] text-ink-faint">{t.foot}</dd>
        </div>
      ))}
    </dl>
  );
}

/* 2. Countdown band ------------------------------------------------------- */

function Countdown() {
  return (
    <section className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-10 px-4 py-14 sm:px-8">
        <HeroStats />

        <div className="max-w-[38ch]">
          <h2 className="text-lg leading-snug font-medium text-ink">
            Walk in on day one knowing the route.
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
            The dataset gets rebuilt from verified sources the week the game
            ships. Set your profile now and the plan is ready when the servers
            are.
          </p>
          <ButtonLink href="/register" size="sm" variant="outline" className="mt-4">
            Claim your handle
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

/* 3. Data honesty, full-width band --------------------------------------- */

function DataHonesty() {
  const order: Provenance[] = ["verified", "community", "estimated", "ai-projection"];

  return (
    <section className="border-b border-line bg-surface">
      <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-8">
        <div className="max-w-[62ch]">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-ink md:text-4xl">
            Every number carries its receipts.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
            GTA 6 has not shipped a stable public economy, and most guides are
            confident about things nobody has confirmed. This platform labels
            the confidence of every figure it shows, and says plainly when it
            does not know.
          </p>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-[14px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {order.map((p, i) => (
            <Reveal key={p} delay={i * 0.06}>
              <div className="h-full bg-surface-2 p-5">
                <ProvenanceTag value={p} />
                <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
                  {PROVENANCE_META[p].description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* 4. Capabilities bento, asymmetric grid with mixed cell content ---------- */

function Capabilities() {
  const best = sortMissions(MISSIONS, "best-hourly")[0];

  return (
    <section id="platform" className="border-b border-line">
      <div className="mx-auto max-w-[1400px] px-4 py-24 sm:px-8">
        <p className="text-[11px] font-medium tracking-[0.18em] text-accent uppercase">
          The platform
        </p>
        <h2 className="mt-3 max-w-[20ch] text-3xl leading-tight font-semibold tracking-tight text-ink md:text-5xl">
          A terminal, not a wiki.
        </h2>

        <div className="mt-14 grid gap-4 lg:grid-cols-3 lg:grid-rows-2">
          <Reveal className="lg:col-span-2 lg:row-span-2">
            <Panel className="flex h-full flex-col overflow-hidden">
              <div className="relative aspect-[16/8] w-full overflow-hidden">
                <Image
                  src="https://picsum.photos/seed/vice-city-skyline-neon-dusk/1600/800"
                  alt="Night skyline over a coastal city"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover opacity-70"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, var(--color-surface) 8%, transparent 70%)",
                  }}
                  aria-hidden
                />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-ink">AI assistant</h3>
                <p className="mt-2 max-w-[58ch] text-[14px] leading-relaxed text-ink-muted">
                  Ask what to do with the cash you actually have. It reads your
                  level, your assets and your goal, then quotes the same
                  formulas the rest of the platform runs on rather than
                  inventing a number.
                </p>
                <p className="mt-4 rounded-[10px] border border-line bg-surface-2 p-3 text-[13px] leading-relaxed text-ink-muted italic">
                  &ldquo;Buy the {ASSETS.find((a) => a.id === "acid-lab")!.name} first. It
                  repays its {moneyShort(749_200)} in about{" "}
                  {paybackDays(ASSETS.find((a) => a.id === "acid-lab")!)?.toFixed(1)}{" "}
                  in-game days, which is the shortest in the set.&rdquo;
                </p>
              </div>
            </Panel>
          </Reveal>

          <Reveal delay={0.08}>
            <Panel className="h-full p-6">
              <h3 className="text-base font-semibold text-ink">Money plan generator</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                An ordered route from your balance to your goal. Every step
                carries an estimated profit, a time cost and the cash you need
                before you start it.
              </p>
              <div className="mt-5 space-y-2">
                {["Run the best unlocked mission", "Buy the fastest payback asset", "Loop while it accrues"].map(
                  (s, i) => (
                    <div key={s} className="flex items-center gap-3 text-[13px]">
                      <span className="tabular text-accent">{i + 1}</span>
                      <span className="text-ink-muted">{s}</span>
                    </div>
                  ),
                )}
              </div>
            </Panel>
          </Reveal>

          <Reveal delay={0.14}>
            <Panel
              className="h-full p-6"
              quiet
            >
              <h3 className="text-base font-semibold text-ink">Economy tracker</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                Payback periods and price trends for every asset, ranked by
                capital efficiency rather than sticker price.
              </p>
              <dl className="mt-5 space-y-2.5">
                {ASSETS.slice(0, 3).map((a) => (
                  <div key={a.id} className="flex items-baseline justify-between gap-3">
                    <dt className="truncate text-[13px] text-ink-muted">{a.name}</dt>
                    <dd className="tabular shrink-0 text-[13px] text-ink">
                      {paybackDays(a) ? `${paybackDays(a)!.toFixed(1)}d` : "n/a"}
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </Reveal>
        </div>

        <p className="mt-8 text-[13px] text-ink-faint">
          Also included: an interactive Leonida map with filterable layers,
          mission intelligence sorted by real hourly rate, and a creator lab
          for content ideas. Best rate in the current dataset is{" "}
          <span className="tabular text-ink-muted">
            {moneyShort(effectiveHourly(best))} per hour
          </span>{" "}
          from {best.name}.
        </p>
      </div>
    </section>
  );
}

/* 5. How it works, sticky heading plus hairline list ---------------------- */

function HowItWorks() {
  const steps = [
    {
      verb: "Tell it where you stand",
      body: "Cash on hand, level, what you already own and the number you are aiming at. Four fields, thirty seconds.",
    },
    {
      verb: "It runs the numbers",
      body: "Payback periods, risk-adjusted hourly rates and level gates across the whole dataset, then it ranks what is actually available to you.",
    },
    {
      verb: "You follow the route",
      body: "An ordered plan with time and profit estimates per step. Tick them off as you go and the projection updates.",
    },
  ];

  return (
    <section className="border-b border-line bg-surface">
      <div className="mx-auto grid max-w-[1400px] gap-12 px-4 py-24 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-ink md:text-4xl">
            Three inputs, one route.
          </h2>
          <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-ink-muted">
            The platform is opinionated on purpose. It gives you one recommended
            path and shows the working, so you can disagree with it.
          </p>
        </div>

        <ol className="divide-y divide-line">
          {steps.map((s, i) => (
            <Reveal key={s.verb} delay={i * 0.08}>
              <li className="flex gap-6 py-7 first:pt-0">
                <span className="tabular pt-0.5 text-sm text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="text-lg font-medium text-ink">{s.verb}</h3>
                  <p className="mt-2 max-w-[58ch] text-[14px] leading-relaxed text-ink-muted">
                    {s.body}
                  </p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* 6. Mission intelligence, real data table ------------------------------- */

function MissionPreview() {
  const rows = sortMissions(MISSIONS, "best-hourly").slice(0, 5);

  return (
    <section id="missions" className="border-b border-line">
      <div className="mx-auto max-w-[1400px] px-4 py-24 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="max-w-[22ch] text-3xl leading-tight font-semibold tracking-tight text-ink md:text-4xl">
            Sorted by what it pays, not by what it looks like.
          </h2>
          <Link
            href="/dashboard/missions"
            className="text-[13px] text-accent transition-colors hover:text-accent-soft"
          >
            Open mission intelligence
          </Link>
        </div>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line-strong text-[11px] text-ink-faint">
                <th className="pb-3 font-medium">Mission</th>
                <th className="pb-3 font-medium">Payout</th>
                <th className="pb-3 font-medium">Time</th>
                <th className="pb-3 font-medium">Raw hourly</th>
                <th className="pb-3 font-medium">Risk adjusted</th>
                <th className="pb-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {rows.map((m) => (
                <tr key={m.id} className="text-[13px]">
                  <td className="py-3.5 pr-4">
                    <span className="text-ink">{m.name}</span>
                    <span className="ml-2 text-ink-faint">{m.region}</span>
                  </td>
                  <td className="tabular py-3.5 pr-4 text-ink">{moneyShort(m.payout)}</td>
                  <td className="tabular py-3.5 pr-4 text-ink-muted">{m.duration}m</td>
                  <td className="tabular py-3.5 pr-4 text-ink-muted">
                    {moneyShort(moneyPerHour(m))}
                  </td>
                  <td className="tabular py-3.5 pr-4 text-accent">
                    {moneyShort(effectiveHourly(m))}
                  </td>
                  <td className="py-3.5">
                    <ProvenanceTag value={m.provenance} size="xs" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-5 text-[12px] text-ink-faint">
          Risk adjusted applies the expected cost of failed runs at each
          difficulty and splits the payout across the crew the mission needs.
        </p>
      </div>
    </section>
  );
}

/* 7. Pricing ------------------------------------------------------------- */

function Pricing() {
  const tiers = [
    { id: "free" as const, cta: "Start free", href: "/register" },
    { id: "pro" as const, cta: "Go Pro", href: "/dashboard/settings" },
    { id: "elite" as const, cta: "Go Elite", href: "/dashboard/settings" },
  ];

  return (
    <section id="pricing" className="border-b border-line bg-surface">
      <div className="mx-auto max-w-[1400px] px-4 py-24 sm:px-8">
        <p className="text-[11px] font-medium tracking-[0.18em] text-accent uppercase">
          Pricing
        </p>
        <h2 className="mt-3 text-3xl leading-tight font-semibold tracking-tight text-ink md:text-4xl">
          Cheaper than one bad purchase in game.
        </h2>

        <div className="mt-12 grid items-start gap-4 lg:grid-cols-3">
          {tiers.map(({ id, cta, href }) => {
            const tier = TIERS[id];
            const featured = id === "pro";
            return (
              <Reveal key={id} delay={id === "free" ? 0 : id === "pro" ? 0.07 : 0.14}>
                <div
                  className={
                    featured
                      ? "panel relative p-6 lg:-mt-4 lg:pb-8"
                      : "panel-quiet p-6"
                  }
                >
                  {featured ? (
                    <span className="absolute -top-2.5 left-6 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-medium text-white">
                      Most picked
                    </span>
                  ) : null}

                  <h3 className="text-sm font-semibold text-ink">{tier.label}</h3>
                  <p className="mt-3 flex items-baseline gap-1.5">
                    <span className="tabular text-3xl text-ink">
                      {tier.priceMinor === 0 ? "Free" : price(tier.priceMinor / 100)}
                    </span>
                    {tier.priceMinor > 0 ? (
                      <span className="text-[13px] text-ink-faint">a month</span>
                    ) : null}
                  </p>

                  <ul className="mt-6 space-y-2.5">
                    {tier.features.map((f) => (
                      <li key={f} className="flex gap-2.5 text-[13px] text-ink-muted">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <p className="mt-5 text-[12px] text-ink-faint">
                    Includes {tier.monthlyCredits} Lab Credits a month.
                  </p>

                  <ButtonLink
                    href={href}
                    variant={featured ? "primary" : "outline"}
                    className="mt-6 w-full"
                  >
                    {cta}
                  </ButtonLink>
                </div>
              </Reveal>
            );
          })}
        </div>

        <p className="mt-8 max-w-[70ch] text-[12px] leading-relaxed text-ink-faint">
          Lab Credits are platform usage credits for premium AI actions. They
          are not cryptocurrency, not an investment product, not transferable
          and not a security.
        </p>
      </div>
    </section>
  );
}

/* 8. Fund the Lab band --------------------------------------------------- */

function FundBand() {
  return (
    <section className="relative overflow-hidden">
      <div className="grid-field pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-8 px-4 py-20 sm:px-8">
        <div className="max-w-[52ch]">
          <h2 className="text-2xl leading-tight font-semibold tracking-tight text-ink md:text-3xl">
            This is an independent project.
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
            Support is voluntary and funds AI infrastructure, servers and new
            features. It does not represent an investment or an ownership
            interest.
          </p>
        </div>
        <ButtonLink href="/fund" size="lg">
          Support the Lab
        </ButtonLink>
      </div>
    </section>
  );
}
