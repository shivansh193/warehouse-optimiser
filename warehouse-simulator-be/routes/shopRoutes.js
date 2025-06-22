// routes/shopRoutes.js
const express = require('express');
const router = express.Router();
const { createShop, getShop } = require('../controllers/shopController');
const { updateItemOnShelf } = require('../controllers/shopController'); // Add this
const { replaceAllItemsOnShelf } = require('../controllers/shopController'); // Add this
const { 
    generateRandomOrders, // New
    getPendingOrders,     // New
    optimizePickRoute,    // New
    updateOrderStatus     // New
} = require('../controllers/shopController');

// ... (existing routes for createShop, getShop, updateItemOnShelf, replaceAllItemsOnShelf) ...

// --- ORDER ROUTES ---
// Generate Random Orders
router.post('/:shopIdentifier/orders/generate-random', generateRandomOrders);

// Get Orders (can filter by status)
router.get('/:shopIdentifier/orders', getPendingOrders);

// Optimize Pick Route
router.post('/:shopIdentifier/optimize-pick-route', optimizePickRoute);

// Update Order Status
router.put('/:shopIdentifier/orders/:orderId/status', updateOrderStatus);


router.post('/', createShop);
router.get('/:identifier', getShop);
router.put('/:shopIdentifier/shelves/:logicalShelfId/item', updateItemOnShelf);
router.put('/:shopIdentifier/shelves/:logicalShelfId/all-items', replaceAllItemsOnShelf);


module.exports = router;