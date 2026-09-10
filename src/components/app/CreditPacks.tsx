import { Panel, PanelHead, cx } from "@/components/ui/primitives";
import { CREDIT_PACKS, PACK_CREDITS_EXPIRE } from "@/lib/pricing";
import { price } from "@/lib/format";

/**
 * Credit packs.
 *
 * The per-credit rate is shown on every card rather than only on the one we
 * want to sell. A pricing table that hides the unit rate is asking the reader
 * to do arithmetic they will get wrong in our favour, which is the sort of
 * thing that works once.
 *
 * The buttons are inert until a payment processor is configured. They say so
 * rather than failing at checkout.
 */
export function CreditPacks({ configured }: { configured: boolean }) {
  return (
    <Panel>
      <PanelHead
        title="Credit packs"
        meta={
          <span className="text-[11px] text-ink-faint">
            One-off, no subscription needed
          </span>
        }
      />

      <div className="grid gap-px bg-line p-px sm:grid-cols-3">
        {CREDIT_PACKS.map((pack) => (
          <div key={pack.id} className="relative bg-surface p-5">
            {pack.bestValue ? (
              <span className="absolute top-3 right-3 rounded-full border border-accent/45 px-2 py-0.5 text-[9px] tracking-wide text-accent uppercase">
                Best value
              </span>
            ) : null}

            <p className="tabular text-2xl leading-none text-ink">{pack.credits}</p>
            <p className="mt-1 text-[11px] text-ink-faint">Lab Credits</p>

            <p className="tabular mt-4 text-lg text-ink">
              {price(pack.priceMinor / 100)}
            </p>
            <p className="tabular mt-0.5 text-[11px] text-ink-faint">
              {price(pack.perCreditMinor / 100)} each
            </p>

            <button
              type="button"
              disabled={!configured}
              title={configured ? undefined : "No payment processor is configured yet"}
              className={cx(
                "mt-5 h-9 w-full rounded-full text-[13px] font-medium transition-colors",
                configured
                  ? "bg-accent text-white hover:bg-accent-soft"
                  : "cursor-not-allowed border border-line text-ink-faint",
              )}
            >
              {configured ? "Buy" : "Not available yet"}
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-line px-5 py-3.5">
        <p className="text-[12px] leading-relaxed text-ink-faint">
          {PACK_CREDITS_EXPIRE
            ? "Pack credits expire at the end of the billing period."
            : "Pack credits never expire, unlike the monthly grant that comes with a subscription."}{" "}
          A money plan costs 3 credits and a creator package costs 2, so the
          smallest pack is roughly three plans.
        </p>
      </div>
    </Panel>
  );
}
