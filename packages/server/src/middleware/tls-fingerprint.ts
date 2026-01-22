/**
 * TLS Fingerprinting Middleware
 * Generates JA4 fingerprint from TLS handshake data
 *
 * Note: Requires access to raw TLS socket, which means:
 * - Running behind a reverse proxy that passes TLS info (nginx, Cloudflare)
 * - Or running Node.js with custom TLS handling
 *
 * This middleware extracts TLS fingerprint from:
 * 1. Cloudflare headers (cf-ja4, cf-ja3)
 * 2. Nginx/custom proxy headers (x-ja4-fingerprint, x-ja3-fingerprint)
 * 3. Raw TLS socket (limited info in Node.js)
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * TLS fingerprint data structure
 */
export interface TLSFingerprint {
  ja4?: string;
  ja4Hash?: string;
  ja3?: string;
  ja3Hash?: string;
  tlsVersion?: string;
  cipherName?: string;
  source: 'cloudflare' | 'proxy' | 'socket' | 'none';
}

/**
 * Check if a value is a GREASE value
 * GREASE values: 0x0a0a, 0x1a1a, 0x2a2a, etc.
 */
function isGrease(value: number): boolean {
  return (value & 0x0f0f) === 0x0a0a;
}

/**
 * Generate JA4 fingerprint from TLS ClientHello components
 *
 * JA4 format: t(tls version)d(sni)i(cipher count)e(extension count)_(first hash)_(second hash)
 *
 * @param tlsVersion - TLS version string (e.g., 'TLSv1.2', 'TLSv1.3')
 * @param cipherSuites - Array of cipher suite codes
 * @param extensions - Array of extension codes
 * @param sni - Server Name Indication (hostname)
 * @param alpn - Application-Layer Protocol Negotiation value
 */
export function generateJA4(
  tlsVersion: string,
  cipherSuites: number[],
  extensions: number[],
  sni: string,
  alpn: string
): string {
  // Normalize TLS version
  const tlsMap: Record<string, string> = {
    'TLSv1.0': 't10',
    'TLSv1.1': 't11',
    'TLSv1.2': 't12',
    'TLSv1.3': 't13',
    'QUIC': 'q13',
  };
  const t = tlsMap[tlsVersion] || 't00';

  // SNI: d for domain present, i for IP/none
  const d = sni ? 'd' : 'i';

  // Cipher count (2 digits, capped at 99)
  const cipherCount = Math.min(cipherSuites.filter((c) => !isGrease(c)).length, 99);
  const i = String(cipherCount).padStart(2, '0');

  // Extension count (2 digits, capped at 99)
  const extensionCount = Math.min(extensions.filter((e) => !isGrease(e)).length, 99);
  const e = String(extensionCount).padStart(2, '0');

  // ALPN first letter (h=http, 0=none/other)
  let a = '0';
  if (alpn) {
    if (alpn.startsWith('h2')) a = 'h';
    else if (alpn.startsWith('http')) a = 'h';
    else a = alpn[0];
  }

  // First section: type + version + sni + cipher count + extension count + alpn
  const section1 = `${t}${d}${i}${e}${a}`;

  // Sorted cipher suites (excluding GREASE values)
  const sortedCiphers = cipherSuites
    .filter((c) => !isGrease(c))
    .sort((a, b) => a - b)
    .map((c) => c.toString(16).padStart(4, '0'))
    .join(',');

  // Sorted extensions (excluding GREASE and SNI=0)
  const sortedExtensions = extensions
    .filter((ext) => !isGrease(ext) && ext !== 0)
    .sort((a, b) => a - b)
    .map((ext) => ext.toString(16).padStart(4, '0'))
    .join(',');

  // Hash sections (12 chars each)
  const section2 = crypto
    .createHash('sha256')
    .update(sortedCiphers || 'none')
    .digest('hex')
    .substring(0, 12);

  const section3 = crypto
    .createHash('sha256')
    .update(sortedExtensions || 'none')
    .digest('hex')
    .substring(0, 12);

  return `${section1}_${section2}_${section3}`;
}

/**
 * Generate a hash from JA4 or JA3 fingerprint
 */
function hashFingerprint(fingerprint: string): string {
  return crypto.createHash('sha256').update(fingerprint).digest('hex');
}

/**
 * Extract TLS info from raw socket (limited in Node.js)
 */
function extractSocketTLS(socket: any): Partial<TLSFingerprint> | null {
  try {
    // Check if this is a TLS socket
    if (!socket || typeof socket.getCipher !== 'function') {
      return null;
    }

    const cipher = socket.getCipher?.();
    const protocol = socket.getProtocol?.();

    if (cipher && protocol) {
      return {
        tlsVersion: protocol,
        cipherName: cipher.name,
        source: 'socket',
      };
    }
  } catch {
    // TLS info not available
  }
  return null;
}

/**
 * HTTP header fingerprinting data
 */
export interface HTTPFingerprint {
  headerOrder: string[];
  acceptLanguage?: string;
  acceptEncoding?: string;
  connection?: string;
  secChUa?: string;
  secChUaPlatform?: string;
  secChUaMobile?: string;
  hash: string;
}

/**
 * Extract HTTP header fingerprint
 */
function extractHTTPFingerprint(req: Request): HTTPFingerprint {
  // Capture header order (significant for fingerprinting)
  const headerOrder = Object.keys(req.headers);

  // Extract key headers
  const acceptLanguage = req.headers['accept-language'] as string | undefined;
  const acceptEncoding = req.headers['accept-encoding'] as string | undefined;
  const connection = req.headers['connection'] as string | undefined;

  // Client Hints (Chrome/Chromium)
  const secChUa = req.headers['sec-ch-ua'] as string | undefined;
  const secChUaPlatform = req.headers['sec-ch-ua-platform'] as string | undefined;
  const secChUaMobile = req.headers['sec-ch-ua-mobile'] as string | undefined;

  // Create hash from header data
  const hashData = {
    headerOrder,
    acceptLanguage,
    acceptEncoding,
    connection,
    secChUa,
    secChUaPlatform,
    secChUaMobile,
  };

  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(hashData))
    .digest('hex');

  return {
    headerOrder,
    acceptLanguage,
    acceptEncoding,
    connection,
    secChUa,
    secChUaPlatform,
    secChUaMobile,
    hash,
  };
}

/**
 * TLS Fingerprint Middleware
 * Extracts TLS and HTTP fingerprint data and attaches to request
 */
export function tlsFingerprintMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  let tlsFingerprint: TLSFingerprint = { source: 'none' };

  // 1. Check for Cloudflare headers (highest quality)
  const cfJA4 = req.headers['cf-ja4'] as string | undefined;
  const cfJA3 = req.headers['cf-ja3'] as string | undefined;

  if (cfJA4) {
    tlsFingerprint = {
      ja4: cfJA4,
      ja4Hash: hashFingerprint(cfJA4),
      source: 'cloudflare',
    };
  } else if (cfJA3) {
    tlsFingerprint = {
      ja3: cfJA3,
      ja3Hash: hashFingerprint(cfJA3),
      source: 'cloudflare',
    };
  }

  // 2. Check for proxy-provided headers
  if (tlsFingerprint.source === 'none') {
    const proxyJA4 =
      (req.headers['x-ja4-fingerprint'] as string) ||
      (req.headers['x-ja4'] as string);
    const proxyJA3 =
      (req.headers['x-ja3-fingerprint'] as string) ||
      (req.headers['x-ja3'] as string);

    if (proxyJA4) {
      tlsFingerprint = {
        ja4: proxyJA4,
        ja4Hash: hashFingerprint(proxyJA4),
        source: 'proxy',
      };
    } else if (proxyJA3) {
      tlsFingerprint = {
        ja3: proxyJA3,
        ja3Hash: hashFingerprint(proxyJA3),
        source: 'proxy',
      };
    }
  }

  // 3. Try to extract from raw socket (limited info)
  if (tlsFingerprint.source === 'none') {
    const socketTLS = extractSocketTLS(req.socket);
    if (socketTLS) {
      tlsFingerprint = { ...socketTLS, source: 'socket' } as TLSFingerprint;
    }
  }

  // 4. Extract HTTP fingerprint (always available)
  const httpFingerprint = extractHTTPFingerprint(req);

  // Attach to request object
  (req as any).tlsFingerprint = tlsFingerprint;
  (req as any).httpFingerprint = httpFingerprint;

  next();
}

/**
 * Get TLS fingerprint from request
 */
export function getTLSFingerprint(req: Request): TLSFingerprint | undefined {
  return (req as any).tlsFingerprint;
}

/**
 * Get HTTP fingerprint from request
 */
export function getHTTPFingerprint(req: Request): HTTPFingerprint | undefined {
  return (req as any).httpFingerprint;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      tlsFingerprint?: TLSFingerprint;
      httpFingerprint?: HTTPFingerprint;
    }
  }
}
