export const COMPACT_PHONE_WIDTH = 390;
export const COMPACT_PHONE_HEIGHT = 860;
export const SHORT_PHONE_HEIGHT = 820;

// Treat tall large phones like full layouts even if their portrait width is ~412dp.
export const isCompactPhoneViewport = (width: number, height: number): boolean =>
  width <= COMPACT_PHONE_WIDTH || height <= COMPACT_PHONE_HEIGHT;

export const isShortPhoneViewport = (height: number): boolean =>
  height <= SHORT_PHONE_HEIGHT;
