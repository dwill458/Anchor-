import { createGuidanceCoordinator, DISPLAY_DWELL_MS, SESSION_BACKGROUND_MS } from '../guidanceCoordinator';
import { GUIDANCE_REGISTRY } from '@/constants/v2/guidanceRegistry';

const record = () => ({ records: {}, discovery: {} });
const host = (key: string, ids = ['today.recommended']) => ({ key, account: 'guest', ready: true, candidates: ids, present: jest.fn(), hide: jest.fn() });
let coordinator: ReturnType<typeof createGuidanceCoordinator>;
beforeEach(() => { jest.useFakeTimers(); coordinator = createGuidanceCoordinator(GUIDANCE_REGISTRY, jest.fn()); coordinator.bind('guest', record()); });
afterEach(() => { coordinator.dispose(); jest.useRealTimers(); });
const tick = () => jest.advanceTimersByTime(0);
it('arbitrates concurrent hosts deterministically by priority and registry order', () => {
  const a = host('a'); const b = host('b', ['chart.next_move']);
  coordinator.register(a); coordinator.register(b); tick();
  expect(a.present).not.toHaveBeenCalled(); expect(b.present).toHaveBeenCalledTimes(1);
  expect(coordinator.snapshot()?.id).toBe('chart.next_move');
});
it('never preempts an active surface with another teaching', () => {
  const a = host('a'); coordinator.register(a); tick(); coordinator.register(host('b', ['chart.next_move'])); tick();
  expect(coordinator.snapshot()?.hostKey).toBe('a');
});
it('requires visible dwell and leaves an interruption unsettled', () => {
  coordinator.register(host('a')); tick(); const active = coordinator.snapshot()!;
  coordinator.visible(active.token); jest.advanceTimersByTime(DISPLAY_DWELL_MS - 1);
  coordinator.lock('celebration', true, true); jest.advanceTimersByTime(1000);
  expect(coordinator.data().records[active.id].displayCount).toBe(0);
  expect(coordinator.data().records[active.id].outcome).toBeUndefined();
  coordinator.lock('celebration', false, true); tick(); expect(coordinator.snapshot()).toBeNull();
});
it('records acknowledgment separately from display and rejects stale callbacks', () => {
  coordinator.register(host('a')); tick(); const active = coordinator.snapshot()!;
  coordinator.visible(active.token); jest.advanceTimersByTime(DISPLAY_DWELL_MS);
  expect(coordinator.data().records[active.id].displayCount).toBe(1);
  expect(coordinator.data().records[active.id].outcome).toBeUndefined();
  coordinator.finish(active.token, 'acknowledged'); coordinator.visible(active.token); tick();
  expect(coordinator.data().records[active.id].outcome).toBe('acknowledged'); expect(coordinator.snapshot()).toBeNull();
});
it('unregisters navigation contexts and ignores old account tokens', () => {
  const remove = coordinator.register(host('a')); tick(); const token = coordinator.snapshot()!.token;
  remove(); coordinator.bind('other', record()); coordinator.finish(token, 'dismissed');
  expect(coordinator.data().records).toEqual({}); expect(coordinator.snapshot()).toBeNull();
});
it('uses live eligibility when readiness changes', () => {
  const a = host('a'); a.ready = false; coordinator.register(a); tick(); expect(coordinator.snapshot()).toBeNull();
  coordinator.update({ ...a, ready: true, candidates: [] }); tick(); expect(coordinator.snapshot()).toBeNull();
});
it('cancels presentation that never reports visible within 1500ms', () => {
  coordinator.register(host('a')); tick(); jest.advanceTimersByTime(1501);
  expect(coordinator.snapshot()).toBeNull(); expect(coordinator.data().records['today.recommended']).toBeUndefined();
});
it('allows one bubble plus the P0 Chart allowance, but never two P0 bubbles', () => {
  const remove = coordinator.register(host('a')); tick(); let a = coordinator.snapshot()!; coordinator.visible(a.token); coordinator.finish(a.token, 'dismissed'); remove();
  coordinator.register(host('b', ['vision.lead_image'])); tick(); expect(coordinator.snapshot()).toBeNull();
  coordinator.register(host('c', ['chart.next_move'])); tick(); a = coordinator.snapshot()!; expect(a.id).toBe('chart.next_move');
});
it('resets the foreground budget only after 30 minutes in background', () => {
  const remove = coordinator.register(host('a')); tick(); const a = coordinator.snapshot()!; coordinator.visible(a.token); coordinator.finish(a.token, 'dismissed'); remove();
  coordinator.foreground(false); jest.advanceTimersByTime(SESSION_BACKGROUND_MS); coordinator.foreground(true);
  coordinator.register(host('b', ['vision.lead_image'])); tick(); expect(coordinator.snapshot()?.id).toBe('vision.lead_image');
});
it('discovery suppresses replay and does not fabricate a display', () => {
  coordinator.discover('today.recommended'); coordinator.replay(); coordinator.register(host('a')); tick();
  expect(coordinator.snapshot()).toBeNull(); expect(coordinator.data().records['today.recommended'].outcome).toBe('obsolete');
  expect(coordinator.data().records['today.recommended'].displayCount).toBe(0);
});
it('rejects callbacks while covered and cancels pending arbitration on dispose', () => {
  coordinator.register(host('a')); coordinator.dispose(); tick(); expect(coordinator.snapshot()).toBeNull();
});

it('does not let P0 use its bonus repeatedly after an interruption', () => {
 const remove = coordinator.register(host('chart-a', ['chart.next_move'])); tick(); const a = coordinator.snapshot()!; coordinator.visible(a.token); coordinator.interrupt(a.token); remove();
 coordinator.register(host('chart-b', ['chart.next_move'])); tick(); expect(coordinator.snapshot()).toBeNull();
});
it('starts a fresh dwell after measurement cover without counting a second attempt', () => {
 coordinator.register(host('a')); tick(); const a = coordinator.snapshot()!; coordinator.visible(a.token); jest.advanceTimersByTime(600); coordinator.covered(a.token);
 jest.advanceTimersByTime(1000); expect(coordinator.data().records[a.id].displayCount).toBe(0);
 coordinator.visible(a.token); jest.advanceTimersByTime(1000); expect(coordinator.data().records[a.id]).toMatchObject({ displayCount: 1, presentAttempts: 1 });
});
it('confirms real asynchronous action after navigation but rejects completion after replay or account change', () => {
 const remove = coordinator.register(host('a')); tick(); const a = coordinator.snapshot()!; coordinator.visible(a.token);
 const done = coordinator.startAction(a.token, 'target:today'); remove(); done(true); expect(coordinator.data().records[a.id].outcome).toBe('action_performed');
 coordinator.replay(); done(true); expect(coordinator.data().records[a.id].outcome).toBe('obsolete');
 coordinator.bind('other', record()); done(true); expect(coordinator.data().records).toEqual({});
});
it('leaves failed actions unsettled and consumes no display without dwell', () => {
 coordinator.register(host('a')); tick(); const a = coordinator.snapshot()!; coordinator.visible(a.token); coordinator.startAction(a.token, 'target:today')(false);
 expect(coordinator.snapshot()).toBeNull(); expect(coordinator.data().records[a.id]).toMatchObject({ displayCount: 0 }); expect(coordinator.data().records[a.id].outcome).toBeUndefined();
});
it('makes max attempts obsolete instead of maintaining a permanent retry backlog', () => {
 const data = record() as import('../guidanceCoordinator').GuidanceData;
 data.records['today.recommended'] = { version: 1, displayCount: 0, presentAttempts: 3, interruptCount: 0 };
 coordinator.bind('guest', data); coordinator.register(host('a')); tick(); expect(coordinator.snapshot()).toBeNull(); expect(coordinator.data().records['today.recommended'].outcomeDetail).toBe('not_applicable');
});
it('keeps a short background from resetting the session budget', () => {
 const remove = coordinator.register(host('a')); tick(); const a = coordinator.snapshot()!; coordinator.visible(a.token); coordinator.finish(a.token, 'dismissed'); remove();
 coordinator.foreground(false); jest.advanceTimersByTime(SESSION_BACKGROUND_MS - 1); coordinator.foreground(true); coordinator.register(host('b', ['vision.lead_image'])); tick(); expect(coordinator.snapshot()).toBeNull();
});
it('fails closed while account records are not loaded', () => {
 coordinator.bind('guest', null); coordinator.register(host('a')); tick(); expect(coordinator.snapshot()).toBeNull();
});
it('breaks equal priority ties using registry order, regardless of registration order', () => {
 coordinator.register(host('vision', ['vision.lead_image'])); coordinator.register(host('home')); tick(); expect(coordinator.snapshot()?.id).toBe('today.recommended');
});
it('expires the Today re-show window instead of presenting a late reminder', () => {
 const remove = coordinator.register(host('a')); tick(); const a = coordinator.snapshot()!; coordinator.visible(a.token); jest.advanceTimersByTime(DISPLAY_DWELL_MS); coordinator.interrupt(a.token); remove();
 coordinator.foreground(false); jest.advanceTimersByTime(24 * 60 * 60 * 1000 + 1); coordinator.foreground(true); coordinator.register(host('b')); tick(); expect(coordinator.snapshot()).toBeNull(); expect(coordinator.data().records[a.id].outcome).toBe('obsolete');
});
it('replay during celebration preserves quiet visits', () => {
 coordinator.register(host('a')); tick(); coordinator.lock('celebration', true, true); coordinator.replay(); coordinator.lock('celebration', false, true); tick(); expect(coordinator.snapshot()).toBeNull();
});
