// routes/shopRoutes.js
const express = require('express');
const router = express.Router();
const { createShop, getShop } = require('../controllers/shopController');

router.post('/', createShop);
router.get('/:identifier', getShop);

module.exports = router;