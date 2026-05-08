import { buildProfileGreeting } from '../profileGreeting';

describe('buildProfileGreeting', () => {
  it('uses the first word of the saved name', () => {
    expect(
      buildProfileGreeting('Deon Rivers', 'UTC+0 (GMT)', new Date('2026-04-14T09:00:00.000Z'))
    ).toBe('Good morning, Deon');
  });

  it('uses the selected UTC offset when no IANA timezone is present', () => {
    expect(
      buildProfileGreeting('Maya', 'UTC−6 (CST)', new Date('2026-04-14T20:00:00.000Z'))
    ).toBe('Good afternoon, Maya');
  });

  it('uses the selected IANA timezone when present', () => {
    expect(
      buildProfileGreeting(
        'Avery',
        'UTC+1 · Europe/Paris',
        new Date('2026-04-14T18:00:00.000Z')
      )
    ).toBe('Good evening, Avery');
  });

  it('falls back to salutation only when no name is available', () => {
    expect(
      buildProfileGreeting('', 'UTC+0 (GMT)', new Date('2026-04-14T13:00:00.000Z'))
    ).toBe('Good afternoon');
  });
});
