'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useRequireAuth } from '@/lib/use-require-auth';

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

  useEffect(() => {
    if (!user) return;
    loadClasses();
  }, [user]);

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
      await loadClasses();
    } catch (err) {
      setJoinStatus('error');
      setJoinError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  if (authLoading || !user) {
    return <p className="text-center mt-16">Loading...</p>;
  }

  if (isLoading) {
    return <p className="text-center mt-16">Loading classes...</p>;
  }

  if (error) {
    return <p className="text-center mt-16 text-red-600">{error}</p>;
  }

  return (
    <div className="max-w-2xl mx-auto mt-16 px-4">
      <h1 className="text-xl font-semibold mb-6">Classes</h1>

      {isStudent && (
        <div className="mb-8">
          <h2 className="text-lg font-medium mb-3">Join a Class</h2>
          <div className="border rounded px-4 py-3 flex flex-col gap-3">
            {joinStatus === 'success' && (
              <p className="text-green-600 text-sm">
                Joined {joinedClassName ?? 'the class'} successfully.
              </p>
            )}
            {joinStatus === 'error' && joinError && (
              <p className="text-red-600 text-sm">{joinError}</p>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value)}
                placeholder="Enter class code"
                className="border rounded px-3 py-2 flex-1 uppercase"
              />
              <button
                onClick={handleJoin}
                disabled={joinStatus === 'submitting'}
                className="bg-black text-white rounded px-3 py-2 disabled:opacity-50"
              >
                {joinStatus === 'submitting' ? 'Joining...' : 'Join'}
              </button>
            </div>
            {joinFieldError && <p className="text-red-600 text-sm">{joinFieldError}</p>}
          </div>
        </div>
      )}

      {classes.length === 0 ? (
        <p className="text-gray-500">No classes yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {classes.map((c) => (
            <Link
              key={c.id}
              href={`/classes/${c.id}`}
              className="border rounded px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-gray-500">Taught by {c.teacher.name}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}