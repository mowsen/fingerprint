/**
 * Font Metrics Fingerprinting Module
 * Based on research: "Fingerprinting Web Users Through Font Metrics"
 * Measures glyph bounding boxes of 43 strategic Unicode code points
 * Achieves ~34% unique identification improvement
 */

import type { ModuleResult, FontMetricsData } from '../types';
import { sha256 } from '../core/crypto';

/**
 * High-entropy Unicode code points (from research)
 * Only 43 code points needed to capture all font variation
 */
const TEST_CODEPOINTS = [
  0x00c6, // Æ LATIN CAPITAL LETTER AE
  0x00d0, // Ð LATIN CAPITAL LETTER ETH
  0x00de, // Þ LATIN CAPITAL LETTER THORN
  0x00e6, // æ LATIN SMALL LETTER AE
  0x00f0, // ð LATIN SMALL LETTER ETH
  0x00fe, // þ LATIN SMALL LETTER THORN
  0x0110, // Đ LATIN CAPITAL LETTER D WITH STROKE
  0x0126, // Ħ LATIN CAPITAL LETTER H WITH STROKE
  0x0132, // Ĳ LATIN CAPITAL LIGATURE IJ
  0x0141, // Ł LATIN CAPITAL LETTER L WITH STROKE
  0x0152, // Œ LATIN CAPITAL LIGATURE OE
  0x0166, // Ŧ LATIN CAPITAL LETTER T WITH STROKE
  0x017f, // ſ LATIN SMALL LETTER LONG S
  0x0192, // ƒ LATIN SMALL LETTER F WITH HOOK
  0x01c4, // Ǆ LATIN CAPITAL LETTER DZ WITH CARON
  0x0259, // ə LATIN SMALL LETTER SCHWA
  0x0283, // ʃ LATIN SMALL LETTER ESH
  0x02bc, // ʼ MODIFIER LETTER APOSTROPHE
  0x02dc, // ˜ SMALL TILDE
  0x0300, // ̀  COMBINING GRAVE ACCENT
  0x0394, // Δ GREEK CAPITAL LETTER DELTA
  0x03a9, // Ω GREEK CAPITAL LETTER OMEGA
  0x03c0, // π GREEK SMALL LETTER PI
  0x2013, // – EN DASH
  0x2014, // — EM DASH
  0x2018, // ' LEFT SINGLE QUOTATION MARK
  0x201c, // " LEFT DOUBLE QUOTATION MARK
  0x2022, // • BULLET
  0x2026, // … HORIZONTAL ELLIPSIS
  0x20ac, // € EURO SIGN
  0x2122, // ™ TRADE MARK SIGN
  0x2190, // ← LEFTWARDS ARROW
  0x2192, // → RIGHTWARDS ARROW
  0x21b5, // ↵ DOWNWARDS ARROW WITH CORNER LEFTWARDS
  0x2212, // − MINUS SIGN
  0x221e, // ∞ INFINITY
  0x2248, // ≈ ALMOST EQUAL TO
  0x2260, // ≠ NOT EQUAL TO
  0x2264, // ≤ LESS-THAN OR EQUAL TO
  0x25a0, // ■ BLACK SQUARE
  0x25cf, // ● BLACK CIRCLE
  0x266a, // ♪ EIGHTH NOTE
  0xfb01, // ﬁ LATIN SMALL LIGATURE FI
];

/**
 * Test font families - includes generic families and common system fonts
 */
const TEST_FONTS = [
  'monospace',
  'sans-serif',
  'serif',
  'cursive',
  'fantasy',
  'system-ui',
  'Arial',
  'Times New Roman',
  'Courier New',
];

/**
 * Font style variations to test
 */
const TEST_STYLES = ['normal', 'italic'] as const;
const TEST_WEIGHTS = ['400', '700'] as const;

/**
 * Individual glyph metrics
 */
interface GlyphMetrics {
  width: number;
  height: number;
  ascent: number;
  descent: number;
  left: number;
  right: number;
}

/**
 * Round a number to a fixed precision to avoid floating point noise
 */
function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Measure a single glyph's metrics
 */
function measureGlyph(
  ctx: CanvasRenderingContext2D,
  char: string
): GlyphMetrics {
  try {
    const tm = ctx.measureText(char);
    return {
      width: roundMetric(tm.width),
      height: roundMetric(
        (tm.actualBoundingBoxAscent || 0) + (tm.actualBoundingBoxDescent || 0)
      ),
      ascent: roundMetric(tm.actualBoundingBoxAscent || 0),
      descent: roundMetric(tm.actualBoundingBoxDescent || 0),
      left: roundMetric(tm.actualBoundingBoxLeft || 0),
      right: roundMetric(tm.actualBoundingBoxRight || 0),
    };
  } catch {
    return { width: 0, height: 0, ascent: 0, descent: 0, left: 0, right: 0 };
  }
}

/**
 * Create a compact metrics signature for a font/style combination
 * Instead of storing all metrics, we create a hash-like summary
 */
function createMetricsSignature(metrics: GlyphMetrics[]): string {
  // Sum up key dimensions for a compact representation
  let widthSum = 0;
  let heightSum = 0;
  let ascentSum = 0;

  for (const m of metrics) {
    widthSum += m.width;
    heightSum += m.height;
    ascentSum += m.ascent;
  }

  return `${roundMetric(widthSum)},${roundMetric(heightSum)},${roundMetric(ascentSum)}`;
}

/**
 * Collect font metrics for all test fonts and code points
 */
function collectMetrics(
  ctx: CanvasRenderingContext2D
): Record<string, string> {
  const signatures: Record<string, string> = {};

  for (const font of TEST_FONTS) {
    for (const style of TEST_STYLES) {
      for (const weight of TEST_WEIGHTS) {
        const key = `${font}-${style}-${weight}`;
        ctx.font = `${style} ${weight} 72px "${font}"`;

        const metrics = TEST_CODEPOINTS.map((cp) => {
          const char = String.fromCodePoint(cp);
          return measureGlyph(ctx, char);
        });

        signatures[key] = createMetricsSignature(metrics);
      }
    }
  }

  return signatures;
}

/**
 * Calculate a summary hash of specific key glyphs
 * These are the most discriminating code points
 */
function getKeyGlyphsSummary(ctx: CanvasRenderingContext2D): number {
  ctx.font = '72px monospace';

  // Key discriminating characters
  const keyChars = ['Æ', 'Ω', 'π', '€', '∞', '≠', '●', 'ﬁ'];
  let sum = 0;

  for (const char of keyChars) {
    const tm = ctx.measureText(char);
    sum += tm.width * 1000;
    sum += (tm.actualBoundingBoxAscent || 0) * 100;
    sum += (tm.actualBoundingBoxDescent || 0) * 10;
  }

  return Math.round(sum);
}

/**
 * Detect font rendering engine characteristics
 */
function detectRenderingCharacteristics(
  ctx: CanvasRenderingContext2D
): Record<string, number> {
  const chars: Record<string, number> = {};

  // Test specific rendering differences between engines
  ctx.font = '72px serif';

  // Em-dash rendering varies significantly
  const emDash = ctx.measureText('—');
  chars.emDashWidth = roundMetric(emDash.width);

  // Ligature support
  ctx.font = '72px serif';
  const fi = ctx.measureText('fi');
  const fAndI = ctx.measureText('f') .width + ctx.measureText('i').width;
  chars.ligatureSupport = roundMetric(fAndI - fi.width);

  // Combining character handling
  ctx.font = '72px sans-serif';
  const base = ctx.measureText('e');
  const combined = ctx.measureText('é');
  chars.combiningOffset = roundMetric(combined.width - base.width);

  // Mathematical symbol rendering
  ctx.font = '72px monospace';
  const pi = ctx.measureText('π');
  const omega = ctx.measureText('Ω');
  chars.mathSymbols = roundMetric(pi.width + omega.width);

  return chars;
}

/**
 * Main collection function for font metrics fingerprinting
 */
export async function collectFontMetrics(): Promise<ModuleResult<FontMetricsData>> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 100;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        hash: '',
        data: null as unknown as FontMetricsData,
        error: 'Canvas 2D context not available',
      };
    }

    // Collect full metrics signatures
    const signatures = collectMetrics(ctx);

    // Get key glyphs summary (compact discriminator)
    const keyGlyphsSum = getKeyGlyphsSummary(ctx);

    // Detect rendering characteristics
    const renderingChars = detectRenderingCharacteristics(ctx);

    // Calculate a combined system sum for quick comparison
    let metricsSystemSum = keyGlyphsSum;
    for (const value of Object.values(renderingChars)) {
      metricsSystemSum += value * 100;
    }
    metricsSystemSum = Math.round(metricsSystemSum);

    const data: FontMetricsData = {
      signatures,
      keyGlyphsSum,
      renderingCharacteristics: renderingChars,
      metricsSystemSum,
      codePointCount: TEST_CODEPOINTS.length,
      fontCount: TEST_FONTS.length,
    };

    const hash = await sha256(data);

    return {
      hash,
      data,
    };
  } catch (error) {
    return {
      hash: '',
      data: null as unknown as FontMetricsData,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
