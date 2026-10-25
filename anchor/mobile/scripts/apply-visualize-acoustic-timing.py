"""Apply reviewed CTC boundaries while preserving narration, phrase IDs, and chapter contracts."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('matrix')
parser.add_argument('alignment')
parser.add_argument('--output', required=True)
parser.add_argument('--apply', action='store_true')
parser.add_argument('--speech-activity', required=True)
args = parser.parse_args()
inventory = json.loads(Path(args.matrix).read_text(encoding='utf-8'))
assets = {asset['file']: asset for asset in inventory['assets']}
activity = {item['id']: item for item in json.loads(Path(args.speech_activity).read_text(encoding='utf-8'))}
root = Path(__file__).resolve().parents[1]
updates = {}
evidence = []
for row in inventory['matrix']:
    if row['mode'] != 'visualize':
        continue
    aligned = json.loads((Path(args.alignment) / (row['id'] + '.json')).read_text(encoding='utf-8'))
    if [(phrase['id'], phrase['text']) for phrase in aligned['phrases']] != [(phrase['id'], phrase['text']) for phrase in row['phrases']]:
        raise ValueError('Narration mismatch: ' + row['id'])
    phrases = []
    refinements = []
    for phrase in aligned['phrases']:
        if min(phrase['words'][0]['score'], phrase['words'][-1]['score']) < .3:
            raise ValueError('Boundary needs manual review: ' + row['id'] + ':' + str(phrase['id']))
        acoustic_start = phrase['start']
        first_word = phrase['words'][0]
        if first_word['end'] - first_word['start'] > .8:
            spans = [span for span in activity[row['id']]['speechActivity'] if first_word['start'] <= span[0] <= first_word['end'] + .2 and span[1] >= first_word['end'] - .2]
            if not spans:
                raise ValueError('Stretched boundary needs manual review: ' + row['id'] + ':' + str(phrase['id']))
            acoustic_start = max(acoustic_start, spans[-1][0] - .05)
            refinements.append({'id': phrase['id'], 'ctcStart': phrase['start'], 'speechStart': acoustic_start})
        # A short readability lead gives the 260ms caption fade time to begin with speech.
        updated = {key: phrase[key] for key in ['id', 'text', 'chapter']} | {'start': round(max(0, acoustic_start - .12), 3), 'end': round(phrase['end'] + .1, 3)}
        # A line must not reveal the rest of a sentence seconds before it is spoken.
        groups = [[]]
        for word in phrase['words']:
            if groups[-1] and word['start'] - groups[-1][-1]['end'] > 1.2:
                groups.append([])
            groups[-1].append(word)
        if len(groups) > 1:
            original_words = phrase['text'].split()
            word_offset = 0
            spans = []
            for index, group in enumerate(groups):
                text = ' '.join(original_words[word_offset:word_offset + len(group)])
                word_offset += len(group)
                if index < len(groups) - 1:
                    text += '...'
                spans.append({'text': text, 'start': round(max(0, group[0]['start'] - .12), 3), 'end': round(group[-1]['end'] + .1, 3)})
            updated['caption_spans'] = spans
        phrases.append(updated)
    duration = round(assets[row['cues'][0]['file']]['duration'], 3)
    for index, phrase in enumerate(phrases):
        following = phrases[index + 1]['start'] if index + 1 < len(phrases) else duration
        if phrase['end'] > following:
            if phrase['end'] - following > .25:
                raise ValueError('Overlapping acoustic phrases: ' + row['id'] + ':' + str(phrase['id']))
            phrase['end'] = round(following - .02, 3)
        phrase['silence_after'] = round(following - phrase['end'], 3)
        if not 0 <= phrase['start'] < phrase['end'] <= duration:
            raise ValueError('Invalid phrase bounds')
    path = root / f'src/screens/v2/practice/visualize/beatmaps/beatmap_{row["track"]}.json'
    if path not in updates:
        updates[path] = json.loads(path.read_text(encoding='utf-8'))
    voice = updates[path]['voices']['dominic' if row['voice'] == 'male' else 'lina']
    voice.update(phrases=phrases, audio_duration=duration, last_phrase_end=phrases[-1]['end'])
    evidence.append({'id': row['id'], 'sourceSha256': assets[row['cues'][0]['file']]['sha256'], 'model': aligned['model'],
                     'phraseCount': len(phrases), 'duration': duration, 'captionLeadSeconds': .12, 'activityRefinements': refinements, 'phrases': phrases})
for path, content in updates.items():
    content['audio_duration'] = max(voice['audio_duration'] for voice in content['voices'].values())
    if args.apply:
        path.write_text(json.dumps(content, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
Path(args.output).write_text(json.dumps(evidence, indent=2), encoding='utf-8')
print(json.dumps({'tracks': len(evidence), 'phrases': sum(item['phraseCount'] for item in evidence), 'applied': args.apply}))
