#!/bin/bash
# T3 靶向回归链（w7-edits.md:70 预注册序列）：gate-8 → gate-9 → gate-10 → gate-11 → gate-12 → falsify-g11
# 调用方式与 _run-suite.sh 同款（timeout＋逐闸日志；本链不入全量套件，T4 另行全套 39）。
# 日志：shots/w7-t2b/t3-<闸名>.txt；汇总：shots/w7-t2b/t3-summary.txt（末行 T3DONE rc=0 表示链全绿）
cd /d/2006L/chaitai || exit 2
S=shots/w7-t2b
mkdir -p "$S"
: > "$S/t3-summary.txt"
echo "T3 start $(date '+%F %T')" | tee -a "$S/t3-summary.txt"
fail=0
for g in gate-8-acts2 gate-9-acts3 gate-10-final gate-11-silhouette gate-12-chain falsify-g11; do
  to=420
  [ "$g" = "gate-9-acts3" ] && to=660
  [ "$g" = "gate-10-final" ] && to=1500
  [ "$g" = "gate-11-silhouette" ] && to=600
  [ "$g" = "gate-12-chain" ] && to=1500
  [ "$g" = "falsify-g11" ] && to=3600
  t0=$(date +%s)
  timeout $to node "tools/$g.cjs" > "$S/t3-$g.txt" 2>&1
  rc=$?
  t1=$(date +%s)
  tail_line=$(grep -E "^GATE |^---- |汇总" "$S/t3-$g.txt" | tail -1)
  [ "$rc" -ne 0 ] && fail=$((fail + 1))
  echo "$([ "$rc" -eq 0 ] && echo PASS || echo FAIL)  $g  rc=$rc  ${t1}-${t0}=$((t1 - t0))s  $tail_line" | tee -a "$S/t3-summary.txt"
done
echo "T3 end $(date '+%F %T') · FAIL=$fail" | tee -a "$S/t3-summary.txt"
echo "T3DONE rc=$fail" >> "$S/t3-summary.txt"
exit $fail
