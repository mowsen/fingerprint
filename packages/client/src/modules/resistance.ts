/**
 * Privacy Tool Resistance Detection Module
 * Detects anti-fingerprinting tools and privacy extensions
 */

import type { ModuleResult, ResistanceData } from '../types';
import { sha256 } from '../core/crypto';
import { IS_BLINK, IS_GECKO, IS_WEBKIT, LIKE_BRAVE, isBraveBrowser } from '../core/helpers';

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
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillText('test', 10, 10);
      const data1 = canvas.toDataURL();
      ctx.fillText('test', 10, 10);
      const data2 = canvas.toDataURL();
      // Brave farbles canvas, so consecutive reads may differ
      if (data1 !== data2) {
        return { detected: true, mode: 'strict' };
      }
    }
  } catch {
    // Ignore
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

  const data: ResistanceData = {
    privacy: privacy || undefined,
    security: privacyTools.length > 0 ? 'extensions detected' : undefined,
    mode: mode || undefined,
    extension: privacyTools.length > 0 ? privacyTools.join(', ') : undefined,
    extensionHashPattern: privacyTools.length > 0 ? privacyTools.sort().join(',') : undefined,
    engine: getEngine(),
  };

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
