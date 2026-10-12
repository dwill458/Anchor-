import { render } from '@testing-library/react-native';
import { Image } from 'react-native';
import { AnchorShareStudio } from '../AnchorShareStudio';
import type { ShareExportData } from '../shareTypes';

const mockPreview = jest.fn();
jest.mock('../AnchorSharePreview', () => ({ AnchorSharePreview: (props: unknown) => { mockPreview(props); return null; } }));
jest.mock('../ShareLayoutSelector', () => ({ ShareLayoutSelector: () => null }));
jest.mock('../useShareExportRenderer', () => ({ useShareExportRenderer: () => ({
  prepare: jest.fn(), release: jest.fn(), renderPng: jest.fn(), exportNode: null,
}) }));
jest.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPro: false }) }));
jest.mock('@/services/anchorExportService', () => ({ saveShareExport: jest.fn(), sharePngViaSystemSheet: jest.fn() }));

const data: ShareExportData = { intention: 'My future', category: 'career', categoryLabel: 'Career', svg: '<svg/>',
  visionImageUrl: 'https://example.com/my-vision.jpg' };

beforeEach(() => { jest.spyOn(Image, 'prefetch').mockResolvedValue(true); });
afterEach(() => { jest.restoreAllMocks(); });

it('opens on Vision when requested, while other callers keep the original default', () => {
  const view = render(<AnchorShareStudio visible onClose={jest.fn()} data={data} initialLayout="vision" />);
  expect(mockPreview.mock.calls.at(-1)?.[0].layout).toBe('vision');
  view.unmount();
  render(<AnchorShareStudio visible onClose={jest.fn()} data={data} />);
  expect(mockPreview.mock.calls.at(-1)?.[0].layout).toBe('minimal');
});

it('falls back to the original default when the requested layout has no content', () => {
  render(<AnchorShareStudio visible onClose={jest.fn()} data={{ ...data, visionImageUrl: null }} initialLayout="vision" />);
  expect(mockPreview.mock.calls.at(-1)?.[0].layout).toBe('minimal');
});
