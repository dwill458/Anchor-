import type { ImageSourcePropType } from 'react-native';
import type { AnchorCategory } from '@/types';
import { VISION_EXAMPLE_IMAGES } from './visionExampleImages';

/** One example print: a picture, a one-line caption, and the moment Describe is prefilled with. */
export type VisionExample = { image: ImageSourcePropType; caption: string; moment: string };
type ExampleCopy = { caption: string; moment: string };

/**
 * Copy for all 33 examples (three per category), checked against the Vision vocabulary.
 * A copy row only reaches the screen when its picture exists in `VISION_EXAMPLE_IMAGES`,
 * so a missing file shrinks the fan instead of breaking the bundle.
 */
const EXAMPLE_COPY: Record<AnchorCategory, readonly [ExampleCopy, ExampleCopy, ExampleCopy]> = {
  health: [
    { caption: 'Morning run, before work', moment: "Early morning on the coast path, running before work. Mist on the water, legs feel light, and I'm not in a hurry to stop." },
    { caption: 'A kitchen full of real food', moment: 'Saturday morning in my kitchen, cutting vegetables for the week. Window open, water on the counter, my body feels clean and strong.' },
    { caption: 'Summit at sunrise', moment: 'Standing on the summit at sunrise after the climb. Clouds below me, breathing easy, proud of what my body can do now.' },
  ],
  abundance: [
    { caption: 'Mornings with nowhere to be', moment: 'Morning on the terrace of a house I own outright. Coffee, laptop closed, the sea below, nowhere I have to be.' },
    { caption: 'The keys are mine', moment: "Holding the keys to my own front door for the first time. Afternoon light in the hallway, and it's ours." },
    { caption: 'Dinner is on me', moment: "A long table outside at golden hour, everyone I love around it. I'm paying for dinner and I didn't check the price." },
  ],
  career: [
    { caption: 'My name on the door', moment: 'Walking into my own studio on a Monday. My name on the glass, the team already here, coffee in my hand.' },
    { caption: 'The room said yes', moment: "The end of the pitch. The room is quiet for a second, then they say yes, and I already know what we'll build." },
    { caption: "Work I'm proud of", moment: "Late afternoon at my desk, the last piece shipped. I lean back and look at the work and it's exactly what I meant." },
  ],
  relationships: [
    { caption: 'Sunday with my person', moment: 'A slow Sunday with the person I love. Two coffees, the paper, their feet on my lap, no plans.' },
    { caption: 'Friends who show up', moment: 'My kitchen full of friends on a Friday night, someone laughing too loud, music on, nobody wants to leave.' },
    { caption: 'Walking home together', moment: 'Walking home side by side after dinner, hands in each other\'s pockets, talking about nothing.' },
  ],
  creativity: [
    { caption: 'The finished piece', moment: "My finished canvas against the studio wall. Paint on my hands, music low, and I don't want to change a thing." },
    { caption: 'My book on the table', moment: 'My book, printed, sitting on the table at a small bookshop, and a stranger picking it up.' },
    { caption: 'The song is done', moment: 'Last take in the studio. Headphones off, the song finally sounds the way it did in my head.' },
  ],
  spirituality: [
    { caption: 'Quiet at first light', moment: "Sitting on the porch at first light before anyone's awake. Tea in my hands, my mind still, nothing to fix." },
    { caption: 'At home in myself', moment: "A walk in the forest after rain. I'm not thinking about anything, and that feels like home." },
    { caption: 'Grateful, out loud', moment: "Evening at the window with my journal open, writing down what I'm grateful for, and there's a lot." },
  ],
  family: [
    { caption: 'Everyone at my table', moment: 'Holiday dinner at my house, three generations at one table, kids under it, my mother laughing.' },
    { caption: 'Bedtime, unhurried', moment: 'Reading to my kid at bedtime with nowhere else I need to be. Small voice asking for one more page.' },
    { caption: 'The backyard we built', moment: 'Summer evening in our backyard, kids running through the sprinkler, me on the grass watching.' },
  ],
  learning: [
    { caption: 'Fluent, finally', moment: "Ordering dinner in a café abroad in their language, no app, and the waiter answers like I'm a local." },
    { caption: 'The certificate is real', moment: 'Holding my diploma on the steps after graduation, the hard years behind me, family waving from the lawn.' },
    { caption: 'I can build it now', moment: 'Late night at my desk, the thing I taught myself to build actually works, and I can explain every line.' },
  ],
  adventure: [
    { caption: 'One-way ticket', moment: 'Window seat on a one-way flight, the coastline below, the plan loose on purpose.' },
    { caption: 'Road with no rush', moment: 'Driving a coast road with the windows down, no itinerary, stopping wherever looks good.' },
    { caption: 'Camp above the clouds', moment: 'Tent pitched on a ridge, the stove going, watching the sun go down over mountains I hiked to.' },
  ],
  desire: [
    { caption: 'The thing I wanted', moment: 'The thing I wanted for years, finally in my hands. I keep looking at it and smiling.' },
    { caption: 'Saying yes to me', moment: 'Saying yes to the life I actually want, standing in the doorway of my new place with the light coming in.' },
    { caption: "It's here now", moment: "The day it became real. I'm standing in the moment I used to picture, and it feels better than I imagined." },
  ],
  custom: [
    { caption: "The day it's true", moment: "The day it's true. I'm standing inside the moment I used to picture, and it feels better than I imagined." },
    { caption: 'A morning like this', moment: 'A morning like this, every day. Light through the window, nothing pulling at me, ready for what\'s next.' },
    { caption: 'Proof it happened', moment: "The photo I'll take the day it happens, the one I'll look back at and say, there it is." },
  ],
};

/** Every example copy row, for tests that check wording and lengths without needing the pictures. */
export const VISION_EXAMPLE_COPY = EXAMPLE_COPY;

const SLOTS = [1, 2, 3] as const;

/**
 * Stand-in prints from the Vision photographs already in the app, chosen to match each caption.
 * A generated picture in VISION_EXAMPLE_IMAGES always wins over its stand-in.
 */
const STILL = {
  abundance: require('@/assets/vision/stand-ins/abundance.jpg'),
  desk: require('@/assets/vision/stand-ins/desk.jpg'),
  family: require('@/assets/vision/stand-ins/family.jpg'),
  home: require('@/assets/vision/stand-ins/home.jpg'),
  learning: require('@/assets/vision/stand-ins/learning.jpg'),
  movement: require('@/assets/vision/stand-ins/movement.jpg'),
  open: require('@/assets/vision/stand-ins/open.jpg'),
  sanctuary: require('@/assets/vision/stand-ins/sanctuary.jpg'),
  studio: require('@/assets/vision/stand-ins/studio.jpg'),
  threshold: require('@/assets/vision/stand-ins/threshold.jpg'),
  window: require('@/assets/vision/stand-ins/window.jpg'),
} as const;
type Still = keyof typeof STILL;
const STAND_INS: Record<AnchorCategory, readonly [Still, Still, Still]> = {
  health: ['movement', 'home', 'open'],
  abundance: ['desk', 'threshold', 'abundance'],
  career: ['threshold', 'window', 'desk'],
  relationships: ['home', 'family', 'open'],
  creativity: ['studio', 'learning', 'sanctuary'],
  spirituality: ['sanctuary', 'open', 'desk'],
  family: ['abundance', 'family', 'home'],
  learning: ['home', 'learning', 'desk'],
  adventure: ['window', 'open', 'threshold'],
  desire: ['window', 'threshold', 'open'],
  custom: ['window', 'family', 'home'],
};

function available(category: AnchorCategory): VisionExample[] {
  const images = VISION_EXAMPLE_IMAGES[category] ?? {};
  const standIns = STAND_INS[category] ?? STAND_INS.custom;
  return SLOTS.map((slot, index) => ({
    image: (images[slot] ?? STILL[standIns[index]]) as ImageSourcePropType,
    ...EXAMPLE_COPY[category][index],
  }));
}

/**
 * The examples shown for a category: its own pictures first, topped up to three from `custom`.
 * Returns 0 to 3 items and never includes a copy row whose picture is missing.
 */
export function visionExamplesFor(category: AnchorCategory): VisionExample[] {
  const own = available(category);
  if (own.length >= 3 || category === 'custom') return own;
  return [...own, ...available('custom')].slice(0, 3);
}

/** Character-level edit distance as a 0-100 percentage of the longer text; 0 means untouched. */
export function editDistancePct(from: string, to: string): number {
  const a = from.trim(), b = to.trim();
  if (a === b) return 0;
  if (!a.length || !b.length) return 100;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = row;
  }
  return Math.round((previous[b.length] / Math.max(a.length, b.length)) * 100);
}
