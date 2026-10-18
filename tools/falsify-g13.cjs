/* falsify-g13.cjs —— 证伪框架（W5.3）：对动态表现力四个测点做定点破坏，证明 gate-13-dynamics 真在测它们。
   变异（M1–M4，re/to 与 Phase 4 在 game.js 落下的实现文本逐字同步；pre-flight 锚点命中数 ≠want ⇒ 判不出）：
     M1 删出招残影 push（updAttack 挥击帧 pushGhost "atk" 行）⇒ 两击均无残影；锚 G13.1
     M2 禁 qiSpawn 体（首行早退）⇒ 剑气永不出现；锚 G13.5（预期连带 G13.6/G13.7/G13.13）
     M3 顿帧上限回落（applyHit step3 cap 0.15→0.12）⇒ maxHit ≤0.12；锚 G13.8（预期连带 G13.10）
     M4 删居合分支（updPlayer iaiW 消费 ⇒ dash+J 变普通攻击）；锚 G13.11（预期连带 G13.12）
   流程（照 falsify-g12 框架）：正本先跑（live 树）——rc≠0 ⇒ 全案判不出（exit 2）；每变异：副本目录
   shots/falsify-g13/<id>/（index.html＋变异 game.js＋assets 拷贝）→ node --check 变异体 → 锚点命中数
   pre-flight（≠want ⇒ 判不出）→ 跑 gate-13-dynamics（CHAITAI_URL 指向副本、CHAITAI_SHOT_PREFIX 指向副本目录）
   → 副本绿 ⇒ BAD；锚不在红明细 ⇒ BAD；全过 ⇒ OK。
   跑法：node tools/falsify-g13.cjs   （env：CHAITAI_ONLY=M2 单变异过滤） */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.resolve(__dirname, "..");
const SHOTS = path.join(ROOT, "shots");
const OUT = path.join(SHOTS, "falsify-g13");

const MUTS = [
  { id: "M1", desc: "删出招残影 push（两击均无残影）", want: 1, anchor: "G13.1",
    re: /a\.swung=true; pushGhost\(P\.x,P\.y,P\.facing,"atk"\); spawnSlashFx/,
    to: "a.swung=true; spawnSlashFx" },
  { id: "M2", desc: "禁 qiSpawn（剑气永不出现）", want: 1, anchor: "G13.5",
    re: /function qiSpawn\(\)\{ var P=player;/,
    to: "function qiSpawn(){ if(true)return; var P=player;" },
  { id: "M3", desc: "顿帧上限回落（step3 cap 0.15→0.12）", want: 1, anchor: "G13.8",
    re: /\(o\.step===3\?0\.15:0\.12\)/,
    to: "(0.12)" },
  { id: "M4", desc: "删居合分支（dash+J 变普通攻击）", want: 1, anchor: "G13.11",
    re: /if\(P\.iaiW>0&&!P\.atk&&justDown\(ATKK\)\)\{ iaido\(\); P\.iaiW=0; \} else if\(justDown\(ATKK\)\)P\.atkBuf=0\.14;/,
    to: "if(justDown(ATKK))P.atkBuf=0.14;" },
];

function parse(txt) {
  const failIds = []; let nPass = 0; let gateLine = "";
  for (const ln of txt.split(/\r?\n/)) {
    const m = ln.match(/^\s*\[FAIL\]\s+(G\d+[^\s]*)\s/);
    if (m) failIds.push(m[1]);
    if (/^\s*\[PASS\]/.test(ln)) nPass++; /* 仪器级修复：gate-13 的 item() 输出带两空格缩进（gate-12 是行首无缩进，故 g12 版锚原样迁移失效）；锚加 \s* 容缩进，判据/阈值/裁决逻辑零改动 */
    if (!gateLine && /^---- 汇总/.test(ln)) gateLine = ln.trim();
  }
  return { failIds, nPass, gateLine };
}

function runProbe(url, tag, outdir, killerMs) {
  const txtFile = path.join(outdir, "gate-on-" + tag + ".txt");
  const env = Object.assign({}, process.env, {
    CHAITAI_URL: url,
    CHAITAI_SHOT_PREFIX: outdir,   /* gate-13 语义：截图目录（fs 直落该目录）⇒ 不覆盖 shots/gate-13 */
  });
  const r = spawnSync(process.execPath, [path.join(ROOT, "tools", "gate-13-dynamics.cjs")], {
    cwd: ROOT, env, encoding: "utf8", timeout: killerMs || 300000, maxBuffer: 64 * 1024 * 1024 });
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
  /* —— 0) 正本先跑（live 树）——判不出防线 —— */
  console.log("== 正本（live 树）==");
  const base = runProbe("file:///" + ROOT.replace(/\\/g, "/") + "/index.html", "live", OUT);
  console.log("   " + base.gateLine + " rc=" + base.rc + " PASS=" + base.nPass + " FAIL=" + base.failIds.length);
  if (base.rc !== 0 || !/PASS/.test(base.gateLine)) {
    console.log("!! 正本不绿 ⇒ 证伪判不出（先修 live 树）"); process.exit(2); }
  liveSum.push("live rc=0 " + base.gateLine);

  /* —— 逐变异 —— */
  for (const m of MUTS) {
    if (only && m.id !== only) continue;
    const dir = path.join(OUT, m.id);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
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
    const chk = spawnSync(process.execPath, ["--check", path.join(dir, "game.js")], { encoding: "utf8" });
    if (chk.status !== 0) {
      console.log("[" + m.id + "] " + m.desc + "\n   变异体语法坏 ⇒ 判不出：" + (chk.stderr || "").split("\n")[0]);
      fs.writeFileSync(path.join(dir, "verdict.txt"), "UNABLE 变异体语法坏");
      unable++; continue;
    }
    const url = "file:///" + dir.replace(/\\/g, "/") + "/index.html";
    const g = runProbe(url, m.id, dir);
    const inRed = g.failIds.indexOf(m.anchor) >= 0;
    let verdict;
    if (g.rc === 0) { verdict = "BAD 副本绿了——'" + m.desc + "' 破坏没被 gate-13 抓出（锚 " + m.anchor + " 未红）"; bad++; }
    else if (!inRed) { verdict = "BAD 虽红但锚 " + m.anchor + " 不在红明细（实测红=" + g.failIds.join(",") + "）——破坏被别处误伤盖过"; bad++; }
    else { verdict = "OK 红且锚中：" + m.anchor + "（红 " + g.failIds.length + " 项：" + g.failIds.join(",") + "）"; ok++; }
    console.log("[" + m.id + "] " + m.desc + "\n   " + verdict + "  rc=" + g.rc + " → " + g.txtFile);
    fs.writeFileSync(path.join(dir, "verdict.txt"), verdict + "\n" + g.gateLine);
  }
  const sum = "falsify-g13 汇总：OK " + ok + " / BAD " + bad + " / 判不出 " + unable + "（共 " + MUTS.filter(x => !only || x.id === only).length + " 变异）\n" + liveSum.join("\n");
  console.log("---- " + sum + " ----");
  fs.writeFileSync(path.join(OUT, "verdict.txt"), sum + "\n" + MUTS.map(m => m.id + " " + m.desc).join("\n"));
  process.exit(bad || unable ? 1 : 0);
})().catch(e => { console.error("RUN FAILED:", (e && e.stack) || e); process.exit(2); });
