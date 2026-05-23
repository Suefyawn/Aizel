import {
  SkeletonPage,
  SkeletonStatGrid,
  SkeletonCard,
  SkeletonText,
  SkeletonBlock,
} from '@/components/admin/Skeleton';

// Loading skeleton for /admin/inventory — "Inventory" header with subtitle, a
// 3-up stock-summary strip, the stock-levels table, and the movement-history
// table.
export default function InventoryLoading() {
  return (
    <SkeletonPage title={150} subtitle={420}>
      <SkeletonStatGrid count={3} cardHeight={80} />

      {/* Stock levels table */}
      <SkeletonCard style={{ padding: 0, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
          <SkeletonText width={160} />
        </div>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '14px 16px',
              borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
            }}
          >
            <SkeletonText width="40%" />
            <SkeletonText width="20%" style={{ marginLeft: 'auto' }} />
            <SkeletonBlock width={56} height={22} radius={20} />
          </div>
        ))}
      </SkeletonCard>

      {/* Movement history */}
      <SkeletonText width={170} height={15} style={{ marginBottom: 10 }} />
      <SkeletonCard style={{ padding: 0, overflow: 'hidden' }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '14px 16px',
              borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
            }}
          >
            <SkeletonText width="28%" />
            <SkeletonText width="16%" />
            <SkeletonText width="20%" style={{ marginLeft: 'auto' }} />
          </div>
        ))}
      </SkeletonCard>
    </SkeletonPage>
  );
}
