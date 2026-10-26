import { detailsTeachingBeats } from '../detailsTeaching';
it.each([[true, true], [true, false], [false, true], [false, false]])('never overlays Details (%s, %s)', (vision, chart) => {
  expect(detailsTeachingBeats(vision, chart)).toEqual([]);
});
