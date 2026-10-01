
import { fireEvent, render } from '@testing-library/react-native';
import { VisionGenerationBoard } from '../VisionGenerationBoard';
import type { VisionGenerationJob } from '@/hooks/v2/vision';

describe('VisionGenerationBoard', () => {
  const jobRunning: VisionGenerationJob = {
    id: 'job-1', visionId: 'vision-1', anchorId: 'anchor-1',
    status: 'RUNNING',
    stage: 'creating_images',
    setNumber: 1,
    retryCount: 0,
    error: null,
    candidates: [],
  };

  const defaultProps = {
    anchorIntention: 'I build what matters.',
    anchorCategory: 'career',
    onBack: jest.fn(),
  };

  it('renders initial mode board with intention card and developing photo slots', () => {
    const { getByText, getByTestId } = render(
      <VisionGenerationBoard {...defaultProps} mode="initial" job={jobRunning} />,
    );
    expect(getByText('Your future\nis taking shape.')).toBeTruthy();
    expect(getByText('Finding the moments that make it real.')).toBeTruthy();
    expect(getByTestId('developing-photo-candidate-0')).toBeTruthy();
    expect(() => getByTestId('developing-photo-candidate-1')).toThrow();
  });

  it('renders add mode board with existing photo and incoming slot', () => {
    const existingTiles = [
      {
        id: 'scene-existing-1', sceneId: 'scene-existing-1', prompt: null, sortOrder: 0, isHero: true,
        imageUrl: 'https://cdn.example.com/existing.jpg',
        aspectRatio: 1.2,
        order: 1,
      },
    ];

    const { getByText, getByTestId } = render(
      <VisionGenerationBoard
        {...defaultProps}
        mode="add"
        job={jobRunning}
        existingTiles={existingTiles}
      />,
    );
    expect(getByText('Bringing this\nmoment to life.')).toBeTruthy();
    expect(() => getByTestId('vision-board-photo-scene-existing-1')).toThrow();
    expect(getByTestId('developing-photo-incoming')).toBeTruthy();
  });

  it('renders calm failure state and triggers onRetry', () => {
    const onRetry = jest.fn();
    const jobFailed: VisionGenerationJob = {
      ...jobRunning,
      status: 'FAILED',
      candidates: [],
    };

    const { getByText } = render(
      <VisionGenerationBoard
        {...defaultProps}
        mode="initial"
        job={jobFailed}
        onRetry={onRetry}
      />,
    );
    expect(getByText('Your Vision needs another moment.')).toBeTruthy();
    const retryBtn = getByText('Retry this set');
    expect(retryBtn).toBeTruthy();
    fireEvent.press(retryBtn);
    expect(onRetry).toHaveBeenCalled();
  });
});
