/**
 * Cryptographic utilities for fingerprint hashing
 */

import type { ComponentResults } from '../types';
import { getNestedValue, safeStringify } from './helpers';

/**
 * Fast mini hash (non-cryptographic) for quick comparisons
 * Based on FNV-1a hash
 */
export function hashMini(data: unknown): string {
  const json = safeStringify(data);
  let hash = 0x811c9dc5;

  for (let i = 0; i < json.length; i++) {
    hash = Math.imul(31, hash) + json.charCodeAt(i) | 0;
  }

  return ('0000000' + (hash >>> 0).toString(16)).slice(-8);
}

/**
 * SHA-256 hash using Web Crypto API
 */
export async function sha256(data: unknown): Promise<string> {
  const json = safeStringify(data);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(json);

  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => ('00' + b.toString(16)).slice(-2)).join('');

  return hashHex;
}

/**
 * Alias for sha256 for compatibility
 */
export const hashify = sha256;

/**
 * Metric keys used for fuzzy hashing
 * These are ordered and grouped to create stable bins
 */
const FUZZY_METRIC_KEYS = [
  // Canvas
  'canvas.dataURI',
  'canvas.emojiSet',
  'canvas.emojiURI',
  'canvas.mods',
  'canvas.textMetricsSystemSum',
  'canvas.textURI',
  // WebGL
  'webgl.dataURI',
  'webgl.dataURI2',
  'webgl.extensions',
  'webgl.gpu',
  'webgl.parameters',
  'webgl.pixels',
  'webgl.pixels2',
  // Audio
  'audio.compressorGainReduction',
  'audio.floatFrequencyDataSum',
  'audio.floatTimeDomainDataSum',
  'audio.noise',
  'audio.sampleSum',
  'audio.totalUniqueSamples',
  'audio.values',
  // Navigator
  'navigator.appVersion',
  'navigator.device',
  'navigator.deviceMemory',
  'navigator.doNotTrack',
  'navigator.globalPrivacyControl',
  'navigator.hardwareConcurrency',
  'navigator.language',
  'navigator.maxTouchPoints',
  'navigator.mimeTypes',
  'navigator.oscpu',
  'navigator.permissions',
  'navigator.platform',
  'navigator.plugins',
  'navigator.system',
  'navigator.userAgent',
  'navigator.userAgentData',
  'navigator.vendor',
  'navigator.webgpu',
  // Screen
  'screen.availHeight',
  'screen.availWidth',
  'screen.colorDepth',
  'screen.height',
  'screen.pixelDepth',
  'screen.touch',
  'screen.width',
  // Fonts
  'fonts.apps',
  'fonts.emojiSet',
  'fonts.fontFaceLoadFonts',
  'fonts.pixelSizeSystemSum',
  'fonts.platformVersion',
  // Font Metrics (Phase 3)
  'fontMetrics.keyGlyphsSum',
  'fontMetrics.metricsSystemSum',
  'fontMetrics.renderingCharacteristics',
  'fontMetrics.signatures',
  // Timezone
  'timezone.location',
  'timezone.locationEpoch',
  'timezone.locationMeasured',
  'timezone.offset',
  'timezone.offsetComputed',
  'timezone.zone',
  // Math
  'math.data',
  // DOMRect
  'domrect.domrectSystemSum',
  'domrect.elementBoundingClientRect',
  'domrect.elementClientRects',
  'domrect.emojiSet',
  'domrect.rangeBoundingClientRect',
  'domrect.rangeClientRects',
  // Intl
  'intl.dateTimeFormat',
  'intl.displayNames',
  'intl.listFormat',
  'intl.locale',
  'intl.numberFormat',
  'intl.pluralRules',
  'intl.relativeTimeFormat',
  // CSS
  'css.computedStyle',
  'css.system',
  // CSS Media
  'cssmedia.matchMediaCSS',
  'cssmedia.mediaCSS',
  'cssmedia.screenQuery',
  // Media
  'media.mimeTypes',
  // Window
  'window.apple',
  'window.keys',
  'window.moz',
  'window.webkit',
  // SVG
  'svg.bBox',
  'svg.computedTextLength',
  'svg.emojiSet',
  'svg.extentOfChar',
  'svg.subStringLength',
  'svg.svgrectSystemSum',
  // Speech
  'speech.defaultVoiceLang',
  'speech.defaultVoiceName',
  'speech.languages',
  'speech.local',
  'speech.remote',
  // WebRTC
  'webrtc.audio',
  'webrtc.video',
  // Headless
  'headless.chromium',
  'headless.headless',
  'headless.headlessRating',
  'headless.likeHeadless',
  'headless.likeHeadlessRating',
  'headless.platformEstimate',
  'headless.stealth',
  'headless.stealthRating',
  'headless.systemFonts',
  // Lies
  'lies.data',
  'lies.totalLies',
  // Resistance
  'resistance.engine',
  'resistance.extension',
  'resistance.extensionHashPattern',
  'resistance.mode',
  'resistance.privacy',
  'resistance.security',
  'resistance.isFarbled',
  'resistance.farblingLevel',
  'resistance.timerPrecisionReduced',
  'resistance.timerPrecision',
  'resistance.hasPhantomLies',
  'resistance.phantomSignature',
  // Worker
  'worker.device',
  'worker.deviceMemory',
  'worker.gpu',
  'worker.hardwareConcurrency',
  'worker.language',
  'worker.languages',
  'worker.locale',
  'worker.platform',
  'worker.system',
  'worker.timezoneLocation',
  'worker.timezoneOffset',
  'worker.userAgent',
  'worker.userAgentData',
  'worker.webglRenderer',
  'worker.webglVendor',
  // Errors
  'errors.errors',
];

/**
 * Generate a 64-character fuzzy hash from fingerprint components
 * The fuzzy hash allows for similarity matching between fingerprints
 */
export async function generateFuzzyHash(components: ComponentResults): Promise<string> {
  const MAX_BINS = 64;

  // Extract all metrics from components
  const metricsMap: Record<string, unknown> = {};
  let validMetricCount = 0;

  for (const [sectionKey, section] of Object.entries(components)) {
    if (!section || !section.data) continue;

    for (const [key, value] of Object.entries(section.data as Record<string, unknown>)) {
      if (key === '$hash' || key === 'lied') continue;
      metricsMap[`${sectionKey}.${key}`] = value;
      if (value !== undefined && value !== null && value !== '') {
        validMetricCount++;
      }
    }
  }

  // Require at least 20 valid metrics to generate a meaningful fuzzy hash
  // Otherwise, users with many failed modules could falsely match
  const MIN_VALID_METRICS = 20;
  if (validMetricCount < MIN_VALID_METRICS) {
    // Return a hash that won't match anything (filled with 'x' to distinguish from valid hashes)
    return '';
  }

  // Calculate bin size
  const binSize = Math.ceil(FUZZY_METRIC_KEYS.length / MAX_BINS);

  // Create bins and hash each bin
  const binHashes: string[] = [];

  for (let i = 0; i < FUZZY_METRIC_KEYS.length; i += binSize) {
    const keySet = FUZZY_METRIC_KEYS.slice(i, i + binSize);
    const binValues = keySet.map((key) => metricsMap[key]);
    const binHash = await sha256(binValues);
    binHashes.push(binHash[0]); // Take first character of each bin hash
  }

  // Pad to 64 characters if needed
  return binHashes.join('').padEnd(64, '0');
}

/**
 * Calculate Hamming distance between two fuzzy hashes
 * Returns the number of positions where characters differ
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('Hashes must be the same length');
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }
  return distance;
}

/**
 * Calculate similarity score between two fuzzy hashes
 * Returns a value between 0 and 1 (1 = identical)
 */
export function calculateSimilarity(hash1: string, hash2: string): number {
  const distance = hammingDistance(hash1, hash2);
  return 1 - distance / Math.max(hash1.length, hash2.length);
}

/**
 * Cross-browser stable keys - features that are stable across different browsers on the same device
 * These are primarily hardware and OS-level characteristics that don't vary between Chrome/Firefox/Safari
 * Based on CreepJS research - these are stable even in incognito mode
 *
 * IMPORTANT: Safari Private mode randomizes canvas, WebGL pixels, and audio.
 * But fonts, speech, CSS, timezone, and intl remain stable!
 */
const CROSS_BROWSER_STABLE_KEYS = [
  // Hardware (very stable across browsers AND incognito)
  'navigator.hardwareConcurrency',
  'navigator.deviceMemory',
  'navigator.maxTouchPoints',

  // Screen - only if not privacy-spoofed (checked separately)
  'screen.colorDepth',
  'screen.pixelDepth',

  // WebGL hardware info (stable across browsers on same GPU)
  // Note: Safari Private randomizes rendered pixels but parameters may be stable
  'webgl.gpu',
  'webgl.parameters',
  'webgl.extensions',
  'worker.webglRenderer',
  'worker.webglVendor',

  // Audio fingerprint - HARDWARE BASED, stable in incognito!
  // Note: Safari Private may randomize these
  'audio.sampleSum',
  'audio.compressorGainReduction',
  'audio.values',

  // Canvas rendering - hardware-based, stable in incognito
  // Note: Safari Private randomizes canvas output
  'canvas.textMetricsSystemSum',

  // Font metrics - hardware-based glyph rendering (Phase 3)
  'fontMetrics.keyGlyphsSum',
  'fontMetrics.metricsSystemSum',

  // Math constants - engine-specific but stable
  'math.data',

  // Worker scope (more reliable than main thread, harder to spoof)
  'worker.hardwareConcurrency',
  'worker.deviceMemory',
  'worker.platform',
  'worker.webglRenderer',
  'worker.webglVendor',

  // Lies detection - the PATTERN of lies is a fingerprint!
  // (CreepJS insight: privacy tools create unique signatures)
  'lies.totalLies',
  'resistance.engine',
  'resistance.phantomSignature',
  'resistance.timerPrecision',

  // === SAFARI PRIVATE MODE STABLE SIGNALS ===
  // These are NOT randomized by Safari ITP and remain consistent

  // Fonts - VERY STABLE in Safari Private (critical for identification)
  'fonts.apps',
  'fonts.fontFaceLoadFonts',
  'fonts.pixelSizeSystemSum',
  'fonts.platformVersion',

  // Speech synthesis - voices don't change in Private mode
  'speech.languages',
  'speech.defaultVoiceName',
  'speech.defaultVoiceLang',
  'speech.local',
  'speech.remote',

  // CSS - Safari doesn't randomize CSS computed styles
  'css.computedStyle',
  'css.system',
  'cssmedia.matchMediaCSS',
  'cssmedia.screenQuery',

  // Timezone/Intl - stable across all modes
  'timezone.location',
  'timezone.zone',
  'timezone.offset',
  'intl.locale',
  'intl.dateTimeFormat',
  'intl.numberFormat',

  // Navigator properties that Safari doesn't randomize
  'navigator.language',
  'navigator.languages',
  'navigator.platform',
  'navigator.vendor',

  // ITP Detection - the randomization PATTERN is itself a fingerprint!
  // Safari's ITP creates a unique signature based on how it randomizes
  'itpDetection.itpSignature',
  'itpDetection.randomizationPattern',
  'itpDetection.isLikelySafariPrivate',
];

/**
 * Generate a stable hash from browser-independent features
 * This hash should be the same across Chrome, Firefox, Safari on the same device
 */
export async function generateStableHash(components: ComponentResults): Promise<string> {
  const stableValues: unknown[] = [];
  let validCount = 0;

  for (const key of CROSS_BROWSER_STABLE_KEYS) {
    const [section, prop] = key.split('.');
    const sectionData = components[section as keyof ComponentResults];
    const value = sectionData?.data?.[prop as keyof typeof sectionData.data];

    if (value !== undefined && value !== null && value !== '') {
      validCount++;
    }
    stableValues.push(value ?? null);
  }

  // Require at least 30% of stable keys to have valid values
  // Otherwise, the stable hash could falsely match between users with failures
  const minValidRatio = 0.3;
  if (validCount < CROSS_BROWSER_STABLE_KEYS.length * minValidRatio) {
    return '';
  }

  return sha256(stableValues);
}

/**
 * Generate the final combined fingerprint hash
 */
export async function generateFingerprint(components: ComponentResults): Promise<string> {
  // Collect all component hashes in deterministic order
  const componentHashes: string[] = [];
  const sortedKeys = Object.keys(components).sort();

  for (const key of sortedKeys) {
    const component = components[key as keyof ComponentResults];
    if (component?.hash) {
      componentHashes.push(component.hash);
    }
  }

  // Require at least 5 valid component hashes to generate a fingerprint
  // This prevents false matches when most modules fail
  const MIN_COMPONENT_HASHES = 5;
  if (componentHashes.length < MIN_COMPONENT_HASHES) {
    return '';
  }

  // Generate final hash from all component hashes
  return sha256(componentHashes);
}

/**
 * Cipher data using AES-GCM (for optional encrypted transmission)
 */
export async function cipher(data: unknown): Promise<{
  message: string;
  vector: string;
  key: string;
}> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const json = safeStringify(data);
  const encoded = new TextEncoder().encode(json);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  const message = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
  const vector = btoa(String.fromCharCode(...iv));
  const { k: keyData } = await crypto.subtle.exportKey('jwk', key);

  return { message, vector, key: keyData! };
}

/**
 * Decipher AES-GCM encrypted data
 */
export async function decipher(
  message: string,
  vector: string,
  keyData: string
): Promise<unknown> {
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'oct', k: keyData, alg: 'A256GCM', ext: true },
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const iv = new Uint8Array(atob(vector).split('').map((c) => c.charCodeAt(0)));
  const ciphertext = new Uint8Array(atob(message).split('').map((c) => c.charCodeAt(0)));

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const json = new TextDecoder().decode(decrypted);
  return JSON.parse(json);
}
