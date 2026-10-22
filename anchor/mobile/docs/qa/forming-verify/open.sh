#!/bin/bash
export MSYS_NO_PATHCONV=1
ADB=/c/Users/dwill/AppData/Local/Android/Sdk/platform-tools/adb.exe
cd /e/Projects/Anchor/anchor/mobile/docs/qa/forming-verify
$ADB shell am start -a android.intent.action.VIEW -d "anchor://creation-flow-qa?start=flow\&text=$1\&category=desire\&source=typed\&wait=40000" com.anchorintentions.app >/dev/null 2>&1
sleep ${2:-34}
$ADB exec-out screencap -p > cur.png
