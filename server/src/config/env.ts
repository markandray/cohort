function requireEnv(key: string): string {
  const value = process.env[key];

  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export const env = {
  PORT: process.env.PORT ?? '5000',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  DATABASE_URL: requireEnv('DATABASE_URL'),
  REDIS_URL: requireEnv('REDIS_URL'),
  JWT_ACCESS_SECRET: requireEnv('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET'),
};