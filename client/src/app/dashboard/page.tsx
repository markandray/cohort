'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRequireAuth } from '@/lib/use-require-auth';
import { gqlFetch } from '@/lib/gql-client';
import Link from 'next/link';

interface DashboardClassSummary {
  id: string;
  name: string;
}

interface DashboardAssignmentSummary {
  id: string;
  title: string;
  dueDate: string;
  className: string;
}

interface DashboardGradeSummary {
  submissionId: string;
  assignmentTitle: string;
  grade: number;
  feedback: string | null;
}

interface DashboardStudyGroupSummary {
  id: string;
  name: string;
  className: string;
}

interface UngradedSubmissionSummary {
  submissionId: string;
  assignmentId: string;
  assignmentTitle: string;
  studentName: string;
  className: string;
  submittedAt: string;
}

interface StudentDashboard {
  classes: DashboardClassSummary[];
  classCount: number;
  upcomingAssignments: DashboardAssignmentSummary[];
  overdueAssignments: DashboardAssignmentSummary[];
  currentGrades: DashboardGradeSummary[];
  studyGroups: DashboardStudyGroupSummary[];
  studyGroupCount: number;
  noteCount: number;
}

interface TeacherDashboard {
  classes: DashboardClassSummary[];
  classCount: number;
  ungradedSubmissions: UngradedSubmissionSummary[];
  upcomingAssignments: DashboardAssignmentSummary[];
}

interface AdminDashboard {
  totalStudents: number;
  totalTeachers: number;
  totalAdmins: number;
  totalClasses: number;
  totalAssignments: number;
  totalUngradedSubmissions: number;
}

interface Dashboard {
  role: string;
  student: StudentDashboard | null;
  teacher: TeacherDashboard | null;
  admin: AdminDashboard | null;
}

const DASHBOARD_QUERY = `
  query Dashboard {
    dashboard {
      role
      student {
        classes { id name }
        classCount
        upcomingAssignments { id title dueDate className }
        overdueAssignments { id title dueDate className }
        currentGrades { submissionId assignmentTitle grade feedback }
        studyGroups { id name className }
        studyGroupCount
        noteCount
      }
      teacher {
        classes { id name }
        classCount
        ungradedSubmissions { submissionId assignmentId assignmentTitle studentName className submittedAt }
        upcomingAssignments { id title dueDate className }
      }
      admin {
        totalStudents
        totalTeachers
        totalAdmins
        totalClasses
        totalAssignments
        totalUngradedSubmissions
      }
    }
  }
`;

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  useRequireAuth();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function loadDashboard() {
      try {
        const data = await gqlFetch<{ dashboard: Dashboard }>(DASHBOARD_QUERY);
        setDashboard(data.dashboard);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, [user]);

  if (authLoading || isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">{error}</div>;
  }

  if (!dashboard) {
    return null;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {dashboard.role === 'STUDENT' && dashboard.student && (
        <StudentDashboardView data={dashboard.student} />
      )}

      {dashboard.role === 'TEACHER' && dashboard.teacher && (
        <TeacherDashboardView data={dashboard.teacher} />
      )}

      {dashboard.role === 'ADMIN' && dashboard.admin && (
        <AdminDashboardView data={dashboard.admin} />
      )}
    </div>
  );
}

function StudentDashboardView({ data }: { data: StudentDashboard }) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold mb-2">My Classes ({data.classCount})</h2>
        <ul className="space-y-1">
          {data.classes.map((c) => (
            <li key={c.id} className="border rounded px-4 py-2">{c.name}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Upcoming Assignments</h2>
        {data.upcomingAssignments.length === 0 ? (
          <p className="text-gray-500">Nothing due in the next 7 days.</p>
        ) : (
          <ul className="space-y-1">
            {data.upcomingAssignments.map((a) => (
              <li key={a.id} className="border rounded px-4 py-2">
                {a.title} — {a.className} (due {new Date(a.dueDate).toLocaleDateString()})
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.overdueAssignments.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2 text-red-600">Overdue</h2>
          <ul className="space-y-1">
            {data.overdueAssignments.map((a) => (
              <li key={a.id} className="border border-red-300 rounded px-4 py-2">
                {a.title} — {a.className} (was due {new Date(a.dueDate).toLocaleDateString()})
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-2">Current Grades</h2>
        {data.currentGrades.length === 0 ? (
          <p className="text-gray-500">No grades yet.</p>
        ) : (
          <ul className="space-y-1">
            {data.currentGrades.map((g) => (
              <li key={g.submissionId} className="border rounded px-4 py-2">
                {g.assignmentTitle}: {g.grade}
                {g.feedback && <span className="text-gray-500"> — {g.feedback}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Study Groups ({data.studyGroupCount})</h2>
        <ul className="space-y-1">
          {data.studyGroups.map((g) => (
            <li key={g.id} className="border rounded px-4 py-2">{g.name} — {g.className}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Notes: {data.noteCount}</h2>
      </section>
    </div>
  );
}

function TeacherDashboardView({ data }: { data: TeacherDashboard }) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold mb-2">Classes Taught ({data.classCount})</h2>
        <ul className="space-y-1">
          {data.classes.map((c) => (
            <li key={c.id} className="border rounded px-4 py-2">{c.name}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Ungraded Submissions</h2>
        {data.ungradedSubmissions.length === 0 ? (
          <p className="text-gray-500">Nothing needs grading.</p>
        ) : (
          <ul className="space-y-1">
            {data.ungradedSubmissions.map((s) => (
              <li key={s.submissionId} className="border rounded px-4 py-2">
                {s.studentName} — {s.assignmentTitle} ({s.className}), submitted{' '}
                {new Date(s.submittedAt).toLocaleDateString()}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Upcoming Deadlines</h2>
        {data.upcomingAssignments.length === 0 ? (
          <p className="text-gray-500">Nothing due in the next 7 days.</p>
        ) : (
          <ul className="space-y-1">
            {data.upcomingAssignments.map((a) => (
              <li key={a.id} className="border rounded px-4 py-2">
                {a.title} — {a.className} (due {new Date(a.dueDate).toLocaleDateString()})
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AdminDashboardView({ data }: { data: AdminDashboard }) {
  const stats: Array<[string, number]> = [
    ['Students', data.totalStudents],
    ['Teachers', data.totalTeachers],
    ['Admins', data.totalAdmins],
    ['Classes', data.totalClasses],
    ['Assignments', data.totalAssignments],
    ['Ungraded Submissions', data.totalUngradedSubmissions],
  ];

  return (
    <div className="space-y-6">
 
     <div className="grid grid-cols-2 gap-4">
        {stats.map(([label, value]) => (
          <div key={label} className="border rounded px-4 py-2">
            <div className="text-sm text-gray-500">{label}</div>
            <div className="text-2xl font-bold">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}