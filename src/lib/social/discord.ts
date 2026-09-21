import "server-only";

/**
 * Discord community panel.
 *
 * Two keyless routes, tried in order:
 *
 * 1. The invite. GET /api/v10/invites/<code>?with_counts=true answers any
 *    valid invite with the server's name and approximate member and online
 *    counts. No bot, no token, and nothing for the server owner to switch on:
 *    the invite link, which the page shows anyway, is all it needs. Checked
 *    21 September 2026 against a public server: 200 with both counts; a bad
 *    code answers 404.
 *
 * 2. The widget, only when DISCORD_GUILD_ID is set and there is no invite.
 *    Needs the owner to turn it on in Server Settings, Widget.
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
  /** Total members, approximate. Only the invite route reports it. */
  memberCount: number | null;
  inviteUrl: string | null;
  /** Voice and text channels the widget exposes. Names only, no contents. */
  channelCount: number;
  /** True when no guild id is configured, so the UI can explain rather than sit empty. */
  unconfigured: boolean;
  /** True when the guild exists but the widget is switched off. */
  widgetDisabled: boolean;
  /** True when the configured invite is expired or wrong. */
  inviteInvalid: boolean;
}

const EMPTY: DiscordWidget = {
  name: "",
  presenceCount: 0,
  memberCount: null,
  inviteUrl: null,
  channelCount: 0,
  unconfigured: true,
  widgetDisabled: false,
  inviteInvalid: false,
};

/**
 * The code out of an invite, however it was pasted.
 *
 * Accepts a bare code, discord.gg/<code>, discord.com/invite/<code> and the
 * old discordapp.com form. Anything else is refused before it reaches a URL.
 */
export function inviteCode(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match =
    /^(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/([A-Za-z0-9-]{2,32})\/?$/.exec(
      trimmed,
    ) ?? /^([A-Za-z0-9-]{2,32})$/.exec(trimmed);
  return match?.[1] ?? null;
}

export async function fetchDiscordWidget(): Promise<DiscordWidget> {
  const code = inviteCode(process.env.NEXT_PUBLIC_DISCORD_INVITE);
  if (code) return fetchInvite(code);
  return fetchGuildWidget();
}

async function fetchInvite(code: string): Promise<DiscordWidget> {
  const inviteUrl = `https://discord.gg/${code}`;
  try {
    const response = await fetch(
      `https://discord.com/api/v10/invites/${code}?with_counts=true`,
      // Same two minutes as the widget: live enough, and far inside the limits.
      { next: { revalidate: 120 } },
    );

    if (response.status === 404) {
      return { ...EMPTY, unconfigured: false, inviteInvalid: true };
    }
    if (!response.ok) {
      console.warn("[discord] invite fetch failed", response.status);
      // Discord being down is no reason to hide the way in.
      return { ...EMPTY, unconfigured: false, inviteUrl };
    }

    const body = (await response.json()) as {
      guild?: { name?: string };
      approximate_member_count?: number;
      approximate_presence_count?: number;
      // The inviter's profile comes back too. Not read, same reasoning as the
      // widget's member list.
    };

    return {
      ...EMPTY,
      name: body.guild?.name ?? "",
      presenceCount: Number(body.approximate_presence_count ?? 0),
      memberCount:
        typeof body.approximate_member_count === "number"
          ? body.approximate_member_count
          : null,
      inviteUrl,
      unconfigured: false,
    };
  } catch (error) {
    console.warn("[discord] invite threw", error);
    return { ...EMPTY, unconfigured: false, inviteUrl };
  }
}

async function fetchGuildWidget(): Promise<DiscordWidget> {
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
      ...EMPTY,
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
    note: "Live member and online counts on the site. Where strategy gets argued about.",
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
