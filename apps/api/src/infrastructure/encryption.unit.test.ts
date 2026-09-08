import { describe, it, expect } from 'vitest';
import { encryptString, decryptString } from './encryption';

describe('Encryption Infrastructure', () => {
  it('encrypts and decrypts a string successfully', () => {
    const plain = 'my-secret-access-token';
    const encrypted = encryptString(plain);
    
    expect(encrypted).not.toBe(plain);
    expect(encrypted.split(':').length).toBe(3);
    
    const decrypted = decryptString(encrypted);
    expect(decrypted).toBe(plain);
  });
  
  it('throws on tampered auth tag', () => {
    const plain = 'another-secret';
    const encrypted = encryptString(plain);
    
    const parts = encrypted.split(':');
    parts[2] = 'tampered' + parts[2].slice(8);
    const tampered = parts.join(':');
    
    expect(() => decryptString(tampered)).toThrow();
  });
});
