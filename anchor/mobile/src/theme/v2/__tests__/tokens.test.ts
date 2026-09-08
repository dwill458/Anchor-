import { categories, colors, getCategoryColor, getCategoryFieldColor, getCategorySoftTint, getPracticeColor, getPracticeSoftTint, practiceColors } from '@/theme/v2';

describe('V2 design tokens', () => {
  it('exports the locked neutral palette', () => {
    expect(colors.canvas).toBe('#F4F1E9');
    expect(colors.surface).toBe('#FBF9F4');
    expect(colors.grouped).toBe('#ECE8DF');
    expect(colors.text.primary).toBe('#171717');
    expect(colors.text.secondary).toBe('#6C6861');
    expect(colors.border.default).toBe('#D8D2C8');
  });

  it('resolves every category deterministically and derives restrained fields', () => {
    Object.entries(categories).forEach(([category, color]) => {
      expect(getCategoryColor(category)).toBe(color);
      expect(getCategoryFieldColor(category)).toBe(`${color}1F`);
      expect(getCategorySoftTint(category)).toBe(`${color}14`);
    });
    expect(getCategoryColor('unknown')).toBe(categories.custom);
  });

  it('keeps every Practice mode independent and centralized', () => {
    expect(getPracticeColor('Focus')).toBe(practiceColors.focus);
    expect(getPracticeColor('Deep Prime')).toBe(practiceColors.deepPrime);
    expect(getPracticeColor('Visualize')).toBe(practiceColors.visualize);
    expect(getPracticeColor('Release')).toBe(practiceColors.release);
    expect(getPracticeSoftTint('Focus')).toBe(`${practiceColors.focus}18`);
  });
});
