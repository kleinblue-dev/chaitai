/* _diag-gem3.cjs —— 一次性诊断（非闸）：全屏找「呼吸灯」——(a) 最强 cyan 块 bbox
   (b) 全屏逐像素 luma 脉冲幅度 top 像素坐标（灯=唯一脉冲 cyan 圆）。只读。 */
const puppeteer = require("D:/2006L/personal-site/node_modules/puppeteer-core");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files", "--mute-audio"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on("pageerror", e => console.log("PAGEERR", String(e)));
  await page.goto("file:///D:/2006L/chaitai/index.html");
  await page.keyboard.press("Enter");
  for (let i = 0; i < 40; i++) { const s = await page.evaluate(() => window.__game.state()).catch(() => null); if (s && s.phase === "playing") break; await sleep(200); }
  await page.evaluate(() => { const d = window.__game.debug; d.setDust(0); d.setEmber(0); d.setShadow(false); d.setPlayerX(300); });
  await sleep(800);

  const r = await page.evaluate(() => new Promise(res => {
    const cv = document.getElementById("cv"), g = cv.getContext("2d");
    const X0 = 250, Y0 = 390, W = 90, H = 85;    /* 窗口：世界 x250-340、y390-475（含玩家全身+手） */
    let prev = null; const acc = {}; let frames = 0;
    let bestCyan = { cnt: 0, box: null };
    function tick() {
      const d = g.getImageData(X0, Y0, W, H).data;
      let cnt = 0, minx = 1e9, maxx = -1, miny = 1e9, maxy = -1, peak = 0;
      for (let i = 0; i < W * H; i++) {
        const j = i * 4, rr = d[j], gg = d[j + 1], b = d[j + 2];
        /* 强 cyan（呼吸灯峰值特征色 #7df9ff 高 α） */
        if (gg >= 170 && b >= 200 && rr <= 140) { cnt++; const x = i % W, y = (i / W) | 0;
          if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
          if (gg + b > peak) peak = gg + b; }
        if (prev) { const p = (rr + gg + b) / 3, q = prev[i]; const dd = Math.abs(p - q);
          if (dd > 12) { const x = i % W, y = (i / W) | 0; const kk = x + "," + y;
            const e = acc[kk] || (acc[kk] = { max: 0, n: 0 }); if (dd > e.max) e.max = dd; e.n++; } }
      }
      if (cnt > bestCyan.cnt) bestCyan = { cnt: cnt, box: [minx + X0, miny + Y0, maxx + X0, maxy + Y0], peak: peak };
      const cur = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) { const j = i * 4; cur[i] = (d[j] + d[j + 1] + d[j + 2]) / 3; }
      prev = cur; frames++;
      if (frames < 60) requestAnimationFrame(tick); else {
        const top = Object.keys(acc).map(k => { const xy = k.split(","); return { x: +xy[0] + X0, y: +xy[1] + Y0, max: acc[k].max, n: acc[k].n }; })
          .sort((a, b) => b.max * b.n - a.max * a.n).slice(0, 12);
        res({ bestCyan: bestCyan, top: top });
      }
    }
    requestAnimationFrame(tick);
  }));
  console.log("bestCyan cnt=" + r.bestCyan.cnt + " peak=" + r.bestCyan.peak + " boxWorld=" + JSON.stringify(r.bestCyan.box));
  console.log("pulseTop(x,y,maxΔ,n):");
  r.top.forEach(t => console.log("  " + t.x + "," + t.y + "  maxΔ=" + t.max.toFixed(0) + " n=" + t.n));
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
