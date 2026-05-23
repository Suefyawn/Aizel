import {
  SkeletonPage,
  SkeletonCard,
  SkeletonBlock,
  SkeletonTable,
} from '@/components/admin/Skeleton';

// Loading skeleton for /admin/products — header with "Import CSV" / "New
// Product" actions, a filter bar, then the products table.
export default function ProductsLoading() {
  return (
    <SkeletonPage title={130}>
      {/* Header trailing actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: -52, marginBottom: 24 }}>
        <SkeletonBlock width={110} height={38} radius={8} />
        <SkeletonBlock width={140} height={38} radius={8} />
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
