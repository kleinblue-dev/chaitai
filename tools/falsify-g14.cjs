/* falsify-g14.cjs —— 证伪框架（W6.1）：对战斗闭环四个测点做定点破坏，证明 gate-14-damage 真在测它们。
   变异（M1–M4，re/to 与 W6.1 在 game.js 落下的实现文本逐字同步；pre-flight 锚点命中数 ≠want ⇒ 判不出）：
     M1 剑气伤害归零（QI_DMG=6→0）⇒ G14.1 Δ=0；锚 G14.1（预期连带 G14.2/G14.6）
     M2 删防重置位（updQi 命中块去 qi.hit[e.id]=1）⇒ 单次飞行多帧重复扣除；锚 G14.2（预期连带 G14.1/G14.6）
     M3 删居合刀身判定（刀身带条件恒假）⇒ 无 12 伤/iaidoN=0、随行剑气不再预标记；锚 G14.4
     M4 居合击退翻转（e.x>=P.x?1:-1 → ?-1:1）⇒ 受击态 vx 为负；锚 G14.5
       （仪器修订⑦后 vxMax 只采 state==="hit" 样本 ⇒ 敌方自身 strike 突进 lunge=400 不干扰判决）
   流程（照 falsify-g13 框架）：正本先跑（live 树）——rc≠0 ⇒ 全案判不出（exit 2）；每变异：副本目录
   shots/falsify-g14/<id>/（index.html＋变异 game.js＋assets 拷贝）→ node --check 变异体 → 锚点命中数
   pre-flight（≠want ⇒ 判不出）→ 跑 gate-14-damage（CHAITAI_URL 指向副本、CHAITAI_SHOT_PREFIX 指向副本目录）
   → 副本绿 ⇒ BAD；锚不在红明细 ⇒ BAD；全过 ⇒ OK。
   跑法：node tools/falsify-g14.cjs   （env：CHAITAI_ONLY=M2 单变异过滤） */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.resolve(__dirname, "..");
const SHOTS = path.join(ROOT, "shots");
const OUT = path.join(SHOTS, "falsify-g14");

const MUTS = [
  { id: "M1", desc: "剑气伤害归零（QI_DMG=6→0）", want: 1, anchor: "G14.1",
    re: /QI_DMG=6, IAI_DMG=12/,
    to: "QI_DMG=0, IAI_DMG=12" },
  { id: "M2", desc: "删防重置位（单次飞行多帧重复扣除）", want: 1, anchor: "G14.2",
    re: /qi\.hit\[e\.id\]=1; qiEmit\(12,e\.x,e\.y-26,1\.3\);/,
    to: "qiEmit(12,e.x,e.y-26,1.3);" },
  { id: "M3", desc: "删居合刀身判定（刀身带恒假）", want: 1, anchor: "G14.4",
    re: /if\(dx>-40&&dx<96&&Math\.abs\(dy\)<52\)\{ preHit\[e\.id\]=1; struckN\+\+;/,
    to: "if(false){ preHit[e.id]=1; struckN++;" },
  { id: "M4", desc: "居合击退翻转（受击态 vx 为负）", want: 1, anchor: "G14.5",
    re: /applyHit\(e,IAI_DMG,e\.x>=P\.x\?1:-1,\{kx:260,hs:0\.08,sh:0\.3,step:3\}\)/,
    to: "applyHit(e,IAI_DMG,e.x>=P.x?-1:1,{kx:260,hs:0.08,sh:0.3,step:3})" },
];

function parse(txt) {
  const failIds = []; let nPass = 0; let gateLine = "";
  for (const ln of txt.split(/\r?\n/)) {
    const m = ln.match(/^\s*\[FAIL\]\s+(G\d+[^\s]*)\s/);
    if (m) failIds.push(m[1]);
    if (/^\s*\[PASS\]/.test(ln)) nPass++;
    if (!gateLine && /^---- 汇总/.test(ln)) gateLine = ln.trim();
  }
  return { failIds, nPass, gateLine };
}

function runProbe(url, tag, outdir, killerMs) {
  const txtFile = path.join(outdir, "gate-on-" + tag + ".txt");
  const env = Object.assign({}, process.env, {
    CHAITAI_URL: url,
    CHAITAI_SHOT_PREFIX: outdir,
  });
  const r = spawnSync(process.execPath, [path.join(ROOT, "tools", "gate-14-damage.cjs")], {
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
    if (g.rc === 0) { verdict = "BAD 副本绿了——'" + m.desc + "' 破坏没被 gate-14 抓出（锚 " + m.anchor + " 未红）"; bad++; }
    else if (!inRed) { verdict = "BAD 虽红但锚 " + m.anchor + " 不在红明细（实测红=" + g.failIds.join(",") + "）——破坏被别处误伤盖过"; bad++; }
    else { verdict = "OK 红且锚中：" + m.anchor + "（红 " + g.failIds.length + " 项：" + g.failIds.join(",") + "）"; ok++; }
    console.log("[" + m.id + "] " + m.desc + "\n   " + verdict + "  rc=" + g.rc + " → " + g.txtFile);
    fs.writeFileSync(path.join(dir, "verdict.txt"), verdict + "\n" + g.gateLine);
  }
  const sum = "falsify-g14 汇总：OK " + ok + " / BAD " + bad + " / 判不出 " + unable + "（共 " + MUTS.filter(x => !only || x.id === only).length + " 变异）\n" + liveSum.join("\n");
  console.log("---- " + sum + " ----");
  fs.writeFileSync(path.join(OUT, "verdict.txt"), sum + "\n" + MUTS.map(m => m.id + " " + m.desc).join("\n"));
  process.exit(bad || unable ? 1 : 0);
})().catch(e => { console.error("RUN FAILED:", (e && e.stack) || e); process.exit(2); });
