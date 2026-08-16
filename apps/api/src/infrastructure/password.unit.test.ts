import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('Password Infrastructure', () => {
  it('hashes password and verifies successfully with correct plaintext', async () => {
    const password = 'StrongPassword123!';
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('rejects verification when password does not match', async () => {
    const password = 'CorrectPassword123!';
    const wrongPassword = 'WrongPassword456!';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(wrongPassword, hash);
    expect(isValid).toBe(false);
  });
});
