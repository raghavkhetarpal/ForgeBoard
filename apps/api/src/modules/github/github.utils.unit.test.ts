import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { signOAuthState, verifyOAuthState } from './github.utils';

describe('GitHub OAuth State Utils', () => {
  it('signs and verifies a valid state', () => {
    const state = signOAuthState('proj1', 'user1', 'ws1');
    const parsed = verifyOAuthState(state);
    expect(parsed).toEqual({ projectId: 'proj1', userId: 'user1', workspaceId: 'ws1' });
  });
  
  it('rejects tampered state', () => {
    const state = signOAuthState('proj1', 'user1', 'ws1');
    const parts = state.split('.');
    
    // Tamper payload
    const tamperedPayload = Buffer.from('proj2:user1:ws1:9999999999999').toString('base64url');
    const tamperedState = `${tamperedPayload}.${parts[1]}`;
    
    expect(verifyOAuthState(tamperedState)).toBeNull();
  });
  
  it('rejects expired state', () => {
    // Generate a payload from 2 hours ago
    const payload = `proj1:user1:ws1:${Date.now() - 2 * 60 * 60 * 1000}`;
    const hmac = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'forgeboard-dev-session-secret').update(payload).digest('base64url');
    const state = `${Buffer.from(payload).toString('base64url')}.${hmac}`;
    
    expect(verifyOAuthState(state)).toBeNull();
  });
});
