import React from 'react';
import { render } from '@testing-library/react-native';
import {
  normalizePracticeMode,
  resolvePracticeArtwork,
  V2_PRACTICE_ARTWORK,
  PRACTICE_ARTWORK,
  HERO_ART_BY_PRACTICE,
  GRID_ART_BY_PRACTICE,
  V2PracticeArtwork,
  FocusArtwork,
  DeepPrimeArtwork,
  DeepFocusArtwork,
  VisualizeArtwork,
  ReleaseArtwork,
} from '../V2PracticeArtwork';

describe('V2PracticeArtwork mapping & resolver', () => {
  it('normalizes various mode string representations accurately', () => {
    expect(normalizePracticeMode('focus')).toBe('focus');
    expect(normalizePracticeMode('FOCUS')).toBe('focus');
    expect(normalizePracticeMode('deep_prime')).toBe('deep_prime');
    expect(normalizePracticeMode('deep-prime')).toBe('deep_prime');
    expect(normalizePracticeMode('deepprime')).toBe('deep_prime');
    expect(normalizePracticeMode('deep_focus')).toBe('deep_prime');
    expect(normalizePracticeMode('deep-focus')).toBe('deep_prime');
    expect(normalizePracticeMode('visualize')).toBe('visualize');
    expect(normalizePracticeMode('VISUALIZE')).toBe('visualize');
    expect(normalizePracticeMode('release')).toBe('release');
    expect(normalizePracticeMode('RELEASE')).toBe('release');
    expect(normalizePracticeMode(null)).toBe('focus');
    expect(normalizePracticeMode(undefined)).toBe('focus');
    expect(normalizePracticeMode('unknown')).toBe('focus');
  });

  it('exports canonical artwork for each mode in V2_PRACTICE_ARTWORK', () => {
    expect(V2_PRACTICE_ARTWORK.focus).toBeDefined();
    expect(V2_PRACTICE_ARTWORK.deep_prime).toBeDefined();
    expect(V2_PRACTICE_ARTWORK.visualize).toBeDefined();
    expect(V2_PRACTICE_ARTWORK.release).toBeDefined();
    expect(PRACTICE_ARTWORK).toBe(V2_PRACTICE_ARTWORK);
  });

  it('resolves the correct artwork asset for all canonical modes and aliases', () => {
    expect(resolvePracticeArtwork('focus')).toBe(V2_PRACTICE_ARTWORK.focus);
    expect(resolvePracticeArtwork('deep_prime')).toBe(V2_PRACTICE_ARTWORK.deep_prime);
    expect(resolvePracticeArtwork('deep-prime')).toBe(V2_PRACTICE_ARTWORK.deep_prime);
    expect(resolvePracticeArtwork('deep_focus')).toBe(V2_PRACTICE_ARTWORK.deep_prime);
    expect(resolvePracticeArtwork('visualize')).toBe(V2_PRACTICE_ARTWORK.visualize);
    expect(resolvePracticeArtwork('release')).toBe(V2_PRACTICE_ARTWORK.release);
  });

  it('HERO_ART_BY_PRACTICE and GRID_ART_BY_PRACTICE match the canonical V2_PRACTICE_ARTWORK', () => {
    expect(HERO_ART_BY_PRACTICE.focus).toBe(V2_PRACTICE_ARTWORK.focus);
    expect(HERO_ART_BY_PRACTICE.deep_prime).toBe(V2_PRACTICE_ARTWORK.deep_prime);
    expect(HERO_ART_BY_PRACTICE.visualize).toBe(V2_PRACTICE_ARTWORK.visualize);
    expect(HERO_ART_BY_PRACTICE.release).toBe(V2_PRACTICE_ARTWORK.release);

    expect(GRID_ART_BY_PRACTICE.focus).toBe(V2_PRACTICE_ARTWORK.focus);
    expect(GRID_ART_BY_PRACTICE.deep_prime).toBe(V2_PRACTICE_ARTWORK.deep_prime);
    expect(GRID_ART_BY_PRACTICE.visualize).toBe(V2_PRACTICE_ARTWORK.visualize);
    expect(GRID_ART_BY_PRACTICE.release).toBe(V2_PRACTICE_ARTWORK.release);
  });

  it('renders V2PracticeArtwork for all modes in card and featured variants', () => {
    const modes = ['focus', 'deep_prime', 'visualize', 'release'] as const;

    modes.forEach((mode) => {
      const { getByTestId, unmount } = render(
        <V2PracticeArtwork mode={mode} variant="card" />
      );
      expect(getByTestId(`v2-practice-artwork-${mode}-card`)).toBeTruthy();
      unmount();
    });

    modes.forEach((mode) => {
      const { getByTestId, unmount } = render(
        <V2PracticeArtwork mode={mode} variant="featured" reduceMotion={true} />
      );
      expect(getByTestId(`v2-practice-artwork-${mode}-featured`)).toBeTruthy();
      unmount();
    });
  });

  it('renders convenience wrapper components properly', () => {
    const { getByTestId: getFocus, unmount: unmountFocus } = render(<FocusArtwork variant="card" />);
    expect(getFocus('v2-practice-artwork-focus-card')).toBeTruthy();
    unmountFocus();

    const { getByTestId: getDeepPrime, unmount: unmountDeepPrime } = render(<DeepPrimeArtwork variant="card" />);
    expect(getDeepPrime('v2-practice-artwork-deep_prime-card')).toBeTruthy();
    unmountDeepPrime();

    const { getByTestId: getDeepFocus, unmount: unmountDeepFocus } = render(<DeepFocusArtwork variant="card" />);
    expect(getDeepFocus('v2-practice-artwork-deep_prime-card')).toBeTruthy();
    unmountDeepFocus();

    const { getByTestId: getVisualize, unmount: unmountVisualize } = render(<VisualizeArtwork variant="card" />);
    expect(getVisualize('v2-practice-artwork-visualize-card')).toBeTruthy();
    unmountVisualize();

    const { getByTestId: getRelease, unmount: unmountRelease } = render(<ReleaseArtwork variant="card" />);
    expect(getRelease('v2-practice-artwork-release-card')).toBeTruthy();
    unmountRelease();
  });
});
