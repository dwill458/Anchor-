import type { AudioSource } from 'expo-audio';
import type { GuideId, GuidedTrackId } from '@/screens/v2/practice/visualize/guided/visualizeBeatMap';
import { remoteAudio } from '@/services/audio/remoteAudio';

// Static requires are intentional: Metro cannot resolve dynamically constructed asset paths.
const GUIDED_TRACKS: Readonly<Record<GuidedTrackId, Readonly<Record<GuideId, AudioSource>>>> = {
  glimpse: {
    dominic: require('../assets/sounds/visualize/guided/Anchor_Glimpse_Dominic_V3.mp3'),
    lina: require('../assets/sounds/visualize/guided/Anchor_Glimpse_Lina_V3.mp3'),
  },
  immerse: {
    dominic: require('../assets/sounds/visualize/guided/Anchor_Immerse_Dominic_3min_V3.mp3'),
    lina: require('../assets/sounds/visualize/guided/Anchor_Immerse_Lina_3min_V3.mp3'),
  },
  embody: {
    dominic: remoteAudio('embodyDominic'),
    lina: remoteAudio('embodyLina'),
  },
};

/** The finished mix (narration and music bed) for a track and guide. */
export function getGuidedTrackAsset(track: GuidedTrackId, guide: GuideId): AudioSource {
  return GUIDED_TRACKS[track][guide];
}
