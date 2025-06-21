import React, { useState, useEffect } from 'react';
import { Loader2, PackagePlus, CheckCircle, AlertCircle, PlayCircle, ListOrdered, Settings2, Bot } from 'lucide-react';
import type { MasterItem, ShelfType, OrderItem, Order } from '../../interfaces/types'; // Adjust path

// --- API Service Functions (can be moved to a shared services/api.ts later) ---
async function generateRandomOrdersAPI(shopId: string, count: number): Promise<Order[]> {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  const response = await fetch(`${apiUrl}/api/shops/${encodeURIComponent(shopId)}/orders/generate-random?count=${count}`, { method: 'POST' });
  if (!response.ok) { const data = await response.json().catch(()=>({})); throw new Error(data.message || 'Failed to generate random orders'); }
  return response.json();
}
async function fetchPendingOrdersAPI(shopId: string): Promise<Order[]> {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  const response = await fetch(`${apiUrl}/api/shops/${encodeURIComponent(shopId)}/orders?status=pending_pick,picking,picked_partial`);
  if (!response.ok) { const data = await response.json().catch(()=>({})); throw new Error(data.message || 'Failed to fetch orders'); }
  return response.json();
}
async function optimizeRouteAPI(shopId: string, picklist: { masterItemId: string, quantity: number, location: {x:number, y:number, shelfId: number} }[]): Promise<{ optimizedPath: {x:number,y:number}[], unoptimizedPath: {x:number,y:number}[], metrics: any }> {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/shops/${encodeURIComponent(shopId)}/optimize-pick-route`, {
        method: 'POST', headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ itemsToPick: picklist })
    });
    if(!response.ok) { const data = await response.json().catch(()=>({})); throw new Error(data.message || 'Failed to optimize route'); }
    return response.json();
}
async function updateOrderStatusAPI(shopId: string, orderId: string, newStatus: Order['status'], pickedItems?: OrderItem[]): Promise<Order> {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  const response = await fetch(`${apiUrl}/api/shops/${encodeURIComponent(shopId)}/orders/${orderId}/status`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus, items: pickedItems }),
  });
  if (!response.ok) { const data = await response.json().catch(()=>({})); throw new Error(data.message || 'Failed to update order status');}
  return response.json();
}
// --- End API Service Functions ---

interface OrderFulfillmentViewProps {
  shopIdentifier: string | undefined;
  masterItems: MasterItem[];
  logicalShelvesWithCoords: (ShelfType & { gridX?: number; gridY?: number })[];
  onDisplayPath: (pathData: { optimizedPath: {x:number,y:number}[], unoptimizedPath: {x:number,y:number}[], metrics: any }) => void;
}

const OrderFulfillmentView: React.FC<OrderFulfillmentViewProps> = ({
  shopIdentifier,
  masterItems,
  logicalShelvesWithCoords,
  onDisplayPath,
}) => {
  const [isShopOpenForOrders, setIsShopOpenForOrders] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isShopOpenForOrders && shopIdentifier) {
      loadPendingOrders();
    } else {
      setOrders([]);
    }
  }, [isShopOpenForOrders, shopIdentifier]); // Re-fetch if shopIdentifier changes while open

  const loadPendingOrders = async () => {
    if (!shopIdentifier) return;
    setIsLoading(true); setError(null);
    try {
      const fetchedOrders = await fetchPendingOrdersAPI(shopIdentifier);
      const ordersWithStockStatus = checkOrderStock(fetchedOrders, logicalShelvesWithCoords, masterItems);
      setOrders(ordersWithStockStatus);
    } catch (err: any) { setError(err.message); } 
    finally { setIsLoading(false); }
  };

  const handleGenerateRandomOrders = async (count: number) => {
    if (!shopIdentifier) return;
    setIsLoading(true); setError(null);
    try {
      await generateRandomOrdersAPI(shopIdentifier, count);
      loadPendingOrders();
    } catch (err: any) { setError(err.message); } 
    finally { setIsLoading(false); }
  };

  const checkOrderStock = (ordersToCheck: Order[], currentShelves: (ShelfType & { gridX?: number; gridY?: number })[], catalog: MasterItem[]): Order[] => {
     return ordersToCheck.map(order => {
         let orderFullyAvailable = true;
         const itemsWithStatus = order.items.map(item => {
             const stockAvailable = currentShelves.reduce((total, shelf) => {
                 const shelfItem = shelf.items.find(si => si.masterItemId === item.masterItemId);
                 return total + (shelfItem ? shelfItem.quantity : 0);
             }, 0);

             let itemLineStatus: OrderItem['status'] = 'pending';
             if (stockAvailable >= item.quantityOrdered) {
                 itemLineStatus = 'available';
             } else if (stockAvailable > 0) {
                 itemLineStatus = 'partially_available';
                 orderFullyAvailable = false;
             } else {
                 itemLineStatus = 'unavailable';
                 orderFullyAvailable = false;
             }
             return { ...item, status: itemLineStatus, stockAvailable };
         });
         // You might want to update a display status on the order based on `orderFullyAvailable`
         return { ...order, items: itemsWithStatus };
     });
 };


  const handleToggleOrderSelection = (orderId: string) => { /* ... same ... */ };

  const handleStartFulfilling = async () => {
    if (!shopIdentifier || selectedOrderIds.length === 0) return;
    setError(null); setIsLoading(true);
    const ordersToFulfill = orders.filter(o => selectedOrderIds.includes(o._id!));
    
    const picklistMap = new Map<string, { quantity: number, locations: {shelfId: number, x:number, y:number}[] }>();
    ordersToFulfill.forEach(order => {
      order.items.forEach(item => {
        if (item.status === 'unavailable') return; // Skip unavailable items

        let quantityToPick = item.quantityOrdered;
        if (item.status === 'partially_available' && item.stockAvailable !== undefined) {
            quantityToPick = Math.min(item.quantityOrdered, item.stockAvailable);
        }
        
        const itemLocations: {shelfId: number, x:number, y:number}[] = [];
        let assignedQuantity = 0;

        // Find locations and stock for this masterItem
        for (const shelf of logicalShelvesWithCoords) {
            if (assignedQuantity >= quantityToPick) break; // Already found enough for this picklist line item

            const stockItem = shelf.items.find(si => si.masterItemId === item.masterItemId);
            if (stockItem && stockItem.quantity > 0 && shelf.gridX !== undefined && shelf.gridY !== undefined) {
                const canTakeFromThisShelf = Math.min(stockItem.quantity, quantityToPick - assignedQuantity);
                if (canTakeFromThisShelf > 0) {
                    // For simplicity, add the location for each unit, or aggregate later
                    // For now, just taking the first valid location found for the item type
                    if(!itemLocations.find(loc => loc.shelfId === shelf.id)){
                        itemLocations.push({ shelfId: shelf.id, x: shelf.gridX, y: shelf.gridY });
                    }
                    // More complex logic would be needed if an item is spread across shelves and
                    // the optimizer needs to visit multiple shelves for one masterItemId.
                    // For now, the picklist sends total quantity and ONE location.
                }
            }
        }

        if(itemLocations.length > 0){ // Only add to picklist if we found a location
             const existing = picklistMap.get(item.masterItemId);
             picklistMap.set(item.masterItemId, {
             quantity: (existing?.quantity || 0) + quantityToPick,
             // Simplistic: use the first location found. Realistically, the optimizer
             // might need all locations if an item is on multiple shelves.
             locations: existing?.locations || itemLocations.length > 0 ? [itemLocations[0]] : [] 
             });
        } else if (quantityToPick > 0) {
            console.warn(`No location found for ${item.masterItemId} with available stock.`);
        }

      });
    });

    const picklistForAPI = Array.from(picklistMap.entries())
      .filter(([, data]) => data.locations.length > 0) // Ensure location exists
      .map(([masterItemId, data]) => ({
          masterItemId,
          quantity: data.quantity,
          location: data.locations[0] // Pass shelfId too
      }));

     if(picklistForAPI.length === 0){
         setError("No available items in selected orders to generate a route.");
         setIsLoading(false);
         return;
     }

    try {
      const pathResult = await optimizeRouteAPI(shopIdentifier, picklistForAPI);
      onDisplayPath(pathResult);
      selectedOrderIds.forEach(id => handleUpdateOrderStatus(id, 'picking'));
      setSelectedOrderIds([]);
    } catch (err: any) { setError(err.message); } 
    finally { setIsLoading(false); }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: Order['status']) => { /* ... same ... */ };
  const getItemName = (masterItemId: string) => masterItems.find(mi => mi.id === masterItemId)?.name || masterItemId;

  // --- JSX for OrderFulfillmentView ---
  return (
     <div className="bg-slate-800/60 backdrop-blur-md rounded-xl shadow-xl border border-slate-700/50 p-4 h-full flex flex-col text-slate-200">
         {/* ... The exact same JSX structure as in the previous OrderFulfillmentView example ... */}
         {/* Including "Open for Orders" button, generate buttons, order list, "Start Fulfilling" button */}
         {/* This is just a placeholder to show where it goes */}
         <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700">
             <h2 className="text-xl font-semibold text-white">Order Fulfillment</h2>
             <button onClick={() => setIsShopOpenForOrders(prev => !prev)} className={`px-3 py-1.5 rounded-md font-medium transition-colors text-xs ${isShopOpenForOrders ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white`}>
             {isShopOpenForOrders ? <><Settings2 className="inline w-4 h-4 mr-1"/>Close Orders</> : <><PlayCircle className="inline w-4 h-4 mr-1"/>Open Orders</>}
             </button>
         </div>

         {isShopOpenForOrders ? ( /* ... render order list and controls ... */ <p className="text-sm text-center p-4">Order controls would appear here.</p> )
          : ( /* ... render "Shop is closed" message ... */ <p className="text-sm text-center p-4">Shop is closed for orders.</p> )
         }
     </div>
  );
};
export default OrderFulfillmentView;