'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useRequireAuth } from '@/lib/use-require-auth';
import { Button } from '@/components/ui/button';
import { Badge, Card, ListCard, ListRow } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Empty, PageContainer, PageHeader } from '@/components/ui/page';

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
        setClassOptions(
          (data.classes as ClassOption[]).map((c) => ({ id: c.id, name: c.name }))
        );
      } catch {
        // Non-fatal: the create form still works without a class selector populated.
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
        title="Notes"
        description="Your personal notes, optionally tied to a class."
        actions={
          !showCreateForm ? (
            <Button size="sm" onClick={() => setShowCreateForm(true)}>
              New note
            </Button>
          ) : undefined
        }
      />

      {showCreateForm && (
        <Card className="mb-8 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreate();
            }}
            className="flex flex-col gap-4"
          >
            <Field label="Title" error={titleFieldError}>
              <Input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>

            <Field label="Content" error={contentFieldError}>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} />
            </Field>

            <Field label="Class (optional)">
              <Select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
                <option value="">No class</option>
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            {createStatus === 'error' && createError && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
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
                  setContentFieldError(null);
                  setCreateError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {notes && notes.length === 0 && <Empty>No notes yet. Create your first one above.</Empty>}
      {notes && notes.length > 0 && (
        <ListCard>
          {notes.map((n) => (
            <ListRow
              key={n.id}
              href={`/notes/${n.id}`}
              primary={n.title}
              secondary={n.content}
              trailing={n.class ? <Badge>{n.class.name}</Badge> : undefined}
            />
          ))}
        </ListCard>
      )}
    </PageContainer>
  );
}