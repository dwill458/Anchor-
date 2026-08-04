import React, { useEffect, useMemo } from 'react';
import { Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { ReflectionComposer } from '@/components/reflection/ReflectionComposer';
import { useAuthStore } from '@/stores/authStore';
import { AnalyticsEvents, trackChartEventOnce } from '@/services/AnalyticsService';
import { useCourseLogStore } from '@/stores/courseLogStore';
import type { ChartStackParamList, ReflectionRecord } from '@/types/chart';
import { ChartCard, ChartScreenFrame } from './chartUi';

type Nav = NativeStackNavigationProp<ChartStackParamList, 'ReflectionComposer'>;
type Route = RouteProp<ChartStackParamList, 'ReflectionComposer'>;

export const ReflectionComposerScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const logStore = useCourseLogStore();
  useEffect(() => {
    if (route.params.source !== 'POST_PRACTICE') return;
    trackChartEventOnce(AnalyticsEvents.POST_PRACTICE_REFLECTION_OPENED, accountId, route.key, {
      entry_source: 'post_practice',
    });
  }, [accountId, route.key, route.params.source]);
  const cached = route.params.reflectionId ? logStore.findReflection(route.params.reflectionId) : null;
  // Course Log intentionally exposes only display-safe reflection fields. The edit request itself
  // permits only body, structured content, mood, and consent, so this local envelope is never sent.
  const initialReflection = useMemo<ReflectionRecord | undefined>(() => {
    if (!cached || !route.params.reflectionId) return undefined;
    const now = new Date().toISOString();
    return {
      id: cached.id,
      source: cached.moodAfter ? 'POST_PRACTICE' : route.params.source,
      promptType: cached.promptType,
      promptVersion: route.params.promptVersion ?? 1,
      body: cached.body,
      structuredContent: cached.structuredContent,
      moodBefore: null,
      moodAfter: cached.moodAfter,
      practiceSessionId: null,
      anchorId: null,
      courseId: route.params.courseId ?? null,
      waypointId: route.params.waypointId ?? null,
      aiConsentGrantedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      idempotencyKey: `cached:${cached.id}`,
      schemaVersion: 1,
    };
  }, [cached, route.params]);

  if (route.params.reflectionId && !initialReflection) {
    return <ChartScreenFrame title="Reflection"><ChartCard><Text style={{ color: '#C0C0C0' }}>This reflection is no longer available to edit.</Text></ChartCard></ChartScreenFrame>;
  }
  return <ReflectionComposer
    source={route.params.source}
    promptType={route.params.promptType}
    promptVersion={route.params.promptVersion ?? 1}
    courseId={route.params.courseId}
    waypointId={route.params.waypointId}
    practiceSessionId={route.params.practiceSessionId}
    anchorId={route.params.anchorId}
    draftKey={route.params.draftKey ?? `reflection:${route.params.practiceSessionId ?? route.params.courseId ?? 'new'}:${route.params.promptType}`}
    initialReflection={initialReflection}
    onSaved={() => { void logStore.refresh(); navigation.goBack(); }}
    onSkipped={() => navigation.goBack()}
    onDeleted={() => {
      if (route.params.reflectionId) logStore.markReflectionDeleted(route.params.reflectionId);
      navigation.goBack();
    }}
  />;
};

export default ReflectionComposerScreen;
