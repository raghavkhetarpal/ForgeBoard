import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

let socketInstance: Socket | null = null;

/**
 * Initializes and returns a singleton Socket.IO connection.
 * It uses 'withCredentials: true' to ensure the session cookie is sent during handshake,
 * perfectly aligning with the backend's session-based socket authentication.
 */
export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: false, // Wait until we explicitly connect (e.g. after auth)
    });
  }
  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
