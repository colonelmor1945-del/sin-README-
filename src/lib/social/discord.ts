import "server-only";

/**
 * Discord community widget.
 *
 * Discord serves a public widget endpoint for any guild whose owner has turned
 * the widget on in Server Settings, Widget. No bot, no token, no OAuth.
 *
 * PRIVACY DECISION
 * The endpoint also returns a list of currently online members with their
 * usernames, avatars and activity. This module deliberately drops that. Those
 * are third parties who joined a Discord server, not our site, and publishing
 * who is online right now on a public marketing page is not something they
 * agreed to. Only aggregate counts and the invite are kept.
 */

export interface DiscordWidget {
  name: string;
  /** Members currently online. Discord caps the underlying list, not this count. */
  presenceCount: number;
  inviteUrl: string | null;
  /** Voice and text channels the widget exposes. Names only, no contents. */
  channelCount: number;
  /** True when no guild id is configured, so the UI can explain rather than sit empty. */
  unconfigured: boolean;
  /** True when the guild exists but the widget is switched off. */
  widgetDisabled: boolean;
}

const EMPTY: DiscordWidget = {
  name: "",
  presenceCount: 0,
  inviteUrl: null,
  channelCount: 0,
  unconfigured: true,
  widgetDisabled: false,
};

export async function fetchDiscordWidget(): Promise<DiscordWidget> {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId || !/^\d{17,20}$/.test(guildId)) return EMPTY;

  try {
    const response = await fetch(
      `https://discord.com/api/guilds/${guildId}/widget.json`,
      // Two minutes is live enough for an online count and keeps us far away
      // from Discord's rate limits however busy the page gets.
      { next: { revalidate: 120 } },
    );

    // 403 is the specific answer Discord gives when the widget is disabled.
    if (response.status === 403) {
      return { ...EMPTY, unconfigured: false, widgetDisabled: true };
    }
    if (!response.ok) {
      console.warn("[discord] widget fetch failed", response.status);
      return { ...EMPTY, unconfigured: false };
    }

    const body = (await response.json()) as {
      name?: string;
      instant_invite?: string | null;
      presence_count?: number;
      channels?: unknown[];
      // members is intentionally not read. See the privacy note above.
    };

    return {
      name: body.name ?? "",
      presenceCount: Number(body.presence_count ?? 0),
      inviteUrl:
        body.instant_invite ?? process.env.NEXT_PUBLIC_DISCORD_INVITE ?? null,
      channelCount: Array.isArray(body.channels) ? body.channels.length : 0,
      unconfigured: false,
      widgetDisabled: false,
    };
  } catch (error) {
    console.warn("[discord] widget threw", error);
    return { ...EMPTY, unconfigured: false };
  }
}

/**
 * Where the community lives.
 *
 * Only Discord and Reddit are integrations. The rest are links, and the UI
 * labels them as such rather than implying a connection that does not exist.
 */
export interface SocialLink {
  id: string;
  label: string;
  handle: string;
  url: string;
  /** True when the platform feeds live data into the product. */
  integrated: boolean;
  note: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  {
    id: "discord",
    label: "Discord",
    handle: "GTA 6 Money Lab",
    url: process.env.NEXT_PUBLIC_DISCORD_INVITE ?? "",
    integrated: true,
    note: "Live member count on the site. Where strategy gets argued about.",
  },
  {
    id: "reddit",
    label: "Reddit",
    handle: "r/GTA6",
    url: "https://www.reddit.com/r/GTA6/",
    integrated: true,
    note: "Hot posts pulled into the community feed.",
  },
  {
    id: "youtube",
    label: "YouTube",
    handle: "GTA 6 Money Lab",
    url: "",
    integrated: true,
    note: "Shorts pulled into the community feed by topic.",
  },
  {
    id: "tiktok",
    label: "TikTok",
    handle: "@gta6moneylab",
    url: "",
    integrated: false,
    note: "Link only. No public API exists to browse videos by topic.",
  },
  {
    id: "instagram",
    label: "Instagram",
    handle: "@gta6moneylab",
    url: "",
    integrated: false,
    note: "Link only, for the same reason as TikTok.",
  },
  {
    id: "x",
    label: "X",
    handle: "@gta6moneylab",
    url: "",
    integrated: false,
    note: "Link only. Read access is paid and not worth it at this stage.",
  },
];
