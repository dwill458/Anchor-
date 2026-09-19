import { assessIntention } from '../intentionGuidance';

describe('assessIntention', () => {
  it('stays fully neutral for empty or very short input', () => {
    expect(assessIntention('')).toEqual({ short: 'neutral', present: 'neutral', felt: 'neutral' });
    expect(assessIntention('I am')).toEqual({ short: 'neutral', present: 'neutral', felt: 'neutral' });
  });

  it('recognises a short, present statement', () => {
    expect(assessIntention('I am fully present with my work.')).toEqual({ short: 'met', present: 'met', felt: 'neutral' });
    expect(assessIntention('I begin important work immediately.').present).toBe('met');
  });

  it.each([
    'I want to stop getting distracted.',
    "I don't want to procrastinate.",
    'I will finish the project',
    'I hope to be calmer someday',
    'Stop checking my phone all day',
    "I'll finish the project today",
    'I need more focus at work',
  ])('does not mark desire, future or escape phrasing as present: %s', (text) => {
    expect(assessIntention(text).present).toBe('neutral');
  });

  it('keeps short neutral for long or multi-direction text', () => {
    const long = 'I am building a calm and steady focus that carries through every single part of my working day';
    expect(assessIntention(long).short).toBe('neutral');
    expect(assessIntention('I am focused. I am rested. I am kind.').short).toBe('neutral');
  });

  it('never marks FELT — personal meaning is not measurable', () => {
    expect(assessIntention('I am fully present with my work.').felt).toBe('neutral');
  });
});
