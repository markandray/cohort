'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { useRequireAuth } from '@/lib/use-require-auth';

interface ClassDetail {
  id: string;
  name: string;
  teacher: {
    id: string;
    name: string;
  };
}

interface RosterEntry {
  id: string;
  student: {
    id: string;
    name: string;
    email: string;
  };
}

interface AssignmentListItem {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
}

interface StudyGroupListItem {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  _count: { members: number };
}

type EnrollStatus = 'idle' | 'submitting' | 'success' | 'already-enrolled' | 'error';
type CreateAssignmentStatus = 'idle' | 'submitting' | 'success' | 'error';
type CreateGroupStatus = 'idle' | 'submitting' | 'success' | 'error';

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useRequireAuth();

  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [enrollStatus, setEnrollStatus] = useState<EnrollStatus>('idle');
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);

  const [assignments, setAssignments] = useState<AssignmentListItem[] | null>(null);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [createStatus, setCreateStatus] = useState<CreateAssignmentStatus>('idle');
  const [createError, setCreateError] = useState<string | null>(null);
  const [titleFieldError, setTitleFieldError] = useState<string | null>(null);
  const [dueDateFieldError, setDueDateFieldError] = useState<string | null>(null);

  const [studyGroups, setStudyGroups] = useState<StudyGroupListItem[] | null>(null);
  const [studyGroupsLoading, setStudyGroupsLoading] = useState(false);
  const [studyGroupsError, setStudyGroupsError] = useState<string | null>(null);

  const [showCreateGroupForm, setShowCreateGroupForm] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupNameFieldError, setGroupNameFieldError] = useState<string | null>(null);
  const [createGroupStatus, setCreateGroupStatus] = useState<CreateGroupStatus>('idle');
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);

  const canViewRoster = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const canCreateAssignment = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const canCreateStudyGroup = user?.role === 'STUDENT';

  useEffect(() => {
    if (!user) return;

    async function loadClass() {
      try {
        const res = await apiFetch(`/api/classes/${id}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load class');
        }
        const data = await res.json();
        setClassData(data.class);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setIsLoading(false);
      }
    }
    loadClass();
  }, [id, user]);

  useEffect(() => {
    if (!canViewRoster) return;

    async function loadRoster() {
      setRosterLoading(true);
      setRosterError(null);
      try {
        const res = await apiFetch(`/api/classes/${id}/enrollments`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load roster');
        }
        const data = await res.json();
        setRoster(data.enrollments);
      } catch (err) {
        setRosterError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setRosterLoading(false);
      }
    }
    loadRoster();
  }, [id, canViewRoster]);

  useEffect(() => {
    if (!user) return;

    async function loadAssignments() {
      setAssignmentsLoading(true);
      setAssignmentsError(null);
      try {
        const res = await apiFetch(`/api/classes/${id}/assignments`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load assignments');
        }
        const data = await res.json();
        setAssignments(data.assignments);
      } catch (err) {
        setAssignmentsError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setAssignmentsLoading(false);
      }
    }
    loadAssignments();
  }, [id, user]);

  useEffect(() => {
    if (!user) return;

    async function loadStudyGroups() {
      setStudyGroupsLoading(true);
      setStudyGroupsError(null);
      try {
        const res = await apiFetch(`/api/classes/${id}/study-groups`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load study groups');
        }
        const data = await res.json();
        setStudyGroups(data.studyGroups);
      } catch (err) {
        setStudyGroupsError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setStudyGroupsLoading(false);
      }
    }
    loadStudyGroups();
  }, [id, user]);

  async function handleEnroll() {
    setEnrollStatus('submitting');
    setEnrollError(null);
    try {
      const res = await apiFetch(`/api/classes/${id}/enroll`, { method: 'POST' });
      if (res.status === 201) {
        setEnrollStatus('success');
      } else if (res.status === 409) {
        setEnrollStatus('already-enrolled');
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to enroll');
      }
    } catch (err) {
      setEnrollStatus('error');
      setEnrollError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  function validateCreateForm(): boolean {
    let valid = true;
    setTitleFieldError(null);
    setDueDateFieldError(null);

    if (!title.trim()) {
      setTitleFieldError('Title is required');
      valid = false;
    }

    if (!dueDate) {
      setDueDateFieldError('Due date is required');
      valid = false;
    } else if (isNaN(Date.parse(dueDate))) {
      setDueDateFieldError('Due date must be valid');
      valid = false;
    }

    return valid;
  }

  async function handleCreateAssignment() {
    if (!validateCreateForm()) return;

    setCreateStatus('submitting');
    setCreateError(null);
    try {
      const res = await apiFetch(`/api/classes/${id}/assignments`, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: new Date(dueDate).toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create assignment');
      }
      const data = await res.json();
      setAssignments((prev) => (prev ? [...prev, data.assignment] : [data.assignment]));
      setCreateStatus('success');
      setTitle('');
      setDescription('');
      setDueDate('');
      setShowCreateForm(false);
    } catch (err) {
      setCreateStatus('error');
      setCreateError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async function handleCreateStudyGroup() {
    setGroupNameFieldError(null);
    if (!groupName.trim()) {
      setGroupNameFieldError('Name is required');
      return;
    }

    setCreateGroupStatus('submitting');
    setCreateGroupError(null);
    try {
      const res = await apiFetch(`/api/classes/${id}/study-groups`, {
        method: 'POST',
        body: JSON.stringify({ name: groupName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create study group');
      }
      const data = await res.json();
      setStudyGroups((prev) =>
        prev
          ? [{ ...data.studyGroup, _count: { members: 1 } }, ...prev]
          : [{ ...data.studyGroup, _count: { members: 1 } }]
      );
      setCreateGroupStatus('success');
      setGroupName('');
      setShowCreateGroupForm(false);
    } catch (err) {
      setCreateGroupStatus('error');
      setCreateGroupError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  if (authLoading || !user) {
    return <p className="text-center mt-16">Loading...</p>;
  }

  if (isLoading) {
    return <p className="text-center mt-16">Loading class...</p>;
  }

  if (error) {
    return <p className="text-center mt-16 text-red-600">{error}</p>;
  }

  if (!classData) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto mt-16 px-4">
      <h1 className="text-xl font-semibold mb-1">{classData.name}</h1>
      <p className="text-sm text-gray-500 mb-6">Taught by {classData.teacher.name}</p>

      {user?.role === 'STUDENT' && (
        <div className="mb-8">
          {enrollStatus === 'success' && (
            <p className="text-green-600 text-sm mb-2">Enrolled successfully.</p>
          )}
          {enrollStatus === 'already-enrolled' && (
            <p className="text-sm mb-2 text-gray-600">You are already enrolled in this class.</p>
          )}
          {enrollStatus === 'error' && enrollError && (
            <p className="text-red-600 text-sm mb-2">{enrollError}</p>
          )}

          {enrollStatus !== 'success' && enrollStatus !== 'already-enrolled' && (
            <button
              onClick={handleEnroll}
              disabled={enrollStatus === 'submitting'}
              className="bg-black text-white rounded px-3 py-2 disabled:opacity-50"
            >
              {enrollStatus === 'submitting' ? 'Enrolling...' : 'Enroll'}
            </button>
          )}
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Assignments</h2>
          {canCreateAssignment && !showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-black text-white rounded px-3 py-2 text-sm"
            >
              New Assignment
            </button>
          )}
        </div>

        {canCreateAssignment && showCreateForm && (
          <div className="border rounded px-4 py-3 mb-4 flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border rounded px-3 py-2 w-full"
              />
              {titleFieldError && <p className="text-red-600 text-sm mt-1">{titleFieldError}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="border rounded px-3 py-2 w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="border rounded px-3 py-2 w-full"
              />
              {dueDateFieldError && <p className="text-red-600 text-sm mt-1">{dueDateFieldError}</p>}
            </div>

            {createStatus === 'error' && createError && (
              <p className="text-red-600 text-sm">{createError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleCreateAssignment}
                disabled={createStatus === 'submitting'}
                className="bg-black text-white rounded px-3 py-2 disabled:opacity-50"
              >
                {createStatus === 'submitting' ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setTitleFieldError(null);
                  setDueDateFieldError(null);
                  setCreateError(null);
                }}
                className="border rounded px-3 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {assignmentsLoading && <p className="text-gray-500">Loading assignments...</p>}
        {assignmentsError && <p className="text-red-600 text-sm">{assignmentsError}</p>}
        {!assignmentsLoading && !assignmentsError && assignments && assignments.length === 0 && (
          <p className="text-gray-500">No assignments yet.</p>
        )}
        {!assignmentsLoading && !assignmentsError && assignments && assignments.length > 0 && (
          <div className="flex flex-col gap-2">
            {assignments.map((a) => (
              <Link
                key={a.id}
                href={`/assignments/${a.id}`}
                className="border rounded px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <p className="font-medium">{a.title}</p>
                <p className="text-sm text-gray-500">
                  Due {new Date(a.due_date).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Study Groups</h2>
          {canCreateStudyGroup && !showCreateGroupForm && (
            <button
              onClick={() => setShowCreateGroupForm(true)}
              className="bg-black text-white rounded px-3 py-2 text-sm"
            >
              New Group
            </button>
          )}
        </div>

        {canCreateStudyGroup && showCreateGroupForm && (
          <div className="border rounded px-4 py-3 mb-4 flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="border rounded px-3 py-2 w-full"
              />
              {groupNameFieldError && (
                <p className="text-red-600 text-sm mt-1">{groupNameFieldError}</p>
              )}
            </div>

            {createGroupStatus === 'error' && createGroupError && (
              <p className="text-red-600 text-sm">{createGroupError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleCreateStudyGroup}
                disabled={createGroupStatus === 'submitting'}
                className="bg-black text-white rounded px-3 py-2 disabled:opacity-50"
              >
                {createGroupStatus === 'submitting' ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowCreateGroupForm(false);
                  setGroupNameFieldError(null);
                  setCreateGroupError(null);
                }}
                className="border rounded px-3 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {studyGroupsLoading && <p className="text-gray-500">Loading study groups...</p>}
        {studyGroupsError && <p className="text-red-600 text-sm">{studyGroupsError}</p>}
        {!studyGroupsLoading && !studyGroupsError && studyGroups && studyGroups.length === 0 && (
          <p className="text-gray-500">No study groups yet.</p>
        )}
        {!studyGroupsLoading && !studyGroupsError && studyGroups && studyGroups.length > 0 && (
          <div className="flex flex-col gap-2">
            {studyGroups.map((g) => (
              <Link
                key={g.id}
                href={`/study-groups/${g.id}`}
                className="border rounded px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <p className="font-medium">
                  {g.name}
                  {user?.id === g.created_by && (
                    <span className="text-xs text-gray-400 font-normal ml-2">
                      (you&apos;re the creator)
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-500">
                  {g._count.members} {g._count.members === 1 ? 'member' : 'members'}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {canViewRoster && (
        <div>
          <h2 className="text-lg font-medium mb-3">Enrolled Students</h2>
          {rosterLoading && <p className="text-gray-500">Loading roster...</p>}
          {rosterError && <p className="text-red-600 text-sm">{rosterError}</p>}
          {!rosterLoading && !rosterError && roster && roster.length === 0 && (
            <p className="text-gray-500">No students enrolled yet.</p>
          )}
          {!rosterLoading && !rosterError && roster && roster.length > 0 && (
            <div className="flex flex-col gap-2">
              {roster.map((entry) => (
                <div key={entry.id} className="border rounded px-4 py-2">
                  <p className="font-medium">{entry.student.name}</p>
                  <p className="text-sm text-gray-500">{entry.student.email}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}