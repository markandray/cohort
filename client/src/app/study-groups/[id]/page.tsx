'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { useRequireAuth } from '@/lib/use-require-auth';
import { Button, buttonStyles } from '@/components/ui/button';
import { Card, ListCard, ListRow } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/form';
import { Empty, PageContainer, PageHeader, Section } from '@/components/ui/page';

interface StudyGroupDetail {
  id: string;
  name: string;
  class_id: string;
  created_by: string;
  created_at: string;
}

interface MemberEntry {
  id: string;
  student: {
    id: string;
    name: string;
    email: string;
  };
}

type JoinStatus = 'idle' | 'submitting' | 'success' | 'already-member' | 'error';
type LeaveStatus = 'idle' | 'submitting' | 'error';
type RenameStatus = 'idle' | 'submitting' | 'success' | 'error';
type DeleteStatus = 'idle' | 'submitting' | 'error';

export default function StudyGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useRequireAuth();

  const [group, setGroup] = useState<StudyGroupDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [members, setMembers] = useState<MemberEntry[] | null>(null);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  // Bumping this re-runs the members effect (used after a successful join).
  const [membersReloadKey, setMembersReloadKey] = useState(0);

  const [joinStatus, setJoinStatus] = useState<JoinStatus>('idle');
  const [joinError, setJoinError] = useState<string | null>(null);

  const [leaveStatus, setLeaveStatus] = useState<LeaveStatus>('idle');
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const [showRenameForm, setShowRenameForm] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameFieldError, setRenameFieldError] = useState<string | null>(null);
  const [renameStatus, setRenameStatus] = useState<RenameStatus>('idle');
  const [renameError, setRenameError] = useState<string | null>(null);

  const [deleteStatus, setDeleteStatus] = useState<DeleteStatus>('idle');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isCreator = !!user && !!group && user.id === group.created_by;
  const isMember = !!user && !!members && members.some((m) => m.student.id === user.id);
  const canJoin = user?.role === 'STUDENT' && !isMember;
  const canLeave = user?.role === 'STUDENT' && isMember;

  useEffect(() => {
    if (!user) return;

    async function loadGroup() {
      try {
        const res = await apiFetch(`/api/study-groups/${id}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load study group');
        }
        const data = await res.json();
        setGroup(data.studyGroup);
        setRenameValue(data.studyGroup.name);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setIsLoading(false);
      }
    }
    loadGroup();
  }, [id, user]);

  useEffect(() => {
    if (!user) return;

    // Reloads after the first load happen silently (no loading flicker):
    // membersLoading starts true and is only ever set to false.
    async function loadMembers() {
      try {
        const res = await apiFetch(`/api/study-groups/${id}/members`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load members');
        }
        const data = await res.json();
        setMembers(data.members);
        setMembersError(null);
      } catch (err) {
        setMembersError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setMembersLoading(false);
      }
    }
    loadMembers();
  }, [id, user, membersReloadKey]);

  async function handleJoin() {
    setJoinStatus('submitting');
    setJoinError(null);
    try {
      const res = await apiFetch(`/api/study-groups/${id}/join`, { method: 'POST' });
      if (res.status === 201) {
        setJoinStatus('success');
        setMembersReloadKey((k) => k + 1);
      } else if (res.status === 409) {
        setJoinStatus('already-member');
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to join');
      }
    } catch (err) {
      setJoinStatus('error');
      setJoinError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async function handleLeave() {
    if (!group) return;
    setLeaveStatus('submitting');
    setLeaveError(null);
    try {
      const res = await apiFetch(`/api/study-groups/${id}/leave`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to leave');
      }
      router.push(`/classes/${group.class_id}`);
    } catch (err) {
      setLeaveStatus('error');
      setLeaveError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  function validateRename(): boolean {
    setRenameFieldError(null);
    if (!renameValue.trim()) {
      setRenameFieldError('Name is required');
      return false;
    }
    return true;
  }

  async function handleRename() {
    if (!validateRename()) return;

    setRenameStatus('submitting');
    setRenameError(null);
    try {
      const res = await apiFetch(`/api/study-groups/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to rename group');
      }
      const data = await res.json();
      setGroup(data.studyGroup);
      setRenameStatus('success');
      setShowRenameForm(false);
    } catch (err) {
      setRenameStatus('error');
      setRenameError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async function handleDelete() {
    if (!group) return;
    if (!window.confirm('Delete this study group? This cannot be undone.')) return;

    setDeleteStatus('submitting');
    setDeleteError(null);
    try {
      const res = await apiFetch(`/api/study-groups/${id}`, { method: 'DELETE' });
      if (res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete group');
      }
      router.push(`/classes/${group.class_id}`);
    } catch (err) {
      setDeleteStatus('error');
      setDeleteError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  if (authLoading || !user || isLoading) {
    return (
      <PageContainer width="md">
        <p className="text-muted">Loading...</p>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer width="md">
        <p role="alert" className="text-danger">
          {error}
        </p>
      </PageContainer>
    );
  }

  if (!group) {
    return null;
  }

  return (
    <PageContainer width="md">
      <PageHeader
        title={group.name}
        description={isCreator ? 'You created this group.' : undefined}
        actions={
          <Link
            href={`/classes/${group.class_id}`}
            className={buttonStyles({ variant: 'ghost', size: 'sm' })}
          >
            ← Class
          </Link>
        }
      />

      {canJoin && (
        <div className="mb-8">
          {joinStatus === 'already-member' && (
            <p className="mb-2 text-sm text-muted">You are already a member of this group.</p>
          )}
          {joinStatus === 'error' && joinError && (
            <p role="alert" className="mb-2 text-sm text-danger">
              {joinError}
            </p>
          )}
          {joinStatus !== 'success' && joinStatus !== 'already-member' && (
            <Button onClick={handleJoin} disabled={joinStatus === 'submitting'}>
              {joinStatus === 'submitting' ? 'Joining...' : 'Join group'}
            </Button>
          )}
        </div>
      )}

      {canLeave && (
        <div className="mb-8">
          {leaveStatus === 'error' && leaveError && (
            <p role="alert" className="mb-2 text-sm text-danger">
              {leaveError}
            </p>
          )}
          <Button variant="secondary" onClick={handleLeave} disabled={leaveStatus === 'submitting'}>
            {leaveStatus === 'submitting' ? 'Leaving...' : 'Leave group'}
          </Button>
        </div>
      )}

      {isCreator && (
        <div className="mb-8 flex flex-col gap-3">
          {!showRenameForm && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowRenameForm(true)}>
                Rename
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={deleteStatus === 'submitting'}
              >
                {deleteStatus === 'submitting' ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          )}

          {showRenameForm && (
            <Card className="p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRename();
                }}
                className="flex flex-col gap-4"
              >
                <Field label="Name" error={renameFieldError}>
                  <Input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                  />
                </Field>

                {renameStatus === 'error' && renameError && (
                  <p
                    role="alert"
                    className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
                  >
                    {renameError}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button type="submit" disabled={renameStatus === 'submitting'}>
                    {renameStatus === 'submitting' ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowRenameForm(false);
                      setRenameValue(group.name);
                      setRenameFieldError(null);
                      setRenameError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {deleteStatus === 'error' && deleteError && (
            <p role="alert" className="text-sm text-danger">
              {deleteError}
            </p>
          )}
        </div>
      )}

      <Section title="Members" count={members?.length}>
        {membersLoading && <p className="text-sm text-muted">Loading members...</p>}
        {membersError && (
          <p role="alert" className="text-sm text-danger">
            {membersError}
          </p>
        )}
        {!membersLoading && !membersError && members && members.length === 0 && (
          <Empty>No members yet.</Empty>
        )}
        {!membersLoading && !membersError && members && members.length > 0 && (
          <ListCard>
            {members.map((m) => (
              <ListRow key={m.id} primary={m.student.name} secondary={m.student.email} />
            ))}
          </ListCard>
        )}
      </Section>
    </PageContainer>
  );
}