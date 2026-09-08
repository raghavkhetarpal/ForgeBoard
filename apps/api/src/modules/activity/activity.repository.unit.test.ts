import { describe, it, expect } from 'vitest';
import { ActivityRepository } from './activity.repository';

describe('ActivityRepository Unit Tests', () => {
  it('is strictly append-only (no update or delete methods)', () => {
    const repo = new ActivityRepository();
    
    // The only prototype methods should be createActivity and getActivities
    const methods = Object.getOwnPropertyNames(ActivityRepository.prototype).filter(m => m !== 'constructor');
    
    expect(methods).toContain('createActivity');
    expect(methods).toContain('getActivities');
    expect(methods).not.toContain('update');
    expect(methods).not.toContain('delete');
    expect(methods).not.toContain('updateActivity');
    expect(methods).not.toContain('deleteActivity');
    
    // Explicitly check properties on the instance
    expect((repo as any).update).toBeUndefined();
    expect((repo as any).delete).toBeUndefined();
  });
});
