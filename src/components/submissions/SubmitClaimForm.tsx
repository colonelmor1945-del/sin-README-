"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, cx } from "@/components/ui/primitives";
import { submitClaim, type SubmitState } from "@/lib/submissions/actions";

/**
 * The public submission form.
 *
 * Deliberately asks for less than it could. No account, no category picker,
 * no confidence slider — a claim, a source, and an optional name for credit.
 * Everything else (corroboration, the ceiling, whether it ever reaches the
 * dataset) is decided after this form submits, not by anything the visitor
 * chooses here.
 */
export function SubmitClaimForm() {
  const [state, formAction] = useActionState<SubmitState, FormData>(submitClaim, {});

  if (state.success) {
    return (
      <div
        role="status"
        className="rounded-[10px] border border-accent/40 bg-accent/5 px-4 py-4 text-[13px] leading-relaxed text-ink"
      >
        Submitted. It goes into the same review queue as everything else — a
        second, independent submission on the same claim is what moves it
        toward Community, and nothing here reaches the dataset without a
        person deciding that.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate key={state.error ?? "clean"}>
      <Field
        id="claim"
        label="What are you reporting?"
        as="textarea"
        hint="One specific, checkable claim. Not a link dump or a general opinion."
        placeholder="e.g. The Kortz Center Heist pays roughly 1.4 million per hour on hard."
        error={state.field === "claim" ? state.error : undefined}
        defaultValue={state.values?.claim}
        required
      />

      <Field
        id="sourceUrl"
        label="Source URL"
        type="url"
        hint="Where you saw it. A Reddit thread, a video, a screenshot host — anything a reviewer can open."
        placeholder="https://"
        error={state.field === "sourceUrl" ? state.error : undefined}
        defaultValue={state.values?.sourceUrl}
        required
      />

      <Field
        id="submittedBy"
        label="Name or handle (optional)"
        hint="Shown as credit if this reaches Community. Leave blank to submit anonymously."
        defaultValue={state.values?.submittedBy}
      />

      {state.error && !state.field ? (
        <p
          role="alert"
          className="rounded-[10px] border border-down/40 bg-down/5 px-3.5 py-2.5 text-[13px] text-down"
        >
          {state.error}
        </p>
      ) : null}

      <Submit />

      <p className="text-[11px] leading-relaxed text-ink-faint">
        Nothing submitted here is published automatically. It joins the
        review queue, where a claim only reaches Community once a second,
        independent submission or source says the same thing — and Verified
        never comes from agreement between visitors, only from Rockstar.
      </p>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Submitting" : "Submit claim"}
    </Button>
  );
}

function Field({
  id,
  label,
  type = "text",
  as = "input",
  hint,
  error,
  required,
  placeholder,
  defaultValue,
}: {
  id: string;
  label: string;
  type?: string;
  as?: "input" | "textarea";
  hint?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  const className = cx(
    "w-full rounded-[10px] border bg-surface-2 px-3.5 py-3 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none",
    error ? "border-down focus:border-down" : "border-line focus:border-accent",
  );

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {as === "textarea" ? (
        <textarea
          id={id}
          name={id}
          rows={3}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue}
          maxLength={280}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cx(className, "resize-none")}
        />
      ) : (
        <input
          id={id}
          name={id}
          type={type}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={className}
        />
      )}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[12px] text-down">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[12px] text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
