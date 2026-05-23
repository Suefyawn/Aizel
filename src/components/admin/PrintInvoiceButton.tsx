'use client';

export function PrintInvoiceButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        padding: '8px 18px', background: 'white', border: '1px solid #d1d5db',
        borderRadius: 7, color: '#374151', cursor: 'pointer',
        fontSize: '0.875rem', fontWeight: 500,
        display: 'flex', alignItems: 'center', gap: 6,
      }}
    >
      🖨 Print Invoice
    </button>
  );
}
