'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { useRequireAuth } from '@/lib/use-require-auth';

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
    loadMembers();
  }, [id, user]);

  async function loadMembers() {
    setMembersLoading(true);
    setMembersError(null);
    try {
      const res = await apiFetch(`/api/study-groups/${id}/members`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load members');
      }
      const data = await res.json();
      setMembers(data.members);
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setMembersLoading(false);
    }
  }

  async function handleJoin() {
    setJoinStatus('submitting');
    setJoinError(null);
    try {
      const res = await apiFetch(`/api/study-groups/${id}/join`, { method: 'POST' });
      if (res.status === 201) {
        setJoinStatus('success');
        await loadMembers();
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

  if (authLoading || !user) {
    return <p className="text-center mt-16">Loading...</p>;
  }

  if (isLoading) {
    return <p className="text-center mt-16">Loading study group...</p>;
  }

  if (error) {
    return <p className="text-center mt-16 text-red-600">{error}</p>;
  }

  if (!group) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto mt-16 px-4">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold">{group.name}</h1>
      </div>
      {isCreator && <p className="text-sm text-gray-500 mb-6">You created this group.</p>}
      {!isCreator && <div className="mb-6" />}

      {canJoin && (
        <div className="mb-8">
          {joinStatus === 'already-member' && (
            <p className="text-sm mb-2 text-gray-600">You are already a member of this group.</p>
          )}
          {joinStatus === 'error' && joinError && (
            <p className="text-red-600 text-sm mb-2">{joinError}</p>
          )}
          {joinStatus !== 'success' && joinStatus !== 'already-member' && (
            <button
              onClick={handleJoin}
              disabled={joinStatus === 'submitting'}
              className="bg-black text-white rounded px-3 py-2 disabled:opacity-50"
            >
              {joinStatus === 'submitting' ? 'Joining...' : 'Join'}
            </button>
          )}
        </div>
      )}

      {canLeave && (
        <div className="mb-8">
          {leaveStatus === 'error' && leaveError && (
            <p className="text-red-600 text-sm mb-2">{leaveError}</p>
          )}
          <button
            onClick={handleLeave}
            disabled={leaveStatus === 'submitting'}
            className="border rounded px-3 py-2 disabled:opacity-50"
          >
            {leaveStatus === 'submitting' ? 'Leaving...' : 'Leave'}
          </button>
        </div>
      )}

      {isCreator && (
        <div className="mb-8 flex flex-col gap-3">
          {!showRenameForm && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowRenameForm(true)}
                className="border rounded px-3 py-2"
              >
                Rename
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteStatus === 'submitting'}
                className="border border-red-600 text-red-600 rounded px-3 py-2 disabled:opacity-50"
              >
                {deleteStatus === 'submitting' ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )}

          {showRenameForm && (
            <div className="border rounded px-4 py-3 flex flex-col gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="border rounded px-3 py-2 w-full"
                />
                {renameFieldError && (
                  <p className="text-red-600 text-sm mt-1">{renameFieldError}</p>
                )}
              </div>

              {renameStatus === 'error' && renameError && (
                <p className="text-red-600 text-sm">{renameError}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleRename}
                  disabled={renameStatus === 'submitting'}
                  className="bg-black text-white rounded px-3 py-2 disabled:opacity-50"
                >
                  {renameStatus === 'submitting' ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setShowRenameForm(false);
                    setRenameValue(group.name);
                    setRenameFieldError(null);
                    setRenameError(null);
                  }}
                  className="border rounded px-3 py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {deleteStatus === 'error' && deleteError && (
            <p className="text-red-600 text-sm">{deleteError}</p>
          )}
        </div>
      )}

      <div>
        <h2 className="text-lg font-medium mb-3">Members</h2>
        {membersLoading && <p className="text-gray-500">Loading members...</p>}
        {membersError && <p className="text-red-600 text-sm">{membersError}</p>}
        {!membersLoading && !membersError && members && members.length === 0 && (
          <p className="text-gray-500">No members yet.</p>
        )}
        {!membersLoading && !membersError && members && members.length > 0 && (
          <div className="flex flex-col gap-2">
            {members.map((m) => (
              <div key={m.id} className="border rounded px-4 py-2">
                <p className="font-medium">{m.student.name}</p>
                <p className="text-sm text-gray-500">{m.student.email}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}