import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChartActiveView, type ChartCelebration } from '@/components/v2/chart/ChartActiveView';
import { ChartCreationFlow, type ChartCreationApi } from '@/components/v2/chart/ChartCreationFlow';
import { CHART_CATEGORY_PACK } from '@/components/v2/chart/chartRouteGeometry';
import { toChartViewModel } from '@/adapters/v2/chart/chartV2Model';
import { V2_SAMPLE_ANCHOR_SVGS } from '@/constants/v2';
import type { ChartProposal } from '@/services/v2/chartV2Api';
import type { CourseDetail } from '@/types/chart';
import { colors, radii, spacing, typography } from '@/theme/v2';

/**
 * Development-only Chart motion lab. Runs the real creation → mapping →
 * review → reveal → permanent Chart flow against a fake planner with a chosen
 * latency, so the choreography (including hold states and failure) can be
 * judged on a device without creating real Charts.
 */

type Latency = 'fast' | 'slow' | 'verySlow' | 'fail';
const LATENCY_MS: Record<Latency, number> = { fast: 700, slow: 9000, verySlow: 26000, fail: 2500 };

const SAMPLES: Record<string, { intention: string; destination: string; waypoints: string[]; move: string }> = {
  career: {
    intention: 'Launch my app and make it my full-time work',
    destination: 'The app earns enough to work on it full time',
    waypoints: ['First 50 people use it every week', 'First paying customers', 'Revenue covers half my salary', 'The app pays for full-time work'],
    move: 'Ship the onboarding redesign to ten testers',
  },
  health: {
    intention: 'Feel strong and rested in my body',
    destination: 'I move most days and sleep through the night',
    waypoints: ['Three movement days a week, four weeks running', 'Asleep by 11 on weeknights', 'Run 5 km without stopping', 'Movement and sleep hold without effort'],
    move: 'Lay out running clothes tonight',
  },
  creativity: {
    intention: 'Finish and share a body of work',
    destination: 'Ten finished pieces shared publicly',
    waypoints: ['Three pieces finished', 'A weekly making rhythm holds', 'Ten pieces finished', 'The work is shown publicly'],
    move: 'Block two hours on Saturday for the studio',
  },
  relationships: {
    intention: 'Be closer to the people I love',
    destination: 'A standing night together and easy, honest talks',
    waypoints: ['A weekly night together, four weeks running', 'One hard conversation had well', 'Home feels at ease'],
    move: 'Put next Thursday in both calendars',
  },
  desire: {
    intention: 'Build a life that feels like mine',
    destination: 'My days reflect what I actually want',
    waypoints: ['Name what I want in plain words', 'One week shaped around it', 'Two months of weeks like that', 'My days reflect what I want', 'It no longer needs protecting', 'This is simply how I live'],
    move: 'Write the list of what I want tonight',
  },
};

function sampleFor(category: string) {
  return SAMPLES[category] ?? SAMPLES.desire;
}

function fakeProposal(category: string): ChartProposal {
  const sample = sampleFor(category);
  const now = new Date().toISOString();
  return {
    proposalId: `preview-${Date.now()}`,
    kind: 'CREATE',
    anchorId: 'preview-anchor',
    courseId: null,
    baseCourseVersion: null,
    destination: sample.destination,
    complexity: sample.waypoints.length > 4 ? 'MODERATE' : 'SIMPLE',
    waypoints: sample.waypoints.map((title, index) => ({
      clientKey: `p${index}`,
      title,
      rationale: null,
      kind: 'MILESTONE',
      metricLabel: null,
      metricTarget: null,
      metricBaseline: null,
    })),
    suggestedOneMove: { title: sample.move, rationale: null },
    guidance: null,
    generation: { source: 'ai', fallbackUsed: false, needsNaming: false },
    createdAt: now,
    expiresAt: now,
  };
}

function courseFrom(destination: string, titles: string[], move: string | null, reachedCount = 0): CourseDetail {
  const waypoints = titles.map((title, index) => ({
    id: `w${index}`,
    courseId: 'preview-course',
    position: (index + 1) * 100,
    title,
    description: null,
    state: index < reachedCount ? 'REACHED' : index === reachedCount ? 'CURRENT' : 'UPCOMING',
    blockedReason: null,
    reachedAt: index < reachedCount ? new Date().toISOString() : null,
    skippedAt: null,
    cancelledAt: null,
    anchorLink: null,
  })) as CourseDetail['waypoints'];
  const current = waypoints[reachedCount];
  return {
    id: 'preview-course',
    destinationText: destination,
    status: reachedCount >= titles.length ? 'COMPLETED' : 'ACTIVE',
    version: 1 + reachedCount,
    currentWaypointId: current?.id ?? null,
    currentMoveId: move && current ? 'm0' : null,
    waypointCount: titles.length,
    reachedCount,
    plottedAt: new Date().toISOString(),
    completedAt: null,
    archivedAt: null,
    destinationAnchorLink: null,
    anchorId: 'preview-anchor',
    waypoints,
    moves:
      move && current
        ? [{ id: 'm0', courseId: 'preview-course', waypointId: current.id, title: move, rationale: null, source: 'AI', status: 'ACTIVE', position: 100, isCurrent: true, completedAt: null, createdAt: new Date().toISOString() }]
        : [],
  } as CourseDetail;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function V2ChartPreview({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState('career');
  const [latency, setLatency] = useState<Latency>('fast');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [run, setRun] = useState(0);
  const [mode, setMode] = useState<'setup' | 'create' | 'active'>('setup');
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [celebration, setCelebration] = useState<ChartCelebration | null>(null);
  const [entrance, setEntrance] = useState<'reveal' | 'open'>('reveal');
  const sample = sampleFor(category);

  const api: ChartCreationApi = useMemo(
    () => ({
      plan: async () => {
        await wait(LATENCY_MS[latency]);
        if (latency === 'fail') throw new Error('Network error. Please check your connection.');
        return { status: 'proposal', proposal: fakeProposal(category) };
      },
      adjust: async () => {
        await wait(1200);
        return { status: 'proposal', proposal: fakeProposal(category) };
      },
      create: async (_anchorId, body) => {
        await wait(500);
        return courseFrom(body.destinationText, body.waypoints.map((waypoint) => waypoint.title), body.oneMove?.title ?? null);
      },
    }),
    [category, latency]
  );

  const identity = { intention: sample.intention, category, art: null, imageUrl: null };
  const anchorArt = { svg: V2_SAMPLE_ANCHOR_SVGS.medium, category };

  if (mode === 'create') {
    return (
      <ChartCreationFlow
        key={run}
        anchorId="preview-anchor"
        identity={identity}
        anchorArt={anchorArt}
        vision={null}
        reducedMotion={reducedMotion}
        api={api}
        onBack={() => setMode('setup')}
        onOpenVision={() => undefined}
        onCreated={(created) => setCourse(created)}
        onExplore={() => {
          setEntrance('reveal');
          setMode('active');
        }}
      />
    );
  }

  if (mode === 'active' && course) {
    const view = toChartViewModel(course, { completedMoveCount: 0, practiceCount: 0 });
    return (
      <View style={styles.flex}>
        <ChartActiveView
          key={`${entrance}-${run}`}
          view={view}
          identity={identity}
          anchorArt={anchorArt}
          vision={null}
          stale={false}
          busyKey={null}
          reducedMotion={reducedMotion}
          celebration={celebration}
          onCelebrationDone={() => setCelebration(null)}
          onBack={() => setMode('setup')}
          onOpenWaypoint={() => undefined}
          onCompleteMove={async () => true}
          onOpenVision={() => undefined}
          onOpenLog={() => undefined}
          onAdjust={() => undefined}
          actionError={null}
          entrance={entrance}
        />
        <View style={[styles.devBar, { bottom: insets.bottom + spacing[3] }]}>
          <DevButton
            label="Reach next waypoint"
            onPress={() => {
              const reached = course.reachedCount ?? 0;
              const titles = course.waypoints.map((waypoint) => waypoint.title);
              if (reached >= titles.length - 1) return;
              setCourse(courseFrom(course.destinationText, titles, course.moves?.[0]?.title ?? null, reached + 1));
              setCelebration({ completedTitle: titles[reached], nextTitle: titles[reached + 1] ?? null, fromFraction: reached / titles.length });
            }}
          />
          <DevButton
            label="Reopen"
            onPress={() => {
              setEntrance('open');
              setRun((value) => value + 1);
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.setup} contentContainerStyle={{ paddingTop: insets.top + spacing[5], paddingBottom: insets.bottom + spacing[8], paddingHorizontal: spacing[5], gap: spacing[5] }}>
      <Text style={styles.title}>Chart motion lab</Text>
      <Text style={styles.body}>Runs the real Chart flow against a fake planner. Nothing is saved.</Text>
      <Text style={styles.label}>Environment</Text>
      <View style={styles.row}>
        {Object.keys(SAMPLES).map((key) => (
          <DevChip key={key} label={`${key} · ${CHART_CATEGORY_PACK[key]}`} active={category === key} onPress={() => setCategory(key)} />
        ))}
      </View>
      <Text style={styles.label}>Planner latency</Text>
      <View style={styles.row}>
        {(Object.keys(LATENCY_MS) as Latency[]).map((key) => (
          <DevChip key={key} label={`${key} (${LATENCY_MS[key] / 1000}s)`} active={latency === key} onPress={() => setLatency(key)} />
        ))}
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.body}>Reduced motion</Text>
        <Switch value={reducedMotion} onValueChange={setReducedMotion} />
      </View>
      <DevButton
        label="Start Chart creation"
        onPress={() => {
          setCourse(null);
          setCelebration(null);
          setRun((value) => value + 1);
          setMode('create');
        }}
        testID="chart-preview-start"
      />
      <DevButton label="Close" onPress={onClose} />
    </ScrollView>
  );
}

function DevChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function DevButton({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]} testID={testID}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.ink.base },
  setup: { flex: 1, backgroundColor: colors.ink.base },
  title: { ...typography.headingXL, color: colors.ink.text.primary },
  body: { ...typography.bodyMD, color: colors.ink.text.secondary },
  label: { ...typography.labelSM, color: colors.ink.text.secondary, letterSpacing: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { paddingHorizontal: spacing[3], minHeight: 34, justifyContent: 'center', borderRadius: radii.pill, borderWidth: 1, borderColor: colors.ink.hairlineStrong },
  chipActive: { backgroundColor: colors.canvas, borderColor: colors.canvas },
  chipText: { ...typography.labelMD, color: colors.ink.text.primary },
  chipTextActive: { color: colors.text.primary },
  button: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink.raised, borderWidth: 1, borderColor: colors.ink.hairlineStrong, paddingHorizontal: spacing[4] },
  buttonText: { ...typography.labelLG, color: colors.ink.text.primary },
  devBar: { position: 'absolute', right: spacing[4], gap: spacing[2] },
});
