'use client';

import { useState } from 'react';
import FingerprintDisplay from '@/components/FingerprintDisplay';

export default function Home() {
  const [isCollecting, setIsCollecting] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [visitorInfo, setVisitorInfo] = useState<{
    visitorId: string;
    matchType: string;
    confidence: number;
  } | null>(null);

  const collectFingerprint = async () => {
    setIsCollecting(true);
    setError(null);

    try {
      // Dynamically import to ensure client-side only
      const { Fingerprint } = await import('@anthropic/fingerprint-client');

      const fp = new Fingerprint({
        modules: 'all',
        debug: true,
      });

      const fingerprintResult = await fp.collect();
      setResult(fingerprintResult);

      // Try to identify with server if available
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/fingerprint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fingerprint: fingerprintResult.fingerprint,
            fuzzyHash: fingerprintResult.fuzzyHash,
            components: fingerprintResult.components,
            entropy: fingerprintResult.entropy,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setVisitorInfo(data);
        }
      } catch {
        // Server not available, that's fine - fingerprint still works locally
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to collect fingerprint');
    } finally {
      setIsCollecting(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Fingerprint Demo</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Browser fingerprinting library demonstration
          </p>
        </header>

        <div className="mb-8">
          <button
            onClick={collectFingerprint}
            disabled={isCollecting}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold
                       hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                       transition-colors"
          >
            {isCollecting ? 'Collecting...' : 'Collect Fingerprint'}
          </button>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {visitorInfo && (
          <div className="mb-8 p-4 bg-green-100 dark:bg-green-900 border border-green-400 rounded-lg">
            <h3 className="font-semibold mb-2">Visitor Identification</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Visitor ID:</span>
                <br />
                <code className="text-xs">{visitorInfo.visitorId}</code>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Match Type:</span>
                <br />
                <span className={`font-semibold ${
                  visitorInfo.matchType === 'exact' ? 'text-green-600' :
                  visitorInfo.matchType === 'fuzzy' ? 'text-yellow-600' :
                  'text-blue-600'
                }`}>
                  {visitorInfo.matchType}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Confidence:</span>
                <br />
                <span className="font-semibold">
                  {(visitorInfo.confidence * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {result && <FingerprintDisplay result={result} />}
      </div>
    </main>
  );
}
