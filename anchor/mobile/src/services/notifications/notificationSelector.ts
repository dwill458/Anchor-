import {
  NOTIFICATION_TEMPLATES,
} from './notificationTemplates';
import type {
  LastNotificationSentAt,
  NotificationCategory,
  NotificationTemplate,
  NotificationTone,
} from './notificationTypes';

export interface SelectNotificationTemplateInput {
  category: NotificationCategory;
  tone: NotificationTone;
  lastTemplateIdByCategory?: Partial<Record<NotificationCategory, string>>;
}

export interface RenderNotificationTemplateInput {
  template: NotificationTemplate;
  variables?: Record<string, string | number | undefined | null>;
}

const FALLBACK_TONE: NotificationTone = 'encouraging';

export function selectNotificationTemplate({
  category,
  tone,
  lastTemplateIdByCategory = {},
}: SelectNotificationTemplateInput): NotificationTemplate {
  const templates = NOTIFICATION_TEMPLATES[category];
  const toneMatches = templates.filter((template) => template.tone === tone);
  const candidates = toneMatches.length > 0
    ? toneMatches
    : templates.filter((template) => template.tone === FALLBACK_TONE);
  const lastTemplateId = lastTemplateIdByCategory[category];

  return candidates.find((template) => template.id !== lastTemplateId) ?? candidates[0] ?? templates[0];
}

export function renderNotificationTemplate({
  template,
  variables = {},
}: RenderNotificationTemplateInput): { title: string; body: string } {
  const render = (input: string): string =>
    input.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
      const value = variables[key];
      if (value == null || value === '') {
        return key === 'anchorName' ? 'your anchor' : '';
      }
      return String(value);
    }).replace(/\s+/g, ' ').trim();

  return {
    title: render(template.title),
    body: render(template.body),
  };
}

export function hasSentCategoryToday(
  sentAt: LastNotificationSentAt | undefined,
  category: NotificationCategory,
  now: Date
): boolean {
  const value = sentAt?.[category];
  if (!value) {
    return false;
  }

  const sentDate = new Date(value);
  if (Number.isNaN(sentDate.getTime())) {
    return false;
  }

  return sentDate.getFullYear() === now.getFullYear() &&
    sentDate.getMonth() === now.getMonth() &&
    sentDate.getDate() === now.getDate();
}
