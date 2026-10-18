#!/bin/bash
# W4 收口批跑（falsify-g10 完成后串行；一次只跑一个浏览器流）
# 顺序：红树 md5 存档 → gate-9 rev7 红侧（W3 冻结树 shots/red-g10/）→ gate-9 rev7 活件 → v024 红侧（同树）→ v024 活件
cd /d/2006L/chaitai || exit 2
echo "== W4-BATCH 起 $(date +%H:%M:%S) =="

md5sum shots/red-g10/game.js shots/red-g10/index.html > shots/w4b-red-tree-md5.txt
cat shots/w4b-red-tree-md5.txt

CHAITAI_URL="file:///D:/2006L/chaitai/shots/red-g10/index.html" CHAITAI_SHOT_PREFIX="red-w4-g9-" \
  node tools/gate-9-acts3.cjs > shots/gate-9-RED-rev7.txt 2>&1; echo "gate-9-red rc=$?"

CHAITAI_SHOT_PREFIX="g9-w4-" \
  node tools/gate-9-acts3.cjs > shots/gate-9-GREEN-live-w4.txt 2>&1; echo "gate-9-green rc=$?"

CHAITAI_URL="file:///D:/2006L/chaitai/shots/red-g10/index.html" \
  node tools/verify-v024.cjs > shots/verify-v024-RED-w4.txt 2>&1; echo "v024-red rc=$?"

node tools/verify-v024.cjs > shots/verify-v024-live-w4.txt 2>&1; echo "v024-green rc=$?"

echo "== W4-BATCH 完 $(date +%H:%M:%S) =="
