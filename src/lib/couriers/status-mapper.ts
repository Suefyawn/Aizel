// ============================================================================
// Courier-status string → our internal enum mapper. Each PK courier reports
// status in slightly different language ("Delivered" vs "OK" vs "POD") —
// this normaliser absorbs the variation so shipment_events rows always
// carry one of: created, picked_up, in_transit, out_for_delivery,
// delivered, returned, failed, cancelled.
// ============================================================================

export function normaliseCourierStatus(raw: string): string {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('deliver') || s === 'ok' || s === 'pod')   return 'delivered';
  if (s.includes('out for delivery') || s === 'ofd')        return 'out_for_delivery';
  if (s.includes('transit') || s.includes('shipped') || s.includes('arrived')) return 'in_transit';
  if (s.includes('pick'))                                    return 'picked_up';
  if (s.includes('return') || s === 'ro')                    return 'returned';
  if (s.includes('cancel'))                                  return 'cancelled';
  if (s.includes('fail') || s.includes('refus'))             return 'failed';
  return 'in_transit';
}
