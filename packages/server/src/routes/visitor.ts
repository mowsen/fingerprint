import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';

export const visitorRouter: RouterType = Router();

/**
 * GET /api/visitor/:id
 * Get visitor details and history
 */
visitorRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const visitor = await (await import('../index')).prisma.visitor.findUnique({
      where: { id },
      include: {
        fingerprints: {
          select: {
            id: true,
            fingerprintHash: true,
            fuzzyHash: true,
            entropy: true,
            confidence: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        sessions: {
          select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            firstSeen: true,
            lastSeen: true,
          },
          orderBy: { firstSeen: 'desc' },
          take: 50,
        },
      },
    });

    if (!visitor) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    return res.json({
      id: visitor.id,
      createdAt: visitor.createdAt,
      updatedAt: visitor.updatedAt,
      fingerprints: visitor.fingerprints,
      sessions: visitor.sessions,
      stats: {
        totalFingerprints: visitor.fingerprints.length,
        totalSessions: visitor.sessions.length,
        firstSeen: visitor.createdAt,
        lastSeen: visitor.sessions[0]?.lastSeen || visitor.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching visitor:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/visitor/:id/fingerprints
 * Get all fingerprints for a visitor
 */
visitorRouter.get('/:id/fingerprints', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page = '1', limit = '20' } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [fingerprints, total] = await Promise.all([
      (await import('../index')).prisma.fingerprint.findMany({
        where: { visitorId: id },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      (await import('../index')).prisma.fingerprint.count({
        where: { visitorId: id },
      }),
    ]);

    return res.json({
      fingerprints,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('Error fetching fingerprints:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/visitor/:id/sessions
 * Get all sessions for a visitor
 */
visitorRouter.get('/:id/sessions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page = '1', limit = '20' } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [sessions, total] = await Promise.all([
      (await import('../index')).prisma.session.findMany({
        where: { visitorId: id },
        orderBy: { firstSeen: 'desc' },
        skip,
        take,
      }),
      (await import('../index')).prisma.session.count({
        where: { visitorId: id },
      }),
    ]);

    return res.json({
      sessions,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/visitor/:id
 * Delete a visitor and all associated data
 */
visitorRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await (await import('../index')).prisma.visitor.delete({
      where: { id },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting visitor:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
