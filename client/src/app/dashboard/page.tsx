'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRequireAuth } from '@/lib/use-require-auth';
import { gqlFetch } from '@/lib/gql-client';
import { Badge, ListCard, ListRow, Stat } from '@/components/ui/card';
import { Empty, PageContainer, PageHeader, Section } from '@/components/ui/page';

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

const formatDate = (iso: string) => new Date(iso).toLocaleDateString();

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
    return (
      <PageContainer>
        <p className="text-muted">Loading...</p>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <p role="alert" className="text-danger">
          {error}
        </p>
      </PageContainer>
    );
  }

  if (!dashboard) {
    return null;
  }

  return (
    <PageContainer>
      <PageHeader title="Dashboard" />

      {dashboard.role === 'STUDENT' && dashboard.student && (
        <StudentDashboardView data={dashboard.student} />
      )}

      {dashboard.role === 'TEACHER' && dashboard.teacher && (
        <TeacherDashboardView data={dashboard.teacher} />
      )}

      {dashboard.role === 'ADMIN' && dashboard.admin && (
        <AdminDashboardView data={dashboard.admin} />
      )}
    </PageContainer>
  );
}

function StudentDashboardView({ data }: { data: StudentDashboard }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Classes" value={data.classCount} />
        <Stat label="Study groups" value={data.studyGroupCount} />
        <Stat label="Notes" value={data.noteCount} />
      </div>

      {data.overdueAssignments.length > 0 && (
        <Section title="Overdue" count={data.overdueAssignments.length}>
          <ListCard>
            {data.overdueAssignments.map((a) => (
              <ListRow
                key={a.id}
                href={`/assignments/${a.id}`}
                primary={a.title}
                secondary={`${a.className} · was due ${formatDate(a.dueDate)}`}
                trailing={<Badge tone="danger">Overdue</Badge>}
              />
            ))}
          </ListCard>
        </Section>
      )}

      <Section title="Upcoming">
        {data.upcomingAssignments.length === 0 ? (
          <Empty>Nothing due in the next 7 days.</Empty>
        ) : (
          <ListCard>
            {data.upcomingAssignments.map((a) => (
              <ListRow
                key={a.id}
                href={`/assignments/${a.id}`}
                primary={a.title}
                secondary={a.className}
                trailing={<Badge tone="warning">Due {formatDate(a.dueDate)}</Badge>}
              />
            ))}
          </ListCard>
        )}
      </Section>

      <Section title="Current grades">
        {data.currentGrades.length === 0 ? (
          <Empty>No grades yet.</Empty>
        ) : (
          <ListCard>
            {data.currentGrades.map((g) => (
              <ListRow
                key={g.submissionId}
                primary={g.assignmentTitle}
                secondary={g.feedback}
                trailing={<span className="text-sm font-semibold tabular-nums">{g.grade}</span>}
              />
            ))}
          </ListCard>
        )}
      </Section>

      <div className="grid gap-8 md:grid-cols-2">
        <Section title="My classes" count={data.classCount}>
          {data.classes.length === 0 ? (
            <Empty>Not enrolled in any classes yet.</Empty>
          ) : (
            <ListCard>
              {data.classes.map((c) => (
                <ListRow key={c.id} href={`/classes/${c.id}`} primary={c.name} />
              ))}
            </ListCard>
          )}
        </Section>

        <Section title="Study groups" count={data.studyGroupCount}>
          {data.studyGroups.length === 0 ? (
            <Empty>No study groups yet.</Empty>
          ) : (
            <ListCard>
              {data.studyGroups.map((g) => (
                <ListRow
                  key={g.id}
                  href={`/study-groups/${g.id}`}
                  primary={g.name}
                  secondary={g.className}
                />
              ))}
            </ListCard>
          )}
        </Section>
      </div>
    </div>
  );
}

function TeacherDashboardView({ data }: { data: TeacherDashboard }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Classes taught" value={data.classCount} />
        <Stat label="Awaiting grading" value={data.ungradedSubmissions.length} />
        <Stat label="Due this week" value={data.upcomingAssignments.length} />
      </div>

      <Section title="Ungraded submissions">
        {data.ungradedSubmissions.length === 0 ? (
          <Empty>Nothing needs grading.</Empty>
        ) : (
          <ListCard>
            {data.ungradedSubmissions.map((s) => (
              <ListRow
                key={s.submissionId}
                href={`/assignments/${s.assignmentId}`}
                primary={`${s.studentName} · ${s.assignmentTitle}`}
                secondary={`${s.className} · submitted ${formatDate(s.submittedAt)}`}
                trailing={<Badge tone="warning">Needs grading</Badge>}
              />
            ))}
          </ListCard>
        )}
      </Section>

      <Section title="Upcoming deadlines">
        {data.upcomingAssignments.length === 0 ? (
          <Empty>Nothing due in the next 7 days.</Empty>
        ) : (
          <ListCard>
            {data.upcomingAssignments.map((a) => (
              <ListRow
                key={a.id}
                href={`/assignments/${a.id}`}
                primary={a.title}
                secondary={a.className}
                trailing={<Badge>Due {formatDate(a.dueDate)}</Badge>}
              />
            ))}
          </ListCard>
        )}
      </Section>

      <Section title="Classes taught" count={data.classCount}>
        {data.classes.length === 0 ? (
          <Empty>You are not teaching any classes yet.</Empty>
        ) : (
          <ListCard>
            {data.classes.map((c) => (
              <ListRow key={c.id} href={`/classes/${c.id}`} primary={c.name} />
            ))}
          </ListCard>
        )}
      </Section>
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
    ['Ungraded submissions', data.totalUngradedSubmissions],
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {stats.map(([label, value]) => (
        <Stat key={label} label={label} value={value} />
      ))}
    </div>
  );
}