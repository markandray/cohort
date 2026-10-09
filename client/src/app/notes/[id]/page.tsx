'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { useRequireAuth } from '@/lib/use-require-auth';
import { Button, buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { PageContainer, PageHeader } from '@/components/ui/page';

interface NoteDetail {
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

type SaveStatus = 'idle' | 'submitting' | 'success' | 'error';
type DeleteStatus = 'idle' | 'submitting' | 'error';

export default function NoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useRequireAuth();

  const [note, setNote] = useState<NoteDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');

  // Dirty flags: only send a field in the PATCH body if the user actually
  // touched it. The class selector needs its own flag rather than a
  // value-diff check, since "no class" (empty string) is itself a valid,
  // distinct target state (classId: null) separate from "untouched".
  const [titleDirty, setTitleDirty] = useState(false);
  const [contentDirty, setContentDirty] = useState(false);
  const [classDirty, setClassDirty] = useState(false);

  const [titleFieldError, setTitleFieldError] = useState<string | null>(null);
  const [contentFieldError, setContentFieldError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleteStatus, setDeleteStatus] = useState<DeleteStatus>('idle');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function loadNote() {
      try {
        const res = await apiFetch(`/api/notes/${id}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load note');
        }
        const data = await res.json();
        setNote(data.note);
        setTitle(data.note.title);
        setContent(data.note.content);
        setSelectedClassId(data.note.class_id ?? '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setIsLoading(false);
      }
    }
    loadNote();
  }, [id, user]);

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
        // Non-fatal: the class selector just stays empty of options.
      }
    }
    loadClasses();
  }, [user]);

  function validateForm(): boolean {
    let valid = true;
    setTitleFieldError(null);
    setContentFieldError(null);

    if (titleDirty && !title.trim()) {
      setTitleFieldError('Title cannot be empty');
      valid = false;
    }

    if (contentDirty && !content.trim()) {
      setContentFieldError('Content cannot be empty');
      valid = false;
    }

    return valid;
  }

  async function handleSave() {
    if (!validateForm()) return;

    if (!titleDirty && !contentDirty && !classDirty) {
      // Nothing changed, nothing to send.
      return;
    }

    setSaveStatus('submitting');
    setSaveError(null);
    try {
      const body: Record<string, unknown> = {};
      if (titleDirty) body.title = title.trim();
      if (contentDirty) body.content = content.trim();
      if (classDirty) body.classId = selectedClassId ? selectedClassId : null;

      const res = await apiFetch(`/api/notes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save note');
      }
      const data = await res.json();
      setNote(data.note);
      setTitle(data.note.title);
      setContent(data.note.content);
      setSelectedClassId(data.note.class_id ?? '');
      setTitleDirty(false);
      setContentDirty(false);
      setClassDirty(false);
      setSaveStatus('success');
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this note? This cannot be undone.')) return;

    setDeleteStatus('submitting');
    setDeleteError(null);
    try {
      const res = await apiFetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete note');
      }
      router.push('/notes');
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

  if (!note) {
    return null;
  }

  return (
    <PageContainer width="md">
      <PageHeader
        title="Edit note"
        actions={
          <Link href="/notes" className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
            ← Notes
          </Link>
        }
      />

      <Card className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Title" error={titleFieldError}>
            <Input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleDirty(true);
              }}
            />
          </Field>

          <Field label="Content" error={contentFieldError}>
            <Textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setContentDirty(true);
              }}
            />
          </Field>

          <Field label="Class (optional)">
            <Select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setClassDirty(true);
              }}
            >
              <option value="">No class</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          {saveStatus === 'success' && <p className="text-sm text-success">Saved.</p>}
          {saveStatus === 'error' && saveError && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {saveError}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={saveStatus === 'submitting'}>
              {saveStatus === 'submitting' ? 'Saving...' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              disabled={deleteStatus === 'submitting'}
            >
              {deleteStatus === 'submitting' ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
          {deleteStatus === 'error' && deleteError && (
            <p role="alert" className="text-sm text-danger">
              {deleteError}
            </p>
          )}
        </form>
      </Card>
    </PageContainer>
  );
}