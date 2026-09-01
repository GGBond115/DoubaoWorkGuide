/** 模拟弱网首屏性能门禁：node tools/check-performance.mjs */
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const CHROME =
  process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ORIGIN = process.env.ORIGIN || "http://127.0.0.1:4173";
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "shell",
  args: ["--disable-cache", "--hide-scrollbars", "--disable-gpu"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const client = await page.target().createCDPSession();
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: 200000,
    uploadThroughput: 100000,
  });

  const started = Date.now();
  await page.goto(`${ORIGIN}/#/`, { waitUntil: "domcontentloaded" });
  const domContentLoaded = Date.now() - started;
  await page.waitForSelector("#app:not([hidden])", { timeout: 5000 });
  const appVisible = Date.now() - started;
  const resources = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((entry) => ({
      path: new URL(entry.name).pathname,
      transferSize: entry.transferSize,
      duration: Math.round(entry.duration),
    }))
  );

  assert.ok(appVisible <= 3400, `弱网首页应在 3400ms 内可见，实际 ${appVisible}ms`);
  assert.ok(resources.some((entry) => entry.path === "/content/site-index.json"), "首屏应使用轻量索引");
  assert.ok(!resources.some((entry) => entry.path === "/js/vendor/qrcode.js"), "首屏不得加载二维码库");

  console.log(JSON.stringify({ status: "PASS", domContentLoaded, appVisible, resources }, null, 2));
} finally {
  await browser.close();
}
