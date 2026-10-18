/* falsify-g15.cjs —— 证伪框架（W7）：对精英五测点做定点破坏，证明 gate-15-elite 真在测它们。
   变异（M1–M5，锚文本与 W7 在 game.js 落下的实现逐字同步；pre-flight 命中数 ≠want ⇒ 判不出）。
   预注册表＝w7-edits.md §0「falsify-g15 变异预注册」逐字：
     M1 霸体关   `if(e.kind!=="elite"){e.state="hit"; e.t=0; e.struck=true;}` → `{e.state="hit"; e.t=0; e.struck=true;}`（删前缀保后缀）⇒ 预期红 C、D（F1 修订为 C、D、E，见文末）
     M2 双挥关   `(e.chain|0)<1` → `(e.chain|0)<0` ⇒ 预期红 G
     M3 身份色换 `color:"#ffb040"` → `color:"#ffcf7a"` ⇒ 预期红 I
     M4 struck 泄漏 同 M1 锚 → `if(e.kind!=="elite"){e.state="hit"; e.t=0;}e.struck=true;` ⇒ 预期红 D
     M5 风压关   `e.x+=e.dir*e.spd*0.6*dt` → `e.x+=e.dir*e.spd*0*dt` ⇒ 预期红 M
   （M1 与 M4 同锚不同替换，各跑一趟；M1 预期同时红 C/D 属预注册行为。判据＝预期红全中 且
    无预期外红；任一不满足 ⇒ BAD。判不出（语法坏/锚缺失/钩子缺失）单独计数，不得混作 OK。）
   锚点对「改后树」（W7 落码后）成立；落码前跑 ⇒ M2/M5 锚缺失 ⇒ 判不出（设计行为，非失败）。
   流程（照 falsify-g14 框架）：正本先跑（live 树）——rc≠0 ⇒ 全案判不出（exit 2）；每变异：副本目录
   shots/falsify-g15/<id>/（index.html＋变异 game.js＋assets 拷贝）→ node --check 变异体 → 锚点命中数
   pre-flight（≠want ⇒ 判不出）→ 跑 gate-15-elite（CHAITAI_URL 指向副本、CHAITAI_SHOT_PREFIX 指向副本目录）
   → 副本绿 ⇒ BAD；预期红未全中 ⇒ BAD；有预期外红 ⇒ BAD；全过 ⇒ OK。
   「恢复后正常」＝live 树即未变异对照（正本先跑绿）＋全案前后 md5(live game.js) 双钉（必须相同）。
   跑法：node tools/falsify-g15.cjs   （env：CHAITAI_ONLY=M2 单变异过滤）
   F1（10-17 J 步首跑后；本文件唯一修订项）：M1 预期红集 {C,D} → {C,D,E}（运行时 expect 数组已改；
     上方预注册表原文逐字留档未动，w7-edits.md §0 原文亦未动）。理由：M1 删 applyHit（game.js:402）
     的 kind 守卫 ⇒ 精英受击态由 rec 被覆盖为 hit ⇒ E 行（rec 中受击后仰位移）的协议前提被该变异
     直接破坏 ⇒ E 红是 M1 的真检测，非污染、非仪器噪声（M1 副本实读：E 行 受击 Δ=0.0px 背离=false；
     两次独立运行稳定复现）。判据规则（预期红全中 ∧ 无预期外红）与其余四变异预期一字未动；差异
     在 W7.4 报告「与方案冲突记录」节披露（预注册值 {C,D}、实修值 {C,D,E}、证据、因果链）。 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const ROOT = path.resolve(__dirname, "..");
const SHOTS = path.join(ROOT, "shots");
const OUT = path.join(SHOTS, "falsify-g15");
const GATE = path.join(ROOT, "tools", "gate-15-elite.cjs");

const MUTS = [
  { id: "M1", desc: "霸体关（精英进受击态，删守前缀保后缀）", want: 1, expect: ["G15.C", "G15.D", "G15.E"], /* F1：{C,D}→{C,D,E} */
    re: /if\(e\.kind!=="elite"\)\{e\.state="hit"; e\.t=0; e\.struck=true;\}/,
    to: "e.state=\"hit\"; e.t=0; e.struck=true;" },
  { id: "M2", desc: "双挥关（chain 条件恒假，P2 不二挥）", want: 1, expect: ["G15.G"],
    re: /\(e\.chain\|0\)<1/,
    to: "(e.chain|0)<0" },
  { id: "M3", desc: "身份色换（EKIND 色误置 glow 值）", want: 1, expect: ["G15.I"],
    re: /color:"#ffb040"/,
    to: "color:\"#ffcf7a\"" },
  { id: "M4", desc: "struck 泄漏（受击置 struck=true 无守卫）", want: 1, expect: ["G15.D"],
    re: /if\(e\.kind!=="elite"\)\{e\.state="hit"; e\.t=0; e\.struck=true;\}/,
    to: "if(e.kind!==\"elite\"){e.state=\"hit\"; e.t=0;}e.struck=true;" },
  { id: "M5", desc: "风压关（wind 推进系数 0.6→0）", want: 1, expect: ["G15.M"],
    re: /e\.x\+=e\.dir\*e\.spd\*0\.6\*dt/,
    to: "e.x+=e.dir*e.spd*0*dt" },
];

const md5 = (p) => crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex");

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
  const r = spawnSync(process.execPath, [GATE], {
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
  const liveMd5Before = md5(path.join(ROOT, "game.js"));
  console.log("live game.js md5(before) = " + liveMd5Before);
  /* —— 0) 正本先跑（live 树）——判不出防线 —— */
  console.log("== 正本（live 树）==");
  const base = runProbe("file:///" + ROOT.replace(/\\/g, "/") + "/index.html", "live", OUT);
  console.log("   " + base.gateLine + " rc=" + base.rc + " PASS=" + base.nPass + " FAIL=" + base.failIds.length);
  if (base.rc !== 0 || !/PASS/.test(base.gateLine)) {
    console.log("!! 正本不绿 ⇒ 证伪判不出（先修 live 树/先落 W7 码）"); process.exit(2); }
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
    const missing = m.expect.filter(x => g.failIds.indexOf(x) < 0);
    const extras = g.failIds.filter(x => m.expect.indexOf(x) < 0);
    let verdict;
    if (g.rc === 0) { verdict = "BAD 副本绿了——'" + m.desc + "' 破坏没被 gate-15 抓出（预期红 " + m.expect.join(",") + " 全未红）"; bad++; }
    else if (missing.length) { verdict = "BAD 预期红未全中：缺 " + missing.join(",") + "（实测红=" + g.failIds.join(",") + "）"; bad++; }
    else if (extras.length) { verdict = "BAD 预期外红：" + extras.join(",") + "（预期=" + m.expect.join(",") + "）"; bad++; }
    else { verdict = "OK 预期红全中：" + m.expect.join(",") + "，无预期外红（共红 " + g.failIds.length + " 项）"; ok++; }
    console.log("[" + m.id + "] " + m.desc + "\n   " + verdict + "  rc=" + g.rc + " → " + g.txtFile);
    fs.writeFileSync(path.join(dir, "verdict.txt"), verdict + "\n" + g.gateLine);
  }
  const liveMd5After = md5(path.join(ROOT, "game.js"));
  const md5Ok = (liveMd5Before === liveMd5After);
  console.log("live game.js md5(after)  = " + liveMd5After + (md5Ok ? "（一致：live 树未被本案触碰）" : " !! 不一致——live 树被动过！"));
  const sum = "falsify-g15 汇总：OK " + ok + " / BAD " + bad + " / 判不出 " + unable +
    "（共 " + MUTS.filter(x => !only || x.id === only).length + " 变异）· live md5 " + (md5Ok ? "双钉一致" : "不一致!!") + "\n" + liveSum.join("\n");
  console.log("---- " + sum + " ----");
  fs.writeFileSync(path.join(OUT, "verdict.txt"), sum + "\n" + MUTS.map(m => m.id + " " + m.desc + " 预期红:" + m.expect.join(",")).join("\n"));
  process.exit((bad || unable || !md5Ok) ? 1 : 0);
})().catch(e => { console.error("RUN FAILED:", (e && e.stack) || e); process.exit(2); });
