/**
 * Safari ITP (Intelligent Tracking Prevention) Detection Module
 *
 * Safari Private mode randomizes certain fingerprint signals, but the WAY it randomizes
 * creates a detectable pattern. This module fingerprints the randomization behavior itself.
 *
 * Based on CreepJS techniques for detecting privacy tool signatures.
 */

import { sha256 } from '../core/crypto';
import type { ModuleResult } from '../types';

export interface ITPDetectionData {
  // Safari ITP indicators
  isLikelySafariPrivate: boolean;
  itpSignature: string;

  // Randomization detection
  canvasRandomized: boolean;
  audioRandomized: boolean;
  webglRandomized: boolean;

  // Stability tests
  canvasStability: number; // 0-1, how stable canvas is across renders
  audioStability: number;
  webglStability: number;

  // Pattern characteristics
  randomizationPattern: string;
  entropyScore: number;
}

/**
 * Test if canvas output is randomized (Safari Private randomizes per-render)
 */
async function testCanvasRandomization(): Promise<{ randomized: boolean; stability: number; pattern: string }> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { randomized: false, stability: 1, pattern: '' };

    const renders: string[] = [];

    // Render the same thing 5 times
    for (let i = 0; i < 5; i++) {
      ctx.clearRect(0, 0, 50, 50);
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 25, 25);
      ctx.fillStyle = '#069';
      ctx.fillRect(25, 0, 25, 25);
      ctx.fillStyle = '#963';
      ctx.fillRect(0, 25, 25, 25);
      ctx.fillStyle = '#666';
      ctx.fillRect(25, 25, 25, 25);
      ctx.font = '11px Arial';
      ctx.fillStyle = '#fff';
      ctx.fillText('Test', 5, 15);

      renders.push(canvas.toDataURL().slice(-50)); // Last 50 chars of data URL
    }

    // Check how many unique renders we got
    const uniqueRenders = new Set(renders);
    const stability = 1 - (uniqueRenders.size - 1) / (renders.length - 1);
    const randomized = uniqueRenders.size > 1;

    // Create pattern from the differences
    const pattern = randomized ? `canvas-rand-${uniqueRenders.size}` : 'canvas-stable';

    return { randomized, stability, pattern };
  } catch {
    return { randomized: false, stability: 0, pattern: 'canvas-error' };
  }
}

/**
 * Test if audio output is randomized
 */
async function testAudioRandomization(): Promise<{ randomized: boolean; stability: number; pattern: string }> {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return { randomized: false, stability: 1, pattern: 'no-audio' };

    const results: number[] = [];

    // Run audio fingerprint 3 times
    for (let i = 0; i < 3; i++) {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const analyser = ctx.createAnalyser();
      const gain = ctx.createGain();
      const compressor = ctx.createDynamicsCompressor();

      oscillator.type = 'triangle';
      oscillator.frequency.value = 10000;

      compressor.threshold.value = -50;
      compressor.knee.value = 40;
      compressor.ratio.value = 12;
      compressor.attack.value = 0;
      compressor.release.value = 0.25;

      oscillator.connect(compressor);
      compressor.connect(analyser);
      analyser.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = 0; // Mute

      oscillator.start(0);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 50));

      const data = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatFrequencyData(data);

      // Sum first 100 values as fingerprint
      const sum = data.slice(0, 100).reduce((a, b) => a + (isFinite(b) ? b : 0), 0);
      results.push(Math.round(sum * 1000));

      oscillator.stop();
      ctx.close();
    }

    const uniqueResults = new Set(results);
    const stability = 1 - (uniqueResults.size - 1) / (results.length - 1);
    const randomized = uniqueResults.size > 1;
    const pattern = randomized ? `audio-rand-${uniqueResults.size}` : 'audio-stable';

    return { randomized, stability, pattern };
  } catch {
    return { randomized: false, stability: 0, pattern: 'audio-error' };
  }
}

/**
 * Test if WebGL output is randomized
 */
async function testWebGLRandomization(): Promise<{ randomized: boolean; stability: number; pattern: string }> {
  try {
    const results: string[] = [];

    for (let i = 0; i < 3; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const gl = canvas.getContext('webgl');
      if (!gl) return { randomized: false, stability: 1, pattern: 'no-webgl' };

      // Simple WebGL render
      gl.clearColor(0.2, 0.4, 0.6, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const pixels = new Uint8Array(4);
      gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      results.push(Array.from(pixels).join(','));
    }

    const uniqueResults = new Set(results);
    const stability = 1 - (uniqueResults.size - 1) / (results.length - 1);
    const randomized = uniqueResults.size > 1;
    const pattern = randomized ? `webgl-rand-${uniqueResults.size}` : 'webgl-stable';

    return { randomized, stability, pattern };
  } catch {
    return { randomized: false, stability: 0, pattern: 'webgl-error' };
  }
}

/**
 * Detect Safari-specific ITP characteristics
 */
function detectSafariITPCharacteristics(): { isLikelySafari: boolean; indicators: string[] } {
  const indicators: string[] = [];

  // Check for WebKit
  const isWebKit = /AppleWebKit/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  if (isWebKit) indicators.push('webkit');

  // Check for Safari-specific behavior
  // @ts-expect-error - Safari-specific
  if (window.safari) indicators.push('safari-object');

  // Check for Apple Pay support (Safari-specific)
  // @ts-expect-error - ApplePaySession
  if (window.ApplePaySession) indicators.push('apple-pay');

  // Check for Safari's storage behavior
  try {
    const testKey = '__itp_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
  } catch {
    indicators.push('storage-restricted');
  }

  // Check for indexedDB restrictions (Safari Private)
  try {
    const request = indexedDB.open('__itp_test__');
    request.onerror = () => indicators.push('indexeddb-restricted');
    // Clean up
    request.onsuccess = () => {
      const db = request.result;
      db.close();
      indexedDB.deleteDatabase('__itp_test__');
    };
  } catch {
    indicators.push('indexeddb-error');
  }

  return {
    isLikelySafari: isWebKit || indicators.length > 1,
    indicators,
  };
}

/**
 * Calculate entropy score from randomization patterns
 */
function calculateEntropyScore(
  canvasStability: number,
  audioStability: number,
  webglStability: number
): number {
  // Higher score = more randomization detected
  const instability = (
    (1 - canvasStability) * 0.4 +
    (1 - audioStability) * 0.3 +
    (1 - webglStability) * 0.3
  );
  return Math.round(instability * 100) / 100;
}

/**
 * Main collection function
 */
export async function collectITPDetection(): Promise<ModuleResult<ITPDetectionData>> {
  try {
    // Run all tests in parallel
    const [canvasTest, audioTest, webglTest] = await Promise.all([
      testCanvasRandomization(),
      testAudioRandomization(),
      testWebGLRandomization(),
    ]);

    const safariDetection = detectSafariITPCharacteristics();

    // Determine if this is likely Safari Private mode
    const isLikelySafariPrivate = safariDetection.isLikelySafari && (
      canvasTest.randomized || audioTest.randomized || webglTest.randomized
    );

    // Create randomization pattern signature
    const patterns = [
      canvasTest.pattern,
      audioTest.pattern,
      webglTest.pattern,
      ...safariDetection.indicators,
    ].filter(Boolean).sort();

    const randomizationPattern = patterns.join('|');

    // Create ITP signature (this becomes a fingerprint!)
    const itpSignature = [
      `canvas:${canvasTest.stability.toFixed(2)}`,
      `audio:${audioTest.stability.toFixed(2)}`,
      `webgl:${webglTest.stability.toFixed(2)}`,
      safariDetection.isLikelySafari ? 'safari' : 'other',
      isLikelySafariPrivate ? 'private' : 'normal',
    ].join('-');

    const entropyScore = calculateEntropyScore(
      canvasTest.stability,
      audioTest.stability,
      webglTest.stability
    );

    const data: ITPDetectionData = {
      isLikelySafariPrivate,
      itpSignature,
      canvasRandomized: canvasTest.randomized,
      audioRandomized: audioTest.randomized,
      webglRandomized: webglTest.randomized,
      canvasStability: canvasTest.stability,
      audioStability: audioTest.stability,
      webglStability: webglTest.stability,
      randomizationPattern,
      entropyScore,
    };

    const hash = await sha256(data);

    return {
      hash,
      data,
    };
  } catch (error) {
    return {
      hash: '',
      data: {
        isLikelySafariPrivate: false,
        itpSignature: 'error',
        canvasRandomized: false,
        audioRandomized: false,
        webglRandomized: false,
        canvasStability: 0,
        audioStability: 0,
        webglStability: 0,
        randomizationPattern: 'error',
        entropyScore: 0,
      },
      error: String(error),
    };
  }
}
