/* falsify-g11.cjs —— 证伪框架（W5-1）：对剪影重设计的三个测点做定点破坏，证明 gate-11 真在测它们。
   变异（M1–M3，锚定 W5-1 落笔处）：
     M1 删双丝带（sss 置空 init:false 双胞胎）⇒ 金饰只剩头带 ≈11px；锚 G11.7（金<25）
        ＋预期连带 G11.8（金质心摆幅 →≈0 <3.0，因为头带静止）
     M2 删刀三笔＋护手三角＋护手芯灯（#eafcff/gcol 窗内全清）⇒ 亮刃≈0、灯没了；
        锚 G11.9（呼吸灯 <4.0）＋预期连带 G11.7（刃<15）
     M3 P 缩放 0.72：translate 后 scale(facing,1)→scale(facing*0.72,0.72) ⇒ 高 59→≈42.5；
        锚 G11.3（高 ∈[50,72] 破）
   流程：正本先跑（live 树）——rc≠0 ⇒ 全案判不出（exit 2）；每变异：副本目录 shots/falsify-g11/<id>/
   （index.html＋变异 game.js＋assets 拷贝）→ node --check 变异体 → 锚点命中数 pre-flight（≠want ⇒ 判不出）
   → 跑 gate-11（CHAITAI_SHOT_PREFIX 指向副本目录防覆盖绿侧出图）→ 副本绿 ⇒ BAD；锚不在红明细 ⇒ BAD；全过 ⇒ OK。
   跑法：node tools/falsify-g11.cjs   （env：CHAITAI_ONLY=M2 单变异过滤） */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.resolve(__dirname, "..");
const SHOTS = path.join(ROOT, "shots");
const OUT = path.join(SHOTS, "falsify-g11");

const MUTS = [
  { id: "M1", desc: "删双丝带（sss 置空 init:false）⇒ 金饰只剩头带", want: 1, anchor: "G11.7",
    re: /var sss=\[RIG\.sa,RIG\.sb\];/, to: "var sss=[{init:false},{init:false}];" },
  { id: "M2", desc: "删刀三笔＋护手三角＋护手芯灯（#eafcff/gcol 窗内全清）", want: 1, anchor: "G11.9",
    edits: [
      { re: / ctx\.globalAlpha=al\*0\.25; ctx\.strokeStyle=RIG\.gcol; ctx\.lineWidth=5;\n ctx\.beginPath\(\); ctx\.moveTo\(aw\.ex,aw\.ey\); ctx\.quadraticCurveTo\(mcx,mcy,tipx,tipy\); ctx\.stroke\(\);\n ctx\.globalAlpha=al; ctx\.strokeStyle="#0b1322"; ctx\.lineWidth=3\.0; ctx\.stroke\(\);\n ctx\.globalAlpha=al\*0\.95; ctx\.strokeStyle="#eafcff"; ctx\.lineWidth=1\.8; ctx\.stroke\(\);[^\n]*\n/, to: "" },
      { re: / ctx\.globalAlpha=al; ctx\.fillStyle="#0b1322"; ctx\.strokeStyle="#eafcff"; ctx\.lineWidth=0\.8;\n ctx\.beginPath\(\); ctx\.moveTo\(bbx-tdx\*2,bby-tdy\*2\); ctx\.lineTo\(bbx\+tdx\*2,bby\+tdy\*2\);\n ctx\.lineTo\(bbx\+bpx\*2\.6,bby\+bpy\*2\.6\); ctx\.closePath\(\); ctx\.fill\(\); ctx\.stroke\(\);\n/, to: "" },
      { re: / var gemx=bbx\+tdx\*1\.3, gemy=[^\n]*\n ctx\.globalAlpha=al\*gema; ctx\.fillStyle=RIG\.gcol;\n ctx\.beginPath\(\); ctx\.arc\(gemx,gemy,4\.5,0,Math\.PI\*2\); ctx\.fill\(\);\n ctx\.globalAlpha=al\*Math\.min\(1,gema\*1\.05\); ctx\.fillStyle="#eafcff";\n ctx\.beginPath\(\); ctx\.arc\(gemx,gemy,1\.6,0,Math\.PI\*2\); ctx\.fill\(\);\n/, to: "" },
    ] },
  { id: "M3", desc: "P 缩放 0.72（scale(facing,1)→scale(facing*0.72,0.72)）", want: 1, anchor: "G11.3",
    re: /ctx\.translate\(P\.x,P\.y\); ctx\.scale\(P\.facing,1\);/, to: "ctx.translate(P.x,P.y); ctx.scale(P.facing*0.72,0.72);" },
];

function parse(txt) {
  const failIds = []; let nPass = 0; let gateLine = "";
  for (const ln of txt.split(/\r?\n/)) {
    const m = ln.match(/^\[FAIL\]\s+(G\d+[^\s]*)\s/);
    if (m) failIds.push(m[1]);
    if (/^\[PASS\]/.test(ln)) nPass++;
    if (/^GATE gate-11-silhouette:/.test(ln)) gateLine = ln.trim();
    if (!gateLine && /^---- 汇总/.test(ln)) gateLine = ln.trim();
  }
  return { failIds, nPass, gateLine };
}

function runProbe(url, tag, outdir, killerMs) {
  const txtFile = path.join(outdir, "gate-on-" + tag + ".txt");
  const env = Object.assign({}, process.env, {
    CHAITAI_URL: url,
    CHAITAI_SHOT_PREFIX: path.join(outdir, "probe-" + tag + "-"),   /* 全路径前缀（gate-11 语义）⇒ 不覆盖 shots/sil-* */
  });
  const r = spawnSync(process.execPath, [path.join(ROOT, "tools", "gate-11-silhouette.cjs")], {
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
    if (g.rc === 0) { verdict = "BAD 副本绿了——'" + m.desc + "' 破坏没被 gate-11 抓出（锚 " + m.anchor + " 未红）"; bad++; }
    else if (!inRed) { verdict = "BAD 虽红但锚 " + m.anchor + " 不在红明细（实测红=" + g.failIds.join(",") + "）——破坏被别处误伤盖过"; bad++; }
    else { verdict = "OK 红且锚中：" + m.anchor + "（红 " + g.failIds.length + " 项：" + g.failIds.join(",") + "）"; ok++; }
    console.log("[" + m.id + "] " + m.desc + "\n   " + verdict + "  rc=" + g.rc + " → " + g.txtFile);
    fs.writeFileSync(path.join(dir, "verdict.txt"), verdict + "\n" + g.gateLine);
  }
  const sum = "falsify-g11 汇总：OK " + ok + " / BAD " + bad + " / 判不出 " + unable + "（共 " + MUTS.filter(x => !only || x.id === only).length + " 变异）\n" + liveSum.join("\n");
  console.log("---- " + sum + " ----");
  fs.writeFileSync(path.join(OUT, "verdict.txt"), sum + "\n" + MUTS.map(m => m.id + " " + m.desc).join("\n"));
  process.exit(bad || unable ? 1 : 0);
})().catch(e => { console.error("RUN FAILED:", (e && e.stack) || e); process.exit(2); });
