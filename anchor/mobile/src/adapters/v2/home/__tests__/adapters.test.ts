import { toThreadPresentation, threadQualitativeLabel } from '../threadAdapter';
import { toHomeVisionState, resolveVisionHeroImage, resolveVisionAlternateImage, type HomeVisionState } from '../visionAdapter';
import { courseMatchesAnchor, toHomeChartState } from '../chartAdapter';
import { makeAnchor } from './fixtures';
import type { VisualizationScene } from '@/types/practice';
import type { CourseDetail } from '@/types/chart';

describe('threadAdapter', () => {
  it('surfaces the stored value clamped, and performs no progression math', () => {
    const present = toThreadPresentation(makeAnchor({ threadStrength: 79 }));
    expect(present).toMatchObject({ value: 79, unmeasured: false });
    expect(present.delta).toBeUndefined();
    expect(present.trend).toBeUndefined();
    expect(present.previousValue).toBeUndefined();
    expect(toThreadPresentation(makeAnchor({ threadStrength: 140 })).value).toBe(100);
    expect(toThreadPresentation(makeAnchor({ threadStrength: -5 })).value).toBe(0);
  });

  it('marks an Anchor with no stored strength as unmeasured (never fabricates a value)', () => {
    const result = toThreadPresentation(makeAnchor({ threadStrength: undefined }));
    expect(result).toMatchObject({ value: null, unmeasured: true });
  });

  it('labels strength qualitatively without inventing movement', () => {
    expect(threadQualitativeLabel(50, false)).toBe('Established');
    expect(threadQualitativeLabel(null, true)).toBe('Not established yet');
    expect(threadQualitativeLabel(95, false)).toBe('Reinforced');
  });
});

describe('visionAdapter', () => {
  it('is "none" without a scene', () => {
    expect(toHomeVisionState(null)).toEqual({ state: 'none' });
    expect(toHomeVisionState(undefined)).toEqual({ state: 'none' });
  });

  it('is "ready" with the real text scene and never fabricates an image uri', () => {
    const scene = {
      id: 'scene-1',
      anchorId: 'anchor-1',
      currentText: 'A calm studio at dawn',
      originalSuggestion: 'studio',
    } as VisualizationScene;
    const result = toHomeVisionState(scene);
    expect(result).toEqual({ state: 'ready', visionId: 'scene-1', previewText: 'A calm studio at dawn' });
    expect((result as { previewUri?: string }).previewUri).toBeUndefined();
  });
});

describe('resolveVisionHeroImage', () => {
  it('returns null for a non-ready Vision', () => {
    expect(resolveVisionHeroImage({ state: 'none' })).toBeNull();
    expect(resolveVisionHeroImage({ state: 'loading' })).toBeNull();
    expect(resolveVisionHeroImage({ state: 'error', message: 'x' })).toBeNull();
  });

  it('returns null rather than a placeholder when a ready Vision has no image on any tile', () => {
    const vision: HomeVisionState = {
      state: 'ready',
      visionId: 'v1',
      previewText: 'A future without a cover yet',
      tiles: [{ id: 't1', sceneId: 's1', imageUrl: undefined, prompt: 'a studio', sortOrder: 0, isHero: true } as never],
    };
    expect(resolveVisionHeroImage(vision)).toBeNull();
  });

  it('prefers the featured tile among multiple images', () => {
    const vision: HomeVisionState = {
      state: 'ready',
      visionId: 'v1',
      previewText: 'Multiple tiles',
      featuredTileId: 't2',
      tiles: [
        { id: 't1', sceneId: 's1', imageUrl: 'https://assets.test/one.png', prompt: null, sortOrder: 0, isHero: false } as never,
        { id: 't2', sceneId: 's1', imageUrl: 'https://assets.test/two.png', prompt: null, sortOrder: 1, isHero: true } as never,
      ],
    };
    expect(resolveVisionHeroImage(vision)).toBe('https://assets.test/two.png');
  });

  it('falls back to the first tile with an image when the featured id does not match one', () => {
    const vision: HomeVisionState = {
      state: 'ready',
      visionId: 'v1',
      previewText: 'One tile, single image',
      featuredTileId: 'missing',
      tiles: [{ id: 't1', sceneId: 's1', imageUrl: 'https://assets.test/one.png', prompt: null, sortOrder: 0, isHero: true } as never],
    };
    expect(resolveVisionHeroImage(vision)).toBe('https://assets.test/one.png');
  });
});

describe('resolveVisionAlternateImage', () => {
  it('returns null for a non-ready Vision or one with only a single image', () => {
    expect(resolveVisionAlternateImage({ state: 'none' })).toBeNull();
    const single: HomeVisionState = {
      state: 'ready',
      visionId: 'v1',
      previewText: 'One image',
      featuredTileId: 't1',
      tiles: [{ id: 't1', sceneId: 's1', imageUrl: 'https://assets.test/one.png', prompt: null, sortOrder: 0, isHero: true } as never],
    };
    expect(resolveVisionAlternateImage(single)).toBeNull();
  });

  it('returns a second image distinct from the hero when one exists', () => {
    const multi: HomeVisionState = {
      state: 'ready',
      visionId: 'v1',
      previewText: 'Two images',
      featuredTileId: 't1',
      tiles: [
        { id: 't1', sceneId: 's1', imageUrl: 'https://assets.test/one.png', prompt: null, sortOrder: 0, isHero: true } as never,
        { id: 't2', sceneId: 's1', imageUrl: 'https://assets.test/two.png', prompt: null, sortOrder: 1, isHero: false } as never,
      ],
    };
    expect(resolveVisionAlternateImage(multi)).toBe('https://assets.test/two.png');
  });
});

describe('chartAdapter', () => {
  const course = (overrides: Partial<CourseDetail> = {}): CourseDetail =>
    ({
      id: 'course-1',
      destinationText: 'Reach 1,000 active users',
      status: 'ACTIVE',
      version: 1,
      currentWaypointId: 'wp-2',
      waypointCount: 5,
      reachedCount: 2,
      plottedAt: '',
      completedAt: null,
      archivedAt: null,
      destinationAnchorLink: null,
      waypoints: [
        { id: 'wp-1', position: 1, state: 'REACHED', reachedAt: '2026-09-01', title: 'Ship beta' } as never,
        { id: 'wp-2', position: 2, state: 'CURRENT', reachedAt: null, title: 'Contact 3 creators' } as never,
      ],
      ...overrides,
    }) as CourseDetail;

  it('is "none" without an active course', () => {
    expect(toHomeChartState(null)).toEqual({ state: 'none' });
    expect(toHomeChartState(course({ status: 'COMPLETED' }))).toEqual({ state: 'none' });
  });

  it('reads real destination + next move + progress and never advances anything', () => {
    expect(toHomeChartState(course())).toEqual({
      state: 'ready',
      courseId: 'course-1',
      destinationText: 'Reach 1,000 active users',
      nextMove: 'Contact 3 creators',
      // Derived from the waypoints actually supplied, not from the summary's
      // own counter, so `reachedCount` and `waypointCount` can never disagree
      // and render "2 of 2" for a route with one waypoint reached.
      reachedCount: 1,
      waypointCount: 2,
      currentWaypointId: 'wp-2',
      currentWaypointIndex: 1,
      isFinished: false,
      waypoints: [
        { id: 'wp-1', title: 'Ship beta', state: 'REACHED', reached: true, isCurrent: false, isDestination: false },
        { id: 'wp-2', title: 'Contact 3 creators', state: 'CURRENT', reached: false, isCurrent: true, isDestination: true },
      ],
    });
  });

  it('requires an explicit Course-Anchor link before showing Chart context', () => {
    const anchor = makeAnchor({ id: 'anchor-1', localId: 'anchor-1' });
    expect(courseMatchesAnchor(course(), anchor)).toBe(false);
    expect(courseMatchesAnchor(course({ destinationAnchorLink: { anchorId: 'anchor-1' } as never }), anchor)).toBe(true);
    expect(courseMatchesAnchor(course({ destinationAnchorLink: { anchorId: 'anchor-2' } as never }), anchor)).toBe(false);
  });

  it('attributes an unlinked legacy Course only when it is the only active Anchor', () => {
    const anchor = makeAnchor({ id: 'anchor-1', localId: 'anchor-1' });
    // No link at all: attributable only under the explicit single-Anchor opt-in.
    expect(courseMatchesAnchor(course(), anchor, { isOnlyActiveAnchor: true })).toBe(true);
    expect(courseMatchesAnchor(course(), anchor, { isOnlyActiveAnchor: false })).toBe(false);
    // The opt-in never overrides a link that points somewhere else.
    expect(
      courseMatchesAnchor(course({ destinationAnchorLink: { anchorId: 'anchor-2' } as never }), anchor, {
        isOnlyActiveAnchor: true,
      }),
    ).toBe(false);
  });

  it('does not guess a current waypoint when the authoritative id is unresolved', () => {
    const result = toHomeChartState(course({ currentWaypointId: 'missing', waypointCount: 2, reachedCount: 1 }));
    expect(result.state).toBe('ready');
    if (result.state !== 'ready') return;
    expect(result.nextMove).toBeNull();
    expect(result.currentWaypointIndex).toBe(-1);
    expect(result.waypoints.some((waypoint) => waypoint.isCurrent)).toBe(false);
  });

  it.each([2, 3, 5, 6])('preserves a real %i-waypoint route without a count fallback', (count) => {
    const waypoints = Array.from({ length: count }, (_, index) => ({
      id: `wp-${index + 1}`,
      position: index + 1,
      state: index === 0 ? 'REACHED' : index === 1 ? 'CURRENT' : 'UPCOMING',
      reachedAt: index === 0 ? '2026-09-01' : null,
      title: `Waypoint ${index + 1}`,
    }));
    const result = toHomeChartState(course({
      currentWaypointId: 'wp-2',
      waypointCount: count,
      reachedCount: 1,
      waypoints: waypoints as never,
    }));
    expect(result.state).toBe('ready');
    if (result.state !== 'ready') return;
    expect(result.waypointCount).toBe(count);
    expect(result.waypoints).toHaveLength(count);
    expect(result.currentWaypointId).toBe('wp-2');
    expect(result.currentWaypointIndex).toBe(1);
  });
});
