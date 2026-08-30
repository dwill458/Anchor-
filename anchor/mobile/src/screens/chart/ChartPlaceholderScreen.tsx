import React from 'react';
import { Text } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { ChartCard, ChartScreenFrame } from './chartUi';

export const ChartPlaceholderScreen: React.FC = () => {
  const route = useRoute();
  const routeName = route.name;
  const copy = routeName === 'AIPlanReview'
    ? 'AI planning is not available in this shell yet.'
    : routeName === 'ReflectionComposer'
      ? 'Reflection Composer is not available in this shell yet.'
      : 'Course Log is not available in this shell yet.';
  return (
    <ChartScreenFrame title={routeName === 'AIPlanReview' ? 'Plan review' : routeName === 'ReflectionComposer' ? 'Reflection' : 'Course Log'}>
      <ChartCard>
        <Text style={{ color: '#F5F5DC', fontFamily: 'Cinzel-SemiBold', fontSize: 22 }}>{copy}</Text>
        <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 22 }}>This route is registered for navigation completeness and remains behind its Workstream flag.</Text>
      </ChartCard>
    </ChartScreenFrame>
  );
};

export default ChartPlaceholderScreen;
