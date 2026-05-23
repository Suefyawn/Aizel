import type { BankAccount } from '@/types';

// Presentational list of bank / wallet accounts for manual "Bank Transfer"
// orders. No hooks — safe to render from both the (client) checkout page and
// the (server) thank-you page. Self-hides when there are no accounts.
export function BankAccountsList({ accounts, notes, reference }: {
  accounts: BankAccount[];
  notes?: string;
  reference?: string;
}) {
  if (!accounts.length) return null;
  return (
    <div style={{
      background: 'var(--paper2)', border: '1px solid var(--line)',
      borderRadius: 'var(--radius-card)', padding: 20, textAlign: 'left',
    }}>
      <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: 4 }}>
        Bank transfer details
      </div>
      <p className="small-text" style={{ marginBottom: 14 }}>
        Transfer your order total to any one of the accounts below
        {reference ? <>, quoting <strong>{reference}</strong> as the payment reference</> : null}.
        Then send us the receipt on WhatsApp so we can confirm and ship.
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        {accounts.map((a, i) => (
          <div key={i} style={{
            background: 'var(--paper)', border: '1px solid var(--line)',
            borderRadius: 8, padding: '10px 12px',
          }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 2 }}>{a.label}</div>
            {a.title && <div className="small-text">Account title: {a.title}</div>}
            <div className="small-text">Account / number: <strong>{a.number}</strong></div>
            {a.iban && <div className="small-text">IBAN: {a.iban}</div>}
          </div>
        ))}
      </div>
      {notes && notes.trim() && (
        <p className="small-text" style={{ marginTop: 12, whiteSpace: 'pre-line' }}>{notes}</p>
      )}
    </div>
  );
}
