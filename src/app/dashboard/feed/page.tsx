import { ArrowSquareOut, ChatCircle, ArrowFatUp } from "@phosphor-icons/react/dist/ssr";

import { PageHeader } from "@/components/app/PageHeader";
import { DiscordPanel } from "@/components/app/DiscordPanel";
import { ShortsFeed } from "@/components/app/ShortsFeed";
import { Panel, PanelHead, cx } from "@/components/ui/primitives";
import { requireSession } from "@/lib/auth/session";
import { fetchDiscordWidget } from "@/lib/social/discord";
import { fetchReddit, timeAgo } from "@/lib/social/reddit";
import { fetchShorts } from "@/lib/social/youtube";

export const metadata = { title: "Community feed" };

export default async function FeedPage() {
  await requireSession();

  // Both sources are cached on the server, so this costs nothing per visitor.
  const [shorts, reddit, discord] = await Promise.all([
    fetchShorts({}),
    fetchReddit({ subreddit: "GTA6", sort: "hot", limit: 14 }),
    fetchDiscordWidget(),
  ]);

  return (
    <>
      <PageHeader
        title="Community feed"
        lead="What players are posting and watching right now. Nothing here is verified, and none of it feeds the mission or asset databases."
      />

      <div className="grid gap-4 px-4 py-6 sm:px-8 xl:grid-cols-[1fr_360px]">
        <div>
          <ShortsFeed initial={shorts} />
        </div>

        <aside className="space-y-4">
          <DiscordPanel
            widget={discord}
            fallbackInvite={process.env.NEXT_PUBLIC_DISCORD_INVITE}
          />

          <Panel>
            <PanelHead
              title="Reddit"
              meta={<span className="text-[11px] text-ink-faint">r/GTA6, hot</span>}
            />
            {reddit.unconfigured ? (
              <p className="px-5 py-10 text-center text-[13px] leading-relaxed text-ink-muted">
                Reddit closed public access to its listings, so this needs an
                app. Register one at reddit.com/prefs/apps as type script and
                set <span className="tabular text-ink">REDDIT_CLIENT_ID</span>{" "}
                and <span className="tabular text-ink">REDDIT_CLIENT_SECRET</span>.
                It is free.
              </p>
            ) : reddit.posts.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13px] text-ink-muted">
                Reddit did not answer. It rate limits hard, so this usually
                clears on its own.
              </p>
            ) : (
              <ul className="divide-y divide-line/70">
                {reddit.posts.map((post) => (
                  <li key={post.id} className="px-5 py-3.5">
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block"
                    >
                      <p className="line-clamp-3 text-[13px] leading-snug text-ink group-hover:text-accent">
                        {post.title}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-faint">
                        <span className="tabular inline-flex items-center gap-1">
                          <ArrowFatUp size={12} />
                          {post.score}
                        </span>
                        <span className="tabular inline-flex items-center gap-1">
                          <ChatCircle size={12} />
                          {post.comments}
                        </span>
                        <span>{timeAgo(post.createdAt)}</span>
                        {post.flair ? (
                          <span className="rounded-full border border-line-strong px-1.5 text-[9px]">
                            {post.flair}
                          </span>
                        ) : null}
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-line px-5 py-3">
              <a
                href="https://www.reddit.com/r/GTA6/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] text-accent hover:text-accent-soft"
              >
                Open r/GTA6
                <ArrowSquareOut size={12} />
              </a>
            </div>
          </Panel>

          <Panel quiet className="p-5">
            <h2 className="text-[13px] font-semibold text-ink">
              Why there is no TikTok or Reels feed
            </h2>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
              Neither platform offers a public way to browse videos by topic.
              TikTok&rsquo;s Display API and Instagram&rsquo;s oEmbed only reach
              content you own or a specific post you already have the link to.
              An endless topic feed from either can only be built by scraping,
              which breaks their terms and gets apps blocked.
            </p>
            <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
              What is possible is embedding posts we pick by hand. If that is
              worth having, it is a curation job rather than an integration.
            </p>
          </Panel>

          <Panel quiet className="p-5">
            <h2 className="text-[13px] font-semibold text-ink">Community feed rules</h2>
            <ul className="mt-3 space-y-2">
              {[
                "Everything here is third-party content, linked back to its source.",
                "Nothing from this page reaches the mission or asset databases.",
                "A claim seen here only becomes platform data after it is cross-checked, and it enters as community-reported at best.",
              ].map((line) => (
                <li
                  key={line}
                  className={cx("flex gap-2.5 text-[12px] leading-relaxed text-ink-muted")}
                >
                  <span
                    className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-accent"
                    aria-hidden
                  />
                  {line}
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>
    </>
  );
}
