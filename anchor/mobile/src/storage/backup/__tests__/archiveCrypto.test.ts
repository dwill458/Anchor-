import { randomBytes } from 'node:crypto';
import {
  BackupError,
  formatRecoverySecret,
  generateRecoveryKey,
  openArchive,
  parseRecoverySecret,
  sealArchive,
} from '../archiveCrypto';

const random = async (n: number) => new Uint8Array(randomBytes(n));
const PLAINTEXT_MARKER = 'SYNTHETIC-PRIVATE-MARKER-7f3a';
const payload = new TextEncoder().encode(JSON.stringify({ marker: PLAINTEXT_MARKER, count: 3 }));

async function sealed() {
  const recoveryKey = await generateRecoveryKey(random);
  const archive = await sealArchive(payload, { recoveryKey, randomBytes: random, createdAt: '2026-10-15T00:00:00.000Z' });
  return { recoveryKey, archive, secret: formatRecoverySecret(recoveryKey) };
}

function failure(fn: () => unknown): BackupError {
  try { fn(); } catch (error) { return error as BackupError; }
  throw new Error('expected failure');
}

describe('portable archive cryptography', () => {
  it('round-trips with the recovery secret and hides the plaintext', async () => {
    const { archive, secret } = await sealed();
    const opened = openArchive(archive, parseRecoverySecret(secret));
    expect(new TextDecoder().decode(opened.payload)).toContain(PLAINTEXT_MARKER);
    expect(Buffer.from(archive).includes(PLAINTEXT_MARKER)).toBe(false);
    expect(opened.header.cipher).toBe('AES-256-GCM');
  });

  it('produces a fresh salt and nonce for every archive', async () => {
    const recoveryKey = await generateRecoveryKey(random);
    const a = await sealArchive(payload, { recoveryKey, randomBytes: random, createdAt: 'x' });
    const b = await sealArchive(payload, { recoveryKey, randomBytes: random, createdAt: 'x' });
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('rejects a different recovery secret as authentication failure', async () => {
    const { archive } = await sealed();
    const other = formatRecoverySecret(await generateRecoveryKey(random));
    expect(failure(() => openArchive(archive, parseRecoverySecret(other))).code).toBe('AUTHENTICATION_FAILED');
  });

  it('detects ciphertext tampering', async () => {
    const { archive, secret } = await sealed();
    const tampered = archive.slice();
    tampered[tampered.length - 5] ^= 0x01;
    expect(failure(() => openArchive(tampered, parseRecoverySecret(secret))).code).toBe('AUTHENTICATION_FAILED');
  });

  it('detects header tampering because the header is authenticated', async () => {
    const { archive, secret } = await sealed();
    const text = Buffer.from(archive).toString('latin1');
    const tampered = Uint8Array.from(Buffer.from(text.replace('2026-10-15T00:00:00.000Z', '2026-10-16T00:00:00.000Z'), 'latin1'));
    expect(failure(() => openArchive(tampered, parseRecoverySecret(secret))).code).toBe('AUTHENTICATION_FAILED');
  });

  it('reports truncated files distinctly', async () => {
    const { archive, secret } = await sealed();
    expect(failure(() => openArchive(archive.slice(0, archive.length - 10), parseRecoverySecret(secret))).code).toBe('TRUNCATED');
    expect(failure(() => openArchive(archive.slice(0, 12), parseRecoverySecret(secret))).code).toBe('TRUNCATED');
  });

  it('rejects trailing data and non-Anchor files', async () => {
    const { archive, secret } = await sealed();
    const extended = new Uint8Array([...archive, 0x00]);
    expect(failure(() => openArchive(extended, parseRecoverySecret(secret))).code).toBe('FORMAT');
    expect(failure(() => openArchive(new TextEncoder().encode('not a backup at all'), parseRecoverySecret(secret))).code).toBe('FORMAT');
  });

  it('rejects unknown format versions before any decryption', async () => {
    const { archive, secret } = await sealed();
    const text = Buffer.from(archive).toString('latin1').replace('"formatVersion":1', '"formatVersion":9');
    expect(failure(() => openArchive(Uint8Array.from(Buffer.from(text, 'latin1')), parseRecoverySecret(secret))).code).toBe('UNSUPPORTED_VERSION');
  });
});

describe('recovery secret format', () => {
  it('formats 56 characters in groups of four and parses owner-typed variants', async () => {
    const key = await generateRecoveryKey(random);
    const secret = formatRecoverySecret(key);
    expect(secret.split('-')).toHaveLength(14);
    expect(secret.replace(/-/g, '')).toHaveLength(56);
    expect(Buffer.from(parseRecoverySecret(secret.toLowerCase())).equals(Buffer.from(key))).toBe(true);
    expect(Buffer.from(parseRecoverySecret(secret.replace(/-/g, ' '))).equals(Buffer.from(key))).toBe(true);
  });

  it('rejects a mistyped character through the checksum', async () => {
    const secret = formatRecoverySecret(await generateRecoveryKey(random));
    const chars = secret.replace(/-/g, '').split('');
    chars[10] = chars[10] === '0' ? '1' : '0';
    const typo = chars.join('').match(/.{1,4}/g)!.join('-');
    expect(failure(() => parseRecoverySecret(typo)).code).toBe('SECRET_INVALID');
    expect(failure(() => parseRecoverySecret('ABCD')).code).toBe('SECRET_INVALID');
  });
});
