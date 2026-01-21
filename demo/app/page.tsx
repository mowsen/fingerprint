'use client';

import { useState, useEffect, useRef } from 'react';
import FingerprintDisplay from '@/components/FingerprintDisplay';

export default function Home() {
  const [isCollecting, setIsCollecting] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [visitorInfo, setVisitorInfo] = useState<any>(null);
  const hasCollected = useRef(false);
  const isWarmedUp = useRef(false);

  // Warm-up on mount (before auto-collect)
  useEffect(() => {
    const warmUp = async () => {
      // Wait for fonts to load
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // Import and warm up fingerprint APIs
      const { Fingerprint } = await import('@anthropic/fingerprint-client');
      // Exclude domrect - it's unstable across page renders
      const stableModules = [
        'canvas', 'webgl', 'audio', 'navigator', 'screen', 'fonts', 'timezone',
        'math', 'intl', 'webrtc', 'svg', 'speech', 'css', 'cssmedia', 'media',
        'window', 'headless', 'lies', 'resistance', 'worker', 'errors'
      ] as const;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fp = new Fingerprint({ modules: stableModules as any, debug: false });

      // Two warm-up collections to fully stabilize browser APIs
      await fp.collect();
      await fp.collect();

      // Small delay for DOM to fully settle
      await new Promise(resolve => setTimeout(resolve, 100));

      isWarmedUp.current = true;

      // Now auto-collect
      if (!hasCollected.current) {
        hasCollected.current = true;
        collectFingerprint();
      }
    };

    warmUp();
  }, []);

  const collectFingerprint = async () => {
    setIsCollecting(true);
    setError(null);

    try {
      // Dynamically import to ensure client-side only
      const { Fingerprint } = await import('@anthropic/fingerprint-client');

      // Exclude domrect - it's unstable across page renders
      const stableModules = [
        'canvas', 'webgl', 'audio', 'navigator', 'screen', 'fonts', 'timezone',
        'math', 'intl', 'webrtc', 'svg', 'speech', 'css', 'cssmedia', 'media',
        'window', 'headless', 'lies', 'resistance', 'worker', 'errors'
      ] as const;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fp = new Fingerprint({
        modules: stableModules as any,
        debug: false,
      });

      // Real collection (warm-up already done in useEffect)
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

  // Show loading spinner while collecting
  if (isCollecting && !result) {
    return (
      <main className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">Calculating Fingerprint...</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Analyzing browser characteristics</p>
        </div>
      </main>
    );
  }

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
                       transition-colors flex items-center gap-2"
          >
            {isCollecting ? (
              <>
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                Collecting...
              </>
            ) : 'Collect Fingerprint'}
          </button>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {visitorInfo && (
          <div className={`mb-8 p-6 rounded-lg border-2 ${
            visitorInfo.isNewVisitor
              ? 'bg-blue-50 dark:bg-blue-950 border-blue-400'
              : 'bg-green-50 dark:bg-green-950 border-green-400'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                {visitorInfo.isNewVisitor ? (
                  <>
                    <span className="text-2xl">👋</span>
                    <span>New Visitor</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">🔄</span>
                    <span>Welcome Back!</span>
                  </>
                )}
              </h3>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                visitorInfo.matchType === 'exact'
                  ? 'bg-green-200 text-green-800'
                  : visitorInfo.matchType === 'fuzzy'
                  ? 'bg-yellow-200 text-yellow-800'
                  : 'bg-blue-200 text-blue-800'
              }`}>
                {visitorInfo.matchType.toUpperCase()} MATCH
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
                <div className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Visitor ID</div>
                <code className="text-xs font-mono break-all">{visitorInfo.visitorId?.slice(0, 8)}...</code>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
                <div className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Confidence</div>
                <div className="text-lg font-bold">{(visitorInfo.confidence * 100).toFixed(1)}%</div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
                <div className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Visit Count</div>
                <div className="text-lg font-bold">{visitorInfo.visitor?.visitCount || 1}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
                <div className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Browser</div>
                <div className="font-semibold">{visitorInfo.request?.browser || 'Unknown'}</div>
              </div>
            </div>

            {visitorInfo.visitor && !visitorInfo.isNewVisitor && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">First Seen:</span>
                    <div className="font-mono text-xs">
                      {new Date(visitorInfo.visitor.firstSeen).toLocaleString()}
                    </div>
                  </div>
                  {visitorInfo.visitor.lastVisit && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Last Visit:</span>
                      <div className="font-mono text-xs">
                        {new Date(visitorInfo.visitor.lastVisit).toLocaleString()}
                      </div>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">IP Address:</span>
                    <div className="font-mono text-xs">{visitorInfo.request?.ipAddress || 'Unknown'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Visit History Log */}
            {visitorInfo.recentVisits && visitorInfo.recentVisits.length > 1 && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <span>📋</span> Visit History
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 text-xs uppercase">
                        <th className="pb-2 pr-4">#</th>
                        <th className="pb-2 pr-4">Timestamp</th>
                        <th className="pb-2 pr-4">Browser</th>
                        <th className="pb-2">IP Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visitorInfo.recentVisits.map((visit: { timestamp: string; browser: string; ipAddress: string }, index: number) => (
                        <tr key={index} className={`border-t border-gray-100 dark:border-gray-700 ${index === 0 ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
                          <td className="py-2 pr-4 font-mono text-xs">
                            {index === 0 ? (
                              <span className="text-green-600 font-semibold">NOW</span>
                            ) : (
                              visitorInfo.recentVisits.length - index
                            )}
                          </td>
                          <td className="py-2 pr-4 font-mono text-xs">
                            {new Date(visit.timestamp).toLocaleString()}
                          </td>
                          <td className="py-2 pr-4">{visit.browser}</td>
                          <td className="py-2 font-mono text-xs">{visit.ipAddress}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {result && <FingerprintDisplay result={result} />}
      </div>
    </main>
  );
}
