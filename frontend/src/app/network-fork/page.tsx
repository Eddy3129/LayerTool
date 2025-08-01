'use client';

import LiveNetworkForkerIDE from '@/components/LiveNetworkForkerIDE';

export default function LiveNetworkForkerPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Live Network Fork
              </h1>
              <p className="text-gray-400 text-sm">
                Empirical gas analysis using forked mainnet environments with real-time gas prices for academic-grade accuracy.
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Powered by</div>
              <div className="text-sm font-semibold text-green-400">Hardhat Forking & Alchemy RPC</div>
            </div>
          </div>
        </div>
      </div>
      
      <LiveNetworkForkerIDE />
    </div>
  );
}