import React, { useState, useEffect } from 'react';
import ShelfDetailView from './Shelf'; // Renamed Shelf.jsx to ShelfDetailView.jsx for clarity

// Define Master Item and Shelf Item types
interface MasterItem {
  id: string; // SKU or unique ID
  name: string;
  color: string; // For visual representation in catalog/shelf
  // Add other properties like imageUrl, dimensions, weight later
}

interface ShelfStoredItem {
  masterItemId: string; // References MasterItem.id
  quantity: number;
}

interface ShelfType {
  id: number;
  items: ShelfStoredItem[]; // Changed from 'products'
  row: number;
  col: number;
  maxCapacityPerShelf?: number; // Define max capacity per shelf
}

// Predefined Master Items (Item Catalog)
const MASTER_ITEMS_CATALOG: MasterItem[] = [
  { id: 'SKU001', name: 'Red Box', color: 'bg-red-500' },
  { id: 'SKU002', name: 'Blue Cylinder', color: 'bg-blue-500' },
  { id: 'SKU003', name: 'Green Cube', color: 'bg-green-500' },
  { id: 'SKU004', name: 'Yellow Sphere', color: 'bg-yellow-500' },
  { id: 'SKU005', name: 'Purple Pyramid', color: 'bg-purple-500' },
];

const MAX_ITEMS_PER_SHELF = 96; // Max unique item instances or total quantity units

const RoomLayout = () => {
  const [shelves, setShelves] = useState<ShelfType[]>(() => {
    const initialShelves: ShelfType[] = [];
    for (let i = 1; i <= 21; i++) {
      initialShelves.push({
        id: i,
        items: [], // Start with empty shelves
        row: Math.floor((i - 1) / 3),
        col: (i - 1) % 3,
        maxCapacityPerShelf: MAX_ITEMS_PER_SHELF,
      });
    }
    return initialShelves;
  });

  const [selectedShelfId, setSelectedShelfId] = useState<number | null>(null);
  const [hoveredShelfId, setHoveredShelfId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [selectedMasterItemId, setSelectedMasterItemId] = useState<string | null>(null); // For click-to-add

  const totalShelves = shelves.length;
  const shelvesPerRow = 3;
  const currentRows = Math.ceil(totalShelves / shelvesPerRow);

  const addShelves = () => {
    if (totalShelves >= 48) {
      setError('Cannot exceed 48 shelves maximum');
      return;
    }
    const newRow = Math.floor(totalShelves / 3);
    const newShelvesToAdd: ShelfType[] = [];
    for (let i = 0; i < 3; i++) {
      newShelvesToAdd.push({
        id: totalShelves + i + 1,
        items: [],
        row: newRow,
        col: i,
        maxCapacityPerShelf: MAX_ITEMS_PER_SHELF,
      });
    }
    setShelves([...shelves, ...newShelvesToAdd]);
    setError('');
  };

  const removeShelves = () => {
    if (totalShelves <= 3) {
      setError('Must keep at least 3 shelves');
      return;
    }
    setShelves(shelves.slice(0, -3));
    setError('');
  };

  const getShelfById = (id: number): ShelfType | undefined => shelves.find(shelf => shelf.id === id);

  const handleMasterItemSelect = (itemId: string) => {
    setSelectedMasterItemId(prev => (prev === itemId ? null : itemId)); // Toggle selection
  };

  const handleShelfClick = (shelfId: number) => {
    if (selectedMasterItemId) {
      // Add selected item to this shelf
      setShelves(prevShelves =>
        prevShelves.map(shelf => {
          if (shelf.id === shelfId) {
            const currentItemCount = shelf.items.reduce((sum, item) => sum + item.quantity, 0);
            if (currentItemCount >= (shelf.maxCapacityPerShelf || MAX_ITEMS_PER_SHELF)) {
              alert(`Shelf ${shelfId} is full!`);
              return shelf;
            }

            const existingItemIndex = shelf.items.findIndex(
              item => item.masterItemId === selectedMasterItemId
            );
            let newItems;
            if (existingItemIndex > -1) {
              // Item already exists, increment quantity
              newItems = shelf.items.map((item, index) =>
                index === existingItemIndex
                  ? { ...item, quantity: item.quantity + 1 }
                  : item
              );
            } else {
              // Add new item with quantity 1
              newItems = [...shelf.items, { masterItemId: selectedMasterItemId, quantity: 1 }];
            }
            return { ...shelf, items: newItems };
          }
          return shelf;
        })
      );
      // Optionally deselect master item after adding
      // setSelectedMasterItemId(null); 
    } else {
      // Regular click: open shelf detail view
      setSelectedShelfId(shelfId === selectedShelfId ? null : shelfId);
    }
  };
  
  // Calculate total items (sum of quantities)
  const totalStoredItems = shelves.reduce((sum, shelf) => 
    sum + shelf.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 
  0);
  const maxOverallCapacity = totalShelves * MAX_ITEMS_PER_SHELF;

  // Function to add/update item in shelf details view (passed to ShelfDetailView)
  const updateShelfItems = (shelfId: number, updatedItems: ShelfStoredItem[]) => {
    setShelves(prevShelves => 
      prevShelves.map(shelf => 
        shelf.id === shelfId ? { ...shelf, items: updatedItems } : shelf
      )
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 flex flex-col md:flex-row gap-6">
      {/* Item Catalog Sidebar (Left) */}
      <div className="md:w-64 bg-gray-800 rounded-lg shadow-lg p-4 space-y-3 order-first md:order-none">
        <h3 className="text-xl font-bold text-white mb-3">Item Catalog</h3>
        {MASTER_ITEMS_CATALOG.map(masterItem => (
          <div
            key={masterItem.id}
            onClick={() => handleMasterItemSelect(masterItem.id)}
            className={`
              p-3 rounded-md cursor-pointer border-2 transition-all
              ${masterItem.color}
              ${selectedMasterItemId === masterItem.id
                ? 'border-white ring-2 ring-offset-2 ring-offset-gray-800 ring-white'
                : 'border-transparent hover:border-gray-500'
              }
            `}
          >
            <div className="font-semibold text-white text-center">{masterItem.name}</div>
            <div className="text-xs text-gray-200 text-center">{masterItem.id}</div>
          </div>
        ))}
        {selectedMasterItemId && (
          <div className="mt-4 text-sm text-yellow-400 p-2 bg-yellow-900 bg-opacity-50 rounded">
            Selected: {MASTER_ITEMS_CATALOG.find(i => i.id === selectedMasterItemId)?.name}
            <br />
            Click on a shelf to add.
          </div>
        )}
      </div>

      {/* Main Content Area (Center) */}
      <div className="flex-1 flex flex-col">
        {/* Header Controls */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-2xl font-bold text-white">Warehouse Layout</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={removeShelves}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                disabled={totalShelves <= 3}
              >
                Remove Row (-3)
              </button>
              <button
                onClick={addShelves}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                disabled={totalShelves >= 48}
              >
                Add Row (+3)
              </button>
            </div>
          </div>
          {error && <div className="text-red-400 text-sm mb-2">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-300">
            <div>
              <div className="font-semibold">Total Shelves</div>
              <div className="text-xl font-bold text-white">{totalShelves}</div>
            </div>
            <div>
              <div className="font-semibold">Total Items Stored</div>
              <div className="text-xl font-bold text-white">{totalStoredItems}</div>
            </div>
            <div>
              <div className="font-semibold">Overall Capacity</div>
              <div className="text-xl font-bold text-white">
                {maxOverallCapacity > 0 ? Math.round((totalStoredItems / maxOverallCapacity) * 100) : 0}% Filled
              </div>
            </div>
          </div>
        </div>

        {/* Warehouse Floor View */}
        <div className="flex-1 bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="relative bg-gray-700 rounded-lg p-8 min-h-[600px] md:min-h-[700px]"> {/* Adjusted min-height */}
            {/* Entry/Exit and Main Aisle (same as before) */}
            <div className="absolute -left-4 top-1/4 w-4 h-20 bg-green-500 rounded-l-lg"></div>
            <div className="absolute -left-16 top-1/4 text-xs text-green-400 font-semibold transform -rotate-90 origin-center">ENTRY</div>
            <div className="absolute -right-4 bottom-1/4 w-4 h-20 bg-red-500 rounded-r-lg"></div>
            <div className="absolute -right-16 bottom-1/4 text-xs text-red-400 font-semibold transform -rotate-90 origin-center">EXIT</div>
            <div className="absolute top-0 bottom-0 left-1/2 transform -translate-x-1/2 w-12 bg-gray-600 opacity-50"></div>
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-xs text-gray-400 font-semibold">MAIN AISLE</div>

            {/* Shelf Grid */}
            <div className="relative h-full flex">
              {Array.from({ length: shelvesPerRow }, (_, colIndex) => (
                <div key={`col-${colIndex}`} className="flex-1 flex flex-col justify-start items-center space-y-4 px-4 pt-4"> {/* Adjusted justify and pt */}
                  {Array.from({ length: currentRows }, (_, rowIndex) => {
                    const shelfIndex = rowIndex * shelvesPerRow + colIndex;
                    const shelf = shelves[shelfIndex];
                    
                    if (!shelf) return ( /* Empty slot rendering (same as before) */
                        <div
                          key={`empty-${rowIndex}-${colIndex}`}
                          className="w-16 h-24 border-2 border-dashed border-gray-500 rounded-lg flex items-center justify-center text-gray-400 hover:border-gray-400 transition-all cursor-pointer opacity-60"
                          onClick={addShelves}
                        ><span className="text-xl">+</span></div>
                      );

                    const currentItemCount = shelf.items.reduce((sum, item) => sum + item.quantity, 0);
                    const capacity = (currentItemCount / (shelf.maxCapacityPerShelf || MAX_ITEMS_PER_SHELF)) * 100;
                    const isSelectedForDetail = selectedShelfId === shelf.id;
                    const isHovered = hoveredShelfId === shelf.id;
                    const isTargetForAdding = selectedMasterItemId !== null;


                    // Shelf background color based on capacity
                    let shelfBgColor = 'bg-green-600 border-green-400';
                    if (capacity > 80) shelfBgColor = 'bg-red-600 border-red-400';
                    else if (capacity > 50) shelfBgColor = 'bg-yellow-600 border-yellow-400';
                    
                    if (isSelectedForDetail) shelfBgColor = 'bg-blue-500 border-blue-300';


                    return (
                      <div
                        key={shelf.id}
                        className={`
                          relative w-16 h-24 rounded-lg cursor-pointer transition-all duration-300 border-2
                          ${shelfBgColor}
                          ${isSelectedForDetail ? 'shadow-lg shadow-blue-500/50 scale-110' : ''}
                          ${isHovered && !isSelectedForDetail ? 'scale-105 shadow-lg brightness-110' : ''}
                          ${isTargetForAdding && isHovered ? 'ring-2 ring-offset-2 ring-offset-gray-700 ring-yellow-400' : ''}
                        `}
                        onClick={() => handleShelfClick(shelf.id)}
                        onMouseEnter={() => setHoveredShelfId(shelf.id)}
                        onMouseLeave={() => setHoveredShelfId(null)}
                      >
                        <div className="absolute top-1 left-1/2 transform -translate-x-1/2 text-xs font-bold text-white bg-black bg-opacity-70 px-1.5 py-0.5 rounded">
                          {shelf.id}
                        </div>
                        
                        {/* Capacity visualization - Dots showing distinct item types or just overall fill */}
                        <div className="absolute inset-2 mt-6 grid grid-cols-4 grid-rows-4 gap-0.5"> {/* Reduced rows for simplicity */}
                          {Array.from({ length: 16 }, (_, i) => { // Reduced dots
                            // Simple fill for now, could represent item types later
                            const filled = i < (capacity / 100) * 16;
                            return (
                              <div
                                key={i}
                                className={`rounded-sm ${filled ? 'bg-white opacity-80' : 'bg-gray-800 opacity-40'}`}
                              />
                            );
                          })}
                        </div>

                        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-xs font-bold text-white bg-black bg-opacity-70 px-1.5 py-0.5 rounded">
                          {Math.round(capacity)}%
                        </div>

                        {isHovered && (
                          <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-3 py-2 rounded-lg shadow-lg z-50 whitespace-nowrap">
                            <div>Shelf {shelf.id}</div>
                            <div>{currentItemCount}/{shelf.maxCapacityPerShelf || MAX_ITEMS_PER_SHELF} items</div>
                            <div>{selectedMasterItemId ? 'Click to add selected item' : 'Click for details'}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {/* Legend and Scale indicator (same as before) */}
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 rounded-lg p-3 text-xs text-white"> /* Legend */ </div>
            <div className="absolute bottom-4 right-4 text-xs text-gray-400"> /* Scale */ </div>
          </div>
        </div>
      </div>

      {/* Shelf Details Panel (Right) */}
      {selectedShelfId !== null && (
        <div className="md:w-96 bg-gray-800 rounded-lg shadow-lg p-4 order-last md:sticky md:top-4 md:self-start"> {/* Adjusted width and sticky */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Shelf {selectedShelfId} Details</h3>
            <button
              onClick={() => setSelectedShelfId(null)}
              className="text-gray-400 hover:text-white text-xl font-bold"
            >×</button>
          </div>
          <div className="bg-white rounded-lg p-3">
            <ShelfDetailView
              shelf={getShelfById(selectedShelfId)!} // Pass the whole shelf object
              masterItems={MASTER_ITEMS_CATALOG}
              onUpdateItems={(updatedItems) => updateShelfItems(selectedShelfId, updatedItems)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomLayout;