"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartLineUp,
  Coins,
  Gauge,
  GearSix,
  Lightning,
  MapTrifold,
  Newspaper,
  PlayCircle,
  Plugs,
  Queue,
  Path,
  Robot,
  Target,
  UserCircle,
  VideoCamera,
} from "@phosphor-icons/react/dist/ssr";

import { Brand } from "@/components/Brand";
import { SignOutButton } from "@/components/app/SignOut";
import { cx } from "@/components/ui/primitives";
import type { Tier } from "@/lib/types";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/dashboard/assistant", label: "AI assistant", icon: Robot },
  { href: "/dashboard/plan", label: "Money plan", icon: Path },
  { href: "/dashboard/calculator", label: "Money calculator", icon: Target },
  { href: "/dashboard/map", label: "Map", icon: MapTrifold },
  { href: "/dashboard/missions", label: "Mission intelligence", icon: Coins },
  { href: "/dashboard/economy", label: "Economy tracker", icon: ChartLineUp },
  { href: "/dashboard/creator", label: "Creator Lab", icon: VideoCamera },
  { href: "/dashboard/news", label: "Intel feed", icon: Newspaper },
  { href: "/dashboard/feed", label: "Community feed", icon: PlayCircle },
  { href: "/fund", label: "Fund the Lab", icon: Lightning },
] as const;

const FOOT = [
  { href: "/dashboard/queue", label: "Review queue", icon: Queue },
  { href: "/dashboard/setup", label: "Setup", icon: Plugs },
  { href: "/dashboard/profile", label: "Profile", icon: UserCircle },
  { href: "/dashboard/settings", label: "Settings", icon: GearSix },
] as const;

export function Sidebar({
  username,
  tier,
  level,
  credits,
}: {
  username: string;
  tier: Tier;
  level: number;
  credits: number;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-[248px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex h-16 items-center border-b border-line px-5">
        <Brand size="sm" href="/dashboard" />
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <SidebarList items={NAV} pathname={pathname} />
        <div className="my-3 border-t border-line" />
        <SidebarList items={FOOT} pathname={pathname} />
        <SignOutButton />
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-[10px] bg-surface-2 p-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-dim text-[13px] font-medium text-accent"
            aria-hidden
          >
            {username.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-ink">{username}</p>
            <p className="text-[11px] text-ink-faint">
              Level {level}, {tier} plan
            </p>
          </div>
        </div>
        <p className="mt-2 px-1 text-[11px] text-ink-faint">
          <span className="tabular text-ink-muted">{credits}</span> Lab Credits
        </p>
      </div>
    </aside>
  );
}

function SidebarList({
  items,
  pathname,
}: {
  items: readonly { href: string; label: string; icon: React.ElementType }[];
  pathname: string;
}) {
  return (
    <ul className="space-y-0.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13px] transition-colors",
                active
                  ? "bg-accent-dim text-accent"
                  : "text-ink-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon size={17} weight={active ? "fill" : "regular"} />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Horizontal scroller shown instead of the sidebar below the lg breakpoint. */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-line bg-surface lg:hidden">
      <ul className="flex gap-1 overflow-x-auto px-3 py-2">
        {[...NAV, ...FOOT].map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] whitespace-nowrap transition-colors",
                  active ? "bg-accent-dim text-accent" : "text-ink-muted",
                )}
              >
                <Icon size={15} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
