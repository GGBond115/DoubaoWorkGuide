/* 书封下方落地版块自检（开发用）：node tools/check-lp.mjs */
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ORIGIN = process.env.ORIGIN || "http://127.0.0.1:4173";

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "shell" });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
await page.evaluateOnNewDocument(() => localStorage.setItem("dwg.theme", "light"));

await page.goto(`${ORIGIN}/#/`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1000));

const structure = await page.evaluate(() => ({
  tasks: document.querySelectorAll(".lp__task").length,
  files: document.querySelectorAll(".lp__file").length,
  cta: !!document.querySelector(".lp__cta"),
}));
console.log(structure);
assert.equal(structure.tasks, 4, "首页应保留 4 个推荐任务");
assert.equal(structure.files, 3, "首页应保留 3 个篇章入口");
assert.equal(structure.cta, true, "首页应保留底部 CTA");

const fills = await page.evaluate(() =>
  Object.fromEntries(
    Object.entries({
      index: ".lp__index",
      taskTag: ".lp__task .lp__tag",
      fileTag: ".lp__file .lp__tag",
      cta: ".lp__cta",
      footer: ".lp__foot",
    }).map(([name, selector]) => {
      const style = getComputedStyle(document.querySelector(selector));
      return [name, { backgroundColor: style.backgroundColor, color: style.color }];
    })
  )
);
const cardLine = await page.evaluate(() => getComputedStyle(document.querySelector(".lp__card")).borderTopColor);

const relativeLuminance = (rgb) => {
  const values = rgb.match(/[\d.]+/g).slice(0, 3).map(Number);
  const channels = (rgb.startsWith("color(srgb") ? values : values.map((value) => value / 255)).map((normalized) => {
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

assert.ok(relativeLuminance(cardLine) >= 0.2, `card line is still too dark (${cardLine})`);
for (const [name, fill] of Object.entries(fills)) {
  const luminance = relativeLuminance(fill.backgroundColor);
  assert.ok(luminance >= 0.28, `${name} fill is still too dark (${luminance.toFixed(3)})`);
}
console.log("landing fills:", fills);
console.log("card line:", cardLine);

// 滚到推荐任务
await page.evaluate(() => document.querySelector(".lp__grid--tasks").scrollIntoView({ block: "center" }));
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: "tools/shots/lp-tasks.png" });

// 滚到 INDEX 档案卡
await page.evaluate(() => document.querySelector(".lp__grid--files").scrollIntoView({ block: "center" }));
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: "tools/shots/lp-files.png" });

// 底部 CTA
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: "tools/shots/lp-cta.png" });

// 点任务卡应直接跳文章（不在书封内，无翻页动画）
const href = await page.evaluate(() => document.querySelector(".lp__task").getAttribute("href"));
await page.click(".lp__task");
await new Promise((r) => setTimeout(r, 500));
console.log("task href:", href, "→ hash:", await page.evaluate(() => location.hash));
assert.equal(await page.evaluate(() => location.hash), href, "任务卡应直接进入目标文章");

console.log(JSON.stringify({ status: "PASS" }));

await browser.close();
