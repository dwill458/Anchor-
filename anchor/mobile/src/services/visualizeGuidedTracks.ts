import type { AudioSource } from 'expo-audio';
import type { GuideId, GuidedTrackId } from '@/screens/v2/practice/visualize/guided/visualizeBeatMap';

// Static requires are intentional: Metro cannot resolve dynamically constructed asset paths.
const GUIDED_TRACKS: Readonly<Record<GuidedTrackId, Readonly<Record<GuideId, AudioSource>>>> = {
  glimpse: {
    dominic: require('../assets/sounds/visualize/guided/glimpse_dominic.mp3'),
    lina: require('../assets/sounds/visualize/guided/glimpse_lina.mp3'),
  },
  immerse: {
    dominic: require('../assets/sounds/visualize/guided/immerse_dominic.mp3'),
    lina: require('../assets/sounds/visualize/guided/immerse_lina.mp3'),
  },
  embody: {
    dominic: require('../assets/sounds/visualize/guided/embody_dominic.mp3'),
    lina: require('../assets/sounds/visualize/guided/embody_lina.mp3'),
  },
};

/** The finished mix (narration and music bed) for a track and guide. */
export function getGuidedTrackAsset(track: GuidedTrackId, guide: GuideId): AudioSource {
  return GUIDED_TRACKS[track][guide];
}
