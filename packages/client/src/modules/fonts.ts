/**
 * Font Fingerprinting Module
 * Detects available system fonts using various techniques
 */

import type { ModuleResult, FontsData } from '../types';
import { sha256 } from '../core/crypto';
import { EMOJIS } from '../core/helpers';

// Common system fonts to test
const SYSTEM_FONTS = [
  // Windows
  'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Cambria Math', 'Comic Sans MS',
  'Consolas', 'Courier', 'Courier New', 'Georgia', 'Impact', 'Lucida Console',
  'Lucida Sans Unicode', 'Microsoft Sans Serif', 'MS Gothic', 'MS PGothic',
  'MS Sans Serif', 'MS Serif', 'Palatino Linotype', 'Segoe Print', 'Segoe Script',
  'Segoe UI', 'Segoe UI Light', 'Segoe UI Semibold', 'Segoe UI Symbol', 'Tahoma',
  'Times', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Wingdings',
  // macOS
  'American Typewriter', 'Andale Mono', 'Apple Chancery', 'Apple Color Emoji',
  'Apple SD Gothic Neo', 'AppleGothic', 'Avenir', 'Avenir Next', 'Baskerville',
  'Big Caslon', 'Brush Script MT', 'Chalkboard', 'Chalkboard SE', 'Cochin',
  'Copperplate', 'Didot', 'Futura', 'Geneva', 'Gill Sans', 'Helvetica',
  'Helvetica Neue', 'Herculanum', 'Hoefler Text', 'Lucida Grande', 'Luminari',
  'Marker Felt', 'Menlo', 'Monaco', 'Noteworthy', 'Optima', 'Palatino',
  'Papyrus', 'Phosphate', 'Rockwell', 'San Francisco', 'Savoye LET',
  'SignPainter', 'Skia', 'Snell Roundhand', 'Times', 'Trattatello', 'Zapfino',
  // Linux
  'Cantarell', 'DejaVu Sans', 'DejaVu Sans Mono', 'DejaVu Serif', 'Droid Sans',
  'Droid Sans Mono', 'Droid Serif', 'FreeMono', 'FreeSans', 'FreeSerif',
  'Liberation Mono', 'Liberation Sans', 'Liberation Serif', 'Noto Sans',
  'Noto Serif', 'Open Sans', 'Roboto', 'Ubuntu', 'Ubuntu Mono',
  // App-specific fonts
  'Adobe Caslon Pro', 'Adobe Garamond Pro', 'Century Gothic', 'Franklin Gothic Medium',
  'Garamond', 'Goudy Old Style', 'Haettenschweiler', 'Harlow Solid Italic',
  'Informal Roman', 'Lucida Bright', 'Lucida Fax', 'Lucida Handwriting',
  'Monotype Corsiva', 'Pristina', 'Ravie', 'Rockwell Extra Bold', 'Showcard Gothic',
  'Stencil', 'Wide Latin',
];

// Application fonts (indicate installed software)
const APP_FONTS: Record<string, string> = {
  'Helvetica Neue': 'Apple/macOS',
  'SF Pro': 'macOS Catalina+',
  'Segoe UI Variable': 'Windows 11',
  'Consolas': 'Visual Studio',
  'Source Code Pro': 'Adobe CC',
  'Roboto': 'Android/Google',
  'Ubuntu': 'Ubuntu Linux',
  'Cascadia Code': 'Windows Terminal',
  'JetBrains Mono': 'JetBrains IDEs',
  'Fira Code': 'Developer',
};

// Check font availability using FontFace API
async function checkFontWithFontFace(fontName: string): Promise<boolean> {
  try {
    await document.fonts.load(`12px "${fontName}"`);
    return document.fonts.check(`12px "${fontName}"`);
  } catch {
    return false;
  }
}

// Get available fonts using FontFace API
async function getFontFaceLoadFonts(): Promise<string[]> {
  const availableFonts: string[] = [];

  // Check fonts in parallel batches
  const batchSize = 10;
  for (let i = 0; i < SYSTEM_FONTS.length; i += batchSize) {
    const batch = SYSTEM_FONTS.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (font) => ({
        font,
        available: await checkFontWithFontFace(font),
      }))
    );

    for (const { font, available } of results) {
      if (available) {
        availableFonts.push(font);
      }
    }
  }

  return availableFonts;
}

// Get pixel size measurements for fonts
function getPixelSizeSystemSum(): number {
  const testString = 'mmmmmmmmmmlli';
  const testSize = '72px';
  const baseFonts = ['monospace', 'sans-serif', 'serif'];

  const span = document.createElement('span');
  span.style.position = 'absolute';
  span.style.left = '-9999px';
  span.style.fontSize = testSize;
  span.style.lineHeight = 'normal';
  span.textContent = testString;
  document.body.appendChild(span);

  let sum = 0;

  for (const baseFont of baseFonts) {
    span.style.fontFamily = baseFont;
    const baseWidth = span.offsetWidth;
    const baseHeight = span.offsetHeight;
    sum += baseWidth + baseHeight;
  }

  // Test some system fonts
  for (const font of SYSTEM_FONTS.slice(0, 20)) {
    span.style.fontFamily = `"${font}", monospace`;
    sum += span.offsetWidth * 0.001;
  }

  document.body.removeChild(span);

  return Math.round(sum * 10000) / 10000;
}

// Detect applications based on fonts
function detectApps(fonts: string[]): string[] {
  const apps: string[] = [];
  for (const font of fonts) {
    if (APP_FONTS[font]) {
      apps.push(APP_FONTS[font]);
    }
  }
  return [...new Set(apps)];
}

// Get emoji rendering uniqueness
function getEmojiSet(): string[] {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return [];

  canvas.width = 20;
  canvas.height = 20;
  context.font = '16px serif';

  const emojiSet: string[] = [];
  const seen = new Set<string>();

  for (const emoji of EMOJIS) {
    context.clearRect(0, 0, 20, 20);
    context.fillText(emoji, 0, 16);
    const imageData = canvas.toDataURL();

    if (!seen.has(imageData)) {
      seen.add(imageData);
      emojiSet.push(emoji);
    }
  }

  return emojiSet;
}

// Detect platform from fonts
function detectPlatformFromFonts(fonts: string[]): string {
  const fontSet = new Set(fonts);

  // macOS indicators
  const macFonts = ['Helvetica Neue', 'San Francisco', 'Menlo', 'Monaco', 'Lucida Grande'];
  const macCount = macFonts.filter((f) => fontSet.has(f)).length;

  // Windows indicators
  const winFonts = ['Segoe UI', 'Consolas', 'Calibri', 'Cambria'];
  const winCount = winFonts.filter((f) => fontSet.has(f)).length;

  // Linux indicators
  const linuxFonts = ['Ubuntu', 'DejaVu Sans', 'Liberation Sans', 'Cantarell'];
  const linuxCount = linuxFonts.filter((f) => fontSet.has(f)).length;

  if (macCount >= 3) return 'macOS';
  if (winCount >= 3) return 'Windows';
  if (linuxCount >= 2) return 'Linux';

  return 'Unknown';
}

export async function collectFonts(): Promise<ModuleResult<FontsData>> {
  // Get fonts using FontFace API
  const fontFaceLoadFonts = await getFontFaceLoadFonts();

  // Get pixel size measurements
  const pixelSizeSystemSum = getPixelSizeSystemSum();

  // Detect apps
  const apps = detectApps(fontFaceLoadFonts);

  // Get emoji set
  const emojiSet = getEmojiSet();

  // Detect platform
  const platformVersion = detectPlatformFromFonts(fontFaceLoadFonts);

  const data: FontsData = {
    fontFaceLoadFonts,
    pixelSizeSystemSum,
    apps,
    emojiSet,
    platformVersion,
  };

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
