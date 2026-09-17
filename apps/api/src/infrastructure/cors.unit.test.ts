import { describe, it, expect, afterEach } from 'vitest';
import express from 'express';
import cors from 'cors';
import request from 'supertest';
import { getAllowedOrigins } from './env';

describe('CORS Configuration', () => {
  const prevCorsOrigin = process.env.CORS_ORIGIN;
  const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    if (prevCorsOrigin === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = prevCorsOrigin;
    }

    if (prevAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = prevAppUrl;
    }
  });

  it('includes default development and production Vercel origins', () => {
    const origins = getAllowedOrigins();
    expect(origins).toContain('http://localhost:3000');
    expect(origins).toContain('http://localhost:3001');
    expect(origins).toContain('https://forge-board-web.vercel.app');
  });

  it('parses custom origins from CORS_ORIGIN and NEXT_PUBLIC_APP_URL', () => {
    process.env.CORS_ORIGIN = 'https://custom-domain.com, https://another-domain.com/';
    process.env.NEXT_PUBLIC_APP_URL = 'https://env-app.com';

    const origins = getAllowedOrigins();
    expect(origins).toContain('https://custom-domain.com');
    expect(origins).toContain('https://another-domain.com');
    expect(origins).toContain('https://env-app.com');
  });

  describe('Express CORS middleware integration', () => {
    const app = express();
    app.use(cors({ origin: getAllowedOrigins(), credentials: true }));
    app.get('/test-cors', (_req, res) => res.json({ status: 'ok' }));

    it('allows requests from http://localhost:3000 with credentials', async () => {
      const res = await request(app)
        .get('/test-cors')
        .set('Origin', 'http://localhost:3000');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['vary']).toContain('Origin');
    });

    it('allows requests from production frontend https://forge-board-web.vercel.app with credentials', async () => {
      const res = await request(app)
        .get('/test-cors')
        .set('Origin', 'https://forge-board-web.vercel.app');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('https://forge-board-web.vercel.app');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['vary']).toContain('Origin');
    });

    it('allows requests from Vercel preview deployments', async () => {
      const res = await request(app)
        .get('/test-cors')
        .set('Origin', 'https://forge-board-web-preview-123.vercel.app');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('https://forge-board-web-preview-123.vercel.app');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('handles OPTIONS preflight requests for production frontend', async () => {
      const res = await request(app)
        .options('/test-cors')
        .set('Origin', 'https://forge-board-web.vercel.app')
        .set('Access-Control-Request-Method', 'POST');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('https://forge-board-web.vercel.app');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('does not set Access-Control-Allow-Origin for untrusted origins', async () => {
      const res = await request(app)
        .get('/test-cors')
        .set('Origin', 'https://unauthorized-domain.com');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('never uses wildcard * for Access-Control-Allow-Origin', async () => {
      const resLocal = await request(app)
        .get('/test-cors')
        .set('Origin', 'http://localhost:3000');
      expect(resLocal.headers['access-control-allow-origin']).not.toBe('*');

      const resProd = await request(app)
        .get('/test-cors')
        .set('Origin', 'https://forge-board-web.vercel.app');
      expect(resProd.headers['access-control-allow-origin']).not.toBe('*');
    });
  });
});
