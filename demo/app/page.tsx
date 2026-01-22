'use client';

import { useState, useEffect, useRef } from 'react';
import FingerprintDisplay from '@/components/FingerprintDisplay';

// Identification method descriptions
const MATCH_TYPE_INFO: Record<string, { name: string; description: string; icon: string; color: string }> = {
  exact: {
    name: 'Exact Fingerprint Match',
    description: 'Your browser fingerprint exactly matches a previous visit. This includes canvas rendering, WebGL, audio processing, and other browser characteristics.',
    icon: '🎯',
    color: 'green',
  },
  stable: {
    name: 'Cross-Browser (Stable Hash)',
    description: 'Identified via hardware-based features that remain constant across different browsers: GPU info, audio hardware, screen properties, and system fonts.',
    icon: '🔗',
    color: 'purple',
  },
  gpu: {
    name: 'GPU Timing (DRAWNAPART)',
    description: 'Identified via unique GPU execution timing patterns. This technique can identify specific GPU hardware even across browsers and incognito mode.',
    icon: '🖥️',
    color: 'indigo',
  },
  'fuzzy-stable': {
    name: 'Fuzzy Hardware Match',
    description: 'Your hardware fingerprint is very similar to a previous visit (within 4 character difference). Minor changes detected but core hardware signature matches.',
    icon: '🔍',
    color: 'teal',
  },
  fuzzy: {
    name: 'Fuzzy Fingerprint Match',
    description: 'Your fingerprint is similar to a previous visit (within 8 character difference). Some browser settings may have changed but overall profile matches.',
    icon: '≈',
    color: 'yellow',
  },
  persistent: {
    name: 'Persistent Identity (Cookie/Storage)',
    description: 'Identified via stored visitor ID in cookies or localStorage. This is the easiest method to evade - just clear your browser data!',
    icon: '🍪',
    color: 'orange',
  },
  new: {
    name: 'New Visitor',
    description: 'No matching fingerprint found. This is your first visit or your fingerprint has changed significantly.',
    icon: '✨',
    color: 'blue',
  },
};

// Signal contribution to identification
const SIGNAL_CONTRIBUTIONS = [
  { name: 'Canvas Rendering', key: 'canvas', entropy: 12.5, description: 'How your browser renders 2D graphics' },
  { name: 'WebGL/GPU Info', key: 'webgl', entropy: 15.0, description: 'Graphics card and WebGL implementation details' },
  { name: 'Audio Processing', key: 'audio', entropy: 8.5, description: 'How your browser processes audio signals' },
  { name: 'Font Metrics', key: 'fontMetrics', entropy: 8.5, description: 'Precise glyph dimensions and font rendering' },
  { name: 'GPU Timing', key: 'gpuTiming', entropy: 8.0, description: 'Unique timing patterns of your GPU' },
  { name: 'System Fonts', key: 'fonts', entropy: 10.0, description: 'Installed fonts on your system' },
  { name: 'Navigator/Browser', key: 'navigator', entropy: 6.0, description: 'Browser and system information' },
  { name: 'Screen Properties', key: 'screen', entropy: 4.5, description: 'Display resolution and color depth' },
  { name: 'Worker Scope', key: 'worker', entropy: 5.0, description: 'Web Worker environment properties' },
  { name: 'SVG Rendering', key: 'svg', entropy: 5.5, description: 'How your browser renders SVG graphics' },
  { name: 'Math Operations', key: 'math', entropy: 4.0, description: 'Floating point math implementation' },
  { name: 'Timezone/Intl', key: 'timezone', entropy: 3.0, description: 'Timezone and locale settings' },
];

export default function Home() {
  const [isCollecting, setIsCollecting] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
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
      // Stable modules - excluding domrect (unstable) and behavior (requires interaction time)
      const stableModules = [
        'canvas', 'webgl', 'audio', 'navigator', 'screen', 'fonts', 'fontMetrics', 'timezone',
        'math', 'intl', 'webrtc', 'svg', 'speech', 'css', 'cssmedia', 'media',
        'window', 'headless', 'lies', 'resistance', 'worker', 'errors', 'gpuTiming'
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
      const { Fingerprint, getPersistentIdentity, setPersistentIdentity } = await import('@anthropic/fingerprint-client');

      // Stable modules - excluding domrect (unstable) and behavior (requires interaction time)
      const stableModules = [
        'canvas', 'webgl', 'audio', 'navigator', 'screen', 'fonts', 'fontMetrics', 'timezone',
        'math', 'intl', 'webrtc', 'svg', 'speech', 'css', 'cssmedia', 'media',
        'window', 'headless', 'lies', 'resistance', 'worker', 'errors', 'gpuTiming'
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
        // Detect browser from client-side (more accurate than user-agent parsing)
        const { LIKE_BRAVE, isBraveBrowser, IS_GECKO, IS_WEBKIT } = await import('@anthropic/fingerprint-client');
        let detectedBrowser = 'Chrome';
        if (LIKE_BRAVE || isBraveBrowser()) {
          detectedBrowser = 'Brave';
        } else if (IS_GECKO) {
          detectedBrowser = 'Firefox';
        } else if (IS_WEBKIT) {
          detectedBrowser = 'Safari';
        }

        // Get persistent identity if available
        const persistentIdentity = await getPersistentIdentity();
        const persistentId = persistentIdentity
          ? `${persistentIdentity.visitorId}.${persistentIdentity.signature}.${persistentIdentity.createdAt}`
          : undefined;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/fingerprint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fingerprint: fingerprintResult.fingerprint,
            fuzzyHash: fingerprintResult.fuzzyHash,
            stableHash: fingerprintResult.stableHash,
            gpuTimingHash: fingerprintResult.gpuTimingHash,
            components: fingerprintResult.components,
            entropy: fingerprintResult.entropy,
            detectedBrowser,
            persistentId,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setVisitorInfo(data);

          // Update persistent identity if server says to
          if (data.persistentIdentity?.shouldUpdate && data.persistentIdentity?.signature) {
            await setPersistentIdentity(data.visitorId, data.persistentIdentity.signature);
          }
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

  const flushAllVisitors = async () => {
    if (!confirm('Are you sure you want to delete ALL visitors from the server? This cannot be undone.')) {
      return;
    }

    setIsFlushing(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/fingerprint/flush`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Flushed: ${data.deleted.visitors} visitors, ${data.deleted.fingerprints} fingerprints, ${data.deleted.sessions} sessions`);
        // Reset state
        setVisitorInfo(null);
        setResult(null);
        hasCollected.current = false;
      } else {
        setError('Failed to flush visitors');
      }
    } catch {
      setError('Server not available');
    } finally {
      setIsFlushing(false);
    }
  };

  const clearBrowserData = async () => {
    setIsClearing(true);
    setError(null);

    try {
      // Clear cookies
      document.cookie.split(';').forEach(cookie => {
        const name = cookie.split('=')[0].trim();
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      });

      // Clear localStorage
      try {
        localStorage.clear();
      } catch {
        // localStorage might be blocked
      }

      // Clear sessionStorage
      try {
        sessionStorage.clear();
      } catch {
        // sessionStorage might be blocked
      }

      // Clear IndexedDB
      try {
        const databases = await indexedDB.databases();
        for (const db of databases) {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
          }
        }
      } catch {
        // IndexedDB might not support databases() or be blocked
        try {
          indexedDB.deleteDatabase('fingerprint_identity');
        } catch {
          // Ignore
        }
      }

      // Also clear using the client library
      try {
        const { clearPersistentIdentity } = await import('@anthropic/fingerprint-client');
        await clearPersistentIdentity();
      } catch {
        // Library might not be loaded
      }

      alert('Browser data cleared! Cookies, localStorage, sessionStorage, and IndexedDB have been wiped. Click "Collect Fingerprint" to test identification without stored data.');

      // Reset state and re-collect
      setVisitorInfo(null);
      setResult(null);
      hasCollected.current = false;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear browser data');
    } finally {
      setIsClearing(false);
    }
  };

  // Get match type info
  const matchInfo = visitorInfo ? MATCH_TYPE_INFO[visitorInfo.matchType] || MATCH_TYPE_INFO.new : null;

  // Calculate which signals contributed
  const getSignalContributions = () => {
    if (!result?.components) return [];

    return SIGNAL_CONTRIBUTIONS.map(signal => {
      const component = result.components[signal.key];
      const hasData = component && !component.error && component.hash;
      return {
        ...signal,
        active: hasData,
        hash: component?.hash?.slice(0, 8) || 'N/A',
      };
    }).sort((a, b) => b.entropy - a.entropy);
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
            Browser fingerprinting library demonstration - see how you&apos;re identified
          </p>
        </header>

        <div className="mb-8 flex flex-wrap gap-4">
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

          <button
            onClick={clearBrowserData}
            disabled={isClearing}
            className="px-6 py-3 bg-yellow-600 text-white rounded-lg font-semibold
                       hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                       transition-colors flex items-center gap-2"
          >
            {isClearing ? (
              <>
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                Clearing...
              </>
            ) : (
              <>
                <span>🧹</span>
                Clear Browser Data
              </>
            )}
          </button>

          <button
            onClick={flushAllVisitors}
            disabled={isFlushing}
            className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold
                       hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                       transition-colors flex items-center gap-2"
          >
            {isFlushing ? (
              <>
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                Flushing...
              </>
            ) : 'Flush Server Data'}
          </button>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {visitorInfo && matchInfo && (
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
              <span className={`px-3 py-1 rounded-full text-sm font-semibold bg-${matchInfo.color}-200 text-${matchInfo.color}-800`}
                    style={{
                      backgroundColor: `var(--${matchInfo.color}-200, #e2e8f0)`,
                      color: `var(--${matchInfo.color}-800, #1a202c)`,
                    }}>
                {matchInfo.icon} {matchInfo.name.toUpperCase()}
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

            {/* Identification Method Explanation */}
            <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <span>{matchInfo.icon}</span>
                How You Were Identified
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {matchInfo.description}
              </p>

              {/* Persistent Identity Warning */}
              {visitorInfo.persistentIdentity?.used && (
                <div className="mt-2 p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg border border-orange-300">
                  <p className="text-sm text-orange-800 dark:text-orange-200">
                    <strong>⚠️ Easy to evade:</strong> You were identified using stored data (cookies/localStorage).
                    Click &quot;Clear Browser Data&quot; above to remove this and test fingerprint-only identification.
                  </p>
                </div>
              )}

              {/* Hardware-based identification */}
              {['stable', 'gpu', 'fuzzy-stable'].includes(visitorInfo.matchType) && (
                <div className="mt-2 p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg border border-purple-300">
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    <strong>🔒 Hardware-based:</strong> You were identified using hardware characteristics that
                    persist across browsers and incognito mode. This is harder to evade without changing hardware.
                  </p>
                </div>
              )}
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

        {/* Signal Contributions */}
        {result && (
          <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span>📊</span> Fingerprint Signal Contributions
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              These signals combine to create your unique browser fingerprint. Higher entropy = more identifying power.
            </p>

            <div className="space-y-3">
              {getSignalContributions().map(signal => (
                <div key={signal.key} className="flex items-center gap-4">
                  <div className="w-32 text-sm font-medium">{signal.name}</div>
                  <div className="flex-1">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${signal.active ? 'bg-blue-500' : 'bg-gray-400'}`}
                        style={{ width: `${(signal.entropy / 15) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-20 text-right text-sm">
                    <span className={signal.active ? 'text-blue-600 font-semibold' : 'text-gray-400'}>
                      {signal.entropy} bits
                    </span>
                  </div>
                  <div className="w-24 text-xs font-mono text-gray-500">
                    {signal.active ? signal.hash : 'N/A'}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Total Entropy:</span>
                <span className="font-bold">{result.entropy?.toFixed(1) || 'N/A'} bits</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Higher entropy means more unique. ~33 bits is enough to uniquely identify among 8 billion people.
              </p>
            </div>
          </div>
        )}

        {result && <FingerprintDisplay result={result} />}
      </div>
    </main>
  );
}
