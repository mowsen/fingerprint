import { prisma } from '../index';
import { Prisma } from '@prisma/client';

export interface MatchResult {
  matchType: 'exact' | 'stable' | 'gpu' | 'fuzzy-stable' | 'fuzzy' | 'new';
  confidence: number;
  visitorId: string;
  fingerprintId: string;
  isNewVisitor: boolean;
}

export interface FingerprintInput {
  fingerprint: string;
  fuzzyHash: string;
  stableHash?: string;
  gpuTimingHash?: string;
  components: Record<string, unknown>;
  entropy?: number;
  isFarbled?: boolean;
  ipAddress?: string;
  userAgent?: string;
  referer?: string;
}

/**
 * Calculate Hamming distance between two strings
 */
export function hammingDistance(s1: string, s2: string): number {
  if (s1.length !== s2.length) {
    throw new Error('Strings must be the same length');
  }

  let distance = 0;
  for (let i = 0; i < s1.length; i++) {
    if (s1[i] !== s2[i]) {
      distance++;
    }
  }
  return distance;
}

/**
 * Match an incoming fingerprint against the database
 * Uses multi-layer matching for cross-browser recognition
 */
export async function matchFingerprint(input: FingerprintInput): Promise<MatchResult> {
  const { fingerprint, fuzzyHash, stableHash, gpuTimingHash, components, entropy, isFarbled, ipAddress, userAgent, referer } = input;

  // 1. Try exact browserHash match (fast path)
  const exactMatch = await prisma.fingerprint.findFirst({
    where: { fingerprintHash: fingerprint },
    include: { visitor: true },
    orderBy: { createdAt: 'desc' },
  });

  if (exactMatch) {
    // Update session for existing visitor
    await createSession(exactMatch.visitorId, exactMatch.id, ipAddress, userAgent, referer);

    return {
      matchType: 'exact',
      confidence: 1.0,
      visitorId: exactMatch.visitorId,
      fingerprintId: exactMatch.id,
      isNewVisitor: false,
    };
  }

  // 2. Try exact stableHash match (CROSS-BROWSER MATCH!)
  if (stableHash) {
    const stableMatch = await prisma.fingerprint.findFirst({
      where: { stableHash },
      include: { visitor: true },
      orderBy: { createdAt: 'desc' },
    });

    if (stableMatch) {
      // Store new fingerprint for existing visitor (different browser)
      const newFingerprint = await prisma.fingerprint.create({
        data: {
          visitorId: stableMatch.visitorId,
          fingerprintHash: fingerprint,
          fuzzyHash,
          stableHash,
          gpuTimingHash,
          components: components as Prisma.InputJsonValue,
          entropy,
          confidence: 0.95,
          isFarbled: isFarbled || false,
        },
      });

      await createSession(stableMatch.visitorId, newFingerprint.id, ipAddress, userAgent, referer);

      return {
        matchType: 'stable',
        confidence: 0.95,
        visitorId: stableMatch.visitorId,
        fingerprintId: newFingerprint.id,
        isNewVisitor: false,
      };
    }
  }

  // 3. Try GPU timing hash match (DRAWNAPART)
  if (gpuTimingHash) {
    const gpuMatch = await prisma.fingerprint.findFirst({
      where: { gpuTimingHash },
      include: { visitor: true },
      orderBy: { createdAt: 'desc' },
    });

    if (gpuMatch) {
      // Store new fingerprint for existing visitor
      const newFingerprint = await prisma.fingerprint.create({
        data: {
          visitorId: gpuMatch.visitorId,
          fingerprintHash: fingerprint,
          fuzzyHash,
          stableHash,
          gpuTimingHash,
          components: components as Prisma.InputJsonValue,
          entropy,
          confidence: 0.92,
          isFarbled: isFarbled || false,
        },
      });

      await createSession(gpuMatch.visitorId, newFingerprint.id, ipAddress, userAgent, referer);

      return {
        matchType: 'gpu',
        confidence: 0.92,
        visitorId: gpuMatch.visitorId,
        fingerprintId: newFingerprint.id,
        isNewVisitor: false,
      };
    }
  }

  // 4. Try fuzzy stableHash match (lower threshold for hardware features)
  if (stableHash) {
    const stableCandidates = await prisma.fingerprint.findMany({
      where: { stableHash: { not: null } },
      select: { id: true, visitorId: true, stableHash: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    let bestStableMatch: { id: string; visitorId: string; distance: number } | null = null;
    const stableFuzzyThreshold = 4; // Stricter threshold for stable hash

    for (const candidate of stableCandidates) {
      if (candidate.stableHash) {
        try {
          const distance = hammingDistance(candidate.stableHash, stableHash);
          if (distance <= stableFuzzyThreshold) {
            if (!bestStableMatch || distance < bestStableMatch.distance) {
              bestStableMatch = {
                id: candidate.id,
                visitorId: candidate.visitorId,
                distance,
              };
            }
          }
        } catch {
          continue;
        }
      }
    }

    if (bestStableMatch) {
      const newFingerprint = await prisma.fingerprint.create({
        data: {
          visitorId: bestStableMatch.visitorId,
          fingerprintHash: fingerprint,
          fuzzyHash,
          stableHash,
          gpuTimingHash,
          components: components as Prisma.InputJsonValue,
          entropy,
          confidence: 1 - bestStableMatch.distance / 64,
          isFarbled: isFarbled || false,
        },
      });

      await createSession(bestStableMatch.visitorId, newFingerprint.id, ipAddress, userAgent, referer);

      return {
        matchType: 'fuzzy-stable',
        confidence: 1 - bestStableMatch.distance / 64,
        visitorId: bestStableMatch.visitorId,
        fingerprintId: newFingerprint.id,
        isNewVisitor: false,
      };
    }
  }

  // 5. Try fuzzy browserHash match (original behavior)
  const fuzzyThreshold = 8; // Allow up to 8 characters difference in 64-char hash
  const candidates = await prisma.fingerprint.findMany({
    select: {
      id: true,
      visitorId: true,
      fuzzyHash: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 1000, // Limit for performance
  });

  let bestMatch: { id: string; visitorId: string; distance: number } | null = null;

  for (const candidate of candidates) {
    try {
      const distance = hammingDistance(candidate.fuzzyHash, fuzzyHash);
      if (distance <= fuzzyThreshold) {
        if (!bestMatch || distance < bestMatch.distance) {
          bestMatch = {
            id: candidate.id,
            visitorId: candidate.visitorId,
            distance,
          };
        }
      }
    } catch {
      // Skip if hash lengths don't match
      continue;
    }
  }

  if (bestMatch) {
    // Store new fingerprint for existing visitor
    const newFingerprint = await prisma.fingerprint.create({
      data: {
        visitorId: bestMatch.visitorId,
        fingerprintHash: fingerprint,
        fuzzyHash,
        stableHash,
        gpuTimingHash,
        components: components as Prisma.InputJsonValue,
        entropy,
        confidence: 1 - bestMatch.distance / 64,
        isFarbled: isFarbled || false,
      },
    });

    // Create session
    await createSession(bestMatch.visitorId, newFingerprint.id, ipAddress, userAgent, referer);

    return {
      matchType: 'fuzzy',
      confidence: 1 - bestMatch.distance / 64,
      visitorId: bestMatch.visitorId,
      fingerprintId: newFingerprint.id,
      isNewVisitor: false,
    };
  }

  // 6. Create new visitor
  const newVisitor = await prisma.visitor.create({
    data: {
      fingerprints: {
        create: {
          fingerprintHash: fingerprint,
          fuzzyHash,
          stableHash,
          gpuTimingHash,
          components: components as Prisma.InputJsonValue,
          entropy,
          confidence: 1.0,
          isFarbled: isFarbled || false,
        },
      },
    },
    include: {
      fingerprints: true,
    },
  }) as { id: string; fingerprints: { id: string }[] };

  const newFingerprintId = newVisitor.fingerprints[0].id;

  // Create session
  await createSession(newVisitor.id, newFingerprintId, ipAddress, userAgent, referer);

  return {
    matchType: 'new',
    confidence: 1.0,
    visitorId: newVisitor.id,
    fingerprintId: newFingerprintId,
    isNewVisitor: true,
  };
}

/**
 * Create or update a session
 */
async function createSession(
  visitorId: string,
  fingerprintId: string,
  ipAddress?: string,
  userAgent?: string,
  referer?: string
): Promise<void> {
  await prisma.session.create({
    data: {
      visitorId,
      fingerprintId,
      ipAddress,
      userAgent,
      referer,
    },
  });
}

/**
 * Update daily statistics
 */
export async function updateStats(matchType: MatchResult['matchType'], entropy?: number): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.stats.upsert({
    where: { date: today },
    create: {
      date: today,
      totalVisitors: 1,
      uniqueVisitors: matchType === 'new' ? 1 : 0,
      totalFingerprints: 1,
      exactMatches: matchType === 'exact' ? 1 : 0,
      stableMatches: matchType === 'stable' ? 1 : 0,
      gpuMatches: matchType === 'gpu' ? 1 : 0,
      fuzzyStableMatches: matchType === 'fuzzy-stable' ? 1 : 0,
      fuzzyMatches: matchType === 'fuzzy' ? 1 : 0,
      newVisitors: matchType === 'new' ? 1 : 0,
      avgEntropy: entropy,
    },
    update: {
      totalVisitors: { increment: 1 },
      uniqueVisitors: matchType === 'new' ? { increment: 1 } : undefined,
      totalFingerprints: { increment: 1 },
      exactMatches: matchType === 'exact' ? { increment: 1 } : undefined,
      stableMatches: matchType === 'stable' ? { increment: 1 } : undefined,
      gpuMatches: matchType === 'gpu' ? { increment: 1 } : undefined,
      fuzzyStableMatches: matchType === 'fuzzy-stable' ? { increment: 1 } : undefined,
      fuzzyMatches: matchType === 'fuzzy' ? { increment: 1 } : undefined,
      newVisitors: matchType === 'new' ? { increment: 1 } : undefined,
      // Note: proper avgEntropy calculation would require storing sum and count
    },
  });
}
