import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { runOnJS, useFrameCallback } from 'react-native-reanimated';

import { creationTraceEnabled, trace } from '@/utils/dev/creationTrace';

interface Stats {
  frames: number;
  totalMs: number;
  maxMs: number;
  slow: number;
}
const fresh = (): Stats => ({ frames: 0, totalMs: 0, maxMs: 0, slow: 0 });
const SLOW_FRAME_MS = 20;

function summarize(s: Stats) {
  const avgMs = s.frames ? s.totalMs / s.frames : 0;
  return {
    frames: s.frames,
    avgFps: avgMs ? Math.round(1000 / avgMs) : 0,
    minFps: s.maxMs ? Math.round(1000 / s.maxMs) : 0,
    over20ms: s.slow,
  };
}

/**
 * Dev-only frame probe: UI-thread frames (Reanimated `useFrameCallback`) and JS-thread frames
 * (rAF) are counted separately across the whole creation run. Shows a tiny readout and logs
 * `[creation-trace] fps …` on unmount, so Style → Choose → Seal → Home can be read in one line.
 * Renders nothing outside `__DEV__`.
 */
export function FpsProbe() {
  if (!creationTraceEnabled) return null;
  return <FpsProbeInner />;
}

function FpsProbeInner() {
  const ui = useRef<Stats>(fresh());
  const js = useRef<Stats>(fresh());
  const [readout, setReadout] = useState('');

  const onUiFrame = (dt: number) => {
    const s = ui.current;
    s.frames += 1;
    s.totalMs += dt;
    if (dt > s.maxMs) s.maxMs = dt;
    if (dt > SLOW_FRAME_MS) s.slow += 1;
  };
  useFrameCallback((info) => {
    'worklet';
    if (info.timeSincePreviousFrame !== null) runOnJS(onUiFrame)(info.timeSincePreviousFrame);
  });

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      if (last) {
        const dt = t - last;
        const s = js.current;
        s.frames += 1;
        s.totalMs += dt;
        if (dt > s.maxMs) s.maxMs = dt;
        if (dt > SLOW_FRAME_MS) s.slow += 1;
      }
      last = t;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const timer = setInterval(() => {
      const u = summarize(ui.current);
      const j = summarize(js.current);
      setReadout(`UI ${u.avgFps}/${u.minFps} >20:${u.over20ms}  JS ${j.avgFps}/${j.minFps} >20:${j.over20ms}`);
    }, 500);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
      trace('fps', { ui: summarize(ui.current), js: summarize(js.current) });
    };
  }, []);

  return (
    <View style={styles.root} pointerEvents="none">
      <Text style={styles.text}>{readout}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 8, bottom: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, borderRadius: 4 },
  text: { color: '#fff', fontSize: 10, fontVariant: ['tabular-nums'] },
});
