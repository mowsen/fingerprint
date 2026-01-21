/**
 * Error Pattern Fingerprinting Module
 * Collects error patterns that differ between browsers
 */

import type { ModuleResult, ErrorsData } from '../types';
import { sha256 } from '../core/crypto';

// Collect error patterns from various operations
function collectErrorPatterns(): string[] {
  const errors: string[] = [];

  // Error 1: Invalid array length
  try {
    // @ts-expect-error - intentional error
    new Array(-1);
  } catch (e) {
    errors.push(`array_length:${(e as Error).message}`);
  }

  // Error 2: Invalid date
  try {
    new Date('invalid').toISOString();
  } catch (e) {
    errors.push(`date_invalid:${(e as Error).message}`);
  }

  // Error 3: JSON parse error
  try {
    JSON.parse('invalid');
  } catch (e) {
    errors.push(`json_parse:${(e as Error).message}`);
  }

  // Error 4: Number precision
  try {
    (1).toFixed(101);
  } catch (e) {
    errors.push(`toFixed_range:${(e as Error).message}`);
  }

  // Error 5: toString radix
  try {
    (1).toString(37);
  } catch (e) {
    errors.push(`toString_radix:${(e as Error).message}`);
  }

  // Error 6: URI decode
  try {
    decodeURIComponent('%');
  } catch (e) {
    errors.push(`uri_decode:${(e as Error).message}`);
  }

  // Error 7: RegExp
  try {
    new RegExp('\\');
  } catch (e) {
    errors.push(`regexp:${(e as Error).message}`);
  }

  // Error 8: BigInt
  try {
    // @ts-expect-error - intentional error
    BigInt('invalid');
  } catch (e) {
    errors.push(`bigint:${(e as Error).message}`);
  }

  // Error 9: Symbol description
  try {
    // @ts-expect-error - intentional error
    Symbol.for();
  } catch (e) {
    errors.push(`symbol:${(e as Error).message}`);
  }

  // Error 10: Intl
  try {
    new Intl.DateTimeFormat('invalid-locale');
  } catch (e) {
    errors.push(`intl_locale:${(e as Error).message}`);
  }

  // Error 11: Object assign
  try {
    Object.assign(null);
  } catch (e) {
    errors.push(`object_assign:${(e as Error).message}`);
  }

  // Error 12: Promise all
  try {
    // @ts-expect-error - intentional error
    Promise.all('not-iterable');
  } catch (e) {
    errors.push(`promise_all:${(e as Error).message}`);
  }

  // Error 13: ArrayBuffer
  try {
    new ArrayBuffer(-1);
  } catch (e) {
    errors.push(`arraybuffer:${(e as Error).message}`);
  }

  // Error 14: DataView
  try {
    new DataView(new ArrayBuffer(0), 1);
  } catch (e) {
    errors.push(`dataview:${(e as Error).message}`);
  }

  // Error 15: String normalize
  try {
    'test'.normalize('invalid');
  } catch (e) {
    errors.push(`normalize:${(e as Error).message}`);
  }

  // Error 16: Reflect
  try {
    // @ts-expect-error - intentional error
    Reflect.get(null, 'prop');
  } catch (e) {
    errors.push(`reflect:${(e as Error).message}`);
  }

  // Error 17: WeakMap
  try {
    // @ts-expect-error - intentional error
    new WeakMap().set('not-object', 1);
  } catch (e) {
    errors.push(`weakmap:${(e as Error).message}`);
  }

  // Error 18: Set
  try {
    // @ts-expect-error - intentional error
    new Set().add.call(null, 1);
  } catch (e) {
    errors.push(`set:${(e as Error).message}`);
  }

  return errors;
}

// Get error constructor names
function getErrorConstructors(): Record<string, string> {
  const constructors: Record<string, string> = {};

  try {
    constructors.Error = Error.prototype.constructor.name;
    constructors.TypeError = TypeError.prototype.constructor.name;
    constructors.RangeError = RangeError.prototype.constructor.name;
    constructors.SyntaxError = SyntaxError.prototype.constructor.name;
    constructors.ReferenceError = ReferenceError.prototype.constructor.name;
    constructors.URIError = URIError.prototype.constructor.name;
    constructors.EvalError = EvalError.prototype.constructor.name;
  } catch {
    // Ignore
  }

  return constructors;
}

// Get error stack format
function getStackFormat(): string {
  try {
    const error = new Error('test');
    const stack = error.stack || '';

    // Different browsers have different stack formats
    if (stack.includes('    at ')) {
      return 'v8'; // Chrome, Edge, Node
    } else if (stack.includes('@')) {
      return 'spidermonkey'; // Firefox
    } else if (stack.includes('global code')) {
      return 'javascriptcore'; // Safari
    }

    return 'unknown';
  } catch {
    return 'error';
  }
}

export async function collectErrors(): Promise<ModuleResult<ErrorsData>> {
  const data: ErrorsData = {
    errors: collectErrorPatterns(),
  };

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
