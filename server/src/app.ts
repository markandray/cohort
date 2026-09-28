import express, { Application, RequestHandler } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { expressMiddleware } from '@as-integrations/express5';
import authRouter from './routes/auth.routes';
import classRouter from './routes/class.routes';
import enrollmentRouter from './routes/enrollment.routes';
import assignmentRouter from './routes/assignment.routes';
import noteRouter from './routes/note.routes';
import studyGroupRouter from './routes/study-group.routes';
import { apolloServer, ensureApolloStarted } from './graphql/apollo';
import { requireAuth } from './middleware/auth.middleware';
import submissionRouter from './routes/submission.routes';
import { env } from './config/env';

const app: Application = express();

app.set('etag', false);

app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/classes', classRouter);
app.use('/api/enrollments', enrollmentRouter);
app.use('/api/assignments', assignmentRouter);
app.use('/api/notes', noteRouter);
app.use('/api/study-groups', studyGroupRouter);
app.use('/api/submissions', submissionRouter);

let graphqlHandler: RequestHandler | null = null;

app.use('/api/graphql', requireAuth, async (req, res, next) => {
  try {
    await ensureApolloStarted();
    if (!graphqlHandler) {
      graphqlHandler = expressMiddleware(apolloServer, {
        context: async ({ req }) => ({ user: req.user! }),
      });
    }
    return graphqlHandler(req, res, next);
  } catch (err) {
    next(err);
  }
});

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

export default app;