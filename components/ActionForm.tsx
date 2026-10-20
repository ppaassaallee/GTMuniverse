"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/actions";

type Props = {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  children?: React.ReactNode;
  secondary?: boolean;
};

/** A form bound to a server action, with a pending state and an inline result message. */
export function ActionForm({ action, submitLabel, pendingLabel, className, children, secondary }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="actions">
        <button className={secondary ? "btn ghost" : "btn"} type="submit" disabled={pending}>
          {pending ? pendingLabel || "Working…" : submitLabel}
        </button>
        <p className={`status ${state?.error ? "err" : ""}`} aria-live="polite">
          {state?.error || state?.ok || ""}
        </p>
      </div>
    </form>
  );
}
