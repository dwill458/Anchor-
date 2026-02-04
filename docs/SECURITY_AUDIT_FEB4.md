# Anchor Security Audit Report (Feb 4, 2026)

## Executive Summary

A comprehensive security audit of the Anchor codebase (React Native + Node.js) was performed. 

**Critical Issues Identified: 3**
**High Severity Issues: 4**

> [!CAUTION]
> **Immediate action required** on Critical items before the Feb 20 launch. The most significant risks are insecure token storage on the client and hardcoded secret fallbacks in the backend.

---

## Vulnerability List

### 🛑 CRITICAL SEVERITY

#### 1. Insecure Token Storage (Mobile)
- **Location**: [authStore.ts:L169](file:///c:/Users/dwill/.gemini/antigravity/scratch/Anchor-V2/apps/mobile/src/stores/authStore.ts#L169)
- **Description**: The authentication token is persisted using `AsyncStorage`. On both iOS and Android, `AsyncStorage` is not encrypted by default and can be accessed by other processes or via physical access.
- **Fix**: Migrate `token` storage to `expo-secure-store`.
```typescript
// Proposed Fix in authStore.ts
import * as SecureStore from 'expo-secure-store';

const secureStorage = {
  getItem: (name: string) => SecureStore.getItemAsync(name),
  setItem: (name: string, value: string) => SecureStore.setItemAsync(name, value),
  removeItem: (name: string) => SecureStore.deleteItemAsync(name),
};
```

#### 2. Hardcoded JWT Secret Fallback (Backend)
- **Location**: [auth.ts:L63](file:///c:/Users/dwill/.gemini/antigravity/scratch/Anchor-V2/backend/src/api/middleware/auth.ts#L63)
- **Description**: The JWT verification falls back to the string `'secret'` if `process.env.JWT_SECRET` is missing. This allows trivial token forgery if the environment variable is not set correctly in production.
- **Fix**: Remove the fallback and throw an error if the secret is missing during startup.
```typescript
// Fix in env.ts
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('CRITICAL: JWT_SECRET must be set in production');
}
```

#### 3. Mocked Production Authentication (Mobile)
- **Location**: [AuthService.ts](file:///c:/Users/dwill/.gemini/antigravity/scratch/Anchor-V2/apps/mobile/src/services/AuthService.ts)
- **Description**: The entire `AuthService` is in "MOCK MODE", returning hardcoded static tokens. The production Firebase integration is missing or bypassed.
- **Fix**: Implement the real Firebase Authentication flow and remove mock overrides before launch.

---

### 🟠 HIGH SEVERITY

#### 4. Broad CORS Policy
- **Location**: [index.ts:L29](file:///c:/Users/dwill/.gemini/antigravity/scratch/Anchor-V2/backend/src/index.ts#L29)
- **Description**: `app.use(cors())` allows all origins (`*`). This exposes the API to Cross-Origin Resource Sharing attacks.
- **Fix**: Define specific allowed origins.
```typescript
app.use(cors({ origin: env.ALLOWED_ORIGINS }));
```

#### 5. Missing Security Headers (Helmet)
- **Location**: [index.ts](file:///c:/Users/dwill/.gemini/antigravity/scratch/Anchor-V2/backend/src/index.ts)
- **Description**: The backend does not use `helmet` middleware to set essential security headers (HSTS, CSP, Frame Options, etc.).
- **Fix**: Install and use `helmet`.
```typescript
import helmet from 'helmet';
app.use(helmet());
```

#### 6. Absent Rate Limiting
- **Location**: [index.ts](file:///c:/Users/dwill/.gemini/antigravity/scratch/Anchor-V2/backend/src/index.ts)
- **Description**: No rate limiting is applied to auth or AI endpoints, leaving the service vulnerable to Brute Force and Denial of Service (DoS) attacks.
- **Fix**: Apply `express-rate-limit`.
```typescript
import rateLimit from 'express-rate-limit';
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);
```

#### 7. SVG Sanitization (XSS Risk)
- **Location**: [anchors.ts:L39](file:///c:/Users/dwill/.gemini/antigravity/scratch/Anchor-V2/backend/src/api/routes/anchors.ts#L39)
- **Description**: SVGs are accepted and stored as raw strings without sanitization. If rendered directly in the mobile app via a WebView or specific libraries, this could lead to XSS.
- **Fix**: Sanitize SVGs using `dompurify` or similar on the backend before storage.

---

### 🟡 MEDIUM SEVERITY

#### 8. Sensitive Metadata Logging
- **Location**: [logger.ts:L38](file:///c:/Users/dwill/.gemini/antigravity/scratch/Anchor-V2/backend/src/utils/logger.ts#L38)
- **Description**: `JSON.stringify(meta)` is used in logs. If a user object or request body containing passwords/tokens is passed, it will be logged in plaintext.
- **Fix**: Implement a redaction utility to mask sensitive keys (`password`, `email`, `token`).

---

## GDPR/CCPA Compliance Checklist

| Item | Status | Notes |
|------|--------|-------|
| Right to Erasure (Deletion) | ✅ Partial | `DELETE /api/auth/me` implemented with cascades. |
| Right to Access (Data Export) | ❌ Missing | No endpoint for users to download their data. |
| Data Minimization | ⚠️ Warning | `intentionText` stored in plain text. |
| Consent Management | ❌ Missing | No explicit cookie/data consent tracking in mobile. |

---

## Recommendations for Immediate Fixes (Next 48 Hours)

1. **Secure Storage**: Switch `useAuthStore` to use a SecureStore-backed storage engine.
2. **Backend Hardening**: Add `helmet`, specific `cors` origins, and `rate-limit`.
3. **Internal Security**: Set `JWT_SECRET` properly and disable non-secure fallbacks.

## Long-term Security Improvements
1. **End-to-End Encryption**: Encrypt `intentionText` on the client so the backend never sees the raw intention.
2. **Robust Validation**: Replace manual logic in `auth.ts` and `anchors.ts` with `zod` schemas.
3. **Penetration Testing**: Perform a professional pen test after the mock auth is replaced.
