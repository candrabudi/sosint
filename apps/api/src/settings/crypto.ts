import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Enkripsi simetris AES-256-GCM untuk nilai rahasia yang disimpan di DB.
 * Format: "v1:<iv>:<authTag>:<ciphertext>" (base64url).
 */
export class SecretBox {
  private readonly key: Buffer;

  constructor(secret: string) {
    // turunkan kunci 32 byte dari secret apa pun
    this.key = createHash('sha256').update(`sig-settings:${secret}`).digest();
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v1', iv, tag, data].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join(':');
  }

  decrypt(payload: string): string {
    const [version, iv, tag, data] = payload.split(':');
    if (version !== 'v1' || !iv || !tag || !data) throw new Error('Format secret tidak dikenali');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  }
}

/** "sk_live_abcdef1234" → "••••••••1234" */
export const maskSecret = (s: string) => `${'•'.repeat(8)}${s.slice(-4)}`;
