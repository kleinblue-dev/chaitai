/* 《拆台》v0.1.1 修复批验收探针 —— 主会话亲自跑（评审报告 §七 判据的可执行化）
 * 用法: node tools/verify-v011.cjs [index.html 绝对路径]
 *   默认: D:/2006L/chaitai/index.html
 *   证伪: node tools/verify-v011.cjs D:/2006L/chaitai/versions/v0.1.0/index.html
 * 纪律: 全程零钩子（不用 debug.*），只用真键盘/真按键事件 + state() 只读 + 画布像素。
 * V0 场景静态性前提（月亮质心不稳 ⇒ 此后所有震屏判定作废，如实 FAIL）
 * V1 地面冲刺：位移 ≥100px 且 dashing 被采样>0     （v0.1.0 预期红）
 * V2 索敌：站桩 6s 内敌主动出手（掉血 + wind 事件） （v0.1.0 预期红）
 * V3 地面受控一闪：perfDodges ≥1                    （v0.1.0 预期红）
 * V4 震屏归零：中击瞬间质心抖动>1.2px（正对照）＋战后 8s 回基线 （v0.1.0 预期红）
 * 附：真键从零打到通关（cleared=true）回执 + 死亡数
 */
const puppeteer = require('D:/2006L/personal-site/node_modules/puppeteer-core');
const fs = require('fs'); const crypto = require('crypto');
const TARGET = process.argv[2] || 'D:/2006L/chaitai/index.html';
const URL = 'file:///' + TARGET.replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const md5 = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
const root = TARGET.replace(/\\/g, '/').replace(/\/index\.html$/, '');

(async () => {
  console.log('== verify-v011 @', TARGET);
  console.log('== md5 index.html', md5(root + '/index.html'), '| game.js', md5(root + '/game.js'));
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--no-sandbox'] });
  const page = await b.newPage(); await page.setViewport({ width: 1440, height: 900 });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const results = [];
  const V = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} | ${name} | ${detail}`); };

  try {
    await page.goto(URL, { waitUntil: 'load' });
    await page.evaluate(() => {            // 安装只读探针（不触碰游戏内部）
      const cv = document.querySelector('canvas');
      window.__P = { moon: [], dash: [], wind: [], hits: [], prevHp: 100, ePrev: {}, dashOn: false, moonOn: false, moonUntil: 0 };
      const cent = () => {                 // 月亮 #16203a=(22,32,58) 质心（render 震屏 translate 内）
        const g = cv.getContext('2d'); const w = cv.width, h = cv.height;
        const d = g.getImageData(0, 0, w, h).data; let n = 0, x = 0, y = 0;
        for (let i = 0; i < d.length; i += 4) { if (d[i] === 22 && d[i + 1] === 32 && d[i + 2] === 58) { const k = i >> 2; x += k % w; y += (k / w) | 0; n++; } }
        return { x: +(x / n).toFixed(2), y: +(y / n).toFixed(2), n };
      };
      window.__P.cent = cent;
      (function loop() {
        const g = window.__game;
        if (g) {
          const st = g.state(); const now = performance.now();
          if (window.__P.dashOn) window.__P.dash.push({ t: now, x: st.player.x, d: st.player.dashing });
          if (window.__P.moonOn && now < window.__P.moonUntil) window.__P.moon.push({ t: now, c: cent() });
          st.enemies.forEach(e => { const pv = window.__P.ePrev[e.id];
            if (pv && pv !== 'wind' && e.state === 'wind') window.__P.wind.push({ id: e.id, kind: e.kind, t: now });
            window.__P.ePrev[e.id] = e.state; });
          if (st.player.hp < window.__P.prevHp) { window.__P.hits.push({ t: now, hp: st.player.hp }); window.__P.moonOn = true; window.__P.moonUntil = now + 700; }
          window.__P.prevHp = st.player.hp;
        }
        requestAnimationFrame(loop);
      })();
    });
    const st = () => page.evaluate(() => window.__game.state());
    const moonWindow = async ms => { await page.evaluate(m => { const n = performance.now(); window.__P.moon = []; window.__P.moonOn = true; window.__P.moonUntil = n + m; }, ms); await sleep(ms + 180); return page.evaluate(() => { window.__P.moonOn = false; return window.__P.moon; }); };
    const valid = arr => arr.filter(s => s.c.n >= 1000);
    const spread = arr => { const v = valid(arr); if (v.length < 2) return -1; let m = 0;
      for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) { const d = Math.hypot(v[i].c.x - v[j].c.x, v[i].c.y - v[j].c.y); if (d > m) m = d; } return m; };
    const mean = arr => { const v = valid(arr); if (!v.length) return { x: -1, y: -1, n: 0 }; const s = v.reduce((a, s) => ({ x: a.x + s.c.x, y: a.y + s.c.y, n: a.n + 1 }), { x: 0, y: 0, n: 0 }); return { x: s.x / v.length, y: s.y / v.length, n: v[0].c.n }; };

    await page.keyboard.press('Enter'); await sleep(400);

    /* —— V1 地面冲刺 —— */
    const x0 = (await st()).player.x;
    await page.evaluate(() => { window.__P.dash = []; window.__P.dashOn = true; });
    await page.keyboard.press('KeyK'); await sleep(900);
    const ds = await page.evaluate(() => { window.__P.dashOn = false; return window.__P.dash; });
    const maxDx = Math.max(...ds.map(s => s.x)) - x0; const dSeen = ds.filter(s => s.d).length;
    V('V1 地面冲刺位移+标志', maxDx >= 100 && dSeen >= 3, `x0=${x0} 位移=${maxDx.toFixed(1)}px dashing采样=${dSeen}/${ds.length}`);

    /* —— V0 基线（静止场景前提） —— */
    await sleep(500);
    const base = await moonWindow(420);
    const baseSpread = spread(base); const baseMean = mean(base);
    V('V0 基线静止(前提)', baseSpread >= 0 && baseSpread < 0.6 && baseMean.n >= 1000, `有效样本=${valid(base).length}/${base.length} 质心散布=${baseSpread.toFixed(2)}px n=${baseMean.n}`);

    /* —— V2 索敌（真键走位→站桩） —— */
    await page.keyboard.down('KeyD');
    { const t = Date.now(); while (Date.now() - t < 4500) { if ((await st()).player.x > 432) break; await sleep(60); } }
    await page.keyboard.up('KeyD');
    await page.evaluate(() => { window.__P.hits = []; window.__P.wind = []; window.__P.tStand = performance.now(); });
    let hit = null;
    { const t = Date.now(); while (Date.now() - t < 6800) { const hs = await page.evaluate(() => window.__P.hits); if (hs.length) { hit = hs[0]; break; } await sleep(120); } }
    const winds = await page.evaluate(() => window.__P.wind);
    const tStand = await page.evaluate(() => window.__P.tStand);
    V('V2 索敌:站桩6s内敌出手', !!hit && winds.length > 0, hit ? `首次掉血@+${((hit.t - tStand) / 1000).toFixed(1)}s hp=${hit.hp} wind事件=${winds.length}（零钩子）` : `6.8s 内 0 掉血 wind=${winds.length}`);

    /* —— V4a 正对照：中击瞬间震屏 ——
       先等 700ms 窗口里真的收集到新样本再读（2026-10-13 实测竞态：读得太早时窗口内 0 新样本，
       spread 会拿 V0 遗留的静态样本算出 0.00 假红；阈值 1.2px 未动，只修读取时机）。 */
    const moonBase = await page.evaluate(() => window.__P.moon.length);
    let moonNow = moonBase;
    for (let i = 0; i < 25; i++) { await sleep(60); moonNow = await page.evaluate(() => window.__P.moon.length); if (moonNow - moonBase >= 4) break; }
    const hitMoon = await page.evaluate(() => window.__P.moon);
    const hitSpread = spread(hitMoon);
    V('V4a 震屏正对照(中击抖动)', hitSpread > 1.2, `击中后 700ms 质心散布=${hitSpread.toFixed(2)}px 有效样本=${valid(hitMoon).length}（窗口新样本=${moonNow - moonBase}）`);

    /* —— V3 地面受控一闪（敌方 wind 计时 + 定时 K，合成按键触发同一 keydown 管线） —— */
    await page.evaluate(() => {
      window.__P.pd0 = window.__game.state().narrator.counters.perfectDodges;
      window.__P.dodgeOnce = function () {
        return new Promise(res => {
          const start = performance.now(); const startIdx = window.__P.wind.length;
          const iv = setInterval(() => {
            if (window.__P.wind.length > startIdx) {
              const ev = window.__P.wind[startIdx]; clearInterval(iv);
              const wu = ev.kind === 'red' ? 0.5 : 0.34;
              const delay = (ev.t + (wu - 0.095) * 1000) - performance.now() - 5;
              if (delay < -40) { res({ skipped: 'late', kind: ev.kind }); return; }
              let lead = null;
              setTimeout(() => {
                window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK', key: 'k', bubbles: true }));
                lead = +((ev.t + wu * 1000) - performance.now()).toFixed(0);   // 按压瞬间：距敌方出招还有多少 ms
                setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyK', key: 'k', bubbles: true })), 70);
              }, Math.max(0, delay));
              setTimeout(() => res({ kind: ev.kind, leadAtPress: lead, pd: window.__game.state().narrator.counters.perfectDodges }), Math.max(0, delay) + 450);
            } else if (performance.now() - start > 12000) { clearInterval(iv); res({ skipped: 'no-wind' }); }
          }, 15);
        });
      };
    });
    const ensureEngaged = async () => {
      for (let i = 0; i < 3; i++) {
        const s = await st();
        if (s.phase === 'playing' && s.player.x > 430 && s.enemies.some(e => e.hp > 0)) return true;
        if (s.phase === 'dead') { await sleep(2800); continue; }
        await page.keyboard.down('KeyD'); { const t = Date.now(); while (Date.now() - t < 3500) { if ((await st()).player.x > 432) break; await sleep(70); } } await page.keyboard.up('KeyD');
      }
      return false;
    };
    const attempts = []; let pdNow = (await st()).narrator.counters.perfectDodges;
    for (let k = 0; k < 5 && pdNow === 0; k++) {
      await ensureEngaged();
      const r = await page.evaluate(() => window.__P.dodgeOnce());
      attempts.push(r); pdNow = r.pd != null ? r.pd : (await st()).narrator.counters.perfectDodges;
      console.log('   dodge 尝试#' + (k + 1), JSON.stringify(r));
      if (pdNow > 0) break;
      const s = await st(); if (s.narrator.counters.deaths >= 2) break;
    }
    V('V3 地面受控一闪', pdNow >= 1, `perfDodges=${pdNow} 尝试=${JSON.stringify(attempts)}`);

    /* —— 真键从零打到通关 —— */
    const tFight0 = Date.now(); let cleared = false; let volleys = 0;
    while (Date.now() - tFight0 < 150000) {
      const s = await st();
      if (s.cleared) { cleared = true; break; }
      if (s.phase === 'dead') { await sleep(2600); continue; }
      const alive = s.enemies.filter(e => e.hp > 0);
      if (!alive.length) { await sleep(300); continue; }
      const near = alive.reduce((a, e) => Math.abs(e.x - s.player.x) < Math.abs(a.x - s.player.x) ? e : a);
      const gap = Math.abs(near.x - s.player.x);
      if (gap > 130) { const dir = near.x > s.player.x ? 'KeyD' : 'KeyA'; await page.keyboard.down(dir); await sleep(Math.min(500, Math.max(60, gap / 270 * 1000))); await page.keyboard.up(dir); }
      else { const dir = near.x > s.player.x ? 'KeyD' : 'KeyA'; await page.keyboard.down(dir); await sleep(50); await page.keyboard.up(dir); }
      await page.keyboard.press('KeyJ'); await sleep(330); volleys++;
    }
    const sf = await st();
    V('X1 真键从零通关(附带回执)', cleared, `cleared=${sf.cleared} wave=${sf.wave} 挥刀次=${volleys} 死亡=${sf.narrator.counters.deaths} 用时=${((Date.now() - tFight0) / 1000).toFixed(1)}s`);

    /* —— V4b 战后 8s 归零 —— */
    await sleep(8200);
    const calm = await moonWindow(420);
    const calmSpread = spread(calm); const calmMean = mean(calm);
    const drift = (calmMean.x < 0) ? 99 : Math.hypot(calmMean.x - baseMean.x, calmMean.y - baseMean.y);
    V('V4b 战后8s 震屏归零', calmSpread >= 0 && calmSpread < 0.6 && drift < 0.6, `质心散布=${calmSpread.toFixed(2)} 与基线漂移=${drift.toFixed(2)}px n=${calmMean.n}`);

    const shotDir = 'D:/2006L/chaitai/review/'; fs.mkdirSync(shotDir, { recursive: true });
    await page.screenshot({ path: shotDir + '_v011-calm8s-' + (TARGET.indexOf('versions') >= 0 ? 'snapshot' : 'fixed') + '.png' });
  } catch (e) {
    console.log('CHAIR-SCRIPT-ERROR', e && e.stack || e);
    results.push({ name: 'script', pass: false, detail: String(e) });
  }
  console.log('ERRS', JSON.stringify(errs));
  const fails = results.filter(r => !r.pass);
  console.log(`SUMMARY ${results.length - fails.length}/${results.length} PASS`);
  for (const r of results) console.log(` - ${r.pass ? 'PASS' : 'FAIL'} ${r.name}`);
  await b.close();
  process.exit(fails.length ? 1 : 0);
})();
