/* falsify-g10.cjs —— 证伪框架（v0.2 W4）：对 gate-10-final 用的终幕接线做 N 处定点破坏，
   证明每处破坏都让 gate-10 出红（want 锚点命中数恰 1，防「变异没接上」与「多处误伤」）。
   变异（M1–M12，全部锚在 W4/W4.1 接线点；段模式跑、M1 走完整模式验真入口）：
     M1 ACTS[5].stage playable→planned（完整模式：真入口按 J 进不去终幕；锚 G10.P）
     M2 删终幕 plats 行（终幕没有台箱 ⇒ 断言红；锚 G10.1b）
     M3 删 startAct 尾 Boss 入场 schedule（Boss 永不出现；锚 G10.2）
     M4 删 setCp("a4_p3")（p3 检查点断；锚 G10.6）
     M5 删 setCp("a4_p2")（p2 检查点断；锚 G10.5）
     M6 删 setCp("a4_down")（defeat 检查点断；锚 G10.8）
     M7 删结局 d 分支（敲九下不再解锁隐藏结局；锚 G10.15c）
     M8 结局 a 条件反转 deaths===0 → deaths>0（一条过不再触发 a；锚 G10.10）
     M9 删墙压 y 带门（player.y>420 ⇒ 站台上也吃墙压；锚 G10.11）
     —— W4.1 A 批增补（M10–M12；payload 探针按变异指定：gate-10 段模式／verify-w41-audio／verify-w41-knock）——
     M10 A1 整串删：openSpare 还原旧 phase 直退＋删 respawn 尾补开（死窗吞开窗重现；锚 G10.18）
     M11 A3 回退：drop/press 预警音还原到 warn 末播（音前量 0→0.7/0.9s；锚 W41A.2）
     M12 A4 回退：删敲墙 echo fire（敲门不再有回声；锚 W41K.1）
   流程：正本先跑（live 树）——rc≠0 ⇒ 全案判不出（exit 2）；每变异：副本目录 shots/falsify-g10/<id>/
   （index.html＋变异 game.js＋assets 拷贝）→ 锚点命中数 pre-flight（≠want ⇒ 判不出）→ 跑 payload 探针（默认 gate-10-final；rc 收集）
   → 副本绿 ⇒ BAD（该破坏没被测出）；锚不在红明细里 ⇒ BAD；全过 ⇒ OK。
   跑法：node tools/falsify-g10.cjs   （env：CHAITAI_SHOT_PREFIX 可改；单变异过滤 CHAITAI_ONLY=M3） */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.resolve(__dirname, "..");
const SHOTS = path.join(ROOT, "shots");
const OUT = path.join(SHOTS, "falsify-g10");
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MUTS = [
  { id: "M1", desc: "ACTS[5].stage playable→planned（真入口按 J 进不去）", want: 1, seg: false, anchor: "G10.P",
    re: /stage:"playable",card:"终幕 · 杀青"/, to: 'stage:"planned",card:"终幕 · 杀青"' },
  { id: "M2", desc: "删终幕 plats 行（T1/T2/T3 无台箱）", want: 1, anchor: "G10.1b",
    re: / plats:\[\{x:300,y:420,w:64,h:50\},\{x:500,y:390,w:64,h:80\},\{x:780,y:300,w:96,h:170\}\], \/\* W4：终幕＝第一幕全布局[^\n]*\n/, to: "" }, /* 锚＝act5 行尾 W4 注释（裸 plats 三元组在 act1 也出现 ⇒ 必须带注释唯一定位；预检 0 中修） */
  { id: "M3", desc: "删 startAct 尾 Boss 入场 schedule（Boss 不放）", want: 1, anchor: "G10.2",
    re: /if\(A\.boss\)schedule\(2\.0,function\(\)\{ if\(world\.act===n&&world\.arena!=="boss"&&!boss\.active\)spawnBoss\(\); \}\); */, to: "" },
  { id: "M4", desc: '删 setCp("a4_p3")（p3 检查点断）', want: 1, anchor: "G10.6",
    re: /setCp\("a4_p3"\); */, to: "" },
  { id: "M5", desc: '删 setCp("a4_p2")（p2 检查点断）', want: 1, anchor: "G10.5",
    re: /setCp\("a4_p2"\); */, to: "" },
  { id: "M6", desc: '删 setCp("a4_down")（defeat 检查点断）', want: 1, anchor: "G10.8",
    re: /setCp\("a4_down"\); */, to: "" },
  { id: "M7", desc: "删结局 d 分支（敲九下不解锁）", want: 1, anchor: "G10.15c",
    re: /if\(world\.wallHits>=9\)return "end_d";\n */, to: "" },
  { id: "M8", desc: "结局 a 条件反转 deaths===0→deaths>0", want: 1, anchor: "G10.10",
    re: /if\(world\.deaths===0\)return "end_a";/, to: 'if(world.deaths>0)return "end_a";' },
  { id: "M9", desc: "删墙压 y 带门 player.y>420（台上也吃压）", want: 1, anchor: "G10.11",
    re: /if\(!t\.hit&&player\.y>420&&Math\.abs\(player\.x-t\.x\)<PRESS_HALF\)\{/, to: "if(!t.hit&&Math.abs(player.x-t.x)<PRESS_HALF){" },
  /* —— W4.1 A 批增补锚（M10–M12）：把 A 批修复回退 ⇒ 对应断言必红 —— */
  { id: "M10", desc: "A1 整串删：openSpare 还原旧 phase 直退＋删 respawn 尾补开（死窗吞开窗重现）", seg: true, anchor: "G10.18",
    edits: [
      { re: / if\(world\.phase==="dead"\)\{ schedule\(0\.5,openSpare\); return; \} \/\* W4\.1（A1）：boss_defeat→开窗的 2\.2s 死亡窗 ⇒ 重试（复活尾补开见 respawn） \*\/\n/, to: "" },
      { re: /if\(boss\.active&&boss\.dead&&!world\.spare&&!world\.ending\)openSpare\(\); /, to: "" },
    ] },
  { id: "M11", desc: "A3 回退：drop/press 预警音还原到 warn 末播（音前量 0→0.7/0.9s）", tool: "verify-w41-audio.cjs", anchor: "W41A.2",
    edits: [
      { re: /if\(t\.phase==="warn"\)\{ if\(!t\.warnPlayed\)\{ t\.warnPlayed=true; AudioSys\.play\("warn_drop"\); \} if\(lt>=DROP_WARN\)\{ t\.phase="fall"; \} \}/,
        to: 'if(t.phase==="warn"){ if(lt>=DROP_WARN){ t.phase="fall"; AudioSys.play("warn_drop"); } }' },
      { re: /if\(t\.phase==="warn"\)\{ if\(!t\.warnPlayed\)\{ t\.warnPlayed=true; AudioSys\.play\("warn_press"\); \} if\(t\.t>=PRESS_WARN\)\{ t\.phase="slam"; \} \}/,
        to: 'if(t.phase==="warn"){ if(t.t>=PRESS_WARN){ t.phase="slam"; AudioSys.play("warn_press"); } }' },
    ] },
  { id: "M12", desc: "A4 回退：删敲墙回声 fire（敲门不再有回声）", tool: "verify-w41-knock.cjs", anchor: "W41K.1",
    re: /if\(world\.t-\(world\.wallReplyT\|\|0\)>1\.5\)\{ world\.wallReplyT=world\.t; Narr\.fire\("wall_touch"\); \} /, to: "" },
];

function parse(txt) {
  const failIds = []; let nPass = 0; let gateLine = "";
  for (const ln of txt.split(/\r?\n/)) {
    const m = ln.match(/^\[FAIL\]\s+(G\d+[^\s]*|P\d+[^\s]*|W41[A-Z]\.\d+[a-z]?)\s/);
    if (m) failIds.push(m[1]);
    if (/^\[PASS\]/.test(ln)) nPass++;
    if (/^GATE gate-10-final:/.test(ln)) gateLine = ln.trim();
    if (!gateLine && /^---- 汇总/.test(ln)) gateLine = ln.trim();
  }
  return { failIds, nPass, gateLine };
}

function runProbe(url, tag, outdir, seg, killerMs, tool) {
  tool = tool || "gate-10-final.cjs";
  const txtFile = path.join(outdir, "gate-on-" + tag + ".txt");
  const env = Object.assign({}, process.env, { CHAITAI_URL: url });
  if (tool === "gate-10-final.cjs") {
    env.CHAITAI_SHOT_PREFIX = "f10-" + tag + "-";
    if (seg) env.CHAITAI_G10_SEG = "1"; else delete env.CHAITAI_G10_SEG;
  } else {
    env.CHAITAI_SHOT_PREFIX = path.join(outdir, "probe-" + tag); /* w41 探针把前缀当全路径前缀用（非 shots/ 拼接） */
    delete env.CHAITAI_G10_SEG;
  }
  const r = spawnSync(process.execPath, [path.join(ROOT, "tools", tool)], {
    cwd: ROOT, env, encoding: "utf8", timeout: killerMs || 1200000, maxBuffer: 64 * 1024 * 1024 });
  const txt = (r.stdout || "") + (r.stderr || "");
  fs.writeFileSync(txtFile, txt);
  const rc = (r.status === null) ? "KILL" : r.status;
  return { rc, ...parse(txt), txtFile };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let bad = 0, unable = 0, ok = 0;
  const only = process.env.CHAITAI_ONLY || "";
  const liveSum = [];
  /* —— 0) 正本先跑（完整模式，live 树）——判不出防线 —— */
  console.log("== 正本（live 树 · 完整模式）==");
  const base = runProbe("file:///" + ROOT.replace(/\\/g, "/") + "/index.html", "live-full", OUT, false);
  console.log("   " + base.gateLine + " rc=" + base.rc + " PASS=" + base.nPass + " FAIL=" + base.failIds.length);
  if (base.rc !== 0 || !/PASS/.test(base.gateLine)) {
    console.log("!! 正本不绿 ⇒ 证伪判不出（先修 live 树）"); process.exit(2); }
  liveSum.push("live-full rc=0 " + base.gateLine);
  /* 段模式正本（falsify 变异主要跑段模式） */
  console.log("== 正本（live 树 · 段模式）==");
  const baseSeg = runProbe("file:///" + ROOT.replace(/\\/g, "/") + "/index.html", "live-seg", OUT, true);
  console.log("   " + baseSeg.gateLine + " rc=" + baseSeg.rc + " PASS=" + baseSeg.nPass + " FAIL=" + baseSeg.failIds.length);
  if (baseSeg.rc !== 0 || !/PASS/.test(baseSeg.gateLine)) {
    console.log("!! 段模式正本不绿 ⇒ 证伪判不出"); process.exit(2); }
  liveSum.push("live-seg rc=0 " + baseSeg.gateLine);

  /* —— 逐变异 —— */
  for (const m of MUTS) {
    if (only && m.id !== only) continue;
    const dir = path.join(OUT, m.id);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    /* 副本 = index.html + 变异 game.js + assets 拷贝（edits＝多段编辑；逐段 pre-flight 命中数） */
    fs.copyFileSync(path.join(ROOT, "index.html"), path.join(dir, "index.html"));
    fs.cpSync(path.join(ROOT, "assets"), path.join(dir, "assets"), { recursive: true });
    const src = fs.readFileSync(path.join(ROOT, "game.js"), "utf8");
    const edits = m.edits || [{ re: m.re, to: m.to, want: m.want }];
    let unableWhy = null;
    for (const e of edits) {
      const w = (e.want == null) ? 1 : e.want;
      const hits = (src.match(new RegExp(e.re.source, "g")) || []).length;
      if (hits !== w) { unableWhy = "锚点命中 " + hits + " ≠ want " + w; break; }
    }
    if (unableWhy) {
      console.log("[" + m.id + "] " + m.desc + "\n   " + unableWhy + " ⇒ 判不出（变异没接上）");
      fs.writeFileSync(path.join(dir, "verdict.txt"), "UNABLE " + unableWhy);
      unable++; continue;
    }
    let mutant = src;
    for (const e of edits) mutant = mutant.replace(e.re, e.to);
    fs.writeFileSync(path.join(dir, "game.js"), mutant);
    const url = "file:///" + dir.replace(/\\/g, "/") + "/index.html";
    const g = runProbe(url, m.id, dir, m.seg, null, m.tool);
    const inRed = g.failIds.indexOf(m.anchor) >= 0;
    let verdict;
    if (g.rc === 0) { verdict = "BAD 副本绿了——'" + m.desc + "' 破坏没被 gate-10 抓出（锚 " + m.anchor + " 未红）"; bad++; }
    else if (!inRed) { verdict = "BAD 虽红但锚 " + m.anchor + " 不在红明细（实测红=" + g.failIds.join(",") + "）——破坏被别处误伤盖过"; bad++; }
    else { verdict = "OK 红且锚中：" + m.anchor + "（红 " + g.failIds.length + " 项：" + g.failIds.join(",") + "）"; ok++; }
    console.log("[" + m.id + "] " + m.desc + "\n   " + verdict + "  rc=" + g.rc + " → " + g.txtFile);
    fs.writeFileSync(path.join(dir, "verdict.txt"), verdict + "\n" + g.gateLine);
  }
  const sum = "falsify-g10 汇总：OK " + ok + " / BAD " + bad + " / 判不出 " + unable + "（共 " + MUTS.filter(x => !only || x.id === only).length + " 变异）\n" + liveSum.join("\n");
  console.log("---- " + sum + " ----");
  fs.writeFileSync(path.join(OUT, "verdict.txt"), sum + "\n" + MUTS.map(m => m.id + " " + m.desc).join("\n"));
  process.exit(bad || unable ? 1 : 0);
})().catch(e => { console.error("RUN FAILED:", (e && e.stack) || e); process.exit(2); });
