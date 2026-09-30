import { journeySessionKey, rememberJourney, rememberedJourney } from '../chartJourneySession';
it('suppresses quick reentry and never remembers inspection as actual progress', () => {
  const key = journeySessionKey('a', 'c');
  expect(rememberedJourney(key, .5, 1000)).toEqual({ from:.5, animate:false });
  rememberJourney(key, .3, 1000);
  expect(rememberedJourney(key, .5, 9000)).toEqual({ from:.5, animate:false });
  expect(rememberedJourney(key, .5, 12000)).toEqual({ from:.3, animate:true });
  expect(rememberedJourney(journeySessionKey('a', 'other'), .5, 12000).from).toBe(.5);
  journeySessionKey('b', 'c');
  expect(rememberedJourney(journeySessionKey('a', 'c'), .5, 12000).from).toBe(.5);
});
