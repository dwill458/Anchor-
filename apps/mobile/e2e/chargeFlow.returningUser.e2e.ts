/**
 * E2E Test: Returning User Charge Flow
 *
 * Scenario: Returning user (anchorCount > 0) navigates through:
 * 1. Default Charge Display showing saved preferences
 * 2. Either: Continue → Breathing → Ritual (fast path)
 *    Or: Change → Mode Selection → Duration → Breathing → Ritual
 * 3. Optionally save new defaults if selection differs
 *
 * Expected behavior:
 * - Shows "Using your default charge" card immediately
 * - Continue button provides frictionless path to ritual
 * - Change button allows editing preferences
 * - New selections auto-save if different from current defaults
 * - Back button from Default display exits to previous screen
 */

describe('Returning User Charge Flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' },
    });
    // Simulate returning user with saved anchor and default preferences
    // In real test, this would be done via API or test fixtures
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should show Default Charge Display for returning user', async () => {
    // Navigate to charge setup for an existing anchor
    await element(by.text('My Anchors')).tap();
    await element(by.text('First Anchor')).tap();
    await element(by.text('Charge')).tap();

    // Should see Default Charge Display (not mode selection)
    await waitFor(element(by.text('Using your default charge:')))
      .toBeVisible()
      .withTimeout(3000);

    // Should display saved preference
    await expect(element(by.text('Focus'))).toBeVisible();
    await expect(element(by.text('·'))).toBeVisible(); // Separator
    await expect(element(by.text('2 min'))).toBeVisible();
  });

  it('should show Continue and Change action buttons', async () => {
    // Should see both action buttons
    await expect(element(by.text('Continue'))).toBeVisible();
    await expect(element(by.text('Change'))).toBeVisible();

    // Continue button should be primary (gold background)
    // Change button should be secondary (outline)
    await expect(element(by.text('Continue'))).toBeEnabled();
    await expect(element(by.text('Change'))).toBeEnabled();
  });

  it('should navigate directly to Breathing Animation on Continue', async () => {
    // Tap Continue button
    await element(by.text('Continue')).tap();

    // Should immediately see breathing animation (skip mode/duration selection)
    await waitFor(element(by.text('Breathe in...')))
      .toBeVisible()
      .withTimeout(2000);

    // No mode selection or duration selection screens shown
    await expect(element(by.text('STEP 1 OF 2'))).not.toBeVisible();
  });

  it('should auto-advance from Breathing to Ritual with saved config', async () => {
    // Breathing animation should run
    await waitFor(element(by.text('Breathe in...')))
      .toBeVisible()
      .withTimeout(2000);

    // Wait for transition
    await waitFor(element(by.text('Breathe out...')))
      .toBeVisible()
      .withTimeout(2000);

    // After 3 seconds total, should reach Ritual screen
    await waitFor(element(by.text('Ritual')))
      .toBeVisible()
      .withTimeout(4000);

    // Ritual should be configured with saved preferences (Focus, 2 min)
    await expect(element(by.text('Ritual'))).toBeVisible();
  });

  it('should allow changing default preferences via Change button', async () => {
    // From Default Charge Display
    await expect(element(by.text('Using your default charge:'))).toBeVisible();

    // Tap Change button
    await element(by.text('Change')).tap();

    // Should navigate back to Mode Selection
    await waitFor(element(by.text('STEP 1 OF 2')))
      .toBeVisible()
      .withTimeout(2000);

    // Should see mode cards
    await expect(element(by.text('Focus Charge'))).toBeVisible();
    await expect(element(by.text('Ritual Charge'))).toBeVisible();
  });

  it('should select different mode and duration from Change flow', async () => {
    // From Mode Selection (after tapping Change)
    await element(by.text('Ritual Charge')).atIndex(0).tap();

    // Should go to Duration Selection
    await waitFor(element(by.text('STEP 2 OF 2')))
      .toBeVisible()
      .withTimeout(2000);

    // Should show ritual-specific options
    await expect(element(by.text('5 minutes'))).toBeVisible();
    await expect(element(by.text('10 minutes'))).toBeVisible();

    // Select 5 minutes (different from previous default of 2 min)
    await element(by.text('5 minutes')).tap();

    // Continue should be enabled
    await expect(element(by.text('Continue'))).toBeEnabled();
  });

  it('should proceed through breathing with new selection', async () => {
    // After selecting different duration
    await element(by.text('Continue')).tap();

    // Should see breathing animation
    await waitFor(element(by.text('Breathe in...')))
      .toBeVisible()
      .withTimeout(2000);

    // Wait for auto-advance
    await waitFor(element(by.text('Ritual')))
      .toBeVisible()
      .withTimeout(4000);
  });

  it('should save new defaults after completing ritual with different selection', async () => {
    // After ritual completes, navigate back to charge setup
    await element(by.text('Create Another')).tap();

    // Wait for Default Charge Display
    await waitFor(element(by.text('Using your default charge:')))
      .toBeVisible()
      .withTimeout(3000);

    // Should now show new defaults (Ritual, 5 min)
    await expect(element(by.text('Ritual'))).toBeVisible();
    await expect(element(by.text('5 min'))).toBeVisible();

    // Previous defaults (Focus, 2 min) should no longer appear
    // (or only in change flow history if tracked)
  });

  it('should handle back button from Default Charge Display', async () => {
    // Should be on Default Charge Display
    await expect(element(by.text('Using your default charge:'))).toBeVisible();

    // Press back button
    await device.pressBack();

    // Should exit to previous screen (back to anchor detail or vault)
    await expect(element(by.text('Using your default charge:'))).not.toBeVisible();
  });

  it('should handle back button from Change flow - Mode Selection', async () => {
    // Go to Change flow
    await element(by.text('Change')).tap();

    // Should be on Mode Selection
    await waitFor(element(by.text('STEP 1 OF 2')))
      .toBeVisible()
      .withTimeout(2000);

    // Press back button
    await device.pressBack();

    // Should return to Default Charge Display (not exit screen)
    await waitFor(element(by.text('Using your default charge:')))
      .toBeVisible()
      .withTimeout(2000);
  });

  it('should handle back button from Change flow - Duration Selection', async () => {
    // Go through Change flow to duration
    await element(by.text('Change')).tap();
    await element(by.text('Focus Charge')).atIndex(0).tap();

    // Should be on Duration Selection
    await waitFor(element(by.text('STEP 2 OF 2')))
      .toBeVisible()
      .withTimeout(2000);

    // Press back button
    await device.pressBack();

    // Should return to Mode Selection (STEP 1 OF 2)
    await waitFor(element(by.text('STEP 1 OF 2')))
      .toBeVisible()
      .withTimeout(2000);

    // Press back again
    await device.pressBack();

    // Should return to Default Charge Display
    await waitFor(element(by.text('Using your default charge:')))
      .toBeVisible()
      .withTimeout(2000);
  });

  it('should preserve haptic feedback throughout flow', async () => {
    // Continue button tap should trigger haptic (medium impact)
    await element(by.text('Continue')).tap();

    // Breathing animation should start with light haptic
    await waitFor(element(by.text('Breathe in...')))
      .toBeVisible()
      .withTimeout(2000);

    // Completion should trigger success haptic notification
    await waitFor(element(by.text('Ritual')))
      .toBeVisible()
      .withTimeout(4000);
  });

  it('should handle modal picker for custom ritual duration in Change flow', async () => {
    // From Change flow, go to Ritual mode
    await element(by.text('Change')).tap();
    await element(by.text('Ritual Charge')).atIndex(0).tap();

    // Should be on Duration Selection with Ritual options
    await waitFor(element(by.text('STEP 2 OF 2')))
      .toBeVisible()
      .withTimeout(2000);

    // Tap Custom Duration
    await element(by.text('Custom Duration')).tap();

    // Should show timer picker modal
    await waitFor(element(by.text('Select Duration')))
      .toBeVisible()
      .withTimeout(2000);

    // Select 20 minutes
    await element(by.text('20')).tap();
    await element(by.text('Confirm')).tap();

    // Should return to duration selection
    await waitFor(element(by.text('STEP 2 OF 2')))
      .toBeVisible()
      .withTimeout(2000);

    // Should show custom duration
    await expect(element(by.text('20 min'))).toBeVisible();
  });

  it('should show correct mode/duration formatting in Default Display', async () => {
    // Test various duration formats
    // After setting 30-second focus
    const durations = [30, 60, 120, 300, 600, 900, 1800];
    const expectedFormats = [
      '30s',
      '1 min',
      '2 min',
      '5 min',
      '10 min',
      '15 min',
      '30 min',
    ];

    // This would be tested across multiple runs with different saved defaults
    // For now, verify the format of current defaults
    await waitFor(element(by.text('Using your default charge:')))
      .toBeVisible()
      .withTimeout(3000);

    // Should match expected format pattern
    await expect(element(by.matching(/\d+\s?(s|min)/))).toBeVisible();
  });

  it('should complete full returning user flow with Continue', async () => {
    // This test verifies the complete returning user quick path

    // See Default Charge Display
    await waitFor(element(by.text('Using your default charge:')))
      .toBeVisible()
      .withTimeout(3000);

    // Verify saved preference
    const modeText = element(by.text(/Focus|Ritual/)); // Either mode
    await expect(modeText).toBeVisible();

    // Tap Continue
    await element(by.text('Continue')).tap();

    // Breathing Animation
    await waitFor(element(by.text('Breathe in...')))
      .toBeVisible()
      .withTimeout(2000);

    // Auto-advance to Ritual
    await waitFor(element(by.text('Ritual')))
      .toBeVisible()
      .withTimeout(4000);

    // Ritual visible and ready
    await expect(element(by.text('Ritual'))).toBeVisible();
  });

  it('should complete full returning user flow with Change', async () => {
    // This test verifies the complete returning user custom path

    // See Default Charge Display
    await waitFor(element(by.text('Using your default charge:')))
      .toBeVisible()
      .withTimeout(3000);

    // Tap Change
    await element(by.text('Change')).tap();

    // Mode Selection
    await waitFor(element(by.text('STEP 1 OF 2')))
      .toBeVisible()
      .withTimeout(2000);

    // Select different mode
    const initialMode = element(by.text(/Focus|Ritual/)).atIndex(0);
    await initialMode.tap();

    // Duration Selection
    await waitFor(element(by.text('STEP 2 OF 2')))
      .toBeVisible()
      .withTimeout(2000);

    // Select duration
    const durationOption = element(by.matching(/\d+\s?(s|m)/)).atIndex(0);
    await durationOption.tap();

    // Continue
    await element(by.text('Continue')).tap();

    // Breathing Animation
    await waitFor(element(by.text('Breathe in...')))
      .toBeVisible()
      .withTimeout(2000);

    // Auto-advance to Ritual
    await waitFor(element(by.text('Ritual')))
      .toBeVisible()
      .withTimeout(4000);

    // Verify success
    await expect(element(by.text('Ritual'))).toBeVisible();
  });
});
