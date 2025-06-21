import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Added useNavigate
import ShelfDetailView from './Shelf'; // Correct path if different
import WarehouseFloorGrid from './warehouseFloorGrid'; // Correct path
import OrderFulfillmentView from '../fullfillment/OrderFulfillmentView'; // Correct path
import type { MasterItem, ShelfStoredItem, ShelfType, GridCellDisplayData, Order, OrderItem } from '../../interfaces/types'; // Adjust path
import { Loader2 } from 'lucide-react';

// --- Constants ---
const MASTER_ITEMS_CATALOG: MasterItem[] = [
  { id: 'SKU001', name: 'Red Box', color: 'bg-red-500' },
  { id: 'SKU002', name: 'Blue Cyl', color: 'bg-blue-500' },
  { id: 'SKU003', name: 'Green Cube', color: 'bg-green-500' },
  { id: 'SKU004', name: 'Ylw Sphr', color: 'bg-yellow-500' },
  { id: 'SKU005', name: 'Prpl Pyra', color: 'bg-purple-500' },
];
const MAX_ITEMS_PER_LOGICAL_SHELF = 96;
const DEFAULT_LOGICAL_SHELVES_COUNT = 0; // Start empty, fetch from API or use for new shops
const DEFAULT_ROOM_WIDTH_UNITS = 7;
const DEFAULT_ROOM_HEIGHT_UNITS = 7;

// --- API Service Functions (Consider moving to a dedicated services/api.ts file) ---
async function fetchShopDetailsAPI(identifier: string): Promise<{shopName: string, shelves: any[], layout?: {width?: number, height?: number}}> {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/shops/${encodeURIComponent(identifier)}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({message: `Shop with identifier '${identifier}' not found or server error.`}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
    }
    return response.json();
}


async function updateItemOnShelfAPI(shopIdentifier: string, logicalShelfId: number, masterItemId: string, newQuantity: number): Promise<{ message: string, shelf: ShelfType }> {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/shops/${encodeURIComponent(shopIdentifier)}/shelves/${logicalShelfId}/item`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterItemId, quantity: newQuantity }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
    }
    return response.json();
}

async function replaceAllItemsOnShelfAPI(shopIdentifier: string, logicalShelfId: number, newItemsArray: ShelfStoredItem[]): Promise<{ message: string, shelf: ShelfType }> {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/shops/${encodeURIComponent(shopIdentifier)}/shelves/${logicalShelfId}/all-items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: newItemsArray }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
    }
    return response.json();
}
// --- End API Service Functions ---


// --- Layout Generation Function ---
interface LayoutGenerationResult {
    gridCells: GridCellDisplayData[][];
    shelvesWithCoordinates: (ShelfType & { gridX?: number; gridY?: number })[];
}

const generateBackToBackLayout = (
  inputLogicalShelvesData: ShelfType[],
  roomWidth: number, roomHeight: number,
  onShelfSlotClickCallback: (shelfId: number, facing: 'N'|'S'|'E'|'W') => void,
  onCellClickCallback: (cell: GridCellDisplayData) => void,
  onCellMouseEnterCallback: (cellId: string) => void,
  onCellMouseLeaveCallback: () => void,
): LayoutGenerationResult => {
    const grid: GridCellDisplayData[][] = Array(roomHeight).fill(null).map((_, y) =>
        Array(roomWidth).fill(null).map((_, x) => {
            const cellId = `${x}-${y}`;
            const cellTemplate: GridCellDisplayData = {
              id: cellId, x, y, type: 'aisle', shelfSlots: [],
              onMouseEnter: () => onCellMouseEnterCallback(cellId),
              onMouseLeave: onCellMouseLeaveCallback,
            };
            cellTemplate.onClick = () => onCellClickCallback(cellTemplate);
            return cellTemplate;
        })
    );
    const shelvesWithCoordinatesOutput: (ShelfType & { gridX?: number; gridY?: number })[] =
        inputLogicalShelvesData.map(s => ({ ...s, items: [...s.items] }));

    let logicalShelfCounter = 0;
    const numShelfBlockRows = Math.max(0, Math.floor((roomHeight - 1) / 2));

    for (let sbRowIndex = 0; sbRowIndex < numShelfBlockRows; sbRowIndex++) {
        const yShelfBlock = sbRowIndex * 2 + 1;
        if (yShelfBlock >= roomHeight -1) break; // Ensure yShelfBlock is within bounds for aisles

        for (let x = 1; x < roomWidth - 1; x++) {
            if (logicalShelfCounter >= shelvesWithCoordinatesOutput.length) break;
            
            const currentCell = grid[yShelfBlock][x];
            currentCell.type = 'shelf_block';
            currentCell.shelfSlots = [];
            currentCell.onShelfSlotClick = onShelfSlotClickCallback;

            if (logicalShelfCounter < shelvesWithCoordinatesOutput.length) {
                const shelfToPlace = shelvesWithCoordinatesOutput[logicalShelfCounter];
                currentCell.shelfSlots?.push({ shelfId: shelfToPlace.id, facing: 'N' });
                shelfToPlace.gridX = x; shelfToPlace.gridY = yShelfBlock;
                logicalShelfCounter++;
            }
            if (logicalShelfCounter < shelvesWithCoordinatesOutput.length) {
                const shelfToPlace = shelvesWithCoordinatesOutput[logicalShelfCounter];
                currentCell.shelfSlots?.push({ shelfId: shelfToPlace.id, facing: 'S' });
                shelfToPlace.gridX = x; shelfToPlace.gridY = yShelfBlock;
                logicalShelfCounter++;
            }
        }
        if (logicalShelfCounter >= shelvesWithCoordinatesOutput.length) break;
    }

    for (let y = 0; y < roomHeight; y++) {
        if (grid[y]?.[0] && grid[y][0].type === 'aisle') grid[y][0].type = 'aisle'; // Already default, ensures it wasn't changed
        if (grid[y]?.[roomWidth - 1] && grid[y][roomWidth - 1].type === 'aisle') grid[y][roomWidth - 1].type = 'aisle';
    }
    for (let x = 0; x < roomWidth; x++) {
        if (grid[0]?.[x] && grid[0][x].type === 'aisle') grid[0][x].type = 'aisle';
        if (grid[roomHeight - 1]?.[x] && grid[roomHeight - 1][x].type === 'aisle') grid[roomHeight - 1][x].type = 'aisle';
    }

    if (roomHeight > 2 && roomWidth > 0) {
        const midY = Math.floor(roomHeight / 2);
        if (grid[midY]?.[0]) { grid[midY][0].type = 'entry'; grid[midY][0].shelfSlots = [];}
        if (grid[midY]?.[roomWidth - 1]) { grid[midY][roomWidth - 1].type = 'exit'; grid[midY][roomWidth - 1].shelfSlots = [];}
    }
    return { gridCells: grid, shelvesWithCoordinates: shelvesWithCoordinatesOutput };
};
// --- END Layout Generation Function ---


const RoomLayout = () => {
    const { shopIdentifier } = useParams<{ shopIdentifier: string }>();
    const navigate = useNavigate();

    // --- State Hooks ---
    const [logicalShelves, setLogicalShelves] = useState<(ShelfType & { gridX?: number; gridY?: number })[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [shopName, setShopName] = useState<string>('');
  
    const [selectedLogicalShelfId, setSelectedLogicalShelfId] = useState<number | null>(null);
    const [currentActionError, setCurrentActionError] = useState('');
    const [selectedMasterItemId, setSelectedMasterItemId] = useState<string | null>(null);
    const [hoveredCellId, setHoveredCellId] = useState<string | null>(null);
  
    const [roomWidth, setRoomWidth] = useState(DEFAULT_ROOM_WIDTH_UNITS);
    const [roomHeight, setRoomHeight] = useState(DEFAULT_ROOM_HEIGHT_UNITS);

    const [currentPathData, setCurrentPathData] = useState<{ optimizedPath: {x:number,y:number}[], unoptimizedPath: {x:number,y:number}[] } | null>(null);

    // --- useEffect for Initial Data Load ---
    useEffect(() => {
        if (!shopIdentifier) {
            setPageError("No shop identifier provided in URL. Please go back and select or create a shop.");
            setIsLoading(false);
            return;
        }
        const loadShopData = async () => {
            setIsLoading(true); setPageError(null); setLogicalShelves([]); // Reset shelves
            try {
                const shopDataFromAPI = await fetchShopDetailsAPI(shopIdentifier);
                setShopName(shopDataFromAPI.shopName || 'Warehouse');

                const fetchedShelvesData: ShelfType[] = (shopDataFromAPI.shelves || []).map((s_backend: any) => ({
                    id: s_backend.shelfNumber,
                    items: (s_backend.items || []).map((item_backend: any) => ({
                        masterItemId: item_backend.masterItemId,
                        quantity: item_backend.quantity,
                    })),
                    row: s_backend.row !== undefined ? s_backend.row : -1,
                    col: s_backend.col !== undefined ? s_backend.col : -1,
                    maxCapacityPerShelf: s_backend.maxCapacityPerShelf || MAX_ITEMS_PER_LOGICAL_SHELF,
                }));
                
                // Initial layout generation will populate gridX, gridY on these fetched shelves
                const layoutResult = generateBackToBackLayout(fetchedShelvesData, roomWidth, roomHeight, ()=>{}, ()=>{}, ()=>{}, ()=>{});
                setLogicalShelves(layoutResult.shelvesWithCoordinates);

                // if (shopDataFromAPI.layout?.width) setRoomWidth(shopDataFromAPI.layout.width);
                // if (shopDataFromAPI.layout?.height) setRoomHeight(shopDataFromAPI.layout.height);

            } catch (err: any) {
                console.error("Failed to load shop data:", err);
                setPageError(err.message || "Could not load shop information.");
            } finally {
                setIsLoading(false);
            }
        };
        loadShopData();
    }, [shopIdentifier]); // Only refetch if shopIdentifier changes. Note: roomWidth/Height changes should trigger re-layout via useMemo, not full data refetch.

    // --- Memoized Derived State ---
    const currentShelfBlockRows = useMemo(() => Math.max(0, Math.floor((roomHeight - 1) / 2)), [roomHeight]);
    const logicalShelvesPerBlockRow = useMemo(() => Math.max(0, roomWidth - 2) * 2, [roomWidth]);

    const gridDisplayCells = useMemo(() => {
        const layoutResult = generateBackToBackLayout(
            logicalShelves, roomWidth, roomHeight,
            (shelfId, facing) => handleLogicalShelfClick(shelfId, facing),
            (cell) => handleCellClick(cell),
            (cellId) => setHoveredCellId(cellId),
            () => setHoveredCellId(null)
        );
        
        let gridToDisplay = layoutResult.gridCells;

        if (currentPathData && gridToDisplay.length > 0 && gridToDisplay[0].length > 0) {
            const newGridWithPaths = gridToDisplay.map(row => row.map(cell => ({ ...cell, isOptimalPath: false, isStart: false, isEnd: false })));
            const markPath = (pathCoords: {x:number, y:number}[], pathType: 'optimalPath') => {
                pathCoords.forEach((coord, index) => {
                    if (newGridWithPaths[coord.y]?.[coord.x]) {
                        if (pathType === 'optimalPath') newGridWithPaths[coord.y][coord.x].isOptimalPath = true;
                        if(index === 0) newGridWithPaths[coord.y][coord.x].isStart = true;
                        if(index === pathCoords.length -1) newGridWithPaths[coord.y][coord.x].isEnd = true;
                    }
                });
            };
            if(currentPathData.optimizedPath) markPath(currentPathData.optimizedPath, 'optimalPath');
            gridToDisplay = newGridWithPaths;
        }
        return gridToDisplay;
    }, [logicalShelves, roomWidth, roomHeight, currentPathData]); // Removed selectedMasterItemId, selectedLogicalShelfId from deps

    const canAddShelfRow = useMemo(() => {
        if (logicalShelvesPerBlockRow <= 0) return false;
        const currentFilledBlockRows = logicalShelves.length > 0 ? Math.ceil(logicalShelves.length / logicalShelvesPerBlockRow) : 0;
        return currentFilledBlockRows < currentShelfBlockRows;
    }, [logicalShelves.length, logicalShelvesPerBlockRow, currentShelfBlockRows]);

    const canRemoveShelfRow = useMemo(() => {
        return logicalShelves.length > 0 && logicalShelvesPerBlockRow > 0;
    }, [logicalShelves.length, logicalShelvesPerBlockRow]);

    // --- Handler Functions ---
    const handleLogicalShelfClick = async (logicalShelfId: number, facing?: 'N'|'S'|'E'|'W') => {
        if (!shopIdentifier) { setCurrentActionError("Shop identifier not available."); return; }
        if (selectedMasterItemId) {
            const shelfToUpdate = logicalShelves.find(s => s.id === logicalShelfId);
            if (!shelfToUpdate) { setCurrentActionError(`Shelf ${logicalShelfId} not found.`); return; }
            const currentItem = shelfToUpdate.items.find(item => item.masterItemId === selectedMasterItemId);
            const currentQuantity = currentItem ? currentItem.quantity : 0;
            const newQuantity = currentQuantity + 1;
            const projectedTotalQuantity = shelfToUpdate.items.reduce((sum, item) => sum + item.quantity, 0) + (currentItem ? 0 : 1);
            if (projectedTotalQuantity > (shelfToUpdate.maxCapacityPerShelf || MAX_ITEMS_PER_LOGICAL_SHELF)) {
                alert(`Shelf ${logicalShelfId} is full or adding this item exceeds capacity!`); return;
            }
            try {
                setCurrentActionError('');
                const { shelf: updatedShelfFromAPI } = await updateItemOnShelfAPI(shopIdentifier, logicalShelfId, selectedMasterItemId, newQuantity);
                setLogicalShelves(prevShelves => prevShelves.map(s => (s.id === updatedShelfFromAPI.id ? {...s, ...updatedShelfFromAPI} : s)));
            } catch (err: any) { setCurrentActionError(err.message || "Failed to add item."); }
        } else {
            setSelectedLogicalShelfId(prevId => (prevId === logicalShelfId ? null : logicalShelfId));
        }
    };

    const handleCellClick = (cell: GridCellDisplayData) => { console.log('Grid Cell Clicked:', cell.id, cell.type); };

    const updateShelfItemsInLayout = async (shelfId: number, updatedItemsForShelf: ShelfStoredItem[]) => {
        if (!shopIdentifier) { setCurrentActionError("Shop identifier not available."); return; }
        try {
            setCurrentActionError('');
            const { shelf: updatedShelfFromAPI } = await replaceAllItemsOnShelfAPI(shopIdentifier, shelfId, updatedItemsForShelf);
            setLogicalShelves(prevShelves => prevShelves.map(s => (s.id === updatedShelfFromAPI.id ? {...s, ...updatedShelfFromAPI} : s)));
            console.log(`Shelf ${shelfId} items updated via API.`);
        } catch (err: any) { setCurrentActionError(err.message || "Failed to update shelf items."); }
    };

    const handleMasterItemSelect = (itemId: string) => {
        setSelectedMasterItemId(prev => (prev === itemId ? null : itemId));
        if (selectedLogicalShelfId && itemId) setSelectedLogicalShelfId(null);
    };

    const addLogicalShelfRow = () => { /* ... same, but ensure API call if persisting layout changes ... */ };
    const removeLogicalShelfRow = () => { /* ... same, ensure API call if persisting layout changes ... */ };
    
    const handleDisplayPathOnGrid = (pathData: { optimizedPath: {x:number,y:number}[], unoptimizedPath: {x:number,y:number}[] /*, metrics: any*/ }) => {
        setCurrentPathData({ optimizedPath: pathData.optimizedPath, unoptimizedPath: pathData.unoptimizedPath });
    };

    // --- Conditional Rendering for Loading/Error ---
    if (isLoading) {
        return ( <div className="min-h-screen w-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4"> <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" /> <p className="text-xl">Loading Warehouse...</p> </div> );
    }
    if (pageError) {
        return ( <div className="min-h-screen w-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 text-center"> <h2 className="text-2xl text-red-400 mb-4">Error Loading Warehouse</h2> <p className="mb-6">{pageError}</p> <button onClick={() => navigate('/create-shop')} className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-lg font-semibold"> Create New Shop </button> </div> );
    }

    // --- Main JSX ---
    const totalLogicalShelvesCount = logicalShelves.length;
    const totalStoredItemsCount = logicalShelves.reduce((sum, shelf) => sum + shelf.items.reduce((itemSum, item) => itemSum + item.quantity, 0),0);
    const maxOverallCapacityVal = totalLogicalShelvesCount * MAX_ITEMS_PER_LOGICAL_SHELF;

    return (
        <div className="min-h-screen bg-gray-900 p-2 sm:p-4 flex flex-col xl:flex-row gap-4 sm:gap-6 overflow-hidden">
            {/* Col 1: Item Catalog */}
            <div className="xl:w-60 bg-gray-800 rounded-lg shadow-lg p-3 space-y-2 order-first xl:order-none self-start shrink-0">
                <h3 className="text-lg font-bold text-white mb-2">Item Catalog</h3>
                {MASTER_ITEMS_CATALOG.map(masterItem => (
                    <div key={masterItem.id} onClick={() => handleMasterItemSelect(masterItem.id)}
                        className={`p-2 rounded-md cursor-pointer border-2 transition-all ${masterItem.color} ${selectedMasterItemId === masterItem.id ? 'border-white ring-2 ring-offset-1 ring-offset-gray-800 ring-white' : 'border-transparent hover:border-gray-500'}`}>
                        <div className="font-semibold text-white text-center text-sm">{masterItem.name}</div>
                        <div className="text-xs text-gray-300 text-center">{masterItem.id}</div>
                    </div>
                ))}
                {selectedMasterItemId && ( <div className="mt-4 text-sm text-yellow-400 p-2 bg-yellow-800 bg-opacity-70 rounded"> Selected: {MASTER_ITEMS_CATALOG.find(i => i.id === selectedMasterItemId)?.name} <br />Click on a shelf face to add. </div> )}
            </div>

            {/* Col 2: Main Content (Header, Warehouse Grid) */}
            <div className="flex-1 flex flex-col min-w-0">
                <div className="bg-gray-800 rounded-lg shadow-lg p-4 mb-4 shrink-0">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                        <h2 className="text-xl font-bold text-white"> {shopName || 'Warehouse Layout'}</h2>
                        <div className="flex items-center gap-2 text-sm text-white">
                            <span>W:</span> <input type="number" value={roomWidth} onChange={e => setRoomWidth(Math.max(3, parseInt(e.target.value)))} className="w-16 p-1 bg-gray-700 border border-gray-600 rounded" />
                            <span>H:</span> <input type="number" value={roomHeight} onChange={e => setRoomHeight(Math.max(3, parseInt(e.target.value)))} className="w-16 p-1 bg-gray-700 border border-gray-600 rounded" />
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={removeLogicalShelfRow} className="btn-danger text-sm" disabled={!canRemoveShelfRow}>Remove Shelf Row ({logicalShelvesPerBlockRow})</button>
                            <button onClick={addLogicalShelfRow} className="btn-success text-sm" disabled={!canAddShelfRow}>Add Shelf Row ({logicalShelvesPerBlockRow})</button>
                        </div>
                    </div>
                    {currentActionError && <div className="text-red-400 text-sm mb-2 p-2 bg-red-900/50 rounded">{currentActionError}</div>}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-300">
                        <div><div className="font-semibold">Logical Shelves</div><div className="text-xl font-bold text-white">{totalLogicalShelvesCount}</div></div>
                        <div><div className="font-semibold">Total Items Stored</div><div className="text-xl font-bold text-white">{totalStoredItemsCount}</div></div>
                        <div><div className="font-semibold">Overall Capacity</div><div className="text-xl font-bold text-white">{maxOverallCapacityVal > 0 ? Math.round((totalStoredItemsCount / maxOverallCapacityVal) * 100) : 0}%</div></div>
                    </div>
                </div>
                <div className="flex-1 bg-gray-800 rounded-lg shadow-lg p-1 sm:p-2 md:p-4 flex items-center justify-center overflow-auto min-h-[40vh] sm:min-h-[50vh]">
                    <div className="transform scale-[0.75] sm:scale-[0.85] md:scale-[1]" style={{ width: `${roomWidth * 2.5}rem`, height: `${roomHeight * 2.5}rem`, minWidth: '250px', minHeight: '250px'}}>
                        {(gridDisplayCells && gridDisplayCells.length > 0 && gridDisplayCells[0].length > 0) ? (
                            <WarehouseFloorGrid
                                gridCells={gridDisplayCells}
                                logicalShelvesData={logicalShelves}
                                selectedLogicalShelfId={selectedLogicalShelfId}
                                hoveredCellId={hoveredCellId}
                                onShelfSlotClick={handleLogicalShelfClick}
                                onCellClick={handleCellClick}
                                onCellMouseEnter={setHoveredCellId}
                                onCellMouseLeave={() => setHoveredCellId(null)}
                            />
                        ) : <p className="text-slate-400">Layout not available or empty.</p>}
                    </div>
                </div>
            </div>

            {/* Col 3: Order Fulfillment & Shelf Details */}
            <div className="xl:w-96 flex flex-col gap-4 order-last xl:order-none self-start shrink-0 mt-4 xl:mt-0">
                <OrderFulfillmentView
                    shopIdentifier={shopIdentifier}
                    masterItems={MASTER_ITEMS_CATALOG}
                    logicalShelvesWithCoords={logicalShelves}
                    onDisplayPath={handleDisplayPathOnGrid}
                />
                {selectedLogicalShelfId !== null && (
                <div className="bg-gray-800 rounded-lg shadow-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">Shelf {selectedLogicalShelfId} Details</h3>
                        <button onClick={() => setSelectedLogicalShelfId(null)} className="text-gray-400 hover:text-white text-xl font-bold">×</button>
                    </div>
                    <div className="bg-white rounded-lg p-3 max-h-[calc(100vh-25rem)] overflow-y-auto">
                        <ShelfDetailView
                        shelf={logicalShelves.find(s => s.id === selectedLogicalShelfId)!}
                        masterItems={MASTER_ITEMS_CATALOG}
                        onUpdateItems={updateShelfItemsInLayout}
                        />
                    </div>
                </div>
                )}
            </div>
        </div>
    );
};
export default RoomLayout;

// Add some basic button styles to your global index.css if not already there:
/*
.btn-danger { @apply px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed; }
.btn-success { @apply px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed; }
*/