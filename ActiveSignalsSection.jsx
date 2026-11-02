// ActiveSignalsSection.jsx - Final Updated Component
import React from 'react';

const ActiveSignalsSection = ({ signals = [], onSelectPair }) => {
  const activeItems = signals.filter((item) => parseFloat(item.score) === 5.0);

  return (
    <div className="w-full space-y-4">
      <h2 className="text-xl font-bold text-emerald-400 mb-2">Active Signals (Entry Confirmed)</h2>

      {activeItems.length === 0 ? (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-center">
          No active signals right now.
        </div>
      ) : (
        activeItems.map((item) => {
          const livePrice = item.price || '0.00';
          const stopLoss = item.stopLoss || '0.00';

          return (
            <div 
              key={item.symbol} 
              className="p-4 bg-emerald-950/20 border border-emerald-500/40 hover:border-emerald-500/70 rounded-xl transition-all"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-extrabold text-white text-lg">{item.symbol}</span>
                <span className="px-3 py-1 text-xs font-black text-emerald-400 bg-emerald-400/20 rounded-full border border-emerald-400/30 animate-pulse">
                  ACTIVE SIGNAL ⚡
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm text-slate-300 mb-3">
                <div>
                  <span className="text-slate-500 block text-xs">Live Entry Price</span>
                  <span className="font-mono text-emerald-400 font-bold">{livePrice}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Tight Stop Loss (SL)</span>
                  <span className="font-mono text-red-400 font-bold">{stopLoss}</span>
                </div>
              </div>

              <div className="p-2.5 bg-emerald-900/30 rounded-lg text-xs text-emerald-200 border border-emerald-500/20 mb-3">
                ⚡ Setup confirmed! Execute trade within specified SL management.
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
