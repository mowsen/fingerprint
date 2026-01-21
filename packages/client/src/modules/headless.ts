/**
 * Headless Browser Detection Module
 * Detects automated/headless browsers through various signals
 */

import type { ModuleResult, HeadlessData } from '../types';
import { sha256 } from '../core/crypto';
import { IS_BLINK, IS_GECKO, IS_WEBKIT } from '../core/helpers';

// Stealth detection checks
interface StealthChecks {
  [key: string]: boolean;
}

// Check for webdriver property
function hasWebdriver(): boolean {
  return !!navigator.webdriver;
}

// Check for automation-related window properties
function hasAutomationProperties(): boolean {
  const automationProps = [
    '_phantom',
    '__nightmare',
    '_selenium',
    'callPhantom',
    '__phantomas',
    'Buffer',
    'emit',
    'spawn',
    '__webdriver_evaluate',
    '__selenium_evaluate',
    '__webdriver_script_function',
    '__webdriver_script_func',
    '__webdriver_script_fn',
    '__fxdriver_evaluate',
    '__driver_unwrapped',
    '__webdriver_unwrapped',
    '__driver_evaluate',
    '__selenium_unwrapped',
    '__fxdriver_unwrapped',
    'domAutomation',
    'domAutomationController',
  ];

  for (const prop of automationProps) {
    if (prop in window) {
      return true;
    }
  }
  return false;
}

// Check for headless Chrome indicators
function detectHeadlessChrome(): boolean {
  // Check user agent
  if (/HeadlessChrome/.test(navigator.userAgent)) {
    return true;
  }

  // Check plugins (headless has no plugins)
  if (IS_BLINK && navigator.plugins.length === 0) {
    return true;
  }

  // Check languages array
  if (navigator.languages && navigator.languages.length === 0) {
    return true;
  }

  return false;
}

// Check for PhantomJS
function detectPhantomJS(): boolean {
  // @ts-expect-error - phantom property
  if (window.callPhantom || window._phantom) {
    return true;
  }

  // Check error stack trace for phantom
  try {
    throw new Error();
  } catch (e) {
    if ((e as Error).stack?.includes('phantomjs')) {
      return true;
    }
  }

  return false;
}

// Check for Selenium
function detectSelenium(): boolean {
  const seleniumProps = [
    '_Selenium_IDE_Recorder',
    '_selenium',
    '__webdriver_script_fn',
    '__driver_evaluate',
    '__webdriver_evaluate',
    '__selenium_evaluate',
    '__fxdriver_evaluate',
    '__driver_unwrapped',
    '__webdriver_unwrapped',
    '__selenium_unwrapped',
    '__fxdriver_unwrapped',
  ];

  for (const prop of seleniumProps) {
    if (prop in window || prop in document) {
      return true;
    }
  }

  // Check document properties
  const docProps = [
    'webdriver',
    '__webdriver_script_fn',
    '__driver_unwrapped',
    '__webdriver_unwrapped',
    '__selenium_unwrapped',
    '__fxdriver_unwrapped',
  ];

  for (const prop of docProps) {
    if (prop in document) {
      return true;
    }
  }

  return false;
}

// Check for Puppeteer
function detectPuppeteer(): boolean {
  // Check for specific Puppeteer injected properties
  // @ts-expect-error - puppeteer property
  if (window.puppeteer || window.__puppeteer_evaluation_script__) {
    return true;
  }

  return false;
}

// Check for Playwright
function detectPlaywright(): boolean {
  // @ts-expect-error - playwright property
  if (window.__playwright || window._playwrightBinding) {
    return true;
  }

  return false;
}

// Check for missing or inconsistent browser properties
function checkBrowserInconsistencies(): boolean {
  // Chrome should have chrome object
  if (IS_BLINK && !('chrome' in window)) {
    return true;
  }

  // Check notification permissions inconsistency
  try {
    if (Notification.permission === 'denied' && navigator.permissions) {
      // This shouldn't be possible without user interaction
    }
  } catch {
    // Ignore
  }

  return false;
}

// Check for permission anomalies
async function checkPermissionAnomalies(): Promise<boolean> {
  try {
    if (!navigator.permissions?.query) return false;

    const result = await navigator.permissions.query({ name: 'notifications' as PermissionName });
    // If notifications are denied but Notification.permission is different
    if (result.state !== Notification.permission) {
      return true;
    }
  } catch {
    // Ignore
  }

  return false;
}

// Check for broken image rendering (headless indicator)
function checkBrokenImageRendering(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    canvas.width = 1;
    canvas.height = 1;

    // Draw something and check if it renders
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 1, 1);

    const imageData = ctx.getImageData(0, 0, 1, 1);
    // If red channel is not 255, something is wrong
    return imageData.data[0] !== 255;
  } catch {
    return true;
  }
}

// Check Function.prototype.toString for proxy behavior
function checkFunctionToStringProxy(): boolean {
  try {
    const nativeToString = Function.prototype.toString;
    const result = nativeToString.call(nativeToString);

    // Native function should have 'native code'
    if (!result.includes('native code')) {
      return true;
    }

    // Check if toString has been proxied
    if (nativeToString.toString() !== 'function toString() { [native code] }') {
      return true;
    }
  } catch {
    return true;
  }

  return false;
}

// Run stealth detection checks
function runStealthChecks(): StealthChecks {
  return {
    'navigator.webdriver': hasWebdriver(),
    'automation properties': hasAutomationProperties(),
    'HeadlessChrome': detectHeadlessChrome(),
    'PhantomJS': detectPhantomJS(),
    'Selenium': detectSelenium(),
    'Puppeteer': detectPuppeteer(),
    'Playwright': detectPlaywright(),
    'browser inconsistencies': checkBrowserInconsistencies(),
    'broken image rendering': checkBrokenImageRendering(),
    'Function.prototype.toString proxy': checkFunctionToStringProxy(),
  };
}

// Calculate headless rating
function calculateHeadlessRating(stealth: StealthChecks): number {
  const trueCount = Object.values(stealth).filter(Boolean).length;
  return Math.min(trueCount / Object.keys(stealth).length, 1);
}

// Estimate platform from available signals
function estimatePlatform(): string[] {
  const estimates: string[] = [];

  if (IS_BLINK) estimates.push('Chromium');
  if (IS_GECKO) estimates.push('Firefox');
  if (IS_WEBKIT) estimates.push('WebKit');

  // Check for specific platforms
  if (navigator.platform.includes('Win')) estimates.push('Windows');
  if (navigator.platform.includes('Mac')) estimates.push('macOS');
  if (navigator.platform.includes('Linux')) estimates.push('Linux');

  return estimates;
}

export async function collectHeadless(): Promise<ModuleResult<HeadlessData>> {
  const stealth = runStealthChecks();
  const stealthRating = calculateHeadlessRating(stealth);

  const isHeadless = hasWebdriver() || detectHeadlessChrome();
  const likeHeadless = stealthRating > 0.2;

  const permissionAnomaly = await checkPermissionAnomalies();
  if (permissionAnomaly) {
    stealth['permission anomaly'] = true;
  }

  const data: HeadlessData = {
    headless: isHeadless,
    headlessRating: isHeadless ? 1 : 0,
    likeHeadless,
    likeHeadlessRating: stealthRating,
    stealth,
    stealthRating,
    chromium: IS_BLINK,
    platformEstimate: estimatePlatform(),
    systemFonts: navigator.platform,
  };

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
