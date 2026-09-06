/* 首页书封与内页封面分离的自检（开发用）：node tools/check-landing.mjs */
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ORIGIN = process.env.ORIGIN || "http://127.0.0.1:4173";

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "shell" });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

// 1. 首页只有书封，没有白纸内页
await page.goto(`${ORIGIN}/#/`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 700));
const landing = await page.evaluate(() => ({
  hasCover: !!document.querySelector(".bookcover"),
  hasEssay: !!document.querySelector(".page.cover"),
  mastheadHidden: getComputedStyle(document.querySelector(".masthead")).display === "none",
  scrollable: document.documentElement.scrollHeight - window.innerHeight,
}));
console.log("landing:", landing);
assert.equal(landing.hasCover, true, "首页应显示书封");
assert.equal(landing.hasEssay, false, "首页不应混入导读页");
assert.equal(landing.mastheadHidden, true, "首页应使用书封自带导航");
await page.screenshot({ path: "tools/shots/landing.png" });

// 2. 点「开始阅读」→ 跳到 #/intro 的内页封面
await page.click(".bcbtn--solid");
await new Promise((r) => setTimeout(r, 700));
const intro = await page.evaluate(() => ({
  hash: location.hash,
  hasCover: !!document.querySelector(".bookcover"),
  hasEssay: !!document.querySelector(".page.cover"),
  mastheadShown: getComputedStyle(document.querySelector(".masthead")).display !== "none",
  title: document.title,
}));
console.log("intro:", intro);
assert.equal(intro.hash, "#/intro", "开始阅读应进入导读页");
assert.equal(intro.hasEssay, true, "导读页应显示导读正文");
await page.screenshot({ path: "tools/shots/intro.png" });

// 3. 内页封面滚动，逐字点亮还在
await page.evaluate(() => window.scrollTo(0, 500));
await new Promise((r) => setTimeout(r, 500));
const lit = await page.evaluate(() => document.querySelectorAll(".reveal--blue .rv.lit").length);
console.log("reveal lit chunks:", lit);

// 4. 书封「查看目录」
await page.goto(`${ORIGIN}/#/`, { waitUntil: "networkidle0" });
await page.click(".bcbtn--ghost");
await page.waitForFunction(() => location.hash === "#/toc", { timeout: 3000 });
const tocHash = await page.evaluate(() => location.hash);
console.log("toc hash:", tocHash);
assert.equal(tocHash, "#/toc", "查看目录应在翻页动画后进入目录");

console.log(JSON.stringify({ status: "PASS" }));

await browser.close();
