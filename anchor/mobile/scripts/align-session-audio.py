"""Compare locally transcribed word times against the production Visualize beat maps."""
import argparse
import difflib
import json
from pathlib import Path
import re

parser = argparse.ArgumentParser()
parser.add_argument('matrix')
parser.add_argument('transcripts')
parser.add_argument('--output', required=True)
args = parser.parse_args()
matrix = json.loads(Path(args.matrix).read_text(encoding='utf-8'))['matrix']
transcripts = {item['file']: item for file in Path(args.transcripts).glob('*.json') for item in [json.loads(file.read_text(encoding='utf-8'))]}
normalize = lambda text: re.sub(r'[^a-z0-9]', '', text.lower())
results = []
for row in matrix:
    if row['mode'] != 'visualize' or row['cues'][0]['file'] not in transcripts:
        continue
    transcript = transcripts[row['cues'][0]['file']]
    expected = [(normalize(word), phrase['id']) for phrase in row['phrases'] for word in phrase['text'].split()]
    observed = [(normalize(word['word']), word) for segment in transcript['segments'] for word in segment['words'] if normalize(word['word'])]
    matcher = difflib.SequenceMatcher(None, [word[0] for word in expected], [word[0] for word in observed], autojunk=False)
    matches = {block.a + offset: block.b + offset for block in matcher.get_matching_blocks() for offset in range(block.size)}
    phrases = []
    for phrase in row['phrases']:
        indexes = [index for index, word in enumerate(expected) if word[1] == phrase['id']]
        heard = [observed[matches[index]][1] for index in indexes if index in matches]
        actual_start = heard[0]['start'] if heard else None
        actual_end = heard[-1]['end'] if heard else None
        phrases.append({'id': phrase['id'], 'text': phrase['text'], 'expectedStart': phrase['start'], 'expectedEnd': phrase['end'],
                        'observedStart': actual_start, 'observedEnd': actual_end, 'wordCoverage': len(heard) / len(indexes),
                        'startError': round(actual_start - phrase['start'], 3) if heard else None,
                        'endError': round(actual_end - phrase['end'], 3) if heard else None})
    result = {'id': row['id'], 'matchedWordRatio': len(matches) / len(expected), 'expectedWords': len(expected), 'observedWords': len(observed), 'phrases': phrases}
    results.append(result)
    bad = [phrase for phrase in phrases if phrase['wordCoverage'] < .8 or abs(phrase['startError'] or 0) > 1 or abs(phrase['endError'] or 0) > 1]
    print(json.dumps({'id': row['id'], 'matchedWordRatio': result['matchedWordRatio'], 'flaggedPhrases': bad}, ensure_ascii=False))
Path(args.output).write_text(json.dumps(results, indent=2), encoding='utf-8')
