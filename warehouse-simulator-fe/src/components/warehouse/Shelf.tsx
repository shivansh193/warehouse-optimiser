import React from 'react';

// Re-using interfaces from RoomLayout (ideally, these would be in a shared types file)
interface MasterItem {
  id: string;
  name: string;
  color: string;
}

interface ShelfStoredItem {
  masterItemId: string;
  quantity: number;
}

interface ShelfType {
  id: number;
  items: ShelfStoredItem[];
  row: number;
  col: number;
  maxCapacityPerShelf?: number;
}

interface ShelfDetailViewProps {
  shelf: ShelfType;
  masterItems: MasterItem[];
  onUpdateItems: (updatedItems: ShelfStoredItem[]) => void;
}

const PRODUCTS_PER_SLOT_VISUALIZATION = 1; // Each visual slot represents 1 unit for now
const SLOTS_PER_LEVEL = 24; // Visual slots per level
const LEVELS = 4;
const MAX_ITEMS_PER_SHELF_DETAIL = SLOTS_PER_LEVEL * LEVELS; // Max visual slots

const ShelfDetailView: React.FC<ShelfDetailViewProps> = ({ shelf, masterItems, onUpdateItems }) => {
  if (!shelf) return <p>Shelf data not found.</p>;

  const currentTotalQuantity = shelf.items.reduce((sum, item) => sum + item.quantity, 0);

  const handleAddItemToShelf = (masterItemId: string) => {
    if (currentTotalQuantity >= (shelf.maxCapacityPerShelf || MAX_ITEMS_PER_SHELF_DETAIL)) {
      alert('Shelf is at maximum capacity!');
      return;
    }

    const existingItemIndex = shelf.items.findIndex(item => item.masterItemId === masterItemId);
    let updatedItems;
    if (existingItemIndex > -1) {
      updatedItems = shelf.items.map((item, index) =>
        index === existingItemIndex ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      updatedItems = [...shelf.items, { masterItemId, quantity: 1 }];
    }
    onUpdateItems(updatedItems);
  };

  const handleRemoveItemFromShelf = (masterItemId: string) => {
    const existingItem = shelf.items.find(item => item.masterItemId === masterItemId);
    if (!existingItem) return;

    let updatedItems;
    if (existingItem.quantity > 1) {
      updatedItems = shelf.items.map(item =>
        item.masterItemId === masterItemId ? { ...item, quantity: item.quantity - 1 } : item
      );
    } else {
      updatedItems = shelf.items.filter(item => item.masterItemId !== masterItemId);
    }
    onUpdateItems(updatedItems);
  };

  // Create a flat list of all individual item units for visual slot representation
  const allVisualSlots: (MasterItem | null)[] = [];
  shelf.items.forEach(storedItem => {
    const masterItem = masterItems.find(mi => mi.id === storedItem.masterItemId);
    if (masterItem) {
      for (let i = 0; i < storedItem.quantity; i++) {
        if (allVisualSlots.length < MAX_ITEMS_PER_SHELF_DETAIL) {
          allVisualSlots.push(masterItem);
        } else {
          break; // Stop if visual capacity is exceeded
        }
      }
    }
  });
  // Fill remaining visual slots with null
  while (allVisualSlots.length < MAX_ITEMS_PER_SHELF_DETAIL) {
    allVisualSlots.push(null);
  }


  const renderProductSlotsForLevel = (levelIndex: number) => {
    const slotsForLevel: (MasterItem | null)[] = [];
    const startIndex = levelIndex * SLOTS_PER_LEVEL;
    for (let i = 0; i < SLOTS_PER_LEVEL; i++) {
      slotsForLevel.push(allVisualSlots[startIndex + i] || null);
    }
    
    return slotsForLevel.map((masterItem, slotIndex) => (
      <div
        key={`level-${levelIndex}-slot-${slotIndex}`}
        title={masterItem ? `${masterItem.name} (SKU: ${masterItem.id})` : 'Empty Slot'}
        className={`
          w-full h-6 border border-gray-300 rounded-sm flex items-center justify-center
          text-xs text-white overflow-hidden whitespace-nowrap
          ${masterItem ? masterItem.color : 'bg-gray-100'}
          ${masterItem ? 'hover:brightness-110 cursor-pointer' : 'hover:bg-gray-200'}
        `}
        // onClick={() => masterItem ? handleRemoveOneUnit(masterItem.id) : handleAddSpecificItemToSlot(levelIndex, slotIndex)}
        // More complex slot-specific add/remove can be added later
      >
        {/* Can add a tiny icon or abbreviation if needed */}
        {/* {masterItem && masterItem.id.slice(-3)} */}
      </div>
    ));
  };

  return (
    <div className="bg-white border-2 border-gray-400 rounded-lg p-3 shadow-lg">
      <div className="text-center mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Shelf {shelf.id}</h3>
        <div className="text-xs text-gray-500">
          {currentTotalQuantity}/{shelf.maxCapacityPerShelf || MAX_ITEMS_PER_SHELF_DETAIL} items stored
        </div>
      </div>
      
      {/* Quick Add Buttons from Catalog */}
      <div className="mb-3 p-2 border-b border-gray-200">
        <p className="text-xs text-gray-600 mb-1">Quick Add (1 unit):</p>
        <div className="flex flex-wrap gap-1">
            {masterItems.map(mi => (
                <button
                    key={mi.id}
                    onClick={() => handleAddItemToShelf(mi.id)}
                    disabled={currentTotalQuantity >= (shelf.maxCapacityPerShelf || MAX_ITEMS_PER_SHELF_DETAIL)}
                    className={`px-1.5 py-0.5 text-xs rounded ${mi.color} text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={`Add ${mi.name}`}
                >
                    + {mi.name}
                </button>
            ))}
        </div>
      </div>
       {/* Quick Remove Buttons */}
       {shelf.items.length > 0 && (
        <div className="mb-3 p-2 border-b border-gray-200">
          <p className="text-xs text-gray-600 mb-1">Quick Remove (1 unit):</p>
          <div className="flex flex-wrap gap-1">
            {shelf.items.map(storedItem => {
              const masterItem = masterItems.find(mi => mi.id === storedItem.masterItemId);
              if (!masterItem) return null;
              return (
                <button
                  key={`remove-${storedItem.masterItemId}`}
                  onClick={() => handleRemoveItemFromShelf(storedItem.masterItemId)}
                  className={`px-1.5 py-0.5 text-xs rounded ${masterItem.color} text-white hover:brightness-110`}
                  title={`Remove 1 ${masterItem.name}`}
                >
                  - {masterItem.name} ({storedItem.quantity})
                </button>
              );
            })}
          </div>
        </div>
      )}


      <div className="space-y-1">
        {Array.from({ length: LEVELS }, (_, levelIndexRev) => {
          const levelIndex = LEVELS - 1 - levelIndexRev; // Render from top (level 3) to bottom (level 0)
          return (
            <div key={`level-${levelIndex}`} className="relative">
              <div className={`${levelIndex === 0 ? 'bg-amber-200' : 'bg-amber-100'} border border-amber-300 rounded px-2 py-1 mb-1`}>
                <div className="text-xs text-amber-700 mb-1">Level {levelIndex + 1}</div>
                <div className="grid grid-cols-8 gap-0.5"> {/* Adjust grid-cols if SLOTS_PER_LEVEL changes */}
                  {renderProductSlotsForLevel(levelIndex)}
                </div>
              </div>
              {levelIndex > 0 && (
                <div className="h-1 bg-gray-600 rounded-full mx-1"></div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="h-2 bg-gray-700 rounded-b-lg mt-1"></div>
      
      <div className="mt-2 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-300"
          style={{ width: `${(currentTotalQuantity / (shelf.maxCapacityPerShelf || MAX_ITEMS_PER_SHELF_DETAIL)) * 100}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ShelfDetailView;