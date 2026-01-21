/**
 * Canvas Fingerprinting Module
 * Uses 2D canvas rendering differences to generate unique fingerprints
 */

import type { ModuleResult, CanvasData } from '../types';
import { sha256 } from '../core/crypto';
import { CSS_FONT_FAMILY, EMOJIS, IS_WEBKIT, attempt } from '../core/helpers';

/**
 * Multi-render consensus - filter out noise from anti-fingerprinting tools
 * Renders multiple times and picks the most common byte value per pixel channel
 * This dramatically improves stability against Brave farbling and similar tools
 */
function getMostCommonPixels(imageDatas: ImageData[], width: number, height: number): ImageData {
  const result = new ImageData(width, height);
  const channelCount = width * height * 4;

  for (let i = 0; i < channelCount; i++) {
    // Count frequency of each byte value across all renders
    const counts = new Map<number, number>();
    for (const imageData of imageDatas) {
      const val = imageData.data[i];
      counts.set(val, (counts.get(val) || 0) + 1);
    }

    // Pick most frequent value
    let maxCount = 0;
    let mostCommon = 0;
    for (const [val, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = val;
      }
    }
    result.data[i] = mostCommon;
  }
  return result;
}

/**
 * Render canvas with consensus - renders multiple times to filter noise
 */
function renderWithConsensus(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  renderFn: () => void,
  renderCount = 3
): string {
  const width = canvas.width;
  const height = canvas.height;
  const imageDatas: ImageData[] = [];

  for (let i = 0; i < renderCount; i++) {
    // Clear and re-render
    context.clearRect(0, 0, width, height);
    renderFn();
    imageDatas.push(context.getImageData(0, 0, width, height));
  }

  // Get consensus pixels
  const consensusData = getMostCommonPixels(imageDatas, width, height);

  // Put consensus data back on canvas and get dataURL
  context.putImageData(consensusData, 0, 0);
  return canvas.toDataURL();
}

// Picasso-like canvas painting for fingerprinting
interface PaintOptions {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  strokeText?: boolean;
  cssFontFamily?: string;
  area?: { width: number; height: number };
  rounds?: number;
  maxShadowBlur?: number;
  seed?: number;
  offset?: number;
  multiplier?: number;
}

const COLORS = [
  '#FF6633', '#FFB399', '#FF33FF', '#FFFF99', '#00B3E6',
  '#E6B333', '#3366E6', '#999966', '#99FF99', '#B34D4D',
  '#80B300', '#809900', '#E6B3B3', '#6680B3', '#66991A',
  '#FF99E6', '#CCFF1A', '#FF1A66', '#E6331A', '#33FFCC',
  '#66994D', '#B366CC', '#4D8000', '#B33300', '#CC80CC',
  '#66664D', '#991AFF', '#E666FF', '#4DB3FF', '#1AB399',
];

function createPicassoSeed(seed: number, offset: number, multiplier: number) {
  let current = seed % offset;
  return {
    getNextSeed: () => {
      current = (multiplier * current) % offset;
      return current;
    },
  };
}

function patchSeed(current: number, offset: number, maxBound?: number, computeFloat = false): number {
  const result = (((current - 1) / offset) * (maxBound || 1)) || 0;
  return computeFloat ? result : Math.floor(result);
}

function paintCanvas({
  canvas,
  context,
  strokeText = false,
  cssFontFamily = CSS_FONT_FAMILY,
  area = { width: 50, height: 50 },
  rounds = 10,
  maxShadowBlur = 50,
  seed = 500,
  offset = 2001000001,
  multiplier = 15000,
}: PaintOptions): void {
  if (!context) return;

  context.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = area.width;
  canvas.height = area.height;

  if (canvas.style) {
    canvas.style.display = 'none';
  }

  const { getNextSeed } = createPicassoSeed(seed, offset, multiplier);
  const { width, height } = area;

  const addRandomGradient = () => {
    const gradient = context.createRadialGradient(
      patchSeed(getNextSeed(), offset, width),
      patchSeed(getNextSeed(), offset, height),
      patchSeed(getNextSeed(), offset, width),
      patchSeed(getNextSeed(), offset, width),
      patchSeed(getNextSeed(), offset, height),
      patchSeed(getNextSeed(), offset, width)
    );
    gradient.addColorStop(0, COLORS[patchSeed(getNextSeed(), offset, COLORS.length)]);
    gradient.addColorStop(1, COLORS[patchSeed(getNextSeed(), offset, COLORS.length)]);
    context.fillStyle = gradient;
  };

  const drawOutlineText = () => {
    const fontSize = 2.99;
    context.font = `${height / fontSize}px ${cssFontFamily}`;
    context.strokeText(
      '👾A',
      patchSeed(getNextSeed(), offset, width),
      patchSeed(getNextSeed(), offset, height),
      patchSeed(getNextSeed(), offset, width)
    );
  };

  const createCircularArc = () => {
    context.beginPath();
    context.arc(
      patchSeed(getNextSeed(), offset, width),
      patchSeed(getNextSeed(), offset, height),
      patchSeed(getNextSeed(), offset, Math.min(width, height)),
      patchSeed(getNextSeed(), offset, 2 * Math.PI, true),
      patchSeed(getNextSeed(), offset, 2 * Math.PI, true)
    );
    context.stroke();
  };

  const createBezierCurve = () => {
    context.beginPath();
    context.moveTo(
      patchSeed(getNextSeed(), offset, width),
      patchSeed(getNextSeed(), offset, height)
    );
    context.bezierCurveTo(
      patchSeed(getNextSeed(), offset, width),
      patchSeed(getNextSeed(), offset, height),
      patchSeed(getNextSeed(), offset, width),
      patchSeed(getNextSeed(), offset, height),
      patchSeed(getNextSeed(), offset, width),
      patchSeed(getNextSeed(), offset, height)
    );
    context.stroke();
  };

  const createQuadraticCurve = () => {
    context.beginPath();
    context.moveTo(
      patchSeed(getNextSeed(), offset, width),
      patchSeed(getNextSeed(), offset, height)
    );
    context.quadraticCurveTo(
      patchSeed(getNextSeed(), offset, width),
      patchSeed(getNextSeed(), offset, height),
      patchSeed(getNextSeed(), offset, width),
      patchSeed(getNextSeed(), offset, height)
    );
    context.stroke();
  };

  const createEllipticalArc = () => {
    if (!('ellipse' in context)) return;
    context.beginPath();
    context.ellipse(
      patchSeed(getNextSeed(), offset, width),
      patchSeed(getNextSeed(), offset, height),
      patchSeed(getNextSeed(), offset, Math.floor(width / 2)),
      patchSeed(getNextSeed(), offset, Math.floor(height / 2)),
      patchSeed(getNextSeed(), offset, 2 * Math.PI, true),
      patchSeed(getNextSeed(), offset, 2 * Math.PI, true),
      patchSeed(getNextSeed(), offset, 2 * Math.PI, true)
    );
    context.stroke();
  };

  const methods = [createCircularArc, createBezierCurve, createQuadraticCurve];
  if (!IS_WEBKIT) methods.push(createEllipticalArc);
  if (strokeText) methods.push(drawOutlineText);

  for (let i = 0; i < rounds; i++) {
    addRandomGradient();
    context.shadowBlur = patchSeed(getNextSeed(), offset, maxShadowBlur, true);
    context.shadowColor = COLORS[patchSeed(getNextSeed(), offset, COLORS.length)];
    const nextMethod = methods[patchSeed(getNextSeed(), offset, methods.length)];
    nextMethod();
    context.fill();
  }
}

// Get pixel modification detection
function getPixelMods(): { rgba?: string; pixels?: number } | undefined {
  try {
    const len = 8;
    const alpha = 255;

    const canvas1 = document.createElement('canvas');
    const canvas2 = document.createElement('canvas');
    const context1 = canvas1.getContext('2d', { willReadFrequently: true });
    const context2 = canvas2.getContext('2d', { willReadFrequently: true });

    if (!context1 || !context2) return undefined;

    canvas1.width = len;
    canvas1.height = len;
    canvas2.width = len;
    canvas2.height = len;

    const pattern1: string[] = [];
    const pattern2: string[] = [];

    // Fill canvas1 with deterministic colors based on position
    // This ensures consistent results across page refreshes
    for (let x = 0; x < len; x++) {
      for (let y = 0; y < len; y++) {
        const red = (x * 32) % 256;
        const green = (y * 32) % 256;
        const blue = ((x + y) * 16) % 256;
        const colors = `${red}, ${green}, ${blue}, ${alpha}`;
        context1.fillStyle = `rgba(${colors})`;
        context1.fillRect(x, y, 1, 1);
        pattern1.push(colors);
      }
    }

    // Fill canvas2 with canvas1 image data
    for (let x = 0; x < len; x++) {
      for (let y = 0; y < len; y++) {
        const imageData = context1.getImageData(x, y, 1, 1);
        const [red, green, blue, a] = imageData?.data || [];
        const colors = `${red}, ${green}, ${blue}, ${a}`;
        context2.fillStyle = `rgba(${colors})`;
        context2.fillRect(x, y, 1, 1);
        pattern2.push(colors);
      }
    }

    // Compare patterns and collect diffs
    const patternDiffs: Array<[number, string]> = [];
    const rgbaChannels = new Set<string>();

    for (let i = 0; i < pattern1.length; i++) {
      if (pattern1[i] !== pattern2[i]) {
        const rgba1 = pattern1[i].split(',');
        const rgba2 = pattern2[i].split(',');
        const colors = [
          rgba1[0] !== rgba2[0] ? 'r' : '',
          rgba1[1] !== rgba2[1] ? 'g' : '',
          rgba1[2] !== rgba2[2] ? 'b' : '',
          rgba1[3] !== rgba2[3] ? 'a' : '',
        ].join('');
        rgbaChannels.add(colors);
        patternDiffs.push([i, colors]);
      }
    }

    return {
      rgba: rgbaChannels.size ? [...rgbaChannels].sort().join(', ') : undefined,
      pixels: patternDiffs.length || undefined,
    };
  } catch {
    return undefined;
  }
}

// Get text metrics fingerprint
function getTextMetrics(context: CanvasRenderingContext2D): {
  textMetrics?: CanvasData['textMetrics'];
  textMetricsSystemSum?: number;
  emojiSet?: string[];
  liedTextMetrics?: boolean;
} {
  try {
    context.font = `10px ${CSS_FONT_FAMILY}`;
    const pattern = new Set<string>();
    const emojiSet: string[] = [];

    for (const emoji of EMOJIS) {
      const metrics = context.measureText(emoji);
      const dimensions = [
        metrics.actualBoundingBoxAscent,
        metrics.actualBoundingBoxDescent,
        metrics.actualBoundingBoxLeft,
        metrics.actualBoundingBoxRight,
        metrics.fontBoundingBoxAscent,
        metrics.fontBoundingBoxDescent,
        metrics.width,
      ].join(',');

      if (!pattern.has(dimensions)) {
        pattern.add(dimensions);
        emojiSet.push(emoji);
      }
    }

    // Calculate system sum
    const textMetricsSystemSum = 0.00001 * [...pattern]
      .map((x) => x.split(',').reduce((acc, val) => acc + (+val || 0), 0))
      .reduce((acc, x) => acc + x, 0);

    // Get single character metrics for data
    const testMetrics = context.measureText('A');
    const textMetrics: CanvasData['textMetrics'] = {
      width: testMetrics.width,
      actualBoundingBoxAscent: testMetrics.actualBoundingBoxAscent,
      actualBoundingBoxDescent: testMetrics.actualBoundingBoxDescent,
      actualBoundingBoxLeft: testMetrics.actualBoundingBoxLeft,
      actualBoundingBoxRight: testMetrics.actualBoundingBoxRight,
      fontBoundingBoxAscent: testMetrics.fontBoundingBoxAscent,
      fontBoundingBoxDescent: testMetrics.fontBoundingBoxDescent,
    };

    return {
      textMetrics,
      textMetricsSystemSum,
      emojiSet,
      liedTextMetrics: false,
    };
  } catch {
    return { liedTextMetrics: true };
  }
}

export async function collectCanvas(): Promise<ModuleResult<CanvasData>> {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    return {
      hash: '',
      data: {
        dataURI: '',
      },
      error: 'Canvas context blocked',
    };
  }

  // Main painting fingerprint with multi-render consensus
  const imageSize = IS_WEBKIT ? 50 : 75;
  canvas.width = imageSize;
  canvas.height = imageSize;

  const dataURI = renderWithConsensus(canvas, context, () => {
    paintCanvas({
      canvas,
      context,
      strokeText: true,
      cssFontFamily: CSS_FONT_FAMILY,
      area: { width: imageSize, height: imageSize },
      rounds: 10,
    });
  });

  // Get pixel modifications
  const mods = getPixelMods();

  // Get text metrics
  const textMetricsData = getTextMetrics(context);

  // Paint-only fingerprint with consensus
  canvas.width = 75;
  canvas.height = 75;
  const paintURI = renderWithConsensus(canvas, context, () => {
    paintCanvas({
      canvas,
      context,
      area: { width: 75, height: 75 },
    });
  });

  // Text fingerprint with consensus
  canvas.width = 50;
  canvas.height = 50;
  const textURI = renderWithConsensus(canvas, context, () => {
    context.font = `50px ${CSS_FONT_FAMILY}`;
    context.fillText('A', 7, 37);
  });

  // Emoji fingerprint with consensus
  canvas.width = 50;
  canvas.height = 50;
  const emojiURI = renderWithConsensus(canvas, context, () => {
    context.font = `35px ${CSS_FONT_FAMILY}`;
    context.fillText('👾', 0, 37);
  });

  const data: CanvasData = {
    dataURI,
    textURI,
    emojiURI,
    paintURI,
    textMetrics: textMetricsData.textMetrics,
    textMetricsSystemSum: textMetricsData.textMetricsSystemSum,
    mods,
    emojiSet: textMetricsData.emojiSet,
    liedTextMetrics: textMetricsData.liedTextMetrics,
  };

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
