import { z } from 'zod';
import { prisma } from '../../lib/prisma';

export const OnboardingContextSchema = z
  .object({
    // `focusCategory` remains readable for accounts created by the earlier V2
    // onboarding; the current flow records human motivation instead.
    focusCategory: z.enum([
      'desire',
      'health',
      'career',
      'relationships',
      'creativity',
      'spirituality',
      'abundance',
      'family',
      'learning',
      'adventure',
      'custom',
    ]).optional(),
    selectedCategory: z.enum([
      'desire',
      'health',
      'career',
      'relationships',
      'creativity',
      'spirituality',
      'abundance',
      'family',
      'learning',
      'adventure',
      'custom',
    ]).optional(),
    motivation: z.string().trim().min(1).max(240).optional(),
    desiredChange: z.string().trim().min(1).max(500),
    selectedOutcome: z.string().trim().max(500).optional(),
    selectedWhy: z.string().trim().max(500).optional(),
    selectedFriction: z.string().trim().max(500).optional(),
    lifeChanges: z
      .array(
        z.enum([
          'What I do every day',
          'Where I spend my time',
          'How I feel',
          "Who I'm around",
          'What I have access to',
          'How other people experience me',
        ])
      )
      .max(6)
      // Retired from onboarding (Anchor 2.0 Screen 5 took its slot). Accounts created
      // earlier still carry answers; new ones send none.
      .default([]),
    primaryNeed: z.string().trim().optional().default('Keeping the goal in front of me'),
    customAnswer: z.string().trim().max(240).optional(),
    customDesiredChange: z.string().trim().max(120).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.motivation || value.focusCategory), {
    message: 'Onboarding motivation is required.',
  });

export type OnboardingContext = z.infer<typeof OnboardingContextSchema>;

export async function getOnboardingContext(userId: string): Promise<OnboardingContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingContext: true },
  });
  const parsed = OnboardingContextSchema.safeParse(user?.onboardingContext);
  if (!parsed.success) return null;
  return parsed.data;
}
