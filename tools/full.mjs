/**
 * 整页截图（开发用）
 *
 *   node tools/full.mjs "#/" home 1440
 */

import puppeteer from "puppeteer-core";

const CHROME =
  process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ORIGIN = process.env.ORIGIN || "http://127.0.0.1:4173";

const hash = process.argv[2] || "#/";
const name = process.argv[3] || "full";
const width = Number(process.argv[4] || 1440);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "shell",
  args: ["--hide-scrollbars", "--disable-gpu"],
});
const page = await browser.newPage();
await page.setViewport({ width, height: 1000 });
await page.goto(`${ORIGIN}/${hash}`, { waitUntil: "networkidle2" });
await page.waitForSelector("#app:not([hidden])", { timeout: 10000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 1800));
// 依次走过整页，让 loading="lazy" 的媒体进入视口并完成解码；否则
// fullPage 截图会把尚未滚到的图片拍成空白占位框。
await page.evaluate(async () => {
  const step = Math.max(500, Math.floor(innerHeight * 0.8));
  for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  window.scrollTo(0, 0);
});
await page
  .waitForFunction(
    () => [...document.images].every((img) => img.complete && img.naturalWidth > 0),
    { timeout: 15000 }
  )
  .catch(() => {});
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: `tools/shots/${name}.png`, fullPage: true });
const h = await page.evaluate(() => document.documentElement.scrollHeight);
await browser.close();
console.log(name, "height", h);
