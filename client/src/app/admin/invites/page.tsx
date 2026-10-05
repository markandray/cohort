'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/use-require-auth';
import { apiFetch } from '@/lib/api-client';

interface InviteRow {
  id: string;
  role: 'TEACHER' | 'ADMIN';
  created_at: string;
  expires_at: string;
  used_at: string | null;
  redeemed_by: { id: string; name: string; email: string } | null;
  status: 'PENDING' | 'USED' | 'EXPIRED';
}

interface NewInvite {
  code: string;
  role: 'TEACHER' | 'ADMIN';
  expires_at: string;
}

const EXPIRY_OPTIONS = [
  { label: '24 hours', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '7 days', hours: 168 },
  { label: '30 days', hours: 720 },
];

export default function AdminInvitesPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const router = useRouter();

  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [role, setRole] = useState<'TEACHER' | 'ADMIN'>('TEACHER');
  const [expiresInHours, setExpiresInHours] = useState(72);
  const [isCreating, setIsCreating] = useState(false);

  const [newInvite, setNewInvite] = useState<NewInvite | null>(null);
  const [copied, setCopied] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  // Client-side gating is UX only; the API enforces ADMIN on every invite route.
  useEffect(() => {
    if (!authLoading && user && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [authLoading, user, isAdmin, router]);

  const loadInvites = useCallback(async () => {
    try {
      const res = await apiFetch('/api/invites');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load invites');
      }
      const data = await res.json();
      setInvites(data.invites);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invites');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadInvites();
  }, [isAdmin, loadInvites]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCopied(false);
    setIsCreating(true);
    try {
      const res = await apiFetch('/api/invites', {
        method: 'POST',
        body: JSON.stringify({ role, expiresInHours }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create invite');
      setNewInvite({
        code: data.invite.code,
        role: data.invite.role,
        expires_at: data.invite.expires_at,
      });
      await loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCopy() {
    if (!newInvite) return;
    try {
      await navigator.clipboard.writeText(newInvite.code);
      setCopied(true);
    } catch {
      setError('Could not copy automatically. Select the code and copy it manually.');
    }
  }

  async function handleRevoke(id: string) {
    setError(null);
    try {
      const res = await apiFetch(`/api/invites/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to revoke invite');
      }
      await loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invite');
    }
  }

  if (authLoading || !isAdmin) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Invites</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Create an invite</h2>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm gap-1">
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'TEACHER' | 'ADMIN')}
              className="border rounded px-3 py-2"
            >
              <option value="TEACHER">Teacher</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <label className="flex flex-col text-sm gap-1">
            Expires in
            <select
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(Number(e.target.value))}
              className="border rounded px-3 py-2"
            >
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.hours} value={o.hours}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={isCreating}
            className="bg-black text-white rounded px-3 py-2 disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : 'Create invite'}
          </button>
        </form>
        {role === 'ADMIN' && (
          <p className="text-sm text-amber-700">
            Admin invites grant full platform access. Share them only with someone you trust.
          </p>
        )}
      </section>

      {newInvite && (
        <section className="border border-green-300 rounded p-4 space-y-2">
          <p className="font-semibold">
            {newInvite.role === 'ADMIN' ? 'Admin' : 'Teacher'} invite created
          </p>
          <p className="text-sm text-gray-600">
            Copy this code now. It is shown only once and cannot be recovered. Expires{' '}
            {new Date(newInvite.expires_at).toLocaleString()}.
          </p>
          <code className="block border rounded px-3 py-2 break-all select-all">
            {newInvite.code}
          </code>
          <div className="flex gap-2">
            <button onClick={handleCopy} className="border rounded px-3 py-1 text-sm">
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={() => setNewInvite(null)}
              className="border rounded px-3 py-1 text-sm"
            >
              Done
            </button>
          </div>
        </section>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Recent invites</h2>
        {isLoading ? (
          <p className="text-gray-500">Loading...</p>
        ) : invites.length === 0 ? (
          <p className="text-gray-500">No invites yet.</p>
        ) : (
          <ul className="space-y-1">
            {invites.map((i) => (
              <li
                key={i.id}
                className="border rounded px-4 py-2 flex items-center justify-between gap-4"
              >
                <div className="text-sm">
                  <span className="font-medium">{i.role}</span>
                  {' · '}
                  <span
                    className={
                      i.status === 'PENDING'
                        ? 'text-green-700'
                        : i.status === 'USED'
                          ? 'text-gray-700'
                          : 'text-gray-400'
                    }
                  >
                    {i.status}
                  </span>
                  {' · '}
                  {i.status === 'USED' && i.redeemed_by
                    ? `used by ${i.redeemed_by.name} (${i.redeemed_by.email})`
                    : `${i.status === 'EXPIRED' ? 'expired' : 'expires'} ${new Date(
                        i.expires_at
                      ).toLocaleString()}`}
                </div>
                {i.status === 'PENDING' && (
                  <button
                    onClick={() => handleRevoke(i.id)}
                    className="border rounded px-3 py-1 text-sm text-red-600"
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}