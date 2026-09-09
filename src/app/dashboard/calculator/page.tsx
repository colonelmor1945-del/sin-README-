import { PageHeader } from "@/components/app/PageHeader";
import { Calculator } from "@/components/app/Calculator";
import { DataNotice } from "@/components/ProvenanceTag";
import {
  effectiveHourly,
  monthlyReturn,
  moneyPerHour,
  paybackDays,
  sortMissions,
} from "@/lib/calc";
import { ASSETS } from "@/lib/data/assets";
import { MISSIONS } from "@/lib/data/missions";

export const metadata = { title: "Money calculator" };

export default function CalculatorPage() {
  const assets = ASSETS.map((a) => ({
    id: a.id,
    name: a.name,
    price: a.price,
    dailyNet: a.dailyNet,
    paybackDays: paybackDays(a),
    monthlyReturn: monthlyReturn(a),
  }));

  const missions = sortMissions(MISSIONS, "best-hourly").map((m) => ({
    id: m.id,
    name: m.name,
    payout: m.payout,
    duration: m.duration,
    hourly: moneyPerHour(m),
    effective: effectiveHourly(m),
  }));

  return (
    <>
      <PageHeader
        title="Money calculator"
        lead="Arithmetic, not AI. Time to a target, mission profitability, asset payback periods and side by side comparison."
      />
      <div className="space-y-4 px-4 py-6 sm:px-8">
        <Calculator assets={assets} missions={missions} />
        <DataNotice className="max-w-[80ch] pt-2" />
      </div>
    </>
  );
}
