"""Exercise real controls and a reversible local-transport failure on the USB Moto."""
import argparse
import atexit
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser()
parser.add_argument('matrix')
parser.add_argument('--scrcpy', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--only', choices=['retry', 'deep', 'visualize', 'focus', 'all'], default='all')
parser.add_argument('--tag', required=True)
args = parser.parse_args()
output = Path(args.output)
serial = 'ZY22KPQQHK'
evidence_file = output / 'native-control-evidence.json'
evidence = json.loads(evidence_file.read_text(encoding='utf-8')) if evidence_file.exists() else []
owned_children = []
current_case = None

def cleanup_children():
    for child in owned_children:
        if child.poll() is None:
            subprocess.run(['taskkill', '/PID', str(child.pid), '/T', '/F'], capture_output=True)

atexit.register(cleanup_children)

def adb(*command):
    return subprocess.run(['adb', '-s', serial, *command], capture_output=True, text=True, timeout=20, check=True).stdout

def events(path):
    if not path.exists():
        return []
    found = []
    for line in path.read_text(encoding='utf-8', errors='replace').splitlines():
        if '[SESSION_AUDIO_' not in line:
            continue
        a, b = line.find('{'), line.rfind('}')
        if a >= 0 and b > a:
            try:
                found.append(json.loads(line[a:b + 1]))
            except json.JSONDecodeError:
                pass
    return found

def wait_for(read, predicate, seconds=25):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        value = read()
        if predicate(value):
            return value
        time.sleep(.2)
    raise RuntimeError('Timed out waiting for native/UI state')

def bounds(label, reveal=False):
    deep_points = {'Sound: On': (202, 1455), 'Sound: Off': (202, 1455), 'Pause Deep Focus': (345, 1455)}
    focus_points = {'Sound: On': (140, 1455), 'Sound: Off': (140, 1455)}
    points = deep_points if current_case and 'deep_prime' in current_case else focus_points if current_case and 'audio-focus-' in current_case else {}
    if reveal and label in points:
        # These controls are grouped beneath an accessible screen root. Their
        # actual hit areas were visually inspected on this device; save each use.
        screenshot('controls-hit-area-' + label.replace(':', '').replace(' ', '-') + '-' + args.tag + '.png')
        return points[label]
    hierarchy = '/sdcard/anchor-audio-controls-' + str(time.monotonic_ns()) + '.xml'
    dump = subprocess.Popen(['adb', '-s', serial, 'shell', 'uiautomator', 'dump', hierarchy], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    deadline = time.monotonic() + 22
    while dump.poll() is None:
        if time.monotonic() > deadline:
            dump.kill()
            raise RuntimeError('Native control hierarchy timed out')
        if reveal:
            # The hierarchy's idle wait can outlast the UI's 3.2-second control timeout.
            adb('shell', 'input', 'tap', '360', '300')
        time.sleep(.5)
    if dump.returncode:
        raise RuntimeError('Native control hierarchy failed')
    xml = adb('shell', 'cat', hierarchy)
    adb('shell', 'rm', hierarchy)
    for node in ET.fromstring(xml).iter('node'):
        if node.attrib.get('content-desc') == label or node.attrib.get('text') == label:
            values = list(map(int, re.findall(r'\d+', node.attrib['bounds'])))
            return ((values[0] + values[2]) // 2, (values[1] + values[3]) // 2)
    raise RuntimeError('Missing actual control: ' + label)

def tap(label, reveal=False):
    if reveal:
        adb('shell', 'input', 'tap', '360', '300')
    point = bounds(label, reveal)
    if reveal:
        # Refresh the Focus control timeout after inspecting its actual hit area.
        adb('shell', 'input', 'tap', '360', '300')
    adb('shell', 'input', 'tap', str(point[0]), str(point[1]))
    return point

def screenshot(name):
    (output / name).write_bytes(subprocess.check_output(['adb', '-s', serial, 'exec-out', 'screencap', '-p']))

def start(case, suffix):
    global current_case
    current_case = case
    log = output / ('control-runner-' + suffix + '.txt')
    stream = log.open('w', encoding='utf-8')
    child = subprocess.Popen([sys.executable, str(Path(__file__).with_name('run-session-audio-moto.py')), args.matrix,
                              '--scrcpy', args.scrcpy, '--output', str(output), '--filter', case.rstrip('-'), '--suffix', suffix],
                             stdout=stream, stderr=subprocess.STDOUT)
    owned_children.append(child)
    native = output / ('native-logcat-' + suffix + '.txt')
    wait_for(lambda: events(native), lambda values: any(item.get('event') == 'mounted' and item.get('runId', '').endswith(suffix) for item in values))
    return child, stream, native

def states(path, loop=None, uri=None):
    values = events(path)
    # Scope to the most recent actual session launch rather than logcat backlog.
    begins = [index for index, value in enumerate(values) if value.get('event') == 'received_url']
    values = values[begins[-1]:] if begins else values
    players = {value['playerId']: value for value in values if value.get('event') == 'created'}
    result = []
    for value in values:
        if 'status' not in value:
            continue
        if loop is not None and value['status'].get('loop') != loop:
            continue
        if uri and uri not in str(players.get(value['playerId'], {}).get('uri', '')):
            continue
        result.append(value)
    return result

def latest(path, **filters):
    found = states(path, **filters)
    return found[-1] if found else {}

def finish(child, stream, suffix):
    child.wait(timeout=280)
    stream.close()
    if child.returncode:
        raise RuntimeError('Controlled session failed: ' + suffix)
    result = json.loads((output / ('native-results-' + suffix + '.jsonl')).read_text(encoding='utf-8').splitlines()[-1])
    if not result['completed']:
        raise RuntimeError('Controlled session did not complete')
    return result

def save(item):
    evidence.append(item)
    (output / 'native-control-evidence.json').write_text(json.dumps(evidence, indent=2), encoding='utf-8')
    print(json.dumps(item), flush=True)

if args.only in ['retry', 'all']:
    suffix = 'controls-retry-' + args.tag
    adb('reverse', '--remove', 'tcp:8081')
    try:
        child, stream, native = start('audio-focus-10-male-ambient-', suffix)
        failure = wait_for(lambda: latest(native, loop=False), lambda value: bool(value.get('status', {}).get('error')))
        time.sleep(12)
        if any(item.get('event') == 'completed' and item.get('runId', '').endswith(suffix) for item in events(native)):
            raise RuntimeError('Failed audio falsely completed')
        screenshot(suffix + '-held.png')
        adb('reverse', 'tcp:8081', 'tcp:8081')
        tap('Retry guidance')
        result = finish(child, stream, suffix)
        save({'case': 'Focus native source failure/retry', 'passed': True, 'failure': failure, 'heldPastNominalSeconds': 12, 'result': result})
    finally:
        adb('reverse', 'tcp:8081', 'tcp:8081')

if args.only in ['deep', 'all']:
    suffix = 'controls-deep-' + args.tag
    child, stream, native = start('audio-deep_prime-120-female-ambient-', suffix)
    wait_for(lambda: latest(native, loop=False), lambda value: value.get('status', {}).get('currentTime', 0) >= 10)
    tap('Sound: On', reveal=True)
    muted_at = latest(native, loop=False)
    time.sleep(5)
    muted_later = latest(native, loop=False)
    if not muted_later['status']['playing'] or muted_later['status']['currentTime'] - muted_at['status']['currentTime'] < 4:
        raise RuntimeError('Mute stopped the narration clock')
    tap('Sound: Off', reveal=True)
    tap('Pause Deep Focus', reveal=True)
    paused = wait_for(lambda: latest(native, loop=False), lambda value: value and not value['status']['playing'])
    time.sleep(5)
    held = latest(native, loop=False)
    if abs(held['status']['currentTime'] - paused['status']['currentTime']) > .05:
        raise RuntimeError('Paused narration advanced')
    screenshot(suffix + '-paused.png')
    count = len(states(native, loop=False))
    tap('Resume Deep Focus')
    resumed = wait_for(lambda: states(native, loop=False)[count:], lambda values: any(item['status']['playing'] for item in values))
    first = next(item for item in resumed if item['status']['playing'])
    if first['playerId'] != paused['playerId'] or abs(first['status']['currentTime'] - paused['status']['currentTime']) > .5:
        raise RuntimeError('Resume replayed or skipped narration')
    result = finish(child, stream, suffix)
    save({'case': 'Deep Focus mute/pause/resume', 'passed': True, 'mutedAt': muted_at, 'mutedLater': muted_later, 'paused': paused, 'resumed': first, 'result': result})

if args.only in ['visualize', 'all']:
    suffix = 'controls-visualize-' + args.tag
    child, stream, native = start('audio-visualize-60-male-ambient-', suffix)
    wait_for(lambda: latest(native, loop=False), lambda value: value.get('status', {}).get('currentTime', 0) >= 8)
    adb('shell', 'input', 'keyevent', '3')
    paused = wait_for(lambda: latest(native, loop=False), lambda value: value and not value['status']['playing'])
    time.sleep(5)
    adb('shell', 'am', 'start', '-W', '-n', 'com.anchorintentions.app/.MainActivity')
    screenshot(suffix + '-paused.png')
    count = len(states(native, loop=False))
    tap('Resume Visualize')
    resumed = wait_for(lambda: states(native, loop=False)[count:], lambda values: any(item['status']['playing'] for item in values))
    first = next(item for item in resumed if item['status']['playing'])
    if first['playerId'] != paused['playerId'] or abs(first['status']['currentTime'] - paused['status']['currentTime']) > .5:
        raise RuntimeError('Background/resume replayed or skipped narration')
    result = finish(child, stream, suffix)
    save({'case': 'Visualize background/resume', 'passed': True, 'paused': paused, 'resumed': first, 'result': result})

if args.only in ['focus', 'all']:
    suffix = 'controls-focus-muted-' + args.tag
    child, stream, native = start('audio-focus-30-soothing-ambient-', suffix)
    wait_for(lambda: latest(native, loop=False), lambda value: value.get('status', {}).get('currentTime', 0) >= 1)
    switch = tap('Sound: On', reveal=True)
    closing = wait_for(lambda: latest(native, loop=False, uri='30s-end'), lambda value: value.get('status', {}).get('currentTime', 0) >= 1, seconds=40)
    if not closing['status']['playing'] or not closing['status']['mute']:
        raise RuntimeError('Closing cue was not advancing while muted')
    adb('shell', 'input', 'tap', '360', '300')
    adb('shell', 'input', 'tap', str(switch[0]), str(switch[1]))
    result = finish(child, stream, suffix)
    save({'case': 'Focus modular cue progression while muted', 'passed': True, 'closingAlreadyPlaying': closing, 'result': result})
