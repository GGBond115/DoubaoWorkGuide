/** 详情页元信息与主题切换回归：node tools/check-theme.mjs */
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ORIGIN = process.env.ORIGIN || "http://127.0.0.1:4173";
const ARTICLE = `${ORIGIN}/#/p/5828287b3f6d6835`;

function luminance(rgb) {
  const channels = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "shell",
  args: ["--hide-scrollbars", "--disable-gpu"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await page.goto(ARTICLE, { waitUntil: "networkidle0" });
  await page.waitForSelector(".article__meta");

  const articleMeta = await page.$eval(".article__meta", (element) => element.textContent.trim());
  assert.doesNotMatch(articleMeta, /第\s*\d+\s*\/\s*\d+\s*篇/, "详情页不应显示需要维护的全站篇目序号");
  assert.match(articleMeta, /张截图/, "详情页仍应保留截图数量");
  assert.match(articleMeta, /分钟/, "详情页仍应保留阅读时长");

  const initial = await page.evaluate(() => {
    const root = document.documentElement;
    const button = document.querySelector("[data-theme-toggle]");
    return {
      preference: root.dataset.theme,
      effective: root.dataset.themeEffective,
      colorScheme: getComputedStyle(root).colorScheme,
      canvas: getComputedStyle(document.body).backgroundColor,
      themeColor: document.querySelector('meta[name="theme-color"]')?.content,
      controlCount: document.querySelectorAll("[data-theme-toggle]").length,
      label: button?.getAttribute("aria-label"),
    };
  });
  assert.equal(initial.preference, "system", "首次访问应默认跟随系统主题");
  assert.equal(initial.effective, "dark", "系统为暗色时首次访问应启用暗色主题");
  assert.equal(initial.colorScheme, "dark", "暗色主题应同步浏览器原生控件配色");
  assert.notEqual(initial.canvas, "rgb(255, 255, 255)", "暗色主题画布不能仍是纯白");
  assert.notEqual(initial.themeColor, "#ffffff", "暗色主题应更新移动浏览器顶栏颜色");
  assert.ok(initial.controlCount >= 2, "页眉与回流条都应提供主题入口");
  assert.match(initial.label || "", /跟随系统/, "主题按钮应清楚说明当前状态");

  const clickTheme = async () => {
    await page.click(".masthead [data-theme-toggle]");
    return page.evaluate(() => ({
      preference: document.documentElement.dataset.theme,
      effective: document.documentElement.dataset.themeEffective,
      stored: localStorage.getItem("dwg.theme"),
      label: document.querySelector(".masthead [data-theme-toggle]")?.getAttribute("aria-label"),
    }));
  };

  const light = await clickTheme();
  assert.deepEqual(
    light,
    { preference: "light", effective: "light", stored: "light", label: "主题：日间模式；点击切换为暗色模式" },
    "跟随系统后的下一档应是固定日间主题"
  );

  const dark = await clickTheme();
  assert.deepEqual(
    dark,
    { preference: "dark", effective: "dark", stored: "dark", label: "主题：暗色模式；点击切换为跟随系统" },
    "日间后的下一档应是固定暗色主题"
  );

  await page.reload({ waitUntil: "networkidle0" });
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.themeEffective),
    "dark",
    "手动选择的暗色主题应在刷新后保留"
  );

  const system = await clickTheme();
  assert.deepEqual(
    system,
    { preference: "system", effective: "dark", stored: "system", label: "主题：跟随系统；点击切换为日间模式" },
    "暗色后的下一档应回到跟随系统"
  );

  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.equal(layout.scrollWidth, layout.viewport, "加入主题切换后 390px 页面不得横向溢出");

  await page.goto(`${ORIGIN}/#/`, { waitUntil: "networkidle0" });
  const darkContrast = await page.evaluate(() => {
    const cta = document.querySelector(".lp__cta");
    const ctaTitle = document.querySelector(".lp__cta-title");
    const card = document.querySelector(".lp__card");
    const cardTitle = document.querySelector(".lp__task-title");
    return {
      ctaBackground: getComputedStyle(cta).backgroundColor,
      ctaText: getComputedStyle(ctaTitle).color,
      cardBackground: getComputedStyle(card).backgroundColor,
      cardText: getComputedStyle(cardTitle).color,
    };
  });
  assert.ok(
    contrast(darkContrast.ctaBackground, darkContrast.ctaText) >= 4.5,
    "暗色主题首页 CTA 的文字对比度应至少达到 4.5:1"
  );
  assert.ok(
    contrast(darkContrast.cardBackground, darkContrast.cardText) >= 4.5,
    "暗色主题首页卡片标题对比度应至少达到 4.5:1"
  );

  console.log(JSON.stringify({ status: "PASS", articleMeta, initial, light, dark, system, layout, darkContrast }, null, 2));
} finally {
  await browser.close();
}
