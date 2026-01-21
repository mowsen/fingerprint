/**
 * Lie Detection Module
 * Detects API spoofing and tampering
 */

import type { ModuleResult, LiesData, LieRecord } from '../types';
import { sha256 } from '../core/crypto';

// Store detected lies globally
const detectedLies: Map<string, LieRecord> = new Map();

// Check if a function is native
function isNativeFunction(fn: unknown): boolean {
  if (typeof fn !== 'function') return false;

  try {
    const fnStr = Function.prototype.toString.call(fn);
    return (
      fnStr.includes('[native code]') &&
      !fnStr.includes('function () { [native code] }') // Proxy pattern
    );
  } catch {
    return false;
  }
}

// Check if a property descriptor has been modified
function isPropertyTampered(obj: object, prop: string): boolean {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
    if (!descriptor) return false;

    // Check if getter/setter are native
    if (descriptor.get && !isNativeFunction(descriptor.get)) {
      return true;
    }
    if (descriptor.set && !isNativeFunction(descriptor.set)) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

// Record a detected lie
function recordLie(api: string, type: string): void {
  const existing = detectedLies.get(api);
  if (existing) {
    if (!existing.lieTypes.includes(type)) {
      existing.lieTypes.push(type);
    }
    existing.hasLied = true;
  } else {
    detectedLies.set(api, {
      name: api,
      lieTypes: [type],
      hasLied: true,
    });
  }
}

// Check Navigator properties
function checkNavigatorLies(): void {
  const navigatorProps = [
    'userAgent',
    'appVersion',
    'platform',
    'vendor',
    'language',
    'languages',
    'hardwareConcurrency',
    'deviceMemory',
    'maxTouchPoints',
    'plugins',
    'mimeTypes',
  ];

  for (const prop of navigatorProps) {
    if (isPropertyTampered(navigator, prop)) {
      recordLie(`navigator.${prop}`, 'property tampered');
    }
  }

  // Check if navigator has been replaced
  if (Object.getPrototypeOf(navigator) !== Navigator.prototype) {
    recordLie('navigator', 'prototype modified');
  }
}

// Check Screen properties
function checkScreenLies(): void {
  const screenProps = ['width', 'height', 'availWidth', 'availHeight', 'colorDepth', 'pixelDepth'];

  for (const prop of screenProps) {
    if (isPropertyTampered(screen, prop)) {
      recordLie(`screen.${prop}`, 'property tampered');
    }
  }

  // Check for impossible screen values
  if (screen.width <= 0 || screen.height <= 0) {
    recordLie('screen', 'impossible dimensions');
  }

  if (screen.availWidth > screen.width || screen.availHeight > screen.height) {
    recordLie('screen', 'availWidth/availHeight larger than width/height');
  }
}

// Check Date lies
function checkDateLies(): void {
  // Check if Date has been modified
  const date = new Date();
  const tzOffset = date.getTimezoneOffset();

  // Check if Intl timezone matches Date timezone offset
  try {
    const intlTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // We can't easily validate this without a mapping, but we can check consistency
    if (intlTz && tzOffset) {
      // Just record that we checked
    }
  } catch {
    recordLie('Intl.DateTimeFormat', 'error thrown');
  }

  // Check if Date.prototype methods are native
  const dateMethods = ['getTimezoneOffset', 'toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'];
  for (const method of dateMethods) {
    if (!isNativeFunction((Date.prototype as Record<string, unknown>)[method])) {
      recordLie(`Date.prototype.${method}`, 'not native function');
    }
  }
}

// Check Canvas lies
function checkCanvasLies(): void {
  // Check Canvas methods
  const canvasMethods = ['toDataURL', 'getContext'];
  for (const method of canvasMethods) {
    if (!isNativeFunction((HTMLCanvasElement.prototype as Record<string, unknown>)[method])) {
      recordLie(`HTMLCanvasElement.${method}`, 'not native function');
    }
  }

  // Check CanvasRenderingContext2D methods
  const ctx2dMethods = ['fillText', 'strokeText', 'measureText', 'getImageData', 'fillRect'];
  for (const method of ctx2dMethods) {
    if (!isNativeFunction((CanvasRenderingContext2D.prototype as Record<string, unknown>)[method])) {
      recordLie(`CanvasRenderingContext2D.${method}`, 'not native function');
    }
  }
}

// Check WebGL lies
function checkWebGLLies(): void {
  if (typeof WebGLRenderingContext === 'undefined') return;

  const webglMethods = ['getParameter', 'getSupportedExtensions', 'getExtension'];
  for (const method of webglMethods) {
    if (!isNativeFunction((WebGLRenderingContext.prototype as Record<string, unknown>)[method])) {
      recordLie(`WebGLRenderingContext.${method}`, 'not native function');
    }
  }
}

// Check Audio lies
function checkAudioLies(): void {
  if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') return;

  const AudioCtx = AudioContext || webkitAudioContext;
  const audioMethods = ['createOscillator', 'createAnalyser', 'createGain'];

  for (const method of audioMethods) {
    if (!isNativeFunction((AudioCtx.prototype as Record<string, unknown>)[method])) {
      recordLie(`AudioContext.${method}`, 'not native function');
    }
  }
}

// Check for Proxy on common objects
function checkProxyLies(): void {
  // Check if common objects are wrapped in Proxy
  const objectsToCheck = [
    { obj: navigator, name: 'navigator' },
    { obj: screen, name: 'screen' },
    { obj: window, name: 'window' },
    { obj: document, name: 'document' },
  ];

  for (const { obj, name } of objectsToCheck) {
    try {
      // Proxied objects may throw when accessed in certain ways
      const str = Object.prototype.toString.call(obj);
      if (!str.includes('object')) {
        recordLie(name, 'proxy detected via toString');
      }
    } catch {
      recordLie(name, 'proxy detected via error');
    }
  }
}

// Check for iframe context switching
function checkIframeLies(): void {
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const iframeWindow = iframe.contentWindow;
    if (iframeWindow) {
      // Compare navigator properties between windows
      if (iframeWindow.navigator.userAgent !== navigator.userAgent) {
        recordLie('navigator.userAgent', 'iframe mismatch');
      }
      if (iframeWindow.navigator.platform !== navigator.platform) {
        recordLie('navigator.platform', 'iframe mismatch');
      }
    }

    document.body.removeChild(iframe);
  } catch {
    // Iframe check failed
  }
}

// Get total lie count
export function getLieCount(): number {
  return detectedLies.size;
}

// Run all lie detection checks
function runLieDetection(): void {
  detectedLies.clear();

  checkNavigatorLies();
  checkScreenLies();
  checkDateLies();
  checkCanvasLies();
  checkWebGLLies();
  checkAudioLies();
  checkProxyLies();
  checkIframeLies();
}

export async function collectLies(): Promise<ModuleResult<LiesData>> {
  runLieDetection();

  const liesObject: Record<string, Array<{ name: string; lieTypes: string[] }>> = {};

  detectedLies.forEach((lie, api) => {
    const category = api.split('.')[0] || 'other';
    if (!liesObject[category]) {
      liesObject[category] = [];
    }
    liesObject[category].push({
      name: lie.name,
      lieTypes: lie.lieTypes,
    });
  });

  const data: LiesData = {
    totalLies: detectedLies.size,
    data: Object.keys(liesObject).length > 0 ? liesObject : undefined,
  };

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
