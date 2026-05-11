# Quick Start: AI Parallel Workflow Prompts

Copy-paste these prompts directly into each AI to start parallel development.

---

## 🔵 CLAUDE SONNET 4.5 - Track 1: Test Infrastructure

### Branch: `claude/test-infrastructure-track1`

**Start with this prompt:**

```
I'm working on the Anchor mobile app test suite. We currently have 57 failing tests out of 283 (79.9% pass rate). I need to fix the remaining failures to reach 95%+ pass rate.

CONTEXT:
- Branch: claude/test-infrastructure-track1
- Recent fixes: DurationSelectionStep event handlers, BurningRitualScreen timeouts
- Phase 1-4 test fixes already completed (see docs/PHASE4_TEST_FIXES_FEB3.md)

CURRENT FAILING TESTS (Priority Order):
1. LoadingSpinner tests (3 failures) - accessibility role not found
2. BreathingAnimation tests (module not found) - file moved/renamed
3. DurationSelectionStep (1 failure) - disabled button state check
4. ApiClient tests (2 failures) - hardcoded config values
5. Sigil generator tests (2 failures) - SVG structure mismatch
6. Remaining component tests (~47 failures) - need investigation

REQUIREMENTS:
1. Run tests to identify exact failure reasons: npm test
2. Fix failures one category at a time (highest priority first)
3. Use modern async patterns (act() with fake timers, waitFor for real async)
4. Ensure type safety in all mocks
5. Update test documentation after each phase
6. Commit after fixing each category

CONSTRAINTS:
- DO NOT modify production code unless absolutely necessary
- Prefer fixing test expectations over changing implementation
- Use existing mock patterns from src/__tests__/setup.ts
- All fixes must maintain or improve test execution speed

OUTPUT:
- Commit message for each fix phase
- Updated pass rate after each phase
- Document any production code changes required
- Final summary with 95%+ pass rate achieved

Start by running the tests and categorizing the 57 failures by root cause.
```

---

## 🟢 GEMINI 2.0 - Track 2: Security & Analytics

### Branch: `gemini/security-analytics-track2`

**Start with this prompt:**

```
I need you to perform a comprehensive security audit of the Anchor mobile app (React Native frontend + Node.js/Express backend). This is a production app launching in 16 days.

CONTEXT:
- Branch: gemini/security-analytics-track2
- App: Ritual anchor mobile app with meditation/focus rituals
- Stack: React Native (Expo), Node.js, Express, Prisma, PostgreSQL
- User data: Email, password, intentions (sensitive), ritual history, subscription status
- Launch: February 20, 2026 (16 days)

CODEBASE STRUCTURE:
Frontend:
- apps/mobile/src/ (React Native app)
- apps/mobile/src/services/ApiClient.ts (API communication)
- apps/mobile/src/services/AuthService.ts (authentication)
- apps/mobile/src/screens/auth/ (login/signup)

Backend:
- backend/src/api/routes/ (API endpoints)
- backend/src/middleware/ (auth, validation, error handling)
- backend/src/api/routes/auth.ts (authentication endpoints)
- backend/prisma/schema.prisma (database schema)

AUDIT SCOPE:
1. Authentication & Authorization
   - JWT token security (rotation, expiration, secure storage)
   - Password hashing (bcrypt strength, salt rounds)
   - Session management
   - OAuth implementation (Google, Apple)

2. Data Protection
   - Sensitive data handling (user intentions, ritual data)
   - Encryption at rest and in transit
   - AsyncStorage security (mobile)
   - Database security (Prisma, PostgreSQL)

3. API Security
   - Input validation and sanitization
   - SQL injection prevention
   - XSS prevention
   - CSRF protection
   - Rate limiting
   - CORS configuration

4. OWASP Top 10 (2025)
   - Check for all vulnerabilities
   - Broken Access Control
   - Cryptographic Failures
   - Injection
   - Insecure Design
   - Security Misconfiguration

5. Mobile-Specific Security
   - Secure storage (iOS Keychain, Android Keystore)
   - Certificate pinning
   - Code obfuscation
   - Deep linking security
   - Biometric authentication security

6. GDPR/CCPA Compliance
   - Account deletion (implemented in backend/src/api/routes/auth.ts DELETE /api/auth/me)
   - Data export capability
   - Consent management
   - Right to be forgotten
   - Privacy policy enforcement

REQUIREMENTS:
1. Use your 2M token context window to analyze the ENTIRE codebase
2. Identify vulnerabilities by severity (CRITICAL, HIGH, MEDIUM, LOW)
3. Provide specific file:line references for each issue
4. Suggest concrete fixes with code examples
5. Check for credential leaks, hardcoded secrets, API keys
6. Verify environment variable usage

OUTPUT FORMAT:
Create docs/SECURITY_AUDIT_FEB4.md with:
- Executive Summary (Critical issues count)
- Vulnerability List (severity, location, description, fix)
- GDPR/CCPA Compliance Checklist
- Recommendations for immediate fixes before launch
- Long-term security improvements

Start by reading the entire codebase and creating a security vulnerability map.
```

---

## 🟠 CODEX (GPT-4) - Track 3: Services & Components

### Branch: `codex/services-components-track3`

**Start with this prompt:**

```
I need you to implement all remaining service methods in the Anchor mobile app services layer. Many services have TODO comments or stubbed methods.

CONTEXT:
- Branch: codex/services-components-track3
- Language: TypeScript (strict mode)
- Platform: React Native (Expo)
- Services location: apps/mobile/src/services/

SERVICES TO COMPLETE:

1. NotificationService.ts
   Status: Partially implemented
   Missing:
   - scheduleRitualReminder(anchorId, time)
   - cancelReminder(reminderId)
   - handleNotificationClick(notification)
   - requestPermissions()

2. BiometricService.ts
   Status: Partially implemented
   Missing:
   - authenticate(reason: string): Promise<boolean>
   - hasHardware(): Promise<boolean>
   - isEnrolled(): Promise<boolean>
   - getSupportedTypes(): Promise<string[]>

3. StorageService.ts (may not exist - need to create)
   Purpose: Abstraction over AsyncStorage
   Methods needed:
   - setItem(key, value)
   - getItem(key)
   - removeItem(key)
   - clear()
   - getAllKeys()
   - multiGet(keys)
   - multiSet(keyValuePairs)

4. SyncService.ts (may not exist - need to create)
   Purpose: Sync local state with backend
   Methods needed:
   - syncAnchors(): Promise<void>
   - syncUserProfile(): Promise<void>
   - handleConflict(localData, remoteData)
   - getLastSyncTime(): Promise<Date>

REQUIREMENTS:
1. Follow existing service patterns (see AuthService.ts, ApiClient.ts)
2. Use TypeScript strict mode (no any types)
3. Comprehensive error handling with try/catch
4. JSDoc comments for all public methods
5. Use Expo APIs where appropriate (expo-notifications, expo-local-authentication)
6. Mock implementations for easier testing
7. Environment-aware (dev/staging/prod)

CODE STYLE:
- Export as singleton or class with static methods
- Use async/await (not .then())
- Descriptive error messages
- Return Result<T, Error> pattern or throw typed errors

DELIVERABLES:
1. Fully implemented service files
2. Type definitions for all methods
3. JSDoc documentation
4. Basic unit tests (mock external dependencies)
5. Usage examples in comments

OUTPUT:
- Complete implementation for each service
- Any new files created
- Commit message

Start with NotificationService.ts and BiometricService.ts since they're partially complete.
```

---

## 📋 Status Tracking Template

After starting, each AI should update: `docs/PARALLEL_WORKFLOW_STATUS.md`

```markdown
## Latest Update
**AI**: [Claude/Gemini/Codex]
**Date**: [YYYY-MM-DD HH:MM UTC]
**Branch**: [branch-name]
**Status**: [In Progress / Complete / Blocked]
**Commits**: [list of commit SHAs]
**Progress**: [e.g., "Fixed 30/57 test failures (52%)"]
**Next Steps**: [what's next]
**Blockers**: [any blockers or NONE]
**ETA**: [estimated completion time]
```

---

## 🎯 Success Metrics

Track progress toward these goals:

| Track | Metric | Start | Target | Current |
|-------|--------|-------|--------|---------|
| **Claude** | Test pass rate | 79.9% | 95%+ | ___ |
| **Claude** | Code coverage | 33% | 70%+ | ___ |
| **Gemini** | Critical security issues | Unknown | 0 | ___ |
| **Gemini** | Services implemented | 0/3 | 3/3 | ___ |
| **Codex** | Service completions | 0/4 | 4/4 | ___ |
| **Codex** | Component additions | 0/6 | 6/6 | ___ |

---

## 🔄 Merge Order

When each track completes:

1. **CODEX merges first** → `codex/services-components-track3` to `main`
2. **GEMINI merges second** → `gemini/security-analytics-track2` to `main`
3. **CLAUDE merges last** → `claude/test-infrastructure-track1` to `main`

After each merge, run:
```bash
npm test
npm run build
```

---

## ⚠️ Important Notes

- **Work in designated branches only**
- **Commit frequently with clear messages**
- **Update status document after significant progress**
- **Tag blockers immediately**
- **Don't merge until your track is 100% complete**

---

## 📞 Coordination

If you need help:
1. Document the issue in status file
2. Tag: `@human-developer` for assistance
3. Continue with non-blocked work

If you finish early:
1. Review other AI's work
2. Look for integration issues
3. Start documentation improvements

---

**Full Details**: See `docs/PARALLEL_AI_WORKFLOW.md`

**Launch Target**: February 20, 2026 (16 days)

**Let's ship this! 🚀**
