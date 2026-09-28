'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useRequireAuth } from '@/lib/use-require-auth';

interface NoteListItem {
  id: string;
  title: string;
  content: string;
  class_id: string | null;
  class: { id: string; name: string } | null;
}

interface ClassOption {
  id: string;
  name: string;
}

type CreateStatus = 'idle' | 'submitting' | 'success' | 'error';

export default function NotesPage() {
  const { user, isLoading: authLoading } = useRequireAuth();

  const [notes, setNotes] = useState<NoteListItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [titleFieldError, setTitleFieldError] = useState<string | null>(null);
  const [contentFieldError, setContentFieldError] = useState<string | null>(null);
  const [createStatus, setCreateStatus] = useState<CreateStatus>('idle');
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function loadNotes() {
      try {
        const res = await apiFetch('/api/notes/me');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load notes');
        }
        const data = await res.json();
        setNotes(data.notes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setIsLoading(false);
      }
    }
    loadNotes();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    async function loadClasses() {
      try {
        const res = await apiFetch('/api/classes');
        if (!res.ok) return;
        const data = await res.json();
        setClassOptions(data.classes.map((c: any) => ({ id: c.id, name: c.name })));
      } catch {
        // Non-fatal — the create form still works without a class selector populated.
      }
    }
    loadClasses();
  }, [user]);

  function validateCreateForm(): boolean {
    let valid = true;
    setTitleFieldError(null);
    setContentFieldError(null);

    if (!title.trim()) {
      setTitleFieldError('Title is required');
      valid = false;
    }

    if (!content.trim()) {
      setContentFieldError('Content is required');
      valid = false;
    }

    return valid;
  }

  async function handleCreate() {
    if (!validateCreateForm()) return;

    setCreateStatus('submitting');
    setCreateError(null);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        content: content.trim(),
      };
      if (selectedClassId) {
        body.classId = selectedClassId;
      }

      const res = await apiFetch('/api/notes', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create note');
      }
      const data = await res.json();
      setNotes((prev) => (prev ? [data.note, ...prev] : [data.note]));
      setCreateStatus('success');
      setTitle('');
      setContent('');
      setSelectedClassId('');
      setShowCreateForm(false);
    } catch (err) {
      setCreateStatus('error');
      setCreateError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  if (authLoading || !user) {
    return <p className="text-center mt-16">Loading...</p>;
  }

  if (isLoading) {
    return <p className="text-center mt-16">Loading notes...</p>;
  }

  if (error) {
    return <p className="text-center mt-16 text-red-600">{error}</p>;
  }

  return (
    <div className="max-w-2xl mx-auto mt-16 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Notes</h1>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-black text-white rounded px-3 py-2 text-sm"
          >
            New Note
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="border rounded px-4 py-3 mb-6 flex flex-col gap-3">
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
            <label className="block text-sm font-medium mb-1">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            />
            {contentFieldError && <p className="text-red-600 text-sm mt-1">{contentFieldError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Class (optional)</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            >
              <option value="">No class</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {createStatus === 'error' && createError && (
            <p className="text-red-600 text-sm">{createError}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={createStatus === 'submitting'}
              className="bg-black text-white rounded px-3 py-2 disabled:opacity-50"
            >
              {createStatus === 'submitting' ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setTitleFieldError(null);
                setContentFieldError(null);
                setCreateError(null);
              }}
              className="border rounded px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {notes && notes.length === 0 && <p className="text-gray-500">No notes yet.</p>}
      {notes && notes.length > 0 && (
        <div className="flex flex-col gap-2">
          {notes.map((n) => (
            <Link
              key={n.id}
              href={`/notes/${n.id}`}
              className="border rounded px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <p className="font-medium">{n.title}</p>
              <p className="text-sm text-gray-500 line-clamp-2">{n.content}</p>
              {n.class && (
                <p className="text-xs text-gray-400 mt-1">{n.class.name}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}