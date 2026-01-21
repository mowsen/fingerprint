/**
 * Window Fingerprinting Module
 * Enumerates window object properties for fingerprinting
 */

import type { ModuleResult, WindowData } from '../types';
import { sha256 } from '../core/crypto';

// Get all window property keys
function getWindowKeys(): string[] {
  try {
    const keys: string[] = [];
    for (const key in window) {
      keys.push(key);
    }
    return keys.sort();
  } catch {
    return [];
  }
}

// Get Apple-specific properties
function getAppleProperties(): string[] {
  try {
    const appleKeys: string[] = [];
    for (const key in window) {
      if (key.toLowerCase().includes('apple') || key.toLowerCase().includes('webkit')) {
        appleKeys.push(key);
      }
    }
    return appleKeys.sort();
  } catch {
    return [];
  }
}

// Get Mozilla-specific properties
function getMozProperties(): string[] {
  try {
    const mozKeys: string[] = [];
    for (const key in window) {
      if (key.toLowerCase().startsWith('moz') || key.toLowerCase().includes('firefox')) {
        mozKeys.push(key);
      }
    }
    return mozKeys.sort();
  } catch {
    return [];
  }
}

// Get WebKit-specific properties
function getWebkitProperties(): string[] {
  try {
    const webkitKeys: string[] = [];
    for (const key in window) {
      if (key.startsWith('webkit') || key.startsWith('WebKit')) {
        webkitKeys.push(key);
      }
    }
    return webkitKeys.sort();
  } catch {
    return [];
  }
}

// Get unique browser-specific APIs
function getBrowserSpecificAPIs(): Record<string, boolean> {
  return {
    // Chrome/Blink
    chrome: 'chrome' in window,
    cookieStore: 'cookieStore' in window,
    // Firefox
    InstallTrigger: 'InstallTrigger' in window,
    // Safari
    safari: 'safari' in window,
    // Edge (legacy)
    StyleMedia: 'StyleMedia' in window,
    // Brave
    brave: 'brave' in navigator,
    // Opera
    opr: 'opr' in window,
    opera: 'opera' in window,
  };
}

export async function collectWindow(): Promise<ModuleResult<WindowData>> {
  const data: WindowData = {
    keys: getWindowKeys(),
    apple: getAppleProperties(),
    moz: getMozProperties(),
    webkit: getWebkitProperties(),
  };

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
