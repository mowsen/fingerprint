/**
 * DOMRect Fingerprinting Module
 * Uses element measurements for fingerprinting
 */

import type { ModuleResult, DOMRectData } from '../types';
import { sha256 } from '../core/crypto';
import { CSS_FONT_FAMILY, EMOJIS } from '../core/helpers';

// Get element bounding client rect
function getElementBoundingClientRect(): Record<string, number> | undefined {
  try {
    const element = document.createElement('div');
    element.style.cssText = `
      position: absolute;
      left: -9999px;
      font-family: ${CSS_FONT_FAMILY};
      font-size: 16px;
      line-height: normal;
    `;
    element.textContent = 'mmmmmmmmmmlli';
    document.body.appendChild(element);

    const rect = element.getBoundingClientRect();
    document.body.removeChild(element);

    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
    };
  } catch {
    return undefined;
  }
}

// Get element client rects
function getElementClientRects(): string | undefined {
  try {
    const element = document.createElement('span');
    element.style.cssText = `
      position: absolute;
      left: -9999px;
      font-family: ${CSS_FONT_FAMILY};
      font-size: 16px;
    `;
    element.textContent = 'test text for client rects';
    document.body.appendChild(element);

    const rects = element.getClientRects();
    const rectData: string[] = [];

    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      rectData.push(`${rect.width},${rect.height}`);
    }

    document.body.removeChild(element);
    return rectData.join('|');
  } catch {
    return undefined;
  }
}

// Get range bounding client rect
function getRangeBoundingClientRect(): Record<string, number> | undefined {
  try {
    const element = document.createElement('div');
    element.style.cssText = `
      position: absolute;
      left: -9999px;
      font-family: ${CSS_FONT_FAMILY};
      font-size: 16px;
    `;
    element.innerHTML = 'text <span>with</span> <em>markup</em>';
    document.body.appendChild(element);

    const range = document.createRange();
    range.selectNodeContents(element);
    const rect = range.getBoundingClientRect();

    document.body.removeChild(element);

    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
    };
  } catch {
    return undefined;
  }
}

// Get range client rects
function getRangeClientRects(): string | undefined {
  try {
    const element = document.createElement('div');
    element.style.cssText = `
      position: absolute;
      left: -9999px;
      font-family: ${CSS_FONT_FAMILY};
      font-size: 16px;
      width: 200px;
    `;
    element.innerHTML = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
    document.body.appendChild(element);

    const range = document.createRange();
    range.selectNodeContents(element);
    const rects = range.getClientRects();

    const rectData: string[] = [];
    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      rectData.push(`${rect.width.toFixed(2)},${rect.height.toFixed(2)}`);
    }

    document.body.removeChild(element);
    return rectData.join('|');
  } catch {
    return undefined;
  }
}

// Calculate system sum from DOMRect
function getDOMRectSystemSum(): number {
  try {
    const element = document.createElement('div');
    element.style.cssText = `
      position: absolute;
      left: -9999px;
      font-family: ${CSS_FONT_FAMILY};
      font-size: 16px;
    `;
    element.textContent = 'abcdefghijklmnopqrstuvwxyz';
    document.body.appendChild(element);

    const rect = element.getBoundingClientRect();
    document.body.removeChild(element);

    const sum = rect.width + rect.height + rect.x + rect.y;
    return Math.round(sum * 10000) / 10000;
  } catch {
    return 0;
  }
}

// Get emoji rendering variations via DOMRect
function getEmojiSet(): string[] {
  try {
    const element = document.createElement('span');
    element.style.cssText = `
      position: absolute;
      left: -9999px;
      font-size: 16px;
    `;
    document.body.appendChild(element);

    const pattern = new Set<string>();
    const emojiSet: string[] = [];

    for (const emoji of EMOJIS) {
      element.textContent = emoji;
      const rect = element.getBoundingClientRect();
      const key = `${rect.width.toFixed(3)},${rect.height.toFixed(3)}`;

      if (!pattern.has(key)) {
        pattern.add(key);
        emojiSet.push(emoji);
      }
    }

    document.body.removeChild(element);
    return emojiSet;
  } catch {
    return [];
  }
}

export async function collectDOMRect(): Promise<ModuleResult<DOMRectData>> {
  const data: DOMRectData = {
    domrectSystemSum: getDOMRectSystemSum(),
    elementBoundingClientRect: getElementBoundingClientRect(),
    elementClientRects: getElementClientRects(),
    rangeBoundingClientRect: getRangeBoundingClientRect(),
    rangeClientRects: getRangeClientRects(),
    emojiSet: getEmojiSet(),
  };

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
