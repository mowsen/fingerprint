/**
 * CSS Fingerprinting Module
 * Collects computed styles and system colors
 */

import type { ModuleResult, CSSData } from '../types';
import { sha256 } from '../core/crypto';

// System colors to test
const SYSTEM_COLORS = [
  'ActiveBorder',
  'ActiveCaption',
  'AppWorkspace',
  'Background',
  'ButtonFace',
  'ButtonHighlight',
  'ButtonShadow',
  'ButtonText',
  'CaptionText',
  'GrayText',
  'Highlight',
  'HighlightText',
  'InactiveBorder',
  'InactiveCaption',
  'InactiveCaptionText',
  'InfoBackground',
  'InfoText',
  'Menu',
  'MenuText',
  'Scrollbar',
  'ThreeDDarkShadow',
  'ThreeDFace',
  'ThreeDHighlight',
  'ThreeDLightShadow',
  'ThreeDShadow',
  'Window',
  'WindowFrame',
  'WindowText',
  'Canvas',
  'CanvasText',
  'LinkText',
  'VisitedText',
  'AccentColor',
  'AccentColorText',
];

// CSS properties to fingerprint
const CSS_PROPERTIES = [
  'font-family',
  'font-size',
  'line-height',
  'color',
  'background-color',
  '-webkit-text-fill-color',
  '-webkit-text-stroke-color',
  'caret-color',
  'outline-color',
];

// Get computed style fingerprint
function getComputedStyleFingerprint(): Record<string, string> | undefined {
  try {
    const element = document.createElement('div');
    element.style.cssText = 'position: absolute; left: -9999px;';
    element.textContent = 'test';
    document.body.appendChild(element);

    const computed = getComputedStyle(element);
    const result: Record<string, string> = {};

    for (const prop of CSS_PROPERTIES) {
      const value = computed.getPropertyValue(prop);
      if (value) {
        result[prop] = value;
      }
    }

    document.body.removeChild(element);
    return result;
  } catch {
    return undefined;
  }
}

// Get system colors
function getSystemColors(): Record<string, string> | undefined {
  try {
    const element = document.createElement('div');
    element.style.cssText = 'position: absolute; left: -9999px;';
    document.body.appendChild(element);

    const result: Record<string, string> = {};

    for (const color of SYSTEM_COLORS) {
      element.style.color = color;
      const computed = getComputedStyle(element).color;
      if (computed && computed !== color) {
        result[color] = computed;
      }
    }

    document.body.removeChild(element);
    return Object.keys(result).length > 0 ? result : undefined;
  } catch {
    return undefined;
  }
}

// Get default styles for various elements
function getElementDefaultStyles(): Record<string, string> {
  try {
    const elements = ['button', 'input', 'select', 'textarea', 'a'];
    const result: Record<string, string> = {};

    for (const tagName of elements) {
      const element = document.createElement(tagName);
      element.style.cssText = 'position: absolute; left: -9999px;';
      document.body.appendChild(element);

      const computed = getComputedStyle(element);
      result[tagName] = [
        computed.fontFamily,
        computed.fontSize,
        computed.fontWeight,
        computed.color,
        computed.backgroundColor,
      ].join('|');

      document.body.removeChild(element);
    }

    return result;
  } catch {
    return {};
  }
}

export async function collectCSS(): Promise<ModuleResult<CSSData>> {
  const data: CSSData = {
    computedStyle: getComputedStyleFingerprint(),
    system: getSystemColors(),
  };

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
