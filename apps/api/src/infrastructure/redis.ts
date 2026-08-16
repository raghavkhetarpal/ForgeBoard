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
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

if (process.env.NODE_ENV !== 'production') {
  global.redisClient = redis;
}

export default redis;
