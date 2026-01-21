/**
 * SVG Fingerprinting Module
 * Uses SVG text measurements for fingerprinting
 */

import type { ModuleResult, SVGData } from '../types';
import { sha256 } from '../core/crypto';
import { EMOJIS } from '../core/helpers';

// Create SVG element
function createSVGElement(): SVGSVGElement | null {
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '200');
    svg.setAttribute('height', '50');
    svg.style.position = 'absolute';
    svg.style.left = '-9999px';
    document.body.appendChild(svg);
    return svg;
  } catch {
    return null;
  }
}

// Create text element
function createTextElement(svg: SVGSVGElement, text: string): SVGTextElement {
  const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  textEl.setAttribute('x', '10');
  textEl.setAttribute('y', '30');
  textEl.setAttribute('font-size', '16');
  textEl.setAttribute('font-family', 'Arial, sans-serif');
  textEl.textContent = text;
  svg.appendChild(textEl);
  return textEl;
}

// Get bBox fingerprint
function getBBox(textEl: SVGTextElement): Record<string, number> | undefined {
  try {
    const bbox = textEl.getBBox();
    return {
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
    };
  } catch {
    return undefined;
  }
}

// Get computed text length
function getComputedTextLength(textEl: SVGTextElement): number | undefined {
  try {
    return textEl.getComputedTextLength();
  } catch {
    return undefined;
  }
}

// Get sub string length
function getSubStringLength(textEl: SVGTextElement): number | undefined {
  try {
    const text = textEl.textContent || '';
    if (text.length < 5) return undefined;
    return textEl.getSubStringLength(0, 5);
  } catch {
    return undefined;
  }
}

// Get extent of char
function getExtentOfChar(textEl: SVGTextElement): Record<string, number> | undefined {
  try {
    const rect = textEl.getExtentOfChar(0);
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  } catch {
    return undefined;
  }
}

// Calculate SVGRect system sum
function getSVGRectSystemSum(textEl: SVGTextElement): number {
  try {
    const bbox = textEl.getBBox();
    const sum = bbox.x + bbox.y + bbox.width + bbox.height;
    return Math.round(sum * 10000) / 10000;
  } catch {
    return 0;
  }
}

// Get emoji set via SVG
function getEmojiSet(svg: SVGSVGElement): string[] {
  try {
    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textEl.setAttribute('x', '0');
    textEl.setAttribute('y', '20');
    textEl.setAttribute('font-size', '16');
    svg.appendChild(textEl);

    const pattern = new Set<string>();
    const emojiSet: string[] = [];

    for (const emoji of EMOJIS) {
      textEl.textContent = emoji;
      try {
        const bbox = textEl.getBBox();
        const key = `${bbox.width.toFixed(3)},${bbox.height.toFixed(3)}`;
        if (!pattern.has(key)) {
          pattern.add(key);
          emojiSet.push(emoji);
        }
      } catch {
        // Skip failed emoji
      }
    }

    svg.removeChild(textEl);
    return emojiSet;
  } catch {
    return [];
  }
}

export async function collectSVG(): Promise<ModuleResult<SVGData>> {
  const svg = createSVGElement();

  if (!svg) {
    return {
      hash: '',
      data: {},
      error: 'SVG not supported',
    };
  }

  const textEl = createTextElement(svg, 'mmmmmmmmmmlli');

  const data: SVGData = {
    bBox: getBBox(textEl),
    computedTextLength: getComputedTextLength(textEl),
    subStringLength: getSubStringLength(textEl),
    extentOfChar: getExtentOfChar(textEl),
    svgrectSystemSum: getSVGRectSystemSum(textEl),
    emojiSet: getEmojiSet(svg),
  };

  // Cleanup
  document.body.removeChild(svg);

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
