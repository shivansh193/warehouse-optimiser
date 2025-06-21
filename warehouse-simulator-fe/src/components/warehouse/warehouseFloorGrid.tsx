import React from 'react';
import type { GridCellDisplayData, ShelfType } from '../../interfaces/types'; // Adjust path

interface WarehouseFloorGridProps {
  gridCells: GridCellDisplayData[][];
  logicalShelvesData: ShelfType[];
  selectedLogicalShelfId?: number | null;
  hoveredCellId?: string | null;
  onShelfSlotClick: (shelfId: number, facing: 'N'|'S'|'E'|'W') => void;
  onCellClick?: (cell: GridCellDisplayData) => void;
  onCellMouseEnter: (cellId: string) => void;
  onCellMouseLeave: () => void;
  entryPoint?: { x: number, y: number };
  exitPoint?: { x: number, y: number };
}

const WarehouseFloorGrid: React.FC<WarehouseFloorGridProps> = ({
  gridCells,
  logicalShelvesData,
  selectedLogicalShelfId,
  hoveredCellId,
  onShelfSlotClick,
  onCellClick,
  onCellMouseEnter,
  onCellMouseLeave,
  entryPoint,
  exitPoint,
}) => {
  if (!gridCells || gridCells.length === 0 || gridCells[0].length === 0) {
    return <div className="p-4 text-slate-400">Generating warehouse layout...</div>;
  }

  const numRows = gridCells.length;
  const numCols = gridCells[0].length;

  const getLogicalShelfData = (shelfId: number): ShelfType | undefined => {
    return logicalShelvesData.find(s => s.id === shelfId);
  };

  return (
    <div className="bg-slate-800 p-1 sm:p-2 rounded-lg shadow-inner w-full h-full">
      <div
        className="grid gap-px sm:gap-0.5 w-full h-full"
        style={{
          gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))`,
        }}
      >
        {gridCells.flat().map((cell) => {
          let cellBg = 'bg-slate-700/60';
          let border = 'border-slate-600/30';
          let content = null;
          let cellClasses = "transition-all duration-150 relative";
          
          const isCellHovered = hoveredCellId === cell.id;
          const isEntry = entryPoint && cell.x === entryPoint.x && cell.y === entryPoint.y;
          const isExit = exitPoint && cell.x === exitPoint.x && cell.y === exitPoint.y;


          if (cell.type === 'shelf_block') {
            cellBg = isCellHovered ? 'bg-slate-600' : 'bg-slate-600/50';
            border = 'border-slate-500/40';

            content = (
              <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"> {/* Changed to flex-col */}
                {/* Visual divider (optional, horizontal now) */}
                {cell.shelfSlots && cell.shelfSlots.length > 1 && (
                    <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-slate-500/50 z-0"></div>
                )}
                
                {cell.shelfSlots?.map((slot, index) => {
                  const shelfData = getLogicalShelfData(slot.shelfId);
                  if (!shelfData) return <div key={index} className="flex-1 w-full bg-slate-500/20"></div>;

                  const currentItemCount = shelfData.items.reduce((sum, item) => sum + item.quantity, 0);
                  const capacity = (currentItemCount / (shelfData.maxCapacityPerShelf || 96)) * 100;
                  
                  let facingBg = '';
                  let textColor = 'text-white';

                  if (selectedLogicalShelfId === slot.shelfId) {
                    facingBg = 'bg-blue-500 ring-2 ring-blue-300 ring-offset-1 ring-offset-slate-600 z-10';
                  } else if (capacity > 80) facingBg = 'bg-red-500';
                  else if (capacity > 50) facingBg = 'bg-yellow-500';
                  else if (capacity >= 0) facingBg = 'bg-green-600';
                  
                  if (capacity > 50 && capacity <= 80) textColor = 'text-black';

                  return (
                    <div
                    key={`${cell.id}-slot-${slot.shelfId}`}
                    className={`flex-1 w-full h-full flex flex-col items-center justify-center 
                                ${facingBg} ${textColor}
                                text-[6px] sm:text-[7px] leading-tight  /* Smaller font, tighter leading */
                                p-0  /* Reduced padding */
                                cursor-pointer hover:brightness-125 relative z-1
                                ${cell.shelfSlots && cell.shelfSlots.length > 1 ? (index === 0 ? 'rounded-l-sm' : 'rounded-r-sm') : 'rounded-sm'}
                              `}
                    onClick={(e) => { e.stopPropagation(); onShelfSlotClick(slot.shelfId, slot.facing); }}
                    title={`Shelf ${slot.shelfId} (${slot.facing}) - ${Math.round(capacity)}% Full`}
                  >
                    <span className="font-bold whitespace-nowrap">{slot.shelfId}</span>
                    <span className="whitespace-nowrap">{Math.round(capacity)}%</span>
                  </div>
                  );
                })}
              </div>
            );
             if(isCellHovered && cell.shelfSlots && cell.shelfSlots.length > 0) {
                 content = <> {content} <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded shadow-lg z-20 whitespace-nowrap"> Shelf Block {cell.x},{cell.y} </div> </>
             }
          } else if (cell.type === 'aisle') {
            cellBg = isCellHovered ? 'bg-slate-600/50' : 'bg-slate-700/40';
          } else if (cell.type === 'empty') {
            cellBg = 'bg-slate-800';
          }
          
          if (isEntry) { cellBg = 'bg-green-600'; content = <div className="text-white text-[7px] sm:text-[9px] font-bold p-0.5">ENT</div>; }
          if (isExit) { cellBg = 'bg-red-600'; content = <div className="text-white text-[7px] sm:text-[9px] font-bold p-0.5">EXT</div>; }
          
          if (cell.isOptimalPath) cellBg = 'bg-gradient-to-br from-cyan-400 to-cyan-500'; 
          else if (cell.isStart && !isEntry) cellBg = 'bg-lime-400'; // Avoid overriding entry/exit color
          else if (cell.isEnd && !isExit) cellBg = 'bg-fuchsia-500';


          return (
            <div
              key={cell.id}
              className={`aspect-square rounded-sm ${cellBg} ${border} ${cellClasses} flex items-center justify-center overflow-hidden`}
              onClick={() => onCellClick && onCellClick(cell)}
              onMouseEnter={() => onCellMouseEnter(cell.id)}
              onMouseLeave={onCellMouseLeave}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WarehouseFloorGrid;