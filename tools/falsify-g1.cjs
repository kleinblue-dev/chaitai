#!/usr/bin/env node
/* 拆台 · 证伪 G1 —— 把"game_start 播报"从副本里掐掉 ⇒ gate-1 必须见红（正本必须见绿）。
 *
 * 布局（主会话 2026-10-13 拆分）：真文件＝index.html（壳）+ game.js（逻辑）+ assets/。
 * 本脚本只读真文件；把三样一起复制到 shots/falsify-g1/，**只变异副本里的 game.js**，
 * 从副本目录加载 index.html 跑 gate-1。
 *
 * 判定（两个方向都看）：
 *   正本 gate-1 绿 ＋ 副本 gate-1 红、且红里包含 G1.7（"log 含 game_start"）⇒ 证伪成立 rc=0。
 *   副本还绿，或红了但 G1.7 不在红里（红在别处）⇒ 证伪失败 rc=1。
 *   正本自己就红（游戏坏了），或三个变异锚点都没命中（建不起来）⇒ 判不出 rc=2。
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
const OUTDIR = path.join(ROOT, "shots", "falsify-g1");
const GATE = path.join(ROOT, "tools", "gate-1-load.cjs");
const EXPECT_FAIL = "G1.7"; // gate-1 里"log 含触发键 'game_start'"那条

/* 变异候选（越贴近"删掉播报"越优先），取第一个命中的 */
const MUTS = [
  { id: "M1", desc: "删掉 game_start 播报调用：foo(\"game_start\") → void 0",
    re: /([A-Za-z_$][\w$.]*)\s*\(\s*(["'`])game_start\2\s*\)/g, to: "void 0" },
  { id: "M1b", desc: "删掉带额外参数的调用：foo(\"game_start\", …) → void 0",
    re: /([A-Za-z_$][\w$.]*)\s*\(\s*(["'`])game_start\2\s*,[^()]*\)/g, to: "void 0" },
  { id: "M2", desc: "把带引号的 'game_start' 字面量整体改名（全文件一致 ⇒ 不崩，只是 log 里没有这个键）",
    re: /(["'`])game_start\1/g, to: "$1game_start_off$1" },
];

(async () => {
  console.log("== falsify-g1：副本掐掉 game_start 播报 ⇒ gate-1 必须红 ==");
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
    console.log("!! 三个变异锚点都没命中 game.js —— 这份证伪建不起来（实现形式和预期不同，要人工看源码）");
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
      env: Object.assign({}, process.env, { CHAITAI_URL: url, CHAITAI_SHOT_PREFIX: "falsify-g1-" + tag + "-" }),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let txt = "";
    child.stdout.on("data", (d) => { txt += d; });
    child.stderr.on("data", (d) => { txt += d; });
    const killer = setTimeout(() => { console.log("  !! " + tag + " 超 240s，掐掉"); try { child.kill(); } catch (e) {} }, 240000);
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

  const mutRun = await runGate("file:///D:/2006L/chaitai/shots/falsify-g1/index.html", "mutant");
  const mm = parse(mutRun.txt);
  console.log("—— 第 2 轮（变异副本）：rc=" + mutRun.rc + "  PASS " + mm.nPass + " 条  FAIL=[" + mm.failIds.join(" ") + "]");
  console.log("   " + mm.gateLine);

  let rc = 0;
  if (pristine.rc !== 0) {
    console.log("   [!!] 正本 gate-1 本身就是红的（rc=" + pristine.rc + "，FAIL=[" + pp.failIds.join(" ") + "]）⇒ 两版都红，判不出「闸抓的是不是 game_start」——先把正本修绿再跑本证伪。");
    rc = 2;
  } else {
    if (mutRun.rc === 0) {
      console.log("   [BAD] 副本掐了播报居然还绿 —— gate-1 的 game_start 断言是瞎的");
      rc = 1;
    } else if (mm.failIds.indexOf(EXPECT_FAIL) < 0) {
      console.log("   [BAD] 副本红了，但红里没有 " + EXPECT_FAIL + " —— 红在别处，不能算数");
      rc = 1;
    } else {
      console.log("   红在 " + EXPECT_FAIL + "（log 含 game_start）这条上，正是掐掉播报该红的地方。");
    }
    const extra = mm.failIds.filter((x) => x !== EXPECT_FAIL);
    if (extra.length) console.log("   [warn] 除 " + EXPECT_FAIL + " 外还有连带红：" + extra.join(" ") + "（变异副作用，值得看一眼）");
  }
  fs.writeFileSync(path.join(OUTDIR, "verdict.txt"),
    (rc === 0 ? "证伪成立" : rc === 1 ? "证伪失败" : "判不出") + "（变异 " + mut.id + "，" + mut.hits + " 处）\n", "utf8");
  console.log(rc === 0 ? "=> 证伪成立：正本绿、副本红、且红在 game_start 那条。"
    : rc === 1 ? "=> 证伪失败（见上）。" : "=> 判不出（见上）。");
  process.exit(rc);
})().catch((e) => { console.error("RUN FAILED:", (e && e.stack) || e); process.exit(2); });
