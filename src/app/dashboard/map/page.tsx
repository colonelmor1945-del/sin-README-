import { PageHeader } from "@/components/app/PageHeader";
import { IntelMap } from "@/components/app/IntelMap";
import { DataNotice } from "@/components/ProvenanceTag";
import { requireSession } from "@/lib/auth/session";
import { MAP_PINS } from "@/lib/data/map";
import { can } from "@/lib/entitlements";
import type { PinKind } from "@/lib/types";

export const metadata = { title: "Map" };

export default async function MapPage() {
  const { account } = await requireSession();

  // Free tier sees the missions layer only. The gate is evaluated here, on the
  // server, and the locked layers are never sent as selectable.
  const lockedKinds: PinKind[] = can(account.tier, "map.all-layers")
    ? []
    : ["business", "property", "money-spot", "vehicle", "activity"];

  return (
    <>
      <PageHeader
        title="Intelligence map"
        lead="Missions, businesses, properties and money spots across Leonida. The landmass is drawn abstractly rather than traced from a game asset."
      />
      <div className="space-y-4 px-4 py-6 sm:px-8">
        <IntelMap pins={MAP_PINS} lockedKinds={lockedKinds} />
        {lockedKinds.length > 0 ? (
          <p className="text-[12px] text-ink-faint">
            The free plan shows the missions layer. Pro unlocks businesses,
            properties, money spots, vehicles and activities.
          </p>
        ) : null}
        <DataNotice className="max-w-[80ch]" />
      </div>
    </>
  );
}
