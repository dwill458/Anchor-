import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Loads `chart-agent.md`, the versioned instruction file that defines Ask Chart's identity, coaching styles and
 * skills. It is read once at first use. `version` and `hash` are logged with every turn so a conversation can be
 * traced back to the exact instructions that produced it.
 *
 * The file is copied next to the compiled output by `scripts/copy-assets.js`; under ts-node it is read from source.
 */
export const COACH_STYLES = ['SUPPORTIVE', 'DRIVEN', 'DIRECT'] as const;
export type CoachStyle = (typeof COACH_STYLES)[number];
export const DEFAULT_COACH_STYLE: CoachStyle = 'DRIVEN';

export const ASK_SKILLS = [
  'FREE',
  'CREATION',
  'BREAK_DOWN',
  'PLAN_WEEK',
  'ANOTHER_APPROACH',
  'STUCK',
  'SUGGEST_MOVE',
  'EXPLAIN_MOVE',
  'REVISE_ROUTE',
  'REFLECT',
] as const;
export type AskSkill = (typeof ASK_SKILLS)[number];

const SKILL_HEADINGS: Record<Exclude<AskSkill, 'FREE'>, string> = {
  CREATION: 'creation',
  BREAK_DOWN: 'break-down',
  PLAN_WEEK: 'plan-week',
  ANOTHER_APPROACH: 'another-approach',
  STUCK: 'stuck',
  SUGGEST_MOVE: 'suggest-move',
  EXPLAIN_MOVE: 'explain-move',
  REVISE_ROUTE: 'revise-route',
  REFLECT: 'reflect',
};

export type ChartAgent = {
  version: string;
  hash: string;
  core: string;
  styles: Record<CoachStyle, string>;
  skills: Record<Exclude<AskSkill, 'FREE'>, string>;
};

/** Splits the markdown into `## ` sections keyed by heading text (lower-cased). */
export function parseChartAgent(markdown: string): ChartAgent {
  const version = /^version:\s*(\S+)/m.exec(markdown.split(/^---\s*$/m)[1] ?? '')?.[1];
  if (!version) throw new Error('chart-agent.md is missing a version');
  const sections = new Map<string, string>();
  const parts = markdown.split(/^## /m).slice(1);
  for (const part of parts) {
    const newline = part.indexOf('\n');
    sections.set(part.slice(0, newline).trim().toLowerCase(), part.slice(newline + 1).trim());
  }
  const need = (name: string): string => {
    const value = sections.get(name);
    if (!value) throw new Error(`chart-agent.md is missing the "${name}" section`);
    return value;
  };
  return {
    version,
    hash: createHash('sha256').update(markdown).digest('hex').slice(0, 12),
    core: need('core'),
    styles: {
      SUPPORTIVE: need('style: supportive'),
      DRIVEN: need('style: driven'),
      DIRECT: need('style: direct'),
    },
    skills: Object.fromEntries(
      Object.entries(SKILL_HEADINGS).map(([skill, heading]) => [skill, need(`skill: ${heading}`)])
    ) as ChartAgent['skills'],
  };
}

let cached: ChartAgent | null = null;

export function loadChartAgent(): ChartAgent {
  if (cached) return cached;
  const file = path.join(__dirname, 'chart-agent.md');
  cached = parseChartAgent(fs.readFileSync(file, 'utf8'));
  return cached;
}

/** The system prompt for one turn: core identity, the person's chosen style, and the skill when one applies. */
export function buildAgentSystem(agent: ChartAgent, style: CoachStyle, skill: AskSkill): string {
  return [
    agent.core,
    `Coaching style for this person (${style}):\n${agent.styles[style]}`,
    skill === 'FREE' ? null : `Skill for this turn (${skill}):\n${agent.skills[skill]}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
