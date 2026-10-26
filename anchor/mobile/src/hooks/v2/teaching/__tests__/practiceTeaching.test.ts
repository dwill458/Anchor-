import { practiceTeachingBeats } from '../practiceTeaching';
it('teaches switch only when two or more anchors and the control is rendered', () => {
  expect(practiceTeachingBeats(1, true)).toEqual([]);
  expect(practiceTeachingBeats(2, true)).toEqual(['practice.switch']);
  expect(practiceTeachingBeats(3, false)).toEqual([]);
});
