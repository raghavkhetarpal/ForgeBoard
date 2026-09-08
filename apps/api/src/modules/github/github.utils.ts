import crypto from 'crypto';

function getStateSecret(): string {
  return process.env.SESSION_SECRET || 'forgeboard-dev-session-secret';
}

export function signOAuthState(projectId: string, userId: string, workspaceId: string): string {
  const payload = `${projectId}:${userId}:${workspaceId}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', getStateSecret()).update(payload).digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${hmac}`;
}

export function verifyOAuthState(state: string): { projectId: string; userId: string; workspaceId: string } | null {
  const parts = state.split('.');
  if (parts.length !== 2) return null;
  
  const [payloadB64, providedHmac] = parts;
  const expectedHmac = crypto.createHmac('sha256', getStateSecret()).update(Buffer.from(payloadB64, 'base64url').toString('utf8')).digest('base64url');
  
  if (providedHmac !== expectedHmac) return null;
  
  const payload = Buffer.from(payloadB64, 'base64url').toString('utf8');
  const [projectId, userId, workspaceId, timestampStr] = payload.split(':');
  
  // Optional: check expiration (e.g. 1 hour)
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp) || Date.now() - timestamp > 60 * 60 * 1000) {
    return null;
  }
  
  return { projectId, userId, workspaceId };
}
