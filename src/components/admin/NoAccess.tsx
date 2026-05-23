import { AdminIcon } from '@/components/ui/AdminIcon';

export function NoAccess({ section }: { section: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', gap: 16,
      color: '#6b7280', textAlign: 'center', padding: '32px',
    }}>
      <div style={{ color: '#9ca3af' }}>
        <AdminIcon name="lock" size={48} />
      </div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>Access Restricted</div>
      <div style={{ fontSize: '0.9375rem' }}>
        You don&apos;t have permission to access <strong>{section}</strong>.
      </div>
      <div style={{ fontSize: '0.875rem' }}>Contact the store owner to request access.</div>
    </div>
  );
}
