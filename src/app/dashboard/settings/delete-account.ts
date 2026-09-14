"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, requireSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { getStore } from "@/lib/db/store";

export interface DeleteState {
  error?: string;
  field?: "confirm" | "password";
}

/**
 * Erase the signed-in account.
 *
 * Two things guard this, and they guard different failures. Typing the
 * username defends against the misclick: it cannot be done by accident, and it
 * names out loud what is about to go. The password defends against the
 * borrowed laptop, where somebody else is already holding a valid session.
 *
 * Accounts created through Google have no password, so for those the typed
 * username is the whole check — demanding a credential they never set would
 * lock them out of their own erasure.
 */
export async function deleteAccount(
  _prev: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  const { userId, account } = await requireSession();

  const typed = String(formData.get("confirm") ?? "").trim();
  if (typed !== account.username) {
    return {
      error: `Type ${account.username} exactly to confirm.`,
      field: "confirm",
    };
  }

  const record = await getStore().findByEmail(account.email);
  if (record?.passwordHash) {
    const password = String(formData.get("password") ?? "");
    if (!(await verifyPassword(password, record.passwordHash))) {
      return { error: "That password is not right.", field: "password" };
    }
  }

  await getStore().deleteAccount(userId);

  // The session row went with the account, so the cookie now points at
  // nothing. Clearing it anyway keeps the browser from carrying a dead token
  // around and being signed out by surprise on the next navigation.
  (await cookies()).delete(SESSION_COOKIE);

  redirect("/?account=deleted");
}
