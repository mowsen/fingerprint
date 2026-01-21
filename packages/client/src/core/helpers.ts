/**
 * Helper utilities for fingerprinting
 */

import type { EngineInfo, JSEngine, BrowserEngine } from '../types';

// Check if running in worker scope
export const IS_WORKER_SCOPE = typeof document === 'undefined' && typeof WorkerGlobalScope !== 'undefined';

// Detect JS engine by error message length
function getEngineIdentifier(): number {
  const x = [].constructor;
  try {
    (-1).toFixed(-1);
  } catch (err) {
    return (err as Error).message.length + (x + '').split((x as { name: string }).name).join('').length;
  }
  return 0;
}

const ENGINE_IDENTIFIER = getEngineIdentifier();

export const IS_BLINK = ENGINE_IDENTIFIER === 80;
export const IS_GECKO = ENGINE_IDENTIFIER === 58;
export const IS_WEBKIT = ENGINE_IDENTIFIER === 77;

export const JS_ENGINE: JSEngine = ({
  80: 'V8',
  58: 'SpiderMonkey',
  77: 'JavaScriptCore',
} as const)[ENGINE_IDENTIFIER] || null;

export const BROWSER_ENGINE: BrowserEngine = IS_BLINK ? 'Blink' : IS_GECKO ? 'Gecko' : IS_WEBKIT ? 'WebKit' : null;

export function getEngineInfo(): EngineInfo {
  return {
    jsEngine: JS_ENGINE,
    browserEngine: BROWSER_ENGINE,
    isBlink: IS_BLINK,
    isGecko: IS_GECKO,
    isWebKit: IS_WEBKIT,
  };
}

// Check for Brave browser
export const LIKE_BRAVE = IS_BLINK && 'flat' in Array.prototype && !('ReportingObserver' in self);

export function isBraveBrowser(): boolean {
  try {
    return (
      'brave' in navigator &&
      // @ts-expect-error - brave is not in Navigator type
      Object.getPrototypeOf(navigator.brave).constructor.name === 'Brave' &&
      // @ts-expect-error
      navigator.brave.isBrave.toString() === 'function isBrave() { [native code] }'
    );
  } catch {
    return false;
  }
}

// Timer utility
export function createTimer(): { stop: () => number } {
  const start = performance.now();
  return {
    stop: () => Math.round(performance.now() - start),
  };
}

// Queue event for async execution
export function queueEvent<T>(fn: () => T | Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      try {
        resolve(await fn());
      } catch (e) {
        reject(e);
      }
    }, 0);
  });
}

// CSS font family for canvas text rendering
export const CSS_FONT_FAMILY = `
  'Segoe UI', 'Helvetica Neue', Helvetica, Arial,
  'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji',
  sans-serif
`.trim();

// Emoji test set for fingerprinting
export const EMOJIS = [
  '😀', '😃', '😄', '😁', '😅', '🤣', '😂', '🙂', '😉', '😍',
  '🥰', '😘', '😋', '🤪', '🧐', '🤓', '😎', '🥳', '😏', '😒',
  '🙄', '😬', '🤥', '🌚', '🌝', '🌞', '⭐', '🌟', '✨', '⚡',
  '🔥', '💧', '🌊', '🎄', '🎁', '🎈', '🎉', '🎊', '🎀', '🎗️',
];

// Hash slice utility for display
export function hashSlice(hash: string): string {
  return hash.slice(0, 8);
}

// Format emoji set for comparison
export function formatEmojiSet(emojiSet: string[]): string {
  return emojiSet.join('');
}

// Platform detection from user agent
export function getReportedPlatform(userAgent: string): [string, string] {
  const platforms: Array<[RegExp, string, string]> = [
    [/Windows NT 10\.0/, 'Windows', 'Windows 10/11'],
    [/Windows NT 6\.3/, 'Windows', 'Windows 8.1'],
    [/Windows NT 6\.2/, 'Windows', 'Windows 8'],
    [/Windows NT 6\.1/, 'Windows', 'Windows 7'],
    [/Windows/, 'Windows', 'Windows'],
    [/Mac OS X 10[._](\d+)/, 'macOS', 'macOS'],
    [/Mac OS X/, 'macOS', 'macOS'],
    [/iPhone|iPad|iPod/, 'iOS', 'iOS'],
    [/Android/, 'Android', 'Android'],
    [/Linux/, 'Linux', 'Linux'],
    [/CrOS/, 'Chrome OS', 'Chrome OS'],
  ];

  for (const [regex, platform, display] of platforms) {
    if (regex.test(userAgent)) {
      return [platform, display];
    }
  }
  return ['Unknown', 'Unknown'];
}

// Get OS from user agent (more detailed)
export function getOS(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('windows nt 10')) return 'Windows 10';
  if (ua.includes('windows nt 6.3')) return 'Windows 8.1';
  if (ua.includes('windows nt 6.2')) return 'Windows 8';
  if (ua.includes('windows nt 6.1')) return 'Windows 7';
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('mac os x')) {
    const match = ua.match(/mac os x (\d+[._]\d+)/);
    if (match) {
      return `macOS ${match[1].replace('_', '.')}`;
    }
    return 'macOS';
  }
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
  if (ua.includes('android')) {
    const match = ua.match(/android (\d+\.?\d*)/);
    return match ? `Android ${match[1]}` : 'Android';
  }
  if (ua.includes('linux')) return 'Linux';
  if (ua.includes('cros')) return 'Chrome OS';
  return 'Unknown';
}

// Attempt to run a function and capture errors
export async function attempt<T>(
  fn: () => T | Promise<T>,
  defaultValue?: T
): Promise<{ value: T | undefined; error?: string }> {
  try {
    const value = await fn();
    return { value };
  } catch (e) {
    return {
      value: defaultValue,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// Capture error details
export function captureError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

// Generate unique instance ID
export function generateInstanceId(): string {
  return (
    String.fromCharCode(Math.random() * 26 + 97) +
    Math.random().toString(36).slice(-7)
  );
}

// Analysis result helper
export interface AnalysisResult {
  value: unknown;
  trust: 'high' | 'medium' | 'low';
  entropy: number;
}

// Calculate entropy bits from unique values
export function calculateEntropyBits(uniqueCount: number, totalSamples: number): number {
  if (uniqueCount <= 1 || totalSamples <= 1) return 0;
  const probability = 1 / uniqueCount;
  return -Math.log2(probability);
}

// Deep clone an object
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Safe JSON stringify
export function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return '';
  }
}

// Check if value is truthy and not empty
export function isValid(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === 'object' && Object.keys(value).length === 0) return false;
  return true;
}

// Get nested value from object with dot notation
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: unknown, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// Flatten object with dot notation keys
export function flattenObject(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

// Performance logger
export function createPerformanceLogger(debug: boolean) {
  return {
    log: (message: string, duration?: number) => {
      if (debug) {
        const durationStr = duration !== undefined ? ` (${duration}ms)` : '';
        // eslint-disable-next-line no-console
        console.log(`[Fingerprint]${durationStr} ${message}`);
      }
    },
  };
}
