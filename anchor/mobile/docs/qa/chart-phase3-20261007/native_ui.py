"""Visible Android lab actions; run only against the connected QA emulator."""
import os, re, subprocess, time, xml.etree.ElementTree as ET
from pathlib import Path

ADB = str(Path(os.environ['LOCALAPPDATA']) / 'Android/Sdk/platform-tools/adb.exe')
ROOT = Path(__file__).parent
def adb(*args):
    return subprocess.check_output([ADB, '-s', 'emulator-5554', *args], text=True, encoding='utf8')
def ui():
    adb('shell', 'uiautomator', 'dump', '/sdcard/phase3-ui.xml')
    return ET.fromstring(adb('shell', 'cat', '/sdcard/phase3-ui.xml'))
def tap(label, timeout=15):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        for node in ui().iter('node'):
            if node.get('content-desc') != label or node.get('enabled') != 'true':
                continue
            bounds = list(map(int, re.findall(r'\d+', node.get('bounds', ''))))
            if len(bounds) == 4 and bounds[3] > bounds[1] and bounds[3] <= 1704:
                adb('shell', 'input', 'tap', str((bounds[0]+bounds[2])//2), str((bounds[1]+bounds[3])//2))
                time.sleep(.6)
                print('Tapped:', label, flush=True)
                return
        time.sleep(.3)
    raise RuntimeError('No visible enabled control: ' + label)

if __name__ == '__main__':
    adb('shell', 'input', 'keyevent', '4')
    for _ in range(3):
        tap('Go back')
    adb('shell', 'input', 'swipe', '600', '1500', '600', '600', '800')
    recording = subprocess.Popen([ADB, '-s', 'emulator-5554', 'shell', 'screenrecord', '--time-limit', '25', '/sdcard/phase3-create-verified.mp4'], creationflags=subprocess.CREATE_NO_WINDOW)
    time.sleep(.4)
    tap('Start Chart creation')
    tap('Continue')
    tap('Skip for now')
    tap('Looks right')
    time.sleep(4)
    recording.wait()
    adb('pull', '/sdcard/phase3-create-verified.mp4', str(ROOT/'create-verified.mp4'))
