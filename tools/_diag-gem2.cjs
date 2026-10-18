/* _diag-gem2.cjs —— 一次性诊断（非闸）：分离「灯块」与「ZONE 其余」的 luma 时序，
   判定 G11.9=3.2 是「灯没画/不动」还是「区内反相抵消」。只读。 */
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
  const gl = await page.evaluate(() => ({ RIG: typeof RIG, ik2: typeof ik2, P: typeof P }));
  console.log("globals=" + JSON.stringify(gl));

  const anim = await page.evaluate(() => new Promise(res => {
    const cv = document.getElementById("cv"), g = cv.getContext("2d"), k = cv.width / 960;
    const Z = [Math.round(290 * k), Math.round(452 * k), Math.round(13 * k), Math.round(14 * k)];       /* ZONE */
    const B = [Math.round(293.5 * k), Math.round(457 * k), Math.round(6 * k), Math.round(7 * k)];       /* 灯块（几何预测 294.5-298.5×458.3-462.3 外扩 1px） */
    const out = []; let n = 0;
    function mean(rect) { const d = g.getImageData(rect[0], rect[1], rect[2], rect[3]).data; let s = 0;
      for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3; return s / (d.length / 4); }
    function tick() {
      const zone = mean(Z), blk = mean(B);
      let rt = -1; try { rt = RIG.t; } catch (e) { }
      let tool = -1; try { tool = RIG.tool; } catch (e) { }
      out.push([zone, blk, rt, tool]);
      if (++n < 130) requestAnimationFrame(tick); else res({ k: k, out: out, cvw: cv.width });
    }
    requestAnimationFrame(tick);
  }));
  const zs = anim.out.map(r => r[0]), bs = anim.out.map(r => r[1]);
  const mm = a => [Math.min.apply(null, a), Math.max.apply(null, a)];
  console.log("cvWidth=" + anim.cvw + " k=" + anim.k);
  console.log("ZONE full mean  min/max=" + mm(zs).map(v => v.toFixed(2)).join("/") + " range=" + (Math.max.apply(null, zs) - Math.min.apply(null, zs)).toFixed(2));
  console.log("gemBlock mean   min/max=" + mm(bs).map(v => v.toFixed(2)).join("/") + " range=" + (Math.max.apply(null, bs) - Math.min.apply(null, bs)).toFixed(2));
  console.log("RIG.t first/last=" + anim.out[0][2] + "/" + anim.out[129][2] + " tool first/last=" + anim.out[0][3] + "/" + anim.out[129][3]);
  console.log("zone series(每10帧)=" + zs.filter((_, i) => i % 10 === 0).map(v => v.toFixed(1)).join(","));
  console.log("blk series(每10帧)=" + bs.filter((_, i) => i % 10 === 0).map(v => v.toFixed(1)).join(","));
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
