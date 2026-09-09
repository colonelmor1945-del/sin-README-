import { SignOut as SignOutIcon } from "@phosphor-icons/react/dist/ssr";

import { logout } from "@/lib/auth/actions";

/**
 * Sign out. A form POST rather than a link, so it cannot be triggered by a
 * prefetch, an image tag or a crawler following hrefs.
 */
export function SignOutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-[13px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <SignOutIcon size={17} />
        Sign out
      </button>
    </form>
  );
}
