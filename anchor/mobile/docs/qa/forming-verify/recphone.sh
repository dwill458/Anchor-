#!/bin/bash
# usage: recphone.sh <name> <tapx> <tapy> [seconds]   (physical phone)
export MSYS_NO_PATHCONV=1
ADB="/c/Users/dwill/AppData/Local/Android/Sdk/platform-tools/adb.exe -s 192.168.0.251:46435"
cd /e/Projects/Anchor/anchor/mobile/docs/qa/forming-verify
N=$1; S=${4:-20}
$ADB shell rm -f /sdcard/$N.mp4
$ADB shell "screenrecord --time-limit $S --size 540x1170 --bit-rate 6000000 /sdcard/$N.mp4" > /dev/null 2>&1 &
sleep 1.5; $ADB shell input tap $2 $3; wait; sleep 1
$ADB pull /sdcard/$N.mp4 ${N}_form.mp4 >/dev/null
$ADB shell rm -f /sdcard/$N.mp4
rm -rf ${N}_f10; mkdir ${N}_f10
ffmpeg -v error -y -i ${N}_form.mp4 -vf "fps=10,crop=540:420:0:260" ${N}_f10/f_%03d.png
ffmpeg -v error -y -i ${N}_form.mp4 -vf "fps=4,scale=180:390,tile=10x8" -frames:v 1 ${N}_sheet.png
