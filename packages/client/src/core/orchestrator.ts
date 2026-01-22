/**
 * Orchestrator - Coordinates parallel fingerprint collection from all modules
 */

import type {
  FingerprintConfig,
  FingerprintResult,
  ComponentResults,
  ModuleName,
  ModuleResult,
  DetectionResult,
  IdentifyResponse,
} from '../types';
import { sha256, generateFuzzyHash, generateFingerprint, generateStableHash } from './crypto';
import { createTimer, createPerformanceLogger, calculateEntropyBits } from './helpers';
import {
  getExcludedComponents,
  isComponentExcluded,
  detectBrowser,
  detectActiveModes,
} from './stabilization';

// Module imports
import { collectCanvas } from '../modules/canvas';
import { collectWebGL } from '../modules/webgl';
import { collectAudio } from '../modules/audio';
import { collectNavigator } from '../modules/navigator';
import { collectScreen } from '../modules/screen';
import { collectFonts } from '../modules/fonts';
import { collectFontMetrics } from '../modules/font-metrics';
import { collectTimezone } from '../modules/timezone';
import { collectMath } from '../modules/math';
import { collectDOMRect } from '../modules/domrect';
import { collectIntl } from '../modules/intl';
import { collectWebRTC } from '../modules/webrtc';
import { collectSVG } from '../modules/svg';
import { collectSpeech } from '../modules/speech';
import { collectCSS } from '../modules/css';
import { collectCSSMedia } from '../modules/cssmedia';
import { collectMedia } from '../modules/media';
import { collectWindow } from '../modules/window';
import { collectHeadless } from '../modules/headless';
import { collectLies, getLieCount } from '../modules/lies';
import { collectResistance } from '../modules/resistance';
import { collectWorker } from '../modules/worker';
import { collectErrors } from '../modules/errors';
import { collectGpuTiming } from '../modules/gpu-timing';
import { collectBehaviorSnapshot } from '../modules/behavior';
import { collectITPDetection } from '../modules/itp-detection';

// All available module names
// Note: 'behavior' is excluded from default because it requires extended collection time
const ALL_MODULES: ModuleName[] = [
  'canvas',
  'webgl',
  'audio',
  'navigator',
  'screen',
  'fonts',
  'fontMetrics',
  'timezone',
  'math',
  'domrect',
  'intl',
  'webrtc',
  'svg',
  'speech',
  'css',
  'cssmedia',
  'media',
  'window',
  'headless',
  'lies',
  'resistance',
  'worker',
  'errors',
  'gpuTiming',
  'itpDetection', // Safari ITP detection
];

// Module collectors map
const MODULE_COLLECTORS: Record<ModuleName, () => Promise<ModuleResult<unknown>>> = {
  canvas: collectCanvas,
  webgl: collectWebGL,
  audio: collectAudio,
  navigator: collectNavigator,
  screen: collectScreen,
  fonts: collectFonts,
  fontMetrics: collectFontMetrics,
  timezone: collectTimezone,
  math: collectMath,
  domrect: collectDOMRect,
  intl: collectIntl,
  webrtc: collectWebRTC,
  svg: collectSVG,
  speech: collectSpeech,
  css: collectCSS,
  cssmedia: collectCSSMedia,
  media: collectMedia,
  window: collectWindow,
  headless: collectHeadless,
  lies: collectLies,
  resistance: collectResistance,
  worker: collectWorker,
  errors: collectErrors,
  gpuTiming: collectGpuTiming,
  behavior: collectBehaviorSnapshot,
  itpDetection: collectITPDetection,
};

// Entropy estimates for each module (in bits)
const MODULE_ENTROPY: Record<ModuleName, number> = {
  canvas: 12.5,
  webgl: 15.0,
  audio: 8.5,
  navigator: 6.0,
  screen: 4.5,
  fonts: 10.0,
  fontMetrics: 8.5, // ~34% uniqueness improvement per research
  timezone: 3.0,
  math: 4.0,
  domrect: 5.0,
  intl: 4.0,
  webrtc: 3.5,
  svg: 5.5,
  speech: 4.0,
  css: 3.0,
  cssmedia: 3.5,
  media: 2.5,
  window: 2.0,
  headless: 1.0,
  lies: 1.5,
  resistance: 2.0,
  worker: 5.0,
  errors: 1.0,
  gpuTiming: 8.0,
  behavior: 6.0, // Behavioral biometrics (optional module)
  itpDetection: 5.0, // Safari ITP randomization pattern detection
};

/**
 * Collect a single module's fingerprint with timing and error handling
 */
async function collectModule(
  name: ModuleName,
  timeout: number,
  debug: boolean
): Promise<{ name: ModuleName; result: ModuleResult<unknown> }> {
  const timer = createTimer();
  const logger = createPerformanceLogger(debug);

  try {
    const collector = MODULE_COLLECTORS[name];

    // Create timeout promise
    const timeoutPromise = new Promise<ModuleResult<unknown>>((_, reject) => {
      setTimeout(() => reject(new Error(`Module ${name} timed out`)), timeout);
    });

    // Race between collection and timeout
    const result = await Promise.race([collector(), timeoutPromise]);
    const duration = timer.stop();

    logger.log(`${name} collected`, duration);

    return {
      name,
      result: {
        ...result,
        duration,
      },
    };
  } catch (error) {
    const duration = timer.stop();
    logger.log(`${name} failed: ${error}`, duration);

    return {
      name,
      result: {
        hash: '',
        data: null,
        duration,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Calculate detection results from collected components
 */
function calculateDetection(components: ComponentResults): DetectionResult & { isFarbled?: boolean; farblingLevel?: string } {
  const headlessData = components.headless?.data;
  const liesData = components.lies?.data;
  const resistanceData = components.resistance?.data;

  const isHeadless = Boolean(headlessData?.headless || headlessData?.likeHeadless);
  const liesDetected = getLieCount();

  const privacyTools: string[] = [];
  if (resistanceData?.privacy) {
    privacyTools.push(resistanceData.privacy);
  }
  if (resistanceData?.extension) {
    privacyTools.push(resistanceData.extension);
  }

  // Calculate confidence based on detection signals
  let confidence = 1.0;
  if (isHeadless) confidence -= 0.3;
  if (liesDetected > 0) confidence -= Math.min(0.3, liesDetected * 0.05);
  if (privacyTools.length > 0) confidence -= 0.1;

  // Extract farbling info from resistance data
  const isFarbled = resistanceData?.isFarbled;
  const farblingLevel = resistanceData?.farblingLevel;

  return {
    isHeadless,
    liesDetected,
    privacyTools,
    confidence: Math.max(0, confidence),
    isFarbled,
    farblingLevel,
  };
}

/**
 * Calculate total entropy from collected components
 */
function calculateTotalEntropy(
  components: ComponentResults,
  enabledModules: ModuleName[]
): number {
  let totalEntropy = 0;

  for (const name of enabledModules) {
    const component = components[name as keyof ComponentResults];
    if (component && !component.error && component.data) {
      totalEntropy += MODULE_ENTROPY[name] || 0;
    }
  }

  return Math.round(totalEntropy * 10) / 10;
}

/**
 * Create a filtered copy of components with excluded paths nullified
 * This is used for stable hash generation to exclude unstable components
 */
function filterComponents(
  components: ComponentResults,
  excluded: Set<string>
): ComponentResults {
  if (excluded.size === 0) return components;

  const filtered: ComponentResults = {};

  for (const [moduleName, moduleResult] of Object.entries(components)) {
    if (!moduleResult) continue;

    // Check if entire module is excluded
    if (excluded.has(moduleName)) {
      continue;
    }

    // Check individual data fields
    const filteredData: Record<string, unknown> = {};
    const data = moduleResult.data as Record<string, unknown> | null;

    if (data) {
      for (const [key, value] of Object.entries(data)) {
        const path = `${moduleName}.${key}`;
        if (!isComponentExcluded(path, excluded)) {
          filteredData[key] = value;
        }
      }
    }

    (filtered as Record<string, ModuleResult<unknown>>)[moduleName] = {
      ...moduleResult,
      data: filteredData,
    };
  }

  return filtered;
}

/**
 * Main Fingerprint class
 */
export class Fingerprint {
  private config: Required<FingerprintConfig>;
  private enabledModules: ModuleName[];

  constructor(config: FingerprintConfig = {}) {
    this.config = {
      modules: config.modules || 'all',
      timeout: config.timeout || 10000,
      debug: config.debug || false,
    };

    this.enabledModules =
      this.config.modules === 'all'
        ? ALL_MODULES
        : this.config.modules;
  }

  /**
   * Collect fingerprint from all enabled modules
   */
  async collect(): Promise<FingerprintResult> {
    const timer = createTimer();
    const logger = createPerformanceLogger(this.config.debug);

    logger.log('Starting fingerprint collection');

    // Collect all modules in parallel
    const modulePromises = this.enabledModules.map((name) =>
      collectModule(name, this.config.timeout, this.config.debug)
    );

    const results = await Promise.all(modulePromises);

    // Assemble components
    const components: ComponentResults = {};
    for (const { name, result } of results) {
      (components as Record<string, ModuleResult<unknown>>)[name] = result;
    }

    // Calculate detection first (we need farbling info for stabilization)
    const detection = calculateDetection(components);

    // Detect browser and active modes for stabilization
    const browser = detectBrowser();
    const isFarbled = detection.isFarbled || false;
    const isPrivate = false; // Can't reliably detect private mode
    const activeModes = detectActiveModes(isFarbled, isPrivate);

    // Get excluded components based on browser and modes
    const excludedComponents = getExcludedComponents(
      browser.name,
      browser.version,
      activeModes
    );

    if (this.config.debug && excludedComponents.size > 0) {
      logger.log(`Stabilization: excluding ${[...excludedComponents].join(', ')}`);
    }

    // Generate hashes using filtered components for fuzzy/stable hashes
    const filteredComponents = filterComponents(components, excludedComponents);

    const [fingerprint, fuzzyHash, stableHash] = await Promise.all([
      generateFingerprint(components), // Full fingerprint uses all components
      generateFuzzyHash(filteredComponents), // Fuzzy hash excludes unstable components
      generateStableHash(components), // Stable hash uses its own key selection
    ]);

    // Get GPU timing hash if available
    const gpuTimingHash = components.gpuTiming?.hash || undefined;

    // Calculate entropy
    const entropy = calculateTotalEntropy(components, this.enabledModules);

    const duration = timer.stop();
    logger.log('Fingerprint collection complete', duration);

    return {
      fingerprint,
      fuzzyHash,
      stableHash,
      gpuTimingHash,
      components,
      detection,
      entropy,
      timestamp: Date.now(),
      duration,
    };
  }

  /**
   * Collect fingerprint and send to server for identification
   */
  async identify(serverUrl: string): Promise<IdentifyResponse> {
    const result = await this.collect();

    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fingerprint: result.fingerprint,
        fuzzyHash: result.fuzzyHash,
        stableHash: result.stableHash,
        gpuTimingHash: result.gpuTimingHash,
        components: result.components,
        entropy: result.entropy,
        timestamp: result.timestamp,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get list of enabled modules
   */
  getEnabledModules(): ModuleName[] {
    return [...this.enabledModules];
  }

  /**
   * Check if a specific module is enabled
   */
  isModuleEnabled(name: ModuleName): boolean {
    return this.enabledModules.includes(name);
  }
}

// Export orchestrator factory
export function createFingerprint(config?: FingerprintConfig): Fingerprint {
  return new Fingerprint(config);
}
