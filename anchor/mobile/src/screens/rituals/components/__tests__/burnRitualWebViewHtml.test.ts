import { burnRitualWebViewHtml } from '../burnRitualWebViewHtml';

describe('burnRitualWebViewHtml', () => {
  it('contains balanced timeout wrappers in runSequence', () => {
    expect(burnRitualWebViewHtml).not.toContain('}, 900)))');
    expect(burnRitualWebViewHtml).not.toContain('}, 3800)))');
    expect(burnRitualWebViewHtml).not.toContain('}, 5800)))');

    expect(burnRitualWebViewHtml).toContain('}, 900));');
    expect(burnRitualWebViewHtml).toContain('}, 3800));');
    expect(burnRitualWebViewHtml).toContain('}, 5800));');
  });

  it('keeps the React Native bridge hooks for start and completion', () => {
    expect(burnRitualWebViewHtml).toContain("window.addEventListener('message'");
    expect(burnRitualWebViewHtml).toContain("msg.cmd === 'start'");
    expect(burnRitualWebViewHtml).toContain("event: 'burnComplete'");
  });

  it('renders injected artwork as a circular crop inside the sigil shell', () => {
    expect(burnRitualWebViewHtml).toContain('#sigil-image-shell img');
    expect(burnRitualWebViewHtml).toContain('width: 72%');
    expect(burnRitualWebViewHtml).toContain('height: 72%');
    expect(burnRitualWebViewHtml).toContain('object-fit: cover');
    expect(burnRitualWebViewHtml).toContain('border-radius: 50%');
  });
});
