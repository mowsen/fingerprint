/**
 * CSS Media Query Fingerprinting Module
 * Collects media query results for fingerprinting
 */

import type { ModuleResult, CSSMediaData } from '../types';
import { sha256 } from '../core/crypto';

// Media queries to test via matchMedia
const MEDIA_QUERIES = [
  // Color scheme
  '(prefers-color-scheme: dark)',
  '(prefers-color-scheme: light)',
  '(prefers-color-scheme: no-preference)',

  // Reduced motion
  '(prefers-reduced-motion: reduce)',
  '(prefers-reduced-motion: no-preference)',

  // Contrast
  '(prefers-contrast: high)',
  '(prefers-contrast: low)',
  '(prefers-contrast: no-preference)',
  '(prefers-contrast: more)',
  '(prefers-contrast: less)',
  '(prefers-contrast: custom)',

  // Reduced transparency
  '(prefers-reduced-transparency: reduce)',
  '(prefers-reduced-transparency: no-preference)',

  // Color gamut
  '(color-gamut: srgb)',
  '(color-gamut: p3)',
  '(color-gamut: rec2020)',

  // Display mode
  '(display-mode: fullscreen)',
  '(display-mode: standalone)',
  '(display-mode: minimal-ui)',
  '(display-mode: browser)',

  // Pointer
  '(pointer: none)',
  '(pointer: coarse)',
  '(pointer: fine)',
  '(any-pointer: none)',
  '(any-pointer: coarse)',
  '(any-pointer: fine)',

  // Hover
  '(hover: none)',
  '(hover: hover)',
  '(any-hover: none)',
  '(any-hover: hover)',

  // Color
  '(color)',
  '(monochrome)',

  // Inverted colors
  '(inverted-colors: inverted)',
  '(inverted-colors: none)',

  // HDR
  '(dynamic-range: high)',
  '(dynamic-range: standard)',

  // Forced colors
  '(forced-colors: active)',
  '(forced-colors: none)',

  // Orientation
  '(orientation: portrait)',
  '(orientation: landscape)',

  // Scripting
  '(scripting: enabled)',
  '(scripting: none)',
  '(scripting: initial-only)',
];

// CSS media features via @media rules
const MEDIA_CSS_TESTS: Array<{ name: string; query: string }> = [
  { name: 'webkit-min-device-pixel-ratio', query: '(-webkit-min-device-pixel-ratio: 2)' },
  { name: 'webkit-transform-3d', query: '(-webkit-transform-3d)' },
  { name: 'moz-appearance', query: '(-moz-appearance: none)' },
  { name: 'moz-device-pixel-ratio', query: '(-moz-device-pixel-ratio: 2)' },
];

// Get matchMedia results
function getMatchMediaResults(): Record<string, boolean> {
  const results: Record<string, boolean> = {};

  for (const query of MEDIA_QUERIES) {
    try {
      const match = window.matchMedia(query);
      results[query] = match.matches;
    } catch {
      // Query not supported
    }
  }

  return results;
}

// Get CSS media results via stylesheet
function getCSSMediaResults(): Record<string, boolean> {
  const results: Record<string, boolean> = {};

  try {
    const style = document.createElement('style');
    const testId = 'fp-media-test-element';
    const element = document.createElement('div');
    element.id = testId;
    element.style.cssText = 'position: absolute; left: -9999px;';

    let cssRules = '';
    for (let i = 0; i < MEDIA_CSS_TESTS.length; i++) {
      const { query } = MEDIA_CSS_TESTS[i];
      cssRules += `@media ${query} { #${testId} { --test-${i}: 1; } }`;
    }
    style.textContent = cssRules;

    document.head.appendChild(style);
    document.body.appendChild(element);

    const computed = getComputedStyle(element);

    for (let i = 0; i < MEDIA_CSS_TESTS.length; i++) {
      const { name } = MEDIA_CSS_TESTS[i];
      const value = computed.getPropertyValue(`--test-${i}`);
      results[name] = value === '1';
    }

    document.head.removeChild(style);
    document.body.removeChild(element);
  } catch {
    // CSS media test failed
  }

  return results;
}

// Get screen query fingerprint
function getScreenQuery(): string {
  try {
    const queries = [
      `(width: ${screen.width}px)`,
      `(height: ${screen.height}px)`,
      `(device-width: ${screen.width}px)`,
      `(device-height: ${screen.height}px)`,
    ];

    return queries
      .map((q) => {
        try {
          return window.matchMedia(q).matches ? '1' : '0';
        } catch {
          return '?';
        }
      })
      .join('');
  } catch {
    return '';
  }
}

// Get color gamut
function getColorGamut(): string {
  const gamuts = ['rec2020', 'p3', 'srgb'];
  for (const gamut of gamuts) {
    try {
      if (window.matchMedia(`(color-gamut: ${gamut})`).matches) {
        return gamut;
      }
    } catch {
      // Continue
    }
  }
  return '';
}

// Get prefers-color-scheme
function getPrefersColorScheme(): string {
  try {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return 'no-preference';
  } catch {
    return '';
  }
}

// Get prefers-reduced-motion
function getPrefersReducedMotion(): string {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduce';
    return 'no-preference';
  } catch {
    return '';
  }
}

// Get prefers-contrast
function getPrefersContrast(): string {
  try {
    if (window.matchMedia('(prefers-contrast: more)').matches) return 'more';
    if (window.matchMedia('(prefers-contrast: less)').matches) return 'less';
    if (window.matchMedia('(prefers-contrast: high)').matches) return 'high';
    if (window.matchMedia('(prefers-contrast: low)').matches) return 'low';
    return 'no-preference';
  } catch {
    return '';
  }
}

export async function collectCSSMedia(): Promise<ModuleResult<CSSMediaData>> {
  const data: CSSMediaData = {
    matchMediaCSS: getMatchMediaResults(),
    mediaCSS: getCSSMediaResults(),
    screenQuery: getScreenQuery(),
    colorGamut: getColorGamut(),
    prefersColorScheme: getPrefersColorScheme(),
    prefersReducedMotion: getPrefersReducedMotion(),
    prefersContrast: getPrefersContrast(),
  };

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
