import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the content actions.
 *
 * This layer had none, and it is the layer that matters most: a server action
 * is a public HTTP endpoint with a generated name, not a private function.
 * Anyone who learns the id can post to it. So the first thing asserted here is
 * not that the happy path works -- it is that the guards cannot be skipped.
 *
 * Everything below the action is faked. The point is not to re-test Zod or the
 * store, both of which have their own tests, but to check the decisions the
 * action itself makes: who is allowed in, what is refused, what reaches the
 * store, and what is written to the audit log afterwards.
 */

type SaveResult = { ok: true } | { ok: false; error: string };

const requireAdmin = vi.fn<() => Promise<{ userId: string }>>();
const saveMission = vi.fn<(m: unknown) => Promise<SaveResult>>();
const saveAsset = vi.fn<(a: unknown) => Promise<SaveResult>>();
const recordAudit = vi.fn<(entry: unknown) => Promise<void>>();

vi.mock("@/lib/auth/session", () => ({ requireAdmin: () => requireAdmin() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({
  recordAudit: (args: unknown) => recordAudit(args),
}));
vi.mock("@/lib/content/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content/store")>();
  return {
    ...actual,
    saveMission: (m: unknown) => saveMission(m),
    saveAsset: (a: unknown) => saveAsset(a),
  };
});

const { updateMission, updateAsset } = await import("@/app/admin/content/actions");

/** A form the editor would submit, with anything awkward overridable. */
function missionForm(overrides: Record<string, string> = {}): FormData {
  const fields: Record<string, string> = {
    id: "gator-run",
    name: "Gator Run",
    strand: "Everglades",
    region: "Everglades",
    payout: "94800",
    duration: "14",
    difficulty: "1",
    crewRequired: "1",
    bestStrategy: "Airboat, no combat",
    provenance: "community",
    prerequisites: "",
    tips: "Stay on the water",
    image: "https://example.com/a.jpg",
    ...overrides,
  };
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue({ userId: "admin-1" });
  saveMission.mockResolvedValue({ ok: true });
  saveAsset.mockResolvedValue({ ok: true });
  recordAudit.mockResolvedValue(undefined);
});

describe("updateMission", () => {
  it("refuses before it validates when the caller is not an admin", async () => {
    // requireAdmin redirects in the real app, which throws. The assertion that
    // matters is that nothing was written on the way out.
    //
    // Not `mockRejectedValueOnce`. A queued one-shot is only consumed if the
    // code actually calls the mock, so the moment someone deletes the guard --
    // the exact failure this test exists to catch -- the rejection survives
    // into the next test and fails that one instead. `beforeEach` puts the
    // resolving version back, which is what makes the plain form safe here.
    requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(updateMission({}, missionForm())).rejects.toThrow("NEXT_REDIRECT");
    expect(saveMission).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("saves a valid row and says which field is wrong when one is", async () => {
    expect(await updateMission({}, missionForm())).toEqual({ ok: true });

    const bad = await updateMission({}, missionForm({ id: "Gator Run" }));
    expect(bad.field).toBe("id");
    expect(bad.error).toMatch(/lowercase/i);
    // One bad field, nothing written.
    expect(saveMission).toHaveBeenCalledTimes(1);
  });

  it("refuses Verified without a Rockstar citation", async () => {
    // The rule the whole product rests on. Agreement between unofficial
    // sources never produces Verified, so neither can a form.
    const noSource = await updateMission({}, missionForm({ provenance: "verified" }));
    expect(noSource.error).toMatch(/rockstar/i);
    expect(noSource.field).toBe("provenance");

    const wrongSource = await updateMission(
      {},
      missionForm({ provenance: "verified", sourceUrl: "https://reddit.com/r/GTA6/x" }),
    );
    expect(wrongSource.error).toMatch(/rockstar/i);

    expect(saveMission).not.toHaveBeenCalled();
  });

  it("accepts Verified with a Rockstar citation", async () => {
    const result = await updateMission(
      {},
      missionForm({
        provenance: "verified",
        sourceUrl: "https://www.rockstargames.com/newswire/article/123",
      }),
    );
    expect(result).toEqual({ ok: true });
  });

  it("accepts the fifth tier ADR-027 added", async () => {
    // A row stored as "unverified" could not be edited here at all while this
    // action kept its own shorter copy of the list: its own value failed
    // validation on the way back in.
    expect(await updateMission({}, missionForm({ provenance: "unverified" }))).toEqual({
      ok: true,
    });
  });

  it("does not write an audit row when the save failed", async () => {
    saveMission.mockResolvedValueOnce({ ok: false, error: "constraint violated" });

    expect(await updateMission({}, missionForm())).toEqual({
      error: "constraint violated",
    });
    // An audit log that records work that did not happen is worse than none.
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("records who changed what, with the tier", async () => {
    await updateMission({}, missionForm({ provenance: "estimated" }));

    expect(recordAudit).toHaveBeenCalledWith({
      actorId: "admin-1",
      action: "content.mission.update",
      subject: "gator-run",
      metadata: { provenance: "estimated", name: "Gator Run" },
    });
  });

  it("splits list fields on newlines and drops the blanks", async () => {
    await updateMission({}, missionForm({ tips: "One\n\n  Two  \n\n\nThree" }));

    const saved = saveMission.mock.calls[0]![0] as { tips: string[] };
    expect(saved.tips).toEqual(["One", "Two", "Three"]);
  });
});

describe("updateAsset", () => {
  function assetForm(overrides: Record<string, string> = {}): FormData {
    const fields: Record<string, string> = {
      id: "vice-beach-nightclub",
      name: "Vice Beach Nightclub",
      category: "business",
      region: "Vice Beach",
      price: "4752000",
      dailyNet: "268900",
      upkeep: "12000",
      unlockLevel: "20",
      note: "Busiest on weekend nights.",
      provenance: "community",
      ...overrides,
    };
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    return form;
  }

  it("derives trend, advice and history rather than storing an opinion", async () => {
    await updateAsset({}, assetForm());

    const saved = saveAsset.mock.calls[0]![0] as {
      trend: string;
      advice: string;
      history: number[];
    };
    // Saved judgement would outlive the numbers behind it.
    expect(saved.trend).toBe("flat");
    expect(saved.advice).toBe("analyze");
    expect(saved.history).toEqual([4752000, 4752000]);
  });

  it("applies the same citation rule as missions", async () => {
    const result = await updateAsset({}, assetForm({ provenance: "verified" }));
    expect(result.error).toMatch(/rockstar/i);
    expect(saveAsset).not.toHaveBeenCalled();
  });
});
