'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { useRequireAuth } from '@/lib/use-require-auth';
import { Button, buttonStyles } from '@/components/ui/button';
import { Badge, Card, ListCard, ListRow } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Empty, PageContainer, PageHeader, Section } from '@/components/ui/page';

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

  // The three list loaders below start in the loading state and only ever flip to
  // "done", so their effects never call setState synchronously.
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [rosterError, setRosterError] = useState<string | null>(null);

  const [assignments, setAssignments] = useState<AssignmentListItem[] | null>(null);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
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
  const [studyGroupsLoading, setStudyGroupsLoading] = useState(true);
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
      try {
        const res = await apiFetch(`/api/classes/${id}/enrollments`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load roster');
        }
        const data = await res.json();
        setRoster(data.enrollments);
        setRosterError(null);
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
      try {
        const res = await apiFetch(`/api/classes/${id}/assignments`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load assignments');
        }
        const data = await res.json();
        setAssignments(data.assignments);
        setAssignmentsError(null);
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
      try {
        const res = await apiFetch(`/api/classes/${id}/study-groups`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load study groups');
        }
        const data = await res.json();
        setStudyGroups(data.studyGroups);
        setStudyGroupsError(null);
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

  if (!classData) {
    return null;
  }

  return (
    <PageContainer width="md">
      <PageHeader
        title={classData.name}
        description={`Taught by ${classData.teacher.name}`}
        actions={
          <Link href="/classes" className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
            ← Classes
          </Link>
        }
      />

      <div className="space-y-8">
        {user.role === 'STUDENT' && (
          <div>
            {enrollStatus === 'success' && (
              <p className="mb-2 text-sm text-success">Enrolled successfully.</p>
            )}
            {enrollStatus === 'already-enrolled' && (
              <p className="mb-2 text-sm text-muted">You are already enrolled in this class.</p>
            )}
            {enrollStatus === 'error' && enrollError && (
              <p role="alert" className="mb-2 text-sm text-danger">
                {enrollError}
              </p>
            )}

            {enrollStatus !== 'success' && enrollStatus !== 'already-enrolled' && (
              <Button onClick={handleEnroll} disabled={enrollStatus === 'submitting'}>
                {enrollStatus === 'submitting' ? 'Enrolling...' : 'Enroll'}
              </Button>
            )}
          </div>
        )}

        <Section
          title="Assignments"
          count={assignments?.length}
          actions={
            canCreateAssignment && !showCreateForm ? (
              <Button size="sm" onClick={() => setShowCreateForm(true)}>
                New assignment
              </Button>
            ) : undefined
          }
        >
          {canCreateAssignment && showCreateForm && (
            <Card className="mb-4 p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateAssignment();
                }}
                className="flex flex-col gap-4"
              >
                <Field label="Title" error={titleFieldError}>
                  <Input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
                </Field>

                <Field label="Description (optional)">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Field>

                <Field label="Due date" error={dueDateFieldError}>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </Field>

                {createStatus === 'error' && createError && (
                  <p
                    role="alert"
                    className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
                  >
                    {createError}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button type="submit" disabled={createStatus === 'submitting'}>
                    {createStatus === 'submitting' ? 'Creating...' : 'Create'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowCreateForm(false);
                      setTitleFieldError(null);
                      setDueDateFieldError(null);
                      setCreateError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {assignmentsLoading && <p className="text-sm text-muted">Loading assignments...</p>}
          {assignmentsError && (
            <p role="alert" className="text-sm text-danger">
              {assignmentsError}
            </p>
          )}
          {!assignmentsLoading && !assignmentsError && assignments && assignments.length === 0 && (
            <Empty>No assignments yet.</Empty>
          )}
          {!assignmentsLoading && !assignmentsError && assignments && assignments.length > 0 && (
            <ListCard>
              {assignments.map((a) => (
                <ListRow
                  key={a.id}
                  href={`/assignments/${a.id}`}
                  primary={a.title}
                  secondary={a.description}
                  trailing={<Badge>Due {new Date(a.due_date).toLocaleDateString()}</Badge>}
                />
              ))}
            </ListCard>
          )}
        </Section>

        <Section
          title="Study groups"
          count={studyGroups?.length}
          actions={
            canCreateStudyGroup && !showCreateGroupForm ? (
              <Button size="sm" onClick={() => setShowCreateGroupForm(true)}>
                New group
              </Button>
            ) : undefined
          }
        >
          {canCreateStudyGroup && showCreateGroupForm && (
            <Card className="mb-4 p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateStudyGroup();
                }}
                className="flex flex-col gap-4"
              >
                <Field label="Name" error={groupNameFieldError}>
                  <Input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </Field>

                {createGroupStatus === 'error' && createGroupError && (
                  <p
                    role="alert"
                    className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
                  >
                    {createGroupError}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button type="submit" disabled={createGroupStatus === 'submitting'}>
                    {createGroupStatus === 'submitting' ? 'Creating...' : 'Create'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowCreateGroupForm(false);
                      setGroupNameFieldError(null);
                      setCreateGroupError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {studyGroupsLoading && <p className="text-sm text-muted">Loading study groups...</p>}
          {studyGroupsError && (
            <p role="alert" className="text-sm text-danger">
              {studyGroupsError}
            </p>
          )}
          {!studyGroupsLoading && !studyGroupsError && studyGroups && studyGroups.length === 0 && (
            <Empty>No study groups yet.</Empty>
          )}
          {!studyGroupsLoading && !studyGroupsError && studyGroups && studyGroups.length > 0 && (
            <ListCard>
              {studyGroups.map((g) => (
                <ListRow
                  key={g.id}
                  href={`/study-groups/${g.id}`}
                  primary={g.name}
                  secondary={`${g._count.members} ${g._count.members === 1 ? 'member' : 'members'}`}
                  trailing={user.id === g.created_by ? <Badge tone="accent">Creator</Badge> : undefined}
                />
              ))}
            </ListCard>
          )}
        </Section>

        {canViewRoster && (
          <Section title="Enrolled students" count={roster?.length}>
            {rosterLoading && <p className="text-sm text-muted">Loading roster...</p>}
            {rosterError && (
              <p role="alert" className="text-sm text-danger">
                {rosterError}
              </p>
            )}
            {!rosterLoading && !rosterError && roster && roster.length === 0 && (
              <Empty>No students enrolled yet.</Empty>
            )}
            {!rosterLoading && !rosterError && roster && roster.length > 0 && (
              <ListCard>
                {roster.map((entry) => (
                  <ListRow
                    key={entry.id}
                    primary={entry.student.name}
                    secondary={entry.student.email}
                  />
                ))}
              </ListCard>
            )}
          </Section>
        )}
      </div>
    </PageContainer>
  );
}