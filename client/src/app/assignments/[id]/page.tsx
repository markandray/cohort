'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { useRequireAuth } from '@/lib/use-require-auth';
import { Button, buttonStyles } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Empty, PageContainer, PageHeader, Section } from '@/components/ui/page';

interface AssignmentDetail {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  class_id: string;
}

interface SubmissionEntry {
  id: string;
  content: string | null;
  file_url: string | null;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
  student: {
    id: string;
    name: string;
    email: string;
  };
}

interface MySubmissionEntry {
  id: string;
  content: string | null;
  file_url: string | null;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
  assignment: {
    id: string;
    title: string;
    due_date: string;
    class_id: string;
  };
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'already-submitted' | 'error';
type ResubmitStatus = 'idle' | 'submitting' | 'success' | 'error';
type GradeStatus = 'idle' | 'submitting' | 'success' | 'error';

const linkStyles = 'break-all text-sm text-accent hover:underline';

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useRequireAuth();

  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // These two loaders start in the loading state and only ever flip to "done", so
  // their effects never call setState synchronously. Each is only rendered for
  // the role that triggers it.
  // Existing submission (pre-check): null means "checked, none exists yet".
  const [mySubmission, setMySubmission] = useState<MySubmissionEntry | null>(null);
  const [mySubmissionLoading, setMySubmissionLoading] = useState(true);
  const [mySubmissionError, setMySubmissionError] = useState<string | null>(null);

  // First-time submit (no existing submission).
  const [content, setContent] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitFieldError, setSubmitFieldError] = useState<string | null>(null);

  // Resubmit form: separate state, pre-filled from mySubmission when loaded.
  const [showResubmitForm, setShowResubmitForm] = useState(false);
  const [resubmitContent, setResubmitContent] = useState('');
  const [resubmitFileUrl, setResubmitFileUrl] = useState('');
  const [resubmitStatus, setResubmitStatus] = useState<ResubmitStatus>('idle');
  const [resubmitError, setResubmitError] = useState<string | null>(null);
  const [resubmitFieldError, setResubmitFieldError] = useState<string | null>(null);

  const [submissions, setSubmissions] = useState<SubmissionEntry[] | null>(null);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);

  // Grading form: one row open at a time, same convention as resubmit.
  const [gradingSubmissionId, setGradingSubmissionId] = useState<string | null>(null);
  const [gradeInput, setGradeInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [gradeStatus, setGradeStatus] = useState<GradeStatus>('idle');
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [gradeFieldError, setGradeFieldError] = useState<string | null>(null);

  const isStudent = user?.role === 'STUDENT';
  const canViewSubmissions = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  useEffect(() => {
    if (!user) return;

    async function loadAssignment() {
      try {
        const res = await apiFetch(`/api/assignments/${id}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load assignment');
        }
        const data = await res.json();
        setAssignment(data.assignment);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setIsLoading(false);
      }
    }
    loadAssignment();
  }, [id, user]);

  useEffect(() => {
    if (!isStudent) return;

    async function loadMySubmission() {
      try {
        const res = await apiFetch('/api/submissions/me');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load your submission');
        }
        const data = await res.json();
        const existing = (data.submissions as MySubmissionEntry[]).find(
          (s) => s.assignment.id === id
        );
        setMySubmission(existing ?? null);
        if (existing) {
          setResubmitContent(existing.content ?? '');
          setResubmitFileUrl(existing.file_url ?? '');
        }
        setMySubmissionError(null);
      } catch (err) {
        setMySubmissionError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setMySubmissionLoading(false);
      }
    }
    loadMySubmission();
  }, [id, isStudent]);

  useEffect(() => {
    if (!canViewSubmissions) return;

    async function loadSubmissions() {
      try {
        const res = await apiFetch(`/api/assignments/${id}/submissions`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load submissions');
        }
        const data = await res.json();
        setSubmissions(data.submissions);
        setSubmissionsError(null);
      } catch (err) {
        setSubmissionsError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setSubmissionsLoading(false);
      }
    }
    loadSubmissions();
  }, [id, canViewSubmissions]);

  async function handleSubmit() {
    setSubmitFieldError(null);
    if (!content.trim() && !fileUrl.trim()) {
      setSubmitFieldError('Provide either content or a link');
      return;
    }

    setSubmitStatus('submitting');
    setSubmitError(null);
    try {
      const res = await apiFetch(`/api/assignments/${id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          content: content.trim() || undefined,
          fileUrl: fileUrl.trim() || undefined,
        }),
      });
      if (res.status === 201) {
        setSubmitStatus('success');
        const data = await res.json();
        setMySubmission({
          ...data.submission,
          assignment: { id, title: '', due_date: '', class_id: '' },
        });
        setResubmitContent(data.submission.content ?? '');
        setResubmitFileUrl(data.submission.file_url ?? '');
      } else if (res.status === 409) {
        setSubmitStatus('already-submitted');
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit');
      }
    } catch (err) {
      setSubmitStatus('error');
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async function handleResubmit() {
    setResubmitFieldError(null);
    if (!resubmitContent.trim() && !resubmitFileUrl.trim()) {
      setResubmitFieldError('Provide either content or a link');
      return;
    }

    setResubmitStatus('submitting');
    setResubmitError(null);
    try {
      const res = await apiFetch(`/api/assignments/${id}/submit`, {
        method: 'PATCH',
        body: JSON.stringify({
          content: resubmitContent.trim() || undefined,
          fileUrl: resubmitFileUrl.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to resubmit');
      }
      const data = await res.json();
      setMySubmission((prev) => (prev ? { ...prev, ...data.submission } : prev));
      setResubmitStatus('success');
      setShowResubmitForm(false);
    } catch (err) {
      setResubmitStatus('error');
      setResubmitError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  function openGradeForm(s: SubmissionEntry) {
    setGradingSubmissionId(s.id);
    setGradeInput(s.grade !== null ? String(s.grade) : '');
    setFeedbackInput(s.feedback ?? '');
    setGradeStatus('idle');
    setGradeError(null);
    setGradeFieldError(null);
  }

  function closeGradeForm() {
    setGradingSubmissionId(null);
    setGradeFieldError(null);
    setGradeError(null);
  }

  async function handleGradeSubmit(submissionId: string) {
    setGradeFieldError(null);

    const trimmedGrade = gradeInput.trim();
    const parsedGrade = Number(trimmedGrade);
    if (trimmedGrade === '' || Number.isNaN(parsedGrade) || parsedGrade < 0 || parsedGrade > 100) {
      setGradeFieldError('Enter a grade between 0 and 100');
      return;
    }

    const trimmedFeedback = feedbackInput.trim();

    setGradeStatus('submitting');
    setGradeError(null);
    try {
      const res = await apiFetch(`/api/assignments/${id}/submissions/${submissionId}/grade`, {
        method: 'PATCH',
        body: JSON.stringify({
          grade: parsedGrade,
          ...(trimmedFeedback ? { feedback: trimmedFeedback } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save grade');
      }
      const data = await res.json();
      setSubmissions((prev) =>
        prev
          ? prev.map((s) =>
              s.id === submissionId
                ? { ...s, grade: data.submission.grade, feedback: data.submission.feedback }
                : s
            )
          : prev
      );
      setGradeStatus('success');
      setGradingSubmissionId(null);
    } catch (err) {
      setGradeStatus('error');
      setGradeError(err instanceof Error ? err.message : 'Something went wrong');
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

  if (!assignment) {
    return null;
  }

  return (
    <PageContainer width="md">
      <PageHeader
        title={assignment.title}
        description={`Due ${new Date(assignment.due_date).toLocaleDateString()}`}
        actions={
          <Link
            href={`/classes/${assignment.class_id}`}
            className={buttonStyles({ variant: 'ghost', size: 'sm' })}
          >
            ← Class
          </Link>
        }
      />

      {assignment.description && (
        <p className="-mt-4 mb-8 whitespace-pre-line text-sm">{assignment.description}</p>
      )}

      <div className="space-y-8">
        {isStudent && (
          <Section title="Your submission">
            {mySubmissionLoading && (
              <p className="text-sm text-muted">Checking your submission...</p>
            )}
            {mySubmissionError && (
              <p role="alert" className="text-sm text-danger">
                {mySubmissionError}
              </p>
            )}

            {!mySubmissionLoading && !mySubmissionError && mySubmission && (
              <Card className="flex flex-col gap-3 p-4">
                {!showResubmitForm && (
                  <>
                    {mySubmission.content && (
                      <p className="whitespace-pre-line text-sm">{mySubmission.content}</p>
                    )}
                    {mySubmission.file_url && (
                      <a
                        href={mySubmission.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkStyles}
                      >
                        {mySubmission.file_url}
                      </a>
                    )}
                    <p className="text-xs text-muted">
                      Submitted {new Date(mySubmission.submitted_at).toLocaleString()}
                    </p>

                    <div className="flex items-center gap-2">
                      {mySubmission.grade !== null ? (
                        <Badge tone="success">Grade {mySubmission.grade}/100</Badge>
                      ) : (
                        <Badge tone="warning">Not graded yet</Badge>
                      )}
                    </div>
                    {mySubmission.feedback && (
                      <p className="text-sm">
                        <span className="font-medium">Feedback:</span> {mySubmission.feedback}
                      </p>
                    )}

                    {resubmitStatus === 'success' && (
                      <p className="text-sm text-success">Resubmitted successfully.</p>
                    )}

                    <div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setShowResubmitForm(true);
                          setResubmitStatus('idle');
                          setResubmitError(null);
                        }}
                      >
                        Resubmit
                      </Button>
                    </div>
                  </>
                )}

                {showResubmitForm && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleResubmit();
                    }}
                    className="flex flex-col gap-4"
                  >
                    <Field label="Content">
                      <Textarea
                        value={resubmitContent}
                        onChange={(e) => setResubmitContent(e.target.value)}
                      />
                    </Field>

                    <Field label="Link (optional)" error={resubmitFieldError}>
                      <Input
                        type="text"
                        value={resubmitFileUrl}
                        onChange={(e) => setResubmitFileUrl(e.target.value)}
                      />
                    </Field>

                    {resubmitStatus === 'error' && resubmitError && (
                      <p
                        role="alert"
                        className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
                      >
                        {resubmitError}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <Button type="submit" disabled={resubmitStatus === 'submitting'}>
                        {resubmitStatus === 'submitting' ? 'Resubmitting...' : 'Resubmit'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setShowResubmitForm(false);
                          setResubmitContent(mySubmission.content ?? '');
                          setResubmitFileUrl(mySubmission.file_url ?? '');
                          setResubmitFieldError(null);
                          setResubmitError(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </Card>
            )}

            {!mySubmissionLoading && !mySubmissionError && !mySubmission && (
              <>
                {submitStatus === 'success' && (
                  <p className="mb-2 text-sm text-success">Submitted successfully.</p>
                )}
                {submitStatus === 'already-submitted' && (
                  <p className="mb-2 text-sm text-muted">
                    You have already submitted this assignment.
                  </p>
                )}
                {submitStatus === 'error' && submitError && (
                  <p role="alert" className="mb-2 text-sm text-danger">
                    {submitError}
                  </p>
                )}

                {submitStatus !== 'success' && submitStatus !== 'already-submitted' && (
                  <Card className="p-4">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSubmit();
                      }}
                      className="flex flex-col gap-4"
                    >
                      <Field label="Content">
                        <Textarea value={content} onChange={(e) => setContent(e.target.value)} />
                      </Field>

                      <Field label="Link (optional)" error={submitFieldError}>
                        <Input
                          type="text"
                          value={fileUrl}
                          onChange={(e) => setFileUrl(e.target.value)}
                        />
                      </Field>

                      <div>
                        <Button type="submit" disabled={submitStatus === 'submitting'}>
                          {submitStatus === 'submitting' ? 'Submitting...' : 'Submit'}
                        </Button>
                      </div>
                    </form>
                  </Card>
                )}
              </>
            )}
          </Section>
        )}

        {canViewSubmissions && (
          <Section title="Submissions" count={submissions?.length}>
            {submissionsLoading && <p className="text-sm text-muted">Loading submissions...</p>}
            {submissionsError && (
              <p role="alert" className="text-sm text-danger">
                {submissionsError}
              </p>
            )}
            {!submissionsLoading &&
              !submissionsError &&
              submissions &&
              submissions.length === 0 && <Empty>No submissions yet.</Empty>}
            {!submissionsLoading && !submissionsError && submissions && submissions.length > 0 && (
              <div className="space-y-3">
                {submissions.map((s) => (
                  <Card key={s.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{s.student.name}</p>
                        <p className="text-sm text-muted">{s.student.email}</p>
                      </div>
                      {s.grade !== null ? (
                        <Badge tone="success">{s.grade}/100</Badge>
                      ) : (
                        <Badge tone="warning">Needs grading</Badge>
                      )}
                    </div>

                    <div className="mt-3 flex flex-col gap-2">
                      {s.content && <p className="whitespace-pre-line text-sm">{s.content}</p>}
                      {s.file_url && (
                        <a
                          href={s.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={linkStyles}
                        >
                          {s.file_url}
                        </a>
                      )}
                      <p className="text-xs text-muted">
                        Submitted {new Date(s.submitted_at).toLocaleString()}
                      </p>
                    </div>

                    {gradingSubmissionId !== s.id && (
                      <div className="mt-3 flex flex-col gap-2">
                        {s.feedback && (
                          <p className="text-sm">
                            <span className="font-medium">Feedback:</span> {s.feedback}
                          </p>
                        )}
                        <div>
                          <Button variant="secondary" size="sm" onClick={() => openGradeForm(s)}>
                            {s.grade !== null ? 'Update grade' : 'Grade'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {gradingSubmissionId === s.id && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleGradeSubmit(s.id);
                        }}
                        className="mt-4 flex flex-col gap-4 border-t border-line pt-4"
                      >
                        <Field label="Grade (0-100)" error={gradeFieldError}>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={gradeInput}
                            onChange={(e) => setGradeInput(e.target.value)}
                          />
                        </Field>

                        <Field label="Feedback (optional)">
                          <Textarea
                            value={feedbackInput}
                            onChange={(e) => setFeedbackInput(e.target.value)}
                          />
                        </Field>

                        {gradeStatus === 'error' && gradeError && (
                          <p
                            role="alert"
                            className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
                          >
                            {gradeError}
                          </p>
                        )}

                        <div className="flex gap-2">
                          <Button type="submit" disabled={gradeStatus === 'submitting'}>
                            {gradeStatus === 'submitting' ? 'Saving...' : 'Save grade'}
                          </Button>
                          <Button type="button" variant="secondary" onClick={closeGradeForm}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </Section>
        )}
      </div>
    </PageContainer>
  );
}