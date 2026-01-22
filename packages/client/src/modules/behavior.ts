/**
 * Behavioral Biometrics Module
 * Collects mouse movement, scroll, and interaction patterns
 *
 * Note: This module requires extended collection time (2-5 seconds of user interaction)
 * It's used for continuous authentication and session-based identification,
 * not initial fingerprinting.
 */

import type { ModuleResult, BehaviorData } from '../types';
import { sha256 } from '../core/crypto';

/**
 * Sample point for mouse/scroll tracking
 */
interface Sample {
  x: number;
  y: number;
  t: number;
  type: 'move' | 'click' | 'scroll';
}

/**
 * Mouse movement patterns
 */
interface MousePatterns {
  avgSpeed: number;
  avgAcceleration: number;
  straightLineRatio: number;
  clickCount: number;
  moveCount: number;
  avgMoveDuration: number;
}

/**
 * Scroll patterns
 */
interface ScrollPatterns {
  avgScrollSpeed: number;
  scrollDirectionChanges: number;
  avgScrollDistance: number;
  scrollCount: number;
}

/**
 * Timing patterns
 */
interface TimingPatterns {
  avgInteractionInterval: number;
  interactionVariance: number;
  totalDuration: number;
}

/**
 * Calculate average of an array
 */
function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Calculate variance of an array
 */
function variance(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = avg(arr);
  return arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
}

/**
 * Round to fixed precision
 */
function round(value: number, precision = 4): number {
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}

/**
 * BehaviorCollector class for tracking user behavior
 * Use start() to begin collection, stop() to end and get results
 */
export class BehaviorCollector {
  private samples: Sample[] = [];
  private startTime = 0;
  private isCollecting = false;
  private boundHandlers: {
    mouseMove: (e: MouseEvent) => void;
    click: (e: MouseEvent) => void;
    scroll: () => void;
  } | null = null;

  /**
   * Start collecting behavioral data
   */
  start(): void {
    if (this.isCollecting) return;

    this.samples = [];
    this.startTime = performance.now();
    this.isCollecting = true;

    // Create bound handlers
    this.boundHandlers = {
      mouseMove: this.handleMouseMove.bind(this),
      click: this.handleClick.bind(this),
      scroll: this.handleScroll.bind(this),
    };

    document.addEventListener('mousemove', this.boundHandlers.mouseMove, { passive: true });
    document.addEventListener('click', this.boundHandlers.click, { passive: true });
    document.addEventListener('scroll', this.boundHandlers.scroll, { passive: true });
  }

  /**
   * Stop collecting and return analyzed data
   */
  stop(): BehaviorData {
    this.isCollecting = false;

    if (this.boundHandlers) {
      document.removeEventListener('mousemove', this.boundHandlers.mouseMove);
      document.removeEventListener('click', this.boundHandlers.click);
      document.removeEventListener('scroll', this.boundHandlers.scroll);
      this.boundHandlers = null;
    }

    return this.analyze();
  }

  /**
   * Check if currently collecting
   */
  get collecting(): boolean {
    return this.isCollecting;
  }

  /**
   * Get current sample count
   */
  get sampleCount(): number {
    return this.samples.length;
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isCollecting) return;

    // Throttle to avoid too many samples
    const lastSample = this.samples[this.samples.length - 1];
    const now = performance.now() - this.startTime;

    if (lastSample && lastSample.type === 'move' && now - lastSample.t < 16) {
      return; // Skip if less than ~16ms since last sample
    }

    this.samples.push({
      x: e.clientX,
      y: e.clientY,
      t: now,
      type: 'move',
    });
  }

  private handleClick(e: MouseEvent): void {
    if (!this.isCollecting) return;

    this.samples.push({
      x: e.clientX,
      y: e.clientY,
      t: performance.now() - this.startTime,
      type: 'click',
    });
  }

  private handleScroll(): void {
    if (!this.isCollecting) return;

    this.samples.push({
      x: window.scrollX,
      y: window.scrollY,
      t: performance.now() - this.startTime,
      type: 'scroll',
    });
  }

  private analyze(): BehaviorData {
    const moves = this.samples.filter((s) => s.type === 'move');
    const clicks = this.samples.filter((s) => s.type === 'click');
    const scrolls = this.samples.filter((s) => s.type === 'scroll');

    const mousePatterns = this.analyzeMousePatterns(moves, clicks);
    const scrollPatterns = this.analyzeScrollPatterns(scrolls);
    const timingPatterns = this.analyzeTimingPatterns();

    return {
      mousePatterns,
      scrollPatterns,
      timingPatterns,
      sampleCount: this.samples.length,
      collectionDuration: round(performance.now() - this.startTime),
    };
  }

  private analyzeMousePatterns(moves: Sample[], clicks: Sample[]): MousePatterns {
    const speeds: number[] = [];
    const accelerations: number[] = [];
    const durations: number[] = [];

    // Calculate speeds and accelerations between consecutive moves
    for (let i = 1; i < moves.length; i++) {
      const dx = moves[i].x - moves[i - 1].x;
      const dy = moves[i].y - moves[i - 1].y;
      const dt = moves[i].t - moves[i - 1].t;

      if (dt > 0) {
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = distance / dt;
        speeds.push(speed);

        durations.push(dt);

        if (speeds.length > 1) {
          const accel = Math.abs(speeds[speeds.length - 1] - speeds[speeds.length - 2]) / dt;
          accelerations.push(accel);
        }
      }
    }

    // Calculate straight line ratio (how direct is movement)
    let straightLineRatio = 0;
    if (moves.length >= 2) {
      const straightLineDistance = Math.sqrt(
        Math.pow(moves[moves.length - 1].x - moves[0].x, 2) +
          Math.pow(moves[moves.length - 1].y - moves[0].y, 2)
      );

      let actualDistance = 0;
      for (let i = 1; i < moves.length; i++) {
        actualDistance += Math.sqrt(
          Math.pow(moves[i].x - moves[i - 1].x, 2) +
            Math.pow(moves[i].y - moves[i - 1].y, 2)
        );
      }

      straightLineRatio = actualDistance > 0 ? straightLineDistance / actualDistance : 0;
    }

    return {
      avgSpeed: round(avg(speeds)),
      avgAcceleration: round(avg(accelerations)),
      straightLineRatio: round(straightLineRatio),
      clickCount: clicks.length,
      moveCount: moves.length,
      avgMoveDuration: round(avg(durations)),
    };
  }

  private analyzeScrollPatterns(scrolls: Sample[]): ScrollPatterns {
    const speeds: number[] = [];
    const distances: number[] = [];
    let directionChanges = 0;

    for (let i = 1; i < scrolls.length; i++) {
      const dy = Math.abs(scrolls[i].y - scrolls[i - 1].y);
      const dt = scrolls[i].t - scrolls[i - 1].t;

      distances.push(dy);

      if (dt > 0) {
        speeds.push(dy / dt);
      }

      // Count direction changes
      if (i >= 2) {
        const dir1 = Math.sign(scrolls[i - 1].y - scrolls[i - 2].y);
        const dir2 = Math.sign(scrolls[i].y - scrolls[i - 1].y);
        if (dir1 !== dir2 && dir1 !== 0 && dir2 !== 0) {
          directionChanges++;
        }
      }
    }

    return {
      avgScrollSpeed: round(avg(speeds)),
      scrollDirectionChanges: directionChanges,
      avgScrollDistance: round(avg(distances)),
      scrollCount: scrolls.length,
    };
  }

  private analyzeTimingPatterns(): TimingPatterns {
    const intervals: number[] = [];

    for (let i = 1; i < this.samples.length; i++) {
      intervals.push(this.samples[i].t - this.samples[i - 1].t);
    }

    return {
      avgInteractionInterval: round(avg(intervals)),
      interactionVariance: round(Math.sqrt(variance(intervals))),
      totalDuration: round(performance.now() - this.startTime),
    };
  }
}

/**
 * Singleton collector instance for convenient usage
 */
let globalCollector: BehaviorCollector | null = null;

/**
 * Get the global behavior collector instance
 */
export function getBehaviorCollector(): BehaviorCollector {
  if (!globalCollector) {
    globalCollector = new BehaviorCollector();
  }
  return globalCollector;
}

/**
 * Collect behavioral data for a specified duration
 * Returns a promise that resolves with the collected data
 *
 * @param duration Collection duration in milliseconds (default: 3000ms)
 */
export async function collectBehavior(
  duration = 3000
): Promise<ModuleResult<BehaviorData>> {
  const collector = new BehaviorCollector();

  collector.start();

  // Wait for the specified duration
  await new Promise((resolve) => setTimeout(resolve, duration));

  const data = collector.stop();

  // Only hash if we have meaningful data
  if (data.sampleCount < 5) {
    return {
      hash: '',
      data,
      error: 'Insufficient behavioral data collected',
    };
  }

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}

/**
 * Quick behavior snapshot - collects what's available immediately
 * without waiting. Useful for getting any existing behavioral data
 * that may have been collected by a running collector.
 */
export async function collectBehaviorSnapshot(): Promise<ModuleResult<BehaviorData>> {
  const collector = getBehaviorCollector();

  // If collector is running, get current state
  if (collector.collecting) {
    // Create a new collector to analyze without stopping the global one
    const tempCollector = new BehaviorCollector();
    tempCollector.start();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const data = tempCollector.stop();

    if (data.sampleCount < 3) {
      return {
        hash: '',
        data,
        error: 'Minimal behavioral data available',
      };
    }

    const hash = await sha256(data);
    return { hash, data };
  }

  // Not collecting, return empty data
  return {
    hash: '',
    data: {
      mousePatterns: {
        avgSpeed: 0,
        avgAcceleration: 0,
        straightLineRatio: 0,
        clickCount: 0,
        moveCount: 0,
        avgMoveDuration: 0,
      },
      scrollPatterns: {
        avgScrollSpeed: 0,
        scrollDirectionChanges: 0,
        avgScrollDistance: 0,
        scrollCount: 0,
      },
      timingPatterns: {
        avgInteractionInterval: 0,
        interactionVariance: 0,
        totalDuration: 0,
      },
      sampleCount: 0,
      collectionDuration: 0,
    },
    error: 'Behavior collector not running',
  };
}
