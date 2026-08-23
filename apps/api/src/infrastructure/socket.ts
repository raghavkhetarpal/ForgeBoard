import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import redis from './redis';
import { getSession, unsignSessionCookie, SESSION_COOKIE_NAME } from './session';
import prisma from './prisma';
import { issuesRepository } from '../modules/issues/issues.repository';

let io: Server;


function parseCookie(str: string) {
  return str
    .split(';')
    .map(v => v.split('='))
    .reduce((acc, v) => {
      acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim());
      return acc;
    }, {} as Record<string, string>);
}

import { Server as HttpServer } from 'http';
export function initSocketServer(httpServer: HttpServer) {
  const pubClient = redis;
  const subClient = pubClient.duplicate();

  io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      credentials: true,
    },
    adapter: createAdapter(pubClient, subClient),
  });

  // Authentication Middleware
  io.use(async (socket: Socket, next) => {
    try {
      let sessionId: string | null = null;
      
      // 1. Check cookies
      if (socket.handshake.headers.cookie) {
        const cookies = parseCookie(socket.handshake.headers.cookie);
        const rawCookie = cookies[SESSION_COOKIE_NAME];
        if (rawCookie) {
          // If it's a signed cookie (prefix s:)
          if (rawCookie.startsWith('s:')) {
            const unsigned = unsignSessionCookie(rawCookie);
            if (unsigned !== false) {
              sessionId = unsigned;
            }
          } else {
             sessionId = rawCookie;
          }
        }
      }

      // 2. Fallback to auth token (for testing/dev)
      if (!sessionId && process.env.NODE_ENV !== 'production' && socket.handshake.auth.token) {
        sessionId = socket.handshake.auth.token;
      }

      if (!sessionId) {
        return next(new Error('Authentication required. No active session cookie provided.'));
      }

      const session = await getSession(sessionId);
      if (!session) {
        return next(new Error('Session has expired or is invalid.'));
      }

      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true, email: true, name: true, avatarUrl: true },
      });

      if (!user) {
        return next(new Error('User account no longer exists.'));
      }

      socket.data.user = user;
      socket.data.sessionId = sessionId;
      next();
    } catch {
      next(new Error('Internal server error during authentication.'));
    }
  });

  // Connection Handler
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (User: ${socket.data.user.id})`);

    socket.on('join:project', async (payload, callback) => {
      const { projectId } = payload || {};
      if (!projectId) {
        return callback?.({ error: 'Project ID is required' });
      }

      try {
        const isMember = await issuesRepository.isProjectMember(projectId, socket.data.user.id);
        if (!isMember) {
           return callback?.({ error: 'Forbidden' });
        }
        
        const roomName = `project:${projectId}`;
        socket.join(roomName);
        callback?.({ success: true, room: roomName });
      } catch {
        callback?.({ error: 'Internal server error' });
      }
    });

    socket.on('leave:project', (payload, callback) => {
      const { projectId } = payload || {};
      if (projectId) {
        socket.leave(`project:${projectId}`);
        callback?.({ success: true });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getSocketServer() {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}
