/* 括号/引号配平扫描器（内部工具）：跳过字符串与注释，报告首个失配行。
   用途：game.js 批编辑后快速定位失衡点（node --check 只报末行，噪声大）。 */
const fs = require("fs");
const BS = String.fromCharCode(92);
const s = fs.readFileSync(process.argv[2], "utf8");
let line = 1, inS = 0, esc = false, inLC = false, inBC = false, stack = [];
for (let i = 0; i < s.length; i++) {
  const c = s[i];
  if (c === "\n") line++;
  if (inLC) { if (c === "\n") inLC = false; continue; }
  if (inBC) { if (c === "*" && s[i + 1] === "/") { inBC = false; i++; } continue; }
  if (inS) { if (esc) { esc = false; continue; } if (c === BS) { esc = true; continue; } if (c === inS) inS = 0; continue; }
  if (c === "/" && s[i + 1] === "/") { inLC = true; i++; continue; }
  if (c === "/" && s[i + 1] === "*") { inBC = true; i++; continue; }
  if (c === '"' || c === "'" || c === "`") { inS = c; continue; }
  if (c === "{" || c === "(" || c === "[") stack.push(c + "@" + line);
  else if (c === "}" || c === ")" || c === "]") {
    const m = { ")": "(", "]": "[", "}": "{" }[c];
    const o = stack.pop();
    if (!o || o[0] !== m) { console.log("MISMATCH close " + c + " at line " + line + " | open was " + o); }
  }
}
console.log("END depth " + stack.length + (stack.length ? " | last opens: " + stack.slice(-8).join(" ") : ""));
