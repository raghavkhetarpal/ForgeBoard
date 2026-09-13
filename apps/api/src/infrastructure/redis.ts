import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

declare global {
  // eslint-disable-next-line no-var
  var redisClient: Redis | undefined;
}

export const redis =
  global.redisClient ||
  new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
  });

if (process.env.NODE_ENV !== 'production') {
  global.redisClient = redis;
}

// Attach silent error handler to prevent unhandled EventEmitter exceptions during transient connection failures
redis.on('error', (err) => {
  if (process.env.NODE_ENV !== 'test') {
    console.error('Redis client error:', err.message);
  }
});

export default redis;
