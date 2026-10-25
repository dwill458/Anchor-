"""Retiming from a complete local transcript, with speech-activity checks on stretched word timestamps."""
import argparse
import difflib
import json
from pathlib import Path
import re
from faster_whisper.audio import decode_audio
from faster_whisper.vad import VadOptions, get_speech_timestamps

parser = argparse.ArgumentParser()
parser.add_argument('matrix')
parser.add_argument('transcripts')
parser.add_argument('--output', required=True)
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
inventory = json.loads(Path(args.matrix).read_text(encoding='utf-8'))
transcripts = {item['file']: item for file in Path(args.transcripts).glob('*.json') for item in [json.loads(file.read_text(encoding='utf-8'))]}
assets = {item['file']: item for item in inventory['assets']}
normalize = lambda text: re.sub(r'[^a-z0-9]', '', text.lower())
root = Path(__file__).resolve().parents[1]
updates = {}
evidence = []
for row in inventory['matrix']:
    if row['mode'] != 'visualize':
        continue
    filename = row['cues'][0]['file']
    transcript = transcripts[filename]
    expected = [(normalize(word), phrase['id']) for phrase in row['phrases'] for word in phrase['text'].split()]
    observed = [(normalize(word['word']), word) for segment in transcript['segments'] for word in segment['words'] if normalize(word['word'])]
    matcher = difflib.SequenceMatcher(None, [word[0] for word in expected], [word[0] for word in observed], autojunk=False)
    matches = {block.a + offset: block.b + offset for block in matcher.get_matching_blocks() for offset in range(block.size)}
    if len(matches) != len(expected):
        raise ValueError(f'Incomplete transcript for {row["id"]}: {len(matches)}/{len(expected)} words')
    audio = decode_audio(filename, sampling_rate=16000)
    activity = get_speech_timestamps(audio, VadOptions(threshold=.15, min_speech_duration_ms=100, min_silence_duration_ms=100, speech_pad_ms=0))
    spans = [(item['start'] / 16000, item['end'] / 16000) for item in activity]
    new_phrases = []
    refinements = []
    for phrase in row['phrases']:
        heard = [observed[matches[index]][1] for index, word in enumerate(expected) if word[1] == phrase['id']]
        first, last = heard[0], heard[-1]
        start, end = first['start'], last['end']
        # Whisper can assign a long leading silence to the first word of a new phrase.
        # Restrict a correction to speech intersecting that word; never move a phrase to another utterance.
        if first['end'] - first['start'] > .8:
            candidates = [span for span in spans if span[0] >= first['start'] - .05 and span[0] < first['end'] and span[1] >= first['end'] - .15]
            if candidates:
                start = max(start, candidates[-1][0] - .05)
        if last['end'] - last['start'] > .8:
            candidates = [span for span in spans if span[0] <= last['start'] + .15 and span[1] > last['start'] and span[1] <= last['end'] + .05]
            if candidates:
                end = min(end, candidates[0][1] + .1)
        if start >= end:
            raise ValueError(f'Invalid alignment in {row["id"]}, phrase {phrase["id"]}')
        if abs(start - first['start']) > .1 or abs(end - last['end']) > .1:
            refinements.append({'id': phrase['id'], 'firstWord': first, 'lastWord': last, 'start': start, 'end': end})
        new_phrases.append({**phrase, 'start': round(start, 3), 'end': round(end, 3)})
    for index, phrase in enumerate(new_phrases):
        following = new_phrases[index + 1]['start'] if index + 1 < len(new_phrases) else assets[filename]['duration']
        if phrase['end'] > following:
            if phrase['end'] - following > .25:
                raise ValueError(f'Overlapping spoken phrases in {row["id"]}, phrase {phrase["id"]}')
            phrase['end'] = round(following - .02, 3)
        phrase['silence_after'] = round(following - phrase['end'], 3)
    map_path = root / f'src/screens/v2/practice/visualize/beatmaps/beatmap_{row["track"]}.json'
    if map_path not in updates:
        updates[map_path] = json.loads(map_path.read_text(encoding='utf-8'))
    guide = 'dominic' if row['voice'] == 'male' else 'lina'
    target = updates[map_path]['voices'][guide]
    target['phrases'] = new_phrases
    target['last_phrase_end'] = new_phrases[-1]['end']
    target['audio_duration'] = round(assets[filename]['duration'], 3)
    evidence.append({'id': row['id'], 'sourceSha256': assets[filename]['sha256'], 'model': transcript['model'], 'matchedWords': len(matches),
                     'expectedWords': len(expected), 'duration': target['audio_duration'], 'phrases': new_phrases, 'activityRefinements': refinements,
                     'speechActivity': spans})
    print(json.dumps({'id': row['id'], 'matchedWords': len(matches), 'duration': target['audio_duration'], 'refinements': len(refinements)}), flush=True)
for map_path, content in updates.items():
    content['audio_duration'] = max(voice['audio_duration'] for voice in content['voices'].values())
    if args.apply:
        map_path.write_text(json.dumps(content, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
Path(args.output).write_text(json.dumps(evidence, indent=2), encoding='utf-8')
