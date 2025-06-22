import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ShelfDetailView from './Shelf'; // Path from updates file
import WarehouseFloorGrid from './warehouseFloorGrid'; // Path from updates file
import type { MasterItem as MasterItemType, ShelfStoredItem, ShelfType, GridCellDisplayData as GridCellDisplayDataType } from '../../interfaces/types'; // Renamed to avoid conflict with local const
import { Loader2, PackagePlus, CheckCircle, AlertCircle, PlayCircle, ListOrdered, Settings2, Bot, ShoppingCart } from 'lucide-react';
import OrderFulfillmentView from '../fullfillment/OrderFulfillmentView';

import PathInstructionsPanel from '../fullfillment/PathInstructionsPanel'; // IMPORT THE NEW PANEL

// --- TYPE DEFINITIONS (from interfaces/types.ts or define here if not shared) ---
// Assuming MasterItem, ShelfStoredItem, ShelfType, GridCellDisplayData are defined correctly in '../../interfaces/types'
// Explicitly defining Order-related types as per the updates file
export interface OrderItem {
  masterItemId: string;
  quantityOrdered: number;
  quantityPicked?: number;
  status?: 'pending' | 'available' | 'unavailable' | 'partially_available'; // Status for individual line item
  stockAvailable?: number; // How many are actually in stock
}

export interface Order {
  _id?: string; // From MongoDB or similar
  orderNumber: string;
  items: OrderItem[];
  status: 'pending_pick' | 'picking' | 'picked_partial' | 'picked_full' | 'fulfilled' | 'cancelled';
  customer?: { // Example, might have more customer details
    name: string;
    address?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}
// --- END TYPE DEFINITIONS ---

// --- Constants ---
const MASTER_ITEMS_CATALOG: MasterItemType[] = [
  { id: 'SKU001', name: 'Red Box', color: 'bg-red-500' },
  { id: 'SKU002', name: 'Blue Cyl', color: 'bg-blue-500' },
  { id: 'SKU003', name: 'Green Cube', color: 'bg-green-500' },
  { id: 'SKU004', name: 'Ylw Sphr', color: 'bg-yellow-500' },
  { id: 'SKU005', name: 'Prpl Pyra', color: 'bg-purple-500' },
];
const MAX_ITEMS_PER_LOGICAL_SHELF = 96;
const DEFAULT_ROOM_WIDTH_UNITS = 7;
const DEFAULT_ROOM_HEIGHT_UNITS = 7;

// --- API Service Functions (Placeholders - Implement actual API calls) ---
async function fetchShopDetailsAPI(identifier: string): Promise<{shopName: string, shelves: any[], layout?: {width?: number, height?: number}}> {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    console.log(`Fetching shop details for: ${identifier} from ${apiUrl}`);
    // Simulating API call
    // await new Promise(resolve => setTimeout(resolve, 1000));
    // return { shopName: `Shop ${identifier}`, shelves: [] };
    const response = await fetch(`${apiUrl}/api/shops/${encodeURIComponent(identifier)}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({message: `Shop with identifier '${identifier}' not found or server error.`}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
    }
    return response.json();
}

async function updateItemOnShelfAPI(shopIdentifier: string, logicalShelfId: number, masterItemId: string, newQuantity: number): Promise<{ message: string, shelf: ShelfType }> {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    console.log(`Updating item ${masterItemId} on shelf ${logicalShelfId} for shop ${shopIdentifier} to quantity ${newQuantity}`);
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
    console.log(`Replacing all items on shelf ${logicalShelfId} for shop ${shopIdentifier}`);
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

async function generateRandomOrdersAPI(shopId: string, count: number): Promise<Order[]> {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    console.log(`Generating ${count} random orders for shop ${shopId}`);
    const response = await fetch(`${apiUrl}/api/shops/${encodeURIComponent(shopId)}/orders/generate-random?count=${count}`, {
      method: 'POST',
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to generate random orders');
    }
    return response.json();
}
  
async function fetchPendingOrdersAPI(shopId: string): Promise<Order[]> { // Assuming OrderType is your Order interface
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    
    // Define the statuses you want to fetch
    const desiredStatuses = ['pending_pick', 'picking', 'picked_partial']; // Add all relevant pending states
    const statusQueryString = desiredStatuses.join(','); // Creates "pending_pick,picking,picked_partial"
  
    console.log(`Fetching orders for shop ${shopId} with statuses: ${statusQueryString}`);
    
    const response = await fetch(`${apiUrl}/api/shops/${encodeURIComponent(shopId)}/orders?status=${statusQueryString}`);
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({message: `Could not fetch orders for shop ${shopId}.`})); // More specific default error
        throw new Error(errorData.message || `API Error: ${response.status}`);
    }
    return response.json();
  }

async function optimizeRouteAPI(shopId: string, picklist: { masterItemId: string, quantity: number, location: {x:number, y:number, shelfId: number} }[]): Promise<{ optimizedPath: {x:number,y:number}[], unoptimizedPath: {x:number,y:number}[], metrics: any }> {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    console.log(`Optimizing route for shop ${shopId} with picklist:`, picklist);
     const response = await fetch(`${apiUrl}/api/shops/${encodeURIComponent(shopId)}/optimize-pick-route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemsToPick: picklist }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status} - Could not optimize route.`);
    }
    return response.json();
}

async function updateOrderStatusAPI(shopId: string, orderId: string, newStatus: Order['status'], pickedItems?: OrderItem[]): Promise<Order> {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    console.log(`Updating order ${orderId} status to ${newStatus} for shop ${shopId}`);
    const response = await fetch(`${apiUrl}/api/shops/${encodeURIComponent(shopId)}/orders/${orderId}/status`, {
        method: 'PATCH', // Or PUT
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, items: pickedItems }), // Send pickedItems if applicable
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status} - Could not update order status.`);
    }
    return response.json();
}
// --- End API Service Functions ---

// --- Layout Generation Function ---
interface LayoutGenerationResult {
    gridCells: GridCellDisplayDataType[][];
    shelvesWithCoordinates: ShelfType[]; // This will be (ShelfType & { gridX, gridY, placedFacing })
}

const generateBackToBackLayout = (
    inputLogicalShelvesData: ShelfType[],
    roomWidth: number,
    roomHeight: number,
    // Removed callbacks from params, assuming they are passed to WarehouseFloorGrid directly
  ): LayoutGenerationResult => {
      // Ensure minimum dimensions for this layout logic
      if (roomHeight < 3 || roomWidth < 3) {
          console.warn(`Room dimensions (W:${roomWidth}, H:${roomHeight}) too small for back-to-back layout. Returning empty grid.`);
          const emptyGrid: GridCellDisplayDataType[][] = Array(roomHeight).fill(null).map((_, y) =>
              Array(roomWidth).fill(null).map((_, x) => ({
                  id: `${x}-${y}`, x, y, type: 'empty', shelfSlots: []
              }))
          );
          return { gridCells: emptyGrid, shelvesWithCoordinates: inputLogicalShelvesData.map(s => ({...s})) };
      }
  
      const grid: GridCellDisplayDataType[][] = Array(roomHeight).fill(null).map((_, y) =>
          Array(roomWidth).fill(null).map((_, x) => {
              const cellId = `${x}-${y}`;
              const cellTemplate: GridCellDisplayDataType = {
                id: cellId, x, y, type: 'aisle', shelfSlots: [],
              };
              return cellTemplate;
          })
      );
  
      const shelvesWithCoordinatesOutput: (ShelfType & { gridX?: number; gridY?: number; placedFacing?: 'N' | 'S' | 'E' | 'W' })[] =
          inputLogicalShelvesData.map(s => ({ ...s, items: s.items ? [...s.items] : [] }));
  
      let logicalShelfCounter = 0;
      // Max possible rows of shelf blocks, ensuring space for aisles above and below
      const numShelfBlockRows = Math.floor((roomHeight - 1) / 2);
  
      for (let sbRowIndex = 0; sbRowIndex < numShelfBlockRows; sbRowIndex++) {
          const yShelfBlock = sbRowIndex * 2 + 1; // Shelf blocks on rows 1, 3, 5...
                                                 // e.g. H=3, num=1, y=1. H=5, num=2, y=1,3. H=7, num=3, y=1,3,5.
                                                 // This yShelfBlock is guaranteed to be < roomHeight-1 if numShelfBlockRows > 0
  
          // Shelves are placed from x=1 to roomWidth-2 to leave aisles on the sides
          for (let x = 1; x < roomWidth - 1; x++) {
              if (logicalShelfCounter >= shelvesWithCoordinatesOutput.length) {
                  break; // No more logical shelves to place in this row
              }
  
              // grid[yShelfBlock][x] should be safe here due to loop bounds
              const currentCell = grid[yShelfBlock][x];
              currentCell.type = 'shelf_block';
              currentCell.shelfSlots = []; // Initialize/clear
  
              // Assign North facing shelf
              if (logicalShelfCounter < shelvesWithCoordinatesOutput.length) {
                  const shelfToPlace = shelvesWithCoordinatesOutput[logicalShelfCounter];
                  currentCell.shelfSlots?.push({ shelfId: shelfToPlace.id, facing: 'N' });
                  shelfToPlace.gridX = x;
                  shelfToPlace.gridY = yShelfBlock;
                  shelfToPlace.placedFacing = 'N';
                  logicalShelfCounter++;
              } else {
                  break; // No more shelves for N, so no more for S in this block
              }
  
              // Assign South facing shelf (if available)
              if (logicalShelfCounter < shelvesWithCoordinatesOutput.length) {
                  const shelfToPlace = shelvesWithCoordinatesOutput[logicalShelfCounter];
                  currentCell.shelfSlots?.push({ shelfId: shelfToPlace.id, facing: 'S' });
                  shelfToPlace.gridX = x; // Same block coordinates
                  shelfToPlace.gridY = yShelfBlock;
                  shelfToPlace.placedFacing = 'S';
                  logicalShelfCounter++;
              }
              // No need to break inner loop again here, outer check is sufficient
          }
          if (logicalShelfCounter >= shelvesWithCoordinatesOutput.length) {
              break; // All shelves placed, break from sbRowIndex loop
          }
      }
  
      // Designate edge cells as aisles (if not already a shelf block, which they shouldn't be)
      for (let y = 0; y < roomHeight; y++) {
          if (grid[y][0].type === 'aisle') grid[y][0].type = 'aisle'; // Redundant if default is aisle
          if (grid[y][roomWidth - 1].type === 'aisle') grid[y][roomWidth - 1].type = 'aisle';
      }
      for (let x = 0; x < roomWidth; x++) {
          if (grid[0][x].type === 'aisle') grid[0][x].type = 'aisle';
          if (grid[roomHeight - 1][x].type === 'aisle') grid[roomHeight - 1][x].type = 'aisle';
      }
  
      // Add Entry/Exit points
      if (roomHeight > 0 && roomWidth > 0) { // Simplified condition, entry/exit needs space
          const midY = Math.floor(roomHeight / 2);
          // Ensure entry/exit are placed on what should be aisles
          if (midY >=0 && midY < roomHeight) { // Ensure midY is valid
              if (grid[midY][0]) { grid[midY][0].type = 'entry'; grid[midY][0].shelfSlots = []; }
              if (grid[midY][roomWidth - 1]) { grid[midY][roomWidth - 1].type = 'exit'; grid[midY][roomWidth - 1].shelfSlots = []; }
          }
      }
  
      return { gridCells: grid, shelvesWithCoordinates: shelvesWithCoordinatesOutput };
  };
// --- END Layout Generation Function ---


const RoomLayout = () => {
  const { shopIdentifier } = useParams<{ shopIdentifier: string }>();
  const navigate = useNavigate();
  const [detailedPickSequence, setDetailedPickSequence] = useState<any[]>([]);

  // --- RoomLayout Core State ---
  const [logicalShelves, setLogicalShelves] = useState<(ShelfType)[]>([]); // State now directly holds ShelfType with optional gridX, gridY, placedFacing
  const [isLoading, setIsLoading] = useState<boolean>(true); // Page loading
  const [pageError, setPageError] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string>('');
  const [selectedLogicalShelfId, setSelectedLogicalShelfId] = useState<number | null>(null);
  const [currentActionError, setCurrentActionError] = useState(''); // For item add/update errors
  const [selectedMasterItemId, setSelectedMasterItemId] = useState<string | null>(null);
  const [hoveredCellId, setHoveredCellId] = useState<string | null>(null);
  const [roomWidth, setRoomWidth] = useState(DEFAULT_ROOM_WIDTH_UNITS);
  const [roomHeight, setRoomHeight] = useState(DEFAULT_ROOM_HEIGHT_UNITS);
  const [currentPathData, setCurrentPathData] = useState<{
    optimizedPath: { x: number; y: number }[];
    unoptimizedPath: { x: number; y: number }[];
    // Metrics will be stored separately to avoid deeply nested state in currentPathData if not needed elsewhere
} | null>(null);
  // --- Order Fulfillment State (Integrated from OrderFulfillmentView) ---
  const [isShopOpenForOrders, setIsShopOpenForOrders] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isOrderLoading, setIsOrderLoading] = useState(false); // Loading for order actions
  const [orderError, setOrderError] = useState<string | null>(null); // Errors for order actions

  
  const [optimizationMetrics, setOptimizationMetrics] = useState<any | null>(null); // Or a more specific type for metrics
  // --- useEffect for Initial Shop Data Load ---
  useEffect(() => {
    if (!shopIdentifier) { 
        setPageError("No shop identifier provided in URL."); // More descriptive
        setIsLoading(false); 
        return; 
    }
    const loadShopData = async () => {
        setIsLoading(true); setPageError(null); // No need to setLogicalShelves([]) here
        try {
            const shopDataFromAPI = await fetchShopDetailsAPI(shopIdentifier);
            setShopName(shopDataFromAPI.shopName || 'Warehouse');
            const fetchedShelvesData: ShelfType[] = (shopDataFromAPI.shelves || []).map((s_backend: any) => ({
            id: s_backend.shelfNumber, // Ensure this matches backend field
            items: (s_backend.items || []).map((item_backend: any) => ({ 
                masterItemId: item_backend.masterItemId, 
                quantity: item_backend.quantity 
            })),
            row: s_backend.row ?? -1, // Use nullish coalescing
            col: s_backend.col ?? -1, // Use nullish coalescing
            maxCapacityPerShelf: s_backend.maxCapacityPerShelf || MAX_ITEMS_PER_LOGICAL_SHELF,
        }));
        // Initial layout generation to assign gridX, gridY to shelves
        const layoutResult = generateBackToBackLayout(
            fetchedShelvesData, 
            roomWidth, roomHeight
        );
        setLogicalShelves(layoutResult.shelvesWithCoordinates); // THIS IS KEY
        } catch (err: any) { 
          console.error("Failed to load shop data:", err);
          setPageError(err.message || "Could not load shop information."); 
          setLogicalShelves([])
        } finally { 
            setIsLoading(false); 
        }
    };
    loadShopData();
  }, [shopIdentifier, roomWidth, roomHeight]); // Per updates file, removed roomWidth, roomHeight

  // --- useEffect for fetching orders when shop opens ---
  useEffect(() => {
    if (isShopOpenForOrders && shopIdentifier && !isLoading) { // Ensure shop data is loaded first
      loadPendingOrders();
    } else {
      setOrders([]); // Clear orders if shop is closed or identifier changes or still loading
    }
  }, [isShopOpenForOrders, shopIdentifier, isLoading]);

  // --- Order Fulfillment Logic (Handlers from OrderFulfillmentView) ---
  const loadPendingOrders = async () => {
    if (!shopIdentifier) return;
    setIsOrderLoading(true); setOrderError(null);
    try {
      const fetchedOrders = await fetchPendingOrdersAPI(shopIdentifier);
      const ordersWithStockStatus = checkOrderStock(fetchedOrders, logicalShelves, MASTER_ITEMS_CATALOG);
      setOrders(ordersWithStockStatus);
    } catch (err: any) {
      setOrderError(err.message);
      setOrders([]); 
    } finally {
      setIsOrderLoading(false);
    }
  };

  const handleGenerateRandomOrders = async (count: number) => {
    if (!shopIdentifier) {
      setOrderError("Shop identifier is missing.");
      return;
    }
    setIsOrderLoading(true); setOrderError(null);
    try {
      await generateRandomOrdersAPI(shopIdentifier, count); // API returns new orders, but we refetch all
      loadPendingOrders(); 
    } catch (err: any) {
      setOrderError(err.message);
    } finally {
      setIsOrderLoading(false);
    }
  };

  const checkOrderStock = (ordersToCheck: Order[], currentShelves: (ShelfType & { gridX?: number; gridY?: number })[], catalog: MasterItemType[]): Order[] => {
    return ordersToCheck.map(order => {
        const itemsWithStatus = order.items.map(item => {
            const stockAvailable = currentShelves.reduce((total, shelf) => {
                const shelfItem = shelf.items.find(si => si.masterItemId === item.masterItemId);
                return total + (shelfItem ? shelfItem.quantity : 0);
            }, 0);
            let itemLineStatus: OrderItem['status'] = 'pending';
            if (stockAvailable >= item.quantityOrdered) itemLineStatus = 'available';
            else if (stockAvailable > 0) { itemLineStatus = 'partially_available'; }
            else { itemLineStatus = 'unavailable'; }
            return { ...item, status: itemLineStatus, stockAvailable };
        });
        // Optionally, update the overall order status based on item statuses
        // For example, if all items 'unavailable', order could be 'cancelled' or require review
        return { ...order, items: itemsWithStatus };
    });
  };

  const handleToggleOrderSelection = (orderIdToToggle: string) => {
    setSelectedOrderIds(prev =>
      prev.includes(orderIdToToggle) ? prev.filter(id => id !== orderIdToToggle) : [...prev, orderIdToToggle]
    );
  };

  const handleStartFulfilling = useCallback(async () => {
    if (!shopIdentifier || selectedOrderIds.length === 0) return;
    setOrderError(null); setIsOrderLoading(true);
    const ordersToFulfill = orders.filter(o => o._id && selectedOrderIds.includes(o._id));
    
    const picklistMap = new Map<string, { quantity: number, locations: {shelfId: number, x:number, y:number, facing: 'N'|'S'|'E'|'W'}[] }>();
    
    ordersToFulfill.forEach(order => {
      order.items.forEach(item => {
        if (item.status === 'unavailable') return;
        let quantityToPick = item.quantityOrdered;
        if (item.status === 'partially_available' && typeof item.stockAvailable === 'number') {
            quantityToPick = Math.min(item.quantityOrdered, item.stockAvailable);
        }
        if (quantityToPick <= 0) return;

        const itemShelfLocations: {shelfId: number, x:number, y:number, facing: 'N'|'S'|'E'|'W'}[] = [];
        
        // Find shelves that have this item and their placement info
        logicalShelves.forEach(shelf => { // logicalShelves now have gridX, gridY, placedFacing
            const stockItem = shelf.items.find(si => si.masterItemId === item.masterItemId);
            if (stockItem && stockItem.quantity > 0 && 
                typeof shelf.gridX === 'number' && 
                typeof shelf.gridY === 'number' &&
                shelf.placedFacing) { // Check if placedFacing exists
                
                // For simplicity, we just add this shelf location if it has the item.
                // A more advanced logic would check if we already have enough from other shelves.
                if(!itemShelfLocations.find(loc => loc.shelfId === shelf.id)){ 
                     itemShelfLocations.push({ 
                         shelfId: shelf.id, 
                         x: shelf.gridX, // This is the shelf_block's X
                         y: shelf.gridY, // This is the shelf_block's Y
                         facing: shelf.placedFacing // THIS IS THE KEY
                     });
                }
            }
        });

        if(itemShelfLocations.length > 0){
            const existingEntry = picklistMap.get(item.masterItemId);
            let newQuantity = (existingEntry?.quantity || 0) + quantityToPick;
            
            // For now, just use the first location found for this masterItemId.
            // If items can be on multiple shelves, this logic would need to be more complex
            // to decide which shelf to pick from or to create multiple picklist entries.
            const primaryLocation = existingEntry?.locations?.[0] || itemShelfLocations[0];
            
            picklistMap.set(item.masterItemId, {
                quantity: newQuantity,
                locations: [primaryLocation] // Simplified to one location per master item
            });
        } else { 
            console.warn(`No grid location or facing info found for ${item.masterItemId} with available stock.`);
        }
      });
    });

    const picklistForAPI = Array.from(picklistMap.entries())
        .filter(([, data]) => data.locations.length > 0 && data.quantity > 0)
        .map(([masterItemId, data]) => ({ 
            masterItemId, 
            quantity: data.quantity, 
            location: { // Send shelf_block coords and the facing
                x: data.locations[0].x, 
                y: data.locations[0].y, 
                shelfId: data.locations[0].shelfId,
                facing: data.locations[0].facing 
            }
        }));
    if(picklistForAPI.length === 0){ 
        setOrderError("No available items in selected orders to create a picklist."); 
        setIsOrderLoading(false); 
        return; 
    }

    try {
      const pathResult = await optimizeRouteAPI(shopIdentifier, picklistForAPI);
      handleDisplayPathOnGrid(pathResult);
      const orderUpdatePromises = selectedOrderIds.map(id => updateOrderStatusAPI(shopIdentifier, id, 'picking'));
      await Promise.all(orderUpdatePromises);
      loadPendingOrders(); // Refresh orders list
      setSelectedOrderIds([]); // Clear selection
    } catch (err: any) { setOrderError(err.message); } 
    finally { setIsOrderLoading(false); }
  },[shopIdentifier, selectedOrderIds, orders, logicalShelves, navigate, updateOrderStatusAPI, optimizeRouteAPI]);

  const handleMarkOrderFulfilled = async (orderIdToMark: string) => {
    if (!shopIdentifier || !orderIdToMark) return;
    
    const orderToFulfill = orders.find(o => o._id === orderIdToMark);
    if (!orderToFulfill) {
        setOrderError(`Order ${orderIdToMark} not found locally.`);
        return;
    }

    // Construct pickedItemsArray based on the order's items
    // This assumes all ordered items were picked.
    // A more complex system might track partially picked quantities.
    const itemsForBackendUpdate: OrderItem[] = orderToFulfill.items.map(item => ({
        masterItemId: item.masterItemId,
        quantityOrdered: item.quantityOrdered, // Or quantityActuallyPicked if different
        quantityPicked: item.quantityOrdered, // Assuming all ordered quantity was picked
        // IMPORTANT: You need to add `pickedFromShelfId` here based on your picklist generation
        // This is where the system needs to remember which shelf an item was assigned to be picked from.
        // This info would have been part of the data used to generate the optimized route.
    }));

    setIsOrderLoading(true); setOrderError(null);
    try {
        await updateOrderStatusAPI(shopIdentifier, orderIdToMark, 'fulfilled', itemsForBackendUpdate);
        loadPendingOrders();
    } catch (err:any) { /* ... */ } finally { /* ... */ }
};
  const getItemName = (masterItemId: string) => MASTER_ITEMS_CATALOG.find(mi => mi.id === masterItemId)?.name || masterItemId;
  // --- END Order Fulfillment Logic ---


  // --- RoomLayout Core Logic (Handlers & Memoized values) ---
  const handleLogicalShelfClick = async (logicalShelfId: number, facing?: 'N'|'S'|'E'|'W') => {
    if (!shopIdentifier) { setCurrentActionError("Shop identifier not available."); return; }
    if (selectedMasterItemId) {
        const shelfToUpdate = logicalShelves.find(s => s.id === logicalShelfId);
        if (!shelfToUpdate) { setCurrentActionError(`Shelf ${logicalShelfId} not found.`); return; }
        
        const currentItem = shelfToUpdate.items.find(item => item.masterItemId === selectedMasterItemId);
        const currentQuantityOnShelf = currentItem ? currentItem.quantity : 0;
        const newQuantityForThisItem = currentQuantityOnShelf + 1; // We are adding one unit of this item

        // Check against individual item capacity on shelf if that's a rule, or total shelf capacity
        const currentTotalUnitsOnShelf = shelfToUpdate.items.reduce((sum, item) => sum + item.quantity, 0);
        const unitsBeingAdded = 1; // One click adds one unit

        if (currentTotalUnitsOnShelf + unitsBeingAdded > (shelfToUpdate.maxCapacityPerShelf || MAX_ITEMS_PER_LOGICAL_SHELF)) {
            alert(`Shelf ${logicalShelfId} is full. Max capacity: ${shelfToUpdate.maxCapacityPerShelf || MAX_ITEMS_PER_LOGICAL_SHELF}, Current: ${currentTotalUnitsOnShelf}`);
            return;
        }
        try {
            setCurrentActionError('');
            const { shelf: updatedShelfFromAPI } = await updateItemOnShelfAPI(shopIdentifier, logicalShelfId, selectedMasterItemId, newQuantityForThisItem);
            setLogicalShelves(prevShelves => prevShelves.map(s => (s.id === updatedShelfFromAPI.id ? {...s, ...updatedShelfFromAPI} : s)));
            // Optionally, re-check order stock if inventory changes affect pending orders
            if(isShopOpenForOrders) loadPendingOrders();
        } catch (err: any) { setCurrentActionError(err.message || "Failed to add item."); }
    } else {
        setSelectedLogicalShelfId(prevId => (prevId === logicalShelfId ? null : logicalShelfId));
    }
  };

  const handleCellClick = (cell: GridCellDisplayDataType) => { 
      console.log('Grid Cell Clicked:', cell.id, cell.type, cell); 
    };

  const updateShelfItemsInLayout = async (shelfId: number, updatedItemsForShelf: ShelfStoredItem[]) => {
    if (!shopIdentifier) { setCurrentActionError("Shop identifier not available."); return; }
    try {
        setCurrentActionError('');
        const { shelf: updatedShelfFromAPI } = await replaceAllItemsOnShelfAPI(shopIdentifier, shelfId, updatedItemsForShelf);
        setLogicalShelves(prevShelves => prevShelves.map(s => (s.id === updatedShelfFromAPI.id ? {...s, ...updatedShelfFromAPI} : s)));
        // Optionally, re-check order stock
        if(isShopOpenForOrders) loadPendingOrders();
        console.log(`Shelf ${shelfId} items updated via API.`);
    } catch (err: any) { setCurrentActionError(err.message || "Failed to update shelf items."); }
  };

  const handleMasterItemSelect = (itemId: string) => {
    setSelectedMasterItemId(prev => (prev === itemId ? null : itemId));
    if (selectedLogicalShelfId && itemId) setSelectedLogicalShelfId(null); // Deselect shelf if item is selected
  };

  const addLogicalShelfRow = () => {
    // This function should ideally trigger a backend update to persist layout changes.
    // For now, it only updates local state.
    console.warn("addLogicalShelfRow is local only. Implement API call for persistence.");
    if (logicalShelvesPerBlockRow <= 0) {
        setCurrentActionError("Cannot add shelf row: Room width is too small for shelves.");
        return;
    }
    const newShelvesCount = logicalShelvesPerBlockRow;
    const highestCurrentId = logicalShelves.reduce((maxId, shelf) => Math.max(maxId, shelf.id), 0);
    const newShelvesArray: ShelfType[] = Array.from({ length: newShelvesCount }, (_, i) => ({
        id: highestCurrentId + i + 1,
        items: [],
        maxCapacityPerShelf: MAX_ITEMS_PER_LOGICAL_SHELF,
        row: -1, // Will be set by layout regeneration
        col: -1, // Will be set by layout regeneration
    }));
    // Re-generate layout with new shelves to get their coordinates
    const combinedShelves = [...logicalShelves, ...newShelvesArray];
    const layoutResult = generateBackToBackLayout(combinedShelves, roomWidth, roomHeight, handleLogicalShelfClick, handleCellClick, setHoveredCellId, () => setHoveredCellId(null));
    setLogicalShelves(layoutResult.shelvesWithCoordinates);
  };

  const removeLogicalShelfRow = () => {
    // This function should ideally trigger a backend update.
    console.warn("removeLogicalShelfRow is local only. Implement API call for persistence.");
    if (logicalShelves.length === 0 || logicalShelvesPerBlockRow <= 0) {
        setCurrentActionError("No shelf rows to remove or invalid configuration.");
        return;
    }
    const shelvesToRemoveCount = Math.min(logicalShelvesPerBlockRow, logicalShelves.length);
    const remainingShelves = logicalShelves.slice(0, logicalShelves.length - shelvesToRemoveCount);
    // Re-generate layout
    const layoutResult = generateBackToBackLayout(remainingShelves, roomWidth, roomHeight, handleLogicalShelfClick, handleCellClick, setHoveredCellId, () => setHoveredCellId(null));
    setLogicalShelves(layoutResult.shelvesWithCoordinates);
  };
  
  const currentShelfBlockRows = useMemo(() => Math.max(0, Math.floor((roomHeight - 1) / 2)), [roomHeight]);
  const logicalShelvesPerBlockRow = useMemo(() => Math.max(0, roomWidth - 2) * 2, [roomWidth]); // -2 for aisles on each side
  
  const canAddShelfRow = useMemo(() => {
    if (logicalShelvesPerBlockRow <= 0) return false;
    // Calculate how many full block rows are currently represented by the shelves
    const currentFilledBlockRows = logicalShelves.length > 0 ? Math.ceil(logicalShelves.length / logicalShelvesPerBlockRow) : 0;
    return currentFilledBlockRows < currentShelfBlockRows;
  }, [logicalShelves.length, logicalShelvesPerBlockRow, currentShelfBlockRows]);

  const canRemoveShelfRow = useMemo(() => {
    return logicalShelves.length > 0 && logicalShelvesPerBlockRow > 0;
  }, [logicalShelves.length, logicalShelvesPerBlockRow]);

  const handleDisplayPathOnGrid = useCallback((pathDataFromApi: { 
    optimizedPath: {x:number,y:number}[], 
    unoptimizedPath: {x:number,y:number}[],
    metrics: any // This should include timeSavedEstimate AND pickSequenceSteps
}) => {
    setCurrentPathData({ 
        optimizedPath: pathDataFromApi.optimizedPath, 
        unoptimizedPath: pathDataFromApi.unoptimizedPath 
    });
    setOptimizationMetrics(pathDataFromApi.metrics); // << SET METRICS HERE
    setDetailedPickSequence(pathDataFromApi.metrics?.pickSequenceSteps || []); // << SET PICK SEQUENCE HERE
}, []);

  const gridDisplayCells = useMemo(() => {
    // Pass actual handlers to generateBackToBackLayout for the grid cells
    const layoutResult = generateBackToBackLayout(
        logicalShelves, roomWidth, roomHeight,
    );
    
    
    let gridToDisplay = layoutResult.gridCells;
    if (currentPathData && gridToDisplay.length > 0 && gridToDisplay[0].length > 0) {
         // Updated param name

        const newGridWithPaths = gridToDisplay.map(row => row.map(cell => ({
            ...cell, 
            isOptimalPath: false, 
            isUnoptimizedPath: false,
            isStart: false, 
            isEnd: false,
            pathSequence: undefined, // Reset sequence
            isPickLocation: false 
          })));
          const markPath = (
            pathCoords: {x:number, y:number}[], 
            pathPropertyKey: 'isOptimalPath' | 'isUnoptimizedPath',
            // pickLocationsCoords: {x:number, y:number}[] // Coords of actual pick stops
        ) => {
            let sequenceCounter = 1;
            pathCoords.forEach((coord, index) => {
                if (newGridWithPaths[coord.y]?.[coord.x]) {
                    const cellToUpdate = newGridWithPaths[coord.y][coord.x];
                    
                    if (pathPropertyKey === 'isOptimalPath') cellToUpdate.isOptimalPath = true;
                    else if (pathPropertyKey === 'isUnoptimizedPath') cellToUpdate.isUnoptimizedPath = true;
                    
                    cellToUpdate.pathSequence = sequenceCounter++;

                    // Determine if this coordinate is an actual pick location.
                    // This requires knowing the coordinates of the TSP nodes (shelf access points).
                    // The `currentPathData.metrics` or a separate part of the response from `optimizeRouteAPI`
                    // should provide the ordered list of pick locations (their access point coords)
                    // that the optimized path visits.
                    if (pathPropertyKey === 'isOptimalPath' && currentPathData.metrics?.orderedPickLocations) {
                        const isPickStop = (currentPathData.metrics.orderedPickLocations as {x:number,y:number}[]).some(
                            pickCoord => pickCoord.x === coord.x && pickCoord.y === coord.y
                        );
                        if (isPickStop) {
                            cellToUpdate.isPickLocation = true;
                        }
                    }
                    
                    if(index === 0 && !cellToUpdate.isStart) cellToUpdate.isStart = true;
                    if(index === pathCoords.length -1 && !cellToUpdate.isEnd) cellToUpdate.isEnd = true;
                }
            });
        };

        // Assuming metrics.orderedPickLocations is an array of {x,y} for actual pick stops in sequence
        if(currentPathData.unoptimizedPath && currentPathData.unoptimizedPath.length > 0) {
            markPath(currentPathData.unoptimizedPath, 'isUnoptimizedPath');
        }
        if(currentPathData.optimizedPath && currentPathData.optimizedPath.length > 0) {
            markPath(currentPathData.optimizedPath, 'isOptimalPath');
        }
        gridToDisplay = newGridWithPaths; 
    }
    return gridToDisplay;

  }, [logicalShelves, roomWidth, roomHeight, currentPathData, handleLogicalShelfClick, handleCellClick]);
  const selectedShelfInstance = selectedLogicalShelfId !== null ? logicalShelves.find(s => s.id === selectedLogicalShelfId) : null;

  // --- Conditional Rendering for Loading/Error ---
  if (isLoading && !pageError) { // Show loader only if no page error yet
    return ( <div className="min-h-screen w-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4"> <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" /> <p className="text-xl">Loading Warehouse...</p> </div> );
  }
  if (pageError) {
    return ( <div className="min-h-screen w-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 text-center"> <h2 className="text-2xl text-red-400 mb-4">Error Loading Warehouse</h2> <p className="mb-6">{pageError}</p> <button onClick={() => navigate('/create-shop')} className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-lg font-semibold"> Create New Shop </button> </div> );
  }

  // --- Main JSX ---
  const totalLogicalShelvesCount = logicalShelves.length;
  const totalStoredItemsCount = logicalShelves.reduce((sum, shelf) => sum + shelf.items.reduce((itemSum, item) => itemSum + item.quantity, 0),0);
  const maxOverallCapacityVal = totalLogicalShelvesCount * MAX_ITEMS_PER_LOGICAL_SHELF; // As per updates file

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
                <span>W:</span> <input type="number" value={roomWidth} onChange={e => setRoomWidth(Math.max(3, parseInt(e.target.value) || DEFAULT_ROOM_WIDTH_UNITS))} className="w-16 p-1 bg-gray-700 border border-gray-600 rounded" />
                <span>H:</span> <input type="number" value={roomHeight} onChange={e => setRoomHeight(Math.max(3, parseInt(e.target.value) || DEFAULT_ROOM_HEIGHT_UNITS))} className="w-16 p-1 bg-gray-700 border border-gray-600 rounded" />
            </div>
            <div className="flex items-center gap-3">
                <button onClick={removeLogicalShelfRow} className="btn-danger text-sm px-3 py-1.5" disabled={!canRemoveShelfRow}>Remove Row ({logicalShelvesPerBlockRow})</button>
                <button onClick={addLogicalShelfRow} className="btn-success text-sm px-3 py-1.5" disabled={!canAddShelfRow}>Add Row ({logicalShelvesPerBlockRow})</button>
            </div>
          </div>
          {currentActionError && <div className="text-red-400 text-sm mb-2 p-2 bg-red-900/50 rounded">{currentActionError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-300">
            <div><div className="font-semibold">Logical Shelves</div><div className="text-xl font-bold text-white">{totalLogicalShelvesCount}</div></div>
            <div><div className="font-semibold">Total Items Stored</div><div className="text-xl font-bold text-white">{totalStoredItemsCount}</div></div>
            <div><div className="font-semibold">Overall Capacity</div><div className="text-xl font-bold text-white">{maxOverallCapacityVal > 0 ? `${Math.round((totalStoredItemsCount / maxOverallCapacityVal) * 100)}%` : '0%'}</div></div>
          </div>
        </div>
        <div className="flex-1 bg-gray-800 rounded-lg shadow-lg p-1 sm:p-2 md:p-4 flex items-center justify-center overflow-auto min-h-[40vh] sm:min-h-[50vh]">
          <div className="transform scale-[0.75] sm:scale-[0.85] md:scale-[1]" style={{ width: `${roomWidth * 3}rem`, height: `${roomHeight * 3}rem`, minWidth: '250px', minHeight: '250px'}}> {/* Adjusted multiplier for cell size */}
            {(gridDisplayCells && gridDisplayCells.length > 0 && gridDisplayCells[0].length > 0) ? (
                <WarehouseFloorGrid
                    gridCells={gridDisplayCells}
                    logicalShelvesData={logicalShelves} // Pass the shelves with coordinate data
                    selectedLogicalShelfId={selectedLogicalShelfId}
                    hoveredCellId={hoveredCellId}
                    // Callbacks are now part of gridCell definition via generateBackToBackLayout
                    onShelfSlotClick={handleLogicalShelfClick}
                    onCellClick={handleCellClick}
                    onCellMouseEnter={setHoveredCellId}
                    onCellMouseLeave={() => setHoveredCellId(null)}
                />
            ) : <p className="text-slate-400">Layout not available or empty. Adjust room dimensions or add shelves.</p>}
          </div>
        </div>
      </div>

      {/* Col 3: Order Fulfillment & Shelf Details (JSX from updates file) */}
      <div className="xl:w-96 flex flex-col gap-4 order-last xl:order-none self-start shrink-0 mt-4 xl:mt-0">
      <OrderFulfillmentView
                    shopIdentifier={shopIdentifier} // From useParams
                    masterItems={MASTER_ITEMS_CATALOG}
                    logicalShelvesWithCoords={logicalShelves} // These MUST have gridX, gridY, placedFacing
                    onDisplayPath={handleDisplayPathOnGrid}
                />
  {/* NEW: Path Instructions Panel - Render when path data is available */}
  {currentPathData && optimizationMetrics && (
                    <PathInstructionsPanel 
                        pickSequenceSteps={detailedPickSequence}
                        metrics={optimizationMetrics}
                        masterItems={MASTER_ITEMS_CATALOG}
                        startPoint={currentPathData.metrics?.entryPointForPath || {x:0, y: Math.floor(roomHeight/2)}} // Get from metrics or default
                        endPoint={currentPathData.metrics?.exitPointForPath || {x:roomWidth-1, y: Math.floor(roomHeight/2)}}
                    />
                )}

        {selectedShelfInstance && ( // Using safer selectedShelfInstance
          <div className="bg-gray-800 rounded-lg shadow-lg p-4 mt-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Shelf {selectedShelfInstance.id} Details</h3>
                <button onClick={() => setSelectedLogicalShelfId(null)} className="text-gray-400 hover:text-white text-xl font-bold">×</button>
            </div>
            <div className="bg-white rounded-lg p-3 max-h-[calc(100vh-25rem)] overflow-y-auto">
                <ShelfDetailView
                    shelf={selectedShelfInstance} // Pass the instance
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

// Global CSS (e.g., in index.css or via Tailwind plugin)
/*
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .btn-primary { @apply bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-md px-4 py-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed; }
  .btn-success { @apply bg-green-600 hover:bg-green-500 text-white font-medium rounded-md transition-colors; }
  .btn-danger { @apply bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed; }
  
  // Basic Scrollbar styling for Webkit browsers
  .scrollbar-thin::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  .scrollbar-thumb-slate-600::-webkit-scrollbar-thumb {
    @apply bg-slate-600 rounded-full;
    border: 2px solid transparent; // Optional: adds padding around thumb
    background-clip: padding-box;
  }
  .scrollbar-thumb-slate-600::-webkit-scrollbar-thumb:hover {
    @apply bg-slate-500;
  }
  .scrollbar-track-slate-700\/50::-webkit-scrollbar-track {
    @apply bg-slate-700/50 rounded-full;
  }

  // For Firefox (add these if you need explicit Firefox scrollbar styling)
  .scrollbar-thin {
    scrollbar-width: thin;
    scrollbar-color: theme('colors.slate.600') theme('colors.slate.700 / 0.5'); // thumb track
  }
}
*/