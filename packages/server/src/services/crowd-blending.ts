/**
 * Crowd-Blending Score Service
 * Inspired by CreepJS backend approach
 *
 * Trust increases with:
 * - 3+ visits (temporal validation)
 * - 2+ different IPs (cross-IP validation)
 * - Visits spread over multiple days (7-day window)
 *
 * This helps distinguish real returning users from spoofed fingerprints
 */

import { PrismaClient } from '@prisma/client';

// Lazy import to avoid circular dependency
let prismaInstance: PrismaClient | null = null;

async function getPrisma(): Promise<PrismaClient> {
  if (!prismaInstance) {
    const { prisma } = await import('../index');
    prismaInstance = prisma;
  }
  return prismaInstance;
}

export interface CrowdBlendingResult {
  score: number; // 0-1, higher = more trusted
  uniqueIPs: number;
  visitCount: number;
  daySpan: number;
  isTrusted: boolean;
  trustLevel: 'new' | 'returning' | 'trusted' | 'verified';
}

/**
 * Calculate crowd-blending score for a visitor
 * Based on visit history over the last 7 days
 */
export async function calculateCrowdBlendingScore(
  visitorId: string
): Promise<CrowdBlendingResult> {
  const prisma = await getPrisma();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Get all sessions for this visitor in the last 7 days
  const sessions = await prisma.session.findMany({
    where: {
      visitorId,
      firstSeen: { gte: sevenDaysAgo },
    },
    select: {
      ipAddress: true,
      firstSeen: true,
    },
    orderBy: {
      firstSeen: 'asc',
    },
  });

  // Handle new visitor (no sessions)
  if (sessions.length === 0) {
    return {
      score: 0,
      uniqueIPs: 0,
      visitCount: 0,
      daySpan: 0,
      isTrusted: false,
      trustLevel: 'new',
    };
  }

  // Count unique IPs (filter out null/undefined)
  const uniqueIPs = new Set(
    sessions
      .map((s) => s.ipAddress)
      .filter((ip): ip is string => ip !== null && ip !== undefined)
  ).size;

  // Calculate day span (first to last visit)
  const timestamps = sessions.map((s) => s.firstSeen.getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const daySpan = Math.ceil((maxTime - minTime) / (24 * 60 * 60 * 1000));

  const visitCount = sessions.length;

  // Calculate score based on CreepJS-inspired criteria
  let score = 0;

  // Visit count factor (0-0.4)
  // More visits = higher confidence this is a real user
  if (visitCount >= 10) {
    score += 0.4;
  } else if (visitCount >= 5) {
    score += 0.3;
  } else if (visitCount >= 3) {
    score += 0.2;
  } else if (visitCount >= 2) {
    score += 0.1;
  }

  // IP diversity factor (0-0.4)
  // Multiple IPs from different locations = more confident identification
  // (Same fingerprint from different networks is hard to spoof)
  if (uniqueIPs >= 3) {
    score += 0.4;
  } else if (uniqueIPs >= 2) {
    score += 0.3;
  } else if (uniqueIPs === 1 && visitCount >= 3) {
    // Single IP but consistent visits still adds some trust
    score += 0.1;
  }

  // Time span factor (0-0.2)
  // Visits over multiple days = more confident (harder to spoof over time)
  if (daySpan >= 5) {
    score += 0.2;
  } else if (daySpan >= 3) {
    score += 0.15;
  } else if (daySpan >= 1) {
    score += 0.1;
  }

  // Determine trust level based on criteria
  const isTrusted = visitCount >= 3 && uniqueIPs >= 2;

  let trustLevel: CrowdBlendingResult['trustLevel'];
  if (score >= 0.7) {
    trustLevel = 'verified';
  } else if (isTrusted) {
    trustLevel = 'trusted';
  } else if (visitCount >= 2) {
    trustLevel = 'returning';
  } else {
    trustLevel = 'new';
  }

  return {
    score: Math.round(score * 100) / 100, // Round to 2 decimal places
    uniqueIPs,
    visitCount,
    daySpan,
    isTrusted,
    trustLevel,
  };
}

/**
 * Get crowd-blending scores for multiple visitors
 * Useful for batch processing
 */
export async function getCrowdBlendingScores(
  visitorIds: string[]
): Promise<Map<string, CrowdBlendingResult>> {
  const results = new Map<string, CrowdBlendingResult>();

  // Process in parallel for efficiency
  const scores = await Promise.all(
    visitorIds.map(async (id) => ({
      id,
      score: await calculateCrowdBlendingScore(id),
    }))
  );

  for (const { id, score } of scores) {
    results.set(id, score);
  }

  return results;
}

/**
 * Check if a visitor should be trusted for a specific match type
 * Different match types may require different trust thresholds
 */
export function shouldTrustMatch(
  crowdBlending: CrowdBlendingResult,
  matchType: 'exact' | 'stable' | 'gpu' | 'fuzzy-stable' | 'fuzzy' | 'new'
): boolean {
  if (matchType === 'new') {
    return true; // New visitors are always "trusted" (first visit)
  }
  switch (matchType) {
    case 'exact':
      // Exact matches are always trusted
      return true;

    case 'stable':
      // Stable hash matches are hardware-based and very reliable
      // Trust them as long as we have some visit history OR it's first visit
      // Only distrust if we have strong evidence of spoofing (many visits, still no IP diversity)
      return true; // Stable matches are inherently trustworthy

    case 'gpu':
      // GPU timing matches are hardware-based, very reliable
      return true; // GPU matches are inherently trustworthy

    case 'fuzzy-stable':
      // Fuzzy stable matches are still hardware-based
      return true; // Trust hardware-based matches

    case 'fuzzy':
      // Fuzzy matches are browser-specific, still fairly reliable
      // Only apply crowd-blending penalty for extremely suspicious patterns
      return crowdBlending.visitCount <= 5 || crowdBlending.score >= 0.2;

    default:
      return true;
  }
}

/**
 * Calculate confidence boost based on crowd-blending score
 * Used to adjust match confidence based on visitor history
 */
export function getConfidenceBoost(
  crowdBlending: CrowdBlendingResult,
  matchType: 'exact' | 'stable' | 'gpu' | 'fuzzy-stable' | 'fuzzy' | 'new'
): number {
  const baseBoost = crowdBlending.score;

  switch (matchType) {
    case 'new':
      // No boost for new visitors (first visit)
      return 0;

    case 'exact':
      // Small boost for exact matches (already high confidence)
      return baseBoost * 0.05;

    case 'stable':
      // Moderate boost for stable matches
      return baseBoost * 0.10;

    case 'gpu':
      // Moderate boost for GPU matches
      return baseBoost * 0.08;

    case 'fuzzy-stable':
      // Higher boost for fuzzy-stable (benefits more from validation)
      return baseBoost * 0.15;

    case 'fuzzy':
      // Highest boost for fuzzy matches (need most validation)
      return baseBoost * 0.20;

    default:
      return 0;
  }
}
