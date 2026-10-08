import native_ui as q
import subprocess, time

for index in range(3):
    if index == 2:
        recording = subprocess.Popen([q.ADB, '-s', 'emulator-5554', 'shell', 'screenrecord', '--time-limit', '12', '/sdcard/phase3-arrival.mp4'], creationflags=subprocess.CREATE_NO_WINDOW)
    q.tap('Chart options')
    q.tap('Mark waypoint reached')
    q.tap("Yes, I've reached it")
    time.sleep(3)
    if index < 2:
        q.tap("I'm committed")
recording.wait()
q.adb('pull', '/sdcard/phase3-arrival.mp4', str(q.ROOT/'arrival.mp4'))
q.adb('shell', 'screencap', '-p', '/sdcard/phase3.png')
q.adb('pull', '/sdcard/phase3.png', str(q.ROOT/'arrival.png'))
