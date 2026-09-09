import { MobileNav, Sidebar } from "@/components/app/Sidebar";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/db/store";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, account } = await requireSession();
  const store = getStore();
  const [profile, credits] = await Promise.all([
    store.getProfile(userId),
    store.getCredits(userId),
  ]);

  return (
    <div className="flex min-h-[100dvh] items-start">
      <Sidebar
        username={account.username}
        tier={account.tier}
        level={profile.level}
        credits={credits}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
