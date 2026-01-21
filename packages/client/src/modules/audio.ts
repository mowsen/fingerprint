/**
 * Audio Fingerprinting Module
 * Uses Web Audio API to generate unique fingerprints based on audio processing
 */

import type { ModuleResult, AudioData } from '../types';
import { sha256 } from '../core/crypto';

// Audio context type for cross-browser support
type AudioContextType = typeof AudioContext | typeof webkitAudioContext;

declare global {
  interface Window {
    webkitAudioContext?: AudioContextType;
    webkitOfflineAudioContext?: typeof OfflineAudioContext;
  }
}

function getAudioContext(): typeof OfflineAudioContext | null {
  return window.OfflineAudioContext || window.webkitOfflineAudioContext || null;
}

async function runAudioFingerprint(): Promise<AudioData | null> {
  const OfflineCtx = getAudioContext();
  if (!OfflineCtx) return null;

  try {
    // Create offline audio context
    const sampleRate = 44100;
    const context = new OfflineCtx(1, sampleRate, sampleRate);

    // Create oscillator
    const oscillator = context.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(10000, context.currentTime);

    // Create compressor
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-50, context.currentTime);
    compressor.knee.setValueAtTime(40, context.currentTime);
    compressor.ratio.setValueAtTime(12, context.currentTime);
    compressor.attack.setValueAtTime(0, context.currentTime);
    compressor.release.setValueAtTime(0.25, context.currentTime);

    // Connect nodes
    oscillator.connect(compressor);
    compressor.connect(context.destination);

    // Start and render
    oscillator.start(0);
    const renderedBuffer = await context.startRendering();
    oscillator.stop();

    // Get channel data
    const channelData = renderedBuffer.getChannelData(0);

    // Calculate fingerprint values
    let sampleSum = 0;
    const binsSample: number[] = [];
    const uniqueSamples = new Set<number>();

    for (let i = 4500; i < 5000; i++) {
      const sample = channelData[i];
      sampleSum += Math.abs(sample);
      uniqueSamples.add(sample);
      if (i % 10 === 0) {
        binsSample.push(sample);
      }
    }

    // Copy sample for comparison
    const copySample = Array.from(channelData.slice(4500, 4600));

    // Get float frequency data
    const audioContext = new (window.AudioContext || window.webkitAudioContext!)();
    const analyser = audioContext.createAnalyser();
    const frequencyData = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(frequencyData);
    const floatFrequencyDataSum = frequencyData.reduce((a, b) => a + Math.abs(b), 0);

    // Get float time domain data
    const timeDomainData = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(timeDomainData);
    const floatTimeDomainDataSum = timeDomainData.reduce((a, b) => a + Math.abs(b), 0);

    await audioContext.close();

    // Detect noise injection
    const noise = uniqueSamples.size > 1000;

    // Create values string
    const values = copySample.slice(0, 10).map((v) => v.toFixed(10)).join(',');

    return {
      sampleSum,
      floatFrequencyDataSum,
      floatTimeDomainDataSum,
      compressorGainReduction: compressor.reduction,
      totalUniqueSamples: uniqueSamples.size,
      binsSample,
      copySample,
      values,
      noise,
    };
  } catch {
    return null;
  }
}

// Alternative simpler audio fingerprint
async function runSimpleAudioFingerprint(): Promise<{ hash: number } | null> {
  const OfflineCtx = getAudioContext();
  if (!OfflineCtx) return null;

  try {
    const context = new OfflineCtx(1, 5000, 44100);

    const oscillator = context.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.value = 1000;

    const gain = context.createGain();
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(1, context.currentTime + 0.01);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();

    const buffer = await context.startRendering();
    const data = buffer.getChannelData(0);

    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash += Math.abs(data[i]);
    }

    return { hash };
  } catch {
    return null;
  }
}

export async function collectAudio(): Promise<ModuleResult<AudioData>> {
  const data = await runAudioFingerprint();

  if (!data) {
    // Try simple fallback
    const simple = await runSimpleAudioFingerprint();
    if (simple) {
      const fallbackData: AudioData = {
        sampleSum: simple.hash,
      };
      return {
        hash: await sha256(fallbackData),
        data: fallbackData,
      };
    }

    return {
      hash: '',
      data: { sampleSum: 0 },
      error: 'Web Audio API not supported',
    };
  }

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
