import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { ensureApolloStarted } from './graphql/apollo';

const PORT = process.env.PORT || 5000;

async function startServer() {
  const { default: redis } = await import('./config/redis');

  await redis.ping();

  await ensureApolloStarted();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});