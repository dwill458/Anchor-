# WP-07 — Intention screen parity (port detection)

**Severity:** 🟠 HIGH · **Repo:** `anchor/mobile/`

## Objective
Bring `IntentionInputScreen` (first-run) to parity with `ReturningIntentionScreen` so both apply the same gibberish/quality detection chain.

## Files (touch only these)
- `src/screens/create/IntentionInputScreen.tsx`
- `src/utils/intentionPatterns.ts` (read; extend only if needed)
- `src/hooks/useIntentionValidation.ts` (NEW — shared hook)

## Problem
- `ReturningIntentionScreen.tsx:33` imports `analyzeIntention, detectGibberish, getGuidanceText` and runs them (223-236): length ≥ 6 → `detectGibberish` → `analyzeIntention` (negation/future/vague), priority gibberish → negative → future → vague.
- `IntentionInputScreen.tsx` imports only `detectCategoryFromText` and validates length only (`isValid`, line 163). No quality detection.

## Change
- Create `useIntentionValidation(text)` returning `{ isValid, canSubmit, guidanceText, detection }` that encapsulates: char limits (`minChars=3`, `maxChars=100`), the `length < 6` guard, `detectGibberish`, `analyzeIntention`, and `getGuidanceText` — exactly mirroring ReturningIntentionScreen's order.
- Use the hook in `IntentionInputScreen.tsx` and apply the same `canSubmit` gate + guidance rendering.
- Optionally refactor `ReturningIntentionScreen.tsx` to use the same hook for true single-source parity (only if it stays low-risk; otherwise leave Returning as-is and just match behavior).

## Constraints
- Preserve `detectGibberish`, `analyzeIntention`, `getGuidanceText`, `detectCategoryFromText` names and the existing `minChars`/`maxChars` values.
- Keep both screens' existing copy/UX; only add the missing detection + guidance.

## Acceptance criteria
- Entering gibberish / future-tense / negative / vague text in IntentionInputScreen produces the same guidance and submit-gating as ReturningIntentionScreen.
- `npx tsc --noEmit`; `npx jest IntentionInputScreen ReturningIntentionScreen intentionPatterns` pass (add cases asserting parity).
