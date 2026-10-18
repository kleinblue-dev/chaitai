#!/bin/bash
# 拆台 · 全套回跑：十四闸 + 九证伪 + v012/v020/v021/v022/v023/v024/v025/v026/v027/v028/v029/v030/v031 验收探针 + verify-visual-v1 视觉系统闸（共 39 闸）。逐闸独立日志 + 末行汇总 PASS/FAIL 计数 + 总 rc。
# 用法：bash tools/_run-suite.sh        （2026-10-16 实测：33 闸约 60 分钟；W5.3 起含 gate-13（约 2–3 分钟）＋falsify-g13（含正本+4 变异共 5 趟 gate-13）；W6.1 起含 gate-14（约 2–3 分钟）＋falsify-g14（含正本+4 变异共 5 趟 gate-14）；W7 起含 gate-15-elite（约 1–2 分钟）＋falsify-g15（含正本+5 变异共 6 趟 gate-15），全程无交互；falsify-g9 内含 9 趟 gate-9 跑、falsify-g10 内含 11 趟 gate-10 跑、falsify-g11 内含 4 趟 gate-11 跑；注：falsify-g12 不在本套件内——含 5 趟 gate-12 全梯约 20–30 分钟，单独跑 node tools/falsify-g12.cjs）
# 日志：shots/suite-logs/<闸名>.txt；截图：shots/<闸名>-*.png
cd /d/2006L/chaitai || exit 2
S=shots/suite-logs
mkdir -p "$S"
: > "$S/summary.txt"
if [ ! -f index.html ] || [ ! -f game.js ]; then
  echo "!! index.html 或 game.js 还不存在 —— 闸会全红报 file-missing，这不是测试写错了。"
fi
pass=0
fail=0
for g in gate-1-load gate-2-move gate-3-combat gate-4-defy-wall gate-5-clear gate-6-mobile gate-7-acts gate-8-acts2 gate-9-acts3 gate-10-final gate-11-silhouette gate-12-chain gate-13-dynamics gate-14-damage gate-15-elite falsify-g1 falsify-g4 falsify-g7 falsify-g8 falsify-g9 falsify-g10 falsify-g11 falsify-g13 falsify-g14 falsify-g15 verify-v012 verify-v020 verify-v021 verify-v022 verify-v023 verify-v024 verify-v025 verify-v026 verify-v027 verify-v028 verify-v029 verify-v030 verify-v031 verify-visual-v1; do
  to=420; [ "$g" = "gate-9-acts3" ] && to=660   # gate-9 走全链＋机关等待，实测约 4–6 分钟
  [ "$g" = "gate-10-final" ] && to=1500        # gate-10 完整模式走全梯＋四结局配方（含等窗/分镜），实测约 4–7 分钟
  [ "$g" = "falsify-g7" ] && to=1200   # falsify-g7 内含正本+6 变异共 7 趟闸跑
  [ "$g" = "falsify-g8" ] && to=3000           # falsify-g8 内含正本+8 变异共 9 趟闸跑
  [ "$g" = "falsify-g9" ] && to=8400           # falsify-g9 内含正本+8 变异共 9 趟闸跑（单趟杀手 900s）
  [ "$g" = "falsify-g10" ] && to=5400          # falsify-g10 内含正本 2 趟（完整+段）+M1 完整+8 段共 11 趟闸跑（单趟杀手 1200s）
  [ "$g" = "gate-11-silhouette" ] && to=600    # gate-11 多段冻结+双朝向+130 帧动画采样，实测约 2–4 分钟
  [ "$g" = "gate-12-chain" ] && to=1500        # gate-12 全梯真跑（步进同 gate-10）＋终幕速通＋R 段，实测约 4–6 分钟
  [ "$g" = "falsify-g11" ] && to=3600          # falsify-g11 内含正本+3 变异共 4 趟 gate-11 跑（单趟杀手 900s）
  [ "$g" = "gate-13-dynamics" ] && to=600      # gate-13 动态表现力：多段冻结+帧率采样+三钩子契约，实测约 2–3 分钟
  [ "$g" = "falsify-g13" ] && to=1800          # falsify-g13 内含正本+4 变异共 5 趟 gate-13 跑（单趟杀手 300s）
  [ "$g" = "gate-14-damage" ] && to=600        # gate-14 战斗闭环：空挥+剑气/居合命中+击杀链+尸测+帧率，实测约 2–3 分钟
  [ "$g" = "falsify-g14" ] && to=1800          # falsify-g14 内含正本+4 变异共 5 趟 gate-14 跑（单趟杀手 300s）
  [ "$g" = "gate-15-elite" ] && to=600         # gate-15 精英（大灯）：A–M 13 行＋哨兵，含走链/冻结/真死复活段（600 为初值，W7.2 首跑实测后按实调高并留档）
  [ "$g" = "falsify-g15" ] && to=1800          # falsify-g15 内含正本+5 变异共 6 趟 gate-15 跑（单趟杀手 300s）
  timeout $to node "tools/$g.cjs" > "$S/$g.txt" 2>&1
  rc=$?
  tail_line=$(grep -E "^GATE " "$S/$g.txt" | tail -1)
  if [ "$rc" -eq 0 ]; then
    pass=$((pass + 1))
    echo "PASS  $g  rc=0   $tail_line" | tee -a "$S/summary.txt"
  else
    fail=$((fail + 1))
    echo "FAIL  $g  rc=$rc   $tail_line" | tee -a "$S/summary.txt"
  fi
done
echo "----" | tee -a "$S/summary.txt"
echo "PASS $pass / FAIL $fail （逐闸日志：$S/*.txt）" | tee -a "$S/summary.txt"
if [ "$fail" -eq 0 ]; then exit 0; else exit 1; fi
