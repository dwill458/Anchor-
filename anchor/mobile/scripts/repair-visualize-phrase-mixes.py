"""Repair split narration using the original dry take and synchronized original music stem.

Writes review candidates only. It never replaces application assets.
"""
import argparse
import json
from pathlib import Path
import subprocess
import numpy as np
from scipy.signal import butter, correlate, sosfiltfilt

parser = argparse.ArgumentParser()
parser.add_argument('sources')
parser.add_argument('alignment')
parser.add_argument('raw_alignment')
parser.add_argument('--output', required=True)
args = parser.parse_args()
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)
rate = 44100

def decode(file):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(file), '-ar', str(rate), '-ac', '2', '-f', 'f32le', '-'], capture_output=True, check=True)
    return np.frombuffer(raw.stdout, dtype='<f4').reshape(-1, 2).copy()

bed = decode(Path(args.sources) / 'Embody_Underscore_10min.mp3')
evidence = []
for voice, ids in [('male', [47, 51]), ('female', [31, 47])]:
    case = f'audio-visualize-600-{voice}-ambient'
    current_map = json.loads((Path(args.alignment) / (case + '.json')).read_text(encoding='utf-8'))
    raw_map = json.loads((Path(args.raw_alignment) / (case + '.json')).read_text(encoding='utf-8'))
    current = decode(current_map['source'])
    raw = decode(raw_map['source'])
    quiet = slice(403 * rate, 408 * rate)
    music_gain = float(np.sum(bed[quiet] * current[quiet]) / np.sum(bed[quiet] ** 2))
    music_correlation = float(np.sum(bed[quiet] * current[quiet]) / np.sqrt(np.sum(bed[quiet] ** 2) * np.sum(current[quiet] ** 2)))
    if music_correlation < .999:
        raise ValueError('Music stem does not match this mix closely enough')
    isolated = current - music_gain * bed[:len(current)]
    # Infrasonic music and MP3 difference noise must not bias the narration fit.
    fit_filter = butter(4, 120, fs=rate, btype='highpass', output='sos')
    isolated_fit = sosfiltfilt(fit_filter, isolated.mean(axis=1))
    raw_fit = sosfiltfilt(fit_filter, raw.mean(axis=1))
    repaired = current.copy()
    edits = []
    for phrase_id in ids:
        phrase = next(item for item in current_map['phrases'] if item['id'] == phrase_id)
        original = next(item for item in raw_map['phrases'] if item['id'] == phrase_id)
        if phrase['text'] != original['text']:
            raise ValueError('Narration mismatch')
        source_at = original['words'][1]['start'] + .04
        length = min(2, original['end'] - source_at)
        template = raw_fit[round(source_at * rate):round((source_at + length) * rate)]
        search_at = phrase['words'][1]['start'] - .2
        pool = isolated_fit[round(search_at * rate):round((search_at + length + .4) * rate)]
        offset = int(np.argmax(correlate(pool, template, mode='valid', method='fft')))
        actual = pool[offset:offset + len(template)]
        voice_gain = float(np.dot(template, actual) / np.dot(template, template))
        voice_correlation = float(np.dot(template, actual) / np.sqrt(np.dot(template, template) * np.dot(actual, actual)))
        if voice_correlation < .99:
            raise ValueError(f'Original take does not match phrase {phrase_id}: {voice_correlation}')
        lag = search_at + offset / rate - source_at
        lo, hi = round((phrase['start'] - .2) * rate), round((phrase['end'] + .4) * rate)
        blend = np.ones((hi - lo, 1), dtype=np.float32)
        fade = round(.04 * rate)
        ramp = (.5 - .5 * np.cos(np.linspace(0, np.pi, fade))).astype(np.float32)
        blend[:fade, 0], blend[-fade:, 0] = ramp, ramp[::-1]
        repaired[lo:hi] = repaired[lo:hi] * (1 - blend) + music_gain * bed[lo:hi] * blend
        clip_start, clip_end = original['start'] - .08, original['end'] + .15
        clip = raw[round(clip_start * rate):round(clip_end * rate)].copy()
        clip_fade = round(.03 * rate)
        clip_ramp = (.5 - .5 * np.cos(np.linspace(0, np.pi, clip_fade))).astype(np.float32)
        clip[:clip_fade] *= clip_ramp[:, None]
        clip[-clip_fade:] *= clip_ramp[::-1, None]
        target = round((clip_start + lag) * rate)
        repaired[target:target + len(clip)] += voice_gain * clip
        edits.append({'phraseId': phrase_id, 'text': phrase['text'], 'oldStart': phrase['start'], 'newStart': original['start'] + lag,
                      'newEnd': original['end'] + lag, 'voiceCorrelation': voice_correlation, 'voiceGain': voice_gain, 'sourceOffset': lag,
                      'replacedWindow': [lo / rate, hi / rate], 'rawWindow': [clip_start, clip_end]})
    # Keep headroom at least as conservative as the original master, before MP3 encoding.
    peak = float(np.max(np.abs(repaired)))
    gain = min(1, .90 / peak)
    repaired *= gain
    path = output / Path(current_map['source']).name
    subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(rate), '-ac', '2', '-i', '-',
                    '-c:a', 'libmp3lame', '-b:a', '192k', str(path)], input=repaired.astype('<f4').tobytes(), check=True)
    item = {'id': case, 'source': current_map['source'], 'candidate': str(path), 'musicGain': music_gain,
            'musicCorrelation': music_correlation, 'headroomGain': gain, 'edits': edits}
    evidence.append(item)
    print(json.dumps(item), flush=True)
    (output / 'repair-evidence.json').write_text(json.dumps(evidence, indent=2), encoding='utf-8')
