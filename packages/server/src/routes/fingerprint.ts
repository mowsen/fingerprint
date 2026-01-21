import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import { z } from 'zod';
import { matchFingerprint, updateStats } from '../services/matching';

export const fingerprintRouter: RouterType = Router();

// Simple browser parser from user agent
function parseBrowser(userAgent?: string): string {
  if (!userAgent) return 'Unknown';

  if (userAgent.includes('Brave')) return 'Brave';
  if (userAgent.includes('Edg/')) return 'Edge';
  if (userAgent.includes('OPR/') || userAgent.includes('Opera')) return 'Opera';
  if (userAgent.includes('Firefox/')) return 'Firefox';
  if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) return 'Safari';
  if (userAgent.includes('Chrome/')) return 'Chrome';

  return 'Unknown';
}

// Validation schema for fingerprint submission
const fingerprintSchema = z.object({
  fingerprint: z.string().length(64),
  fuzzyHash: z.string().length(64),
  components: z.record(z.unknown()),
  entropy: z.number().optional(),
  timestamp: z.number().optional(),
});

/**
 * POST /api/fingerprint
 * Submit a fingerprint for matching and storage
 */
fingerprintRouter.post('/', async (req: Request, res: Response) => {
  try {
    // Validate input
    const parsed = fingerprintSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid fingerprint data',
        details: parsed.error.errors,
      });
    }

    const { fingerprint, fuzzyHash, components, entropy } = parsed.data;

    // Get client info from request
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      undefined;
    const userAgent = req.headers['user-agent'] || undefined;
    const referer = req.headers['referer'] || undefined;

    // Match fingerprint
    const result = await matchFingerprint({
      fingerprint,
      fuzzyHash,
      components,
      entropy,
      ipAddress,
      userAgent,
      referer,
    });

    // Update statistics asynchronously
    updateStats(result.matchType, entropy).catch(console.error);

    // Get visitor history for repeat visitor info
    const prisma = (await import('../index')).prisma;
    const visitorData = await prisma.visitor.findUnique({
      where: { id: result.visitorId },
      include: {
        sessions: {
          orderBy: { firstSeen: 'desc' },
          take: 10,
        },
        fingerprints: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    const sessionCount = visitorData?.sessions.length || 1;
    const firstSeen = visitorData?.createdAt || new Date();

    // Return result with visitor history
    return res.json({
      visitorId: result.visitorId,
      confidence: result.confidence,
      matchType: result.matchType,
      requestId: result.fingerprintId,
      isNewVisitor: result.isNewVisitor,
      // Visitor info
      visitor: {
        firstSeen: firstSeen.toISOString(),
        visitCount: sessionCount,
        lastVisit: visitorData?.sessions[1]?.firstSeen?.toISOString() || null,
      },
      // Current request info
      request: {
        timestamp: new Date().toISOString(),
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        browser: parseBrowser(userAgent),
      },
    });
  } catch (error) {
    console.error('Error processing fingerprint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/fingerprint/:id
 * Get fingerprint details by ID
 */
fingerprintRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const fingerprint = await (await import('../index')).prisma.fingerprint.findUnique({
      where: { id },
      include: {
        visitor: {
          select: {
            id: true,
            createdAt: true,
          },
        },
        sessions: {
          select: {
            id: true,
            firstSeen: true,
            lastSeen: true,
            ipAddress: true,
          },
          orderBy: { firstSeen: 'desc' },
          take: 10,
        },
      },
    });

    if (!fingerprint) {
      return res.status(404).json({ error: 'Fingerprint not found' });
    }

    return res.json(fingerprint);
  } catch (error) {
    console.error('Error fetching fingerprint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
