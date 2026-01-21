/**
 * Navigator Fingerprinting Module
 * Collects browser and system information from navigator object
 */

import type { ModuleResult, NavigatorData } from '../types';
import { sha256 } from '../core/crypto';
import { getOS, getReportedPlatform, attempt } from '../core/helpers';

// Get plugins list
function getPlugins(): string[] {
  try {
    const plugins: string[] = [];
    for (let i = 0; i < navigator.plugins.length; i++) {
      const plugin = navigator.plugins[i];
      plugins.push(plugin.name);
    }
    return plugins;
  } catch {
    return [];
  }
}

// Get MIME types
function getMimeTypes(): string[] {
  try {
    const mimeTypes: string[] = [];
    for (let i = 0; i < navigator.mimeTypes.length; i++) {
      const mime = navigator.mimeTypes[i];
      mimeTypes.push(mime.type);
    }
    return mimeTypes;
  } catch {
    return [];
  }
}

// Get high entropy values from User Agent Client Hints API
async function getUserAgentData(): Promise<NavigatorData['userAgentData'] | undefined> {
  try {
    // @ts-expect-error - userAgentData not in all TypeScript definitions
    const uaData = navigator.userAgentData;
    if (!uaData) return undefined;

    const brands = uaData.brands?.map((b: { brand: string; version: string }) => ({
      brand: b.brand,
      version: b.version,
    })) || [];

    // Try to get high entropy values
    let highEntropyValues: Record<string, unknown> = {};
    try {
      if (uaData.getHighEntropyValues) {
        highEntropyValues = await uaData.getHighEntropyValues([
          'architecture',
          'bitness',
          'model',
          'platformVersion',
          'uaFullVersion',
        ]);
      }
    } catch {
      // High entropy values not available
    }

    return {
      brands,
      mobile: uaData.mobile || false,
      platform: uaData.platform || '',
      platformVersion: highEntropyValues.platformVersion as string | undefined,
      architecture: highEntropyValues.architecture as string | undefined,
      bitness: highEntropyValues.bitness as string | undefined,
      model: highEntropyValues.model as string | undefined,
      uaFullVersion: highEntropyValues.uaFullVersion as string | undefined,
    };
  } catch {
    return undefined;
  }
}

/**
 * Get a single permission with retry mechanism for consensus
 * Inspired by ThumbmarkJS - check 3 times and take most frequent value
 * This filters out transient permission states
 */
async function getPermissionWithRetry(
  name: string,
  retries = 3
): Promise<string | null> {
  if (!navigator.permissions?.query) {
    return null;
  }

  const results: string[] = [];

  for (let i = 0; i < retries; i++) {
    try {
      const status = await navigator.permissions.query({ name: name as PermissionName });
      results.push(status.state);
    } catch {
      results.push('error');
    }

    // Small delay between checks to catch transient states
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  // Filter out errors
  const validResults = results.filter((r) => r !== 'error');
  if (validResults.length === 0) {
    return null;
  }

  // Return most frequent result (consensus)
  const counts = validResults.reduce((acc, r) => {
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0][0];
}

// Get permissions state with retry consensus
async function getPermissions(): Promise<Record<string, string>> {
  const permissions: Record<string, string> = {};
  const permissionNames = [
    'accelerometer',
    'ambient-light-sensor',
    'background-sync',
    'camera',
    'clipboard-read',
    'clipboard-write',
    'geolocation',
    'gyroscope',
    'magnetometer',
    'microphone',
    'midi',
    'notifications',
    'payment-handler',
    'persistent-storage',
    'push',
    'screen-wake-lock',
  ];

  if (!navigator.permissions?.query) {
    return permissions;
  }

  // Check all permissions in parallel with retry
  const results = await Promise.all(
    permissionNames.map(async (name) => ({
      name,
      state: await getPermissionWithRetry(name),
    }))
  );

  for (const { name, state } of results) {
    if (state) {
      permissions[name] = state;
    }
  }

  return permissions;
}

// Check Bluetooth availability
async function getBluetoothAvailability(): Promise<boolean | undefined> {
  try {
    // @ts-expect-error - bluetooth not in all TypeScript definitions
    if (navigator.bluetooth?.getAvailability) {
      // @ts-expect-error
      return await navigator.bluetooth.getAvailability();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// Get WebGPU info
async function getWebGPUInfo(): Promise<NavigatorData['webgpu']> {
  try {
    // @ts-expect-error - gpu not in all TypeScript definitions
    if (!navigator.gpu) {
      return { supported: false };
    }

    // @ts-expect-error
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return { supported: true };
    }

    const info = await adapter.requestAdapterInfo?.();
    return {
      supported: true,
      adapter: info?.device || info?.description || 'unknown',
    };
  } catch {
    return { supported: false };
  }
}

// Get navigator properties
function getNavigatorProperties(): string[] {
  const properties: string[] = [];
  for (const key in navigator) {
    properties.push(key);
  }
  return properties.sort();
}

// Check if user agent is post-reduction (Chrome 101+)
function isUAPostReduction(): boolean {
  const ua = navigator.userAgent;
  // Post-reduction UAs have frozen minor version
  return /Chrome\/\d+\.0\.0\.0/.test(ua);
}

export async function collectNavigator(): Promise<ModuleResult<NavigatorData>> {
  const [platform, system] = getReportedPlatform(navigator.userAgent);
  const device = getOS(navigator.userAgent);

  // Collect async data in parallel
  const [userAgentData, permissions, bluetooth, webgpu] = await Promise.all([
    getUserAgentData(),
    getPermissions(),
    getBluetoothAvailability(),
    getWebGPUInfo(),
  ]);

  const data: NavigatorData = {
    userAgent: navigator.userAgent,
    appVersion: navigator.appVersion,
    platform: navigator.platform,
    vendor: navigator.vendor,
    language: navigator.language,
    languages: [...navigator.languages],
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as { deviceMemory?: number }).deviceMemory,
    maxTouchPoints: navigator.maxTouchPoints,
    doNotTrack: navigator.doNotTrack,
    globalPrivacyControl: (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl,
    cookieEnabled: navigator.cookieEnabled,
    plugins: getPlugins(),
    mimeTypes: getMimeTypes(),
    webdriver: navigator.webdriver,
    pdfViewerEnabled: (navigator as { pdfViewerEnabled?: boolean }).pdfViewerEnabled,
    oscpu: (navigator as { oscpu?: string }).oscpu,
    permissions: Object.keys(permissions).length > 0 ? permissions : undefined,
    bluetooth,
    userAgentData,
    device,
    system,
    uaPostReduction: isUAPostReduction(),
    properties: getNavigatorProperties(),
    webgpu,
  };

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
