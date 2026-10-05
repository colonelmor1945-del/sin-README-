import { SiteFooter, SiteNav } from "@/components/landing/Chrome";
import { SubmitClaimForm } from "@/components/submissions/SubmitClaimForm";
import { Panel } from "@/components/ui/primitives";
import { CORROBORATION_REQUIRED } from "@/lib/ingest/sources";

export const metadata = {
  title: "Submit a claim",
  description:
    "Report a GTA 6 money-making claim with a source. It joins the same review queue as every other source, and never reaches the dataset without corroboration or a person deciding.",
};

const needed = CORROBORATION_REQUIRED.community ?? 2;

export default function SubmitPage() {
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
                  Submit a claim
                </h1>
                <p className="mt-5 max-w-[58ch] text-base leading-relaxed text-ink-muted">
                  Seen a real number with a real source? Hand it over. Every
                  figure on this platform carries a label for how sure we are
                  of it, and this is how a visitor's find earns one.
                </p>
                <p className="mt-4 max-w-[62ch] text-[14px] leading-relaxed text-ink-muted">
                  This is not a comment box. A claim needs a source URL — a
                  post, a video, anything a reviewer can open and check — and
                  it goes into the same queue the automated Reddit and YouTube
                  sources feed. One submission alone does not move anything;
                  {" "}{needed} independent people describing the same fact is
                  what reaches Community, exactly as it would from any other
                  source.
                </p>

                <div className="mt-10 max-w-md">
                  <Panel className="p-6">
                    <SubmitClaimForm />
                  </Panel>
                </div>
              </div>

              <div className="space-y-4">
                <Panel className="p-5">
                  <h2 className="text-[13px] font-semibold text-ink">
                    How a claim earns its label
                  </h2>
                  <ul className="mt-4 space-y-3">
                    {[
                      `Community needs ${needed} independent people or sources saying the same thing. Two submissions from the same visitor still count as one.`,
                      "Estimated means our own formulas derived it from something else.",
                      "Verified comes only from Rockstar, read and pasted in by a person. Agreement between visitors never produces it, no matter how many.",
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

                <Panel quiet className="p-5">
                  <h2 className="text-[13px] font-semibold text-ink">Credit</h2>
                  <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
                    Give a name or handle and it is shown against your
                    submission if it reaches Community — leave it blank to
                    submit anonymously. Either way, nothing you enter here
                    creates an account or signs you in.
                  </p>
                </Panel>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
