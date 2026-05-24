'use client';

import Script from 'next/script';

// On-site instalment messaging for Klarna — the "Or 3 interest-free
// instalments of £X.XX" line UK beauty shoppers expect to see beneath
// the price on a PDP. Conversion-relevant for basket sizes £20–£60.
//
// Render policy (deliberately conservative to keep us compliant with
// Klarna's on-site messaging terms + UK FCA promotional rules):
//
//   • `NEXT_PUBLIC_KLARNA_CLIENT_ID` unset → render NOTHING. We don't
//     claim a payment method is available before the operator has wired
//     a real Klarna account.
//
//   • `NEXT_PUBLIC_KLARNA_CLIENT_ID` set → render the static instalment
//     line + load Klarna's on-site messaging library (`lib.klarnaservices`)
//     which then enhances the placement with the live, jurisdiction-aware
//     widget. Klarna's script does the regulatory disclaimer on its own
//     once it boots, so the static text we show is a non-binding preview.
//
// Threshold: Klarna requires a minimum of £1 in the UK for Pay-in-3 and
// the practical floor for most retailers is c. £20. We mirror that here.

interface Props {
  /** Final unit price in GBP that we'd actually charge — strike-through
   *  original prices are NOT used; Klarna instalments are computed off
   *  the price the customer pays. */
  price: number;
}

const MIN_PRICE = 1;       // Klarna Pay-in-3 floor in the UK
const SUGGEST_MIN = 5;     // Below this, "3 × £X" reads weird — hide.

export function KlarnaMessaging({ price }: Props) {
  const clientId = process.env.NEXT_PUBLIC_KLARNA_CLIENT_ID;
  if (!clientId) return null;
  if (price < SUGGEST_MIN || price < MIN_PRICE) return null;

  // Three even-thirds, rounded to 2dp. Klarna's own widget will repaint
  // with its exact calc once the script boots, so the small rounding
  // delta on the static line is acceptable as a placeholder.
  const instalment = (price / 3).toFixed(2);

  return (
    <>
      <Script
        id="klarna-osm-lib"
        src="https://eu-library.klarnaservices.com/lib.js"
        data-client-id={clientId}
        strategy="afterInteractive"
      />
      <div
        // Klarna's library scans for `klarna-placement` and swaps the
        // contents for a live, locale-aware widget — until then we show
        // the static line below as a graceful fallback.
        className="klarna-placement"
        data-key="credit-promotion-auto-size"
        data-locale="en-GB"
        data-purchase-amount={Math.round(price * 100)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginTop: -8, marginBottom: 16,
          fontSize: '0.8125rem', color: 'var(--ink-700)',
          lineHeight: 1.45,
        }}
      >
        {/* Klarna word-mark — single colour so it tints with surrounding
            text rather than fighting the Aizel palette. */}
        <svg width="46" height="14" viewBox="0 0 162 50" aria-label="Klarna" role="img" style={{ flexShrink: 0 }}>
          <path
            fill="#FFA8CD"
            d="M0 0h32v50H0z"
          />
          <path
            fill="#0A0A0A"
            d="M44 1h7v48h-7zM62 1h7v22l13-22h9l-14 22 15 26h-9L70 27v22h-7zM117 22c0-7 5-10 12-10 8 0 13 4 13 11v26h-7v-4c-2 3-6 5-11 5-7 0-13-4-13-11s5-10 13-11l11-1v-4c0-3-2-5-6-5s-7 2-7 5h-5zm5 16c0 3 3 6 8 6 5 0 8-3 8-6v-2l-9 1c-5 0-7 1-7 1zM148 1h7v48h-7z"
          />
        </svg>
        <span>
          Or 3 interest-free instalments of <strong>£{instalment}</strong> with Klarna.
        </span>
      </div>
    </>
  );
}
