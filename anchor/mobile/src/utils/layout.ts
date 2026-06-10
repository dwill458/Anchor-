export const COMPACT_PHONE_WIDTH = 393;
export const COMPACT_PHONE_HEIGHT = 860;
export const SHORT_PHONE_HEIGHT = 820;

export const isCompactPhoneViewport = (width: number, height: number): boolean =>
  width <= COMPACT_PHONE_WIDTH || height <= COMPACT_PHONE_HEIGHT;

export const isShortPhoneViewport = (height: number): boolean =>
  height <= SHORT_PHONE_HEIGHT;
