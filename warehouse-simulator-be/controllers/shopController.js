// controllers/shopController.js
const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb'); // To work with MongoDB's _id

const SHOPS_COLLECTION = 'shops'; // Define collection name

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
  

module.exports = {
  createShop,
  getShop,
  updateItemOnShelf,
  replaceAllItemsOnShelf,
};