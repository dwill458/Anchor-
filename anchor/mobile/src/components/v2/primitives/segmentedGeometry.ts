const finite = (value: number) => (Number.isFinite(value) ? value : 0);

/**
 * Where the selected-segment pill sits inside a segmented control: every value finite and
 * non-negative, whatever the control's width (0 before first layout), option count or selection.
 */
export function segmentGeometry(
  controlWidth: number,
  count: number,
  selectedIndex: number,
  padding: number,
): { segmentWidth: number; offset: number } {
  const inner = Math.max(0, finite(controlWidth) - 2 * padding);
  const segmentWidth = count > 0 ? inner / count : 0;
  const index = count > 0 ? Math.min(Math.max(finite(selectedIndex), 0), count - 1) : 0;
  return { segmentWidth, offset: padding + index * segmentWidth };
}
