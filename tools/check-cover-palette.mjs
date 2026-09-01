/**
 * 首页封面配色自检：node tools/check-cover-palette.mjs
 *
 * 约束：背景直接使用豆包 Logo 的深蓝主体与双浅蓝高光；
 * 大标题前景与主背景保留至少 3:1 的可读对比度。
 */
import puppeteer from "puppeteer-core";

const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ORIGIN = process.env.ORIGIN || "http://127.0.0.1:4173";

const hexToRgb = (hex) => {
  const value = hex.trim().replace(/^#/, "");
  if (!/^[\da-f]{6}$/i.test(value)) throw new Error(`Invalid hex color: ${hex}`);
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
};

const rgbToHsl = ([r, g, b]) => {
  const [rn, gn, bn] = [r, g, b].map((value) => value / 255);
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { hue: 0, saturation: 0, lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue;
  if (max === rn) hue = 60 * (((gn - bn) / delta) % 6);
  else if (max === gn) hue = 60 * ((bn - rn) / delta + 2);
  else hue = 60 * ((rn - gn) / delta + 4);
  return { hue: hue < 0 ? hue + 360 : hue, saturation, lightness };
};

const luminance = ([r, g, b]) => {
  const channel = (value) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (a, b) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "shell" });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${ORIGIN}/#/`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".bookcover");

  const palette = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const cover = getComputedStyle(document.querySelector(".bookcover"));
    return {
      deep: root.getPropertyValue("--cover-blue-deep").trim(),
      base: root.getPropertyValue("--cover-blue").trim(),
      light: root.getPropertyValue("--cover-blue-light").trim(),
      tail: root.getPropertyValue("--cover-blue-tail").trim(),
      highlight: root.getPropertyValue("--cover-highlight").trim(),
      foreground: root.getPropertyValue("--cover-foreground").trim(),
      backgroundImage: cover.backgroundImage,
      color: cover.color,
    };
  });

  assert(palette.base, "missing --cover-blue token");
  assert(palette.deep && palette.light && palette.tail && palette.highlight, "logo gradient stops are missing");
  assert(palette.foreground, "missing --cover-foreground token");
  assert(palette.backgroundImage !== "none", "cover does not use the softened gradient");

  const baseRgb = hexToRgb(palette.base);
  const foregroundRgb = hexToRgb(palette.foreground);
  const hsl = rgbToHsl(baseRgb);
  const highlightHsl = rgbToHsl(hexToRgb(palette.highlight));
  const ratio = contrast(baseRgb, foregroundRgb);
  const gradientLayers = (palette.backgroundImage.match(/gradient\(/g) || []).length;

  assert(hsl.hue >= 200 && hsl.hue <= 220, `cover hue ${hsl.hue.toFixed(1)} is not logo blue`);
  assert(hsl.saturation >= 0.85, `cover saturation ${hsl.saturation.toFixed(2)} does not match the reference`);
  assert(hsl.lightness >= 0.45 && hsl.lightness <= 0.65, `cover lightness ${hsl.lightness.toFixed(2)} is outside the reference range`);
  assert(gradientLayers >= 3, `cover has ${gradientLayers} gradient layers; logo lighting needs at least 3`);
  assert(highlightHsl.hue >= 185 && highlightHsl.hue <= 210, `highlight hue ${highlightHsl.hue.toFixed(1)} is not logo cyan`);
  assert(highlightHsl.lightness >= 0.8, `highlight lightness ${highlightHsl.lightness.toFixed(2)} is too dark`);
  assert(ratio >= 3, `large-title contrast ${ratio.toFixed(2)} is below 3:1`);

  console.log(
    JSON.stringify(
      {
        status: "PASS",
        palette,
        baseHsl: {
          hue: Number(hsl.hue.toFixed(1)),
          saturation: Number(hsl.saturation.toFixed(2)),
          lightness: Number(hsl.lightness.toFixed(2)),
        },
        gradientLayers,
        highlightHsl: {
          hue: Number(highlightHsl.hue.toFixed(1)),
          saturation: Number(highlightHsl.saturation.toFixed(2)),
          lightness: Number(highlightHsl.lightness.toFixed(2)),
        },
        foregroundContrast: Number(ratio.toFixed(2)),
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
