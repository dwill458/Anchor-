/** Continuous luminance mask for the opaque enhanced Anchor bitmap; no tracing or threshold. */
export function enhancedInkAlpha(red: number, green: number, blue: number): number {
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return Math.max(0, Math.min(1, 1 - luminance));
}

export const ENHANCED_ANCHOR_MASK_SHADER = `
uniform shader artwork;
uniform float size;
half4 main(float2 xy) {
  half4 pixel = artwork.eval(xy);
  float luminance = dot(pixel.rgb, float3(0.2126, 0.7152, 0.0722));
  float2 centered = xy / size - float2(0.5, 0.5);
  float disk = 1.0 - smoothstep(0.495, 0.5, length(centered));
  float ink = clamp(1.0 - luminance, 0.0, 1.0) * disk;
  return half4(ink, ink, ink, ink);
}`;
