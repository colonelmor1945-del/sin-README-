import { afterEach, describe, expect, it, vi } from "vitest";

import { cached, forget } from "./cache";

afterEach(() => {
  forget();
  vi.useRealTimers();
});

describe("cached", () => {
  it("calls the loader once inside the TTL", async () => {
    const load = vi.fn().mockResolvedValue("value");

    expect(await cached("k", 1000, load)).toBe("value");
    expect(await cached("k", 1000, load)).toBe("value");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("calls it again once the TTL is up", async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockResolvedValue("value");

    await cached("k", 1000, load);
    vi.advanceTimersByTime(1001);
    await cached("k", 1000, load);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps keys apart", async () => {
    const load = vi.fn().mockImplementation((): Promise<string> => Promise.resolve("v"));
    await cached("a", 1000, load);
    await cached("b", 1000, load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("collapses concurrent callers into one load", async () => {
    // The case that matters: a popular thread expiring while many people have
    // it open. Without coalescing this is one upstream call per viewer.
    let release!: (v: string) => void;
    const load = vi.fn().mockImplementation(
      () => new Promise<string>((resolve) => {
        release = resolve;
      }),
    );

    const all = Promise.all([
      cached("hot", 1000, load),
      cached("hot", 1000, load),
      cached("hot", 1000, load),
    ]);

    release("shared");
    expect(await all).toEqual(["shared", "shared", "shared"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failure", async () => {
    // Rate limits and outages clear on their own. Remembering the failure
    // would keep the app broken after the cause was gone.
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("429"))
      .mockResolvedValue("recovered");

    await expect(cached("k", 10_000, load)).rejects.toThrow("429");
    expect(await cached("k", 10_000, load)).toBe("recovered");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("lets a later caller retry after a rejection clears the in-flight slot", async () => {
    const load = vi.fn().mockRejectedValue(new Error("down"));

    await expect(cached("k", 1000, load)).rejects.toThrow("down");
    await expect(cached("k", 1000, load)).rejects.toThrow("down");
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("forget", () => {
  it("drops one key", async () => {
    const load = vi.fn().mockResolvedValue("v");
    await cached("a", 10_000, load);
    await cached("b", 10_000, load);

    forget("a");
    await cached("a", 10_000, load);
    await cached("b", 10_000, load);

    expect(load).toHaveBeenCalledTimes(3);
  });

  it("drops everything", async () => {
    const load = vi.fn().mockResolvedValue("v");
    await cached("a", 10_000, load);
    forget();
    await cached("a", 10_000, load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
