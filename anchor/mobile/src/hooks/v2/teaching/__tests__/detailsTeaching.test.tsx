import { DETAILS_BEATS_PER_VISIT, detailsTeachingBeats } from '../detailsTeaching';
it('offers details.vision when Vision is empty and details.chart once Vision is present and Chart is empty', () => {
  expect(detailsTeachingBeats(true, true)).toEqual(['details.vision']);
  expect(detailsTeachingBeats(true, false)).toEqual(['details.vision']);
  expect(detailsTeachingBeats(false, true)).toEqual(['details.chart']);
  expect(detailsTeachingBeats(false, false)).toEqual([]);
  expect(DETAILS_BEATS_PER_VISIT).toBe(1);
});
