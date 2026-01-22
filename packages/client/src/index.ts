/**
 * Fingerprint Client Library
 * Browser fingerprinting for analytics and user identification
 */

// Main class and factory
export { Fingerprint, createFingerprint } from './core/orchestrator';

// Types
export type {
  // Configuration
  FingerprintConfig,
  ModuleName,

  // Results
  FingerprintResult,
  ModuleResult,
  ComponentResults,
  DetectionResult,
  IdentifyResponse,

  // Module data types
  CanvasData,
  WebGLData,
  AudioData,
  NavigatorData,
  ScreenData,
  FontsData,
  FontMetricsData,
  TimezoneData,
  MathData,
  DOMRectData,
  IntlData,
  WebRTCData,
  SVGData,
  SpeechData,
  CSSData,
  CSSMediaData,
  MediaData,
  WindowData,
  HeadlessData,
  LiesData,
  ResistanceData,
  WorkerData,
  ErrorsData,
  GpuTimingData,
  BehaviorData,

  // Utility types
  EngineInfo,
  JSEngine,
  BrowserEngine,
  LieRecord,
} from './types';

// Crypto utilities
export {
  sha256,
  hashify,
  hashMini,
  generateFuzzyHash,
  generateFingerprint,
  generateStableHash,
  hammingDistance,
  calculateSimilarity,
} from './core/crypto';

// Helper utilities
export {
  IS_BLINK,
  IS_GECKO,
  IS_WEBKIT,
  JS_ENGINE,
  BROWSER_ENGINE,
  LIKE_BRAVE,
  getEngineInfo,
  isBraveBrowser,
  getReportedPlatform,
  getOS,
  createTimer,
  calculateEntropyBits,
} from './core/helpers';

// Individual module collectors (for advanced usage)
export { collectCanvas } from './modules/canvas';
export { collectWebGL } from './modules/webgl';
export { collectAudio } from './modules/audio';
export { collectNavigator } from './modules/navigator';
export { collectScreen } from './modules/screen';
export { collectFonts } from './modules/fonts';
export { collectTimezone } from './modules/timezone';
export { collectMath } from './modules/math';
export { collectDOMRect } from './modules/domrect';
export { collectIntl } from './modules/intl';
export { collectWebRTC } from './modules/webrtc';
export { collectSVG } from './modules/svg';
export { collectSpeech } from './modules/speech';
export { collectCSS } from './modules/css';
export { collectCSSMedia } from './modules/cssmedia';
export { collectMedia } from './modules/media';
export { collectWindow } from './modules/window';
export { collectHeadless } from './modules/headless';
export { collectLies, getLieCount } from './modules/lies';
export { collectResistance, detectCanvasFarbling } from './modules/resistance';
export { collectWorker } from './modules/worker';
export { collectErrors } from './modules/errors';
export { collectGpuTiming } from './modules/gpu-timing';
export { collectFontMetrics } from './modules/font-metrics';
export {
  collectBehavior,
  collectBehaviorSnapshot,
  getBehaviorCollector,
  BehaviorCollector,
} from './modules/behavior';

// Identity management
export {
  getPersistentIdentity,
  setPersistentIdentity,
  clearPersistentIdentity,
  hasPersistentIdentity,
  getIdentityStorageStatus,
} from './core/identity';
export type { PersistentIdentity } from './core/identity';

// Default export
import { Fingerprint } from './core/orchestrator';
export default Fingerprint;
