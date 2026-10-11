import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus, ShieldCheck, Copy, Trash2, Ban, CheckCircle, Crown } from 'lucide-react';
import userService, { PERMISSION_OPTIONS } from '../../services/userService.js';
import { useAdminAccess } from '../../hooks/useAdminAccess.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import LoadingSpinner from '../../components/LoadingSpinner.jsx';

const KIND_LABEL = { owner: 'Owner', delegated: 'Delegated', legacy_admin: 'Admin (full blog access)' };

const PermissionBoxes = ({ value, onChange, disabled }) => (
  <div className="flex flex-wrap gap-x-4 gap-y-2">
    {PERMISSION_OPTIONS.map((p) => (
      <label key={p.code} title={p.hint} className="inline-flex items-center gap-1.5 text-xs text-slate-700">
        <input
          type="checkbox"
          disabled={disabled}
          checked={value.includes(p.code)}
          onChange={(e) =>
            onChange(e.target.checked ? [...new Set([...value, p.code])] : value.filter((c) => c !== p.code))
          }
          className="h-4 w-4 rounded text-indigo-600"
        />
        {p.label} <span className="text-slate-400">({p.code})</span>
      </label>
    ))}
  </div>
);

export const AdminUsersPage = () => {
  const { isOwner, loaded, adminId } = useAdminAccess();
  const [users, setUsers] = useState([]);
  const [ownerCount, setOwnerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [setupLink, setSetupLink] = useState('');
  const [drafts, setDrafts] = useState({}); // id -> edited permission list
  const [form, setForm] = useState({ email: '', name: '', permissions: ['BLOG_READ'] });
  const [busy, setBusy] = useState(false);
  const [toRemove, setToRemove] = useState(null);
  const [ownerChange, setOwnerChange] = useState(null); // { user, makeOwner }

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await userService.list();
      setUsers(data.users || []);
      setOwnerCount((data.owner_count || 0) + (data.bootstrap_owner_count || 0));
      setDrafts({});
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOwner) load();
    else if (loaded) setLoading(false);
  }, [isOwner, loaded, load]);

  const run = async (fn, okMessage) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await fn();
      if (okMessage) setNotice(okMessage);
      if (result?.warning) setNotice(`${okMessage || 'Done'} Note: ${result.warning}`);
      await load();
      return result;
    } catch (err) {
      setError(err.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSetupLink('');
    const result = await run(
      () => userService.create({ email: form.email, name: form.name, permissions: form.permissions }),
      'Account created in Firebase.'
    );
    if (result) {
      setSetupLink(result.password_setup_link || '');
      setForm({ email: '', name: '', permissions: ['BLOG_READ'] });
    }
  };

  if (loaded && !isOwner) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
        <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <h2 className="font-bold text-slate-800">Owner only</h2>
        <p className="text-sm text-slate-500 mt-1">Only the project owner can manage users and permissions.</p>
      </div>
    );
  }
  if (loading) return <LoadingSpinner message="Loading users..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Manage Users</h1>
        <p className="text-sm text-slate-500 mt-1">
          Create delegated admin accounts and choose exactly what each one may do. Permissions are saved in the
          database and enforced by the server on every request.
        </p>
      </div>

      <p className="text-xs text-slate-500">
        Owners can manage users, owner status and permissions. Current owners: <strong>{ownerCount}</strong>. The last
        owner cannot be removed, and owners defined in the server configuration (OWNER_FIREBASE_UID) cannot be changed here.
      </p>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">{error}</div>}
      {notice && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl p-4">{notice}</div>}
      {setupLink && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm space-y-2">
          <p className="font-semibold text-indigo-900">
            Send this one-time password-setup link to the new user (shown only now; the user chooses their own password):
          </p>
          <div className="flex items-center gap-2">
            <input readOnly value={setupLink} className="flex-1 text-xs font-mono bg-white border border-indigo-200 rounded-lg px-3 py-2" />
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(setupLink)}
              className="inline-flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg"
            >
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleCreate} className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-indigo-600" /> Add delegated admin
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            type="email"
            required
            placeholder="Email (e.g. editor1@example.com)"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Display name (optional)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
        </div>
        <PermissionBoxes value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} disabled={busy} />
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
        >
          Create account
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs divide-y divide-slate-100">
        {users.length === 0 && <p className="p-6 text-sm text-slate-500">No admin accounts found.</p>}
        {users.map((u) => {
          const isOwnerRow = u.is_owner;
          const locked = u.is_bootstrap_owner; // defined by server configuration
          const isSelf = adminId !== null && u.id === adminId;
          const draft = drafts[u.id] ?? u.permissions;
          const dirty = drafts[u.id] !== undefined && drafts[u.id].join() !== u.permissions.join();
          return (
            <div key={u.id} className="p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {u.name || u.email}{' '}
                    <span className="ml-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {KIND_LABEL[u.kind]}
                    </span>
                    {!u.is_active && (
                      <span className="ml-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">Disabled</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </div>
                {!locked && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setOwnerChange({ user: u, makeOwner: !isOwnerRow })}
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-indigo-200 text-xs font-semibold rounded-lg text-indigo-700 hover:bg-indigo-50"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      {isOwnerRow ? 'Remove owner' : 'Make owner'}
                    </button>
                    {!isSelf && (<>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => userService.setActive(u.id, !u.is_active), u.is_active ? 'Account disabled.' : 'Account enabled.')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-50"
                    >
                      {u.is_active ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      {u.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setToRemove(u)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-200 text-xs font-semibold rounded-lg text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                    </>)}
                  </div>
                )}
              </div>
              {locked ? (
                <p className="text-xs text-slate-500">Owner defined in the server configuration: full access, cannot be changed here.</p>
              ) : isOwnerRow ? (
                <p className="text-xs text-slate-500">Owners have full access to everything. Remove owner status to assign limited permissions.</p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <PermissionBoxes value={draft} onChange={(p) => setDrafts({ ...drafts, [u.id]: p })} disabled={busy} />
                  <button
                    type="button"
                    disabled={busy || !dirty}
                    onClick={() => run(() => userService.setPermissions(u.id, draft), 'Permissions saved.')}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg disabled:opacity-40"
                  >
                    Save permissions
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmModal
        isOpen={!!ownerChange}
        title={ownerChange?.makeOwner ? 'Make owner' : 'Remove owner status'}
        message={
          ownerChange?.makeOwner
            ? `Make ${ownerChange?.user.email ?? ''} an owner? Owners have full access, including managing users and other owners.`
            : `Remove owner status from ${ownerChange?.user.email ?? ''}? ${
                ownerChange?.user.id === adminId ? 'This is YOUR account: you will lose access to Manage Users. ' : ''
              }They keep their account but lose owner access.`
        }
        confirmLabel={ownerChange?.makeOwner ? 'Make owner' : 'Remove owner'}
        isDestructive={!ownerChange?.makeOwner}
        onConfirm={async () => {
          const { user, makeOwner } = ownerChange;
          setOwnerChange(null);
          await run(() => userService.setOwner(user.id, makeOwner), makeOwner ? 'Owner status granted.' : 'Owner status removed.');
        }}
        onCancel={() => setOwnerChange(null)}
      />

      <ConfirmModal
        isOpen={!!toRemove}
        title="Remove admin account"
        message={`Remove ${toRemove?.email ?? ''}? They lose all access immediately.`}
        confirmLabel="Remove"
        onConfirm={async () => {
          const target = toRemove;
          setToRemove(null);
          await run(() => userService.remove(target.id), 'Account removed.');
        }}
        onCancel={() => setToRemove(null)}
      />
    </div>
  );
};

export default AdminUsersPage;
