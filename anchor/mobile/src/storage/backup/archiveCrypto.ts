import { gcm } from '@noble/ciphers/aes.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

/**
 * Portable encrypted backup container (format v1).
 *
 *   MAGIC (8 bytes, "ANCHBAK1") | header length (u32, big-endian) | header JSON | ciphertext+tag
 *
 * The header is authenticated as AES-GCM associated data, so any change to the
 * format, salt, nonce or declared length fails authentication. The ciphertext
 * is AES-256-GCM under a key derived with HKDF-SHA256 from a 256-bit random
 * recovery key that is independent of the device Keystore/SecureStore key.
 */

export const BACKUP_MAGIC = utf8ToBytes('ANCHBAK1');
export const BACKUP_FORMAT = 'anchor-encrypted-backup';
export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_SCHEMA_VERSION = 1;
const MAX_HEADER_BYTES = 16 * 1024;
const KDF_INFO = utf8ToBytes('anchor-backup-v1 aes-256-gcm');
const RECOVERY_KEY_BYTES = 32;
const SALT_BYTES = 32;
const NONCE_BYTES = 12;

export type BackupErrorCode =
  | 'FORMAT'
  | 'UNSUPPORTED_VERSION'
  | 'SECRET_INVALID'
  | 'AUTHENTICATION_FAILED'
  | 'TRUNCATED'
  | 'RANDOMNESS_UNAVAILABLE'
  | 'UNRESOLVED_NAMESPACES'
  | 'AUTHENTICATION_REQUIRED'
  | 'INTERRUPTED';

export class BackupError extends Error {
  constructor(readonly code: BackupErrorCode, message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export type RandomBytes = (length: number) => Promise<Uint8Array>;

export interface ArchiveHeader {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  schemaVersion: number;
  createdAt: string;
  cipher: 'AES-256-GCM';
  kdf: 'HKDF-SHA256';
  salt: string;
  nonce: string;
  ciphertextBytes: number;
}

// ---------------------------------------------------------------------------
// Recovery secret: 256 random bits, Crockford base32, 16-bit checksum.
// 56 characters in 14 groups of 4. Typos are detected before any decryption.
// ---------------------------------------------------------------------------

const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SECRET_CHARS = 56;

function toBase32(bytes: Uint8Array): string {
  let buffer = 0;
  let bits = 0;
  let out = '';
  for (const byte of bytes) {
    buffer = ((buffer << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32[(buffer >> bits) & 31];
    }
  }
  if (bits > 0) out += BASE32[(buffer << (5 - bits)) & 31];
  return out;
}

function fromBase32(text: string, byteLength: number): Uint8Array | null {
  let buffer = 0;
  let bits = 0;
  const out: number[] = [];
  for (const ch of text) {
    const value = BASE32.indexOf(ch);
    if (value < 0) return null;
    buffer = ((buffer << 5) | value) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  // Padding bits after the last full byte must be zero.
  if (bits >= 5 || (buffer & ((1 << bits) - 1)) !== 0 || out.length !== byteLength) return null;
  return Uint8Array.from(out);
}

function secretChecksum(key: Uint8Array): string {
  return toBase32(sha256(key).subarray(0, 2));
}

/** Formats a fresh recovery key for the owner to record outside the app. */
export function formatRecoverySecret(key: Uint8Array): string {
  if (key.length !== RECOVERY_KEY_BYTES) throw new BackupError('SECRET_INVALID', 'Recovery key must be 256 bits');
  const body = toBase32(key) + secretChecksum(key);
  return body.match(/.{1,4}/g)!.join('-');
}

/** Parses owner-typed text. Accepts case, spaces, dashes and Crockford confusables. */
export function parseRecoverySecret(text: string): Uint8Array {
  const normalized = text.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (normalized.length !== SECRET_CHARS) throw new BackupError('SECRET_INVALID', 'Recovery secret has the wrong length');
  const key = fromBase32(normalized.slice(0, 52), RECOVERY_KEY_BYTES);
  if (!key || secretChecksum(key) !== normalized.slice(52)) {
    throw new BackupError('SECRET_INVALID', 'Recovery secret checksum failed');
  }
  return key;
}

export async function generateRecoveryKey(randomBytes: RandomBytes): Promise<Uint8Array> {
  const key = await randomBytes(RECOVERY_KEY_BYTES);
  if (key.length !== RECOVERY_KEY_BYTES) throw new BackupError('RANDOMNESS_UNAVAILABLE', 'Secure random source failed');
  return key;
}

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

function deriveKey(recoveryKey: Uint8Array, salt: Uint8Array): Uint8Array {
  return hkdf(sha256, recoveryKey, salt, KDF_INFO, 32);
}

function u32(value: number): Uint8Array {
  return Uint8Array.of((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export interface SealOptions {
  recoveryKey: Uint8Array;
  randomBytes: RandomBytes;
  createdAt: string;
}

export async function sealArchive(payload: Uint8Array, options: SealOptions): Promise<Uint8Array> {
  const salt = await options.randomBytes(SALT_BYTES);
  const nonce = await options.randomBytes(NONCE_BYTES);
  if (salt.length !== SALT_BYTES || nonce.length !== NONCE_BYTES) throw new BackupError('RANDOMNESS_UNAVAILABLE', 'Secure random source failed');
  const key = deriveKey(options.recoveryKey, salt);
  const header: ArchiveHeader = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: options.createdAt,
    cipher: 'AES-256-GCM',
    kdf: 'HKDF-SHA256',
    salt: bytesToHex(salt),
    nonce: bytesToHex(nonce),
    ciphertextBytes: payload.length + 16,
  };
  const headerBytes = utf8ToBytes(JSON.stringify(header));
  const prefix = concat(BACKUP_MAGIC, u32(headerBytes.length), headerBytes);
  const ciphertext = gcm(key, nonce, prefix).encrypt(payload);
  key.fill(0);
  return concat(prefix, ciphertext);
}

export interface OpenedArchive {
  header: ArchiveHeader;
  payload: Uint8Array;
}

/** Parses the container without a key, for format and version checks. */
export function readArchiveHeader(bytes: Uint8Array): { header: ArchiveHeader; prefixLength: number } {
  if (bytes.length < BACKUP_MAGIC.length + 4) throw new BackupError('TRUNCATED', 'Backup file is truncated');
  for (let i = 0; i < BACKUP_MAGIC.length; i++) {
    if (bytes[i] !== BACKUP_MAGIC[i]) throw new BackupError('FORMAT', 'Not an Anchor encrypted backup');
  }
  const headerLength = readU32(bytes, BACKUP_MAGIC.length);
  if (headerLength > MAX_HEADER_BYTES) throw new BackupError('FORMAT', 'Backup header is out of bounds');
  const headerStart = BACKUP_MAGIC.length + 4;
  const headerEnd = headerStart + headerLength;
  if (bytes.length < headerEnd) throw new BackupError('TRUNCATED', 'Backup file is truncated');
  let header: ArchiveHeader;
  try {
    header = JSON.parse(new TextDecoder().decode(bytes.subarray(headerStart, headerEnd)));
  } catch {
    throw new BackupError('FORMAT', 'Backup header is malformed');
  }
  if (header.format !== BACKUP_FORMAT) throw new BackupError('FORMAT', 'Not an Anchor encrypted backup');
  if (header.formatVersion !== BACKUP_FORMAT_VERSION || header.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new BackupError('UNSUPPORTED_VERSION', 'Backup was created by a newer or unknown format');
  }
  if (header.cipher !== 'AES-256-GCM' || header.kdf !== 'HKDF-SHA256') throw new BackupError('FORMAT', 'Unsupported backup cipher');
  if (typeof header.salt !== 'string' || header.salt.length !== SALT_BYTES * 2) throw new BackupError('FORMAT', 'Backup salt is malformed');
  if (typeof header.nonce !== 'string' || header.nonce.length !== NONCE_BYTES * 2) throw new BackupError('FORMAT', 'Backup nonce is malformed');
  const remaining = bytes.length - headerEnd;
  if (!Number.isSafeInteger(header.ciphertextBytes) || header.ciphertextBytes < 16) throw new BackupError('FORMAT', 'Backup length is malformed');
  if (remaining < header.ciphertextBytes) throw new BackupError('TRUNCATED', 'Backup file is truncated');
  if (remaining > header.ciphertextBytes) throw new BackupError('FORMAT', 'Backup has trailing data');
  return { header, prefixLength: headerEnd };
}

export function openArchive(bytes: Uint8Array, recoveryKey: Uint8Array): OpenedArchive {
  const { header, prefixLength } = readArchiveHeader(bytes);
  const prefix = bytes.subarray(0, prefixLength);
  const key = deriveKey(recoveryKey, hexToBytes(header.salt));
  try {
    const payload = gcm(key, hexToBytes(header.nonce), prefix).decrypt(bytes.subarray(prefixLength));
    return { header, payload };
  } catch {
    // Wrong secret, altered header and altered ciphertext are indistinguishable here by design.
    throw new BackupError('AUTHENTICATION_FAILED', 'Backup could not be authenticated with this recovery secret');
  } finally {
    key.fill(0);
  }
}

export function sha256Hex(text: string): string {
  return bytesToHex(sha256(utf8ToBytes(text)));
}
