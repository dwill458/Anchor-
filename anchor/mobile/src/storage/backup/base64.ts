const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Uint8Array(128).fill(255);
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i;

/** Standard padded base64. Used for binary archive I/O through expo-file-system. */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += ALPHABET[(triple >> 18) & 63] + ALPHABET[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? ALPHABET[(triple >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? ALPHABET[triple & 63] : '=';
  }
  return out;
}

export function base64ToBytes(text: string): Uint8Array {
  if (text.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(text)) throw new Error('Invalid base64');
  const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((text.length / 4) * 3 - padding);
  let offset = 0;
  for (let i = 0; i < text.length; i += 4) {
    const values = [0, 1, 2, 3].map((j) => {
      const ch = text.charCodeAt(i + j);
      if (ch === 61) return 0; // '='
      const value = LOOKUP[ch];
      if (value === 255) throw new Error('Invalid base64');
      return value;
    });
    const triple = (values[0] << 18) | (values[1] << 12) | (values[2] << 6) | values[3];
    if (offset < out.length) out[offset++] = (triple >> 16) & 0xff;
    if (offset < out.length) out[offset++] = (triple >> 8) & 0xff;
    if (offset < out.length) out[offset++] = triple & 0xff;
  }
  return out;
}
