'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { useRequireAuth } from '@/lib/use-require-auth';

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

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useRequireAuth();

  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Existing submission (pre-check) — null means "checked, none exists yet".
  const [mySubmission, setMySubmission] = useState<MySubmissionEntry | null>(null);
  const [mySubmissionLoading, setMySubmissionLoading] = useState(false);
  const [mySubmissionError, setMySubmissionError] = useState<string | null>(null);

  // First-time submit (no existing submission) — unchanged from before.
  const [content, setContent] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitFieldError, setSubmitFieldError] = useState<string | null>(null);

  // Resubmit form — separate state, pre-filled from mySubmission when opened.
  const [showResubmitForm, setShowResubmitForm] = useState(false);
  const [resubmitContent, setResubmitContent] = useState('');
  const [resubmitFileUrl, setResubmitFileUrl] = useState('');
  const [resubmitStatus, setResubmitStatus] = useState<ResubmitStatus>('idle');
  const [resubmitError, setResubmitError] = useState<string | null>(null);
  const [resubmitFieldError, setResubmitFieldError] = useState<string | null>(null);

  const [submissions, setSubmissions] = useState<SubmissionEntry[] | null>(null);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);

  // Grading form — one row open at a time, same convention as resubmit.
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
      setMySubmissionLoading(true);
      setMySubmissionError(null);
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
      setSubmissionsLoading(true);
      setSubmissionsError(null);
      try {
        const res = await apiFetch(`/api/assignments/${id}/submissions`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load submissions');
        }
        const data = await res.json();
        setSubmissions(data.submissions);
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

  if (authLoading || !user) {
    return <p className="text-center mt-16">Loading...</p>;
  }

  if (isLoading) {
    return <p className="text-center mt-16">Loading assignment...</p>;
  }

  if (error) {
    return <p className="text-center mt-16 text-red-600">{error}</p>;
  }

  if (!assignment) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto mt-16 px-4">
      <h1 className="text-xl font-semibold mb-1">{assignment.title}</h1>
      <p className="text-sm text-gray-500 mb-1">
        Due {new Date(assignment.due_date).toLocaleDateString()}
      </p>
      {assignment.description && (
        <p className="text-sm text-gray-700 mb-6">{assignment.description}</p>
      )}

      {isStudent && (
        <div className="mb-8">
          <h2 className="text-lg font-medium mb-3">Your Submission</h2>

          {mySubmissionLoading && <p className="text-gray-500">Checking your submission...</p>}
          {mySubmissionError && <p className="text-red-600 text-sm">{mySubmissionError}</p>}

          {!mySubmissionLoading && !mySubmissionError && mySubmission && (
            <div className="border rounded px-4 py-3 flex flex-col gap-3">
              {!showResubmitForm && (
                <>
                  {mySubmission.content && (
                    <p className="text-sm text-gray-700">{mySubmission.content}</p>
                  )}
                  {mySubmission.file_url && (
                    <a
                      href={mySubmission.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 underline"
                    >
                      {mySubmission.file_url}
                    </a>
                  )}
                  <p className="text-xs text-gray-400">
                    Submitted {new Date(mySubmission.submitted_at).toLocaleString()}
                  </p>

                  {mySubmission.grade !== null ? (
                    <p className="text-sm">
                      <span className="font-medium">Grade:</span> {mySubmission.grade}/100
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">Not graded yet.</p>
                  )}
                  {mySubmission.feedback && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Feedback:</span> {mySubmission.feedback}
                    </p>
                  )}

                  {resubmitStatus === 'success' && (
                    <p className="text-green-600 text-sm">Resubmitted successfully.</p>
                  )}

                  <div>
                    <button
                      onClick={() => {
                        setShowResubmitForm(true);
                        setResubmitStatus('idle');
                        setResubmitError(null);
                      }}
                      className="border rounded px-3 py-2 text-sm"
                    >
                      Resubmit
                    </button>
                  </div>
                </>
              )}

              {showResubmitForm && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Content</label>
                    <textarea
                      value={resubmitContent}
                      onChange={(e) => setResubmitContent(e.target.value)}
                      className="border rounded px-3 py-2 w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Link (optional)</label>
                    <input
                      type="text"
                      value={resubmitFileUrl}
                      onChange={(e) => setResubmitFileUrl(e.target.value)}
                      className="border rounded px-3 py-2 w-full"
                    />
                  </div>

                  {resubmitFieldError && (
                    <p className="text-red-600 text-sm">{resubmitFieldError}</p>
                  )}
                  {resubmitStatus === 'error' && resubmitError && (
                    <p className="text-red-600 text-sm">{resubmitError}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleResubmit}
                      disabled={resubmitStatus === 'submitting'}
                      className="bg-black text-white rounded px-3 py-2 disabled:opacity-50"
                    >
                      {resubmitStatus === 'submitting' ? 'Resubmitting...' : 'Resubmit'}
                    </button>
                    <button
                      onClick={() => {
                        setShowResubmitForm(false);
                        setResubmitContent(mySubmission.content ?? '');
                        setResubmitFileUrl(mySubmission.file_url ?? '');
                        setResubmitFieldError(null);
                        setResubmitError(null);
                      }}
                      className="border rounded px-3 py-2"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {!mySubmissionLoading && !mySubmissionError && !mySubmission && (
            <>
              {submitStatus === 'success' && (
                <p className="text-green-600 text-sm mb-2">Submitted successfully.</p>
              )}
              {submitStatus === 'already-submitted' && (
                <p className="text-sm mb-2 text-gray-600">
                  You have already submitted this assignment.
                </p>
              )}
              {submitStatus === 'error' && submitError && (
                <p className="text-red-600 text-sm mb-2">{submitError}</p>
              )}

              {submitStatus !== 'success' && submitStatus !== 'already-submitted' && (
                <div className="border rounded px-4 py-3 flex flex-col gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Content</label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="border rounded px-3 py-2 w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Link (optional)</label>
                    <input
                      type="text"
                      value={fileUrl}
                      onChange={(e) => setFileUrl(e.target.value)}
                      className="border rounded px-3 py-2 w-full"
                    />
                  </div>

                  {submitFieldError && <p className="text-red-600 text-sm">{submitFieldError}</p>}

                  <button
                    onClick={handleSubmit}
                    disabled={submitStatus === 'submitting'}
                    className="bg-black text-white rounded px-3 py-2 disabled:opacity-50"
                  >
                    {submitStatus === 'submitting' ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {canViewSubmissions && (
        <div>
          <h2 className="text-lg font-medium mb-3">Submissions</h2>
          {submissionsLoading && <p className="text-gray-500">Loading submissions...</p>}
          {submissionsError && <p className="text-red-600 text-sm">{submissionsError}</p>}
          {!submissionsLoading && !submissionsError && submissions && submissions.length === 0 && (
            <p className="text-gray-500">No submissions yet.</p>
          )}
          {!submissionsLoading && !submissionsError && submissions && submissions.length > 0 && (
            <div className="flex flex-col gap-2">
              {submissions.map((s) => (
                <div key={s.id} className="border rounded px-4 py-3">
                  <p className="font-medium">{s.student.name}</p>
                  <p className="text-sm text-gray-500 mb-2">{s.student.email}</p>
                  {s.content && <p className="text-sm text-gray-700 mb-1">{s.content}</p>}
                  {s.file_url && (
                    <a
                      href={s.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 underline"
                    >
                      {s.file_url}
                    </a>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    Submitted {new Date(s.submitted_at).toLocaleString()}
                  </p>

                  {gradingSubmissionId !== s.id && (
                    <>
                      {s.grade !== null ? (
                        <p className="text-sm mt-2">
                          <span className="font-medium">Grade:</span> {s.grade}/100
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500 mt-2">Not graded yet.</p>
                      )}
                      {s.feedback && (
                        <p className="text-sm text-gray-700 mt-1">
                          <span className="font-medium">Feedback:</span> {s.feedback}
                        </p>
                      )}

                      <div className="mt-2">
                        <button
                          onClick={() => openGradeForm(s)}
                          className="border rounded px-3 py-2 text-sm"
                        >
                          {s.grade !== null ? 'Update Grade' : 'Grade'}
                        </button>
                      </div>
                    </>
                  )}

                  {gradingSubmissionId === s.id && (
                    <div className="mt-3 flex flex-col gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Grade (0-100)</label>
                        <input
                          type="text"
                          value={gradeInput}
                          onChange={(e) => setGradeInput(e.target.value)}
                          className="border rounded px-3 py-2 w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Feedback (optional)</label>
                        <textarea
                          value={feedbackInput}
                          onChange={(e) => setFeedbackInput(e.target.value)}
                          className="border rounded px-3 py-2 w-full"
                        />
                      </div>

                      {gradeFieldError && (
                        <p className="text-red-600 text-sm">{gradeFieldError}</p>
                      )}
                      {gradeStatus === 'error' && gradeError && (
                        <p className="text-red-600 text-sm">{gradeError}</p>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleGradeSubmit(s.id)}
                          disabled={gradeStatus === 'submitting'}
                          className="bg-black text-white rounded px-3 py-2 disabled:opacity-50"
                        >
                          {gradeStatus === 'submitting' ? 'Saving...' : 'Save Grade'}
                        </button>
                        <button onClick={closeGradeForm} className="border rounded px-3 py-2">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}