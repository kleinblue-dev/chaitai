/* _smoke-falsify-m10-12.cjs —— 一次性冒烟（非闸）：验证 falsify-g10 新增锚 M10–M12 的 harness 路径。
   spec 与 falsify-g10.cjs 的 M10–M12 逐字一致（改那边须同步这里）；与正式跑的区别＝跳过正本基线
   （基线代价 ~7-10 分钟/次；live 树绿已有 A6/A7 回执佐证）⇒ 正式判定以 suite 内 falsify-g10 为准。
   每变异：pre-flight 命中数 → 写变异副本（shots/falsify-g10-smoke/<id>/）→ 跑 payload 探针 → 判「红且锚中」。
   用法：node tools/_smoke-falsify-m10-12.cjs   （逐变异日志：shots/falsify-g10-smoke/<id>/smoke.txt） */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "shots", "falsify-g10-smoke");

const MUTS = [
  { id: "M10", tool: "gate-10-final.cjs", seg: true, anchor: "G10.18", edits: [
    { re: / if\(world\.phase==="dead"\)\{ schedule\(0\.5,openSpare\); return; \} \/\* W4\.1（A1）：boss_defeat→开窗的 2\.2s 死亡窗 ⇒ 重试（复活尾补开见 respawn） \*\/\n/, to: "" },
    { re: /if\(boss\.active&&boss\.dead&&!world\.spare&&!world\.ending\)openSpare\(\); /, to: "" },
  ] },
  { id: "M11", tool: "verify-w41-audio.cjs", anchor: "W41A.2", edits: [
    { re: /if\(t\.phase==="warn"\)\{ if\(!t\.warnPlayed\)\{ t\.warnPlayed=true; AudioSys\.play\("warn_drop"\); \} if\(lt>=DROP_WARN\)\{ t\.phase="fall"; \} \}/,
      to: 'if(t.phase==="warn"){ if(lt>=DROP_WARN){ t.phase="fall"; AudioSys.play("warn_drop"); } }' },
    { re: /if\(t\.phase==="warn"\)\{ if\(!t\.warnPlayed\)\{ t\.warnPlayed=true; AudioSys\.play\("warn_press"\); \} if\(t\.t>=PRESS_WARN\)\{ t\.phase="slam"; \} \}/,
      to: 'if(t.phase==="warn"){ if(t.t>=PRESS_WARN){ t.phase="slam"; AudioSys.play("warn_press"); } }' },
  ] },
  { id: "M12", tool: "verify-w41-knock.cjs", anchor: "W41K.1", edits: [
    { re: /if\(world\.t-\(world\.wallReplyT\|\|0\)>1\.5\)\{ world\.wallReplyT=world\.t; Narr\.fire\("wall_touch"\); \} /, to: "" },
  ] },
];
function parse(txt) {
  const failIds = []; let summary = "";
  for (const ln of txt.split(/\r?\n/)) {
    const m = ln.match(/^\[FAIL\]\s+(G\d+[^\s]*|P\d+[^\s]*|W41[A-Z]\.\d+[a-z]?)\s/);
    if (m) failIds.push(m[1]);
    if (/^---- 汇总/.test(ln)) summary = ln.trim();
  }
  return { failIds, summary };
}
fs.mkdirSync(OUT, { recursive: true });
let bad = 0;
for (const m of MUTS) {
  const dir = path.join(OUT, m.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(ROOT, "index.html"), path.join(dir, "index.html"));
  fs.cpSync(path.join(ROOT, "assets"), path.join(dir, "assets"), { recursive: true });
  const src = fs.readFileSync(path.join(ROOT, "game.js"), "utf8");
  let why = null;
  for (const e of m.edits) {
    const hits = (src.match(new RegExp(e.re.source, "g")) || []).length;
    if (hits !== 1) { why = "命中 " + hits + " ≠ 1"; break; }
  }
  if (why) { console.log("[" + m.id + "] UNABLE（" + why + "）"); bad++; continue; }
  let mutant = src;
  for (const e of m.edits) mutant = mutant.replace(e.re, e.to);
  fs.writeFileSync(path.join(dir, "game.js"), mutant);
  const url = "file:///" + dir.replace(/\\/g, "/") + "/index.html";
  const env = Object.assign({}, process.env, { CHAITAI_URL: url });
  if (m.tool === "gate-10-final.cjs") {
    env.CHAITAI_SHOT_PREFIX = "smk-" + m.id + "-";
    if (m.seg) env.CHAITAI_G10_SEG = "1"; else delete env.CHAITAI_G10_SEG;
  } else {
    env.CHAITAI_SHOT_PREFIX = path.join(dir, "probe-" + m.id);
    delete env.CHAITAI_G10_SEG;
  }
  const r = spawnSync(process.execPath, [path.join(ROOT, "tools", m.tool)],
    { cwd: ROOT, env, encoding: "utf8", timeout: 1200000, maxBuffer: 64 * 1024 * 1024 });
  const txt = (r.stdout || "") + (r.stderr || "");
  fs.writeFileSync(path.join(dir, "smoke.txt"), txt);
  const p = parse(txt);
  const rc = (r.status === null) ? "KILL" : r.status;
  const inRed = p.failIds.indexOf(m.anchor) >= 0;
  const ok = rc !== 0 && inRed;
  console.log("[" + m.id + "] rc=" + rc + " 红=(" + (p.failIds.join(",") || "无") + ") 锚 " + m.anchor
    + (inRed ? " 命中" : " 未中") + " ｜ " + p.summary + "  ⇒ " + (ok ? "SMOKE-OK" : "SMOKE-BAD"));
  if (!ok) bad++;
}
console.log("---- 冒烟汇总：" + (bad ? ("BAD " + bad) : "全 OK") + "（正式判定以 suite 内 falsify-g10 为准）----");
process.exit(bad ? 1 : 0);
