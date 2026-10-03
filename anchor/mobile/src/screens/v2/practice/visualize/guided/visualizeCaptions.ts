/**
 * The beat maps carry the narration as lowercase-less, punctuation-less text ("Dont", "youre").
 * Captions must read as written language, so every distinct narrated phrase has an explicit
 * display form here. An unknown phrase falls back to restoring apostrophes and a closing mark,
 * and a phrase that cannot be made clean is better dropped than shown broken (see `captionFor`).
 */
const DISPLAY: Readonly<Record<string, string>> = {
  'Look at your vision': 'Look at your vision.',
  'Dont just see the picture step into it': 'Don’t just see the picture. Step into it.',
  'Look through your own eyes youre here': 'Look through your own eyes. You’re here.',
  'Notice where you are': 'Notice where you are.',
  'Whats happening around you': 'What’s happening around you?',
  'Notice what youre doing': 'Notice what you’re doing.',
  'The way youre moving': 'The way you’re moving.',
  'The way youre carrying yourself': 'The way you’re carrying yourself.',
  'For a moment let this feel normal': 'For a moment, let this feel normal.',
  'Not something youre waiting for': 'Not something you’re waiting for.',
  'Not something youre chasing': 'Not something you’re chasing.',
  'This is simply your life': 'This is simply your life.',
  'Notice the feeling that comes with that': 'Notice the feeling that comes with that.',
  'Hold it': 'Hold it.',
  'Now let the details fall away': 'Now let the details fall away.',
  'Keep only the feeling': 'Keep only the feeling.',
  'And let your anchor come into focus': 'And let your Anchor come into focus.',
  'Dont analyze it just look': 'Don’t analyze it. Just look.',
  'Carry the direction': 'Carry the direction.',
  'Release the picture': 'Release the picture.',
  'And move': 'And move.',
  'Settle into a comfortable position': 'Settle into a comfortable position.',
  'Take a slow breath in and let it go': 'Take a slow breath in, and let it go.',
  'Let your shoulders drop': 'Let your shoulders drop.',
  'Relax your jaw': 'Relax your jaw.',
  'And allow everything outside this moment to become a little quieter': 'And allow everything outside this moment to become a little quieter.',
  'Now bring your vision to mind': 'Now bring your Vision to mind.',
  'Dont look at it like a picture step into it': 'Don’t look at it like a picture. Step into it.',
  'Take a look around': 'Take a look around.',
  'Where are you': 'Where are you?',
  'Notice the light the space around you the details': 'Notice the light, the space around you, the details.',
  'What can you hear': 'What can you hear?',
  'Notice the temperature against your skin the feeling of the space around you': 'Notice the temperature against your skin, the feeling of the space around you.',
  'Now notice what youre doing': 'Now notice what you’re doing.',
  'How are you moving': 'How are you moving?',
  'How are you carrying yourself': 'How are you carrying yourself?',
  'Notice the people around you or the quiet if youre alone': 'Notice the people around you, or the quiet if you’re alone.',
  'Let this moment become real': 'Let this moment become real.',
  'Not something youre hoping for something youre experiencing': 'Not something you’re hoping for. Something you’re experiencing.',
  'And notice how natural it feels': 'And notice how natural it feels.',
  'This isnt extraordinary anymore': 'This isn’t extraordinary anymore.',
  'Its familiar': 'It’s familiar.',
  'Now notice who you are in this life': 'Now notice who you are in this life.',
  'The way you think the way you move the choices you make': 'The way you think, the way you move, the choices you make.',
  'Notice what feels different about you': 'Notice what feels different about you.',
  'Not excitement something quieter': 'Not excitement. Something quieter.',
  'Certainty': 'Certainty.',
  'Let yourself feel that now': 'Let yourself feel that now.',
  'Choose one detail from this vision something small something real': 'Choose one detail from this Vision. Something small, something real.',
  'Hold it clearly': 'Hold it clearly.',
  'Now let the details begin to fall away': 'Now let the details begin to fall away.',
  'The place': 'The place.',
  'The sounds': 'The sounds.',
  'The images': 'The images.',
  'And as everything else becomes quiet let your anchor come into focus': 'And as everything else becomes quiet, let your Anchor come into focus.',
  'Let this image carry what you just experienced': 'Let this image carry what you just experienced.',
  'Take one slow breath in and let it go': 'Take one slow breath in, and let it go.',
  'Settle into a position that feels comfortable': 'Settle into a position that feels comfortable.',
  'For the next few minutes there is nowhere else you need to be': 'For the next few minutes, there is nowhere else you need to be.',
  'Nothing you need to solve nothing you need to figure out': 'Nothing you need to solve. Nothing you need to figure out.',
  'Again slowly breathe in and as you breathe out let your shoulders drop': 'Again, slowly breathe in. And as you breathe out, let your shoulders drop.',
  'Unclench your jaw relax the muscles around your eyes let your hands rest': 'Unclench your jaw. Relax the muscles around your eyes. Let your hands rest.',
  'You dont need to force yourself to relax just allow yourself to become still': 'You don’t need to force yourself to relax. Just allow yourself to become still.',
  'Notice your breathing becoming slower': 'Notice your breathing becoming slower.',
  'And for now just be here': 'And for now, just be here.',
  'Notice the space around you the light the colors the details you normally wouldnt think about': 'Notice the space around you, the light, the colors, the details you normally wouldn’t think about.',
  'Now listen what can you hear': 'Now listen. What can you hear?',
  'Maybe voices movement nature a room around you or maybe its completely quiet': 'Maybe voices, movement, nature, a room around you. Or maybe it’s completely quiet.',
  'Notice the temperature against your skin': 'Notice the temperature against your skin.',
  'Notice what youre wearing': 'Notice what you’re wearing.',
  'Dont describe the scene experience it': 'Don’t describe the scene. Experience it.',
  'The way you move the way you speak the decisions you make without overthinking them': 'The way you move, the way you speak, the decisions you make without overthinking them.',
  'Notice the people around you': 'Notice the people around you.',
  'How do they respond to you': 'How do they respond to you?',
  'How do you respond to them': 'How do you respond to them?',
  'And notice something important this doesnt feel extraordinary anymore it feels familiar': 'And notice something important. This doesn’t feel extraordinary anymore. It feels familiar.',
  'Now stop looking at what you have and notice who you are': 'Now stop looking at what you have, and notice who you are.',
  'Who did you have to become to arrive here': 'Who did you have to become to arrive here?',
  'What no longer gets to decide your direction': 'What no longer gets to decide your direction?',
  'What do you do consistently now that once required effort': 'What do you do consistently now that once required effort?',
  'Feel the difference in the way you carry yourself': 'Feel the difference in the way you carry yourself.',
  'The feeling of knowing who you are and moving accordingly': 'The feeling of knowing who you are, and moving accordingly.',
  'Look around one more time': 'Look around one more time.',
  'Choose one detail from this life something small something real hold it clearly': 'Choose one detail from this life. Something small, something real. Hold it clearly.',
  'Now notice the feeling underneath it': 'Now notice the feeling underneath it.',
  'Not the object not the achievement not the image the feeling': 'Not the object, not the achievement, not the image. The feeling.',
  'Where do you feel it in your body': 'Where do you feel it in your body?',
  'Let it become stronger': 'Let it become stronger.',
  'You dont need to chase this moment you need to recognize it': 'You don’t need to chase this moment. You need to recognize it.',
  'Remember what it feels like to move as this version of yourself': 'Remember what it feels like to move as this version of yourself.',
  'The people': 'The people.',
  'You dont need to hold on to them': 'You don’t need to hold on to them.',
  'Dont analyze it': 'Don’t analyze it.',
  'Dont try to explain it': 'Don’t try to explain it.',
  'Just look': 'Just look.',
  'You dont need to hold on to the vision youve already experienced it': 'You don’t need to hold on to the Vision. You’ve already experienced it.',
  'Notice your body again the surface beneath you the space around you': 'Notice your body again. The surface beneath you, the space around you.',
  'When youre ready open your eyes': 'When you’re ready, open your eyes.',
};

const CONTRACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(D|d)ont\b/g, '$1on’t'], [/\b(Y|y)oure\b/g, '$1ou’re'], [/\b(Y|y)ouve\b/g, '$1ou’ve'],
  [/\b(I|i)snt\b/g, '$1sn’t'], [/\b(D|d)oesnt\b/g, '$1oesn’t'], [/\b(W|w)ouldnt\b/g, '$1ouldn’t'],
  [/\b(W|w)hats\b/g, '$1hat’s'], [/\b(I|i)ts\b/g, '$1t’s'],
];

/**
 * A caption that reads as written language, or null when the phrase is unknown and cannot be
 * restored with confidence. Callers show nothing for null rather than risk broken text.
 */
export function captionFor(rawText: string): string | null {
  const known = DISPLAY[rawText];
  if (known) return known;
  const trimmed = rawText.trim();
  if (!trimmed || trimmed.length > 120) return null;
  let text = trimmed;
  for (const [pattern, replacement] of CONTRACTIONS) text = text.replace(pattern, replacement);
  text = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?]$/.test(text) ? text : `${text}${/^(what|where|how|who)\b/i.test(text) ? '?' : '.'}`;
}
