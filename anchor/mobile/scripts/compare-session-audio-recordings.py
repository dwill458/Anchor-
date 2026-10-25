"""Compare lossless Android output captures with the exact source waveforms."""
import argparse
import json
from pathlib import Path
import subprocess
import numpy as np
from scipy.signal import correlate

parser = argparse.ArgumentParser()
parser.add_argument('matrix')
parser.add_argument('results')
parser.add_argument('--output', required=True)
args = parser.parse_args()
inventory = json.loads(Path(args.matrix).read_text(encoding='utf-8'))
matrix = {row['id']: row for row in inventory['matrix']}
results = [json.loads(line) for line in Path(args.results).read_text(encoding='utf-8').splitlines() if line.strip()]
rate = 16000
cache = {}
def decode(filename):
    if filename not in cache:
        result = subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-i', filename, '-f', 'f32le', '-ac', '1', '-ar', str(rate), '-'], capture_output=True, check=True)
        cache[filename] = np.frombuffer(result.stdout, dtype='<f4').copy()
    return cache[filename]
evidence = []
for result in results:
    candidates = [row for key, row in matrix.items() if result['id'].startswith(key + '-')]
    if not candidates:
        continue
    row = candidates[0]
    recorded = decode(result['recording'])
    original_recording = recorded.copy()
    ambient_source = None
    ambient_lag = None
    ambient_evidence = None
    if row.get('ambientFile'):
        first_source = decode(row['cues'][0]['file'])
        first_offset = int(np.argmax(correlate(recorded, first_source, mode='valid', method='fft'))) / rate
        quiet = []
        for index, cue in enumerate(row['cues']):
            start = cue['start'] + cue['duration'] + .7
            end = (row['cues'][index + 1]['start'] if index + 1 < len(row['cues']) else row['duration']) - .7
            if end - start > 1:
                quiet.append((start, end))
        if quiet:
            start, end = max(quiet, key=lambda span: span[1] - span[0])
            length = min(2, end - start)
            source_at = (start + end - length) / 2
            actual_at = first_offset + source_at
            actual_quiet = recorded[round(actual_at * rate):round((actual_at + length) * rate)]
            ambient = decode(row['ambientFile'])
            search_at = max(0, round((source_at - 1) * rate))
            pool = ambient[search_at:round((source_at + length + 1) * rate)]
            offset = int(np.argmax(correlate(pool, actual_quiet, mode='valid', method='fft')))
            reference = pool[offset:offset + len(actual_quiet)]
            coefficient = float(np.dot(reference, actual_quiet) / np.sqrt(max(1e-20, float(np.dot(reference, reference)) * float(np.dot(actual_quiet, actual_quiet)))))
            gain = float(np.dot(reference, actual_quiet) / max(1e-20, float(np.dot(reference, reference))))
            lag = round(actual_at * rate) - search_at - offset
            ambient_evidence = {'correlation': coefficient, 'gain': gain, 'lagSeconds': lag / rate, 'subtracted': coefficient > .9}
            if coefficient > .9:
                ambient_source, ambient_lag = ambient, lag
                indexes = np.arange(len(recorded)) - lag
                active = indexes >= 0
                recorded = recorded.copy()
                recorded[active] -= gain * ambient[indexes[active] % len(ambient)]
    comparisons = []
    for cue in row['cues']:
        source = decode(cue['file'])
        if len(recorded) < len(source):
            comparisons.append({'phase': cue['phase'], 'error': 'recording_shorter_than_source'})
            continue
        similarity = correlate(recorded, source, mode='valid', method='fft')
        offset = int(np.argmax(similarity))
        actual = recorded[offset:offset + len(source)]
        energy = float(np.dot(source, source))
        coefficient = float(np.dot(source, actual) / np.sqrt(max(1e-20, energy * float(np.dot(actual, actual)))))
        gain = float(np.dot(source, actual) / max(1e-20, energy))
        windows = []
        adjusted_windows = []
        resampled_voice = None
        music_for_cue = None
        if ambient_source is not None:
            positions = np.arange(offset, offset + len(source)) - ambient_lag
            music_for_cue = ambient_source[np.maximum(0, positions) % len(ambient_source)].copy()
            music_for_cue[positions < 0] = 0
            # A fixed 17-tap fit accounts for the platform's fractional resampling phase.
            # It spans one millisecond and cannot conceal a missing word or playback gap.
            shifted = np.lib.stride_tricks.sliding_window_view(np.pad(source, (8, 8)), 17)
            time_axis = np.linspace(-1, 1, len(source))
            design = np.column_stack([shifted, music_for_cue, music_for_cue * time_axis, music_for_cue * time_axis ** 2])
            fitted = np.linalg.lstsq(design, original_recording[offset:offset + len(source)], rcond=None)[0]
            resampled_voice = shifted @ fitted[:17]
        for start in range(0, len(source) - rate // 4, rate // 2):
            x = source[start:start + rate // 2]
            y = actual[start:start + rate // 2]
            x_energy, y_energy = float(np.dot(x, x)), float(np.dot(y, y))
            if x_energy / len(x) < 1e-5:
                continue
            windows.append({'at': start / rate, 'correlation': float(np.dot(x, y) / np.sqrt(max(1e-20, x_energy * y_energy)))})
            if ambient_source is not None:
                positions = np.arange(offset + start, offset + start + len(x)) - ambient_lag
                music = ambient_source[np.maximum(0, positions) % len(ambient_source)].copy()
                music[positions < 0] = 0
                captured = original_recording[offset + start:offset + start + len(x)]
                gains = np.linalg.lstsq(np.column_stack([x, music]), captured, rcond=None)[0]
                voice = captured - gains[1] * music
                adjusted_windows.append({'at': start / rate, 'sourceRms': float(np.sqrt(x_energy / len(x))),
                    'voiceGain': float(gains[0]), 'musicGain': float(gains[1]),
                    'voiceCorrelation': float(np.dot(x, voice) / np.sqrt(max(1e-20, x_energy * float(np.dot(voice, voice)))))})
                expected_voice = resampled_voice[start:start + len(x)]
                local_fit = np.linalg.lstsq(np.column_stack([expected_voice, music]), captured, rcond=None)[0]
                phase_corrected = captured - local_fit[1] * music
                adjusted_windows[-1].update(resampledGainRatio=float(local_fit[0]),
                    resampledCorrelation=float(np.dot(expected_voice, phase_corrected) / np.sqrt(max(1e-20, float(np.dot(expected_voice, expected_voice)) * float(np.dot(phase_corrected, phase_corrected))))))
        comparisons.append({'phase': cue['phase'], 'source': cue['file'], 'sourceSeconds': len(source) / rate, 'recordedOffset': offset / rate,
                            'correlation': coefficient, 'gain': gain, 'minimumHalfSecondCorrelation': min((item['correlation'] for item in windows), default=None),
                            'weakWindows': [window for window in windows if window['correlation'] < .7],
                            'localMixWindows': adjusted_windows})
    item = {'id': result['id'], 'sessionCompleted': result['completed'], 'recordedSeconds': len(recorded) / rate, 'ambient': ambient_evidence, 'cues': comparisons}
    evidence.append(item)
    print(json.dumps(item), flush=True)
    # Long source files are released between sessions to keep the QA process bounded.
    cache.clear()
Path(args.output).write_text(json.dumps(evidence, indent=2), encoding='utf-8')
