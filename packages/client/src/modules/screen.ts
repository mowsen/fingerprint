/**
 * Screen Fingerprinting Module
 * Collects display and screen information
 */

import type { ModuleResult, ScreenData } from '../types';
import { sha256 } from '../core/crypto';

// Get touch support information
function getTouchInfo(): ScreenData['touch'] {
  try {
    const maxTouchPoints = navigator.maxTouchPoints || 0;
    const touchEvent = 'ontouchstart' in window;
    const touchStart = 'TouchEvent' in window;

    return {
      maxTouchPoints,
      touchEvent,
      touchStart,
    };
  } catch {
    return {
      maxTouchPoints: 0,
      touchEvent: false,
      touchStart: false,
    };
  }
}

// Get screen orientation
function getOrientation(): string | undefined {
  try {
    if (screen.orientation?.type) {
      return screen.orientation.type;
    }
    // Fallback calculation
    if (screen.width > screen.height) {
      return 'landscape-primary';
    }
    return 'portrait-primary';
  } catch {
    return undefined;
  }
}

export async function collectScreen(): Promise<ModuleResult<ScreenData>> {
  const data: ScreenData = {
    width: screen.width,
    height: screen.height,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    colorDepth: screen.colorDepth,
    pixelDepth: screen.pixelDepth,
    devicePixelRatio: window.devicePixelRatio,
    orientation: getOrientation(),
    screenLeft: window.screenLeft,
    screenTop: window.screenTop,
    touch: getTouchInfo(),
  };

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
