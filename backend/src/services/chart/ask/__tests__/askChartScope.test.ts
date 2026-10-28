import { routeTitlesMatch } from '../askChartScope';

describe('routeTitlesMatch', () => {
  it('treats the same titles in the same order as no change', () => {
    expect(routeTitlesMatch(['Map rust', 'Strip paint'], [' map  rust', 'Strip paint'])).toBe(true);
  });
  it('detects a reorder, a rename and a different length', () => {
    expect(routeTitlesMatch(['A', 'B'], ['B', 'A'])).toBe(false);
    expect(routeTitlesMatch(['A', 'B'], ['A', 'C'])).toBe(false);
    expect(routeTitlesMatch(['A'], ['A', 'B'])).toBe(false);
  });
});
