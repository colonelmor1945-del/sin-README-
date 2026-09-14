import { ArrowFatUp, ArrowSquareOut, ChatCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { ProvenanceTag } from "@/components/ProvenanceTag";
import { Empty, Panel, cx } from "@/components/ui/primitives";
import { requireSession } from "@/lib/auth/session";
import { fetchThread, timeAgo, type RedditComment } from "@/lib/social/reddit";
import { sampleThread } from "@/lib/social/sample-thread";

export const metadata = { title: "Thread" };

/**
 * A Reddit thread, read without leaving the app.
 *
 * Everything on this page was written by somebody else, so every piece of it
 * keeps its author and a link back to where they wrote it. Nothing is stored:
 * the thread is held in a short cache and re-read from Reddit after that.
 */
export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  await requireSession();

  const { id } = await params;
  const { sort } = await searchParams;
  const order = sort === "new" ? "new" : "top";

  // A way to look at this screen without credentials. Development only: in
  // production "sample" is just an id Reddit has nothing under, and the page
  // says so. See src/lib/social/sample-thread.ts.
  const preview = id === "sample" && process.env.NODE_ENV !== "production";

  const { thread, unconfigured, failed, missing } = preview
    ? { thread: sampleThread(), unconfigured: false, failed: false, missing: false }
    : await fetchThread({ id, sort: order });

  return (
    <div className="px-4 py-6 sm:px-8">
      <Link
        href="/dashboard/feed"
        className="text-[13px] text-ink-muted hover:text-ink"
      >
        Back to community feed
      </Link>

      {!thread ? (
        <Panel className="mt-5">
          {unconfigured ? (
            <Empty
              title="Reddit is not connected"
              hint="Register an app at reddit.com/prefs/apps as type script, then set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET. It is free."
            />
          ) : missing ? (
            <Empty
              title="That thread is gone"
              hint="Reddit has nothing under this id. It was probably deleted by its author or removed by a moderator."
            />
          ) : failed ? (
            <Empty
              title="Reddit did not answer"
              hint="It rate limits hard, so this usually clears on its own. The feed still works."
            />
          ) : null}
        </Panel>
      ) : (
        <article className="mt-5 max-w-[80ch]">
          {preview ? (
            <p className="mb-5 rounded-[10px] border border-projection/45 px-4 py-2.5 text-[12px] leading-relaxed text-projection">
              Invented thread, shown so this screen can be looked at without
              Reddit credentials. Nobody wrote any of it. Reachable only in
              development.
            </p>
          ) : null}

          <header>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-faint">
              <span className="tabular">r/{thread.subreddit}</span>
              <span aria-hidden>·</span>
              <span>Posted by u/{thread.author}</span>
              <span aria-hidden>·</span>
              <span>{timeAgo(thread.createdAt)}</span>
              {thread.flair ? (
                <span className="rounded-full border border-line-strong px-1.5 text-[9px]">
                  {thread.flair}
                </span>
              ) : null}
              {/*
                A thread is the weakest tier there is: players talking, with
                nothing behind it until somebody checks. ADR-027 added the label
                for exactly this, and the product rule does not exempt content
                because somebody else wrote it.
              */}
              <ProvenanceTag value="unverified" size="xs" />
            </div>

            <h1 className="mt-2 text-xl font-semibold leading-snug tracking-tight text-ink">
              {thread.title}
            </h1>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-faint">
              <span className="tabular inline-flex items-center gap-1">
                <ArrowFatUp size={13} />
                {thread.score}
              </span>
              <span className="tabular inline-flex items-center gap-1">
                <ChatCircle size={13} />
                {thread.commentCount}
              </span>
              <a
                href={thread.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-accent hover:text-accent-soft"
              >
                Open on Reddit
                <ArrowSquareOut size={12} />
              </a>
            </div>
          </header>

          {thread.body ? (
            <Panel quiet className="mt-5 p-5">
              <Body text={thread.body} />
            </Panel>
          ) : null}

          {thread.linkUrl ? (
            <Panel quiet className="mt-4 p-5">
              <p className="text-[11px] uppercase tracking-wide text-ink-faint">
                This post links to
              </p>
              <a
                href={thread.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 break-all text-[13px] text-accent hover:text-accent-soft"
              >
                {thread.linkUrl}
                <ArrowSquareOut size={12} className="shrink-0" />
              </a>
            </Panel>
          ) : null}

          {thread.image ? (
            <a
              href={thread.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block"
            >
              {/* Hotlinked from Reddit and never copied to our own storage. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thread.image}
                alt=""
                className="max-h-[520px] w-auto rounded-[10px] border border-line"
              />
            </a>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2.5">
            <h2 className="text-[13px] font-semibold tracking-wide text-ink">
              {thread.comments.length === 0
                ? "Comments"
                : `${thread.comments.length} of ${thread.commentCount} comments`}
            </h2>
            <div className="flex items-center gap-1 text-[12px]">
              <SortLink id={thread.id} value="top" active={order === "top"} />
              <span className="text-ink-faint" aria-hidden>
                ·
              </span>
              <SortLink id={thread.id} value="new" active={order === "new"} />
            </div>
          </div>

          {thread.comments.length === 0 ? (
            <Empty
              title="No comments yet"
              hint="Nobody has replied to this one. The thread on Reddit is the place to be the first."
            />
          ) : (
            <ol className="mt-1">
              {thread.comments.map((comment) => (
                <Comment key={comment.id} comment={comment} />
              ))}
            </ol>
          )}

          <p className="mt-8 border-t border-line pt-4 text-[11px] leading-relaxed text-ink-faint">
            Posts and comments belong to the people who wrote them and are shown
            here as they appear on Reddit, not stored by us. A deleted comment
            can take up to five minutes to disappear from this page. Nothing
            here feeds the mission or asset databases, and a figure quoted in a
            thread stays unverified until a source is attached to it.
          </p>
        </article>
      )}
    </div>
  );
}

function SortLink({
  id,
  value,
  active,
}: {
  id: string;
  value: "top" | "new";
  active: boolean;
}) {
  return (
    <Link
      href={`/dashboard/feed/thread/${id}?sort=${value}`}
      aria-current={active ? "true" : undefined}
      className={cx(active ? "text-ink" : "text-ink-faint hover:text-ink-muted")}
    >
      {value === "top" ? "Top" : "New"}
    </Link>
  );
}

function Comment({ comment }: { comment: RedditComment }) {
  return (
    <li
      // Indent is capped in the parser at six levels; past that a phone has no
      // column left. The thread still reads because each reply keeps its author.
      style={{ marginLeft: `${comment.depth * 14}px` }}
      className={cx(
        "border-l py-3 pl-3.5",
        comment.depth === 0 ? "border-line-strong" : "border-line",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-faint">
        <span className={comment.isOp ? "font-medium text-accent" : "text-ink-muted"}>
          u/{comment.author}
        </span>
        {comment.isOp ? (
          <span className="rounded-full border border-accent/40 px-1.5 text-[9px] text-accent">
            OP
          </span>
        ) : null}
        <span className="tabular inline-flex items-center gap-1">
          <ArrowFatUp size={11} />
          {comment.score}
        </span>
        <span>{timeAgo(comment.createdAt)}</span>
        <a
          href={comment.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-ink-muted"
          aria-label={`Open this comment by u/${comment.author} on Reddit`}
        >
          <ArrowSquareOut size={11} />
        </a>
      </div>

      {comment.removed ? (
        <p className="mt-1.5 text-[13px] italic text-ink-faint">
          This comment was removed.
        </p>
      ) : (
        <div className="mt-1.5">
          <Body text={comment.body} />
        </div>
      )}
    </li>
  );
}

/**
 * Reddit markdown, rendered as text.
 *
 * Reddit also returns `body_html`, and putting that through
 * dangerouslySetInnerHTML would mean injecting unsanitised third-party markup
 * into a page that carries a session cookie. Paragraphs are enough to read a
 * thread; they are not worth an XSS hole.
 */
function Body({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim() !== "");

  return (
    <div className="space-y-2.5">
      {paragraphs.map((paragraph, i) => (
        <p
          key={i}
          className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ink-muted"
        >
          {paragraph}
        </p>
      ))}
    </div>
  );
}
