import glimpse from '../beatmaps/beatmap_glimpse.json';
import immerse from '../beatmaps/beatmap_immerse.json';
import embody from '../beatmaps/beatmap_embody.json';

// Limits follow complete recorded utterances, including edit margins. These
// phrases previously contained inserted silence inside a grammatical clause.
describe('Visualize complete-phrase pacing', () => {
  it.each([
    { map: glimpse, voice: 'dominic', id: 12, maximum: 2.5 },
    { map: immerse, voice: 'dominic', id: 24, maximum: 4.4 },
    { map: immerse, voice: 'dominic', id: 35, maximum: 2.05 },
    { map: immerse, voice: 'lina', id: 7, maximum: 3.2 },
    { map: immerse, voice: 'lina', id: 16, maximum: 4.2 },
    { map: immerse, voice: 'lina', id: 24, maximum: 4.1 },
    { map: immerse, voice: 'lina', id: 28, maximum: 2.2 },
    { map: immerse, voice: 'lina', id: 30, maximum: 1.7 },
    { map: immerse, voice: 'lina', id: 35, maximum: 2.0 },
    { map: embody, voice: 'dominic', id: 37, maximum: 2.2 },
    { map: embody, voice: 'lina', id: 19, maximum: 2.1 },
  ] as const)('$voice phrase $id finishes as a complete utterance', ({ map, voice, id, maximum }) => {
    const phrase = map.voices[voice].phrases.find(item => item.id === id)!;
    expect(phrase.end - phrase.start).toBeLessThanOrEqual(maximum);
    expect(phrase).not.toHaveProperty('caption_spans');
  });
});
