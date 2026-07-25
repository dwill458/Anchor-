import {
  VISUALIZE_PHASE_PRESENTATION,
  getVisualizationLensSize,
  getVisualizePresentationPhase,
  getVisualizeSceneCue,
  getVisualizeSegmentState,
  shouldPinPreparationCta,
} from '../visualizePresentation';

describe('Visualize presentation', () => {
  it('maps the stable audio timeline onto the five requested visual phases', () => {
    expect(
      ['see', 'feel', 'choose', 'rehearse', 'seal'].map((phase) =>
        getVisualizePresentationPhase(
          phase as Parameters<typeof getVisualizePresentationPhase>[0],
        ),
      ),
    ).toEqual(['see', 'feel', 'choose', 'rehearse', 'seal']);
  });

  it('gives each phase a distinct, progressively evolving motion state', () => {
    expect(VISUALIZE_PHASE_PRESENTATION.see.ringMotion).toBe('outward');
    expect(VISUALIZE_PHASE_PRESENTATION.feel.ringMotion).toBe('inward');
    expect(VISUALIZE_PHASE_PRESENTATION.choose.ringMotion).toBe('orbit');
    expect(VISUALIZE_PHASE_PRESENTATION.rehearse.depth).toBeGreaterThan(
      VISUALIZE_PHASE_PRESENTATION.choose.depth,
    );
    expect(VISUALIZE_PHASE_PRESENTATION.seal.ringMotion).toBe('settle');
    expect(VISUALIZE_PHASE_PRESENTATION.seal.ringDurationMs).toBeGreaterThan(
      VISUALIZE_PHASE_PRESENTATION.rehearse.ringDurationMs,
    );
  });

  it('exposes non-color segment states for progress semantics', () => {
    expect([0, 1, 2, 3, 4].map((index) => getVisualizeSegmentState(index, 2))).toEqual([
      'completed',
      'completed',
      'current',
      'upcoming',
      'upcoming',
    ]);
  });

  it('condenses the full scene into a readable active-session cue', () => {
    expect(
      getVisualizeSceneCue(
        'I stay present in a meaningful conversation, listen fully, and respond with honesty and care.',
      ),
    ).toEqual({
      title: 'Meaningful Conversation',
      qualities: 'Present · Listening · Honest',
    });
  });

  it('pins the entrance CTA only when measured content overflows and the keyboard is closed', () => {
    expect(shouldPinPreparationCta(760, 760, false)).toBe(false);
    expect(shouldPinPreparationCta(761, 760, false)).toBe(false);
    expect(shouldPinPreparationCta(770, 760, false)).toBe(true);
    expect(shouldPinPreparationCta(900, 760, true)).toBe(false);
  });

  it('sizes each circular Anchor Lens responsively without exceeding its maximum', () => {
    expect(getVisualizationLensSize('entrance', 360)).toBe(187);
    expect(getVisualizationLensSize('practice', 360)).toBe(259);
    expect(getVisualizationLensSize('completion', 360)).toBe(202);
    expect(getVisualizationLensSize('entrance', 480)).toBe(210);
    expect(getVisualizationLensSize('practice', 480)).toBe(290);
    expect(getVisualizationLensSize('completion', 480)).toBe(225);
  });

  it.each([
    ['small Android', 360, 820, 600, true, 187],
    ['standard iPhone', 390, 748, 760, false, 203],
  ] as const)(
    'adapts the entrance layout for a %s viewport',
    (_device, screenWidth, contentHeight, viewportHeight, pinned, artworkSize) => {
      expect(getVisualizationLensSize('entrance', screenWidth)).toBe(artworkSize);
      expect(
        shouldPinPreparationCta(contentHeight, viewportHeight, false),
      ).toBe(pinned);
    },
  );
});
