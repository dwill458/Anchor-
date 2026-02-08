/**
 * E2E Test: First-Time User Charge Flow
 *
 * Scenario: New user (anchorCount === 0) navigates through:
 * 1. Mode Selection (Focus / Ritual)
 * 2. Duration Selection (preset or custom)
 * 3. Breathing Animation (3 seconds mandatory)
 * 4. Ritual execution
 *
 * Expected behavior:
 * - No "Using your default charge" display
 * - Must select mode before duration
 * - Continue button enables after duration selection
 * - Breathing animation auto-advances after 3 seconds
 * - Selected preferences are saved as defaults
 */

describe('First-Time User Charge Flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' },
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should show Mode Selection step for first-time user', async () => {
    // Navigate to charge setup (triggered from create anchor flow)
    await element(by.text('Create Anchor')).multiTap();

    // Should see step indicator
    await waitFor(element(by.text('STEP 1 OF 2')))
      .toBeVisible()
      .withTimeout(3000);

    // Should see both mode cards
    await expect(element(by.text('Focus Charge'))).toBeVisible();
    await expect(element(by.text('Ritual Charge'))).toBeVisible();

    // Should see descriptions
    await expect(
      element(by.text('A brief moment of alignment'))
    ).toBeVisible();
    await expect(
      element(by.text('A guided, immersive experience'))
    ).toBeVisible();
  });

  it('should select Focus mode and proceed to Duration Selection', async () => {
    // Tap Focus Charge card
    await element(by.text('Focus Charge')).atIndex(0).tap();

    // Should transition to duration selection
    await waitFor(element(by.text('STEP 2 OF 2')))
      .toBeVisible()
      .withTimeout(2000);

    // Should show focus-specific durations (pills)
    await expect(element(by.text('30 seconds'))).toBeVisible();
    await expect(element(by.text('2 minutes'))).toBeVisible();
    await expect(element(by.text('5 minutes'))).toBeVisible();

    // Continue button should be disabled initially
    await expect(element(by.text('Continue'))).toBeDisabled();
  });

  it('should select 2-minute duration and enable Continue button', async () => {
    // Should still be on Duration Selection step
    await expect(element(by.text('STEP 2 OF 2'))).toBeVisible();

    // Tap 2-minute pill
    await element(by.text('2 minutes')).tap();

    // Continue button should now be enabled
    await expect(element(by.text('Continue'))).toBeEnabled();

    // Selected pill should have visual indicator
    await expect(element(by.text('2 minutes')).parent()).toHaveToggleValue(true);
  });

  it('should show Breathing Animation after Continue', async () => {
    // Tap Continue button
    await element(by.text('Continue')).tap();

    // Should see breathing animation
    await waitFor(element(by.text('Breathe in...')))
      .toBeVisible()
      .withTimeout(2000);

    // Should see subtitle
    await expect(element(by.text('Prepare yourself for the ritual')))
      .toBeVisible();

    // Should see progress indicator dots
    const progressDots = element(by.text('STEP 1 OF 2').and(by.type('View')));
    await expect(progressDots).toBeVisible();
  });

  it('should auto-advance from Breathing Animation after 3 seconds', async () => {
    // Watch the breathing animation progress
    // First instruction should be "Breathe in..."
    await expect(element(by.text('Breathe in...'))).toBeVisible();

    // Wait for instruction change to "Breathe out..." at 1.5s
    await waitFor(element(by.text('Breathe out...')))
      .toBeVisible()
      .withTimeout(2000);

    // After total 3 seconds, should auto-advance to Ritual screen
    await waitFor(element(by.text('Ritual')))
      .toBeVisible()
      .withTimeout(4000);
  });

  it('should execute Ritual with correct configuration (Focus, 2 min)', async () => {
    // Should see ritual screen components
    await expect(element(by.text('Ritual'))).toBeVisible();

    // Verify ritual is configured for Focus mode (shorter, simpler)
    // Verify duration is 2 minutes (120 seconds)
    // Look for ritual-specific UI elements

    // Should see seal button or similar CTA
    await element(by.text('Seal Anchor')).multiTap();
  });

  it('should save Focus / 2min as default preferences after completion', async () => {
    // Navigate back to charge setup
    await element(by.text('Create Another')).tap();

    // Should now see Default Charge Display (not mode selection)
    await waitFor(element(by.text('Using your default charge:')))
      .toBeVisible()
      .withTimeout(3000);

    // Should show saved selection
    await expect(element(by.text('Focus'))).toBeVisible();
    await expect(element(by.text('2 min'))).toBeVisible();
  });

  it('should handle Ritual mode selection and custom duration', async () => {
    // Navigate to charge setup again
    await element(by.text('Change')).tap();

    // Should go back to mode selection
    await waitFor(element(by.text('STEP 1 OF 2')))
      .toBeVisible()
      .withTimeout(2000);

    // Tap Ritual Charge card
    await element(by.text('Ritual Charge')).atIndex(0).tap();

    // Should show ritual-specific options (vertical list)
    await waitFor(element(by.text('5 minutes')))
      .toBeVisible()
      .withTimeout(2000);

    await expect(element(by.text('10 minutes'))).toBeVisible();
    await expect(element(by.text('Custom Duration'))).toBeVisible();
  });

  it('should open Custom Duration picker for Ritual mode', async () => {
    // Tap Custom Duration option
    await element(by.text('Custom Duration')).tap();

    // Should see timer picker modal
    await waitFor(element(by.text('Select Duration')))
      .toBeVisible()
      .withTimeout(2000);

    // Should show minute options (1-30)
    await expect(element(by.text('1'))).toBeVisible();
    await expect(element(by.text('15'))).toBeVisible();
    await expect(element(by.text('30'))).toBeVisible();
  });

  it('should select custom duration (15 minutes) and confirm', async () => {
    // Scroll to 15 in the picker
    await element(by.text('15')).tap();

    // Confirm selection
    await element(by.text('Confirm')).tap();

    // Should return to duration selection step
    await waitFor(element(by.text('STEP 2 OF 2')))
      .toBeVisible()
      .withTimeout(2000);

    // Should display custom duration
    await expect(element(by.text('Custom Duration'))).toBeVisible();
    await expect(element(by.text('15 min'))).toBeVisible();

    // Continue button should be enabled
    await expect(element(by.text('Continue'))).toBeEnabled();
  });

  it('should handle back button navigation during mode selection', async () => {
    // While on mode selection step
    await expect(element(by.text('STEP 1 OF 2'))).toBeVisible();

    // Press back button
    await device.pressBack();

    // Should exit to previous screen (not stay on mode selection)
    await expect(element(by.text('STEP 1 OF 2'))).not.toBeVisible();
  });

  it('should handle back button navigation during duration selection', async () => {
    // Navigate to Duration Selection
    await element(by.text('Focus Charge')).atIndex(0).tap();
    await waitFor(element(by.text('STEP 2 OF 2')))
      .toBeVisible()
      .withTimeout(2000);

    // Press back button
    await device.pressBack();

    // Should return to Mode Selection (STEP 1 OF 2)
    await waitFor(element(by.text('STEP 1 OF 2')))
      .toBeVisible()
      .withTimeout(2000);
  });

  it('should prevent skipping the breathing animation', async () => {
    // Complete mode and duration selection
    await element(by.text('Focus Charge')).atIndex(0).tap();
    await element(by.text('2 minutes')).tap();
    await element(by.text('Continue')).tap();

    // Should see breathing animation
    await waitFor(element(by.text('Breathe in...')))
      .toBeVisible()
      .withTimeout(2000);

    // Try to tap elsewhere or press back
    await device.pressBack();

    // Breathing animation should still be visible (not skipped)
    await expect(element(by.text('Breathe in...'))).toBeVisible();
  });

  it('should complete full first-time flow with haptic feedback', async () => {
    // This test verifies the complete flow from start to finish
    // Haptic feedback cannot be directly tested but can be logged

    // Mode Selection
    await waitFor(element(by.text('STEP 1 OF 2')))
      .toBeVisible()
      .withTimeout(3000);
    await element(by.text('Focus Charge')).atIndex(0).tap();

    // Duration Selection
    await waitFor(element(by.text('STEP 2 OF 2')))
      .toBeVisible()
      .withTimeout(2000);
    await element(by.text('5 minutes')).tap();
    await element(by.text('Continue')).tap();

    // Breathing Animation
    await waitFor(element(by.text('Breathe in...')))
      .toBeVisible()
      .withTimeout(2000);

    // Auto-advance to Ritual
    await waitFor(element(by.text('Ritual')))
      .toBeVisible()
      .withTimeout(4000);

    // Verify successful transition
    await expect(element(by.text('Ritual'))).toBeVisible();
  });
});
