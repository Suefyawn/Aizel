import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <main className="fade-in">
      <section style={{ padding: '32px 0' }}>
        <div className="container">
          <Skeleton height={42} width="40%" style={{ marginBottom: 8 }} />
          <Skeleton height={16} width="60%" style={{ marginBottom: 32 }} />
          <div
            className="blog-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gutter)' }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <Skeleton height={220} radius="var(--radius-card)" style={{ marginBottom: 12 }} />
                <Skeleton height={14} width="40%" style={{ marginBottom: 8 }} />
                <Skeleton height={20} width="85%" style={{ marginBottom: 6 }} />
                <Skeleton height={14} width="92%" style={{ marginBottom: 4 }} />
                <Skeleton height={14} width="76%" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
