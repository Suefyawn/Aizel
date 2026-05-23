import { SkeletonPage, SkeletonStatGrid, SkeletonTable } from '@/components/admin/Skeleton';

// Generic admin loading skeleton — the fallback Next renders in the AdminShell
// content area for any admin route without its own loading.tsx. Heavy routes
// (dashboard, orders, products, users, analytics, inventory) ship tailored
// skeletons; this stays generic on purpose: header + stat row + a list.
export default function AdminLoading() {
  return (
    <SkeletonPage title={190} subtitle={300}>
      <SkeletonStatGrid count={4} />
      <SkeletonTable rows={6} />
    </SkeletonPage>
  );
}
