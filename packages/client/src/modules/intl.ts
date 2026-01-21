/**
 * Intl Fingerprinting Module
 * Collects internationalization API fingerprints
 */

import type { ModuleResult, IntlData } from '../types';
import { sha256 } from '../core/crypto';

// Get DateTimeFormat fingerprint
function getDateTimeFormat(): string {
  try {
    const options = Intl.DateTimeFormat().resolvedOptions();
    return JSON.stringify({
      locale: options.locale,
      calendar: options.calendar,
      numberingSystem: options.numberingSystem,
      timeZone: options.timeZone,
      hourCycle: options.hourCycle,
    });
  } catch {
    return '';
  }
}

// Get NumberFormat fingerprint
function getNumberFormat(): string {
  try {
    const options = Intl.NumberFormat().resolvedOptions();
    return JSON.stringify({
      locale: options.locale,
      numberingSystem: options.numberingSystem,
      style: options.style,
      currency: options.currency,
      minimumIntegerDigits: options.minimumIntegerDigits,
      minimumFractionDigits: options.minimumFractionDigits,
      maximumFractionDigits: options.maximumFractionDigits,
    });
  } catch {
    return '';
  }
}

// Get PluralRules fingerprint
function getPluralRules(): string {
  try {
    const options = Intl.PluralRules().resolvedOptions();
    return JSON.stringify({
      locale: options.locale,
      type: options.type,
      minimumIntegerDigits: options.minimumIntegerDigits,
      minimumFractionDigits: options.minimumFractionDigits,
      maximumFractionDigits: options.maximumFractionDigits,
      pluralCategories: options.pluralCategories,
    });
  } catch {
    return '';
  }
}

// Get RelativeTimeFormat fingerprint
function getRelativeTimeFormat(): string | undefined {
  try {
    if (!Intl.RelativeTimeFormat) return undefined;
    const options = new Intl.RelativeTimeFormat().resolvedOptions();
    return JSON.stringify({
      locale: options.locale,
      style: options.style,
      numeric: options.numeric,
      numberingSystem: options.numberingSystem,
    });
  } catch {
    return undefined;
  }
}

// Get ListFormat fingerprint
function getListFormat(): string | undefined {
  try {
    if (!Intl.ListFormat) return undefined;
    const options = new Intl.ListFormat().resolvedOptions();
    return JSON.stringify({
      locale: options.locale,
      type: options.type,
      style: options.style,
    });
  } catch {
    return undefined;
  }
}

// Get DisplayNames fingerprint
function getDisplayNames(): string | undefined {
  try {
    if (!Intl.DisplayNames) return undefined;
    const options = new Intl.DisplayNames(['en'], { type: 'language' }).resolvedOptions();
    return JSON.stringify({
      locale: options.locale,
      style: options.style,
      type: options.type,
      fallback: options.fallback,
    });
  } catch {
    return undefined;
  }
}

// Get system locale
function getLocale(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

export async function collectIntl(): Promise<ModuleResult<IntlData>> {
  const data: IntlData = {
    dateTimeFormat: getDateTimeFormat(),
    numberFormat: getNumberFormat(),
    pluralRules: getPluralRules(),
    relativeTimeFormat: getRelativeTimeFormat(),
    listFormat: getListFormat(),
    displayNames: getDisplayNames(),
    locale: getLocale(),
  };

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
