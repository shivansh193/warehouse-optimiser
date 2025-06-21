import React, { useState, useEffect } from 'react';

interface AnimatedWarehouseGridProps {
  rows?: number;
  cols?: number;
  showStats?: boolean; // To control if path comparison stats are shown
}

const AnimatedWarehouseGrid: React.FC<AnimatedWarehouseGridProps> = ({
  rows = 8,
  cols = 8,
  showStats = true,
}) => {
  const [pathAnimation, setPathAnimation] = useState(0);
  const totalCells = rows * cols;

  useEffect(() => {
    const interval = setInterval(() => {
      setPathAnimation(prev => (prev + 1) % 3); // Cycle through 3 path states
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Define paths based on a generic grid.
  // These are just example paths, you might want to make them more dynamic or realistic
  // if this grid is used elsewhere with actual warehouse data.
  // For simplicity, using hardcoded indices for an 8x8 grid.
  const examplePaths = {
    optimal: [0, 1, 9, 17, 25, 33, 41, 49, 57, 58, 59, 60, 61, 62, 63],
    alternate: [0, 8, 16, 24, 32, 40, 48, 56, 57, 58, 59, 60, 61, 62, 63],
    standard: [0, 1, 2, 3, 11, 19, 27, 35, 43, 51, 59, 60, 61, 62, 63],
  };

  return (
    <div className="relative bg-gradient-to-br from-slate-800/60 to-purple-900/40 backdrop-blur-lg rounded-2xl p-6 sm:p-8 border border-purple-500/25 shadow-xl">
      {/* Warehouse Grid Visualization */}
      <div className={`grid gap-1.5 sm:gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {[...Array(totalCells)].map((_, i) => {
          const isOptimalPath = examplePaths.optimal.includes(i) && pathAnimation === 0;
          const isAlternatePath = examplePaths.alternate.includes(i) && pathAnimation === 1;
          const isStandardPath = examplePaths.standard.includes(i) && pathAnimation === 2;

          let cellClass = 'bg-slate-700/40 border border-slate-600/20'; // Default cell
          if (isOptimalPath) {
            cellClass = 'bg-gradient-to-br from-cyan-400 to-cyan-500 shadow-md shadow-cyan-400/40';
          } else if (isAlternatePath) {
            cellClass = 'bg-gradient-to-br from-yellow-400 to-orange-500 shadow-md shadow-yellow-400/40';
          } else if (isStandardPath) {
            cellClass = 'bg-gradient-to-br from-pink-400 to-red-500 shadow-md shadow-pink-400/40';
          }
          
          return (
            <div
              key={i}
              className={`aspect-square rounded-md sm:rounded-lg transition-all duration-300 ${cellClass}`}
            />
          );
        })}
      </div>

      {showStats && (
        <>
          {/* Path comparison */}
          <div className="mt-4 sm:mt-6 space-y-2 sm:space-y-3">
            <div className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg transition-all duration-300 ${pathAnimation === 0 ? 'bg-cyan-500/20 border-l-4 border-cyan-400' : 'bg-slate-700/20'}`}>
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-cyan-400 rounded-full flex-shrink-0"></div>
              <span className="text-xs sm:text-sm font-medium text-slate-100">Optimal Path</span>
              <span className="ml-auto text-xs sm:text-sm bg-green-500/20 text-green-300 px-2 py-1 rounded-md font-semibold">142m</span>
            </div>
            
            <div className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg transition-all duration-300 ${pathAnimation === 1 ? 'bg-yellow-500/20 border-l-4 border-yellow-400' : 'bg-slate-700/20'}`}>
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-yellow-400 rounded-full flex-shrink-0"></div>
              <span className="text-xs sm:text-sm font-medium text-slate-100">Alternative Route</span>
              <span className="ml-auto text-xs sm:text-sm bg-red-500/20 text-red-300 px-2 py-1 rounded-md">186m</span>
            </div>
            
            <div className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg transition-all duration-300 ${pathAnimation === 2 ? 'bg-pink-500/20 border-l-4 border-pink-400' : 'bg-slate-700/20'}`}>
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-pink-400 rounded-full flex-shrink-0"></div>
              <span className="text-xs sm:text-sm font-medium text-slate-100">Standard Route</span>
              <span className="ml-auto text-xs sm:text-sm bg-red-500/20 text-red-300 px-2 py-1 rounded-md">203m</span>
            </div>
          </div>

          {/* Stats Box */}
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gradient-to-r from-green-600/15 to-cyan-600/15 rounded-lg border border-green-500/30">
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-ping opacity-75 absolute"></div>
              <div className="w-2 h-2 bg-green-400 rounded-full relative"></div>
              <span className="text-xs sm:text-sm font-semibold text-green-300">Efficiency Gain</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white">+37%</div>
            <div className="text-xs text-gray-400">vs standard routing</div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnimatedWarehouseGrid;