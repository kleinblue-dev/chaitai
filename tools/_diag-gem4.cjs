/* _diag-gem4.cjs —— 一次性诊断（非闸）：(a) hook ctx.arc 统计 r=2.8/1.0 调用；
   (b) 同帧手动画测试圆读像素（验证坐标可达/无覆盖层）。只读补丁（页面内存内，不落盘）。 */
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
  await sleep(600);

  await page.evaluate(() => {
    const proto = CanvasRenderingContext2D.prototype, orig = proto.fill;
    window.__arcLog = [];
    proto.fill = function () {
      if (this.fillStyle === "#7df9ff" && this.globalAlpha > 0.15) {
        /* 呼吸灯 fill（全页唯一 #7df9ff fill）：先画、立即读回 */
        const r = orig.apply(this, arguments);
        if (window.__arcLog.length < 60) {
          const m = this.getTransform();
          let px = null;
          try {
            const cv = this.canvas, k = cv.width / 960;
            /* 灯心局部 (−3.5,−8.8) ⇒ 世界 (e−3.5, f−8.8)：读 (e−6,f−11) 起 4×4，中心≈灯心 */
            const d = this.getImageData(Math.round((m.e - 6)) * k, Math.round((m.f - 11)) * k, 4, 4).data;
            px = [d[24], d[25], d[26]];
          } catch (e) { px = "ERR"; }
          window.__arcLog.push([+this.globalAlpha.toFixed(3), +m.e.toFixed(1), +m.f.toFixed(1), px]);
        }
        return r;
      }
      return orig.apply(this, arguments);
    };
  });
  await sleep(500);
  const arcLog = await page.evaluate(() => window.__arcLog);
  console.log("arcLog n=" + arcLog.length + " sample=" + JSON.stringify(arcLog.slice(0, 10)));

  const test = await page.evaluate(() => {
    const cv = document.getElementById("cv"), g = cv.getContext("2d");
    /* 同帧手动测试圆（品红明显色）：灯几何预测点 */
    g.save(); g.globalAlpha = 1; g.fillStyle = "#ff00ff";
    g.beginPath(); g.arc(296.5, 460.3, 3, 0, Math.PI * 2); g.fill(); g.restore();
    const d = g.getImageData(293, 457, 8, 8).data;
    let mag = 0, maxx = -1, minx = 99, maxy = -1, miny = 99;
    for (let i = 0; i < d.length; i += 4) { if (d[i] > 180 && d[i + 2] > 180 && d[i + 1] < 120) { mag++; const x = i / 4 % 8, y = (i / 4 / 8) | 0; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; } }
    /* 顺带读该区未画圆前的底（重画一帧后） */
    return { mag: mag, box: mag ? [minx + 293, miny + 457, maxx + 293, maxy + 457] : null };
  });
  console.log("manualTestCircle mag=" + test.mag + " boxWorld=" + JSON.stringify(test.box));
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
