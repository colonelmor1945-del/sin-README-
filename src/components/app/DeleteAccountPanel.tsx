"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Panel, PanelHead, cx } from "@/components/ui/primitives";
import type { DeleteState } from "@/app/dashboard/settings/delete-account";

/**
 * Account erasure, kept behind one deliberate step.
 *
 * The form is collapsed until asked for. An irreversible control sitting open
 * on a settings page is a control somebody eventually hits on the way to
 * something else, and there is no undo behind this one.
 */
export function DeleteAccountPanel({
  username,
  hasPassword,
  action,
}: {
  username: string;
  hasPassword: boolean;
  action: (state: DeleteState, formData: FormData) => Promise<DeleteState>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<DeleteState, FormData>(action, {});

  return (
    <Panel quiet className="p-5">
      <PanelHead title="Delete this account" />

      <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
        Your profile, saved money plans, assistant conversations and remaining
        Lab Credits are erased immediately and cannot be restored. Records of
        payments are kept without your name on them, because accounting rules
        require it.
      </p>

      {!open ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 border-down/40 text-down hover:border-down hover:text-down"
          onClick={() => setOpen(true)}
        >
          Delete account
        </Button>
      ) : (
        <form action={formAction} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-ink-muted">
              Type <span className="tabular text-ink">{username}</span> to confirm
            </span>
            <input
              name="confirm"
              autoComplete="off"
              autoFocus
              className={cx(
                "w-full rounded-[10px] border bg-surface-2 px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none",
                state.field === "confirm"
                  ? "border-down focus:border-down"
                  : "border-line-strong focus:border-accent",
              )}
            />
          </label>

          {hasPassword ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] text-ink-muted">Your password</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                className={cx(
                  "w-full rounded-[10px] border bg-surface-2 px-3.5 py-2.5 text-[14px] text-ink focus:outline-none",
                  state.field === "password"
                    ? "border-down focus:border-down"
                    : "border-line-strong focus:border-accent",
                )}
              />
            </label>
          ) : null}

          {state.error ? (
            <p className="rounded-[10px] border border-down/40 bg-down/5 px-3.5 py-2.5 text-[13px] text-down">
              {state.error}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <Submit />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Keep my account
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      disabled={pending}
      className="bg-down text-white hover:bg-down/85"
    >
      {pending ? "Deleting…" : "Delete permanently"}
    </Button>
  );
}
