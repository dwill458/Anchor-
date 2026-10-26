"""Measure source loudness and true peaks without modifying media."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import re
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('matrix')
parser.add_argument('--output', required=True)
args = parser.parse_args()
assets = json.loads(Path(args.matrix).read_text(encoding='utf-8'))['assets']
def measure(asset):
    process = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-threads', '1', '-filter_threads', '1', '-i', asset['file'],
                              '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True)
    match = re.search(r'\{\s*"input_i".*?\}', process.stderr, re.S)
    data = json.loads(match.group(0)) if match else {'error': process.stderr[-1000:]}
    result = {'file': asset['file'], 'sha256': asset['sha256'], 'duration': asset['duration'], **data}
    print(json.dumps({'file': asset['file'], 'input_i': data.get('input_i'), 'input_tp': data.get('input_tp'), 'error': data.get('error')}), flush=True)
    return result
with ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(measure, assets))
Path(args.output).write_text(json.dumps(results, indent=2), encoding='utf-8')
