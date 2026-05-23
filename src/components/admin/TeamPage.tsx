'use client';
import { useEffect, useMemo, useState, useActionState } from 'react';
import {
  createStaffMember, updateStaffPermissions,
  toggleStaffActive, resetStaffPassword, deleteStaffMember,
} from '@/app/admin/team/actions';
import { createRole, updateRole, deleteRole } from '@/app/admin/team/role-actions';
import {
  ALL_PERMISSIONS, PERMISSION_META, GROUP_META,
  type PermissionGroup,
} from '@/lib/permissions';
import type { Permission } from '@/lib/permissions';

interface Staff {
  id: string;
  email: string;
  name: string;
  permissions: Permission[];
  is_active: boolean;
  created_at: string;
  role_id: string | null;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  is_system: boolean;
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: 'white', borderRadius: 12,
  border: '1px solid #e5e7eb', overflow: 'hidden',
};
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: '0.875rem', color: '#111827',
  outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.8125rem', fontWeight: 600,
  color: '#374151', marginBottom: 5,
};
const permBadge: React.CSSProperties = {
  background: '#eef2ff', color: '#6366f1', borderRadius: 4,
  padding: '2px 7px', fontSize: '0.6875rem', fontWeight: 600,
};
const btn = (color = '#111827', ghost = false): React.CSSProperties => ({
  padding: '7px 14px', borderRadius: 7, fontSize: '0.8125rem', fontWeight: 600,
  cursor: 'pointer', border: ghost ? `1px solid ${color}` : 'none',
  background: ghost ? 'transparent' : color,
  color: ghost ? color : 'white',
});

// ─── Permission picker ───────────────────────────────────────────────────────
// A grouped checklist (Commerce / Content / Analytics / Store) with full label
// + description per row so the merchant knows what they're handing out, plus
// Select all / Clear shortcuts. Used both for "Custom" staff members and for
// defining a role's permission set.

const GROUPS_ORDER: PermissionGroup[] = ['commerce', 'content', 'analytics', 'store'];

function PermissionGrid({ selected, onChange }: {
  selected: Permission[];
  onChange: (p: Permission[]) => void;
}) {
  const toggle = (p: Permission) =>
    onChange(selected.includes(p) ? selected.filter(x => x !== p) : [...selected, p]);

  // Group the permission list once.
  const byGroup = useMemo(() => {
    const map: Record<PermissionGroup, Permission[]> = { commerce: [], content: [], analytics: [], store: [] };
    for (const p of ALL_PERMISSIONS) map[PERMISSION_META[p].group].push(p);
    return map;
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hidden inputs so the form submission picks up the selection regardless
          of which rows are checked. One value per permission → the server
          action receives them as an array. */}
      {selected.map(p => <input key={p} type="hidden" name="permissions" value={p} />)}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <button type="button" onClick={() => onChange([...ALL_PERMISSIONS])} style={miniBtn('#374151', true)}>
          Select all
        </button>
        <button type="button" onClick={() => onChange([])} style={miniBtn('#dc2626', true)}>
          Clear
        </button>
      </div>

      {/* Grouped checklist */}
      {GROUPS_ORDER.map(group => {
        const items = byGroup[group];
        if (items.length === 0) return null;
        const { label, desc } = GROUP_META[group];
        const allOn = items.every(p => selected.includes(p));
        return (
          <div key={group}>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8,
            }}>
              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{desc}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (allOn) onChange(selected.filter(p => !items.includes(p)));
                  else       onChange([...new Set([...selected, ...items])]);
                }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#6366f1', fontSize: '0.75rem', fontWeight: 600,
                }}
              >
                {allOn ? 'Revoke all' : 'Grant all'}
              </button>
            </div>
            <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {items.map(p => {
                const { label, icon, desc } = PERMISSION_META[p];
                const on = selected.includes(p);
                return (
                  <label key={p} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                    border: `1px solid ${on ? '#6366f1' : '#e5e7eb'}`,
                    borderRadius: 8, cursor: 'pointer',
                    background: on ? '#eef2ff' : 'white',
                    transition: 'all 0.15s',
                  }}>
                    <input type="checkbox"
                      checked={on} onChange={() => toggle(p)}
                      style={{ marginTop: 2, accentColor: '#6366f1' }} />
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827' }}>
                        {icon} {label}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2, lineHeight: 1.45 }}>{desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function miniBtn(color: string, ghost = false): React.CSSProperties {
  return {
    padding: '5px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
    cursor: 'pointer', border: ghost ? `1px solid ${color}` : 'none',
    background: ghost ? 'transparent' : color,
    color: ghost ? color : 'white',
  };
}

// Read-only summary of a role's permission set — shown under the role picker
// in the staff modals so the owner sees what assigning the role grants.
function RolePermSummary({ role }: { role: Role }) {
  return (
    <div style={{
      marginTop: 10, padding: '10px 12px', background: '#f9fafb',
      border: '1px solid #e5e7eb', borderRadius: 8,
    }}>
      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: role.permissions.length ? 8 : 0 }}>
        {role.description || `Grants ${role.permissions.length} permission${role.permissions.length === 1 ? '' : 's'}.`}
      </div>
      {role.permissions.length === 0 ? (
        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>This role grants no permissions.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {role.permissions.map(p => (
            <span key={p} style={permBadge}>{PERMISSION_META[p]?.label ?? p}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Role modal ───────────────────────────────────────────────────────────────

function RoleModal({ role, onClose }: { role: Role | null; onClose: () => void }) {
  const editing = role !== null;
  const [perms, setPerms] = useState<Permission[]>(role?.permissions ?? []);
  const [state, action, pending] = useActionState(editing ? updateRole : createRole, null);

  // Role actions return { ok: true } on success — close once that lands so the
  // refreshed list (revalidatePath) shows the change.
  useEffect(() => {
    if (state && 'ok' in state) onClose();
  }, [state, onClose]);

  return (
    <form action={action} style={{ padding: 28, borderTop: '1px solid #f3f4f6' }}>
      <div style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: 16, color: '#111827' }}>
        {editing ? `Edit role — ${role!.name}` : 'New role'}
      </div>
      {editing && <input type="hidden" name="id" value={role!.id} />}

      <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={lbl}>Role name</label>
          <input name="name" required defaultValue={role?.name ?? ''} placeholder="e.g. Fulfilment" style={inp} />
        </div>
        <div>
          <label style={lbl}>Description</label>
          <input name="description" defaultValue={role?.description ?? ''} placeholder="Short summary (optional)" style={inp} />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ ...lbl, marginBottom: 10 }}>Permissions</label>
        <PermissionGrid selected={perms} onChange={setPerms} />
      </div>

      {state && 'error' in state && (
        <p style={{ color: '#ef4444', fontSize: '0.8125rem', marginBottom: 12 }}>{state.error}</p>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" disabled={pending} style={btn('#6366f1')}>
          {pending ? 'Saving…' : (editing ? 'Save Role' : 'Create Role')}
        </button>
        <button type="button" style={btn('#6b7280', true)} onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

// ─── Roles panel ──────────────────────────────────────────────────────────────

function RoleRow({ role, onEdit }: { role: Role; onEdit: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderTop: '1px solid #f3f4f6' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>{role.name}</span>
          {role.is_system && (
            <span style={{
              background: '#f3f4f6', color: '#6b7280', borderRadius: 4, padding: '1px 6px',
              fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>Built-in</span>
          )}
          <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
            {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'}
          </span>
        </div>
        {role.description && (
          <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: 2 }}>{role.description}</div>
        )}
      </div>
      <button style={btn('#6366f1', true)} onClick={onEdit}>Edit</button>
      {role.is_system ? (
        <button style={{ ...btn('#9ca3af', true), cursor: 'not-allowed' }} disabled title="Built-in roles can't be deleted">
          Delete
        </button>
      ) : confirm ? (
        <form action={deleteRole} style={{ display: 'inline' }}>
          <input type="hidden" name="id" value={role.id} />
          <button type="submit" style={btn('#ef4444')}>Confirm</button>
          <button type="button" style={{ ...btn('#6b7280', true), marginLeft: 6 }} onClick={() => setConfirm(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button style={btn('#ef4444', true)} onClick={() => setConfirm(true)}>Delete</button>
      )}
    </div>
  );
}

function RolesPanel({ roles }: { roles: Role[] }) {
  // null = list view, 'new' = create modal, Role = edit modal.
  const [editing, setEditing] = useState<Role | 'new' | null>(null);

  return (
    <div style={{ ...card, marginBottom: 24 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, padding: '16px 20px',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827' }}>Roles</div>
          <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
            Reusable permission sets. Editing a role updates every staff member who holds it.
          </div>
        </div>
        {editing === null && (
          <button style={btn('#6366f1', true)} onClick={() => setEditing('new')}>+ New Role</button>
        )}
      </div>

      {editing === 'new' && <RoleModal role={null} onClose={() => setEditing(null)} />}
      {editing !== null && editing !== 'new' && (
        <RoleModal role={editing} onClose={() => setEditing(null)} />
      )}

      {editing === null && (
        roles.length === 0 ? (
          <div style={{ padding: '24px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem', borderTop: '1px solid #f3f4f6' }}>
            No roles yet. Create one to assign it to staff.
          </div>
        ) : (
          <div>
            {roles.map(r => <RoleRow key={r.id} role={r} onEdit={() => setEditing(r)} />)}
          </div>
        )
      )}
    </div>
  );
}

// ─── Role picker (staff modals) ───────────────────────────────────────────────

function RoleField({ roles, value, onChange }: {
  roles: Role[];
  value: string;
  onChange: (id: string) => void;
}) {
  const selected = roles.find(r => r.id === value) ?? null;
  return (
    <div>
      <label style={lbl}>Role</label>
      <select name="role_id" value={value} onChange={e => onChange(e.target.value)} style={inp}>
        <option value="">Custom — pick individual permissions</option>
        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      {selected && <RolePermSummary role={selected} />}
    </div>
  );
}

// ─── Add Staff Modal ──────────────────────────────────────────────────────────

function AddStaffModal({ roles, onClose }: { roles: Role[]; onClose: () => void }) {
  const [perms, setPerms] = useState<Permission[]>([]);
  const [roleId, setRoleId] = useState('');
  const [state, action, pending] = useActionState(createStaffMember, null);

  if (state && 'tempPassword' in state) {
    return (
      <div style={{ padding: 28 }}>
        <div style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 16, color: '#111827' }}>
          ✓ Staff member created
        </div>
        <div style={{
          background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8,
          padding: 16, marginBottom: 20,
        }}>
          <p style={{ margin: '0 0 8px', fontSize: '0.8125rem', fontWeight: 600, color: '#92400e' }}>
            Temporary password — share this once and ask them to change it:
          </p>
          <code style={{
            display: 'block', fontSize: '1.125rem', fontWeight: 700,
            letterSpacing: '0.1em', color: '#111827',
          }}>{state.tempPassword}</code>
        </div>
        <button style={btn('#111827')} onClick={onClose}>Done</button>
      </div>
    );
  }

  return (
    <form action={action} style={{ padding: 28 }}>
      <div style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 20, color: '#111827' }}>
        Add Staff Member
      </div>
      <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={lbl}>Full Name</label>
          <input name="name" required placeholder="Ali Hassan" style={inp} />
        </div>
        <div>
          <label style={lbl}>Email</label>
          <input name="email" type="email" required placeholder="ali@example.com" style={inp} />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <RoleField roles={roles} value={roleId} onChange={setRoleId} />
      </div>

      {!roleId && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ ...lbl, marginBottom: 10 }}>Permissions</label>
          <PermissionGrid selected={perms} onChange={setPerms} />
        </div>
      )}

      {state && 'error' in state && (
        <p style={{ color: '#ef4444', fontSize: '0.8125rem', marginBottom: 12 }}>{state.error}</p>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" disabled={pending} style={btn('#6366f1')}>
          {pending ? 'Creating…' : 'Create Account'}
        </button>
        <button type="button" style={btn('#6b7280', true)} onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

// ─── Edit Staff Modal ─────────────────────────────────────────────────────────

function EditStaffModal({ staff, roles, onClose }: { staff: Staff; roles: Role[]; onClose: () => void }) {
  const [roleId, setRoleId] = useState(staff.role_id ?? '');
  // Custom-permission grid: seed from the staff member's own perms, or — if
  // they're role-assigned — from that role's perms, so switching to Custom
  // starts from a sensible baseline rather than an empty grid.
  const [perms, setPerms] = useState<Permission[]>(() => {
    if (staff.permissions.length) return staff.permissions;
    const r = roles.find(x => x.id === staff.role_id);
    return r?.permissions ?? [];
  });
  const [saveState, saveAction, savePending] = useActionState(updateStaffPermissions, null);
  const [resetState, resetAction, resetPending] = useActionState(resetStaffPassword, null);

  if (resetState && 'tempPassword' in resetState) {
    return (
      <div style={{ padding: 28 }}>
        <div style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 16 }}>Password Reset</div>
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <p style={{ margin: '0 0 8px', fontSize: '0.8125rem', fontWeight: 600, color: '#92400e' }}>
            New temporary password for {staff.name}:
          </p>
          <code style={{ display: 'block', fontSize: '1.125rem', fontWeight: 700, letterSpacing: '0.1em', color: '#111827' }}>
            {resetState.tempPassword}
          </code>
        </div>
        <button style={btn('#111827')} onClick={onClose}>Done</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 4 }}>Edit — {staff.name}</div>
      <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: 20 }}>{staff.email}</div>

      <form action={saveAction}>
        <input type="hidden" name="id" value={staff.id} />
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Full Name</label>
          <input name="name" defaultValue={staff.name} required style={inp} />
        </div>
        <div style={{ marginBottom: roleId ? 20 : 14 }}>
          <RoleField roles={roles} value={roleId} onChange={setRoleId} />
        </div>
        {!roleId && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ ...lbl, marginBottom: 10 }}>Permissions</label>
            <PermissionGrid selected={perms} onChange={setPerms} />
          </div>
        )}
        {saveState?.error && (
          <p style={{ color: '#ef4444', fontSize: '0.8125rem', marginBottom: 12 }}>{saveState.error}</p>
        )}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button type="submit" disabled={savePending} style={btn('#6366f1')}>
            {savePending ? 'Saving…' : 'Save Changes'}
          </button>
          <button type="button" style={btn('#6b7280', true)} onClick={onClose}>Cancel</button>
        </div>
      </form>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 10 }}>
          Password Reset
        </div>
        <form action={resetAction}>
          <input type="hidden" name="id" value={staff.id} />
          {resetState && 'error' in resetState && (
            <p style={{ color: '#ef4444', fontSize: '0.8125rem', marginBottom: 8 }}>{resetState.error}</p>
          )}
          <button type="submit" disabled={resetPending} style={btn('#f59e0b')}>
            {resetPending ? 'Resetting…' : '⟳ Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Staff row ────────────────────────────────────────────────────────────────

function StaffRow({ staff, roles }: { staff: Staff; roles: Role[] }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const role = staff.role_id ? roles.find(r => r.id === staff.role_id) : undefined;

  if (editing) {
    return (
      <tr>
        <td colSpan={5} style={{ padding: 0 }}>
          <EditStaffModal staff={staff} roles={roles} onClose={() => setEditing(false)} />
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ borderTop: '1px solid #f3f4f6' }}>
      <td data-label="Member" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: '#eef2ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#6366f1', fontWeight: 700, fontSize: '0.8125rem', flexShrink: 0,
          }}>
            {staff.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>{staff.name}</div>
            <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>{staff.email}</div>
          </div>
        </div>
      </td>
      <td data-label="Access" style={{ padding: '14px 20px' }}>
        {role ? (
          <span style={{
            background: '#fef9c3', color: '#854d0e', borderRadius: 4,
            padding: '3px 9px', fontSize: '0.75rem', fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            ▦ {role.name}
            <span style={{ fontWeight: 500, opacity: 0.7 }}>
              · {role.permissions.length} perm{role.permissions.length === 1 ? '' : 's'}
            </span>
          </span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {(() => {
              // Custom staff member — render its own permission badges.
              // Defence-in-depth: dedupe at render time (migration 070 deduped
              // existing data; this guards against any future regression).
              const uniq = Array.from(new Set(staff.permissions));
              if (uniq.length === 0) {
                return <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>No permissions</span>;
              }
              return uniq.map(p => (
                <span key={p} style={permBadge}>
                  {PERMISSION_META[p]?.label ?? p}
                </span>
              ));
            })()}
          </div>
        )}
      </td>
      <td data-label="Status" style={{ padding: '14px 20px' }}>
        <span style={{
          background: staff.is_active ? '#dcfce7' : '#fee2e2',
          color: staff.is_active ? '#166534' : '#991b1b',
          borderRadius: 4, padding: '3px 8px', fontSize: '0.75rem', fontWeight: 600,
        }}>
          {staff.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td data-label="Added" style={{ padding: '14px 20px', color: '#6b7280', fontSize: '0.8125rem' }}>
        {new Date(staff.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
      </td>
      <td style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button style={btn('#6366f1', true)} onClick={() => setEditing(true)}>Edit</button>
          <form action={toggleStaffActive} style={{ display: 'inline' }}>
            <input type="hidden" name="id" value={staff.id} />
            <input type="hidden" name="is_active" value={String(staff.is_active)} />
            <button type="submit" style={btn(staff.is_active ? '#f59e0b' : '#22c55e', true)}>
              {staff.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </form>
          {confirm ? (
            <form action={deleteStaffMember} style={{ display: 'inline' }}>
              <input type="hidden" name="id" value={staff.id} />
              <button type="submit" style={btn('#ef4444')}>Confirm Delete</button>
              <button type="button" style={{ ...btn('#6b7280', true), marginLeft: 6 }} onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <button style={btn('#ef4444', true)} onClick={() => setConfirm(true)}>Delete</button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function TeamPage({ staff, roles }: { staff: Staff[]; roles: Role[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <div style={{ padding: '32px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Team</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
            Manage staff accounts, roles, and their permissions
          </p>
        </div>
        <button style={btn('#C5286A')} onClick={() => setAdding(true)}>+ Add Staff Member</button>
      </div>

      {adding && (
        <div style={{ ...card, marginBottom: 24 }}>
          <AddStaffModal roles={roles} onClose={() => setAdding(false)} />
        </div>
      )}

      <RolesPanel roles={roles} />

      <div style={card}>
        {staff.length === 0 ? (
          <div style={{ padding: '60px 32px', textAlign: 'center', color: '#9ca3af' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>⬡</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>No staff members yet</div>
            <div style={{ fontSize: '0.875rem' }}>Click &quot;Add Staff Member&quot; to get started</div>
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Staff Member', 'Access', 'Status', 'Added', 'Actions'].map(h => (
                  <th scope="col" key={h} style={{
                    padding: '12px 20px', textAlign: 'left',
                    fontSize: '0.75rem', fontWeight: 600,
                    color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map(s => <StaffRow key={s.id} staff={s} roles={roles} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
