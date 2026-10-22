import type {
  NotificationCategory,
  NotificationTemplate,
  NotificationTone,
} from './notificationTypes';

const makeTemplate = (
  id: string,
  category: NotificationCategory,
  tone: NotificationTone,
  title: string,
  body: string,
  allowedVariables: string[] = []
): NotificationTemplate => ({
  id,
  category,
  tone,
  title,
  body,
  allowedVariables,
});

export const NOTIFICATION_TEMPLATES: Record<NotificationCategory, NotificationTemplate[]> = {
  daily_prime: [
    makeTemplate(
      'daily_prime_direct_1',
      'daily_prime',
      'direct',
      'Your anchor is ready',
      "One Focus session is enough to reinforce it today."
    ),
    makeTemplate(
      'daily_prime_encouraging_1',
      'daily_prime',
      'encouraging',
      'A clear moment is ready',
      "A short Focus Session can support today's anchor."
    ),
    makeTemplate(
      'daily_prime_reflective_1',
      'daily_prime',
      'reflective',
      'Return to your intention',
      'A short session can bring the day back into focus.'
    ),
    makeTemplate(
      'daily_prime_performance_1',
      'daily_prime',
      'performance',
      'Take a moment to focus',
      'One short session keeps you consistent.'
    ),
  ],
  thread_strength: [
    makeTemplate(
      'thread_strength_direct_1',
      'thread_strength',
      'direct',
      'Your consistency is slipping',
      'A short Focus Session can restore momentum.'
    ),
    makeTemplate(
      'thread_strength_encouraging_1',
      'thread_strength',
      'encouraging',
      'Your consistency can recover',
      'One calm Focus Session can rebuild momentum.'
    ),
    makeTemplate(
      'thread_strength_reflective_1',
      'thread_strength',
      'reflective',
      'It has been a few days',
      'A brief session can bring your anchor back into view.'
    ),
    makeTemplate(
      'thread_strength_performance_1',
      'thread_strength',
      'performance',
      'Rebuild your consistency',
      'A Focus session today brings it back up.'
    ),
  ],
  unfinished_anchor: [
    makeTemplate(
      'unfinished_anchor_direct_1',
      'unfinished_anchor',
      'direct',
      'Your anchor is not finished yet',
      "Finish shaping it when you're ready."
    ),
    makeTemplate(
      'unfinished_anchor_encouraging_1',
      'unfinished_anchor',
      'encouraging',
      'Your anchor is waiting',
      'You can finish shaping it in a quiet moment.'
    ),
    makeTemplate(
      'unfinished_anchor_reflective_1',
      'unfinished_anchor',
      'reflective',
      'An anchor is still forming',
      'Return when the shape feels ready to close.'
    ),
    makeTemplate(
      'unfinished_anchor_performance_1',
      'unfinished_anchor',
      'performance',
      'Complete the anchor',
      'Finish shaping it and save it.'
    ),
  ],
  weekly_recap: [
    makeTemplate(
      'weekly_recap_direct_1',
      'weekly_recap',
      'direct',
      'Your weekly pattern',
      'You completed {sessionCount} sessions this week. Strongest anchor: {anchorName}.',
      ['sessionCount', 'anchorName']
    ),
    makeTemplate(
      'weekly_recap_encouraging_1',
      'weekly_recap',
      'encouraging',
      'Your week took shape',
      '{sessionCount} sessions completed. Strongest anchor: {anchorName}.',
      ['sessionCount', 'anchorName']
    ),
    makeTemplate(
      'weekly_recap_reflective_1',
      'weekly_recap',
      'reflective',
      'A look at the week',
      '{sessionCount} sessions completed. Strongest anchor: {anchorName}.',
      ['sessionCount', 'anchorName']
    ),
    makeTemplate(
      'weekly_recap_performance_1',
      'weekly_recap',
      'performance',
      'Weekly progress recap',
      '{sessionCount} sessions completed. Consistency: {threadStrength}%.',
      ['sessionCount', 'threadStrength']
    ),
  ],
};

export const getAllNotificationCopy = (): string[] =>
  Object.values(NOTIFICATION_TEMPLATES)
    .flat()
    .flatMap((template) => [template.title, template.body]);
