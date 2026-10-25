"""Verify known narration against acoustic tokens rather than Whisper's silence-spanning word times.

Local QA only: torch/torchaudio 2.8 CPU, no mobile dependency.
Method: https://docs.pytorch.org/audio/2.8/tutorials/ctc_forced_alignment_api_tutorial.html
"""
import argparse
import json
from pathlib import Path
import re
import subprocess
import numpy as np
import torch
import torchaudio

parser = argparse.ArgumentParser()
parser.add_argument('matrix')
parser.add_argument('--output', required=True)
parser.add_argument('--filter', default='')
parser.add_argument('--model', choices=['base', 'large'], default='base')
args = parser.parse_args()
torch.set_num_threads(4)
bundle = torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H if args.model == 'base' else torchaudio.pipelines.WAV2VEC2_ASR_LARGE_LV60K_960H
model = bundle.get_model().eval()
labels = bundle.get_labels()
dictionary = {label: index for index, label in enumerate(labels)}
rows = [row for row in json.loads(Path(args.matrix).read_text(encoding='utf-8'))['matrix'] if row['mode'] == 'visualize' and args.filter in row['id']]
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)
for row in rows:
    target = output / (row['id'] + '.json')
    if target.exists():
        continue
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-i', row['cues'][0]['file'], '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True)
    audio = np.frombuffer(raw.stdout, dtype='<f4').copy()
    evidence = []
    groups = []
    for phrase in row['phrases']:
        if not groups or phrase['end'] - groups[-1][0]['start'] > 40:
            groups.append([])
        groups[-1].append(phrase)
    for group in groups:
        start = max(0, group[0]['start'] - 1)
        end = min(len(audio) / 16000, group[-1]['end'] + 1)
        waveform = torch.from_numpy(audio[round(start * 16000):round(end * 16000)]).unsqueeze(0)
        words = [re.sub('[^A-Z]', '', word.upper()) for phrase in group for word in phrase['text'].split()]
        tokens = [dictionary[char] for char in '|'.join(words)]
        with torch.inference_mode():
            emission, _ = model(waveform)
            path, scores = torchaudio.functional.forced_align(emission.log_softmax(-1), torch.tensor([tokens], dtype=torch.int32), blank=0)
        spans = torchaudio.functional.merge_tokens(path[0], scores[0].exp())
        ratio = waveform.size(1) / 16000 / emission.size(1)
        word_spans = []
        offset = 0
        for word in words:
            letters = spans[offset:offset + len(word)]
            word_spans.append({'word': word, 'start': round(start + letters[0].start * ratio, 3),
                               'end': round(start + letters[-1].end * ratio, 3),
                               'score': round(sum(span.score * (span.end - span.start) for span in letters) / sum(span.end - span.start for span in letters), 4)})
            offset += len(word) + 1
        word_offset = 0
        for phrase in group:
            count = len(phrase['text'].split())
            phrase_words = word_spans[word_offset:word_offset + count]
            word_offset += count
            item = {'id': phrase['id'], 'text': phrase['text'], 'chapter': phrase['chapter'], 'start': phrase_words[0]['start'], 'end': phrase_words[-1]['end'],
                    'previousStart': phrase['start'], 'previousEnd': phrase['end'], 'minimumWordScore': min(word['score'] for word in phrase_words), 'words': phrase_words}
            evidence.append(item)
            print(json.dumps({'case': row['id'], **{key: item[key] for key in ['id', 'start', 'end', 'previousStart', 'minimumWordScore']}}), flush=True)
    target.write_text(json.dumps({'id': row['id'], 'source': row['cues'][0]['file'], 'model': 'WAV2VEC2_ASR_' + args.model.upper(), 'phrases': evidence}, indent=2), encoding='utf-8')
