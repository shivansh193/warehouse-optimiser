import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, PackagePlus, CheckCircle, AlertCircle, PlayCircle, ListOrdered, Settings2, Bot, ShoppingCart } from 'lucide-react';
import type { MasterItem, ShelfType, OrderItem, Order } from '../../interfaces/types'; // Adjust path

// --- API Service Functions (These should ideally be in a shared services/api.ts file) ---
async function generateRandomOrdersAPI(shopId: string, count: number): Promise<Order[]> {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  const response = await fetch(`${apiUrl}/api/shops/${encodeURIComponent(shopId)}/orders/generate-random?count=${count}`, { method: 'POST' });
  if (!response.ok) { const data = await response.json().catch(()=>({message: 'Failed to generate orders'})); throw new Error(data.message); }
  return response.json();
}
async function fetchPendingOrdersAPI(shopId: string): Promise<Order[]> {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  const response = await fetch(`${apiUrl}/api/shops/${encodeURIComponent(shopId)}/orders?status=pending_pick,picking,picked_partial`);
  if (!response.ok) { const data = await response.json().catch(()=>({message: 'Failed to fetch orders'})); throw new Error(data.message); }
  return response.json();
}
async function optimizeRouteAPI(shopId: string, picklist: { masterItemId: string, quantity: number, location: {x:number, y:number, shelfId: number, facing: 'N'|'S'|'E'|'W'} }[]): Promise<{ optimizedPath: {x:number,y:number}[], unoptimizedPath: {x:number,y:number}[], metrics: any }> {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/shops/${encodeURIComponent(shopId)}/optimize-pick-route`, {
        method: 'POST', headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ itemsToPick: picklist }) // Ensure body matches backend expectation
    });
    if(!response.ok) { const data = await response.json().catch(()=>({message: 'Failed to optimize route'})); throw new Error(data.message); }
    return response.json();
}
async function updateOrderStatusAPI(shopId: string, orderId: string, newStatus: Order['status'], pickedItems?: OrderItem[]): Promise<Order> {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  const response = await fetch(`${apiUrl}/api/shops/${encodeURIComponent(shopId)}/orders/${orderId}/status`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus, items: pickedItems }),
  });
  if (!response.ok) { const data = await response.json().catch(()=>({message: 'Failed to update order status'})); throw new Error(data.message); }
  return response.json();
}
// --- End API Service Functions ---

// Extended ShelfType to ensure it includes coordinate and facing info from RoomLayout
type ShelfWithPlacement = ShelfType & { gridX?: number; gridY?: number; placedFacing?: 'N' | 'S' | 'E' | 'W' };

interface OrderFulfillmentViewProps {
  shopIdentifier: string | undefined;
  masterItems: MasterItem[];
  logicalShelvesWithCoords: ShelfWithPlacement[]; // Expecting shelves with placement info
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
  const [isLoading, setIsLoading] = useState(false); // For actions within this component
  const [error, setError] = useState<string | null>(null);

  const checkOrderStock = useCallback((ordersToCheck: Order[], currentShelves: ShelfWithPlacement[]): Order[] => {
    return ordersToCheck.map(order => {
        const itemsWithStatus = order.items.map((item: OrderItem) => {
            let stockAvailable = 0;
            currentShelves.forEach(shelf => {
                const shelfItem = shelf.items.find(si => si.masterItemId === item.masterItemId);
                if (shelfItem) stockAvailable += shelfItem.quantity;
            });

            let itemLineStatus: OrderItem['status'] = 'pending'; // Default
            if (stockAvailable >= item.quantityOrdered) itemLineStatus = 'available';
            else if (stockAvailable > 0) itemLineStatus = 'partially_available';
            else itemLineStatus = 'unavailable';
            return { ...item, status: itemLineStatus, stockAvailable };
        });
        return { ...order, items: itemsWithStatus };
    });
  }, []);

  const loadPendingOrders = useCallback(async () => {
    if (!shopIdentifier) return;
    setIsLoading(true); setError(null);
    try {
      const fetchedOrders = await fetchPendingOrdersAPI(shopIdentifier);
      const ordersWithStockStatus = checkOrderStock(fetchedOrders, logicalShelvesWithCoords);
      setOrders(ordersWithStockStatus);
    } catch (err: any) { setError(err.message); setOrders([]); } 
    finally { setIsLoading(false); }
  }, [shopIdentifier, logicalShelvesWithCoords, masterItems, checkOrderStock]);

  useEffect(() => {
    if (isShopOpenForOrders && shopIdentifier) {
      loadPendingOrders();
    } else {
      setOrders([]);
      setSelectedOrderIds([]); // Clear selection when shop closes
    }
  }, [isShopOpenForOrders, shopIdentifier, loadPendingOrders]);

  const handleGenerateRandomOrders = useCallback(async (count: number) => {
    if (!shopIdentifier) { setError("Shop identifier is missing."); return; }
    setIsLoading(true); setError(null);
    try {
      await generateRandomOrdersAPI(shopIdentifier, count);
      loadPendingOrders();
    } catch (err: any) { setError(err.message); } 
    finally { setIsLoading(false); }
  }, [shopIdentifier, loadPendingOrders]);

  const handleToggleOrderSelection = useCallback((orderIdToToggle: string) => {
    setSelectedOrderIds(prev =>
      prev.includes(orderIdToToggle) ? prev.filter(id => id !== orderIdToToggle) : [...prev, orderIdToToggle]
    );
  }, []);

  
  const handleUpdateOrderStatus = useCallback(async (
    orderId: string, 
    newStatus: Order['status'], 
    // Make pickedItems optional in the handler, but required by API if status is 'fulfilled'
    itemsToDecrement?: OrderItem[] // Use your OrderItemType here
  ) => {
    if (!shopIdentifier || !orderId) {
      setError("Shop Identifier or Order ID is missing.");
      return;
    }
    setIsLoading(true); // Use the component's isLoading or a specific one

    try {
      // Pass itemsToDecrement only if the status is 'fulfilled' and items are provided
      const itemsPayload = (newStatus === 'fulfilled' && itemsToDecrement) ? itemsToDecrement : undefined;
      await updateOrderStatusAPI(shopIdentifier, orderId, newStatus, itemsPayload);
      await loadPendingOrders(); // Refresh the list after status update
    } catch (err: any) {
      console.log(`Failed to update order ${orderId} to ${newStatus}: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [shopIdentifier, loadPendingOrders]); // loadPendingOrders should be memoized

  const handleMarkOrderFulfilled = useCallback(async (orderIdToMark: string) => {
    if (!shopIdentifier) {
      setError("Shop identifier not available.");
      return;
    }

    // Find the order in the local 'orders' state to get its items
    const orderToFulfill = orders.find(o => o._id === orderIdToMark);
    if (!orderToFulfill) {
      console.log(`Order ${orderIdToMark} not found locally to mark as fulfilled.`);
      return;
    }

    // Prepare the `pickedItemsArray` for the backend.
    // This should represent the items *as they were in the order*.
    // If you have a concept of "actually picked quantity" vs "ordered quantity"
    // due to stock issues during picking, you'd use the "actually picked quantity".
    // For now, assuming we fulfill what was ordered if status was 'picked_full' or 'picked_partial'.
    const itemsForInventoryDecrement: OrderItem[] = orderToFulfill.items.map((item: OrderItem) => ({
      masterItemId: item.masterItemId,
      quantityOrdered: item.quantityOrdered, // Original ordered quantity
      quantityPicked: item.quantityOrdered,  // For decrement, assume all ordered quantity was picked.
                                             // If you track partial picks, use that value.
      // IMPORTANT: If your backend inventory decrement needs to know *which shelf* an item
      // was picked from (for precise shelf-level inventory), you need to have stored
      // this information during the `handleStartFulfilling` phase or derive it.
      // For now, backend will just decrement from any shelf that has the item.
      // pickedFromShelfId: item.pickedFromShelfId, // Example if you store this
    }));
    
    // Call the generic status update handler, now passing the items
    await handleUpdateOrderStatus(orderIdToMark, 'fulfilled', itemsForInventoryDecrement);

  }, [shopIdentifier, orders, handleUpdateOrderStatus]); // `orders` is needed to find the items

  const handleMarkOrderPicked = useCallback(async (orderId: string) => {
    if (!shopIdentifier) return;
    // This transitions the order from 'picking' to 'picked_full'.
    // A more advanced implementation could handle partial picks.
    await handleUpdateOrderStatus(orderId, 'picked_full');
  }, [shopIdentifier, handleUpdateOrderStatus]);

  const handleStartFulfilling = useCallback(async () => {
    if (!shopIdentifier || selectedOrderIds.length === 0) return;
    setError(null); setIsLoading(true);
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
        
        logicalShelvesWithCoords.forEach(shelf => {
            const stockItem = shelf.items.find(si => si.masterItemId === item.masterItemId);
            if (stockItem && stockItem.quantity > 0 && 
                typeof shelf.gridX === 'number' && 
                typeof shelf.gridY === 'number' &&
                shelf.placedFacing) { 
                
                // Simple: if this shelf has the item, add its location.
                // Does not consider picking partial quantity from this shelf yet if one shelf is not enough.
                if(!itemShelfLocations.find(loc => loc.shelfId === shelf.id)){ 
                     itemShelfLocations.push({ 
                         shelfId: shelf.id, 
                         x: shelf.gridX, 
                         y: shelf.gridY,
                         facing: shelf.placedFacing 
                     });
                }
            }
        });

        if(itemShelfLocations.length > 0){
            const existingEntry = picklistMap.get(item.masterItemId);
            const currentPickQuantity = existingEntry?.quantity || 0;
            // Ensure we don't add more than needed if item appears in multiple orders
            const neededForThisItem = quantityToPick; 
            const alreadyPickedForThisItem = currentPickQuantity;
            const canAddMore = neededForThisItem - alreadyPickedForThisItem;

            if (canAddMore > 0) {
                 picklistMap.set(item.masterItemId, {
                    quantity: currentPickQuantity + canAddMore, // This logic might need to be more robust for multi-order consolidation
                    // For now, use the first valid location found.
                    // Backend's A* will path to the access point of this shelf_block (x,y) from the given facing.
                    locations: existingEntry?.locations || [itemShelfLocations[0]] 
                });
            }
        } else { 
            console.warn(`No grid location/facing for ${item.masterItemId} or item out of stock.`);
        }
      });
    });

    const picklistForAPI = Array.from(picklistMap.entries())
        .filter(([, data]) => data.locations.length > 0 && data.quantity > 0)
        .map(([masterItemId, data]) => ({ 
            masterItemId, 
            quantity: data.quantity, 
            location: data.locations[0] // Contains x, y, shelfId, facing
        }));

    if(picklistForAPI.length === 0){ setError("No available items in selected orders to create picklist."); setIsLoading(false); return; }

    try {
      const pathResult = await optimizeRouteAPI(shopIdentifier, picklistForAPI);
      onDisplayPath(pathResult); // Callback to parent (RoomLayout) to draw paths
      
      const orderUpdatePromises = selectedOrderIds.map(id => handleUpdateOrderStatus(id, 'picking')); // Use the memoized handler
      await Promise.all(orderUpdatePromises);
      // loadPendingOrders(); // Not strictly needed if handleUpdateOrderStatus refreshes
      setSelectedOrderIds([]);
    } catch (err: any) { setError(err.message); } 
    finally { setIsLoading(false); }
  }, [shopIdentifier, selectedOrderIds, orders, logicalShelvesWithCoords, masterItems, onDisplayPath, loadPendingOrders, handleUpdateOrderStatus]);
  
  const getItemName = useCallback((masterItemId: string) => masterItems.find(mi => mi.id === masterItemId)?.name || masterItemId, [masterItems]);

  return (
    <div className="bg-slate-800/60 backdrop-blur-md rounded-xl shadow-xl border border-slate-700/50 p-4 h-full flex flex-col text-slate-200">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700">
            <h3 className="text-xl font-semibold text-white flex items-center gap-2"><ShoppingCart className="w-5 h-5"/> Order Fulfillment</h3>
            <button
            onClick={() => setIsShopOpenForOrders(prev => !prev)}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors text-xs ${isShopOpenForOrders ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white flex items-center gap-1`}
            >
            {isShopOpenForOrders ? <><Settings2 className="w-4 h-4"/>Close Orders</> : <><PlayCircle className="w-4 h-4"/>Open Orders</>}
            </button>
        </div>

        {isShopOpenForOrders ? (
            <>
            <div className="mb-4 flex flex-wrap gap-2">
                <button onClick={() => handleGenerateRandomOrders(1)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1" disabled={isLoading}><PackagePlus className="w-3 h-3"/>Gen 1 Order</button>
                <button onClick={() => handleGenerateRandomOrders(10)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1" disabled={isLoading}><PackagePlus className="w-3 h-3"/>Gen 10 Orders</button>
                {/* TODO: Add Custom Order Button & Modal */}
            </div>

            {isLoading && <div className="text-center p-4"><Loader2 className="w-6 h-6 animate-spin text-cyan-400 mx-auto"/></div>}
            {error && <div className="p-2 bg-red-700/30 text-red-300 rounded-md mb-3 text-xs break-words">{error}</div>}
            
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-700/50 mb-3">
                {orders.length === 0 && !isLoading && <p className="text-slate-400 text-sm text-center py-6">No pending orders.</p>}
                {orders.map(order => (
                <div key={order._id || order.orderNumber} className={`p-2.5 rounded-lg border text-sm transition-all ${order._id && selectedOrderIds.includes(order._id) ? 'bg-slate-700 border-cyan-500 shadow-md' : 'bg-slate-700/40 border-slate-600 hover:border-slate-500'}`}>
                    <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                        <input type="checkbox" checked={!!(order._id && selectedOrderIds.includes(order._id))} onChange={() => order._id && handleToggleOrderSelection(order._id)}
                            className="form-checkbox h-4 w-4 text-cyan-500 bg-slate-600 border-slate-500 rounded focus:ring-cyan-400 shrink-0"
                            disabled={!order._id || order.status === 'fulfilled' || order.status === 'picking' || isLoading} // Disable if already processing or fulfilled
                        />
                        <h4 className="font-semibold text-white truncate max-w-[100px] sm:max-w-[120px]" title={`Order #${order.orderNumber}`}>Order #{order.orderNumber.slice(-6)}</h4> {/* Show last 6 digits */}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap
                            ${order.status === 'pending_pick' ? 'bg-yellow-500/20 text-yellow-300' : 
                            order.status === 'picking' ? 'bg-blue-500/20 text-blue-300' :
                            order.status === 'picked_full' ? 'bg-green-500/20 text-green-300' :
                            order.status === 'picked_partial' ? 'bg-orange-500/20 text-orange-300' :
                            order.status === 'fulfilled' ? 'bg-purple-500/20 text-purple-300' :
                            'bg-slate-500/20 text-slate-300'}`}>
                            {order.status.replace(/_/g, ' ')}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        {(order.status === 'picked_full' || order.status === 'picked_partial') && order._id && (
                            <button onClick={() => order._id && handleMarkOrderFulfilled(order._id)} className="btn-success text-[10px] px-1.5 py-0.5 flex items-center gap-1" disabled={isLoading || !order._id}><CheckCircle className="w-3 h-3"/>Mark Fulfilled</button>
                        )}
                        {order.status === 'picking' && order._id && (
                            <button onClick={() => order._id && handleMarkOrderPicked(order._id)} className="btn-primary text-[10px] px-1.5 py-0.5 flex items-center gap-1" disabled={isLoading || !order._id}><CheckCircle className="w-3 h-3"/>Mark as Picked</button>
                        )}
                    </div>
                    </div>
                    <ul className="space-y-0.5 text-xs pl-6">
                    {order.items.map((item, idx) => (
                        <li key={`${order._id || order.orderNumber}-item-${idx}`} className="flex items-center justify-between text-slate-300">
                            <span className="truncate max-w-[150px]" title={`${getItemName(item.masterItemId)} x ${item.quantityOrdered}`}>{getItemName(item.masterItemId)} x {item.quantityOrdered}</span>
                            {item.status === 'available' && <CheckCircle className="w-3 h-3 text-green-400 shrink-0" title="In Stock"/>}
                            {item.status === 'partially_available' && <AlertCircle className="w-3 h-3 text-yellow-400 shrink-0" title={`Only ${item.stockAvailable || 0} in stock`}/>}
                            {item.status === 'unavailable' && <AlertCircle className="w-3 h-3 text-red-400 shrink-0" title="Out of stock"/>}
                        </li>
                    ))}
                    </ul>
                </div>
                ))}
            </div>

            {selectedOrderIds.length > 0 && (
                <div className="mt-auto pt-3 border-t border-slate-700">
                <button onClick={handleStartFulfilling} 
                    disabled={isLoading || !logicalShelvesWithCoords.some(s => typeof s.gridX === 'number')}
                    className="w-full btn-primary py-2 text-sm flex items-center justify-center gap-1.5">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Bot className="w-4 h-4"/>} 
                    Start Fulfilling ({selectedOrderIds.length})
                </button>
                </div>
            )}
            </>
        ) : (
            <div className="text-center py-10 flex-1 flex flex-col items-center justify-center">
            <ListOrdered className="w-12 h-12 text-slate-600 mx-auto mb-3"/>
            <p className="text-slate-400">Shop is currently closed for orders.</p>
            <p className="text-xs text-slate-500">Click "Open Orders" to begin.</p>
            </div>
        )}
    </div>
  );
};
export default OrderFulfillmentView;