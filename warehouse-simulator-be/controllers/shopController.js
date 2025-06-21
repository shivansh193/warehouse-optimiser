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

module.exports = {
  createShop,
  getShop,
};