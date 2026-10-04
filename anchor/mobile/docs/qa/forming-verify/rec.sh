#!/bin/bash
# usage: rec.sh <name> [seconds]  -- records screen while tapping "Form it" (540,1992)
export MSYS_NO_PATHCONV=1
ADB=/c/Users/dwill/AppData/Local/Android/Sdk/platform-tools/adb.exe
cd /e/Projects/Anchor/anchor/mobile/docs/qa/forming-verify
N=$1; S=${2:-18}
$ADB shell rm -f /sdcard/$N.mp4
$ADB shell "screenrecord --time-limit $S --size 540x1200 --bit-rate 6000000 /sdcard/$N.mp4" > /dev/null 2>&1 &
sleep 1.5; $ADB shell input tap 540 1992; wait; sleep 1
$ADB pull /sdcard/$N.mp4 ${N}_form.mp4 >/dev/null
rm -rf ${N}_f10; mkdir ${N}_f10
ffmpeg -v error -y -i ${N}_form.mp4 -vf "fps=10,crop=540:420:0:260" ${N}_f10/f_%03d.png
ffmpeg -v error -y -i ${N}_form.mp4 -vf "fps=4,scale=180:400,tile=10x8" -frames:v 1 ${N}_sheet.png
