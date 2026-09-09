import { DiscordLogo, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";

import { ButtonLink, Panel, PanelHead, cx } from "@/components/ui/primitives";
import type { DiscordWidget } from "@/lib/social/discord";

/**
 * Discord community panel.
 *
 * Shows the live online count and the invite, and nothing about who is online.
 * When the widget is unconfigured or switched off it says which of the two it
 * is, because those need different fixes and a generic error helps nobody.
 */
export function DiscordPanel({
  widget,
  fallbackInvite,
}: {
  widget: DiscordWidget;
  fallbackInvite?: string;
}) {
  const invite = widget.inviteUrl ?? fallbackInvite ?? null;

  return (
    <Panel>
      <PanelHead
        title="Community"
        meta={
          widget.presenceCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-up">
              {/* One of the few places a status dot earns its place: it marks
                  a genuinely live figure. */}
              <span className="h-1.5 w-1.5 rounded-full bg-up" aria-hidden />
              <span className="tabular">{widget.presenceCount}</span> online
            </span>
          ) : undefined
        }
      />

      <div className="p-5">
        <div className="flex items-start gap-4">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-accent-dim text-accent"
            aria-hidden
          >
            <DiscordLogo size={22} weight="fill" />
          </span>

          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-medium text-ink">
              {widget.name || "GTA 6 Money Lab"}
            </h3>

            {widget.unconfigured ? (
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
                Set <span className="tabular text-ink">DISCORD_GUILD_ID</span>{" "}
                and{" "}
                <span className="tabular text-ink">NEXT_PUBLIC_DISCORD_INVITE</span>{" "}
                to switch this on.
              </p>
            ) : widget.widgetDisabled ? (
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
                The server exists but its widget is off. Turn it on in Server
                Settings, Widget, and the live count appears here.
              </p>
            ) : (
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
                Route arguments, data corrections and launch-night coordination.
                Anything confirmed there still has to be cross-checked before it
                reaches the platform as community data.
              </p>
            )}
          </div>
        </div>

        {invite ? (
          <ButtonLink
            href={invite}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            className="mt-5 w-full"
          >
            Join the server
            <ArrowSquareOut size={13} />
          </ButtonLink>
        ) : null}

        {widget.channelCount > 0 ? (
          <p className={cx("mt-3 text-center text-[11px] text-ink-faint")}>
            <span className="tabular">{widget.channelCount}</span> public
            channels
          </p>
        ) : null}

        <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-faint">
          We show how many people are online, never who. The widget returns a
          member list and this page drops it.
        </p>
      </div>
    </Panel>
  );
}
