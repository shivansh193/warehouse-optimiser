import React from 'react';
import type { ShelfType, MasterItem, ShelfStoredItem } from '../../interfaces/types'; // Adjust path

interface ShelfDetailViewProps {
  shelf: ShelfType; // This is a single, logical shelf
  masterItems: MasterItem[];
  onUpdateItems: (shelfId: number, updatedItems: ShelfStoredItem[]) => void;
}

const PRODUCTS_PER_SLOT_VISUALIZATION = 1; 
const SLOTS_PER_LEVEL = 24; 
const LEVELS = 4;
const MAX_ITEMS_PER_SHELF_DETAIL = SLOTS_PER_LEVEL * LEVELS;

const ShelfDetailView: React.FC<ShelfDetailViewProps> = ({ shelf, masterItems, onUpdateItems }) => {
  if (!shelf) return <p className="text-gray-700">Select a shelf to see details.</p>;

  const currentTotalQuantity = shelf.items.reduce((sum, item) => sum + item.quantity, 0);
  const maxCapacity = shelf.maxCapacityPerShelf || MAX_ITEMS_PER_SHELF_DETAIL;

  const handleAddItemToShelf = (masterItemId: string) => {
    if (currentTotalQuantity >= maxCapacity) {
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
    onUpdateItems(shelf.id, updatedItems); // Pass shelf.id
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
    onUpdateItems(shelf.id, updatedItems); // Pass shelf.id
  };

  const allVisualSlots: (MasterItem | null)[] = [];
  shelf.items.forEach(storedItem => {
    const masterItem = masterItems.find(mi => mi.id === storedItem.masterItemId);
    if (masterItem) {
      for (let i = 0; i < storedItem.quantity; i++) {
        if (allVisualSlots.length < MAX_ITEMS_PER_SHELF_DETAIL) {
          allVisualSlots.push(masterItem);
        } else break;
      }
    }
  });
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
        className={`w-full h-6 border border-gray-300 rounded-sm flex items-center justify-center text-xs text-white overflow-hidden whitespace-nowrap ${masterItem ? masterItem.color : 'bg-gray-100'} ${masterItem ? 'hover:brightness-110 cursor-default' : 'hover:bg-gray-200'}`}
      >
        {/* {masterItem && masterItem.id.slice(-3)} */}
      </div>
    ));
  };

  return (
    // ... JSX for ShelfDetailView remains largely the same, ensure it uses `shelf.id` correctly ...
    // Example:
    <div className="bg-white border-2 border-gray-400 rounded-lg p-3 shadow-lg">
      <div className="text-center mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Shelf {shelf.id}</h3>
        <div className="text-xs text-gray-500">
          {currentTotalQuantity}/{maxCapacity} items
        </div>
      </div>
      <div className="mb-3 p-2 border-b border-gray-200">
        <p className="text-xs text-gray-600 mb-1">Quick Add (1 unit):</p>
        <div className="flex flex-wrap gap-1">
            {masterItems.map(mi => (
                <button key={mi.id} onClick={() => handleAddItemToShelf(mi.id)} disabled={currentTotalQuantity >= maxCapacity} className={`px-1.5 py-0.5 text-xs rounded ${mi.color} text-white hover:brightness-110 disabled:opacity-50`} title={`Add ${mi.name}`}>
                    + {mi.name}
                </button>
            ))}
        </div>
      </div>
       {shelf.items.length > 0 && (
        <div className="mb-3 p-2 border-b border-gray-200">
          <p className="text-xs text-gray-600 mb-1">Quick Remove (1 unit):</p>
          <div className="flex flex-wrap gap-1">
            {shelf.items.map(storedItem => {
              const masterItem = masterItems.find(mi => mi.id === storedItem.masterItemId);
              if (!masterItem) return null;
              return ( <button key={`remove-${storedItem.masterItemId}`} onClick={() => handleRemoveItemFromShelf(storedItem.masterItemId)} className={`px-1.5 py-0.5 text-xs rounded ${masterItem.color} text-white hover:brightness-110`} title={`Remove 1 ${masterItem.name}`}> - {masterItem.name} ({storedItem.quantity}) </button> );
            })}
          </div>
        </div>
      )}
      <div className="space-y-1">
        {Array.from({ length: LEVELS }, (_, levelIndexRev) => {
          const levelIndex = LEVELS - 1 - levelIndexRev;
          return ( <div key={`level-${levelIndex}`} className="relative"> <div className={`${levelIndex === 0 ? 'bg-amber-200' : 'bg-amber-100'} border border-amber-300 rounded px-2 py-1 mb-1`}> <div className="text-xs text-amber-700 mb-1">Level {levelIndex + 1}</div> <div className="grid grid-cols-8 gap-0.5"> {renderProductSlotsForLevel(levelIndex)} </div> </div> {levelIndex > 0 && ( <div className="h-1 bg-gray-600 rounded-full mx-1"></div> )} </div> );
        })}
      </div>
      <div className="h-2 bg-gray-700 rounded-b-lg mt-1"></div>
      <div className="mt-2 bg-gray-100 rounded-full h-2 overflow-hidden"> <div className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-300" style={{ width: `${(currentTotalQuantity / maxCapacity) * 100}%` }} ></div> </div>
    </div>
  );
};

export default ShelfDetailView;