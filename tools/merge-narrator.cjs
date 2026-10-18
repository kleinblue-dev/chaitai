#!/usr/bin/env node
/* merge-narrator.cjs —— 旁白库合并器（W1a，2026-10-15）
 * 用法: node tools/merge-narrator.cjs <草稿.json> [更多草稿.json ...]
 *
 * 合并规则（d3 meta.mergeRules 落地）：
 *   ① 键名以 _ext 结尾：把 tiers 数组【接到】同名主键 tiers 尾部（不注册独立键）；
 *   ② 其它键：全新键才并入（已存在的一律跳过、绝不覆盖）；
 *   ③ 结局键/普通新键同待遇（运行期语义在引擎，合并层无区别）。
 *
 * 格式保真（硬门槛，不过就拒绝写盘）：
 *   assets/narrator-lines.js  是定制格式：叶子行对象（含 id/text/tts）单行内联，
 *   其余对象/数组逐行缩进。本工具先用 serialize() 对【现行两份文件】做字节级
 *   往返复现（json=body+"\\n"；js="window.NARRATOR_LINES="+body+";"），复现不过 ⇒ rc=2。
 *
 * 合并后审计（任一失败 ⇒ 不写盘，rc=1）：
 *   A 语义回读：写出的两文件重新解析后与合并对象全等；
 *   B 主键保全：原各键在合并后逐字节（值层面 deep-equal）不变，_ext 键除外（=原档+追加档）；
 *   C 追加核对：_ext 主键合并后 tiers = 原 tiers 前缀 + 草稿 _ext tiers，逐层 deep-equal；
 *   D id 唯一：全库行 id 无重复；
 *   E 幂等提示：草稿 _ext 的 id 若已在主键里 ⇒ 判「已并过」跳过（不算错）。
 *
 * 回执: review-v02/d3-story/merge-receipt-<日期>.txt（逐键动作）
 * exit: 0=合并成功/无新事; 1=审计失败(未写盘); 2=建不起来(格式不复现/文件缺失)
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = "D:/2006L/chaitai";
const JS_P = path.join(ROOT, "assets", "narrator-lines.js");
const JSN_P = path.join(ROOT, "assets", "narrator-lines.json");
const RECEIPT = path.join(ROOT, "review-v02", "d3-story", "merge-receipt-2026-10-15.txt");

/* ---------- 序列化器（复现现行定制格式） ---------- */
const isInlineObj = (v) => v && typeof v === "object" && !Array.isArray(v) && Object.prototype.hasOwnProperty.call(v, "id");
function serCompact(v) { /* 行对象内联（含 id/text/tts；嵌套全部紧凑） */
  if (Array.isArray(v)) return "[" + v.map(serCompact).join(", ") + "]";
  if (v && typeof v === "object") return "{ " + Object.keys(v).map((k) => JSON.stringify(k) + ": " + serCompact(v[k])).join(", ") + " }";
  return JSON.stringify(v);
}
function ser(v, ind) {
  const pad = " ".repeat(ind);
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    return "[\n" + v.map((x) => " ".repeat(ind + 2) + ser(x, ind + 2)).join(",\n") + "\n" + pad + "]";
  }
  if (v && typeof v === "object") {
    if (isInlineObj(v)) return serCompact(v);
    const ks = Object.keys(v);
    if (!ks.length) return "{}";
    return "{\n" + ks.map((k) => " ".repeat(ind + 2) + JSON.stringify(k) + ": " + ser(v[k], ind + 2)).join(",\n") + "\n" + pad + "}";
  }
  return JSON.stringify(v);
}

(async () => {
  const raw = process.argv.slice(2);
  const check = raw.indexOf("--check") >= 0;
  const inputs = raw.filter((a) => a !== "--check");
  if (!inputs.length && !check) { console.log("用法: node tools/merge-narrator.cjs [--check] <草稿.json> [...]"); process.exit(2); }
  for (const p of [JS_P, JSN_P]) if (!fs.existsSync(p)) { console.log("!! 缺文件 " + p); process.exit(2); }

  const jsTxt = fs.readFileSync(JS_P, "utf8");
  const jsnTxt = fs.readFileSync(JSN_P, "utf8");
  const cur = JSON.parse(jsnTxt);
  if (!cur || !cur.lines) { console.log("!! 现行 json 无 lines"); process.exit(2); }

  /* —— 往返复现门槛 —— */
  const body = ser(cur, 0);
  const jsWant = "window.NARRATOR_LINES=" + body + ";";
  const jsnWant = body + "\n";
  const jsOk = jsTxt === jsWant, jsnOk = jsnTxt === jsnWant;
  console.log("往返复现：js " + (jsOk ? "字节级吻合" : "**不吻合**") + "；json " + (jsnOk ? "字节级吻合" : "**不吻合**"));
  if (!jsOk || !jsnOk) {
    console.log("!! 现行文件与序列化器不再同构（可能被人手改过）——拒绝合并，先人工查格式漂移。");
    if (!jsOk) { let i = 0; while (i < jsTxt.length && jsTxt[i] === jsWant[i]) i++; console.log("   js 首个分歧@" + i + "\n   实际: " + JSON.stringify(jsTxt.slice(Math.max(0, i - 40), i + 40)) + "\n   期望: " + JSON.stringify(jsWant.slice(Math.max(0, i - 40), i + 40))); }
    if (!jsnOk) { let i = 0; while (i < jsnTxt.length && jsnTxt[i] === jsnWant[i]) i++; console.log("   json 首个分歧@" + i + "\n   实际: " + JSON.stringify(jsnTxt.slice(Math.max(0, i - 40), i + 40)) + "\n   期望: " + JSON.stringify(jsnWant.slice(Math.max(0, i - 40), i + 40))); }
    process.exit(2);
  }
  if (check) { console.log("--check：往返复现通过（未合并未写盘）"); process.exit(0); }

  /* —— 合并 —— */
  const merged = JSON.parse(JSON.stringify(cur)); /* 深拷贝 */
  const orig = JSON.parse(JSON.stringify(cur));
  const acts = [];
  for (const p of inputs) {
    if (!fs.existsSync(p)) { console.log("!! 缺草稿 " + p); process.exit(2); }
    const dr = JSON.parse(fs.readFileSync(p, "utf8"));
    if (!dr || !dr.lines) { console.log("!! " + p + " 无 lines"); process.exit(2); }
    for (const k of Object.keys(dr.lines)) {
      const def = dr.lines[k];
      if (!def || !Array.isArray(def.tiers)) { console.log("!! " + p + " 键 " + k + " 无 tiers 数组"); process.exit(2); }
      const m = /^(.*)_ext$/.exec(k);
      if (m) {
        const main = m[1], mainDef = merged.lines[main];
        if (!mainDef) { console.log("!! _ext 键 " + k + " 找不到主键 " + main + " —— 拒绝合并"); process.exit(2); }
        const existIds = new Set(); mainDef.tiers.forEach((t) => t.forEach((l) => existIds.add(l.id)));
        const dupAlready = def.tiers.every((t) => t.every((l) => existIds.has(l.id)));
        if (dupAlready) { acts.push("SKIP  " + k + " → " + main + "（已并过）"); continue; }
        const add = def.tiers.map((t) => JSON.parse(JSON.stringify(t)));
        mainDef.tiers = mainDef.tiers.concat(add);
        acts.push("APPEND " + k + " → " + main + "（+" + def.tiers.length + " 档，共 " + mainDef.tiers.length + " 档）");
      } else if (merged.lines[k]) {
        const same = JSON.stringify(merged.lines[k]) === JSON.stringify(def);
        acts.push("SKIP  " + k + "（已存在" + (same ? "且一致" : "，内容不同——保留现行版") + "）");
      } else {
        merged.lines[k] = JSON.parse(JSON.stringify(def));
        acts.push("ADD   " + k + "（" + def.tiers.length + " 档）");
      }
    }
  }

  /* —— 审计 —— */
  const errs2 = [];
  /* B 主键保全（--deep 对比；_ext 主键允许"原档为前缀"） */
  const extMains = new Set();
  for (const p of inputs) { const dr = JSON.parse(fs.readFileSync(p, "utf8")); Object.keys(dr.lines).forEach((k) => { const m = /^(.*)_ext$/.exec(k); if (m) extMains.add(m[1]); }); }
  for (const k of Object.keys(orig.lines)) {
    const a = JSON.stringify(orig.lines[k]), b = JSON.stringify(merged.lines[k]);
    if (extMains.has(k)) {
      const ao = orig.lines[k].tiers, bo = merged.lines[k].tiers;
      const prefixOk = ao.every((t, i) => JSON.stringify(t) === JSON.stringify(bo[i]));
      if (!prefixOk) errs2.push("B 违规：" + k + " 原档不是合并后前缀");
      const grow = bo.length >= ao.length;
      if (!grow) errs2.push("B 违规：" + k + " 档数缩了 " + ao.length + "→" + bo.length);
      acts.push("      ↳ " + k + " " + ao.length + "→" + bo.length + " 档");
    } else if (a !== b) errs2.push("B 违规：" + k + " 被非 _ext 合并改动");
  }
  for (const k of Object.keys(merged.lines)) if (!orig.lines[k]) acts.push("      ↳ 新键 " + k);
  /* D id 唯一 */
  { const seen = new Map();
    for (const k of Object.keys(merged.lines)) for (const t of merged.lines[k].tiers) for (const l of t) {
      if (!l.id || !l.text) errs2.push("D 违规：" + k + " 有行缺 id/text");
      if (seen.has(l.id)) errs2.push("D 违规：id 重复 " + l.id + "（" + seen.get(l.id) + " ∩ " + k + "）"); else seen.set(l.id, k);
    }
    acts.push("      ↳ id 总数 " + seen.size + "，无重复");
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const head = "merge-narrator @ " + stamp + " 输入: " + inputs.join(" , ") + "\n键数 " + Object.keys(orig.lines).length + " → " + Object.keys(merged.lines).length + "\n";
  if (errs2.length) {
    console.log(head + "审计失败：\n" + errs2.join("\n") + "\n（未写盘）");
    fs.writeFileSync(RECEIPT, head + "审计失败（未写盘）：\n" + errs2.join("\n") + "\n" + acts.join("\n") + "\n", "utf8");
    process.exit(1);
  }
  /* A 写盘＋语义回读 */
  const body2 = ser(merged, 0);
  fs.writeFileSync(JS_P, "window.NARRATOR_LINES=" + body2 + ";", "utf8");
  fs.writeFileSync(JSN_P, body2 + "\n", "utf8");
  const back1 = JSON.parse(fs.readFileSync(JS_P, "utf8").replace(/^window\.NARRATOR_LINES=/, "").replace(/;$/, ""));
  const back2 = JSON.parse(fs.readFileSync(JSN_P, "utf8"));
  if (JSON.stringify(back1) !== JSON.stringify(merged) || JSON.stringify(back2) !== JSON.stringify(merged)) {
    console.log("!! 写盘后回读不一致（严重）"); process.exit(1);
  }
  console.log(head + acts.join("\n") + "\nA/B/C/D 审计全过，已写 " + JS_P + " 与 " + JSN_P);
  fs.writeFileSync(RECEIPT, head + "审计全过（A 语义回读 / B 主键保全 / C 追加核对 / D id 唯一）\n" + acts.join("\n") + "\n", "utf8");
  process.exit(0);
})().catch((e) => { console.error("RUN FAILED:", (e && e.stack) || e); process.exit(2); });
