import "server-only";

/**
 * Setup checklist.
 *
 * Every optional integration in the platform degrades to a message saying it is
 * not configured. That is the right behaviour per panel and the wrong
 * experience overall: someone new walks the app, finds six switched-off panels
 * in a row, and concludes the product is broken rather than unconfigured.
 *
 * This collects the whole picture in one place, in the order that unblocks the
 * most, and says what each thing costs and what it actually turns on.
 */

export type SetupImpact = "blocking" | "core" | "optional";

export interface SetupItem {
  id: string;
  label: string;
  /** What switches on once this is set. */
  unlocks: string;
  envVars: string[];
  configured: boolean;
  impact: SetupImpact;
  /** Where to get it. */
  where: string;
  url?: string;
  cost: string;
  /** Anything non-obvious about wiring it up. */
  note?: string;
}

const has = (...names: string[]) => names.every((n) => Boolean(process.env[n]));

export function setupChecklist(): SetupItem[] {
  return [
    {
      id: "anthropic",
      label: "Claude API key",
      unlocks:
        "The real AI. Without it the assistant, plans and Creator Lab run on a deterministic local analyst that answers from templates.",
      envVars: ["ANTHROPIC_API_KEY"],
      configured: has("ANTHROPIC_API_KEY") || has("ANTHROPIC_AUTH_TOKEN"),
      impact: "core",
      where: "console.anthropic.com",
      url: "https://console.anthropic.com/settings/keys",
      cost: "Pay as you go. An assistant answer runs a few cents.",
      note: "This is the single change that most affects how the product feels. The local fallback is scaffolding, not the model.",
    },
    {
      id: "database",
      label: "PostgreSQL",
      unlocks:
        "Accounts, sessions, plans and credits that survive a restart. Without it everything lives in process memory and is lost when the server stops.",
      envVars: ["DATABASE_URL"],
      configured: has("DATABASE_URL"),
      impact: "blocking",
      where: "Neon, Supabase, Railway, or your own Postgres",
      url: "https://neon.tech",
      cost: "Free tier is plenty until launch.",
      note: "Apply src/lib/db/schema.sql once, then set the URL. The app refuses to start in production without this.",
    },
    {
      id: "google",
      label: "Google sign-in",
      unlocks: "The Continue with Google button on both auth screens.",
      envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
      configured: has("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"),
      impact: "optional",
      where: "console.cloud.google.com",
      url: "https://console.cloud.google.com/apis/credentials",
      cost: "Free.",
      note: "Add <APP_URL>/api/auth/google/callback as an authorised redirect URI, exactly.",
    },
    {
      id: "youtube",
      label: "YouTube Data API",
      unlocks: "The Shorts feed on the community page.",
      envVars: ["YOUTUBE_API_KEY"],
      configured: has("YOUTUBE_API_KEY"),
      impact: "optional",
      where: "console.cloud.google.com, enable YouTube Data API v3",
      url: "https://console.cloud.google.com/apis/library/youtube.googleapis.com",
      cost: "Free. 10,000 quota units a day, and a search costs 100.",
    },
    {
      id: "reddit",
      label: "Reddit API",
      unlocks: "The r/GTA6 panel on the community page.",
      envVars: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"],
      configured: has("REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"),
      impact: "optional",
      where: "reddit.com/prefs/apps, create an app of type script",
      url: "https://www.reddit.com/prefs/apps",
      cost: "Free.",
      note: "The public .json listings return 403 to servers now, so this is required rather than a nicety.",
    },
    {
      id: "discord",
      label: "Discord widget",
      unlocks: "The live member count and join button.",
      envVars: ["DISCORD_GUILD_ID", "NEXT_PUBLIC_DISCORD_INVITE"],
      configured: has("DISCORD_GUILD_ID", "NEXT_PUBLIC_DISCORD_INVITE"),
      impact: "optional",
      where: "Your Discord server settings",
      cost: "Free.",
      note: "Turn the widget on in Server Settings, Widget, or the endpoint answers 403.",
    },
    {
      id: "spotify",
      label: "Spotify playlist",
      unlocks: "The soundtrack panel.",
      envVars: ["NEXT_PUBLIC_SPOTIFY_PLAYLIST_ID"],
      configured: has("NEXT_PUBLIC_SPOTIFY_PLAYLIST_ID"),
      impact: "optional",
      where: "Any playlist you own. Copy the id from its share link.",
      cost: "Free, no app registration.",
    },
    {
      id: "stripe",
      label: "Card payments",
      unlocks: "Subscriptions and credit packs.",
      envVars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
      configured: has("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"),
      impact: "core",
      where: "dashboard.stripe.com",
      url: "https://dashboard.stripe.com/apikeys",
      cost: "Per transaction.",
      note: "createIntent still needs implementing against the Stripe SDK. The keys alone are not enough.",
    },
    {
      id: "btcpay",
      label: "Crypto payments",
      unlocks: "Bitcoin, Lightning and USDC contributions.",
      envVars: ["BTCPAY_URL", "BTCPAY_API_KEY", "BTCPAY_WEBHOOK_SECRET"],
      configured: has("BTCPAY_URL", "BTCPAY_API_KEY", "BTCPAY_WEBHOOK_SECRET"),
      impact: "core",
      where: "A BTCPay Server instance you host",
      url: "https://btcpayserver.org",
      cost: "Free software, you pay for hosting.",
      note: "createIntent still needs implementing. Webhook verification is already written.",
    },
  ];
}

export function setupSummary(items: SetupItem[]) {
  const done = items.filter((i) => i.configured).length;
  return {
    done,
    total: items.length,
    blocking: items.filter((i) => i.impact === "blocking" && !i.configured),
    core: items.filter((i) => i.impact === "core" && !i.configured),
  };
}
