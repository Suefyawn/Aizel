import {
  SkeletonPage,
  SkeletonStatGrid,
  SkeletonCard,
  SkeletonText,
  SkeletonBlock,
} from '@/components/admin/Skeleton';

// Loading skeleton for /admin/analytics — "Analytics" header, a 5-up KPI
// strip, a wide chart card, and two-column metric panels.
export default function AnalyticsLoading() {
  return (
    <SkeletonPage title={140}>
      <SkeletonStatGrid count={5} cardHeight={84} />

      {/* Wide chart card */}
      <SkeletonCard style={{ marginBottom: 28 }}>
        <SkeletonText width={180} style={{ marginBottom: 16 }} />
        <SkeletonBlock height={200} radius={8} />
      </SkeletonCard>

      {/* Two-column metric panels */}
      <div
        className="adm-analytics-grid"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
      >
        {[0, 1].map(col => (
          <SkeletonCard key={col}>
            <SkeletonText width={150} style={{ marginBottom: 16 }} />
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}
              >
                <SkeletonText width="45%" height={12} />
                <SkeletonText width={56} height={12} />
              </div>
            ))}
          </SkeletonCard>
        ))}
      </div>
    </SkeletonPage>
  );
}
