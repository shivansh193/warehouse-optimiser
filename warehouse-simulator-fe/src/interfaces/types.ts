// src/interfaces/types.ts

export interface MasterItem {
    id: string; // SKU or unique ID
    name: string;
    color: string;
  }
  
  export interface ShelfStoredItem {
    masterItemId: string; // References MasterItem.id
    quantity: number;
  }
  
  export interface ShelfType { // Represents a single, logical, facing shelf
    id: number; // Unique ID for this logical shelf
    items: ShelfStoredItem[];
    // row & col are now less about direct rendering and more for logical grouping if needed
    // Their visual position is determined by the grid layout function.
    row: number; // Could be a logical row index for data grouping
    col: number; // Could be a logical col index for data grouping
    maxCapacityPerShelf?: number;
    // Properties like x, y, facing will be determined by the layout generation
    // and might be temporarily added to a ShelfType instance when placed,
    // or the GridCellDisplayData will hold this info.
  }
  
  export interface GridCellDisplayData {
    id: string; // "x-y"
    x: number;
    y: number;
    type: 'aisle' | 'shelf_block' | 'empty' | 'entry' | 'exit' | 'obstacle';
    shelfSlots?: Array<{
      shelfId: number; // ID of the logical ShelfType
      facing: 'N' | 'S' | 'E' | 'W';
    }>;
    // Visual properties
    isPath?: boolean;
    isOptimalPath?: boolean;
    isAlternatePath?: boolean;
    isStart?: boolean;
    isEnd?: boolean;
    isSelected?: boolean; // For highlighting the whole grid cell if needed
    isCellHovered?: boolean; // For highlighting the whole grid cell on hover
  
    // Callbacks are attached by the layout generator or RoomLayout
    onClick?: () => void; // Click on the entire cell
    onShelfSlotClick?: (shelfId: number, facing: 'N'|'S'|'E'|'W') => void; // Click on a specific facing part
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  }