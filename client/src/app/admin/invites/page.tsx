'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/use-require-auth';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge, Card, ListCard, ListRow } from '@/components/ui/card';
import { Field, Select } from '@/components/ui/form';
import { Empty, PageContainer, PageHeader, Section } from '@/components/ui/page';

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

const STATUS_TONE = {
  PENDING: 'success',
  USED: 'neutral',
  EXPIRED: 'warning',
} as const;

export default function AdminInvitesPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const router = useRouter();

  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bumping this re-runs the loading effect (after create or revoke).
  const [reloadKey, setReloadKey] = useState(0);

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

  useEffect(() => {
    if (!isAdmin) return;

    async function loadInvites() {
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
    }

    loadInvites();
  }, [isAdmin, reloadKey]);

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
      setReloadKey((k) => k + 1);
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
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invite');
    }
  }

  if (authLoading || !isAdmin) {
    return (
      <PageContainer width="md">
        <p className="text-muted">Loading...</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer width="md">
      <PageHeader
        title="Invites"
        description="Invite codes are how teacher and admin accounts are created."
      />

      <div className="space-y-8">
        <Section title="Create an invite">
          <Card className="p-4">
            <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-4">
              <div className="w-40">
                <Field label="Role">
                  <Select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'TEACHER' | 'ADMIN')}
                  >
                    <option value="TEACHER">Teacher</option>
                    <option value="ADMIN">Admin</option>
                  </Select>
                </Field>
              </div>
              <div className="w-40">
                <Field label="Expires in">
                  <Select
                    value={expiresInHours}
                    onChange={(e) => setExpiresInHours(Number(e.target.value))}
                  >
                    {EXPIRY_OPTIONS.map((o) => (
                      <option key={o.hours} value={o.hours}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create invite'}
              </Button>
            </form>
            {role === 'ADMIN' && (
              <p className="mt-3 text-sm text-warning">
                Admin invites grant full platform access. Share them only with someone you trust.
              </p>
            )}
          </Card>
        </Section>

        {newInvite && (
          <Card className="border-success/40 bg-success-soft p-4">
            <p className="text-sm font-semibold">
              {newInvite.role === 'ADMIN' ? 'Admin' : 'Teacher'} invite created
            </p>
            <p className="mt-1 text-sm text-muted">
              Copy this code now. It is shown only once and cannot be recovered. Expires{' '}
              {new Date(newInvite.expires_at).toLocaleString()}.
            </p>
            <code className="mt-3 block select-all break-all rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm">
              {newInvite.code}
            </code>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" size="sm" onClick={handleCopy}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setNewInvite(null)}>
                Done
              </Button>
            </div>
          </Card>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <Section title="Recent invites" count={isLoading ? undefined : invites.length}>
          {isLoading ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : invites.length === 0 ? (
            <Empty>No invites yet.</Empty>
          ) : (
            <ListCard>
              {invites.map((i) => (
                <ListRow
                  key={i.id}
                  primary={
                    <span className="flex items-center gap-2">
                      <Badge tone={i.role === 'ADMIN' ? 'accent' : 'neutral'}>{i.role}</Badge>
                      <Badge tone={STATUS_TONE[i.status]}>{i.status}</Badge>
                    </span>
                  }
                  secondary={
                    i.status === 'USED' && i.redeemed_by
                      ? `Used by ${i.redeemed_by.name} (${i.redeemed_by.email})`
                      : `${i.status === 'EXPIRED' ? 'Expired' : 'Expires'} ${new Date(
                          i.expires_at
                        ).toLocaleString()}`
                  }
                  trailing={
                    i.status === 'PENDING' ? (
                      <Button variant="danger" size="sm" onClick={() => handleRevoke(i.id)}>
                        Revoke
                      </Button>
                    ) : undefined
                  }
                />
              ))}
            </ListCard>
          )}
        </Section>
      </div>
    </PageContainer>
  );
}