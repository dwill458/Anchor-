# PR: Narrative Onboarding & Intention "Quiet Room" Flow

## 🌟 Overview
This PR implements a refined, psychologically grounded onboarding flow ("Narrative Onboarding") and a redesigned Intention Input screen ("Quiet Room") that prioritizes user focus, safety, and intention-setting. It fundamentally shifts the first-time user experience from a generic signup to an immersive, ritualistic entry.

## 🎨 Key Changes

### 1. Narrative Onboarding Flow (`NarrativeOnboardingScreen.tsx`)
*   **5-Step Narrative:** Implemented a paced, copy-forward sequence that explains the "Why" and "How" of Anchor before the "What".
*   **Variable Pacing:** Screen transitions are timed (slower for orientation, faster for method, distinct for commitment) to guide the user's breathing and attention.
*   **Momentum Lock:** Swipe-back navigation is disabled from Screen 3 onwards to subtly reinforce forward commitment.
*   **Visual Progress:** A custom progress dot system that fades previous steps when the final commitment screen is reached.
*   **Haptic Design:** Haptic feedback is reserved exclusively for high-impact moments (creating the first anchor, "Begin") to maintain significance.

### 2. Intention Input "Quiet Room" (`IntentionInputScreen.tsx`)
*   **Zero-Distraction Interface:** Removed headers, back arrows, and complex navigation to create a "Quiet Room" container.
*   **Psychological Safety Copy:**
    *   Header: "What are you anchoring right now?" (Present & Grounded)
    *   Reassurance: "You can refine or release this later." (Lowers inhibition)
*   **Rotating Inspirations:** The input placeholder rotates through a curated pool of examples (e.g., "Respond calmly under pressure", "Finish what I start") to prevent comparison anxiety.
*   **Micro-Interactions:**
    *   **Focus Glow:** A gentle scale and glow animation when the input is tapped.
    *   **Intentional Submission:** The keyboard "Done" button is disabled/hidden to force a manual tap on the "Continue" button, making the act of submitting feels deliberate.

### 3. Navigation & Architecture
*   **Seamless Hand-off:** The transition from Onboarding -> Vault -> Intention Input is now immediate. The "Vault" screen detects the post-onboarding state and redirects instantly.
*   **Tab Bar Logic:** The main bottom tab bar now intelligently hides itself when entering sub-flows (like Anchor Creation) to prevent visual clutter and accidental exit.
*   **VaultStackNavigator:** Configured `headerShown: false` for the Create flow to support the immersive design.

## 🧪 Testing Checklist
- [x] Complete the 5-step onboarding flow.
- [x] Verify "Why this works" link on Screen 2.
- [x] Confirm swipe-back is disabled after Screen 3.
- [x] Tap "Begin" and verify immediate transition to Intention Input.
- [x] Verify Intention Input has no header/back arrow.
- [x] Check that placeholder text changes on reload.
- [x] Verify focus animation on the text input.
- [x] Ensure "Continue" button is visible and not blocked by the keyboard or tab bar.
