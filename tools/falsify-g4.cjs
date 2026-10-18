#!/usr/bin/env node
/* 拆台 · 证伪 G4 —— 让副本里的"砌墙"永不触发 ⇒ gate-4 必须见红（正本必须见绿）。
 *
 * 真文件（index.html＋game.js）只读；把两样＋assets/ 复制到 shots/falsify-g4/，
 * **只变异副本里的 game.js**，从副本目录加载 index.html 跑 gate-4。
 *
 * 变异候选（按"越贴近'砌墙永不触发'越优先"）：
 *   M1  把 defyLeft 的大小/≥/> 阈值抬到 9999（计数永远够不着 ⇒ pendingWall 永不置位）
 *   M1b 把 defyLeft 的 ==/=== 阈值抬到 9999
 *   M2  删掉 wall_build 的播报调用（若墙是"按播报键驱动"的架构，连升起一起死）
 *   M2b 删掉带参的 wall_build 调用
 *   M3  把带引号 'wall_build' 改名（最弱：只保证播报键消失）
 * 取第一个命中的；实际用哪个写进报告。
 *
 * 判定：正本 gate-4 绿 ＋ 副本红、且红里含 G4.6（wall.built）或 G4.7（log wall_build）⇒ 成立 rc=0。
 *       副本还绿，或红里没有这两个 ⇒ 失败 rc=1。正本自己红 / 锚点全不中 ⇒ 判不出 rc=2。
 * exit：0=证伪成立；1=证伪失败；2=建不起来/判不出
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = "D:/2006L/chaitai";
const SRC_HTML = path.join(ROOT, "index.html");
const SRC_JS = path.join(ROOT, "game.js");
const SRC_ASSETS = path.join(ROOT, "assets");
const OUTDIR = path.join(ROOT, "shots", "falsify-g4");
const GATE = path.join(ROOT, "tools", "gate-4-defy-wall.cjs");
const EXPECT_ANY = ["G4.6", "G4.7"]; // 墙没砌起来（built）/ 没播报（wall_build）

const MUTS = [
  { id: "M1", desc: "defyLeft 的 >= / > 阈值抬到 9999（砌墙阈值永远够不着）",
    re: /\bdefyLeft\b(\s*(?:>=|>)\s*)\d+/g, to: (m, p1) => "defyLeft" + p1 + "9999" },
  { id: "M1b", desc: "defyLeft 的 == / === 阈值抬到 9999",
    re: /\bdefyLeft\b(\s*(?:===|==)\s*)\d+/g, to: (m, p1) => "defyLeft" + p1 + "9999" },
  { id: "M2", desc: "删掉 wall_build 播报调用：foo(\"wall_build\") → void 0",
    re: /([A-Za-z_$][\w$.]*)\s*\(\s*(["'`])wall_build\2\s*\)/g, to: "void 0" },
  { id: "M2b", desc: "删掉带额外参数的调用：foo(\"wall_build\", …) → void 0",
    re: /([A-Za-z_$][\w$.]*)\s*\(\s*(["'`])wall_build\2\s*,[^()]*\)/g, to: "void 0" },
  { id: "M3", desc: "把带引号的 'wall_build' 字面量整体改名",
    re: /(["'`])wall_build\1/g, to: "$1wall_build_off$1" },
];

(async () => {
  console.log("== falsify-g4：副本让砌墙永不触发 ⇒ gate-4 必须红 ==");
  if (!fs.existsSync(SRC_HTML) || !fs.existsSync(SRC_JS)) {
    console.log("!! 正本不全（index.html 或 game.js 不存在）—— 证伪实验建不起来");
    process.exit(2);
  }
  const srcHtml = fs.readFileSync(SRC_HTML, "utf8");
  const srcJs = fs.readFileSync(SRC_JS, "utf8");

  let mut = null;
  for (const m of MUTS) {
    const hits = (srcJs.match(m.re) || []).length;
    if (hits >= 1) { mut = Object.assign({}, m, { hits }); break; }
  }
  if (!mut) {
    console.log("!! 五个变异锚点都没命中 game.js —— 这份证伪建不起来（实现形式和预期不同，要人工看源码）");
    process.exit(2);
  }
  const mutantJs = srcJs.replace(mut.re, mut.to);
  if (mutantJs === srcJs) { console.log("!! 变异后与原文相同 —— 锚点无效"); process.exit(2); }
  console.log("   变异=" + mut.id + "（" + mut.desc + "），命中 " + mut.hits + " 处");

  fs.mkdirSync(OUTDIR, { recursive: true });
  fs.writeFileSync(path.join(OUTDIR, "index.html"), srcHtml, "utf8");
  fs.writeFileSync(path.join(OUTDIR, "game.js"), mutantJs, "utf8");
  if (fs.existsSync(SRC_ASSETS)) fs.cpSync(SRC_ASSETS, path.join(OUTDIR, "assets"), { recursive: true });
  fs.writeFileSync(path.join(OUTDIR, "mutation.txt"),
    "变异 " + mut.id + "：" + mut.desc + "\n命中 " + mut.hits + " 处（只改副本 " + OUTDIR + "/game.js；真文件未动）\n", "utf8");

  const runGate = (url, tag) => new Promise((resolve) => {
    const child = spawn(process.execPath, [GATE], {
      env: Object.assign({}, process.env, { CHAITAI_URL: url, CHAITAI_SHOT_PREFIX: "falsify-g4-" + tag + "-" }),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let txt = "";
    child.stdout.on("data", (d) => { txt += d; });
    child.stderr.on("data", (d) => { txt += d; });
    const killer = setTimeout(() => { console.log("  !! " + tag + " 超 300s，掐掉"); try { child.kill(); } catch (e) {} }, 300000);
    child.on("close", (code) => {
      clearTimeout(killer);
      fs.writeFileSync(path.join(OUTDIR, "gate-on-" + tag + ".txt"), txt, "utf8");
      resolve({ rc: code, txt });
    });
  });
  const parse = (txt) => ({
    failIds: (txt.match(/\[FAIL\]\s+(\S+)/g) || []).map((x) => x.replace(/\[FAIL\]\s+/, "")),
    nPass: (txt.match(/\[PASS\]/g) || []).length,
    gateLine: (txt.match(/^GATE .*$/m) || ["(没有 GATE 行)"])[0],
  });

  const pristine = await runGate("file:///D:/2006L/chaitai/index.html", "pristine");
  const pp = parse(pristine.txt);
  console.log("—— 第 1 轮（正本）：rc=" + pristine.rc + "  PASS " + pp.nPass + " 条  " + pp.gateLine);

  const mutRun = await runGate("file:///D:/2006L/chaitai/shots/falsify-g4/index.html", "mutant");
  const mm = parse(mutRun.txt);
  console.log("—— 第 2 轮（变异副本）：rc=" + mutRun.rc + "  PASS " + mm.nPass + " 条  FAIL=[" + mm.failIds.join(" ") + "]");
  console.log("   " + mm.gateLine);

  let rc = 0;
  if (pristine.rc !== 0) {
    console.log("   [!!] 正本 gate-4 本身就是红的（rc=" + pristine.rc + "，FAIL=[" + pp.failIds.join(" ") + "]）⇒ 两版都红，判不出「闸抓的是不是砌墙」——先把正本修绿再跑本证伪。");
    rc = 2;
  } else {
    const hitWall = mm.failIds.filter((x) => EXPECT_ANY.indexOf(x) >= 0);
    if (mutRun.rc === 0) {
      console.log("   [BAD] 副本砌墙永不触发居然还绿 —— gate-4 的墙断言是瞎的");
      rc = 1;
    } else if (!hitWall.length) {
      console.log("   [BAD] 副本红了，但红里没有 " + EXPECT_ANY.join("/") + " —— 红在别处，不能算数");
      rc = 1;
    } else {
      console.log("   红在 " + hitWall.join("+") + "（墙没砌起来 / 没播报）上，正是掐掉砌墙该红的地方。");
    }
    const extra = mm.failIds.filter((x) => EXPECT_ANY.indexOf(x) < 0);
    if (extra.length) console.log("   [warn] 除墙两条外还有连带红：" + extra.join(" ") + "（变异副作用，值得看一眼）");
  }
  fs.writeFileSync(path.join(OUTDIR, "verdict.txt"),
    (rc === 0 ? "证伪成立" : rc === 1 ? "证伪失败" : "判不出") + "（变异 " + mut.id + "，" + mut.hits + " 处）\n", "utf8");
  console.log(rc === 0 ? "=> 证伪成立：正本绿、副本红、且红在砌墙该红的地方。"
    : rc === 1 ? "=> 证伪失败（见上）。" : "=> 判不出（见上）。");
  process.exit(rc);
})().catch((e) => { console.error("RUN FAILED:", (e && e.stack) || e); process.exit(2); });
