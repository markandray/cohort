import * as dashboardService from '../services/dashboard.service';

export interface GraphQLContext {
  user: { userId: string; role: string };
}

export const resolvers = {
  Query: {
    dashboard: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      const { userId, role } = context.user;

      if (role === 'STUDENT') {
        const data = await dashboardService.getStudentDashboard(userId);
        return {
          role,
          student: {
            classes: data.classes,
            classCount: data.classCount,
            upcomingAssignments: data.upcomingAssignments.map((a) => ({
              id: a.id,
              title: a.title,
              dueDate: a.due_date.toISOString(),
              className: a.class.name,
            })),
            overdueAssignments: data.overdueAssignments.map((a) => ({
              id: a.id,
              title: a.title,
              dueDate: a.due_date.toISOString(),
              className: a.class.name,
            })),
            currentGrades: data.gradedSubmissions.map((s) => ({
              submissionId: s.id,
              assignmentTitle: s.assignment.title,
              grade: s.grade,
              feedback: s.feedback,
            })),
            studyGroups: data.studyGroups.map((g) => ({
              id: g.id,
              name: g.name,
              className: g.class.name,
            })),
            studyGroupCount: data.studyGroupCount,
            noteCount: data.noteCount,
          },
          teacher: null,
          admin: null,
        };
      }

      if (role === 'TEACHER') {
        const data = await dashboardService.getTeacherDashboard(userId);
        return {
          role,
          student: null,
          teacher: {
            classes: data.classes,
            classCount: data.classCount,
            ungradedSubmissions: data.ungradedSubmissions.map((s) => ({
              submissionId: s.id,
              assignmentId: s.assignment.id,
              assignmentTitle: s.assignment.title,
              studentName: s.student.name,
              className: s.assignment.class.name,
              submittedAt: s.submitted_at.toISOString(),
            })),
            upcomingAssignments: data.upcomingAssignments.map((a) => ({
              id: a.id,
              title: a.title,
              dueDate: a.due_date.toISOString(),
              className: a.class.name,
            })),
          },
          admin: null,
        };
      }

      // ADMIN
      const data = await dashboardService.getAdminDashboard();
      return { role, student: null, teacher: null, admin: data };
    },
  },
};