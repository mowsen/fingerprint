/**
 * Browser-Aware Stabilization Rules
 * Inspired by ThumbmarkJS - excludes unstable components per browser/mode
 * This prevents false negatives from browser-specific farbling
 */

export interface StabilizationRule {
  exclude: string[];
  browsers: string[]; // e.g., ['firefox', 'safari>=17', 'brave']
}

/**
 * Stabilization rules for different contexts
 * - private: Incognito/private browsing mode
 * - farbled: Browser with active farbling (Brave shields, Firefox RFP)
 * - standard: Always-applied baseline rules
 */
export const STABILIZATION_RULES: Record<string, StabilizationRule[]> = {
  // Private/incognito mode - some browsers randomize more aggressively
  private: [
    // Firefox private mode has unstable canvas and fonts
    { exclude: ['canvas.dataURI', 'canvas.emojiURI', 'canvas.paintURI'], browsers: ['firefox'] },
    { exclude: ['fonts.fontFaceLoadFonts'], browsers: ['firefox'] },
    // Safari 17+ has enhanced privacy in private mode
    { exclude: ['canvas.dataURI'], browsers: ['safari>=17'] },
    // Brave always farblings canvas in private mode
    { exclude: ['canvas.dataURI', 'canvas.emojiURI', 'canvas.paintURI', 'canvas.textURI'], browsers: ['brave'] },
    { exclude: ['audio.sampleSum', 'audio.values'], browsers: ['brave'] },
  ],

  // Farbled mode - active anti-fingerprinting detected
  farbled: [
    // Brave with shields up - canvas and audio are randomized
    { exclude: ['canvas', 'webgl.dataURI', 'webgl.dataURI2'], browsers: ['brave'] },
    { exclude: ['audio.sampleSum', 'audio.floatFrequencyDataSum', 'audio.floatTimeDomainDataSum'], browsers: ['brave'] },
    // Firefox with resistFingerprinting
    { exclude: ['canvas', 'screen.width', 'screen.height', 'screen.availWidth', 'screen.availHeight'], browsers: ['firefox'] },
    { exclude: ['timezone.zone', 'timezone.offset'], browsers: ['firefox'] },
  ],

  // Standard rules - always applied
  standard: [
    // DOMRect is highly variable across page renders
    { exclude: ['domrect'], browsers: [] },
    // WebRTC local IPs change frequently
    { exclude: ['webrtc.localIPs'], browsers: [] },
  ],
};

/**
 * Parse browser rule string like "firefox>=100" or "safari"
 */
function parseBrowserRule(rule: string): { name: string; op?: string; version?: number } {
  const match = rule.match(/^(.+?)(>=|<=|>|<|=)?(\d+)?$/);
  if (!match) return { name: rule };

  const [, name, op, ver] = match;
  return {
    name: name.toLowerCase(),
    op: op || undefined,
    version: ver ? parseInt(ver, 10) : undefined,
  };
}

/**
 * Check if a browser matches a rule
 */
function browserMatchesRule(
  browserName: string,
  browserVersion: number,
  rule: string
): boolean {
  const parsed = parseBrowserRule(rule);

  if (parsed.name !== browserName.toLowerCase()) {
    return false;
  }

  if (!parsed.op || parsed.version === undefined) {
    return true; // Just browser name, matches any version
  }

  switch (parsed.op) {
    case '>=':
      return browserVersion >= parsed.version;
    case '<=':
      return browserVersion <= parsed.version;
    case '>':
      return browserVersion > parsed.version;
    case '<':
      return browserVersion < parsed.version;
    case '=':
      return browserVersion === parsed.version;
    default:
      return true;
  }
}

/**
 * Get the set of component paths that should be excluded
 * based on browser, version, and active modes
 */
export function getExcludedComponents(
  browser: string,
  browserVersion: number,
  modes: string[]
): Set<string> {
  const excluded = new Set<string>();

  for (const mode of modes) {
    const rules = STABILIZATION_RULES[mode];
    if (!rules) continue;

    for (const rule of rules) {
      // Empty browsers array means apply to all browsers
      const matches =
        rule.browsers.length === 0 ||
        rule.browsers.some((b) => browserMatchesRule(browser, browserVersion, b));

      if (matches) {
        rule.exclude.forEach((path) => excluded.add(path));
      }
    }
  }

  return excluded;
}

/**
 * Check if a component path is excluded
 * Supports both exact matches and prefix matches
 * e.g., "canvas" excludes "canvas.dataURI", "canvas.emojiURI", etc.
 */
export function isComponentExcluded(path: string, excluded: Set<string>): boolean {
  // Direct match
  if (excluded.has(path)) return true;

  // Check if any excluded path is a prefix
  const parts = path.split('.');
  for (let i = 1; i <= parts.length; i++) {
    const prefix = parts.slice(0, i).join('.');
    if (excluded.has(prefix)) return true;
  }

  return false;
}

/**
 * Detect current browser name and version
 */
export function detectBrowser(): { name: string; version: number } {
  const ua = navigator.userAgent;

  // Check for Brave first (has navigator.brave)
  // @ts-expect-error - brave property
  if (navigator.brave) {
    const match = ua.match(/Chrome\/(\d+)/);
    return { name: 'brave', version: match ? parseInt(match[1], 10) : 0 };
  }

  // Edge
  const edgeMatch = ua.match(/Edg\/(\d+)/);
  if (edgeMatch) {
    return { name: 'edge', version: parseInt(edgeMatch[1], 10) };
  }

  // Firefox
  const firefoxMatch = ua.match(/Firefox\/(\d+)/);
  if (firefoxMatch) {
    return { name: 'firefox', version: parseInt(firefoxMatch[1], 10) };
  }

  // Safari (check before Chrome since Chrome UA contains Safari)
  if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    const match = ua.match(/Version\/(\d+)/);
    return { name: 'safari', version: match ? parseInt(match[1], 10) : 0 };
  }

  // Chrome
  const chromeMatch = ua.match(/Chrome\/(\d+)/);
  if (chromeMatch) {
    return { name: 'chrome', version: parseInt(chromeMatch[1], 10) };
  }

  return { name: 'unknown', version: 0 };
}

/**
 * Detect active modes based on browser state
 */
export function detectActiveModes(isFarbled: boolean, isPrivate: boolean): string[] {
  const modes = ['standard'];

  if (isFarbled) {
    modes.push('farbled');
  }

  if (isPrivate) {
    modes.push('private');
  }

  return modes;
}
