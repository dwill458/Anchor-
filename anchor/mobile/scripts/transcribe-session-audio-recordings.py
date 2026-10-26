"""Independent local transcript evidence from actual Android output captures."""
import argparse
import difflib
import json
from pathlib import Path
import re
import subprocess
import numpy as np
from faster_whisper import WhisperModel

parser = argparse.ArgumentParser()
parser.add_argument('matrix')
parser.add_argument('results')
parser.add_argument('--output', required=True)
parser.add_argument('--sources', required=True, nargs='+')
parser.add_argument('--comparison', help='For modular narration, transcribe each measured cue window independently.')
parser.add_argument('--rescore-existing', action='store_true')
args = parser.parse_args()
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)
matrix = json.loads(Path(args.matrix).read_text(encoding='utf-8'))['matrix']
comparisons = {item['id']: item for item in json.loads(Path(args.comparison).read_text(encoding='utf-8'))} if args.comparison else {}
references = {}
for folder in args.sources:
    for path in Path(folder).glob('*.json'):
        source = json.loads(path.read_text(encoding='utf-8'))
        references[source['file']] = ' '.join(segment['text'] for segment in source['segments'])
model = None
words = lambda text: re.findall(r'[a-z0-9]+', text.lower().replace('\u2019', '').replace("'", ''))

def score(expected, actual):
    reference_words, captured_words = words(expected), words(actual)
    matcher = difflib.SequenceMatcher(None, reference_words, captured_words, autojunk=False)
    matched = sum(block.size for block in matcher.get_matching_blocks())
    return {'referenceWords': len(reference_words), 'matchedWords': matched, 'referenceCoverage': matched / max(1, len(reference_words)),
            'normalizedTextMatches': ''.join(reference_words) == ''.join(captured_words),
            'differences': [{'operation': op, 'expected': reference_words[a:b], 'actual': captured_words[c:d]} for op, a, b, c, d in matcher.get_opcodes() if op != 'equal']}
for line in Path(args.results).read_text(encoding='utf-8').splitlines():
    result = json.loads(line)
    target = output / (result['id'] + '.json')
    if target.exists():
        if args.rescore_existing:
            existing = json.loads(target.read_text(encoding='utf-8'))
            existing.update(score(existing['expected'], existing['actual']))
            target.write_text(json.dumps(existing, indent=2), encoding='utf-8')
            print(json.dumps({'event': 'capture_rescored', 'id': result['id'], 'referenceCoverage': existing['referenceCoverage']}), flush=True)
        continue
    if not result['completed']:
        continue
    row = next(row for row in matrix if result['id'].startswith(row['id'] + '-'))
    if args.comparison and not row['ambientFile']:
        continue
    expected = ' '.join(phrase['text'] for phrase in row['phrases']) if row['mode'] == 'visualize' else ' '.join(references[cue['file']] for cue in row['cues'])
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-i', result['recording'], '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True)
    audio = np.frombuffer(raw.stdout, dtype='<f4').copy()
    peak = float(np.max(np.abs(audio)))
    if peak > 0:
        audio *= .85 / peak
    print(json.dumps({'event': 'transcribing_capture', 'id': result['id']}), flush=True)
    if model is None:
        model = WhisperModel('small.en', device='cpu', compute_type='int8', cpu_threads=4, num_workers=1)
    windows = [(0, len(audio) / 16000)]
    if args.comparison:
        windows = [(cue['recordedOffset'], cue['recordedOffset'] + cue['sourceSeconds']) for cue in comparisons[result['id']]['cues']]
    transcript = []
    for start, end in windows:
        clip = audio[round(start * 16000):round(end * 16000)].copy()
        clip_peak = float(np.max(np.abs(clip)))
        if clip_peak > 0:
            clip *= .85 / clip_peak
        segments, _ = model.transcribe(clip, language='en', beam_size=5, word_timestamps=True, vad_filter=False, condition_on_previous_text=False)
        transcript.extend([{'start': start + segment.start, 'end': start + segment.end, 'text': segment.text,
                            'words': [{'start': start + word.start, 'end': start + word.end, 'word': word.word} for word in segment.words or []]} for segment in segments])
    actual = ' '.join(segment['text'] for segment in transcript)
    evidence = {'id': result['id'], 'model': 'small.en', 'expected': expected, 'actual': actual, **score(expected, actual),
                'segments': transcript}
    target.write_text(json.dumps(evidence, indent=2), encoding='utf-8')
    print(json.dumps({'event': 'capture_transcribed', 'id': result['id'], 'referenceCoverage': evidence['referenceCoverage']}), flush=True)
