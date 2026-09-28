import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => {
  console.log('[redis] connected');
});

redis.on('ready', () => {
  console.log('[redis] ready');
});

redis.on('error', (err) => {
  console.error('[redis] connection error:', err);
});

export default redis;