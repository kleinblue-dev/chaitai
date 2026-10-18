/* 触屏探针：手机视口 + hasTouch，验证触屏按钮（可见性/命中自检/真出招） */
const puppeteer = require('D:/2006L/personal-site/node_modules/puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///D:/2006L/chaitai/index.html'); await wait(800);

  const vis = await p.evaluate(() => {
    const t = document.getElementById('touch');
    return { on: t.classList.contains('on'), display: getComputedStyle(t).display };
  });
  console.log('TOUCH BAR:', JSON.stringify(vis));

  // 命中自检：按钮中心 elementFromPoint 是否就是该按钮
  for (const id of ['t-left', 't-right', 't-jump', 't-atk', 't-dash']) {
    const r = await p.evaluate((id) => {
      const el = document.getElementById(id); const b = el.getBoundingClientRect();
      const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      return { id, x: Math.round(cx), y: Math.round(cy), hitId: hit ? hit.id : null };
    }, id);
    console.log('HIT', JSON.stringify(r));
  }

  // 点画布开始游戏
  const cv = await p.evaluate(() => { const b = document.getElementById('cv').getBoundingClientRect(); return { cx: b.x + b.width / 2, cy: b.y + b.height / 2 }; });
  await p.touchscreen.tap(cv.cx, cv.cy); await wait(1000);
  let s = await p.evaluate(() => window.__game.state());
  console.log('AFTER start-tap: phase=', s.phase, 'log=', s.narrator.log.join(','));

  // 点 ◀ 400ms 后 player.x 应减小
  const bl = await p.evaluate(() => { const b = document.getElementById('t-left').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  const x0 = (await p.evaluate(() => window.__game.state())).player.x;
  await p.touchscreen.tap(bl.x, bl.y); await wait(400);
  const x1 = (await p.evaluate(() => window.__game.state())).player.x;
  console.log('LEFT TAP: x0=', x0, '-> x1=', x1, 'moved=', (x0 - x1).toFixed(1));

  // 点「攻」：attacking 应为 true
  const ba = await p.evaluate(() => { const b = document.getElementById('t-atk').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await p.touchscreen.tap(ba.x, ba.y); await wait(120);
  s = await p.evaluate(() => window.__game.state());
  console.log('ATK TAP: attacking=', s.player.attacking);

  // 点「跳」：vy<0 或 y<470
  const bj = await p.evaluate(() => { const b = document.getElementById('t-jump').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await p.touchscreen.tap(bj.x, bj.y); await wait(200);
  s = await p.evaluate(() => window.__game.state());
  console.log('JUMP TAP: y=', s.player.y, 'vy=', s.player.vy, 'grounded=', s.player.grounded);

  console.log('ERRS:', JSON.stringify(errs));
  await b.close();
})().catch(e => { console.error('TOUCH CRASH', e); process.exit(1); });
