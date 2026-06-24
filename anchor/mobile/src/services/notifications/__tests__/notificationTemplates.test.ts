import { getAllNotificationCopy } from '../notificationTemplates';
import {
  renderNotificationTemplate,
  selectNotificationTemplate,
} from '../notificationSelector';

describe('notification templates', () => {
  it('does not include banned notification copy', () => {
    const copy = getAllNotificationCopy().join(' ').toLowerCase();

    expect(copy).not.toContain('ritual');
    expect(copy).not.toContain('streak lost');
    expect(copy).not.toContain('come back');
  });

  it('selects by preferred tone and renders variables', () => {
    const template = selectNotificationTemplate({
      category: 'weekly_recap',
      tone: 'performance',
    });

    const rendered = renderNotificationTemplate({
      template,
      variables: {
        sessionCount: 4,
        threadStrength: 82,
      },
    });

    expect(template.tone).toBe('performance');
    expect(rendered.body).toContain('4');
    expect(rendered.body).toContain('82');
  });

  it('avoids repeating the last template when another candidate exists', () => {
    const first = selectNotificationTemplate({
      category: 'daily_prime',
      tone: 'encouraging',
    });
    const next = selectNotificationTemplate({
      category: 'daily_prime',
      tone: 'encouraging',
      lastTemplateIdByCategory: {
        daily_prime: first.id,
      },
    });

    expect(next.id).toBe(first.id);
  });
});

