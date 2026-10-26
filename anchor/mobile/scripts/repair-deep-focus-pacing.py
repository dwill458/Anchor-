"""Re-space the original Deep Focus mixes without changing voice, words or speed.

Builds separate V5 assets; validate checks the decoded audio against each original
spoken window at its intended time (and fails on the old end-loaded masters).
Requires ffmpeg, numpy and scipy. Original assets remain the source of truth.
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
ASSETS = ROOT / 'src/assets/sounds/focus-mix'
# Whole spoken clauses, with cuts in the inter-clause silence. The source itself
# split Dominic's opening breath and Lina's "it just needs returning" by minutes.
# (description, source start, source end, destination start)
TEN_MINUTE_EDITS = {
    'Dominic': [
        ('settle', 7.25, 11.0, 7.25),
        ('permission and inhale', 113.5, 120.7, 20),
        ('exhale', 239.35, 242.35, 29),
        ('second breath', 378.65, 384.65, 34),
        ('intention', 538.65, 554.4, 60),
        ('nothing to solve', 554.4, 559.45, 120),
        ('anchor', 559.45, 570.22, 145),
        ('return', 570.22, 576.95, 260),
        ('steadiness', 576.95, 583.4, 390),
        ('let details fall away', 583.4, 587.6, 510),
        ('closing breath and carry forward', 587.6, 596.05, 580),
    ],
    'Lina': [
        ('settle', 7.3, 10.8, 7.3),
        ('permission and breaths', 114.1, 126.5, 20),
        ('intention', 247.3, 262.4, 60),
        ('nothing to solve', 400.2, 405.6, 120),
        ('anchor', 405.6, 415.6, 145),
        ('return', 415.6, 422.3, 260),
        ('steadiness', 422.3, 426.7, 390),
        ('it just needs returning', 581.7, 584.2, 394.4),
        ('let details fall away', 584.2, 588.1, 510),
        ('closing breath and carry forward', 588.1, 595.95, 580),
    ],
}

EDITS = {
    (10, voice): edits for voice, edits in TEN_MINUTE_EDITS.items()
}
EDITS.update({
    (2, 'Dominic'): [
        ('settle', 2.65, 5.5, 2.65),
        ('intention', 41.25, 45.2, 8),
        ('say it quietly', 45.2, 48.0, 25),
        ('let everything else fall away', 48.0, 50.6, 50),
        ('nowhere else to be', 105.25, 108.5, 65),
        ('anchor and steadiness', 108.5, 113.2, 80),
        ('carry forward', 113.2, 117.0, 110),
    ],
    (2, 'Lina'): [
        ('settle and intention', 3.05, 7.95, 3.05),
        ('say it quietly', 44.1, 48.0, 25),
        ('let everything else fall away', 103.05, 106.2, 50),
        ('nowhere else to be', 106.2, 108.65, 65),
        ('anchor and steadiness', 108.65, 113.3, 80),
        ('carry forward', 113.3, 117.0, 110),
    ],
    (5, 'Dominic'): [
        ('settle', 5.0, 8.3, 5),
        ('inhale', 73.7, 76.8, 10),
        ('exhale', 158.9, 160.85, 14.5),
        ('intention', 161.05, 170.2, 30),
        ('quiet and nothing to solve', 170.2, 176.3, 60),
        ('anchor', 176.3, 182.8, 100),
        ('stay and steady', 182.8, 185.75, 155),
        ('quiet underneath the effort', 185.75, 189.9, 210),
        ('closing', 288.5, 297.0, 285),
    ],
    (5, 'Lina'): [
        ('settle and breath', 5.4, 11.4, 5),
        ('intention', 11.4, 19.7, 30),
        ('quiet and nothing to solve', 19.7, 25.8, 60),
        ('anchor', 92.1, 98.4, 100),
        ('stay and steady', 98.4, 101.2, 155),
        ('quiet underneath the effort', 101.2, 103.9, 210),
        ('this is yours', 187.1, 189.2, 213),
        ('closing', 289.5, 297.0, 285),
    ],
})


def decode(path):
    result = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path),
                             '-ar', str(RATE), '-ac', '2', '-f', 'f32le', '-'],
                            capture_output=True, check=True)
    return np.frombuffer(result.stdout, dtype='<f4').reshape(-1, 2).copy()


def window(audio, start, end):
    return audio[round(start * RATE):round(end * RATE)]


def blend_into(audio, clip, start, fade_seconds=.03):
    at = round(start * RATE)
    fade = min(round(fade_seconds * RATE), len(clip) // 2)
    weight = np.ones((len(clip), 1), dtype=np.float32)
    ramp = (.5 - .5 * np.cos(np.linspace(0, np.pi, fade))).astype(np.float32)
    weight[:fade, 0], weight[-fade:, 0] = ramp, ramp[::-1]
    audio[at:at + len(clip)] *= 1 - weight
    audio[at:at + len(clip)] += clip * weight


def build(source, edits, minutes):
    # This voice-free stretch retains the original stereo bed. Overlap the loop
    # by 2s to avoid a seam; spoken clips replace this bed, so it never doubles.
    bed_start, bed_end = {2: (15, 35), 5: (30, 65), 10: (20, 100)}[minutes]
    bed = window(source, bed_start, bed_end)
    output = np.zeros((minutes * 60 * RATE, 2), dtype=np.float32)
    for at in range(0, minutes * 60, bed_end - bed_start - 2):
        clip = bed[:min(len(bed), len(output) - at * RATE)]
        blend_into(output, clip, at, 2)
    for _, lo, hi, target in edits:
        blend_into(output, window(source, lo, hi), target)
    output[:3 * RATE] *= np.linspace(0, 1, 3 * RATE)[:, None]
    output[-4 * RATE:] *= np.linspace(1, 0, 4 * RATE)[:, None]
    return output


def validate(source, candidate, edits, minutes):
    if abs(len(candidate) / RATE - minutes * 60) > .05:
        raise ValueError(f'The session must remain exactly {minutes} minutes')
    # Speech-band comparison checks actual audio, not just an asserted cue map.
    filt = butter(4, 180, fs=RATE, btype='highpass', output='sos')
    results = []
    for label, lo, hi, target in edits:
        original = sosfiltfilt(filt, window(source, lo + .12, hi - .12).mean(axis=1))
        actual = sosfiltfilt(filt, window(candidate, target + .12, target + hi - lo - .12).mean(axis=1))
        n = min(len(original), len(actual))
        correlation = float(np.corrcoef(original[:n], actual[:n])[0, 1])
        results.append({'phrase': label, 'source': [lo, hi], 'start': target,
                        'end': round(target + hi - lo, 3), 'correlation': correlation})
        if correlation < .985:
            raise ValueError(f'{label} missing/misplaced at {target}s: correlation {correlation:.5f}')
    if np.max(np.abs(candidate)) >= 1:
        raise ValueError('Decoded mix clips')
    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['build', 'validate'])
    parser.add_argument('--original', action='store_true', help='Prove the regression against the old files')
    parser.add_argument('--minutes', type=int, choices=[2, 5, 10], nargs='+', default=[2, 5, 10])
    args = parser.parse_args()
    receipt = []
    for (minutes, voice), edits in EDITS.items():
        if minutes not in args.minutes:
            continue
        old = ASSETS / f'DeepFocus_{minutes}min_{voice}.mp3'
        new = ASSETS / f'DeepFocus_{minutes}min_{voice}_V5.mp3'
        source = decode(old)
        if args.command == 'build':
            output = build(source, edits, minutes)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE),
                            '-ac', '2', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '192k', str(new)],
                           input=output.astype('<f4').tobytes(), check=True)
        target = old if args.original else new
        phrases = validate(source, decode(target), edits, minutes)
        receipt.append({'voice': voice, 'minutes': minutes, 'file': target.name,
                        'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'phrases': phrases})
        print(f'{minutes}min {voice}: {len(phrases)} spoken windows verified')
    if not args.original:
        (ROOT / ('docs/qa/deep-focus-pacing-20261026/pacing.json' if args.minutes == [10]
                 else 'docs/qa/audio-pacing-20261026/deep-focus-pacing.json')).write_text(
            json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
