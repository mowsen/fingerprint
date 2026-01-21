'use client';

import { useState } from 'react';

interface FingerprintResult {
  fingerprint: string;
  fuzzyHash: string;
  components: Record<string, unknown>;
  detection: {
    isHeadless: boolean;
    liesDetected: number;
    privacyTools: string[];
    confidence: number;
  };
  entropy: number;
  duration: number;
}

interface Props {
  result: FingerprintResult;
}

export default function FingerprintDisplay({ result }: Props) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const toggleModule = (name: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedModules(newExpanded);
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Fingerprint Summary</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Entropy</div>
            <div className="text-2xl font-bold">{result.entropy.toFixed(1)} bits</div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Collection Time</div>
            <div className="text-2xl font-bold">{result.duration}ms</div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Lies Detected</div>
            <div className={`text-2xl font-bold ${result.detection.liesDetected > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {result.detection.liesDetected}
            </div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Headless</div>
            <div className={`text-2xl font-bold ${result.detection.isHeadless ? 'text-red-500' : 'text-green-500'}`}>
              {result.detection.isHeadless ? 'Yes' : 'No'}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Fingerprint Hash</div>
            <code className="block bg-gray-100 dark:bg-gray-700 p-2 rounded text-xs break-all">
              {result.fingerprint}
            </code>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Fuzzy Hash</div>
            <code className="block bg-gray-100 dark:bg-gray-700 p-2 rounded text-xs break-all">
              {result.fuzzyHash}
            </code>
          </div>
        </div>

        {result.detection.privacyTools.length > 0 && (
          <div className="mt-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Privacy Tools Detected</div>
            <div className="flex flex-wrap gap-2">
              {result.detection.privacyTools.map((tool, i) => (
                <span key={i} className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Components Detail */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Component Details</h2>

        <div className="space-y-2">
          {Object.entries(result.components).map(([name, component]) => {
            const comp = component as { hash: string; data: unknown; duration?: number; error?: string };
            const isExpanded = expandedModules.has(name);

            return (
              <div key={name} className="border dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleModule(name)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{name}</span>
                    {comp.error ? (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                        Error
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                        OK
                      </span>
                    )}
                    {comp.duration && (
                      <span className="text-xs text-gray-500">{comp.duration}ms</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-gray-500">{comp.hash?.slice(0, 8) || 'N/A'}...</code>
                    <svg
                      className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-700">
                    {comp.error ? (
                      <div className="text-red-600">{comp.error}</div>
                    ) : (
                      <pre className="text-xs overflow-auto max-h-96 scrollbar-thin">
                        {JSON.stringify(comp.data, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
