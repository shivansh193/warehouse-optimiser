// routes/shopRoutes.js
const express = require('express');
const router = express.Router();
const { createShop, getShop } = require('../controllers/shopController');
const { updateItemOnShelf } = require('../controllers/shopController'); // Add this
const { replaceAllItemsOnShelf } = require('../controllers/shopController'); // Add this

router.post('/', createShop);
router.get('/:identifier', getShop);
router.put('/:shopIdentifier/shelves/:logicalShelfId/item', updateItemOnShelf);
router.put('/:shopIdentifier/shelves/:logicalShelfId/all-items', replaceAllItemsOnShelf);


module.exports = router;