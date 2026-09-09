"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { Button, cx } from "@/components/ui/primitives";
import type { AuthState } from "@/lib/auth/actions";

/**
 * Shared credential form.
 *
 * Labels sit above inputs, helper text below, and errors render inline next to
 * the field they belong to. The submit button reports its own pending state
 * through useFormStatus so the form works before hydration finishes.
 */
export function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "register";
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
}) {
  const [state, formAction] = useActionState<AuthState, FormData>(action, {});
  const isRegister = mode === "register";

  return (
    <form action={formAction} className="space-y-5" noValidate key={state.error ?? "clean"}>
      <Field
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        hint={isRegister ? "Used to sign in. We do not email you otherwise." : undefined}
        error={state.field === "email" ? state.error : undefined}
        defaultValue={state.values?.email}
        required
      />

      {isRegister ? (
        <Field
          id="username"
          label="Username"
          type="text"
          autoComplete="username"
          hint="Letters, numbers, hyphen and underscore. 3 to 32 characters."
          error={state.field === "username" ? state.error : undefined}
          defaultValue={state.values?.username}
          required
        />
      ) : null}

      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete={isRegister ? "new-password" : "current-password"}
        hint={isRegister ? "At least 10 characters. Longer beats complicated." : undefined}
        error={state.field === "password" ? state.error : undefined}
        required
      />

      {state.error && !state.field ? (
        <p
          role="alert"
          className="rounded-[10px] border border-down/40 bg-down/5 px-3.5 py-2.5 text-[13px] text-down"
        >
          {state.error}
        </p>
      ) : null}

      <Submit label={isRegister ? "Create account" : "Sign in"} />

      <p className="text-center text-[13px] text-ink-muted">
        {isRegister ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-accent hover:text-accent-soft">
              Sign in
            </Link>
          </>
        ) : (
          <>
            No account yet?{" "}
            <Link href="/register" className="text-accent hover:text-accent-soft">
              Create one free
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Working" : label}
    </Button>
  );
}

function Field({
  id,
  label,
  type,
  autoComplete,
  hint,
  error,
  required,
  defaultValue,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  hint?: string;
  error?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cx(
          "w-full rounded-[10px] border bg-surface-2 px-3.5 py-3 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none",
          error ? "border-down focus:border-down" : "border-line focus:border-accent",
        )}
      />
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
