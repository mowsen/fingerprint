/**
 * Math Fingerprinting Module
 * Detects floating-point precision differences across browsers/platforms
 */

import type { ModuleResult, MathData } from '../types';
import { sha256 } from '../core/crypto';

// Math operations that can reveal implementation differences
function getMathFingerprint(): Record<string, number> {
  const data: Record<string, number> = {};

  // Trigonometric functions
  data['acos_0.5'] = Math.acos(0.5);
  data['acosh_1e10'] = Math.acosh(1e10);
  data['asin_0.5'] = Math.asin(0.5);
  data['asinh_1'] = Math.asinh(1);
  data['atan_2'] = Math.atan(2);
  data['atanh_0.5'] = Math.atanh(0.5);
  data['atan2_1_2'] = Math.atan2(1, 2);

  // Exponential functions
  data['cbrt_100'] = Math.cbrt(100);
  data['exp_1'] = Math.exp(1);
  data['expm1_1'] = Math.expm1(1);

  // Hyperbolic functions
  data['cosh_1'] = Math.cosh(1);
  data['sinh_1'] = Math.sinh(1);
  data['tanh_1'] = Math.tanh(1);

  // Logarithmic functions
  data['log_10'] = Math.log(10);
  data['log10_7'] = Math.log10(7);
  data['log1p_10'] = Math.log1p(10);
  data['log2_17'] = Math.log2(17);

  // Power and root functions
  data['pow_pi_e'] = Math.pow(Math.PI, Math.E);
  data['sqrt_2'] = Math.sqrt(2);

  // Rounding functions (edge cases)
  data['sin_1'] = Math.sin(1);
  data['cos_1'] = Math.cos(1);
  data['tan_1'] = Math.tan(1);

  // Constants precision
  data['E'] = Math.E;
  data['LN10'] = Math.LN10;
  data['LN2'] = Math.LN2;
  data['LOG10E'] = Math.LOG10E;
  data['LOG2E'] = Math.LOG2E;
  data['PI'] = Math.PI;
  data['SQRT1_2'] = Math.SQRT1_2;
  data['SQRT2'] = Math.SQRT2;

  // Complex calculations
  data['sin_pi'] = Math.sin(Math.PI);
  data['cos_pi'] = Math.cos(Math.PI);
  data['sin_pi_6'] = Math.sin(Math.PI / 6);
  data['cos_pi_4'] = Math.cos(Math.PI / 4);
  data['tan_pi_4'] = Math.tan(Math.PI / 4);

  // Edge cases
  data['pow_2_53'] = Math.pow(2, 53);
  data['pow_2_neg53'] = Math.pow(2, -53);

  // Combined operations
  data['combined_1'] = Math.exp(Math.log(10)) - 10;
  data['combined_2'] = Math.sin(Math.PI / 2) - 1;
  data['combined_3'] = Math.pow(Math.E, Math.log(Math.PI));

  return data;
}

export async function collectMath(): Promise<ModuleResult<MathData>> {
  const data: MathData = {
    data: getMathFingerprint(),
  };

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
