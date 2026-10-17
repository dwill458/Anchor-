/** Five preblurred alpha tiles; animation never reparses or rasterizes the SVG. */
export const THREAD_AURA_SHADER = `
uniform shader atlas;
uniform float span;
uniform float time;
uniform float strength;
uniform float radius;
uniform float blur;
uniform float inner;
uniform float outer;
uniform float movement;
uniform float particles;
uniform float ambient;
uniform float reward;
uniform float3 tint;

float field(float2 p, float t) {
  return sin(p.x * 0.051 + sin(p.y * 0.037 - t * 0.61) * 1.6 + t * 0.47)
       * sin(p.y * 0.043 + sin(p.x * 0.029 + t * 0.37) * 1.3 - t * 0.31);
}
float sampleTile(float2 p, float tile) {
  p = clamp(p, float2(1), float2(span - 1));
  return atlas.eval(p + float2(tile * span, 0)).a;
}
half4 main(float2 p) {
  float f = field(p, time);
  float2 drift = float2(f, field(p.yx + 39, time * 0.83)) * movement * span;
  float breath = 1.0 + 0.018 * strength * sin(time * 0.71);
  float2 q = (p - span * 0.5) / (breath * (1.0 + radius * 0.12)) + span * 0.5 + drift;
  float narrow = sampleTile(q, 1);
  float middle = sampleTile(q, 2);
  float wide = sampleTile(q, 3);
  float blurMix = clamp((blur - 0.014) / 0.106, 0.0, 1.0);
  float spread = mix(narrow, middle, min(blurMix * 2.0, 1.0));
  spread = mix(spread, wide, max(blurMix * 2.0 - 1.0, 0.0));
  float flow = 0.72 + 0.28 * f;
  float fine = sampleTile(p, 0) * inner * (1.0 + reward * 0.3);
  float haze = sampleTile(q + drift, 4) * ambient;
  float ribbon = sampleTile(q + drift * 2.4, 1)
    * pow(0.5 + 0.5 * field(p * 1.8 + 17.0, time * 1.13), 3.0) * strength * strength;
  // Sparse drifting motes, seeded on a grid, visible only within the real geometry's field.
  float2 cell = floor((p + float2(time * 1.2, time * 2.1)) / 19.0);
  float seed = fract(sin(dot(cell, float2(127.1, 311.7))) * 43758.5453);
  float2 local = fract((p + float2(time * 1.2, time * 2.1)) / 19.0) - 0.5;
  float mote = (1.0 - smoothstep(0.015, 0.085, length(local)))
    * smoothstep(1.0 - particles, 1.0, seed) * (0.5 + 0.5 * sin(time * 0.9 + seed * 43.0));
  float a = fine + spread * outer * 8.0 * flow + haze * 6.0 + ribbon * 0.7 + mote * min(wide * 10.0, 0.45);
  float edge = min(min(p.x, p.y), min(span - p.x, span - p.y));
  a = min(a, 0.62) * smoothstep(0.0, span * 0.08, edge);
  float3 light = mix(tint, float3(1), min(0.48, fine * 1.8 + ribbon * 1.2));
  return half4(light * a, a);
}`;
