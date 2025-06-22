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
  
// In src/interfaces/types.ts or at the top of RoomLayout.tsx
export interface ShelfType {
  id: number;
  items: ShelfStoredItem[];
  row: number; // Logical grouping, might become less relevant for display
  col: number; // Logical grouping
  maxCapacityPerShelf?: number;
  gridX?: number;         // X-coordinate of the shelf_block cell it's in
  gridY?: number;         // Y-coordinate of the shelf_block cell it's in
  placedFacing?: 'N' | 'S' | 'E' | 'W'; // The direction this shelf faces from its block
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
    pathSequence?: number;         // Sequence number for this step in the path (e.g., 1, 2, 3...)
    isPickLocation?: boolean; 
    // Visual properties
    isPath?: boolean;
    isOptimalPath?: boolean;
    isUnoptimizedPath?: boolean; // New flag
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