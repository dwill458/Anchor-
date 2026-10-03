import React from 'react';
import { render } from '@testing-library/react-native';
import { categories } from '@/theme/v2';
import { ChartMapHeader } from '../ChartMapHeader';
import { categoryLabelOnPaper, contrastRatio, panelAccent } from '../chartPanelColors';
import { CHART_MAP_TOKENS } from '../../map/chartMapTokens';
import { brushStrokePath } from '../ChartBrushBar';

describe('ChartMapHeader category label', () => {
  it.each(Object.keys(categories))('%s label reads at 4.5:1 or better on the paper map', (category) => {
    const { getByTestId } = render(
      <ChartMapHeader categoryLabel={category.toUpperCase()} category={category} accent={panelAccent(category)} visionImageUrl={null} hasVision={false} onBack={jest.fn()} onMenu={jest.fn()} onOpenVision={jest.fn()} />
    );
    const style = [getByTestId('chart-category-label').props.style].flat(5).reduce((acc: Record<string, unknown>, s) => ({ ...acc, ...(s as object) }), {});
    expect(style.color).toBe(categoryLabelOnPaper(category));
    expect(contrastRatio(style.color as string, CHART_MAP_TOKENS.paper)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('brush stroke', () => {
  it('is deterministic (fixed seed)', () => {
    expect(brushStrokePath(240)).toBe(brushStrokePath(240));
    expect(brushStrokePath(240)).toMatch(/^M0 /);
  });
});


it('keeps the progress track visible against both ink panel surfaces at 3:1', () => {
  for (const ground of [CHART_MAP_TOKENS.ink, CHART_MAP_TOKENS.panel]) {
    expect(contrastRatio(CHART_MAP_TOKENS.progressTrack, ground)).toBeGreaterThanOrEqual(3);
  }
});
