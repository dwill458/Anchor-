/**
 * Procedural, analytic aura: no textures, no SVG parsing. Light is emitted from the coin's
 * circular silhouette (radius `disc`, in layer pixels) and warped by slow angular flow so the
 * boundary is irregular and travelling rather than a static ring.
 */
export const THREAD_AURA_SHADER = `
uniform float span;
uniform float disc;
uniform float time;
uniform float core;
uniform float coreWidth;
uniform float mid;
uniform float midWidth;
uniform float bloom;
uniform float bloomWidth;
uniform float filament;
uniform float movement;
uniform float particles;
uniform float reward;
uniform float3 tint;

half4 main(float2 p) {
  float2 v = p - float2(span * 0.5);
  float r = length(v);
  float u = max(r - disc, 0.0) / disc;           // distance outside the rim, in radii
  float ang = atan(v.y, v.x);
  float t = time;

  // Irregular flowing edge: angular waves that drift at different speeds and also bend with distance.
  float w1 = sin(ang * 3.0 + t * 0.55 + sin(ang * 2.0 - t * 0.31) * 1.3);
  float w2 = sin(ang * 5.0 - t * 0.74 + u * 5.0);
  float w3 = sin(ang * 8.0 + t * 0.42 - u * 7.0 + w1);
  float warp = 1.0 + movement * (0.55 * w1 + 0.3 * w2 + 0.15 * w3);
  float breath = 1.0 + 0.10 * sin(t * 0.8) + reward * 0.35;
  float k = max(warp * breath, 0.35);
  float uw = u / k;

  float hotCore = exp(-uw / coreWidth);
  float body = exp(-uw / midWidth);
  float haze = exp(-uw / bloomWidth);

  // Spiralling filaments, brightest near the rim, drifting outward like the reference wisps.
  float swirl = ang * 11.0 + u * 14.0 - t * 1.05 + w1 * 2.2;
  float strand = pow(1.0 - abs(sin(swirl)), 5.0);
  float swirl2 = ang * 17.0 - u * 20.0 + t * 0.8 + w2 * 1.6;
  strand = max(strand, 0.3 * pow(1.0 - abs(sin(swirl2)), 6.0));
  float strands = strand * exp(-uw / (bloomWidth * 0.9)) * filament;

  // Sparse motes drifting off the edge, cell-seeded in polar space.
  float a2 = ang * 26.0;
  float cellA = floor(a2);
  float cellR = floor(u * 9.0 - t * 0.9);
  float seed = fract(sin(dot(float2(cellA, cellR), float2(127.1, 311.7))) * 43758.5453);
  float2 lc = float2(fract(a2) - 0.5, fract(u * 9.0 - t * 0.9) - 0.5);
  float mote = (1.0 - smoothstep(0.08, 0.3, length(lc))) * step(1.0 - particles * 0.35, seed)
    * exp(-uw / 0.16) * (0.5 + 0.5 * sin(t * 1.3 + seed * 40.0));

  // Saturate the category colour, and a lighter variant for the hot edge.
  float luma = dot(tint, float3(0.299, 0.587, 0.114));
  float3 vivid = clamp(mix(float3(luma), tint, 1.45), 0.0, 1.0);
  float3 hot = mix(vivid, float3(1.0), 0.55);

  float fade = 1.0 - clamp((r - disc) / (span * 0.5 - disc), 0.0, 1.0);
  fade = fade * fade * (3.0 - 2.0 * fade);
  float inside = smoothstep(disc * 0.985, disc * 1.005, r);

  float3 rgb = hot * hotCore * core * (1.0 + reward * 0.6)
    + vivid * body * mid
    + vivid * haze * bloom
    + mix(vivid, hot, 0.5) * strands
    + hot * mote * 1.2;
  float a = clamp(hotCore * core * 0.9 + body * mid * 0.85 + haze * bloom * 0.7 + strands * 0.7 + mote, 0.0, 1.0);
  a *= fade * inside;
  rgb = min(rgb * fade * inside, float3(1.0));
  // Premultiplied; colour may exceed alpha slightly, which reads as additive light on dark grounds.
  return half4(half3(rgb), half(a));
}`;
