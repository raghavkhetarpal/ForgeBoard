import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// Need a 32-byte key. Will fall back to a zeroed buffer if not found so tests can pass, 
// but in production it must be set.
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY is required in production');
    }
    return Buffer.alloc(32, 0); // 32 bytes of zeroes for development/tests
  }
  
  const buf = Buffer.from(key, 'hex');
  if (buf.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string');
  }
  return buf;
}

export function encryptString(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag().toString('base64');
  
  // Format: iv:encrypted:authTag
  return `${iv.toString('base64')}:${encrypted}:${authTag}`;
}

export function decryptString(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }
  
  const [ivB64, encB64, authTagB64] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encB64, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
