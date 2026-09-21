import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchDiscordWidget, inviteCode } from "./discord";

describe("inviteCode", () => {
  it.each([
    ["abc123", "abc123"],
    ["discord.gg/abc123", "abc123"],
    ["https://discord.gg/abc123", "abc123"],
    ["https://discord.gg/abc123/", "abc123"],
    ["https://discord.com/invite/discord-developers", "discord-developers"],
    ["https://www.discordapp.com/invite/abc123", "abc123"],
    ["  https://discord.gg/abc123  ", "abc123"],
  ])("reads %s", (input, code) => {
    expect(inviteCode(input)).toBe(code);
  });

  it.each([
    undefined,
    "",
    "https://evil.example/invite/abc123",
    "https://discord.gg/abc123?x=1",
    "https://discord.gg/../api/users/@me",
    "a",
  ])("refuses %s", (input) => {
    expect(inviteCode(input)).toBeNull();
  });
});

describe("fetchDiscordWidget", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("DISCORD_GUILD_ID", "");
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("gets counts from the invite alone, with no guild id", async () => {
    vi.stubEnv("NEXT_PUBLIC_DISCORD_INVITE", "https://discord.gg/discord-developers");
    // Shape trimmed from the live answer on 21 September 2026.
    fetchMock.mockResolvedValue(
      Response.json({
        code: "discord-developers",
        guild: { id: "613425648685547541", name: "Discord Developers" },
        inviter: { username: "someone" },
        approximate_member_count: 303729,
        approximate_presence_count: 48283,
      }),
    );

    const widget = await fetchDiscordWidget();

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://discord.com/api/v10/invites/discord-developers?with_counts=true",
    );
    expect(widget).toMatchObject({
      name: "Discord Developers",
      presenceCount: 48283,
      memberCount: 303729,
      inviteUrl: "https://discord.gg/discord-developers",
      unconfigured: false,
      inviteInvalid: false,
    });
    expect(JSON.stringify(widget)).not.toContain("someone");
  });

  it("says the invite is bad when Discord answers 404", async () => {
    vi.stubEnv("NEXT_PUBLIC_DISCORD_INVITE", "expired1");
    fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
    const widget = await fetchDiscordWidget();
    expect(widget).toMatchObject({ inviteInvalid: true, unconfigured: false, inviteUrl: null });
  });

  it("keeps the join button when Discord is down", async () => {
    vi.stubEnv("NEXT_PUBLIC_DISCORD_INVITE", "abc123");
    fetchMock.mockResolvedValue(new Response("", { status: 503 }));
    const widget = await fetchDiscordWidget();
    expect(widget.inviteUrl).toBe("https://discord.gg/abc123");
    expect(widget.inviteInvalid).toBe(false);
  });

  it("is unconfigured, and calls nothing, with neither invite nor guild id", async () => {
    vi.stubEnv("NEXT_PUBLIC_DISCORD_INVITE", "");
    const widget = await fetchDiscordWidget();
    expect(widget.unconfigured).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the widget when only a guild id is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_DISCORD_INVITE", "");
    vi.stubEnv("DISCORD_GUILD_ID", "613425648685547541");
    fetchMock.mockResolvedValue(
      Response.json({ name: "G", presence_count: 7, channels: [1, 2], members: [{ username: "x" }] }),
    );
    const widget = await fetchDiscordWidget();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/guilds/613425648685547541/widget.json");
    expect(widget).toMatchObject({ name: "G", presenceCount: 7, channelCount: 2, memberCount: null });
  });
});
