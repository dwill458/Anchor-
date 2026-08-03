import { Logger, LogLevel } from '../logger';

describe('Logger Chart privacy boundary', () => {
  it('redacts private Chart fields from structured metadata', () => {
    const logger = new Logger({
      level: LogLevel.DEBUG,
      enableColors: false,
      enableTimestamps: false,
    });
    const output = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    logger.info('chart telemetry', {
      destinationText: 'private destination',
      waypointTitle: 'private waypoint',
      waypointDescription: 'private description',
      intentionText: 'private intention',
      anchorSnapshot: { intentionText: 'nested intention' },
      body: 'private reflection',
      structuredContent: { whatHelped: 'private help' },
      whatLearned: 'private learning',
      extractedThemes: ['private theme'],
      rawRequestBody: 'private request',
    });

    expect(output.mock.calls[0][0]).not.toContain('private destination');
    expect(output.mock.calls[0][0]).not.toContain('private waypoint');
    expect(output.mock.calls[0][0]).not.toContain('private description');
    expect(output.mock.calls[0][0]).not.toContain('private intention');
    expect(output.mock.calls[0][0]).not.toContain('private reflection');
    expect(output.mock.calls[0][0]).not.toContain('private help');
    expect(output.mock.calls[0][0]).not.toContain('private learning');
    expect(output.mock.calls[0][0]).not.toContain('private theme');
    expect(output.mock.calls[0][0]).not.toContain('private request');
    output.mockRestore();
  });

  it('does not serialize raw Error messages or stacks', () => {
    const logger = new Logger({
      level: LogLevel.DEBUG,
      enableColors: false,
      enableTimestamps: false,
    });
    const output = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    logger.error('chart failure', new Error('private intention text'));

    expect(output.mock.calls[0][0]).not.toContain('private intention text');
    expect(output.mock.calls[0][0]).not.toContain('stack');
    output.mockRestore();
  });
});
