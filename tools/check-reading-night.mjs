import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const origin = process.env.ORIGIN || 'http://127.0.0.1:4173';
const { documents } = JSON.parse(await readFile(new URL('../site/content/site-index.json', import.meta.url)));
const groups = documents.filter(doc => doc.hasChild && doc.depth === 2);
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'shell' });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 900 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await page.goto(`${origin}/#/intro`, { waitUntil: 'networkidle0' });
  const members = documents.filter(doc => doc.parentToken === groups[0].nodeToken && !doc.hasChild);
  const inspectProgress = () => page.$eval(`.entry[href="#/p/${groups[0].nodeToken.slice(4)}"]`, el => ({
    text: el.textContent,
    current: el.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow'),
    max: el.querySelector('[role="progressbar"]')?.getAttribute('aria-valuemax'),
    width: el.querySelector('.entry__bar')?.style.width,
  }));
  for (const count of [0, 1, members.length]) {
    await page.evaluate(tokens => localStorage.setItem('dwg.read', JSON.stringify(tokens)), members.slice(0, count).map(doc => doc.nodeToken));
    await page.reload({ waitUntil: 'networkidle0' });
    const progress = await inspectProgress();
    assert.equal(progress.current, String(count), '场景的零进度、部分进度和完成状态应可被读取');
    assert.equal(progress.max, String(members.length));
    assert.equal(progress.width, `${count / members.length * 100}%`);
  }
  assert.equal(await page.$$eval('.entries [role="progressbar"]', els => els.length), 8, '三个部分与五类场景都应有进度条');
  await page.setViewport({ width: 360, height: 800 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${origin}/#/`, { waitUntil: 'networkidle0' });
  const lightBackground = await page.$eval('.bookcover', el => getComputedStyle(el).backgroundImage);
  await page.click('.bookcover [data-theme-toggle]');
  await page.click('.bookcover [data-theme-toggle]');
  const darkBackground = await page.$eval('.bookcover', el => getComputedStyle(el).backgroundImage);
  assert.notEqual(darkBackground, lightBackground, '选择暗色后封面必须降低亮度，不能仍使用日间渐变');
  await page.reload({ waitUntil: 'networkidle0' });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.themeEffective), 'dark');
  await page.mouse.move(15, 400);
  const note = await page.$eval('.bc-note', el => ({ color: getComputedStyle(el).color, inlineColor: el.style.color }));
  assert.equal(note.inlineColor, '', '指针动画不能覆盖注记的主题文字颜色');
  assert.equal(await page.$$eval('.bookcover__ticker-track [aria-hidden="true"] a:not([tabindex="-1"])', els => els.length), 0, '重复篇目不应重复进入键盘焦点');
  await page.click('[data-ticker-toggle]');
  assert.equal(await page.$eval('.bookcover__ticker-track', el => getComputedStyle(el).animationPlayState), 'paused');
  await page.click('[data-ticker-toggle]');
  assert.equal(await page.$eval('[data-ticker-toggle]', el => el.getAttribute('aria-pressed')), 'false');
  assert.equal(await page.$eval('.bookcover__ticker-track', el => getComputedStyle(el).animationPlayState), 'running', '继续滚动后按钮持有焦点不能阻止动画恢复');
  await page.goto(`${origin}/#/p/5828287b3f6d6835`, { waitUntil: 'networkidle0' });
  await page.click('[data-share]');
  await page.keyboard.press('ArrowRight');
  assert.equal(new URL(page.url()).hash, '#/p/5828287b3f6d6835', '分享弹层打开时方向键不能切换文章');
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'PASS', sceneStates: ['0%', 'partial', '100%'], groups: 8, darkCover: true, tickerControls: true, modalKeyboard: true }));
} finally {
  await browser.close();
}
