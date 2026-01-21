'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Stats {
  totals: {
    visitors: number;
    fingerprints: number;
    sessions: number;
  };
  entropy: {
    average: number | null;
    min: number | null;
    max: number | null;
  };
  recent: {
    period: string;
    totalVisitors: number;
    uniqueVisitors: number;
    exactMatches: number;
    fuzzyMatches: number;
    newVisitors: number;
    matchRate: string;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('http://localhost:3001/api/stats');
        if (!response.ok) throw new Error('Failed to fetch stats');
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-gray-500">Loading statistics...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-4 rounded-lg">
            <p className="font-semibold">Server Connection Error</p>
            <p className="text-sm mt-1">
              Make sure the fingerprint server is running on port 3001.
            </p>
            <p className="text-sm mt-2">
              Run: <code className="bg-yellow-200 px-1 rounded">pnpm dev:server</code>
            </p>
          </div>
          <Link href="/" className="text-blue-600 hover:underline mt-4 inline-block">
            &larr; Back to Demo
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Fingerprint analytics and statistics
            </p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Back to Demo
          </Link>
        </header>

        {stats && (
          <div className="space-y-6">
            {/* Total Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Total Visitors
                </div>
                <div className="text-4xl font-bold text-blue-600">
                  {stats.totals.visitors.toLocaleString()}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Total Fingerprints
                </div>
                <div className="text-4xl font-bold text-green-600">
                  {stats.totals.fingerprints.toLocaleString()}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Total Sessions
                </div>
                <div className="text-4xl font-bold text-purple-600">
                  {stats.totals.sessions.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Entropy Stats */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">Entropy Statistics</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Average Entropy
                  </div>
                  <div className="text-2xl font-semibold">
                    {stats.entropy.average?.toFixed(1) || 'N/A'} bits
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Minimum
                  </div>
                  <div className="text-2xl font-semibold">
                    {stats.entropy.min?.toFixed(1) || 'N/A'} bits
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Maximum
                  </div>
                  <div className="text-2xl font-semibold">
                    {stats.entropy.max?.toFixed(1) || 'N/A'} bits
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">
                Recent Activity ({stats.recent.period})
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Total Visits
                  </div>
                  <div className="text-2xl font-semibold">
                    {stats.recent.totalVisitors}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    New Visitors
                  </div>
                  <div className="text-2xl font-semibold text-blue-600">
                    {stats.recent.newVisitors}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Exact Matches
                  </div>
                  <div className="text-2xl font-semibold text-green-600">
                    {stats.recent.exactMatches}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Fuzzy Matches
                  </div>
                  <div className="text-2xl font-semibold text-yellow-600">
                    {stats.recent.fuzzyMatches}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Match Rate
                  </div>
                  <div className="text-2xl font-semibold">
                    {stats.recent.matchRate}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
