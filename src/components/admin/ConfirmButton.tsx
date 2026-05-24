'use client';

import { useRef } from 'react';

// Small client wrapper for destructive server-action toggles (pause a
// promo, deactivate a coupon, etc.). Renders a regular <button type="submit">
// that, on click, fires a window.confirm() — and if the user cancels,
// stops the form submission cold.
//
// Usage:
//   <form action={someServerAction}>
//     <ConfirmButton message="Pause this promo for everyone?" style={...}>
//       Pause
//     </ConfirmButton>
//   </form>
//
// `message` and `confirmLabel` are required so we never ship a generic
// "Are you sure?" prompt — confirmations need to say what's about to
// happen and what the consequence is.

interface Props {
  /** Confirm-dialog text — should describe the action and its consequence. */
  message: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function ConfirmButton({ message, children, style, className, disabled, ariaLabel }: Props) {
  const submittingRef = useRef(false);

  return (
    <button
      type="submit"
      className={className}
      style={style}
      disabled={disabled}
      aria-label={ariaLabel}
      // We use onClick (not onSubmit on the parent form) so the confirm
      // fires before the server action is invoked. Calling preventDefault
      // here cancels the implicit submission.
      onClick={(e) => {
        if (submittingRef.current) return;
        const ok = window.confirm(message);
        if (!ok) {
          e.preventDefault();
          return;
        }
        submittingRef.current = true;
        // Reset after a tick so a stale click guard doesn't keep the
        // button frozen if the action errors and we stay on the page.
        setTimeout(() => { submittingRef.current = false; }, 1500);
      }}
    >
      {children}
    </button>
  );
}
