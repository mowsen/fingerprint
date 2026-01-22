/**
 * Identity Service
 * Handles signing and verification of persistent visitor IDs
 *
 * The signature ensures that visitor IDs cannot be forged by clients.
 * Uses HMAC-SHA256 with a server-side secret.
 */

import crypto from 'crypto';

/**
 * Secret key for signing visitor IDs
 * In production, this should be set via environment variable
 */
const IDENTITY_SECRET = process.env.IDENTITY_SECRET || 'fingerprint-identity-secret-change-in-production';

/**
 * Signature length (characters from hex digest)
 */
const SIGNATURE_LENGTH = 16;

/**
 * Generate a cryptographically secure visitor ID
 */
export function generateVisitorId(): string {
  return crypto.randomUUID();
}

/**
 * Sign a visitor ID using HMAC-SHA256
 *
 * @param visitorId - The visitor ID to sign
 * @returns 16-character hex signature
 */
export function signVisitorId(visitorId: string): string {
  return crypto
    .createHmac('sha256', IDENTITY_SECRET)
    .update(visitorId)
    .digest('hex')
    .substring(0, SIGNATURE_LENGTH);
}

/**
 * Verify a visitor ID signature
 * Uses constant-time comparison to prevent timing attacks
 *
 * @param visitorId - The visitor ID to verify
 * @param signature - The signature to check
 * @returns true if the signature is valid
 */
export function verifyVisitorId(visitorId: string, signature: string): boolean {
  if (!visitorId || !signature || signature.length !== SIGNATURE_LENGTH) {
    return false;
  }

  const expected = signVisitorId(visitorId);

  // Use constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Parse a signed visitor ID string
 * Format: visitorId.signature.timestamp
 *
 * @param signedId - The signed ID string
 * @returns Parsed components or null if invalid
 */
export function parseSignedVisitorId(
  signedId: string
): { visitorId: string; signature: string; createdAt: number; valid: boolean } | null {
  if (!signedId || typeof signedId !== 'string') {
    return null;
  }

  const parts = signedId.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [visitorId, signature, timestampStr] = parts;
  const createdAt = parseInt(timestampStr, 10);

  if (!visitorId || !signature || isNaN(createdAt)) {
    return null;
  }

  const valid = verifyVisitorId(visitorId, signature);

  return {
    visitorId,
    signature,
    createdAt,
    valid,
  };
}

/**
 * Create a signed visitor ID string
 *
 * @param visitorId - The visitor ID
 * @returns Signed ID string in format: visitorId.signature.timestamp
 */
export function createSignedVisitorId(visitorId: string): string {
  const signature = signVisitorId(visitorId);
  const timestamp = Date.now();
  return `${visitorId}.${signature}.${timestamp}`;
}

/**
 * Validate and optionally refresh a persistent identity
 *
 * @param signedId - The signed ID from the client
 * @param maxAge - Maximum age in milliseconds (default: 1 year)
 * @returns Object with validation result and refreshed ID if needed
 */
export function validatePersistentIdentity(
  signedId: string | null | undefined,
  maxAge: number = 365 * 24 * 60 * 60 * 1000
): {
  valid: boolean;
  visitorId: string | null;
  needsRefresh: boolean;
  refreshedId: string | null;
} {
  if (!signedId) {
    return {
      valid: false,
      visitorId: null,
      needsRefresh: false,
      refreshedId: null,
    };
  }

  const parsed = parseSignedVisitorId(signedId);

  if (!parsed || !parsed.valid) {
    return {
      valid: false,
      visitorId: null,
      needsRefresh: false,
      refreshedId: null,
    };
  }

  // Check if the ID is expired
  const age = Date.now() - parsed.createdAt;
  const isExpired = age > maxAge;

  // Check if we should refresh (older than half the max age)
  const needsRefresh = age > maxAge / 2;

  return {
    valid: true,
    visitorId: parsed.visitorId,
    needsRefresh: needsRefresh || isExpired,
    refreshedId: needsRefresh ? createSignedVisitorId(parsed.visitorId) : null,
  };
}

/**
 * Link a fingerprint to a persistent visitor ID
 * Returns the visitor ID to use (either from persistent ID or new)
 *
 * @param persistentId - Signed persistent ID from client (if any)
 * @param fingerprintVisitorId - Visitor ID from fingerprint matching
 * @returns The visitor ID to use and whether to update persistent ID
 */
export function linkPersistentIdentity(
  persistentId: string | null | undefined,
  fingerprintVisitorId: string
): {
  visitorId: string;
  persistentIdValid: boolean;
  shouldUpdatePersistent: boolean;
  newPersistentId: string | null;
} {
  // Validate the persistent ID
  const validation = validatePersistentIdentity(persistentId);

  if (validation.valid && validation.visitorId) {
    // Persistent ID is valid - use it
    return {
      visitorId: validation.visitorId,
      persistentIdValid: true,
      shouldUpdatePersistent: validation.needsRefresh,
      newPersistentId: validation.refreshedId,
    };
  }

  // No valid persistent ID - use fingerprint-matched visitor ID
  // and create a new persistent ID for the client
  return {
    visitorId: fingerprintVisitorId,
    persistentIdValid: false,
    shouldUpdatePersistent: true,
    newPersistentId: createSignedVisitorId(fingerprintVisitorId),
  };
}
