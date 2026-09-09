import { SiteFooter, SiteNav } from "@/components/landing/Chrome";
import { Panel, cx } from "@/components/ui/primitives";
import { PROVIDERS, supporterLevelFor } from "@/lib/payments";

export const metadata = {
  title: "Fund the Lab",
  description:
    "GTA 6 Money Lab is an independent project. Voluntary support funds AI infrastructure, servers and new features.",
};

const AMOUNTS = [500, 1000, 2500, 5000];

const BADGES = [
  { level: "supporter", label: "Supporter", from: "any amount" },
  { level: "early-supporter", label: "Early supporter", from: "25 euro and above" },
  { level: "founding-supporter", label: "Founding supporter", from: "50 euro and above" },
] as const;

export default function FundPage() {
  const cryptoReady = PROVIDERS.find((p) => p.id === "btcpay")?.configured ?? false;
  const cardReady = PROVIDERS.find((p) => p.id === "stripe")?.configured ?? false;

  return (
    <>
      <SiteNav />
      <main>
        <section className="relative overflow-hidden border-b border-line">
          <div className="grid-field pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative mx-auto max-w-[1400px] px-4 py-20 sm:px-8 lg:py-24">
            <div className="grid gap-12 lg:grid-cols-[1fr_420px] lg:gap-16">
              <div>
                <h1 className="text-4xl leading-[1.08] font-semibold tracking-tighter text-ink md:text-5xl">
                  Fund the Lab
                </h1>
                <p className="mt-5 max-w-[58ch] text-base leading-relaxed text-ink-muted">
                  Help us build the intelligence platform for GTA players.
                </p>
                <p className="mt-4 max-w-[62ch] text-[14px] leading-relaxed text-ink-muted">
                  GTA 6 Money Lab is an independent project built for players who
                  want smarter strategies, better tools and a new way to read the
                  game. Your voluntary support funds AI infrastructure,
                  development, servers and new features.
                </p>

                <div className="mt-10 max-w-md">
                  <h2 className="text-[13px] font-medium text-ink">Choose an amount</h2>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {AMOUNTS.map((minor) => (
                      <button
                        key={minor}
                        type="button"
                        disabled
                        title="Checkout is not configured in this build"
                        className="tabular cursor-not-allowed rounded-[10px] border border-line bg-surface-2 py-3 text-[15px] text-ink-muted opacity-60"
                      >
                        {minor / 100} EUR
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-col gap-2">
                    <label htmlFor="custom" className="text-[12px] text-ink-faint">
                      Or a custom amount
                    </label>
                    <input
                      id="custom"
                      type="number"
                      min={1}
                      placeholder="15"
                      disabled
                      className="tabular w-full cursor-not-allowed rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 text-[14px] text-ink-muted opacity-60"
                    />
                  </div>

                  <div className="mt-5 flex flex-col gap-2">
                    <button
                      type="button"
                      disabled
                      className="h-12 cursor-not-allowed rounded-full bg-accent px-7 text-[15px] font-medium text-white opacity-45"
                    >
                      Support the Lab
                    </button>
                    <button
                      type="button"
                      disabled
                      className="h-12 cursor-not-allowed rounded-full border border-line-strong px-7 text-[15px] font-medium text-ink opacity-45"
                    >
                      Support with crypto
                    </button>
                  </div>

                  <p className="mt-4 text-[12px] leading-relaxed text-ink-faint">
                    {cardReady || cryptoReady
                      ? "Checkout opens with the configured processor."
                      : "No payment processor is configured in this build, so both buttons are disabled rather than failing at checkout."}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <Panel className="p-5">
                  <h2 className="text-[13px] font-semibold text-ink">Supporter badges</h2>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
                    Optional, and private by default. You choose whether yours is
                    visible.
                  </p>
                  <ul className="mt-4 space-y-3">
                    {BADGES.map((b) => (
                      <li key={b.level} className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] text-ink">{b.label}</span>
                        <span className="text-[12px] text-ink-faint">{b.from}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-faint">
                    We never publish a wallet address as proof of support. The
                    badge is tied to your account, not to a public ledger entry.
                    Current threshold check:{" "}
                    <span className="text-ink-muted">
                      {supporterLevelFor(2500).replace("-", " ")}
                    </span>{" "}
                    at 25 euro.
                  </p>
                </Panel>

                <Panel quiet className="p-5">
                  <h2 className="text-[13px] font-semibold text-ink">
                    How contributions are handled
                  </h2>
                  <ul className="mt-3 space-y-2.5">
                    {[
                      "Payments are confirmed server-side. Nothing your browser sends can unlock a feature.",
                      "Every contribution is recorded with its amount, timestamp and provider reference so it can be reported as income.",
                      "We do not offer anonymity and we do not obscure who receives the funds.",
                      "We never hold private keys or seed phrases. The processor handles custody.",
                    ].map((line) => (
                      <li
                        key={line}
                        className="flex gap-2.5 text-[12px] leading-relaxed text-ink-muted"
                      >
                        <span
                          className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-accent"
                          aria-hidden
                        />
                        {line}
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            </div>

            <p
              className={cx(
                "mt-16 max-w-[80ch] border-t border-line pt-6 text-[12px] leading-relaxed text-ink-faint",
              )}
            >
              Contributions support the development of the platform and do not
              represent an investment or ownership interest. They are not
              refundable, do not entitle you to any share of revenue, and do not
              create any financial relationship between you and this project.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
