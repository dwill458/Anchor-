"""Local QA transcription. Requires faster-whisper; no audio is uploaded."""
import argparse
import hashlib
import json
from pathlib import Path
from faster_whisper import WhisperModel

parser = argparse.ArgumentParser()
parser.add_argument('matrix')
parser.add_argument('--output', required=True)
parser.add_argument('--model', default='base.en')
parser.add_argument('--filter', default='')
parser.add_argument('--no-vad', action='store_true')
args = parser.parse_args()
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)
matrix = json.loads(Path(args.matrix).read_text(encoding='utf-8'))['matrix']
files = list(dict.fromkeys(cue['file'] for row in sorted(matrix, key=lambda row: row['mode'] != 'visualize') for cue in row['cues']))
files = [filename for filename in files if args.filter in filename]
model = WhisperModel(args.model, device='cpu', compute_type='int8', cpu_threads=4, num_workers=1)
for index, filename in enumerate(files):
    source = Path(filename)
    key = hashlib.sha256(str(source).encode()).hexdigest()[:10] + '-' + source.stem
    target = output / (key + '.json')
    if target.exists():
        continue
    print(json.dumps({'event': 'transcribing', 'index': index + 1, 'total': len(files), 'file': filename}), flush=True)
    segments, info = model.transcribe(filename, beam_size=5, word_timestamps=True, language='en', vad_filter=not args.no_vad,
                                     condition_on_previous_text=False,
                                     vad_parameters={'min_silence_duration_ms': 1000})
    rows = [{'start': item.start, 'end': item.end, 'text': item.text,
             'words': [{'start': word.start, 'end': word.end, 'word': word.word, 'probability': word.probability} for word in (item.words or [])]}
            for item in segments]
    target.write_text(json.dumps({'file': filename, 'model': args.model, 'duration': info.duration, 'segments': rows}, indent=2), encoding='utf-8')
    print(json.dumps({'event': 'transcribed', 'index': index + 1, 'file': filename, 'words': sum(len(row['words']) for row in rows)}), flush=True)
