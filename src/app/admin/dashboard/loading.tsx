import {
  SkeletonPage,
  SkeletonStatGrid,
  SkeletonCard,
  SkeletonText,
  SkeletonBlock,
} from '@/components/admin/Skeleton';

// Loading skeleton for /admin/dashboard — mirrors its layout: a "Dashboard"
// header with subtitle, a 4-up stat-card row, a tall revenue-chart card and a
// two-column "Orders by Status" / "Top products" block.
export default function DashboardLoading() {
  return (
    <SkeletonPage title={150} subtitle={320}>
      <SkeletonStatGrid count={4} cardHeight={108} />

      {/* Revenue chart */}
      <SkeletonCard style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <SkeletonText width={190} />
          <SkeletonText width={90} />
        </div>
        <SkeletonBlock height={220} radius={8} />
      </SkeletonCard>

      {/* Orders by status + Top products */}
      <div
        className="adm-analytics-grid"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}
      >
        {[0, 1].map(col => (
          <SkeletonCard key={col}>
            <SkeletonText width={160} style={{ marginBottom: 18 }} />
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <SkeletonText width="40%" height={11} />
                  <SkeletonText width={48} height={11} />
                </div>
                <SkeletonBlock height={6} radius={3} />
              </div>
            ))}
          </SkeletonCard>
        ))}
      </div>
    </SkeletonPage>
  );
}
