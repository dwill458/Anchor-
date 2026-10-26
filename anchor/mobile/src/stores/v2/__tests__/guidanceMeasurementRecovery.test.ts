import { GUIDANCE_REGISTRY } from '@/constants/v2/guidanceRegistry';
import { createGuidanceCoordinator, PRESENT_WINDOW_MS, type GuidanceHost } from '../guidanceCoordinator';

type MeasuredHost = GuidanceHost & { targetRevision: number };
let coordinator: ReturnType<typeof createGuidanceCoordinator>;
const tick = () => jest.advanceTimersByTime(0);
const makeHost = (): MeasuredHost => ({
  key: 'chart:course:move', visitKey: 'chart:route:qa', account: 'qa', ready: true,
  candidates: ['chart.next_move'], targetRevision: 0, present: jest.fn(), hide: jest.fn(),
});
const expireMeasurement = () => jest.advanceTimersByTime(PRESENT_WINDOW_MS + 1);
beforeEach(() => {
  jest.useFakeTimers();
  coordinator = createGuidanceCoordinator(GUIDANCE_REGISTRY, jest.fn());
  coordinator.bind('qa', { records: {}, discovery: {} });
});
afterEach(() => { coordinator.dispose(); jest.useRealTimers(); });

it('recovers a valid Chart teaching when its target lays out later during the same visit', () => {
  const host = makeHost(); coordinator.register(host); tick();
  const first = coordinator.snapshot()!; expireMeasurement();
  expect(coordinator.snapshot()).toBeNull();
  expect(coordinator.data().records['chart.next_move']).toBeUndefined();
  coordinator.update({ ...host, targetRevision: 1 }); tick();
  expect(coordinator.snapshot()).toMatchObject({ id: 'chart.next_move', hostKey: host.key });
  expect(coordinator.snapshot()?.token).not.toBe(first.token);
  coordinator.visible(coordinator.snapshot()!.token);
  expect(coordinator.data().records['chart.next_move'].presentAttempts).toBe(1);
});

it('waits for a changed target signal and never polls or retries repeated layout values', () => {
  const host = makeHost(); coordinator.register(host); tick(); expireMeasurement();
  jest.advanceTimersByTime(60_000);
  coordinator.update({ ...host }); tick();
  expect(host.present).toHaveBeenCalledTimes(1);
  coordinator.update({ ...host, targetRevision: 1 }); tick();
  expect(host.present).toHaveBeenCalledTimes(2);
  expireMeasurement();
  coordinator.update({ ...host, targetRevision: 1 }); tick();
  jest.advanceTimersByTime(60_000);
  expect(host.present).toHaveBeenCalledTimes(2);
});

it('bounds measurement recovery to two retries in a visit even when layout keeps changing', () => {
  const host = makeHost(); coordinator.register(host); tick(); expireMeasurement();
  for (let revision = 1; revision <= 8; revision++) {
    coordinator.update({ ...host, targetRevision: revision }); tick(); expireMeasurement();
  }
  expect(host.present).toHaveBeenCalledTimes(3);
  expect(coordinator.snapshot()).toBeNull();
  expect(coordinator.data().records['chart.next_move']).toBeUndefined();
});

it('does not duplicate an active presentation when target layout changes', () => {
  const host = makeHost(); coordinator.register(host); tick();
  const token = coordinator.snapshot()!.token;
  coordinator.update({ ...host, targetRevision: 1 }); tick();
  expect(coordinator.snapshot()?.token).toBe(token);
  expect(host.present).toHaveBeenCalledTimes(1);
});

it.each(['visible', 'completed', 'cancelled', 'navigation', 'celebration'] as const)(
  'never rearms a %s visit from a target readiness event', state => {
    const host = makeHost(); const unregister = coordinator.register(host); tick();
    const token = coordinator.snapshot()!.token;
    if (state === 'visible' || state === 'completed') coordinator.visible(token);
    if (state === 'completed') coordinator.finish(token, 'acknowledged');
    else if (state === 'cancelled' || state === 'visible') coordinator.interrupt(token);
    else if (state === 'navigation') unregister();
    else if (state === 'celebration') { coordinator.lock('celebration', true, true); coordinator.lock('celebration', false, true); }
    coordinator.update({ ...host, targetRevision: 1 }); tick();
    expect(coordinator.snapshot()).toBeNull();
    expect(host.present).toHaveBeenCalledTimes(1);
  },
);

it('does not recover a failed target after navigating away and registering the same visit again', () => {
  const host = makeHost(); const unregister = coordinator.register(host); tick(); expireMeasurement();
  unregister(); coordinator.register({ ...host, targetRevision: 1 }); tick();
  expect(coordinator.snapshot()).toBeNull();
  expect(host.present).toHaveBeenCalledTimes(1);
});

it('does not recover a failed target when the teaching is discovered before layout becomes ready', () => {
  const host = makeHost(); coordinator.register(host); tick(); expireMeasurement();
  coordinator.discover('chart.next_move');
  coordinator.update({ ...host, targetRevision: 1 }); tick();
  expect(coordinator.snapshot()).toBeNull();
  expect(coordinator.data().records['chart.next_move'].outcomeDetail).toBe('learned_by_use');
});

it('remembers target readiness arriving during measurement and recovers once the bounded window expires', () => {
  const host = makeHost(); coordinator.register(host); tick();
  const firstToken = coordinator.snapshot()!.token;
  jest.advanceTimersByTime(PRESENT_WINDOW_MS / 2);
  coordinator.update({ ...host, targetRevision: 1 }); tick();
  expect(coordinator.snapshot()?.token).toBe(firstToken);
  expect(host.present).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(PRESENT_WINDOW_MS / 2 + 1);
  expect(coordinator.snapshot()).toMatchObject({ id: 'chart.next_move' });
  expect(coordinator.snapshot()?.token).not.toBe(firstToken);
  expect(host.present).toHaveBeenCalledTimes(2);
  expireMeasurement(); jest.advanceTimersByTime(60_000);
  expect(coordinator.snapshot()).toBeNull();
  expect(host.present).toHaveBeenCalledTimes(2);
});

it.each(['blur', 'lock', 'background'] as const)('cancels queued target recovery on %s before arbitration', reason => {
  const host = makeHost(); coordinator.register(host); tick(); expireMeasurement();
  coordinator.update({ ...host, targetRevision: 1 });
  if (reason === 'blur') coordinator.update({ ...host, targetRevision: 1, ready: false });
  else if (reason === 'lock') coordinator.lock('modal', true);
  else coordinator.foreground(false);
  tick();
  if (reason === 'blur') coordinator.update({ ...host, targetRevision: 2 });
  else if (reason === 'lock') coordinator.lock('modal', false);
  else coordinator.foreground(true);
  tick();
  expect(coordinator.snapshot()).toBeNull();
  expect(host.present).toHaveBeenCalledTimes(1);
});

it('does not rearm a queued recovery after its eligible candidate disappears and returns', () => {
  const host = makeHost(); coordinator.register(host); tick(); expireMeasurement();
  coordinator.update({ ...host, targetRevision: 1 });
  coordinator.update({ ...host, targetRevision: 1, candidates: [] }); tick();
  coordinator.update({ ...host, targetRevision: 2 }); tick();
  expect(coordinator.snapshot()).toBeNull();
  expect(host.present).toHaveBeenCalledTimes(1);
});
it('keeps the measurement retry bound when an unrelated feature is replayed during recovery', () => {
  const host = makeHost(); coordinator.register(host); tick(); expireMeasurement();
  coordinator.update({ ...host, targetRevision: 1 });
  coordinator.replay('today.recommended'); tick(); expireMeasurement();
  coordinator.update({ ...host, targetRevision: 2 }); tick(); expireMeasurement();
  coordinator.update({ ...host, targetRevision: 3 }); tick();
  expect(host.present).toHaveBeenCalledTimes(3);
});
