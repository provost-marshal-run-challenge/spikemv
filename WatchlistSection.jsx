// WatchlistSection.jsx - Final Component
import React from 'react';

const WatchlistSection = ({ signals = [], onSelectPair }) => {
  // Safe filtering: Check score range 4.5 to 4.9 directly or status WATCHLIST
  const watchlistItems = signals.filter((item) => {
    const scoreVal = parseFloat(item.score);
    return (scoreVal >= 4.5 && scoreVal <= 4.9) || item.status === 'WATCHLIST';
  });

  return (
    <div className="w-full space-y-4">
      <h2 className="text-xl font-bold text-white mb-2">Watchlist (4.5 - 4.9)</h2>

      {watchlistItems.length === 0 ? (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-center">
          No pairs currently in Watchlist range.
        </div>
      ) : (
        watchlistItems.map((item) => {
          const livePrice = item.price || item.livePrice || '0.00';
          const stopLoss = item.stopLoss || item.slRange || '0.00';
          const scoreDisplay = typeof item.score === 'number' ? item.score.toFixed(1) : item.score;

          return (
            <div 
              key={item.symbol} 
              className="p-4 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition-all"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-extrabold text-white text-lg">{item.symbol}</span>
                <span className="px-2.5 py-1 text-xs font-bold text-amber-400 bg-amber-400/10 rounded-full border border-amber-400/20">
                  Score: {scoreDisplay}/5.0
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm text-slate-300 mb-3">
                <div>
                  <span className="text-slate-500 block text-xs">Live Price</span>
                  <span className="font-mono text-white">{livePrice}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">SL Range</span>
                  <span className="font-mono text-red-400">{stopLoss}</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-950/60 rounded-lg text-xs text-amber-300 border border-amber-500/10 mb-3">
                {item.recommendation || `⏳ [${item.symbol} WATCHLIST]: Approaching Support/Resistance Zone`}
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
