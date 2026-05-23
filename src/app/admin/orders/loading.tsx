import {
  SkeletonPage,
  SkeletonCard,
  SkeletonBlock,
  SkeletonTable,
} from '@/components/admin/Skeleton';

// Loading skeleton for /admin/orders — header with an Export button, a filter
// bar, then the orders table.
export default function OrdersLoading() {
  return (
    <SkeletonPage title={110}>
      {/* Header trailing action (Export CSV button) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -52, marginBottom: 24 }}>
        <SkeletonBlock width={120} height={36} radius={8} />
      </div>

      {/* Filter bar */}
      <SkeletonCard style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <SkeletonBlock height={36} radius={8} />
          <SkeletonBlock width={160} height={36} radius={8} />
        </div>
      </SkeletonCard>

      <SkeletonTable rows={8} />
    </SkeletonPage>
  );
}
