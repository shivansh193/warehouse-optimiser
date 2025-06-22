// controllers/shopController.js
const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb'); // To work with MongoDB's _id
const { findPathAStar } = require('../utils/pathfinding');

const SHOPS_COLLECTION = 'shops'; // Define collection name
const DEFAULT_WAREHOUSE_WIDTH = 7; 
const DEFAULT_WAREHOUSE_HEIGHT = 7;
// @desc    Create a new shop
// @route   POST /api/shops
// @access  Public
const createShop = async (req, res) => {
  const { shopName, initialShelvesCount = 21, shelvesPerRow = 3 } = req.body;

  if (!shopName) {
    return res.status(400).json({ message: 'Shop name is required' });
  }

  try {
    const db = getDB();
    const shopsCollection = db.collection(SHOPS_COLLECTION);

    const shopExists = await shopsCollection.findOne({ shopName });
    if (shopExists) {
      return res.status(400).json({ message: 'Shop with this name already exists' });
    }

    // Prepare initial shelves (manual structure)
    const shelves = [];
    if (initialShelvesCount > 0) {
        for (let i = 1; i <= initialShelvesCount; i++) {
            shelves.push({
                shelfNumber: i,
                items: [], // Start with empty items array
                row: Math.floor((i - 1) / shelvesPerRow),
                col: (i - 1) % shelvesPerRow,
                maxCapacityPerShelf: 96
            });
        }
    }

    const newShopDocument = {
      shopName,
      shelves,
      createdAt: new Date(),
      updatedAt: new Date() // Manually manage timestamps
    };

    const result = await shopsCollection.insertOne(newShopDocument);

    if (result.insertedId) {
        // Fetch the inserted document to return it (optional, but good practice)
        const createdShop = await shopsCollection.findOne({ _id: result.insertedId });
        res.status(201).json(createdShop);
    } else {
        throw new Error('Shop creation failed, no document inserted.');
    }

  } catch (error) {
    console.error('Error creating shop:', error);
    // Note: The native driver doesn't have the same error.code for duplicates as Mongoose by default
    // You might need more specific error handling or unique indexes on MongoDB side
    if (error.message.includes('duplicate key')) { // Basic check
        return res.status(400).json({ message: 'Shop with this name already exists (duplicate key).' });
    }
    res.status(500).json({ message: 'Server error while creating shop', error: error.message });
  }
};

// @desc    Get shop details by ID or Name
// @route   GET /api/shops/:identifier
// @access  Public
const getShop = async (req, res) => {
    try {
        const db = getDB();
        const shopsCollection = db.collection(SHOPS_COLLECTION);
        const { identifier } = req.params;
        let query;

        // Check if identifier is likely an ObjectId string
        if (ObjectId.isValid(identifier)) {
            query = { _id: new ObjectId(identifier) };
        } else {
            query = { shopName: identifier };
        }
        
        const shop = await shopsCollection.findOne(query);

        if (shop) {
            res.json(shop);
        } else {
            res.status(404).json({ message: 'Shop not found' });
        }
    } catch (error) {
        console.error('Error fetching shop:', error);
        res.status(500).json({ message: 'Server error fetching shop', error: error.message });
    }
};
const updateItemOnShelf = async (req, res) => {
    const { shopIdentifier, logicalShelfId } = req.params;
    const { masterItemId, quantity } = req.body; // quantity is the NEW desired quantity for this item
  
    if (!masterItemId || quantity === undefined || quantity < 0) {
      return res.status(400).json({ message: 'Master Item ID and valid quantity (>=0) are required.' });
    }
  
    try {
      let shop;
      // Find shop by name or _id
      if (mongoose.Types.ObjectId.isValid(shopIdentifier)) {
          shop = await Shop.findById(shopIdentifier);
      } else {
          shop = await Shop.findOne({ shopName: shopIdentifier });
      }
  
      if (!shop) {
        return res.status(404).json({ message: 'Shop not found' });
      }
  
      // Find the specific logical shelf within the shop's shelves array
      // We stored the frontend's logical shelf.id as shelf.shelfNumber in the DB schema
      const shelfToUpdate = shop.shelves.find(s => s.shelfNumber === parseInt(logicalShelfId));
  
      if (!shelfToUpdate) {
        return res.status(404).json({ message: `Shelf with ID ${logicalShelfId} not found in this shop` });
      }
  
      // --- Update items on the shelf ---
      const existingItemIndex = shelfToUpdate.items.findIndex(item => item.masterItemId === masterItemId);
  
      if (quantity === 0) { // If new quantity is 0, remove the item
        if (existingItemIndex > -1) {
          shelfToUpdate.items.splice(existingItemIndex, 1);
        }
        // If item wasn't there and quantity is 0, do nothing
      } else { // Add or update item
        if (existingItemIndex > -1) {
          // Update existing item's quantity
          shelfToUpdate.items[existingItemIndex].quantity = quantity;
        } else {
          // Add new item if it doesn't exist
          // You might want to check total shelf capacity here before adding
          const totalQuantityOnShelf = shelfToUpdate.items.reduce((sum, item) => sum + item.quantity, 0);
          if (totalQuantityOnShelf + quantity > (shelfToUpdate.maxCapacityPerShelf || 96)) {
              return res.status(400).json({ message: 'Adding item exceeds shelf capacity.' });
          }
          shelfToUpdate.items.push({ masterItemId, quantity });
        }
      }
      
      shop.markModified('shelves'); // Important for Mongoose to detect changes in nested arrays/objects
      await shop.save();
  
      // Respond with the updated shelf or the whole shop
      // For simplicity, let's find and return the updated shelf's representation
      const updatedShelfInDb = shop.shelves.find(s => s.shelfNumber === parseInt(logicalShelfId));
      
      // Convert DB items back to frontend format if they differ (they do in my schema example)
      const frontendShelfFormat = {
          id: updatedShelfInDb.shelfNumber,
          items: updatedShelfInDb.items.map(item => ({ masterItemId: item.masterItemId, quantity: item.quantity })),
          row: updatedShelfInDb.row, // these might be -1 if not used for direct rendering
          col: updatedShelfInDb.col,
          maxCapacityPerShelf: updatedShelfInDb.maxCapacityPerShelf
      };
  
      res.status(200).json({ message: 'Shelf updated successfully', shelf: frontendShelfFormat });
  
    } catch (error) {
      console.error('Error updating item on shelf:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  };
  const replaceAllItemsOnShelf = async (req, res) => {
    const { shopIdentifier, logicalShelfId: logicalShelfIdStr } = req.params;
    const { items: newItemsArray } = req.body; // Expects an array: [{ masterItemId: 'SKU', quantity: 5 }, ...]
    const logicalShelfId = parseInt(logicalShelfIdStr);
  
    if (!Array.isArray(newItemsArray)) {
      return res.status(400).json({ message: 'Request body must contain an "items" array.' });
    }
  
    // Optional: Validate items in newItemsArray
    for (const item of newItemsArray) {
      if (!item.masterItemId || item.quantity === undefined || item.quantity < 0) {
        return res.status(400).json({ message: 'Each item in the array must have masterItemId and valid quantity (>=0).' });
      }
    }
  
    try {
      const db = getDB();
      const shopsCollection = db.collection(SHOPS_COLLECTION);
      let shopQuery;
  
      if (ObjectId.isValid(shopIdentifier)) {
          shopQuery = { _id: new ObjectId(shopIdentifier) };
      } else {
          shopQuery = { shopName: shopIdentifier };
      }
  
      const shop = await shopsCollection.findOne(shopQuery);
  
      if (!shop) {
        return res.status(404).json({ message: 'Shop not found' });
      }
  
      const shelfToUpdate = shop.shelves.find(s => s.shelfNumber === logicalShelfId);
  
      if (!shelfToUpdate) {
        return res.status(404).json({ message: `Shelf with ID ${logicalShelfId} not found in this shop` });
      }
  
      // Capacity check for the new set of items
      const totalNewQuantity = newItemsArray.reduce((sum, item) => sum + item.quantity, 0);
      if (totalNewQuantity > (shelfToUpdate.maxCapacityPerShelf || 96)) {
          return res.status(400).json({ message: 'New items exceed shelf capacity.' });
      }
  
      // Prepare the update operation for MongoDB
      // We want to update a specific element in the 'shelves' array.
      // The filter identifies the shop and the specific shelf within the array.
      // The update sets the 'items' field of that matched shelf element.
      const updateResult = await shopsCollection.updateOne(
        { ...shopQuery, "shelves.shelfNumber": logicalShelfId }, // Filter to find the shop and the specific shelf
        { $set: { "shelves.$.items": newItemsArray, "shelves.$.updatedAt": new Date(), "updatedAt": new Date() } } // Update items of the matched shelf ($)
      );
  
      if (updateResult.matchedCount === 0) {
          return res.status(404).json({ message: 'Shop or shelf not found for update.' });
      }
      if (updateResult.modifiedCount === 0) {
          // This could mean the items were already the same, or something else prevented modification.
          // For simplicity, we can treat it as a success if matched.
          console.log(`Shelf ${logicalShelfId} items were not modified, possibly same content.`);
      }
  
      // Fetch the updated shelf data to return (or the whole shop and extract)
      const updatedShop = await shopsCollection.findOne(shopQuery);
      const finalUpdatedShelf = updatedShop.shelves.find(s => s.shelfNumber === logicalShelfId);
      
      // Format for frontend
      const frontendShelfFormat = {
          id: finalUpdatedShelf.shelfNumber,
          items: finalUpdatedShelf.items.map(item => ({ masterItemId: item.masterItemId, quantity: item.quantity })),
          row: finalUpdatedShelf.row,
          col: finalUpdatedShelf.col,
          maxCapacityPerShelf: finalUpdatedShelf.maxCapacityPerShelf
      };
      
      res.status(200).json({ message: 'Shelf items replaced successfully', shelf: frontendShelfFormat });
  
    } catch (error) {
      console.error('Error replacing items on shelf:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  };
  
  const ORDERS_COLLECTION = 'orders'; // Define a new collection for orders
  const MASTER_ITEMS_CATALOG_BACKEND = [ // Backend needs its own knowledge of items for random generation
    { id: 'SKU001', name: 'Red Box' },
    { id: 'SKU002', name: 'Blue Cyl' },
    { id: 'SKU003', name: 'Green Cube' },
    { id: 'SKU004', name: 'Ylw Sphr' },
    { id: 'SKU005', name: 'Prpl Pyra' },
  ];
  
  // --- NEW CONTROLLER FUNCTIONS FOR ORDERS ---
  
  // @desc    Generate Random Orders for a Shop
  // @route   POST /api/shops/:shopIdentifier/orders/generate-random
  // @access  Public
  const generateRandomOrders = async (req, res) => {
      const { shopIdentifier } = req.params;
      const count = parseInt(req.query.count) || 1; // Get count from query param, default to 1
  
      if (isNaN(count) || count <= 0 || count > 50) { // Limit max generation
          return res.status(400).json({ message: 'Invalid count parameter. Must be between 1 and 50.' });
      }
  
      try {
          const db = getDB();
          const shopsCollection = db.collection(SHOPS_COLLECTION);
          const ordersCollection = db.collection(ORDERS_COLLECTION);
          let shopObjectId;
  
          // Find the shop to link orders to
          let shopQuery;
          if (ObjectId.isValid(shopIdentifier)) {
              shopObjectId = new ObjectId(shopIdentifier);
              shopQuery = { _id: shopObjectId };
          } else {
              const foundShop = await shopsCollection.findOne({ shopName: shopIdentifier });
              if (!foundShop) return res.status(404).json({ message: 'Shop not found by name' });
              shopObjectId = foundShop._id;
              shopQuery = { _id: shopObjectId }; // Use _id for consistency if found by name
          }
          
          const shopExists = await shopsCollection.findOne(shopQuery);
          if (!shopExists) {
              return res.status(404).json({ message: 'Shop not found' });
          }
  
          const generatedOrders = [];
          for (let i = 0; i < count; i++) {
              const numItemsInOrder = Math.floor(Math.random() * 9) + 2; // 2 to 10 items
              const orderItems = [];
              const usedSkus = new Set();
  
              for (let j = 0; j < numItemsInOrder; j++) {
                  let randomItem;
                  do { // Ensure unique SKUs per order for this simple generator
                      randomItem = MASTER_ITEMS_CATALOG_BACKEND[Math.floor(Math.random() * MASTER_ITEMS_CATALOG_BACKEND.length)];
                  } while (usedSkus.has(randomItem.id) && usedSkus.size < MASTER_ITEMS_CATALOG_BACKEND.length);
                  
                  if (!usedSkus.has(randomItem.id)) {
                      usedSkus.add(randomItem.id);
                      orderItems.push({
                          masterItemId: randomItem.id,
                          quantityOrdered: Math.floor(Math.random() * 3) + 1, // 1 to 3 quantity
                      });
                  }
              }
              
              if(orderItems.length > 0) { // Only create order if items were added
                  const newOrder = {
                      shopId: shopObjectId, // Link to the shop
                      orderNumber: `ORD-${Date.now()}-${Math.floor(Math.random()*1000)}`, // Simple unique order number
                      items: orderItems,
                      status: 'pending_pick',
                      createdAt: new Date(),
                      updatedAt: new Date(),
                  };
                  generatedOrders.push(newOrder);
              }
          }
  
          if (generatedOrders.length > 0) {
              const insertResult = await ordersCollection.insertMany(generatedOrders);
              // Fetch the inserted documents to return them with their _id
              const createdOrders = await ordersCollection.find({ _id: { $in: Object.values(insertResult.insertedIds) } }).toArray();
              res.status(201).json(createdOrders);
          } else {
              res.status(200).json({ message: 'No orders generated (perhaps constraints too tight or catalog empty).' });
          }
  
      } catch (error) {
          console.error('Error generating random orders:', error);
          res.status(500).json({ message: 'Server error', error: error.message });
      }
  };
  
  
  // @desc    Get Orders for a Shop (can filter by status)
  // @route   GET /api/shops/:shopIdentifier/orders
  // @access  Public
  const getPendingOrders = async (req, res) => {
      const { shopIdentifier } = req.params;
      const statusQuery = req.query.status; // e.g., "pending_pick,picking"
  
      try {
          const db = getDB();
          const shopsCollection = db.collection(SHOPS_COLLECTION);
          const ordersCollection = db.collection(ORDERS_COLLECTION);
          let shopObjectId;
  
          let shopQuery;
          if (ObjectId.isValid(shopIdentifier)) {
              shopObjectId = new ObjectId(shopIdentifier);
              shopQuery = { _id: shopObjectId };
          } else {
              const foundShop = await shopsCollection.findOne({ shopName: shopIdentifier });
              if (!foundShop) return res.status(404).json({ message: 'Shop not found by name' });
              shopObjectId = foundShop._id;
          }
  
          const orderFilter = { shopId: shopObjectId };
          if (statusQuery) {
              orderFilter.status = { $in: statusQuery.split(',') };
          }
  
          const orders = await ordersCollection.find(orderFilter).sort({ createdAt: -1 }).toArray(); // Sort by newest first
          res.json(orders);
  
      } catch (error) {
          console.error('Error fetching orders:', error);
          res.status(500).json({ message: 'Server error', error: error.message });
      }
  };
  
  
  // @desc    Optimize Pick Route (Placeholder - Implement actual algorithm here)
  // @route   POST /api/shops/:shopIdentifier/optimize-pick-route
  // @access  Public
  function getShelfAccessPoint(shelfBlockX, shelfBlockY, facing, roomHeight, roomWidth, astarGrid) {
    let accessX = shelfBlockX; let accessY = shelfBlockY;
    if (facing === 'N') accessY = shelfBlockY - 1;
    else if (facing === 'S') accessY = shelfBlockY + 1;
    // Add E/W logic if needed:
    // else if (facing === 'E') accessX = shelfBlockX + 1;
    // else if (facing === 'W') accessX = shelfBlockX - 1;

    if (accessX < 0 || accessX >= roomWidth || accessY < 0 || accessY >= roomHeight || astarGrid[accessY]?.[accessX] === 1) {
        console.warn(`Invalid/Obstacle Access Point: Shelf (${shelfBlockX},${shelfBlockY}) Facing ${facing} -> Target (${accessX},${accessY}). Fallback to block center.`);
        return { x: shelfBlockX, y: shelfBlockY };
    }
    return { x: accessX, y: accessY };
}



const optimizePickRoute = async (req, res) => {
  const { shopIdentifier } = req.params;
  const { itemsToPick, startPoint: startPointFromReq, endPoint: endPointFromReq } = req.body;

  // --- Initial Validations ---
  if (!itemsToPick || !Array.isArray(itemsToPick) || itemsToPick.length === 0) {
      return res.status(400).json({ message: 'itemsToPick array is required and cannot be empty.' });
  }
  if (itemsToPick.some(item => !item.location || item.location.x === undefined || item.location.y === undefined || !item.location.facing)) {
      return res.status(400).json({ message: 'All itemsToPick must have valid location (x, y, facing).' });
  }

  try { // MAIN TRY BLOCK FOR THE ENTIRE FUNCTION LOGIC
      const db = getDB();
      const shopsCollection = db.collection(SHOPS_COLLECTION);
      let shopQuery;
      if (ObjectId.isValid(shopIdentifier)) shopQuery = { _id: new ObjectId(shopIdentifier) };
      else shopQuery = { shopName: shopIdentifier };
      
      const shop = await shopsCollection.findOne(shopQuery);
      if (!shop) {
          // Check if headers already sent before sending a new response
          if (!res.headersSent) return res.status(404).json({ message: "Shop not found" });
          return; // Stop execution
      }

      const roomWidth = shop.layout?.width || DEFAULT_WAREHOUSE_WIDTH; 
      const roomHeight = shop.layout?.height || DEFAULT_WAREHOUSE_HEIGHT;
      
      // --- 1. Construct A* Grid ---
      const astarGrid = Array(roomHeight).fill(null).map(() => Array(roomWidth).fill(0));
      const numShelfBlockRows = Math.floor((roomHeight - 1) / 2);
      for (let sbRowIndex = 0; sbRowIndex < numShelfBlockRows; sbRowIndex++) {
          const yShelfBlock = sbRowIndex * 2 + 1;
          if (yShelfBlock >= roomHeight -1) continue; // Check bounds
          for (let x = 1; x < roomWidth - 1; x++) {
              if (astarGrid[yShelfBlock]?.[x] !== undefined) astarGrid[yShelfBlock][x] = 1;
          }
      }

      // --- 2. Define Nodes for TSP ---
      const defaultStart = { x: 0, y: Math.floor(roomHeight / 2) };
      const defaultEnd = { x: roomWidth - 1, y: Math.floor(roomHeight / 2) };
      const startNode = { id: 'start', coords: startPointFromReq || defaultStart, originalItem: { masterItemId: 'START', location: { shelfId: -1 } } };
      const endNodeForTsp = { id: 'end', coords: endPointFromReq || defaultEnd, originalItem: { masterItemId: 'END', location: { shelfId: -2 } } };

      const uniquePickNodesMap = new Map();
      itemsToPick.forEach(item => {
          const accessPointCoords = getShelfAccessPoint(item.location.x, item.location.y, item.location.facing, roomHeight, roomWidth, astarGrid);
          const nodeId = `item-${item.masterItemId}-shelf-${item.location.shelfId}-face-${item.location.facing}`;
          if (!uniquePickNodesMap.has(nodeId)) {
              uniquePickNodesMap.set(nodeId, {
                  id: nodeId,
                  coords: accessPointCoords,
                  originalShelfBlockCoords: { x: item.location.x, y: item.location.y },
                  shelfId: item.location.shelfId,
                  facing: item.location.facing,
                  // Store original item for constructing pickSequenceSteps later
                  originalItemDetails: itemsToPick.filter( // Collect all items for this specific stop
                      it => it.location.shelfId === item.location.shelfId &&
                            it.location.x === item.location.x &&
                            it.location.y === item.location.y &&
                            it.location.facing === item.location.facing
                  ).map(it => ({masterItemId: it.masterItemId, quantity: it.quantity}))
              });
          } else {
              // If node already exists, aggregate quantities (though picklist should ideally be pre-aggregated by masterItemId for a location)
              // This part depends on how `itemsToPick` is structured. Assuming it's already "consolidated per unique stop".
          }
      });
      const uniquePickNodes = Array.from(uniquePickNodesMap.values());
      
      const tspNodesForMatrix = [startNode, ...uniquePickNodes, endNodeForTsp].filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i);


      // --- 3. Calculate Distance Matrix using A* ---
      const distanceMatrix = new Map();
      console.log("Calculating distance matrix for TSP nodes:", tspNodesForMatrix.map(n=>n.id));
      for (let i = 0; i < tspNodesForMatrix.length; i++) {
          for (let j = 0; j < tspNodesForMatrix.length; j++) {
              if (i === j) continue;
              const nodeA = tspNodesForMatrix[i]; const nodeB = tspNodesForMatrix[j];
              const key = `${nodeA.id}_${nodeB.id}`;
              if (!distanceMatrix.has(key)) {
                  const aStarResult = findPathAStar(astarGrid, nodeA.coords, nodeB.coords, roomWidth, roomHeight);
                  distanceMatrix.set(key, aStarResult || { path: [], cost: Infinity });
                  if (!aStarResult || aStarResult.cost === Infinity) console.warn(`No A* path found from ${nodeA.id} (${nodeA.coords.x},${nodeA.coords.y}) to ${nodeB.id} (${nodeB.coords.x},${nodeB.coords.y})`);
              }
          }
      }
      const getPathData = (nodeAId, nodeBId) => distanceMatrix.get(`${nodeAId}_${nodeBId}`) || { path: [], cost: Infinity };

      // --- 4. TSP Heuristic: Nearest Neighbor (NN) ---
      let nnUnvisited = [...uniquePickNodes];
      let nnCurrentNode = startNode;
      let nnOrderedTour = [startNode];
      let nnTotalCost = 0;

      if (uniquePickNodes.length === 0 && startNode.id !== endNodeForTsp.id) {
          const segment = getPathData(startNode.id, endNodeForTsp.id);
          if (segment.cost !== Infinity) { nnTotalCost = segment.cost; nnOrderedTour.push(endNodeForTsp); }
          else { console.warn("NN: No items and no path from start to end."); }
      } else if (uniquePickNodes.length > 0) {
          while (nnUnvisited.length > 0) {
              let nearest = null; let minCost = Infinity;
              for (const pNN of nnUnvisited) {
                  const segData = getPathData(nnCurrentNode.id, pNN.id);
                  if (segData.cost < minCost) { minCost = segData.cost; nearest = pNN; }
              }
              if (nearest && minCost !== Infinity) {
                  nnTotalCost += minCost; nnOrderedTour.push(nearest);
                  nnCurrentNode = nearest; nnUnvisited = nnUnvisited.filter(n => n.id !== nearest.id);
              } else {
                  const remainingIds = nnUnvisited.map(n=>n.id).join(', ');
                  console.error(`NN Error from ${nnCurrentNode.id}. Remaining: ${remainingIds}`);
                  if (!res.headersSent) return res.status(500).json({ message: `Route calc incomplete (NN): Cannot reach: ${remainingIds}` });
                  return; // Stop
              }
          }
          if (nnCurrentNode.id !== endNodeForTsp.id) {
              const segToEnd = getPathData(nnCurrentNode.id, endNodeForTsp.id);
              if (segToEnd.cost !== Infinity) { nnTotalCost += segToEnd.cost; nnOrderedTour.push(endNodeForTsp); }
              else { console.warn(`NN: Cannot path from ${nnCurrentNode.id} to end ${endNodeForTsp.id}.`); }
          }
      }
      
      let finalOptimizedTourNodes = nnOrderedTour;
      let finalOptimizedCost = nnTotalCost;
      // TODO: Implement 2-Opt refinement here if desired, update finalOptimizedTourNodes and finalOptimizedCost

      // --- 5. Construct Full Optimized Path Coordinates ---
      let optimizedPathCoords = [];
      if (finalOptimizedTourNodes && finalOptimizedTourNodes.length > 0) {
          optimizedPathCoords.push(finalOptimizedTourNodes[0].coords);
           for (let i = 0; i < finalOptimizedTourNodes.length - 1; i++) {
              const fromNode = finalOptimizedTourNodes[i];
              const toNode = finalOptimizedTourNodes[i+1];
              const segment = getPathData(fromNode.id, toNode.id);
              if (segment && segment.path && segment.path.length > 1) {
                  optimizedPathCoords.push(...segment.path.slice(1));
              } else if (segment && segment.path && segment.path.length === 1 && fromNode.id !== toNode.id) {
                  if (optimizedPathCoords.length === 0 || optimizedPathCoords[optimizedPathCoords.length-1].x !== segment.path[0].x || optimizedPathCoords[optimizedPathCoords.length-1].y !== segment.path[0].y) {
                     optimizedPathCoords.push(segment.path[0]);
                  }
              } else if (fromNode.id !== toNode.id) { console.warn(`Optimized: Missing segment ${fromNode.id} to ${toNode.id}. Cost: ${segment?.cost}`); }
          }
      }
      // --- 6. Construct Unoptimized Path ---
      let unoptimizedPathCoords = [];
        let currentUnoptNode = startNode; // Start at the designated start node
        let totalUnoptimizedCost = 0;

        if (currentUnoptNode) { // Ensure startNode was found/defined
            unoptimizedPathCoords.push(currentUnoptNode.coords);

            // Iterate through uniquePickNodes IN THE ORDER THEY WERE DERIVED FROM itemsToPick
            for (const pickNode of uniquePickNodes) {
                if (currentUnoptNode.id === pickNode.id && unoptimizedPathCoords.length === 1) {
                    // If start node is the first pick node, no travel needed yet for this segment
                } else if (currentUnoptNode.id === pickNode.id) {
                    continue; // Already at this pick node (should not happen if pickNode is from uniquePickNodes and currentUnoptNode was updated)
                }

                const segment = getPathData(currentUnoptNode.id, pickNode.id);
                if (segment && segment.cost !== Infinity && segment.path && segment.path.length > 0) {
                    totalUnoptimizedCost += segment.cost;
                    if (segment.path.length > 1) { // Path includes start and end points of segment
                        unoptimizedPathCoords.push(...segment.path.slice(1)); // Add path excluding its start point
                    } else if (unoptimizedPathCoords.length === 0 || // Should not happen if we pushed startNode.coords
                               (unoptimizedPathCoords[unoptimizedPathCoords.length-1]?.x !== pickNode.coords.x || 
                                unoptimizedPathCoords[unoptimizedPathCoords.length-1]?.y !== pickNode.coords.y)) {
                        // If path is just the node itself (e.g., adjacent) and not already the last point
                        unoptimizedPathCoords.push(pickNode.coords);
                    }
                    currentUnoptNode = pickNode; // Update current node for the next segment
                } else { 
                    console.warn(`Unoptimized Route: No valid A* segment from ${currentUnoptNode.id} to ${pickNode.id}. Cost: ${segment?.cost}. Item might be skipped in unoptimized path calculation.`);
                    // If an item is unreachable for the unoptimized path, we skip it here.
                    // This means totalUnoptimizedCost might be lower, making "savings" appear smaller.
                    // A different strategy could be to assign a very high penalty cost.
                }
            }
            
            // Path from the last processed pickNode (or startNode if no picks) to endNodeForTsp
            if (currentUnoptNode.id !== endNodeForTsp.id) {
                const segmentToEndUnopt = getPathData(currentUnoptNode.id, endNodeForTsp.id);
                if (segmentToEndUnopt && segmentToEndUnopt.cost !== Infinity && segmentToEndUnopt.path.length > 0) {
                    totalUnoptimizedCost += segmentToEndUnopt.cost;
                     if (segmentToEndUnopt.path.length > 1) {
                         unoptimizedPathCoords.push(...segmentToEndUnopt.path.slice(1));
                     } else if (unoptimizedPathCoords.length === 0 || // Should not happen
                                (unoptimizedPathCoords[unoptimizedPathCoords.length-1]?.x !== endNodeForTsp.coords.x || 
                                 unoptimizedPathCoords[unoptimizedPathCoords.length-1]?.y !== endNodeForTsp.coords.y)) {
                        unoptimizedPathCoords.push(endNodeForTsp.coords);
                     }
                } else { 
                    console.warn(`Unoptimized: Could not path from ${currentUnoptNode.id} to end node ${endNodeForTsp.id}.`);
                }
            }
        } else {
            console.error("Unoptimized Path Error: Start node (currentUnoptNode) is undefined.");
            // Fallback or error response
        }
      // --- 7. Prepare Response Data ---
      const pickSequenceForUserDisplay = finalOptimizedTourNodes
          .filter(node => node.id !== 'start' && node.id !== 'end')
          .map((node, index) => ({
              step: index + 1,
              shelfId: node.shelfId,
              facing: node.facing,
              gridCoords: node.coords,
              items: (node.originalItemDetails || []).map(detail => ({
                masterItemId: detail.masterItemId,
                quantityToPick: detail.quantity // Ensure this field is correct
            }))// Use the stored details
          }));
      
      const estimatedTimePerUnitDistance = 0.5; // Example: 0.5 seconds per grid unit
      const fixedTimePerPickStop = 10;         // Example: 10 seconds per unique pick stop
      const numPickStops = uniquePickNodes.length;

      const optimizedTimeEst = (finalOptimizedCost * estimatedTimePerUnitDistance) + (numPickStops * fixedTimePerPickStop);
      const unoptimizedTimeEst = (totalUnoptimizedCost * estimatedTimePerUnitDistance) + (numPickStops * fixedTimePerPickStop);
      const timeSavedValue = Math.max(0, unoptimizedTimeEst - optimizedTimeEst);
      const timeSavedEstimate = `${Math.floor(timeSavedValue / 60)}m ${Math.round(timeSavedValue % 60)}s`;
      console.log(unoptimizedPathCoords)
    
      return res.json({ // Added return here
          optimizedPath: optimizedPathCoords,
          unoptimizedPath: unoptimizedPathCoords,
          metrics: {
              unoptimizedDistance: parseFloat(totalUnoptimizedCost.toFixed(2)),
              optimizedDistance: parseFloat(finalOptimizedCost.toFixed(2)),
              distanceSaved: parseFloat((totalUnoptimizedCost - finalOptimizedCost).toFixed(2)),
              orderedPickLocations: finalOptimizedTourNodes.filter(n=>n.id !== 'start' && n.id !== 'end').map(n=>n.coords),
              pickSequenceSteps: pickSequenceForUserDisplay,
              timeSavedEstimate: timeSavedEstimate,
              entryPointForPath: startNode.coords,
              exitPointForPath: endNodeForTsp.coords    
          }
      });

  } catch (error) {
      console.error('CRITICAL Error in optimizePickRoute:', error.name, error.message, error.stack);
      if (!res.headersSent) {
          return res.status(500).json({ message: 'Server error during route optimization.', errorDetails: error.message });
      }
  }
};

  // @desc    Update Order Status (and potentially inventory)
  // @route   PUT /api/shops/:shopIdentifier/orders/:orderId/status
  // @access  Public
  // warehouse-simulator-be/controllers/shopController.js

const updateOrderStatus = async (req, res) => {
  const { shopIdentifier, orderId } = req.params;
  const { status: newStatus, items: pickedItemsArray } = req.body; // pickedItemsArray from frontend should reflect what was actually picked

  if (!newStatus) return res.status(400).json({ message: 'New status required.' });

  try {
      const db = getDB();
      const shopsCollection = db.collection(SHOPS_COLLECTION);
      const ordersCollection = db.collection(ORDERS_COLLECTION);
      let shopObjectId;
      let shopQuery;

      if (ObjectId.isValid(shopIdentifier)) {
          shopObjectId = new ObjectId(shopIdentifier);
          shopQuery = { _id: shopObjectId };
      } else {
          shopQuery = { shopName: shopIdentifier };
          const tempShop = await shopsCollection.findOne(shopQuery);
          if (!tempShop) return res.status(404).json({ message: 'Shop not found by name for order update' });
          shopObjectId = tempShop._id;
          // It's safer to use _id for subsequent operations if found by name
          shopQuery = { _id: shopObjectId }; 
      }

      const orderFilter = { _id: new ObjectId(orderId), shopId: shopObjectId };
      
      // --- Start Inventory Decrement Logic (if fulfilling) ---
      if (newStatus === 'fulfilled' && Array.isArray(pickedItemsArray) && pickedItemsArray.length > 0) {
          console.log(`Order ${orderId} being fulfilled. Attempting to decrement inventory for shop ${shopIdentifier}:`, pickedItemsArray);

          const shopForInventory = await shopsCollection.findOne(shopQuery);
          if (!shopForInventory) {
              // This should ideally not happen if the earlier shop check passed
              return res.status(404).json({ message: 'Shop not found for inventory update.' });
          }

          let inventoryUpdateFailed = false;
          const operations = []; // For bulkWrite if needed, or update one by one

          for (const pickedItem of pickedItemsArray) {
              if (!pickedItem.masterItemId || typeof pickedItem.quantityPicked !== 'number' || pickedItem.quantityPicked <= 0) {
                  console.warn("Skipping invalid picked item for inventory update:", pickedItem);
                  continue;
              }

              // Find the logical shelf ID from which this item was notionally picked.
              // The frontend's `pickedItemsArray` needs to contain information about which `shelfId`
              // the items were assigned to be picked from by the optimizer, or a general inventory pool logic.
              // For now, let's assume `pickedItem` has a `pickedFromShelfId`.
              // If not, this logic needs to be more sophisticated (e.g., find any shelf with stock).

              let shelfToUpdateId = null;
              // To implement this robustly, your `itemsToPick` in `optimizePickRoute` and subsequently
              // the `pickedItemsArray` sent when fulfilling should contain the `shelfId`
              // from which each specific unit of an item was planned to be picked.

              // SIMPLIFIED: Assume we pick from any shelf that has the item.
              // This is not ideal as it doesn't respect the optimized pick path's source shelf.
              // A better approach: The `pickedItemsArray` from frontend should specify the `shelfId`.
              // For this example, let's iterate through shelves to find one with the item.
              
              let foundAndDecremented = false;
              for (const shelf of shopForInventory.shelves) {
                  const itemIndexOnShelf = shelf.items.findIndex(i => i.masterItemId === pickedItem.masterItemId);
                  if (itemIndexOnShelf > -1 && shelf.items[itemIndexOnShelf].quantity >= pickedItem.quantityPicked) {
                      // Found a shelf with enough stock for this specific item pick
                      operations.push({
                          updateOne: {
                              filter: { ...shopQuery, "shelves.shelfNumber": shelf.shelfNumber, "shelves.items.masterItemId": pickedItem.masterItemId },
                              update: { 
                                  $inc: { "shelves.$[shelfTarget].items.$[itemTarget].quantity": -pickedItem.quantityPicked },
                                  $set: { "shelves.$[shelfTarget].updatedAt": new Date(), "updatedAt": new Date() }
                              },
                              arrayFilters: [ 
                                  { "shelfTarget.shelfNumber": shelf.shelfNumber },
                                  { "itemTarget.masterItemId": pickedItem.masterItemId }
                              ]
                          }
                      });
                      foundAndDecremented = true;
                      console.log(`Prepared decrement: ${pickedItem.quantityPicked} of ${pickedItem.masterItemId} from shelf ${shelf.shelfNumber}`);
                      break; // Decremented from this shelf, move to next pickedItem
                  }
              }
              if (!foundAndDecremented) {
                  console.error(`Could not find enough stock or shelf for ${pickedItem.masterItemId} (qty: ${pickedItem.quantityPicked}) to decrement inventory.`);
                  // Decide how to handle: stop fulfillment, mark as error, or proceed with partial?
                  // For now, we'll let it proceed but the inventory won't be right.
                  inventoryUpdateFailed = true; 
              }
          }

          if (operations.length > 0) {
              try {
                  const bulkWriteResult = await shopsCollection.bulkWrite(operations);
                  console.log("Inventory bulkWrite result:", bulkWriteResult);
                  if (bulkWriteResult.modifiedCount < operations.length && inventoryUpdateFailed) { // Check if all ops succeeded
                       console.warn("Not all inventory decrements were successful. Some items might not have been found or had insufficient stock during update.");
                       // Potentially change order status to picked_partial if inventoryUpdateFailed
                  }
              } catch (invError) {
                  console.error("Error during inventory bulkWrite:", invError);
                  return res.status(500).json({ message: "Error updating inventory.", errorDetails: invError.message });
              }
          } else if (pickedItemsArray.length > 0) { // If there were items to pick but no operations created
              console.warn("No inventory operations created for picked items. Stock might be an issue.");
          }
      }
      // --- End Inventory Decrement Logic ---

      const updateDocPayload = { status: newStatus, updatedAt: new Date() };
      if (newStatus === 'fulfilled' && Array.isArray(pickedItemsArray)) {
          updateDocPayload.pickedItems = pickedItemsArray; // Store what was actually intended to be picked
      }

      const result = await ordersCollection.findOneAndUpdate(
          orderFilter,
          { $set: updateDocPayload },
          { returnDocument: 'after' }
      );

      if (!result) {
          return res.status(404).json({ message: 'Order not found or not part of this shop after attempting status update.' });
      }
      
      res.json(result);

  } catch (error) {
      console.error('Error updating order status:', error);
      res.status(500).json({ message: 'Server error during order status update.', errorDetails: error.message });
  }
};
  
  
module.exports = {
  createShop,
  getShop,
  updateItemOnShelf,
  replaceAllItemsOnShelf,
  generateRandomOrders,
  getPendingOrders,
  optimizePickRoute,
  updateOrderStatus,
};