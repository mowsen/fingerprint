/**
 * Web Worker Fingerprinting Module
 * Collects fingerprints from Worker scope for comparison
 */

import type { ModuleResult, WorkerData } from '../types';
import { sha256 } from '../core/crypto';

// Worker script as a string
const WORKER_SCRIPT = `
self.onmessage = async function(e) {
  if (e.data.type !== 'collect') return;

  const data = {};

  // Navigator properties
  try {
    data.userAgent = navigator.userAgent;
    data.platform = navigator.platform;
    data.hardwareConcurrency = navigator.hardwareConcurrency;
    data.deviceMemory = navigator.deviceMemory;
    data.language = navigator.language;
    data.languages = [...navigator.languages];
  } catch (err) {
    data.navigatorError = err.message;
  }

  // Timezone
  try {
    data.timezoneOffset = new Date().getTimezoneOffset();
    data.timezoneLocation = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (err) {
    data.timezoneError = err.message;
  }

  // WebGL in Worker (via OffscreenCanvas)
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(256, 256);
      const gl = canvas.getContext('webgl');
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          data.webglVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
          data.webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        }
        data.gpu = gl.getParameter(gl.RENDERER);
      }
    }
  } catch (err) {
    data.webglError = err.message;
  }

  // Intl Locale
  try {
    data.locale = Intl.DateTimeFormat().resolvedOptions().locale;

    // Check locale entropy
    const numberFormat = Intl.NumberFormat().resolvedOptions();
    data.systemCurrencyLocale = numberFormat.locale;

    // Different engines might have different currency locales
    const currencyFormat = Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
    data.engineCurrencyLocale = currencyFormat.resolvedOptions().locale;
  } catch (err) {
    data.intlError = err.message;
  }

  // User Agent Data (Chrome only)
  try {
    if (navigator.userAgentData) {
      const uaData = navigator.userAgentData;
      data.userAgentData = {
        brands: uaData.brands,
        mobile: uaData.mobile,
        platform: uaData.platform
      };

      if (uaData.getHighEntropyValues) {
        const highEntropy = await uaData.getHighEntropyValues([
          'platformVersion',
          'architecture',
          'model',
          'uaFullVersion'
        ]);
        data.userAgentDataVersion = highEntropy.platformVersion;
      }
    }
  } catch (err) {
    data.uaDataError = err.message;
  }

  // Detect lies in worker scope
  try {
    // Check if navigator is native
    const navToString = Object.prototype.toString.call(navigator);
    data.lies = navToString !== '[object WorkerNavigator]';
  } catch (err) {
    data.lies = true;
  }

  // Platform detection
  try {
    const platform = navigator.platform;
    const ua = navigator.userAgent;

    if (platform.includes('Win')) {
      data.system = 'Windows';
      data.device = 'desktop';
    } else if (platform.includes('Mac')) {
      data.system = 'macOS';
      data.device = 'desktop';
    } else if (platform.includes('Linux')) {
      data.system = 'Linux';
      data.device = ua.includes('Android') ? 'mobile' : 'desktop';
    } else if (/iPhone|iPad|iPod/.test(ua)) {
      data.system = 'iOS';
      data.device = 'mobile';
    }
  } catch (err) {
    data.platformError = err.message;
  }

  // Check UA post-reduction
  try {
    data.uaPostReduction = /Chrome\\/\\d+\\.0\\.0\\.0/.test(navigator.userAgent);
  } catch (err) {
    // Ignore
  }

  // Check locale entropy trustworthiness
  try {
    const locale = navigator.language;
    const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    data.localeEntropyIsTrusty = locale.split('-')[0] === intlLocale.split('-')[0];
    data.localeIntlEntropyIsTrusty = locale === intlLocale;
  } catch (err) {
    // Ignore
  }

  self.postMessage({ type: 'result', data });
};
`;

// Create a Blob URL for the worker
function createWorkerBlobURL(): string {
  const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}

// Run worker collection
function runWorkerCollection(): Promise<WorkerData | null> {
  return new Promise((resolve) => {
    try {
      const workerURL = createWorkerBlobURL();
      const worker = new Worker(workerURL);

      const timeout = setTimeout(() => {
        worker.terminate();
        URL.revokeObjectURL(workerURL);
        resolve(null);
      }, 5000);

      worker.onmessage = (e) => {
        if (e.data.type === 'result') {
          clearTimeout(timeout);
          worker.terminate();
          URL.revokeObjectURL(workerURL);
          resolve(e.data.data as WorkerData);
        }
      };

      worker.onerror = () => {
        clearTimeout(timeout);
        worker.terminate();
        URL.revokeObjectURL(workerURL);
        resolve(null);
      };

      worker.postMessage({ type: 'collect' });
    } catch {
      resolve(null);
    }
  });
}

// Compare worker data with main thread data
function checkForDiscrepancies(workerData: WorkerData): boolean {
  // Check if worker data matches main thread
  if (workerData.userAgent !== navigator.userAgent) {
    return true;
  }
  if (workerData.platform !== navigator.platform) {
    return true;
  }
  if (workerData.language !== navigator.language) {
    return true;
  }
  return false;
}

export async function collectWorker(): Promise<ModuleResult<WorkerData>> {
  // Check if Workers are supported
  if (typeof Worker === 'undefined') {
    return {
      hash: '',
      data: {},
      error: 'Web Workers not supported',
    };
  }

  const workerData = await runWorkerCollection();

  if (!workerData) {
    return {
      hash: '',
      data: {},
      error: 'Worker collection failed',
    };
  }

  // Check for discrepancies
  const hasDiscrepancies = checkForDiscrepancies(workerData);
  workerData.lied = hasDiscrepancies;

  const hash = await sha256(workerData);

  return {
    hash,
    data: workerData,
  };
}
