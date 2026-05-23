import {
  SkeletonPage,
  SkeletonCard,
  SkeletonBlock,
  SkeletonTable,
} from '@/components/admin/Skeleton';

// Loading skeleton for /admin/users (Customers) — header with a count
// subtitle, a filter bar, then the customers table.
export default function UsersLoading() {
  return (
    <SkeletonPage title={150} subtitle={160}>
      {/* Filter bar */}
      <SkeletonCard style={{ padding: 16, marginBottom: 16 }}>
        <SkeletonBlock height={36} radius={8} />
      </SkeletonCard>

      <SkeletonTable rows={10} />
    </SkeletonPage>
  );
}
