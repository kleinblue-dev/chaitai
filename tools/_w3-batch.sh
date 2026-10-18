#!/bin/bash
# W3 收口批跑（GREEN4 后串行；一次只跑一个浏览器流）
# 每项独立回执进 shots/；顺序：旧闸手感回归 → gate-8 翻面两趟 → v024 → gate-9 红侧（最终闸版）
cd /d/2006L/chaitai || exit 2
echo "== W3-BATCH 起 $(date +%H:%M:%S) =="

CHAITAI_SHOT_PREFIX="w3b-3-" node tools/gate-3-combat.cjs > shots/w3b-gate-3.txt 2>&1; echo "gate-3 rc=$?"
CHAITAI_SHOT_PREFIX="w3b-4-" node tools/gate-4-defy-wall.cjs > shots/w3b-gate-4.txt 2>&1; echo "gate-4 rc=$?"
CHAITAI_SHOT_PREFIX="w3b-5-" node tools/gate-5-clear.cjs > shots/w3b-gate-5.txt 2>&1; echo "gate-5 rc=$?"

CHAITAI_URL="file:///D:/2006L/chaitai/shots/red-g9/index.html" CHAITAI_SHOT_PREFIX="red-g9-g8-" \
  node tools/gate-8-acts2.cjs > shots/gate-8-RED-rev6.txt 2>&1; echo "gate-8-red rc=$?"
CHAITAI_SHOT_PREFIX="g8-w3-" node tools/gate-8-acts2.cjs > shots/gate-8-GREEN-live.txt 2>&1; echo "gate-8-green rc=$?"

node tools/verify-v024.cjs > shots/verify-v024-live.txt 2>&1; echo "v024 rc=$?"

CHAITAI_URL="file:///D:/2006L/chaitai/shots/red-g9/index.html" CHAITAI_SHOT_PREFIX="red-g9-" \
  node tools/gate-9-acts3.cjs > shots/gate-9-RED.txt 2>&1; echo "gate-9-red rc=$?"

echo "== W3-BATCH 完 $(date +%H:%M:%S) =="
