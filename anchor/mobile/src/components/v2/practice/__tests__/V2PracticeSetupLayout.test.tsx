import { fireEvent, render } from '@testing-library/react-native';
import Animated from 'react-native-reanimated';
import { V2PracticeSetupLayout } from '../V2PracticeSetupLayout';

jest.mock('@/navigation/v2/ProgressiveFocusTransition', () => ({ useAnchorTransitionReveal: () => ({}) }));

describe('V2PracticeSetupLayout viewport reporting', () => {
  it('reports the actual scroll viewport height after the dynamic footer is laid out', () => {
    const onScrollViewportLayout = jest.fn();
    const view = render(<V2PracticeSetupLayout onBack={jest.fn()} sidePadding={24} footer={<></>} footerPaddingBottom={12}
      onScrollViewportLayout={onScrollViewportLayout}><></></V2PracticeSetupLayout>);
    const scroll = view.UNSAFE_getByType(Animated.ScrollView);

    fireEvent(scroll, 'layout', { nativeEvent: { layout: { height: 438, width: 345, x: 0, y: 52 } } });

    expect(onScrollViewportLayout).toHaveBeenCalledWith(438);
  });
});
