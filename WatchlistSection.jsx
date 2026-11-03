// WatchlistSection.jsx - Dynamic Probability & Locked Zone UI
import React from 'react';

const WatchlistSection = ({ signals = [], onSelectPair }) => {
  // Filter ONLY Watchlist status (Score 4.5 - 4.9)
  const watchlistItems = signals.filter((item) => {
    const scoreVal = parseFloat(item.score);
    return scoreVal >= 4.5 && scoreVal <= 4.9;
  });

  return (
    <div className="w-full space-y-4">
      <h2 className="text-xl font-bold text-amber-400 mb-2">Watchlist (Pre-Spike Zones)</h2>

      {watchlistItems.length === 0 ? (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-center">
          No pairs currently in high probability spike zone.
        </div>
      ) : (
        watchlistItems.map((item) => {
          const livePrice = item.price || item.livePrice || '0.00';
          const minRange = item.minRange || '0.00';
          const maxRange = item.maxRange || '0.00';
          const probability = item.spikeProbability || '78%';

          return (
            <div 
              key={item.symbol} 
              className="p-4 bg-slate-900 border border-amber-500/20 hover:border-amber-500/40 rounded-xl transition-all"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-extrabold text-white text-lg">{item.symbol}</span>
                <span className="px-3 py-1 text-xs font-black text-amber-300 bg-amber-500/20 rounded-full border border-amber-400/30">
                  ⚡ Spike Chance: {probability}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm text-slate-300 mb-3">
                <div>
                  <span className="text-slate-500 block text-xs">Live Price</span>
                  <span className="font-mono text-white font-semibold">{livePrice}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Locked Zone (10-15 Min Range)</span>
                  <span className="font-mono text-amber-400 font-bold">{minRange} - {maxRange}</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-950/60 rounded-lg text-xs text-amber-300 border border-amber-500/10 mb-3">
                ⏳ High probability spike zone locked. Stay patient until price reacts in range.
              </div>

              <button
                onClick={() => onSelectPair && onSelectPair(item.symbol)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
              >
                Full Breakdown ↗
              </button>
            </div>
          );
        })
      )}
    </div>
  );
};

export default WatchlistSection;
