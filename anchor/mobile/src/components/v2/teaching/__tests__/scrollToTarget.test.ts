import { scrollToTarget } from '../scrollToTarget';
const target = (y: number) => ({ current: { measureInWindow: (done: Function) => done(20, y, 300, 60) } }) as never;
it('scrolls to 150px below the viewport top, clamped to the scroll bounds, and measures after settling', async () => {
  const scrollTo = jest.fn();
  await scrollToTarget(target(700), { current: { scrollTo } }, () => ({ y: 20, max: 400, viewportTop: 50 }), true);
  expect(scrollTo).toHaveBeenCalledWith({ y: 400, animated: false });
  await scrollToTarget(target(20), { current: { scrollTo } }, () => ({ y: 300, max: 900, viewportTop: 0 }), true);
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 170, animated: false });
});
it('silently skips a target that cannot be measured', async () => {
  const scrollTo = jest.fn();
  expect(await scrollToTarget({ current: null }, { current: { scrollTo } }, () => ({ y: 0, max: 900, viewportTop: 0 }), false)).toBeNull();
  expect(scrollTo).not.toHaveBeenCalled();
});
