import { progressTeachingBeats } from '../progressTeaching';
it('offers only the measured Thread lesson', () => {
  expect(progressTeachingBeats({ unmeasured: false, hasWeek: true, hasRhythm: true, hasRoute: true })).toEqual(['progress.thread']);
});
it('offers nothing before Thread is measured', () => {
  expect(progressTeachingBeats({ unmeasured: true, hasWeek: true, hasRhythm: true, hasRoute: true })).toEqual([]);
});
