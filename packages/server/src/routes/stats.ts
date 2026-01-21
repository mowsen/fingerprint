import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';

export const statsRouter: RouterType = Router();

interface StatRecord {
  totalVisitors: number;
  uniqueVisitors: number;
  exactMatches: number;
  fuzzyMatches: number;
  newVisitors: number;
}

interface HashCount {
  fingerprintHash: string;
  _count: number;
}

/**
 * GET /api/stats
 * Get overall statistics
 */
statsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const prisma = (await import('../index')).prisma;

    // Get aggregate counts
    const [visitorCount, fingerprintCount, sessionCount] = await Promise.all([
      prisma.visitor.count(),
      prisma.fingerprint.count(),
      prisma.session.count(),
    ]);

    // Get entropy statistics
    const entropyStats = await prisma.fingerprint.aggregate({
      _avg: { entropy: true },
      _min: { entropy: true },
      _max: { entropy: true },
    });

    // Get recent stats (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentStats = await prisma.stats.findMany({
      where: {
        date: { gte: sevenDaysAgo },
      },
      orderBy: { date: 'desc' },
    });

    // Calculate totals from recent stats
    const initialTotals: StatRecord = {
      totalVisitors: 0,
      uniqueVisitors: 0,
      exactMatches: 0,
      fuzzyMatches: 0,
      newVisitors: 0,
    };
    const recentTotals = recentStats.reduce(
      (acc: StatRecord, stat: StatRecord) => ({
        totalVisitors: acc.totalVisitors + stat.totalVisitors,
        uniqueVisitors: acc.uniqueVisitors + stat.uniqueVisitors,
        exactMatches: acc.exactMatches + stat.exactMatches,
        fuzzyMatches: acc.fuzzyMatches + stat.fuzzyMatches,
        newVisitors: acc.newVisitors + stat.newVisitors,
      }),
      initialTotals
    );

    return res.json({
      totals: {
        visitors: visitorCount,
        fingerprints: fingerprintCount,
        sessions: sessionCount,
      },
      entropy: {
        average: entropyStats._avg.entropy,
        min: entropyStats._min.entropy,
        max: entropyStats._max.entropy,
      },
      recent: {
        period: '7 days',
        ...recentTotals,
        matchRate: recentTotals.totalVisitors > 0
          ? ((recentTotals.exactMatches + recentTotals.fuzzyMatches) / recentTotals.totalVisitors * 100).toFixed(2) + '%'
          : '0%',
      },
      dailyStats: recentStats,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/stats/uniqueness
 * Get fingerprint uniqueness statistics
 */
statsRouter.get('/uniqueness', async (_req: Request, res: Response) => {
  try {
    const prisma = (await import('../index')).prisma;

    // Get fingerprint hash distribution
    const hashCounts = await prisma.fingerprint.groupBy({
      by: ['fingerprintHash'],
      _count: true,
      orderBy: { _count: { fingerprintHash: 'desc' } },
      take: 100,
    });

    // Calculate uniqueness metrics
    const totalFingerprints = await prisma.fingerprint.count();
    const uniqueHashes = hashCounts.length;
    const duplicateHashes = hashCounts.filter((h: HashCount) => h._count > 1).length;

    // Entropy distribution
    const entropyBuckets = await prisma.$queryRaw`
      SELECT
        FLOOR(entropy / 5) * 5 as bucket,
        COUNT(*) as count
      FROM fingerprints
      WHERE entropy IS NOT NULL
      GROUP BY FLOOR(entropy / 5) * 5
      ORDER BY bucket
    `;

    return res.json({
      uniqueness: {
        totalFingerprints,
        uniqueHashes,
        duplicateHashes,
        uniquenessRate: totalFingerprints > 0
          ? ((uniqueHashes / totalFingerprints) * 100).toFixed(2) + '%'
          : '0%',
      },
      topDuplicates: hashCounts.slice(0, 10).map((h: HashCount) => ({
        hash: h.fingerprintHash.slice(0, 16) + '...',
        count: h._count,
      })),
      entropyDistribution: entropyBuckets,
    });
  } catch (error) {
    console.error('Error fetching uniqueness stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/stats/daily
 * Get daily statistics for a date range
 */
statsRouter.get('/daily', async (req: Request, res: Response) => {
  try {
    const { days = '30' } = req.query;
    const prisma = (await import('../index')).prisma;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    const stats = await prisma.stats.findMany({
      where: {
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    return res.json({
      period: `${days} days`,
      stats,
    });
  } catch (error) {
    console.error('Error fetching daily stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
