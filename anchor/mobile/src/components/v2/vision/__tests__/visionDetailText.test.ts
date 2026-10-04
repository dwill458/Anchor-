import { truncateVisionText } from '../visionDetailText';

describe('Vision detail preview', () => {
  it('leaves short descriptions intact', () => {
    expect(truncateVisionText('My family by the ocean.', 80)).toBe('My family by the ocean.');
  });
  it('prefers a complete sentence', () => {
    expect(truncateVisionText('The app is thriving. We are working by the ocean with our family.', 45)).toBe('The app is thriving...');
  });
  it('never cuts a word', () => {
    expect(truncateVisionText('Working by the ocean with everyone', 22)).toBe('Working by the ocean...');
  });
  it('keeps an indivisible long word intact', () => {
    expect(truncateVisionText('Supercalifragilisticexpialidocious next word', 10)).toBe('Supercalifragilisticexpialidocious...');
  });
  it('does not invent an ellipsis when the entire description is one word', () => {
    const token = 'x'.repeat(300);
    expect(truncateVisionText(token)).toBe(token);
  });
});
