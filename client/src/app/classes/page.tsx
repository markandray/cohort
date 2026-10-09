'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useRequireAuth } from '@/lib/use-require-auth';
import { Button } from '@/components/ui/button';
import { Card, ListCard, ListRow } from '@/components/ui/card';
import { Input } from '@/components/ui/form';
import { Empty, PageContainer, PageHeader } from '@/components/ui/page';

interface ClassListItem {
  id: string;
  name: string;
  teacher: {
    id: string;
    name: string;
  };
}

type JoinStatus = 'idle' | 'submitting' | 'success' | 'error';

export default function ClassesPage() {
  const { user, isLoading: authLoading } = useRequireAuth();

  const [classes, setClasses] = useState<ClassListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [classCode, setClassCode] = useState('');
  const [joinStatus, setJoinStatus] = useState<JoinStatus>('idle');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinFieldError, setJoinFieldError] = useState<string | null>(null);
  const [joinedClassName, setJoinedClassName] = useState<string | null>(null);

  const isStudent = user?.role === 'STUDENT';

  // Bumping this re-runs the loading effect (used after a successful join).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) return;

    async function loadClasses() {
      try {
        const res = await apiFetch('/api/classes');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load classes');
        }
        const data = await res.json();
        setClasses(data.classes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setIsLoading(false);
      }
    }

    loadClasses();
  }, [user, reloadKey]);

  async function handleJoin() {
    setJoinFieldError(null);
    const trimmed = classCode.trim();
    if (!trimmed) {
      setJoinFieldError('Enter a class code');
      return;
    }

    setJoinStatus('submitting');
    setJoinError(null);
    try {
      const res = await apiFetch('/api/classes/join', {
        method: 'POST',
        body: JSON.stringify({ classCode: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 404) {
          throw new Error(data.error || 'Invalid class code');
        }
        if (res.status === 409) {
          throw new Error(data.error || 'Already enrolled in this class');
        }
        throw new Error(data.error || 'Failed to join class');
      }
      const data = await res.json();
      setJoinedClassName(data.class?.name ?? null);
      setJoinStatus('success');
      setClassCode('');
      setReloadKey((k) => k + 1);
    } catch (err) {
      setJoinStatus('error');
      setJoinError(err instanceof Error ? err.message : 'Something went wrong');
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

  return (
    <PageContainer width="md">
      <PageHeader
        title="Classes"
        description={isStudent ? 'Classes you are enrolled in.' : undefined}
      />

      {isStudent && (
        <Card className="mb-8 p-4">
          <h2 className="text-sm font-semibold">Join a class</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleJoin();
            }}
            className="mt-3 flex gap-2"
          >
            <Input
              type="text"
              value={classCode}
              onChange={(e) => setClassCode(e.target.value)}
              placeholder="Enter class code"
              aria-label="Class code"
              autoComplete="off"
              className="flex-1 uppercase"
            />
            <Button type="submit" disabled={joinStatus === 'submitting'}>
              {joinStatus === 'submitting' ? 'Joining...' : 'Join'}
            </Button>
          </form>
          {joinFieldError && <p className="mt-2 text-sm text-danger">{joinFieldError}</p>}
          {joinStatus === 'error' && joinError && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {joinError}
            </p>
          )}
          {joinStatus === 'success' && (
            <p className="mt-2 text-sm text-success">
              Joined {joinedClassName ?? 'the class'} successfully.
            </p>
          )}
        </Card>
      )}

      {classes.length === 0 ? (
        <Empty>
          {isStudent
            ? 'You are not enrolled in any classes yet. Enter a class code above to join one.'
            : 'No classes yet.'}
        </Empty>
      ) : (
        <ListCard>
          {classes.map((c) => (
            <ListRow
              key={c.id}
              href={`/classes/${c.id}`}
              primary={c.name}
              secondary={`Taught by ${c.teacher.name}`}
              trailing={<span className="text-muted">,</span>}
            />
          ))}
        </ListCard>
      )}
    </PageContainer>
  );
}