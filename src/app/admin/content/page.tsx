import Link from "next/link";

import { AssetEditor, MissionEditor } from "@/components/admin/ContentEditor";
import { BulkContent } from "@/components/admin/BulkContent";
import { Brand } from "@/components/Brand";
import { Panel, Stat } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth/session";
import { contentSource, getAssets, getMissions } from "@/lib/content/store";
import {
  exportAssetsCsv,
  exportMapPinsCsv,
  exportNewsCsv,
  exportMissionsCsv,
  importAssetsCsv,
  importMapPinsCsv,
  importNewsCsv,
  importMissionsCsv,
  updateAsset,
  updateMission,
} from "@/app/admin/content/actions";

export const metadata = { title: "Content" };

export default async function ContentPage() {
  await requireAdmin();

  const [missions, assets] = await Promise.all([getMissions(), getAssets()]);
  const source = contentSource();

  const unverified = [...missions, ...assets].filter(
    (r) => r.provenance !== "verified",
  ).length;

  return (
    <div className="min-h-[100dvh]">
      <header className="flex h-16 items-center justify-between border-b border-line px-4 sm:px-8">
        <div className="flex items-center gap-4">
          <Brand size="sm" href="/dashboard" />
          <span className="rounded-full border border-accent/45 px-2 py-0.5 text-[10px] text-accent uppercase">
            Content
          </span>
        </div>
        <Link href="/admin" className="text-[13px] text-ink-muted hover:text-ink">
          Back to admin
        </Link>
      </header>

      <div className="space-y-4 px-4 py-6 sm:px-8">
        <Panel className="grid gap-6 p-6 sm:grid-cols-3">
          <Stat label="Missions" value={String(missions.length)} />
          <Stat label="Assets" value={String(assets.length)} />
          <Stat
            label="Not verified"
            value={String(unverified)}
            tone={unverified > 0 ? "default" : "up"}
            sub="Every one renders with its label"
          />
        </Panel>

        <div className="grid gap-4 xl:grid-cols-2">
          <MissionEditor
            missions={missions}
            writable={source.writable}
            reason={source.reason}
            action={updateMission}
          />
          <AssetEditor
            assets={assets}
            writable={source.writable}
            reason={source.reason}
            action={updateAsset}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <BulkContent
            kind="missions"
            writable={source.writable}
            reason={source.reason}
            importAction={importMissionsCsv}
            exportAction={exportMissionsCsv}
          />
          <BulkContent
            kind="assets"
            writable={source.writable}
            reason={source.reason}
            importAction={importAssetsCsv}
            exportAction={exportAssetsCsv}
          />
          <BulkContent
            kind="map locations"
            writable={source.writable}
            reason={source.reason}
            importAction={importMapPinsCsv}
            exportAction={exportMapPinsCsv}
          />
          <BulkContent
            kind="news"
            writable={source.writable}
            reason={source.reason}
            importAction={importNewsCsv}
            exportAction={exportNewsCsv}
          />
        </div>

        <Panel quiet className="p-5">
          <h2 className="text-[13px] font-semibold text-ink">Where this data comes from</h2>
          <p className="mt-2 max-w-[80ch] text-[13px] leading-relaxed text-ink-muted">
            Reads prefer the database and fall back to the seed files in the
            repository, including when the database is unreachable. A page
            rendering nothing because Postgres blinked is worse than one showing
            last week&rsquo;s numbers, since every figure carries its provenance
            either way and none of it is presented as live.
          </p>
          <p className="mt-3 max-w-[80ch] text-[13px] leading-relaxed text-ink-muted">
            There is no filesystem write path. An editor that rewrote source
            files would work on a laptop, do nothing on a read-only production
            filesystem, and quietly diverge from the repository.
          </p>
        </Panel>
      </div>
    </div>
  );
}
