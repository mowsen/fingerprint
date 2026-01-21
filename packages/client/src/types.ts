/**
 * Fingerprint Client Type Definitions
 */

// Module names for configuration
export type ModuleName =
  | 'canvas'
  | 'webgl'
  | 'audio'
  | 'navigator'
  | 'screen'
  | 'fonts'
  | 'timezone'
  | 'math'
  | 'domrect'
  | 'intl'
  | 'webrtc'
  | 'svg'
  | 'speech'
  | 'css'
  | 'cssmedia'
  | 'media'
  | 'window'
  | 'headless'
  | 'lies'
  | 'resistance'
  | 'worker'
  | 'errors'
  | 'gpuTiming';

// Configuration options
export interface FingerprintConfig {
  modules?: ModuleName[] | 'all';
  timeout?: number;
  debug?: boolean;
}

// Base module result interface
export interface ModuleResult<T = unknown> {
  hash: string;
  data: T;
  duration?: number;
  error?: string;
}

// Canvas module data
export interface CanvasData {
  dataURI: string;
  textURI?: string;
  emojiURI?: string;
  paintURI?: string;
  textMetrics?: {
    width: number;
    actualBoundingBoxAscent: number;
    actualBoundingBoxDescent: number;
    actualBoundingBoxLeft: number;
    actualBoundingBoxRight: number;
    fontBoundingBoxAscent: number;
    fontBoundingBoxDescent: number;
  };
  textMetricsSystemSum?: number;
  mods?: {
    rgba?: string;
    pixels?: number;
  };
  emojiSet?: string[];
  liedTextMetrics?: boolean;
}

// WebGL module data
export interface WebGLData {
  dataURI: string;
  dataURI2?: string;
  parameters: Record<string, unknown>;
  extensions: string[];
  gpu?: string;
  renderer?: string;
  vendor?: string;
  unmaskedRenderer?: string;
  unmaskedVendor?: string;
  pixels?: string;
  pixels2?: string;
  parameterOrExtensionLie?: boolean;
}

// Audio module data
export interface AudioData {
  sampleSum: number;
  floatFrequencyDataSum?: number;
  floatTimeDomainDataSum?: number;
  compressorGainReduction?: number;
  totalUniqueSamples?: number;
  binsSample?: number[];
  copySample?: number[];
  values?: string;
  noise?: boolean;
}

// Navigator module data
export interface NavigatorData {
  userAgent: string;
  appVersion: string;
  platform: string;
  vendor: string;
  language: string;
  languages: string[];
  hardwareConcurrency?: number;
  deviceMemory?: number;
  maxTouchPoints?: number;
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
  cookieEnabled: boolean;
  plugins: string[];
  mimeTypes: string[];
  webdriver?: boolean;
  pdfViewerEnabled?: boolean;
  oscpu?: string;
  permissions?: Record<string, string>;
  bluetooth?: boolean;
  userAgentData?: {
    brands: Array<{ brand: string; version: string }>;
    mobile: boolean;
    platform: string;
    platformVersion?: string;
    architecture?: string;
    bitness?: string;
    model?: string;
    uaFullVersion?: string;
  };
  device?: string;
  system?: string;
  uaPostReduction?: boolean;
  properties?: string[];
  webgpu?: {
    supported: boolean;
    adapter?: string;
  };
}

// Screen module data
export interface ScreenData {
  width: number;
  height: number;
  availWidth: number;
  availHeight: number;
  colorDepth: number;
  pixelDepth: number;
  devicePixelRatio?: number;
  orientation?: string;
  screenLeft?: number;
  screenTop?: number;
  touch?: {
    maxTouchPoints: number;
    touchEvent: boolean;
    touchStart: boolean;
  };
}

// Fonts module data
export interface FontsData {
  fontFaceLoadFonts?: string[];
  pixelSizeSystemSum?: number;
  apps?: string[];
  emojiSet?: string[];
  platformVersion?: string;
}

// Timezone module data
export interface TimezoneData {
  zone: string;
  offset: number;
  offsetComputed?: string;
  location?: string;
  locationMeasured?: string;
  locationEpoch?: string;
}

// Math module data
export interface MathData {
  data: Record<string, number>;
}

// DOMRect module data
export interface DOMRectData {
  domrectSystemSum?: number;
  elementBoundingClientRect?: Record<string, number>;
  elementClientRects?: string;
  rangeBoundingClientRect?: Record<string, number>;
  rangeClientRects?: string;
  emojiSet?: string[];
}

// Intl module data
export interface IntlData {
  dateTimeFormat: string;
  numberFormat: string;
  pluralRules: string;
  relativeTimeFormat?: string;
  listFormat?: string;
  displayNames?: string;
  locale?: string;
}

// WebRTC module data
export interface WebRTCData {
  supported: boolean;
  audio?: {
    codecs: string[];
    devices: number;
  };
  video?: {
    codecs: string[];
    devices: number;
  };
  iceConnectionState?: string;
  localIPs?: string[];
}

// SVG module data
export interface SVGData {
  bBox?: Record<string, number>;
  computedTextLength?: number;
  subStringLength?: number;
  extentOfChar?: Record<string, number>;
  svgrectSystemSum?: number;
  emojiSet?: string[];
}

// Speech module data
export interface SpeechData {
  voices?: Array<{
    name: string;
    lang: string;
    localService: boolean;
  }>;
  local?: number;
  remote?: number;
  languages?: string[];
  defaultVoiceName?: string;
  defaultVoiceLang?: string;
}

// CSS module data
export interface CSSData {
  computedStyle?: Record<string, string>;
  system?: Record<string, string>;
}

// CSS Media module data
export interface CSSMediaData {
  matchMediaCSS?: Record<string, boolean>;
  mediaCSS?: Record<string, boolean>;
  screenQuery?: string;
  colorGamut?: string;
  prefersColorScheme?: string;
  prefersReducedMotion?: string;
  prefersContrast?: string;
}

// Media module data
export interface MediaData {
  mimeTypes?: Array<{
    type: string;
    supported: string;
  }>;
}

// Window module data
export interface WindowData {
  keys?: string[];
  apple?: string[];
  moz?: string[];
  webkit?: string[];
}

// Headless detection data
export interface HeadlessData {
  headless?: boolean;
  headlessRating?: number;
  likeHeadless?: boolean;
  likeHeadlessRating?: number;
  stealth?: Record<string, boolean>;
  stealthRating?: number;
  chromium?: boolean;
  platformEstimate?: string[];
  systemFonts?: string;
}

// Lies detection data
export interface LiesData {
  totalLies: number;
  data?: Record<string, Array<{
    name: string;
    lieTypes: string[];
  }>>;
  lies?: Record<string, boolean>;
}

// Resistance detection data
export interface ResistanceData {
  privacy?: string;
  security?: string;
  mode?: string;
  extension?: string;
  extensionHashPattern?: string;
  engine?: string;
  isFarbled?: boolean;
  farblingLevel?: 'off' | 'standard' | 'strict';
}

// GPU Timing module data (DRAWNAPART)
export interface GpuTimingData {
  timings: number[];
  pattern: string;
  gpuScore: number;
  supported: boolean;
}

// Worker module data
export interface WorkerData {
  userAgent?: string;
  platform?: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  language?: string;
  languages?: string[];
  timezoneOffset?: number;
  timezoneLocation?: string;
  gpu?: string;
  webglVendor?: string;
  webglRenderer?: string;
  locale?: string;
  localeEntropyIsTrusty?: boolean;
  localeIntlEntropyIsTrusty?: boolean;
  device?: string;
  system?: string;
  systemCurrencyLocale?: string;
  engineCurrencyLocale?: string;
  uaPostReduction?: boolean;
  userAgentData?: NavigatorData['userAgentData'];
  userAgentEngine?: string;
  userAgentVersion?: string;
  userAgentDataVersion?: string;
  lies?: boolean;
  lied?: boolean;
}

// Errors module data
export interface ErrorsData {
  errors?: string[];
}

// Detection results
export interface DetectionResult {
  isHeadless: boolean;
  liesDetected: number;
  privacyTools: string[];
  confidence: number;
}

// Component result map
export interface ComponentResults {
  canvas?: ModuleResult<CanvasData>;
  webgl?: ModuleResult<WebGLData>;
  audio?: ModuleResult<AudioData>;
  navigator?: ModuleResult<NavigatorData>;
  screen?: ModuleResult<ScreenData>;
  fonts?: ModuleResult<FontsData>;
  timezone?: ModuleResult<TimezoneData>;
  math?: ModuleResult<MathData>;
  domrect?: ModuleResult<DOMRectData>;
  intl?: ModuleResult<IntlData>;
  webrtc?: ModuleResult<WebRTCData>;
  svg?: ModuleResult<SVGData>;
  speech?: ModuleResult<SpeechData>;
  css?: ModuleResult<CSSData>;
  cssmedia?: ModuleResult<CSSMediaData>;
  media?: ModuleResult<MediaData>;
  window?: ModuleResult<WindowData>;
  headless?: ModuleResult<HeadlessData>;
  lies?: ModuleResult<LiesData>;
  resistance?: ModuleResult<ResistanceData>;
  worker?: ModuleResult<WorkerData>;
  errors?: ModuleResult<ErrorsData>;
  gpuTiming?: ModuleResult<GpuTimingData>;
}

// Main fingerprint result
export interface FingerprintResult {
  fingerprint: string;
  fuzzyHash: string;
  stableHash: string;
  gpuTimingHash?: string;
  components: ComponentResults;
  detection: DetectionResult & {
    isFarbled?: boolean;
    farblingLevel?: string;
  };
  entropy: number;
  timestamp: number;
  duration: number;
}

// Server identification response
export interface IdentifyResponse {
  visitorId: string;
  confidence: number;
  matchType: 'exact' | 'stable' | 'gpu' | 'fuzzy-stable' | 'fuzzy' | 'new';
  requestId?: string;
}

// Module interface
export interface FingerprintModule<T = unknown> {
  name: ModuleName;
  collect(): Promise<ModuleResult<T>>;
}

// Lie detection types
export interface LieRecord {
  name: string;
  lieTypes: string[];
  hasLied: boolean;
}

// Browser/Engine detection
export type JSEngine = 'V8' | 'SpiderMonkey' | 'JavaScriptCore' | null;
export type BrowserEngine = 'Blink' | 'Gecko' | 'WebKit' | null;

export interface EngineInfo {
  jsEngine: JSEngine;
  browserEngine: BrowserEngine;
  isBlink: boolean;
  isGecko: boolean;
  isWebKit: boolean;
}

// Platform classifier
export interface PlatformClassifier {
  decrypted: string;
  system: string;
  device?: string;
}

// Worker message types
export interface WorkerMessage {
  type: 'collect' | 'result' | 'error';
  data?: unknown;
  error?: string;
}

// Entropy calculation
export interface EntropyMetric {
  name: string;
  value: unknown;
  entropy: number;
}
