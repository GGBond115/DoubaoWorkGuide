/** 全站豆包 Logo 色系回归：node tools/check-brand-system.mjs */
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ORIGIN = process.env.ORIGIN || "http://127.0.0.1:4173";

const EXPECTED = {
  deep: "#0863f5",
  primary: "#1674fc",
  mid: "#429afc",
  light: "#79c4fc",
  highlight: "#c6eefc",
};

function channels(color) {
  return color.match(/[\d.]+/g).slice(0, 3).map(Number);
}

function luminance(color) {
  const values = channels(color).map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
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
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.goto(`${ORIGIN}/#/`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".lp__cta");

  const readBrandSystem = () =>
    page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const value = (name) => root.getPropertyValue(name).trim().toLowerCase();
      const lp = getComputedStyle(document.querySelector(".lp"));
      const cta = getComputedStyle(document.querySelector(".lp__cta"));
      const ctaTitle = getComputedStyle(document.querySelector(".lp__cta-title"));
      const footer = getComputedStyle(document.querySelector(".lp__foot"));
      return {
        theme: document.documentElement.dataset.themeEffective,
        brandInk: value("--brand-ink"),
        tokens: {
          deep: value("--doubao-deep"),
          primary: value("--doubao-primary"),
          mid: value("--doubao-mid"),
          light: value("--doubao-light"),
          highlight: value("--doubao-highlight"),
        },
        aliases: {
          brandText: value("--brand-blue"),
          brandFill: value("--brand-fill"),
          brandSoft: value("--brand-cyan"),
          coverDeep: value("--cover-blue-deep"),
          coverPrimary: value("--cover-blue"),
          coverMid: value("--cover-blue-tail"),
          coverLight: value("--cover-blue-light"),
          coverHighlight: value("--cover-highlight"),
        },
        canvas: getComputedStyle(document.body).backgroundColor,
        lpCanvas: lp.backgroundColor,
        lpLine: lp.getPropertyValue("--lp-line").trim().toLowerCase(),
        ctaBackground: cta.backgroundColor,
        ctaText: ctaTitle.color,
        footerBackground: footer.backgroundImage,
        themeColor: document.querySelector('meta[name="theme-color"]')?.content,
      };
    });

  const light = await readBrandSystem();
  assert.deepEqual(light.tokens, EXPECTED, "全站应定义且只从五个豆包 Logo 品牌色派生");
  assert.equal(light.brandInk, "#06152f", "浅蓝大色块应共用同一个高对比蓝黑文字色");
  assert.deepEqual(
    light.aliases,
    {
      brandText: EXPECTED.deep,
      brandFill: EXPECTED.deep,
      brandSoft: EXPECTED.light,
      coverDeep: EXPECTED.deep,
      coverPrimary: EXPECTED.primary,
      coverMid: EXPECTED.mid,
      coverLight: EXPECTED.light,
      coverHighlight: EXPECTED.highlight,
    },
    "首页封面与通用组件应共用同一套 Logo 色阶"
  );
  assert.equal(light.lpLine, EXPECTED.mid, "首页制图纸描边应直接使用 Logo 中蓝");
  assert.equal(light.ctaBackground, "rgb(8, 99, 245)", "底部主操作区应延续封面的 Logo 深蓝");
  assert.ok(contrast(light.ctaBackground, light.ctaText) >= 4.5, "日间 CTA 应达到 4.5:1 对比度");
  assert.doesNotMatch(light.footerBackground, /rgb\(26, 47, 247\)/, "页脚不得残留旧品牌蓝");
  assert.match(light.footerBackground, /linear-gradient\(118deg, color\(srgb/, "页脚亮端应由主蓝与深蓝混合派生");
  assert.match(light.footerBackground, /rgb\(8, 99, 245\)/, "页脚应延续封面的 Logo 深蓝");

  await page.evaluate(() => {
    localStorage.setItem("dwg.theme", "dark");
  });
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(".lp__cta");
  const dark = await readBrandSystem();
  assert.equal(dark.theme, "dark", "测试应进入固定暗色主题");
  assert.deepEqual(dark.tokens, EXPECTED, "暗色主题也应保留同一组 Logo 原色，不另造紫蓝色阶");
  assert.equal(dark.brandInk, "#06152f");
  assert.deepEqual(dark.aliases, {
    brandText: EXPECTED.light,
    brandFill: EXPECTED.deep,
    brandSoft: EXPECTED.highlight,
    coverDeep: EXPECTED.deep,
    coverPrimary: EXPECTED.primary,
    coverMid: EXPECTED.mid,
    coverLight: EXPECTED.light,
    coverHighlight: EXPECTED.highlight,
  });
  assert.notEqual(dark.canvas, "rgb(17, 19, 24)", "暗色画布应改为 Logo 蓝派生的深色，而不是中性黑灰");
  assert.equal(dark.themeColor, "#06152f", "移动浏览器暗色顶栏应与新蓝黑画布一致");
  assert.ok(contrast(dark.canvas, "rgb(121, 196, 252)") >= 4.5, "暗色主题品牌链接应清晰可读");
  assert.ok(contrast(dark.ctaBackground, dark.ctaText) >= 4.5, "暗色 CTA 应达到 4.5:1 对比度");

  console.log(JSON.stringify({ status: "PASS", light, dark }, null, 2));
} finally {
  await browser.close();
}
