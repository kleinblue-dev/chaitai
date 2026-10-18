/* falsify-g12.cjs —— 证伪框架（W5 收口 C5）：对全链检查点的三个测点做定点破坏，证明 gate-12-chain 真在测它们。
   变异（M1–M3，锚定 game.js 实测行号）：
     M1 挡 a1_e2（CP_MAP enc 分支 i-1≠="a1_e2" 才记）⇒ cpLog 少 1 条（27）；锚 G12.1（全序逐项失配）
     M2 禁 act*_open（open 分支不调用 setCp）⇒ 缺 act2/3/4_open；锚 G12.1
     M3 setCp 内 wave1 双记（注入 push）⇒ 29 条＋重复 wave1；锚 G12.2（无重复破）
     M4 删 a3_break 直调（wall_break 后不记）⇒ 缺 1 条；锚 G12.1（直调类代表——配 M1/M2 共覆盖
        「任一 setCp 删除必红」的三类调用形态：CP_MAP enc／open／直调；余下直调点同型）
   流程（照 falsify-g11 框架）：正本先跑（live 树）——rc≠0 ⇒ 全案判不出（exit 2）；每变异：副本目录
   shots/falsify-g12/<id>/（index.html＋变异 game.js＋assets 拷贝）→ node --check 变异体 → 锚点命中数
   pre-flight（≠want ⇒ 判不出）→ 跑 gate-12-chain（CHAITAI_URL 指向副本、CHAITAI_SHOT_PREFIX 指向副本目录）
   → 副本绿 ⇒ BAD；锚不在红明细 ⇒ BAD；全过 ⇒ OK。
   跑法：node tools/falsify-g12.cjs   （env：CHAITAI_ONLY=M2 单变异过滤） */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.resolve(__dirname, "..");
const SHOTS = path.join(ROOT, "shots");
const OUT = path.join(SHOTS, "falsify-g12");

const MUTS = [
  { id: "M1", desc: "挡 a1_e2（CP_MAP enc 分支 i-1==\"a1_e2\" 时不记）", want: 1, anchor: "G12.1",
    re: /var cpm=CP_MAP\[a\]; if\(cpm&&cpm\.enc\[i-1\]\)setCp\(cpm\.enc\[i-1\]\);/,
    to: "var cpm=CP_MAP[a]; if(cpm&&cpm.enc[i-1]&&cpm.enc[i-1]!==\"a1_e2\")setCp(cpm.enc[i-1]);" },
  { id: "M2", desc: "禁 act*_open（CP_MAP open 分支不调用 setCp）", want: 1, anchor: "G12.1",
    re: /var cpm=CP_MAP\[n\]; if\(cpm&&cpm\.open\)setCp\(cpm\.open\);/,
    to: "var cpm=CP_MAP[n]; if(cpm&&cpm.open)void 0;" },
  { id: "M3", desc: "setCp 内 wave1 双记（注入 push ⇒ 29 条＋重复）", want: 1, anchor: "G12.2",
    re: /world\.cp=id; L\.push\(\{id:id,t:\+world\.t\.toFixed\(2\)\}\);/,
    to: "world.cp=id; L.push({id:id,t:+world.t.toFixed(2)}); if(id===\"wave1\")L.push({id:\"wave1\",t:0});" },
  { id: "M4", desc: "删 a3_break 直调（wall_break 后不记）", want: 1, anchor: "G12.1",
    re: /Narr\.fire\("wall_break"\); setCp\("a3_break"\); \} \}/,
    to: "Narr.fire(\"wall_break\"); } }" },
];

function parse(txt) {
  const failIds = []; let nPass = 0; let gateLine = "";
  for (const ln of txt.split(/\r?\n/)) {
    const m = ln.match(/^\[FAIL\]\s+(G\d+[^\s]*)\s/);
    if (m) failIds.push(m[1]);
    if (/^\[PASS\]/.test(ln)) nPass++;
    if (!gateLine && /^---- 汇总/.test(ln)) gateLine = ln.trim();
  }
  return { failIds, nPass, gateLine };
}

function runProbe(url, tag, outdir, killerMs) {
  const txtFile = path.join(outdir, "gate-on-" + tag + ".txt");
  const env = Object.assign({}, process.env, {
    CHAITAI_URL: url,
    CHAITAI_SHOT_PREFIX: outdir,   /* gate-12 语义：截图目录（path.join(dir, PFX+后缀.png)）⇒ 不覆盖 shots/gate-12 */
  });
  const r = spawnSync(process.execPath, [path.join(ROOT, "tools", "gate-12-chain.cjs")], {
    cwd: ROOT, env, encoding: "utf8", timeout: killerMs || 900000, maxBuffer: 64 * 1024 * 1024 });
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
    if (g.rc === 0) { verdict = "BAD 副本绿了——'" + m.desc + "' 破坏没被 gate-12 抓出（锚 " + m.anchor + " 未红）"; bad++; }
    else if (!inRed) { verdict = "BAD 虽红但锚 " + m.anchor + " 不在红明细（实测红=" + g.failIds.join(",") + "）——破坏被别处误伤盖过"; bad++; }
    else { verdict = "OK 红且锚中：" + m.anchor + "（红 " + g.failIds.length + " 项：" + g.failIds.join(",") + "）"; ok++; }
    console.log("[" + m.id + "] " + m.desc + "\n   " + verdict + "  rc=" + g.rc + " → " + g.txtFile);
    fs.writeFileSync(path.join(dir, "verdict.txt"), verdict + "\n" + g.gateLine);
  }
  const sum = "falsify-g12 汇总：OK " + ok + " / BAD " + bad + " / 判不出 " + unable + "（共 " + MUTS.filter(x => !only || x.id === only).length + " 变异）\n" + liveSum.join("\n");
  console.log("---- " + sum + " ----");
  fs.writeFileSync(path.join(OUT, "verdict.txt"), sum + "\n" + MUTS.map(m => m.id + " " + m.desc).join("\n"));
  process.exit(bad || unable ? 1 : 0);
})().catch(e => { console.error("RUN FAILED:", (e && e.stack) || e); process.exit(2); });
