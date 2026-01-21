/**
 * Privacy Tool Resistance Detection Module
 * Detects anti-fingerprinting tools and privacy extensions
 * Inspired by CreepJS techniques for lie detection and phantom iframe testing
 */

import type { ModuleResult, ResistanceData } from '../types';
import { sha256 } from '../core/crypto';
import { IS_BLINK, IS_GECKO, IS_WEBKIT, LIKE_BRAVE, isBraveBrowser } from '../core/helpers';

// Timer precision detection for Firefox resistFingerprinting
async function detectTimerPrecision(): Promise<{ reduced: boolean; precision: number }> {
  try {
    const samples: number[] = [];
    const baseDate = Date.now();

    // Collect 10 samples with small delays
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, i));
      samples.push(Date.now() - baseDate);
    }

    // Check if all samples end with same digit (indicates reduced precision)
    const lastDigits = samples.map((s) => s % 10);
    const allSame = lastDigits.every((d) => d === lastDigits[0]);

    // Calculate precision
    const uniqueValues = new Set(samples);
    const precision = uniqueValues.size === 1 ? 100 : Math.round(100 / uniqueValues.size);

    return { reduced: allSame && samples.length > 5, precision };
  } catch {
    return { reduced: false, precision: 1 };
  }
}

// Phantom iframe technique - detect API hooks by comparing contexts
function detectPhantomLies(): { hasPhantomLies: boolean; phantomSignature: string } {
  try {
    // Create a hidden "phantom" iframe
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;left:-10000px;visibility:hidden;';
    div.innerHTML = '<iframe></iframe>';
    document.body.appendChild(div);

    const iframe = div.querySelector('iframe');
    if (!iframe || !iframe.contentWindow) {
      document.body.removeChild(div);
      return { hasPhantomLies: false, phantomSignature: '' };
    }

    const phantomWindow = iframe.contentWindow;
    const signatures: string[] = [];

    // Compare navigator properties between main and phantom
    const mainNav = window.navigator;
    const phantomNav = phantomWindow.navigator;

    // Check for inconsistencies (extensions often hook main but not iframe)
    const checks = [
      ['userAgent', mainNav.userAgent === phantomNav.userAgent],
      ['platform', mainNav.platform === phantomNav.platform],
      ['hardwareConcurrency', mainNav.hardwareConcurrency === phantomNav.hardwareConcurrency],
      ['deviceMemory', (mainNav as Navigator & { deviceMemory?: number }).deviceMemory ===
        (phantomNav as Navigator & { deviceMemory?: number }).deviceMemory],
    ];

    for (const [name, matches] of checks) {
      if (!matches) {
        signatures.push(name);
      }
    }

    // Check Function.toString for proxy detection
    try {
      const mainToString = Function.prototype.toString.call(mainNav.userAgent.constructor);
      const phantomToString = Function.prototype.toString.call(phantomNav.userAgent.constructor);
      if (mainToString !== phantomToString) {
        signatures.push('toString');
      }
    } catch {
      signatures.push('toStringError');
    }

    // Cleanup
    document.body.removeChild(div);

    return {
      hasPhantomLies: signatures.length > 0,
      phantomSignature: signatures.sort().join(','),
    };
  } catch {
    return { hasPhantomLies: false, phantomSignature: 'error' };
  }
}

// Detect cross-scope inconsistencies (main thread vs what we collected in worker)
function detectCrossScopeLies(workerData?: {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  platform?: string;
}): { hasCrossScopeLies: boolean; inconsistencies: string[] } {
  const inconsistencies: string[] = [];

  if (!workerData) {
    return { hasCrossScopeLies: false, inconsistencies: [] };
  }

  // Compare main thread vs worker scope
  if (workerData.hardwareConcurrency !== undefined &&
      navigator.hardwareConcurrency !== workerData.hardwareConcurrency) {
    inconsistencies.push('hardwareConcurrency');
  }

  const navWithMemory = navigator as Navigator & { deviceMemory?: number };
  if (workerData.deviceMemory !== undefined &&
      navWithMemory.deviceMemory !== workerData.deviceMemory) {
    inconsistencies.push('deviceMemory');
  }

  if (workerData.platform !== undefined &&
      navigator.platform !== workerData.platform) {
    inconsistencies.push('platform');
  }

  return {
    hasCrossScopeLies: inconsistencies.length > 0,
    inconsistencies,
  };
}

// Farbling detection result
export interface FarblingInfo {
  isFarbled: boolean;
  farblingLevel: 'off' | 'standard' | 'strict';
}

// Detect browser canvas farbling (Brave, etc.)
export function detectCanvasFarbling(): FarblingInfo {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { isFarbled: false, farblingLevel: 'off' };

    canvas.width = 10;
    canvas.height = 10;

    // Draw same thing twice
    ctx.fillStyle = 'rgb(255, 0, 0)';
    ctx.fillRect(0, 0, 10, 10);
    const data1 = canvas.toDataURL();

    ctx.fillStyle = 'rgb(255, 0, 0)';
    ctx.fillRect(0, 0, 10, 10);
    const data2 = canvas.toDataURL();

    // Clear and draw again
    ctx.clearRect(0, 0, 10, 10);
    ctx.fillStyle = 'rgb(255, 0, 0)';
    ctx.fillRect(0, 0, 10, 10);
    const data3 = canvas.toDataURL();

    // If any differ, browser is farbling
    if (data1 !== data2 || data2 !== data3) {
      return { isFarbled: true, farblingLevel: 'strict' };
    }

    // Check for Brave shield (even without strict farbling)
    // @ts-expect-error - brave property
    if (navigator.brave) {
      return { isFarbled: true, farblingLevel: 'standard' };
    }

    return { isFarbled: false, farblingLevel: 'off' };
  } catch {
    return { isFarbled: false, farblingLevel: 'off' };
  }
}

// Detect Brave browser privacy features
function detectBravePrivacy(): { detected: boolean; mode?: string } {
  if (!LIKE_BRAVE && !isBraveBrowser()) {
    return { detected: false };
  }

  // Check for Brave shields
  // @ts-expect-error - brave property
  const brave = navigator.brave;
  if (brave) {
    return { detected: true, mode: 'shields' };
  }

  // Check for farbled values (Brave randomizes certain APIs)
  const farblingInfo = detectCanvasFarbling();
  if (farblingInfo.isFarbled) {
    return { detected: true, mode: farblingInfo.farblingLevel };
  }

  return { detected: true, mode: 'standard' };
}

// Detect Firefox privacy features
function detectFirefoxPrivacy(): { detected: boolean; mode?: string } {
  if (!IS_GECKO) {
    return { detected: false };
  }

  // Check for privacy.resistFingerprinting
  // This causes certain APIs to return fake values
  try {
    // Check if screen dimensions match common resolutions (privacy mode rounds them)
    const commonWidths = [1000, 1200, 1400, 1600, 1920];
    const isRounded = commonWidths.includes(screen.width) && screen.width === screen.availWidth;

    if (isRounded) {
      return { detected: true, mode: 'resist fingerprinting' };
    }

    // Check for timezone spoofing (returns UTC in privacy mode)
    if (new Date().getTimezoneOffset() === 0) {
      return { detected: true, mode: 'resist fingerprinting' };
    }
  } catch {
    // Ignore
  }

  // Check for Enhanced Tracking Protection
  try {
    // @ts-expect-error - trackingProtection
    if (navigator.trackingProtection) {
      return { detected: true, mode: 'enhanced tracking protection' };
    }
  } catch {
    // Ignore
  }

  return { detected: false };
}

// Detect Safari ITP (Intelligent Tracking Prevention)
function detectSafariPrivacy(): { detected: boolean; mode?: string } {
  if (!IS_WEBKIT) {
    return { detected: false };
  }

  // Safari has ITP enabled by default
  // Check for reduced storage access
  try {
    // Safari limits localStorage in cross-site contexts
    localStorage.setItem('fp_test', '1');
    localStorage.removeItem('fp_test');
  } catch {
    return { detected: true, mode: 'ITP' };
  }

  return { detected: true, mode: 'standard' };
}

// Detect Privacy Badger
function detectPrivacyBadger(): boolean {
  try {
    // Privacy Badger blocks certain tracking requests
    // We can't directly detect it, but check for its patterns
    // @ts-expect-error - privacy badger
    if (window.__pb || document.__pb) {
      return true;
    }
  } catch {
    // Ignore
  }
  return false;
}

// Detect uBlock Origin
function detectUBlockOrigin(): boolean {
  try {
    // uBlock might inject specific elements
    const testUrl = 'https://example.com/ads/ad.js';
    // We can't actually test this without making a request
  } catch {
    // Ignore
  }
  return false;
}

// Detect Canvas Blocker/Defender extensions
function detectCanvasBlocker(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;

    canvas.width = 1;
    canvas.height = 1;
    ctx.fillStyle = 'rgb(255, 0, 0)';
    ctx.fillRect(0, 0, 1, 1);

    const imageData = ctx.getImageData(0, 0, 1, 1);
    // Canvas blockers might return noise or blocked data
    if (imageData.data[0] !== 255 || imageData.data[1] !== 0 || imageData.data[2] !== 0) {
      return true;
    }
  } catch {
    return true;
  }
  return false;
}

// Detect WebGL Defender
function detectWebGLBlocker(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');

    if (!gl) {
      // WebGL might be blocked
      return true;
    }

    // Check if vendor/renderer are spoofed
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) {
      // Extension might be blocked
      return true;
    }
  } catch {
    return true;
  }
  return false;
}

// Detect AudioContext fingerprint protection
function detectAudioBlocker(): boolean {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return true;

    const ctx = new AudioCtx();
    const analyser = ctx.createAnalyser();
    const data = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(data);

    // Check for all -Infinity (might indicate blocking)
    const allInfinity = data.every((v) => v === -Infinity);
    ctx.close();

    // Some level of -Infinity is normal, but all is suspicious
    return allInfinity && data.length > 0;
  } catch {
    return true;
  }
}

// Detect Tor Browser
function detectTorBrowser(): boolean {
  // Tor Browser has specific characteristics
  try {
    // Tor uses a specific window size
    if (window.innerWidth === 1000 && window.innerHeight === 1000) {
      return true;
    }

    // Tor blocks certain APIs
    if (typeof navigator.plugins === 'undefined') {
      return true;
    }

    // Tor sets timezone to UTC
    if (new Date().getTimezoneOffset() === 0 && IS_GECKO) {
      // Could be Tor or Firefox privacy mode
    }
  } catch {
    // Ignore
  }
  return false;
}

// Get detected privacy tools
function getPrivacyTools(): string[] {
  const tools: string[] = [];

  if (detectPrivacyBadger()) tools.push('Privacy Badger');
  if (detectCanvasBlocker()) tools.push('Canvas Blocker');
  if (detectWebGLBlocker()) tools.push('WebGL Defender');
  if (detectAudioBlocker()) tools.push('Audio Fingerprint Blocker');
  if (detectTorBrowser()) tools.push('Tor Browser');

  return tools;
}

// Get browser engine
function getEngine(): string {
  if (IS_BLINK) return 'Blink';
  if (IS_GECKO) return 'Gecko';
  if (IS_WEBKIT) return 'WebKit';
  return 'Unknown';
}

export async function collectResistance(): Promise<ModuleResult<ResistanceData>> {
  const bravePrivacy = detectBravePrivacy();
  const firefoxPrivacy = detectFirefoxPrivacy();
  const safariPrivacy = detectSafariPrivacy();
  const privacyTools = getPrivacyTools();
  const farblingInfo = detectCanvasFarbling();

  // CreepJS-inspired detection
  const timerPrecision = await detectTimerPrecision();
  const phantomLies = detectPhantomLies();

  // Determine primary privacy mode
  let privacy = '';
  let mode = '';

  if (bravePrivacy.detected) {
    privacy = 'Brave Shields';
    mode = bravePrivacy.mode || '';
  } else if (firefoxPrivacy.detected) {
    privacy = 'Firefox Privacy';
    mode = firefoxPrivacy.mode || '';
  } else if (safariPrivacy.detected) {
    privacy = 'Safari ITP';
    mode = safariPrivacy.mode || '';
  }

  // Detect Firefox resistFingerprinting via timer precision
  if (IS_GECKO && timerPrecision.reduced && !privacy) {
    privacy = 'Firefox Privacy';
    mode = 'resistFingerprinting';
  }

  const data: ResistanceData = {
    privacy: privacy || undefined,
    security: privacyTools.length > 0 ? 'extensions detected' : undefined,
    mode: mode || undefined,
    extension: privacyTools.length > 0 ? privacyTools.join(', ') : undefined,
    extensionHashPattern: privacyTools.length > 0 ? privacyTools.sort().join(',') : undefined,
    engine: getEngine(),
    isFarbled: farblingInfo.isFarbled,
    farblingLevel: farblingInfo.farblingLevel,
    // CreepJS-inspired detection results
    timerPrecisionReduced: timerPrecision.reduced,
    timerPrecision: timerPrecision.precision,
    hasPhantomLies: phantomLies.hasPhantomLies,
    phantomSignature: phantomLies.phantomSignature || undefined,
  };

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
