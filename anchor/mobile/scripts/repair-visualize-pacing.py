"""Remove editing-added pauses inside Visualize phrases, preserving natural breaths.

Compares acoustic word alignments against the uninterrupted original take. Moves
the existing mixed tail of a split phrase into its gap without stretching audio.
The vacated tail is filled from that same phrase's voice-free gap, with fades.
Overall duration, other phrases, music outside the repair, and voice gain stay fixed.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

import numpy as np
from scipy.signal import butter, sosfiltfilt

RATE = 44100
ROOT = Path(__file__).resolve().parents[1]


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ar', str(RATE),
                          '-ac', '2', '-f', 'f32le', '-'], capture_output=True, check=True)
    return np.frombuffer(raw.stdout, dtype='<f4').reshape(-1, 2).copy()


def clip(audio, start, end):
    return audio[round(start * RATE):round(end * RATE)].copy()


def replace(audio, start, samples):
    at = round(start * RATE)
    weight = np.ones((len(samples), 1), dtype=np.float32)
    n = round(.03 * RATE)
    ramp = (.5 - .5 * np.cos(np.linspace(0, np.pi, n))).astype(np.float32)
    weight[:n, 0], weight[-n:, 0] = ramp, ramp[::-1]
    audio[at:at + len(samples)] *= 1 - weight
    audio[at:at + len(samples)] += samples * weight


def edits_for(current, raw):
    edits = []
    originals = {phrase['id']: phrase for phrase in raw['phrases']}
    for phrase in current['phrases']:
        original = originals[phrase['id']]
        if phrase['text'] != original['text'] or len(phrase['words']) != len(original['words']):
            raise ValueError('Alignment text differs from original take')
        for i, (first, second) in enumerate(zip(phrase['words'], phrase['words'][1:])):
            gap = second['start'] - first['end']
            natural = original['words'][i + 1]['start'] - original['words'][i]['end']
            if gap - natural < .75:
                continue
            # Preserve at least 360ms between acoustic words, leaving edit margins.
            shift = gap - max(.36, natural)
            edits.append({'id': phrase['id'], 'text': phrase['text'], 'wordIndex': i + 1,
                          'gap': gap, 'naturalGap': natural, 'shift': shift,
                          'gapStart': first['end'] + .1, 'gapEnd': second['start'] - .1,
                          'sourceStart': second['start'] - .15, 'sourceEnd': phrase['end'] + .25,
                          'destinationStart': second['start'] - .15 - shift,
                          'newEnd': phrase['end'] - shift})
    if len({item['id'] for item in edits}) != len(edits):
        raise ValueError('Multiple splits in a phrase require a separate edit plan')
    return edits


def build(source, edits):
    output = source.copy()
    for edit in edits:
        tail = clip(source, edit['sourceStart'], edit['sourceEnd'])
        moved_end = edit['sourceEnd'] - edit['shift']
        fill_at = max(edit['sourceStart'], moved_end - .15)
        count = round(edit['sourceEnd'] * RATE) - round(fill_at * RATE)
        quiet = clip(source, edit['gapStart'], edit['gapEnd'])
        if count > len(quiet):
            raise ValueError('Not enough voice-free bed for the vacated tail')
        replace(output, fill_at, quiet[:count])
        replace(output, edit['destinationStart'], tail)
    return output


def validate(source, candidate, edits):
    if len(source) != len(candidate):
        raise ValueError('Session duration changed')
    filt = butter(4, 180, fs=RATE, btype='highpass', output='sos')
    for edit in edits:
        original = sosfiltfilt(filt, clip(source, edit['sourceStart'] + .1, edit['sourceEnd'] - .1).mean(axis=1))
        actual = sosfiltfilt(filt, clip(candidate, edit['destinationStart'] + .1,
                                       edit['sourceEnd'] - edit['shift'] - .1).mean(axis=1))
        n = min(len(original), len(actual))
        edit['tailCorrelation'] = float(np.corrcoef(original[:n], actual[:n])[0, 1])
        if edit['tailCorrelation'] < .985:
            raise ValueError(f"Split phrase {edit['id']} persists: {edit['tailCorrelation']}")
        moved_end = edit['sourceEnd'] - edit['shift']
        fill_at = max(edit['sourceStart'], moved_end - .15)
        check_start = max(fill_at + .08, moved_end + .04)
        check_end = edit['sourceEnd'] - .08
        expected_bed = clip(source, edit['gapStart'] + check_start - fill_at,
                            edit['gapStart'] + check_end - fill_at).ravel()
        actual_bed = clip(candidate, check_start, check_end).ravel()
        n = min(len(expected_bed), len(actual_bed))
        edit['vacatedTailBedCorrelation'] = float(np.corrcoef(expected_bed[:n], actual_bed[:n])[0, 1])
        if edit['vacatedTailBedCorrelation'] < .98:
            raise ValueError(f"Old speech remains after phrase {edit['id']}")
    if np.max(np.abs(candidate)) >= 1:
        raise ValueError('Decoded output clips')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['build', 'validate'])
    parser.add_argument('matrix')
    parser.add_argument('alignments')
    parser.add_argument('raw_alignments')
    parser.add_argument('--original', action='store_true')
    parser.add_argument('--apply-maps', action='store_true')
    args = parser.parse_args()
    receipt = []
    maps = {}
    for row in json.loads(Path(args.matrix).read_text(encoding='utf-8'))['matrix']:
        if row['mode'] != 'visualize':
            continue
        current = json.loads((Path(args.alignments) / (row['id'] + '.json')).read_text())
        raw = json.loads((Path(args.raw_alignments) / (row['id'] + '.json')).read_text())
        edits = edits_for(current, raw)
        if not edits:
            print(row['id'] + ': no added internal pauses', flush=True)
            continue
        path = Path(row['cues'][0]['file'])
        new = path.with_name(path.stem.rsplit('_V', 1)[0] + '_V6.mp3')
        source = decode(path)
        if args.command == 'build':
            output = build(source, edits)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', '2',
                            '-i', '-', '-c:a', 'libmp3lame', '-b:a', '192k', str(new)],
                           input=output.astype('<f4').tobytes(), check=True)
        validate(source, decode(path if args.original else new), edits)
        receipt.append({'id': row['id'], 'source': str(path), 'file': new.name,
                        'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                        'sha256': hashlib.sha256(new.read_bytes()).hexdigest(), 'edits': edits})
        if args.apply_maps:
            map_path = ROOT / f"src/screens/v2/practice/visualize/beatmaps/beatmap_{row['track']}.json"
            if map_path not in maps:
                maps[map_path] = json.loads(map_path.read_text())
            phrases = maps[map_path]['voices']['lina' if row['voice'] == 'female' else 'dominic']['phrases']
            for edit in edits:
                phrase = next(p for p in phrases if p['id'] == edit['id'])
                phrase['end'] = round(edit['newEnd'], 3)
                phrase.pop('caption_spans', None)
            for first, second in zip(phrases, phrases[1:]):
                first['silence_after'] = round(second['start'] - first['end'], 3)
        print(f"{row['id']}: {len(edits)} split phrases verified", flush=True)
    for path, data in maps.items():
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    if not args.original:
        (ROOT / 'docs/qa/audio-pacing-20261026/visualize-pacing.json').write_text(
            json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
