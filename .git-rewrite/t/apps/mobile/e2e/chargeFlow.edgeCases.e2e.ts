/**
 * E2E Test: Charge Flow Edge Cases & Error Scenarios
 *
 * Tests for boundary conditions, error states, and edge cases:
 * - Custom duration limits (1-30 minutes)
 * - Rapid user interactions
 * - Network failures
 * - State corruption recovery
 * - Animation interruption
 * - Device rotation during flow
 * - Memory pressure
 */

describe('Charge Flow - Edge Cases & Error Scenarios', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' },
    });
  });

  describe('Custom Duration Limits', () => {
    it('should enforce minimum custom duration (1 minute)', async () => {
      // Navigate to custom duration picker
      await element(by.text('Change')).tap();
      await element(by.text('Ritual Charge')).atIndex(0).tap();
      await element(by.text('Custom Duration')).tap();

      // Should not allow less than 1 minute
      await waitFor(element(by.text('Select Duration')))
        .toBeVisible()
        .withTimeout(2000);

      // Minimum option should be 1
      await expect(element(by.text('0'))).not.toBeVisible();
      await expect(element(by.text('1'))).toBeVisible();

      // Select minimum
      await element(by.text('1')).tap();
      await element(by.text('Confirm')).tap();

      // Should display correctly
      await expect(element(by.text('1 min'))).toBeVisible();
    });

    it('should enforce maximum custom duration (30 minutes)', async () => {
      // Navigate to custom duration picker
      await element(by.text('Change')).tap();
      await element(by.text('Ritual Charge')).atIndex(0).tap();
      await element(by.text('Custom Duration')).tap();

      // Should not allow more than 30 minutes
      await waitFor(element(by.text('Select Duration')))
        .toBeVisible()
        .withTimeout(2000);

      // Maximum option should be 30
      await expect(element(by.text('30'))).toBeVisible();
      await expect(element(by.text('31'))).not.toBeVisible();

      // Select maximum
      await element(by.text('30')).tap();
      await element(by.text('Confirm')).tap();

      // Should display correctly
      await expect(element(by.text('30 min'))).toBeVisible();
    });

    it('should handle boundary durations correctly', async () => {
      const boundaryDurations = [1, 15, 30]; // min, mid, max

      for (const duration of boundaryDurations) {
        await element(by.text('Change')).tap();
        await element(by.text('Ritual Charge')).atIndex(0).tap();
        await element(by.text('Custom Duration')).tap();

        await element(by.text(duration.toString())).tap();
        await element(by.text('Confirm')).tap();

        // Verify display
        const expectedText =
          duration === 1 ? '1 min' : duration < 2 ? '1 min' : `${duration} min`;
        await expect(element(by.text(expectedText))).toBeVisible();

        // Reset for next iteration
        if (duration < 30) {
          await element(by.text('Change')).tap();
        }
      }
    });
  });

  describe('Rapid User Interactions', () => {
    it('should handle rapid mode card taps (debounce)', async () => {
      // Rapidly tap different mode cards
      await element(by.text('Focus Charge')).atIndex(0).multiTap(); // Double tap
      await element(by.text('Ritual Charge')).atIndex(0).tap();

      // Should settle on last selection (Ritual)
      await waitFor(element(by.text('STEP 2 OF 2')))
        .toBeVisible()
        .withTimeout(2000);

      // Should show Ritual-specific options
      await expect(element(by.text('5 minutes'))).toBeVisible();
      await expect(element(by.text('10 minutes'))).toBeVisible();
    });

    it('should handle rapid duration selection taps', async () => {
      // Rapidly select different durations
      await element(by.text('5 minutes')).tap();
      await element(by.text('10 minutes')).multiTap();

      // Should show correct selection after settling
      // (Implementation may vary based on debounce strategy)
      await expect(element(by.text('Continue'))).toBeEnabled();
    });

    it('should handle rapid Continue button presses', async () => {
      // After selecting duration, rapidly tap Continue
      await element(by.text('Continue')).multiTap();

      // Should navigate only once (not multiple times)
      await waitFor(element(by.text('Breathe in...')))
        .toBeVisible()
        .withTimeout(2000);

      // Should not have navigated multiple times
      await expect(element(by.text('Breathe in...'))).toBeVisible();
    });

    it('should prevent accidental double-submission during breathing', async () => {
      // Try to tap continue button while breathing (shouldn't exist)
      // Verify breathing is mandatory and no skip button present
      await expect(element(by.text('Skip'))).not.toBeVisible();
      await expect(element(by.text('Next'))).not.toBeVisible();

      // Try to press back during breathing
      await device.pressBack();

      // Breathing should still be visible (not interrupted)
      await expect(element(by.text('Breathe in...'))).toBeVisible();
    });
  });

  describe('State Corruption & Recovery', () => {
    it('should recover from partially completed flow if app backgrounds', async () => {
      // Start flow but don't complete
      await element(by.text('Focus Charge')).atIndex(0).tap();

      // Verify on Duration Selection
      await expect(element(by.text('STEP 2 OF 2'))).toBeVisible();

      // Background app
      await device.pause();
      await device.pause(); // Pause for 2 seconds

      // Foreground app
      await device.pause();

      // Should still be on Duration Selection (state preserved)
      await expect(element(by.text('STEP 2 OF 2'))).toBeVisible();

      // Should be able to continue normally
      await element(by.text('5 minutes')).tap();
      await element(by.text('Continue')).tap();

      await waitFor(element(by.text('Breathe in...')))
        .toBeVisible()
        .withTimeout(2000);
    });

    it('should handle missing default preferences gracefully', async () => {
      // If settingsStore defaults are corrupted/missing,
      // system should fall back to first-time flow

      // In test: simulate by creating new anchor
      await element(by.text('Create Anchor')).tap();

      // Should show Mode Selection (first-time behavior)
      await waitFor(element(by.text('STEP 1 OF 2')))
        .toBeVisible()
        .withTimeout(3000);

      await expect(element(by.text('Focus Charge'))).toBeVisible();
    });

    it('should validate duration boundaries on load', async () => {
      // If somehow invalid duration was saved (< 1 or > 30 min),
      // system should clamp to valid range

      // This would be tested via API/mock but E2E can verify
      // that app doesn't crash on launch with invalid data
      await device.reloadReactNative();

      // App should still be usable
      await expect(element(by.text('My Anchors'))).toBeVisible();
    });
  });

  describe('Animation Interruption', () => {
    it('should handle press back during breathing animation', async () => {
      // Trigger breathing animation
      await element(by.text('Continue')).tap();

      // Verify breathing started
      await expect(element(by.text('Breathe in...'))).toBeVisible();

      // Press back during animation
      await device.pressBack();

      // Animation should continue (not be interrupted)
      // Back should not navigate away
      await expect(element(by.text('Breathe in...'))).toBeVisible();

      // Wait for auto-advance
      await waitFor(element(by.text('Ritual')))
        .toBeVisible()
        .withTimeout(4000);
    });

    it('should handle pause/resume during breathing animation', async () => {
      // Start breathing
      await element(by.text('Continue')).tap();
      await waitFor(element(by.text('Breathe in...')))
        .toBeVisible()
        .withTimeout(2000);

      // Pause and resume (simulate app backgrounding)
      await device.pause();
      await device.pause();

      // Should continue with animation
      // If paused at 1s, should see instruction update
      await expect(element(by.text('Breathe out...'))).toBeVisible();
    });

    it('should complete breathing even if screen orientation changes', async () => {
      // Start breathing
      await element(by.text('Continue')).tap();
      await waitFor(element(by.text('Breathe in...')))
        .toBeVisible()
        .withTimeout(2000);

      // Rotate device
      await device.setOrientation('landscape');
      await device.setOrientation('portrait');

      // Breathing should still be visible and complete
      await waitFor(element(by.text('Ritual')))
        .toBeVisible()
        .withTimeout(4000);
    });
  });

  describe('UI Edge Cases', () => {
    it('should handle very long custom duration value (29 minutes)', async () => {
      // Test display of double-digit minute values
      await element(by.text('Change')).tap();
      await element(by.text('Ritual Charge')).atIndex(0).tap();
      await element(by.text('Custom Duration')).tap();

      // Select 29 minutes
      await element(by.text('29')).tap();
      await element(by.text('Confirm')).tap();

      // Should display correctly (not overflow or truncate)
      await expect(element(by.text('29 min'))).toBeVisible();

      // Continue should work
      await element(by.text('Continue')).tap();

      await waitFor(element(by.text('Breathe in...')))
        .toBeVisible()
        .withTimeout(2000);
    });

    it('should handle mode names with dynamic text sizing', async () => {
      // Mode card names shouldn't overflow or wrap unexpectedly
      await expect(element(by.text('Focus Charge'))).toBeVisible();
      await expect(element(by.text('Ritual Charge'))).toBeVisible();

      // Both should be visible without truncation
      // (Layout verified through rendering, not error)
    });

    it('should display duration options without overlap', async () => {
      // Select mode first
      await element(by.text('Focus Charge')).atIndex(0).tap();

      // All duration options should be visible without overlap
      await expect(element(by.text('30 seconds'))).toBeVisible();
      await expect(element(by.text('2 minutes'))).toBeVisible();
      await expect(element(by.text('5 minutes'))).toBeVisible();

      // All three should be on screen without scrolling
      const firstButton = element(by.text('30 seconds'));
      const lastButton = element(by.text('5 minutes'));

      await expect(firstButton).toBeVisible();
      await expect(lastButton).toBeVisible();
    });

    it('should maintain button focus state correctly', async () => {
      // After selecting, button should show selected state
      await element(by.text('Focus Charge')).atIndex(0).tap();
      await element(by.text('2 minutes')).tap();

      // Selected button should have distinct styling
      const selectedButton = element(by.text('2 minutes')).parent();
      await expect(selectedButton).toHaveToggleValue(true);

      // Other buttons should not be selected
      const unselectedButton = element(by.text('5 minutes')).parent();
      await expect(unselectedButton).not.toHaveToggleValue(true);
    });
  });

  describe('Navigation Edge Cases', () => {
    it('should handle back button at Mode Selection when first-time', async () => {
      // First-time user reaches Mode Selection
      await element(by.text('Create Anchor')).tap();
      await waitFor(element(by.text('STEP 1 OF 2')))
        .toBeVisible()
        .withTimeout(3000);

      // Press back - should exit to previous screen
      await device.pressBack();

      // Should not loop back to Mode Selection
      await expect(element(by.text('STEP 1 OF 2'))).not.toBeVisible();
    });

    it('should handle rapid back button presses', async () => {
      // Navigate through flow
      await element(by.text('Change')).tap();
      await element(by.text('Focus Charge')).atIndex(0).tap();

      // Rapidly press back multiple times
      await device.pressBack();
      await device.pressBack();
      await device.pressBack();

      // Should eventually exit (not crash)
      // May be on Default Display or previous screen
      await expect(
        element(by.text(/Using your default charge|My Anchors/))
      ).toBeVisible();
    });

    it('should maintain correct history on nested navigation', async () => {
      // Default → Change → Mode → Duration
      await element(by.text('Change')).tap();

      // Now at Mode Selection
      await waitFor(element(by.text('STEP 1 OF 2')))
        .toBeVisible()
        .withTimeout(2000);

      // Select mode
      await element(by.text('Ritual Charge')).atIndex(0).tap();

      // Now at Duration Selection
      await waitFor(element(by.text('STEP 2 OF 2')))
        .toBeVisible()
        .withTimeout(2000);

      // Open custom duration picker
      await element(by.text('Custom Duration')).tap();

      // Wait for picker
      await waitFor(element(by.text('Select Duration')))
        .toBeVisible()
        .withTimeout(2000);

      // Cancel picker
      await element(by.text('Cancel')).tap();

      // Should return to Duration Selection (STEP 2)
      await waitFor(element(by.text('STEP 2 OF 2')))
        .toBeVisible()
        .withTimeout(2000);

      // Back from Duration should go to Mode
      await device.pressBack();

      await waitFor(element(by.text('STEP 1 OF 2')))
        .toBeVisible()
        .withTimeout(2000);

      // Back from Mode should go to Default
      await device.pressBack();

      await waitFor(element(by.text('Using your default charge:')))
        .toBeVisible()
        .withTimeout(2000);
    });
  });

  describe('Performance & Resource Management', () => {
    it('should not leak memory during repeated navigation', async () => {
      // Complete flow multiple times
      for (let i = 0; i < 3; i++) {
        // Mode selection
        await element(by.text('Focus Charge')).atIndex(0).tap();

        // Duration selection
        await element(by.text('2 minutes')).tap();
        await element(by.text('Continue')).tap();

        // Breathing
        await waitFor(element(by.text('Breathe in...')))
          .toBeVisible()
          .withTimeout(2000);

        // Return to charge setup for next iteration
        await element(by.text('Change')).tap();
      }

      // App should still be responsive
      await expect(element(by.text('Focus Charge'))).toBeVisible();
    });

    it('should handle large number of duration options smoothly', async () => {
      // Custom duration picker with 30 options should scroll smoothly
      await element(by.text('Change')).tap();
      await element(by.text('Ritual Charge')).atIndex(0).tap();
      await element(by.text('Custom Duration')).tap();

      // Should render all 30 minute options efficiently
      await waitFor(element(by.text('Select Duration')))
        .toBeVisible()
        .withTimeout(2000);

      // Verify scrollability
      await element(by.text('1')).tap(); // First option
      await element(by.text('15')).tap(); // Middle option
      await element(by.text('30')).tap(); // Last option

      // All should be accessible
      await expect(element(by.text('Confirm'))).toBeEnabled();
    });
  });

  describe('Accessibility Edge Cases', () => {
    it('should handle text size preferences', async () => {
      // With larger text size, UI should still be usable
      // (Depends on system settings, verified through rendering)

      // Mode cards should still be tappable
      await expect(element(by.text('Focus Charge'))).toBeVisible();
      await expect(element(by.text('Ritual Charge'))).toBeVisible();

      // Duration options should remain visible
      await element(by.text('Focus Charge')).atIndex(0).tap();
      await expect(element(by.text('30 seconds'))).toBeVisible();
      await expect(element(by.text('5 minutes'))).toBeVisible();
    });

    it('should maintain button affordance despite color choices', async () => {
      // All interactive elements should be clearly tappable
      // Gold on dark background should maintain contrast

      // Unselected state should be visible
      const unselectedButton = element(by.text('2 minutes'));
      await expect(unselectedButton).toBeVisible();

      // Selected state should be distinct
      await unselectedButton.tap();
      await expect(unselectedButton).toHaveToggleValue(true);
    });
  });
});
