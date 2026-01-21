/**
 * Timezone Fingerprinting Module
 * Collects timezone and locale information
 */

import type { ModuleResult, TimezoneData } from '../types';
import { sha256 } from '../core/crypto';

// Get timezone name
function getTimezoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return '';
  }
}

// Get timezone offset in minutes
function getTimezoneOffset(): number {
  return new Date().getTimezoneOffset();
}

// Get computed offset string (e.g., "+05:30")
function getComputedOffset(): string {
  const offset = getTimezoneOffset();
  const absOffset = Math.abs(offset);
  const hours = Math.floor(absOffset / 60);
  const minutes = absOffset % 60;
  const sign = offset <= 0 ? '+' : '-';
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Get location from timezone using various date methods
function getLocationMeasured(): string {
  try {
    const date = new Date();
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: getTimezoneName(),
      timeZoneName: 'long',
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    return tzPart?.value || '';
  } catch {
    return '';
  }
}

// Get timezone at different epochs to detect DST behavior
function getLocationEpoch(): string {
  try {
    // Test different epochs for DST detection
    const epochs = [
      new Date('January 1, 2020 00:00:00'),
      new Date('July 1, 2020 00:00:00'),
    ];

    const offsets = epochs.map((date) => date.getTimezoneOffset());
    return offsets.join(',');
  } catch {
    return '';
  }
}

// Get timezone location from Intl API
function getLocation(): string {
  try {
    const zone = getTimezoneName();
    // Extract city/region from zone name (e.g., "America/New_York" -> "New_York")
    const parts = zone.split('/');
    return parts[parts.length - 1].replace(/_/g, ' ');
  } catch {
    return '';
  }
}

// Additional timezone fingerprinting
function getTimezoneFingerprint(): Record<string, unknown> {
  const date = new Date();

  return {
    // Standard methods
    toTimeString: date.toTimeString().split(' ').slice(1).join(' '),
    toLocaleString: date.toLocaleString('en-US', { timeZoneName: 'short' }),

    // Date string analysis
    dateString: date.toString().match(/\(([^)]+)\)/)?.[1] || '',

    // Intl analysis
    resolvedOptions: Intl.DateTimeFormat().resolvedOptions(),
  };
}

export async function collectTimezone(): Promise<ModuleResult<TimezoneData>> {
  const data: TimezoneData = {
    zone: getTimezoneName(),
    offset: getTimezoneOffset(),
    offsetComputed: getComputedOffset(),
    location: getLocation(),
    locationMeasured: getLocationMeasured(),
    locationEpoch: getLocationEpoch(),
  };

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
