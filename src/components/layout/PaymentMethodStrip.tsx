// Footer payment-method strip — the UK trust pattern shoppers look for
// before clicking through to checkout. Only the methods our Stripe Checkout
// actually accepts: the card schemes plus the Apple Pay / Google Pay wallets
// that ride on top of `card` automatically on hosted Checkout. (No PayPal or
// Klarna — they aren't wired, so we don't advertise them.)
//
// Inline SVGs (not images) so the row stays crisp on retina, weighs
// almost nothing, and recolours via CSS — currentColor in the lockup
// strokes lets the marks adapt to dark/light footer backgrounds.

interface Method {
  name: string;
  /** Brand-coloured mark. We render at 28 × 18, so paths should fit a
   *  24 × 14 inner box once the rounded 1 px border + 2 px padding land. */
  svg: React.ReactNode;
}

// Each mark is the brand's wordmark or symbol at its canonical lockup —
// simplified to the bits that read at footer scale. White-on-light card
// faces match the printed-card convention; Apple Pay / Google Pay keep
// their canonical brand colours per their respective brand guidelines
// (otherwise the operator's compliance gets nervous).

const METHODS: Method[] = [
  {
    name: 'Visa',
    svg: (
      <svg viewBox="0 0 64 24" aria-hidden="true" focusable="false">
        <rect width="64" height="24" rx="3" fill="#fff" stroke="#E5E7EB" />
        <text x="32" y="17" textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif" fontWeight="900"
          fontStyle="italic" fontSize="13" fill="#1A1F71" letterSpacing="0.5">
          VISA
        </text>
      </svg>
    ),
  },
  {
    name: 'Mastercard',
    svg: (
      <svg viewBox="0 0 64 24" aria-hidden="true" focusable="false">
        <rect width="64" height="24" rx="3" fill="#fff" stroke="#E5E7EB" />
        <circle cx="27" cy="12" r="6.5" fill="#EB001B" />
        <circle cx="37" cy="12" r="6.5" fill="#F79E1B" />
        <path d="M32 6.7a6.5 6.5 0 010 10.6 6.5 6.5 0 010-10.6z" fill="#FF5F00" />
      </svg>
    ),
  },
  {
    name: 'American Express',
    svg: (
      <svg viewBox="0 0 64 24" aria-hidden="true" focusable="false">
        <rect width="64" height="24" rx="3" fill="#2E77BB" />
        <text x="32" y="16" textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif" fontWeight="800"
          fontSize="8" fill="#fff" letterSpacing="0.5">AMEX</text>
      </svg>
    ),
  },
  {
    name: 'Apple Pay',
    svg: (
      <svg viewBox="0 0 64 24" aria-hidden="true" focusable="false">
        <rect width="64" height="24" rx="3" fill="#fff" stroke="#E5E7EB" />
        <g fill="#000">
          <path d="M19.2 11.7c0-.7.3-1.3.8-1.8-.4-.6-.9-.9-1.6-.9-.7 0-1.3.4-1.6.4-.4 0-.9-.4-1.5-.4-.8 0-1.5.4-1.9 1.1-.8 1.4-.2 3.5.6 4.6.4.5.8 1.1 1.4 1.1.6 0 .8-.4 1.5-.4.7 0 .9.4 1.5.4.6 0 1-.5 1.4-1 .4-.6.6-1.1.6-1.2-.6-.3-1.2-.8-1.2-1.9zm-1.2-3.4c.3-.4.6-.9.5-1.5-.5 0-1 .3-1.4.7-.3.4-.6.9-.5 1.4.5 0 1-.2 1.4-.6z" />
          <text x="36" y="16" fontFamily="-apple-system, BlinkMacSystemFont, Helvetica, sans-serif"
            fontWeight="600" fontSize="9">Pay</text>
        </g>
      </svg>
    ),
  },
  {
    name: 'Google Pay',
    svg: (
      <svg viewBox="0 0 64 24" aria-hidden="true" focusable="false">
        <rect width="64" height="24" rx="3" fill="#fff" stroke="#E5E7EB" />
        <text x="32" y="16" textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif" fontWeight="500" fontSize="9">
          <tspan fill="#4285F4">G</tspan>
          <tspan fill="#EA4335">o</tspan>
          <tspan fill="#FBBC04">o</tspan>
          <tspan fill="#4285F4">g</tspan>
          <tspan fill="#34A853">l</tspan>
          <tspan fill="#EA4335">e</tspan>
          <tspan fill="#5F6368"> Pay</tspan>
        </text>
      </svg>
    ),
  },
];

interface Props {
  /** When `true` the strip is shown as a list with a screen-reader label
   *  + an aria-label on the wrapper for accessibility. */
  label?: string;
}

export function PaymentMethodStrip({ label = 'We accept' }: Props) {
  return (
    <div
      aria-label={`${label}: ${METHODS.map(m => m.name).join(', ')}`}
      role="group"
      style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
      }}
    >
      {/* Visually-hidden label so a screen reader still hears "We accept" */}
      <span style={{
        position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
        overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
      }}>{label}:</span>
      {METHODS.map(m => (
        <span
          key={m.name}
          title={m.name}
          style={{ display: 'inline-flex', width: 40, height: 24, opacity: 0.9 }}
        >
          {m.svg}
        </span>
      ))}
    </div>
  );
}
