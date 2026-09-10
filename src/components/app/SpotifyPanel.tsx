import { SpotifyLogo } from "@phosphor-icons/react/dist/ssr";

import { Panel, PanelHead } from "@/components/ui/primitives";

/**
 * Spotify playlist.
 *
 * The official embed iframe, which needs no OAuth and no app registration.
 * Spotify handles the rest: a signed-out visitor gets 30 second previews, a
 * signed-in Premium listener gets full tracks, and their session is theirs
 * rather than something this app brokers.
 *
 * The alternative, the Web Playback SDK, would mean an OAuth flow, a token
 * refresh loop, and full playback only for Premium subscribers. That is a lot
 * of moving parts for a playlist sitting next to a video feed.
 *
 * The iframe is lazily loaded so it costs nothing until it scrolls into view.
 */
export function SpotifyPanel({ playlistId }: { playlistId?: string }) {
  if (!playlistId || !/^[A-Za-z0-9]{10,40}$/.test(playlistId)) {
    return (
      <Panel quiet className="p-5">
        <div className="flex items-center gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-accent-dim text-accent"
            aria-hidden
          >
            <SpotifyLogo size={19} weight="fill" />
          </span>
          <h2 className="text-[13px] font-semibold text-ink">Soundtrack</h2>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
          Make a playlist, then set{" "}
          <span className="tabular text-ink">NEXT_PUBLIC_SPOTIFY_PLAYLIST_ID</span>{" "}
          to the id from its share link. No Spotify app or OAuth needed.
        </p>
      </Panel>
    );
  }

  return (
    <Panel className="overflow-hidden">
      <PanelHead
        title="Soundtrack"
        meta={
          <span className="text-[11px] text-ink-faint">
            Full tracks with Spotify Premium
          </span>
        }
      />
      <div className="p-3">
        <iframe
          // theme=0 is the dark player, which is the only one that belongs here.
          src={`https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`}
          title="GTA 6 Money Lab playlist"
          width="100%"
          height="352"
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          className="rounded-[10px] border-0"
        />
      </div>
    </Panel>
  );
}
