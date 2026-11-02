// ActiveSignalsSection.jsx - Final Component
import React from 'react';

const ActiveSignalsSection = ({ signals = [], onSelectPair }) => {
  // Safe filtering: Check score directly or status matching 5.0
  const activeItems = signals.filter((item) => {
    const scoreVal = parseFloat(item.score);
    return scoreVal === 5.0 || item.status === 'ACTIVE_SIGNAL';
  });

  return (
    <div className="w-full space-y-4">
      <h2 className="text-xl font-bold text-emerald-400 mb-2">Active Signals (5.0/5.0)</h2>

      {activeItems.length === 0 ? (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-center">
          No active 5.0/5.0 signals right now.
        </div>
      ) : (
        activeItems.map((item) => {
          const livePrice = item.price || item.livePrice || '0.00';
          const stopLoss = item.stopLoss || item.slRange || '0.00';

          return (
            <div 
              key={item.symbol} 
              className="p-4 bg-emerald-950/20 border border-emerald-500/30 hover:border-emerald-500/60 rounded-xl transition-all"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-extrabold text-white text-lg">{item.symbol}</span>
                <span className="px-2.5 py-1 text-xs font-extrabold text-emerald-400 bg-emerald-400/20 rounded-full border border-emerald-400/30 animate-pulse">
                  ACTIVE 5.0/5.0
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm text-slate-300 mb-3">
                <div>
                  <span className="text-slate-500 block text-xs">Live Price</span>
                  <span className="font-mono text-emerald-400 font-bold">{livePrice}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">SL Range</span>
                  <span className="font-mono text-red-400">{stopLoss}</span>
                </div>
              </div>

              <div className="p-2.5 bg-emerald-900/30 rounded-lg text-xs text-emerald-200 border border-emerald-500/20 mb-3">
                {item.recommendation || `⚡ [${item.symbol} ACTIVE]: High Precision Setup Confirmed!`}
              </div>

              <button
                onClick={() => onSelectPair && onSelectPair(item.symbol)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition"
              >
                Open Signal & Chart ↗
              </button>
            </div>
          );
        })
      )}
    </div>
  );
};

export default ActiveSignalsSection;
