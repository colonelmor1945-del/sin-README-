import { SiteFooter, SiteNav } from "@/components/landing/Chrome";
import { PROVENANCE_META, PROVENANCE_ORDER } from "@/lib/provenance";
import type { Provenance } from "@/lib/types";

export const metadata = {
  title: "Legal and data policy",
  description:
    "What GTA 6 Money Lab is, what its data means, and its relationship to Rockstar Games and Take-Two Interactive.",
};


export default function LegalPage() {
  return (
    <>
      <SiteNav />
      <main>
        <article className="mx-auto max-w-[1400px] px-4 py-20 sm:px-8">
          <h1 className="text-4xl leading-tight font-semibold tracking-tighter text-ink">
            Legal and data policy
          </h1>
          <p className="mt-4 max-w-[70ch] text-[15px] leading-relaxed text-ink-muted">
            Plain language, because the point of this platform is that you can
            trust what it tells you.
          </p>

          <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
            <section>
              <h2 className="text-xl font-semibold tracking-tight text-ink">
                Independence
              </h2>
              <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-ink-muted">
                GTA 6 Money Lab is an independent fan-made platform and is not
                affiliated with, endorsed by, or associated with Rockstar Games
                or Take-Two Interactive. Grand Theft Auto and all related marks
                are the property of their respective owners. We do not use
                Rockstar artwork, logos, screenshots or map assets. The map in
                this product is an abstract shape drawn in code, and the
                photography is licensed placeholder imagery.
              </p>

              <h2 className="mt-10 text-xl font-semibold tracking-tight text-ink">
                What the data means
              </h2>
              <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-ink-muted">
                GTA 6 has not shipped a stable public economy. Everything
                currently in this platform is placeholder data authored for the
                prototype. Nothing carries the verified label yet. Every figure
                is tagged, and the tag travels with the number wherever it
                appears.
              </p>

              <dl className="mt-6 space-y-4">
                {PROVENANCE_ORDER.map((p) => (
                  <div key={p} className="border-l-2 border-line pl-4">
                    <dt className="text-[13px] font-medium text-ink">
                      {PROVENANCE_META[p].label}
                    </dt>
                    <dd className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                      {PROVENANCE_META[p].description}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section>
              <h2 className="text-xl font-semibold tracking-tight text-ink">
                Lab Credits
              </h2>
              <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-ink-muted">
                Lab Credits are platform usage credits that pay for premium AI
                actions inside this product. They are not cryptocurrency, not an
                investment product, not a transferable financial asset and not a
                security. They have no value outside this platform, cannot be
                sold or transferred between accounts, and cannot be redeemed for
                money.
              </p>

              <h2 className="mt-10 text-xl font-semibold tracking-tight text-ink">
                Contributions
              </h2>
              <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-ink-muted">
                Support through Fund the Lab is voluntary. Contributions fund
                development, AI infrastructure and servers. They do not
                represent an investment or an ownership interest, do not entitle
                you to any share of revenue, and do not create a financial
                relationship between you and this project.
              </p>
              <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-ink-muted">
                Crypto contributions are recorded with their amount, timestamp
                and provider reference so they can be reported as income. We do
                not offer anonymity, we do not obscure who receives funds, and
                we never publish a wallet address as public proof of support.
                Private keys and seed phrases are never held by this platform.
              </p>

              <h2 className="mt-10 text-xl font-semibold tracking-tight text-ink">
                Not advice
              </h2>
              <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-ink-muted">
                Everything here concerns fictional in-game currency in a video
                game. Nothing on this platform is financial advice, and the AI
                does not discuss real-money trading, account sales, modding or
                anything that would put a player account at risk.
              </p>
            </section>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
