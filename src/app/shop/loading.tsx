import { ProductGridSkeleton } from '@/components/ui/Skeleton';

// Streamed loading state for /shop. Next renders this immediately while the
// page's server query (getProducts + filter resolution) is in flight, so the
// visitor sees the catalogue shape instead of a blank page.
//
// Layout matches CollectionPage: toolbar row + 12-tile grid.

export default function Loading() {
  return (
    <main className="fade-in">
      <section style={{ padding: '24px 0 0' }}>
        <div className="container">
          {/* Toolbar row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              marginBottom: 24,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="skeleton" style={{ width: 96, height: 36, borderRadius: 100 }} />
              <div className="skeleton" style={{ width: 132, height: 36, borderRadius: 100 }} />
            </div>
            <div className="skeleton" style={{ width: 120, height: 28, borderRadius: 6 }} />
          </div>

          <ProductGridSkeleton count={12} columns={4} />
        </div>
      </section>
    </main>
  );
}
