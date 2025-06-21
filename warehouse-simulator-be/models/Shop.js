// models/Shop.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ShelfItemSchema = new Schema({
    _id: false, // Don't create a separate _id for subdocument items if not needed
    masterItemId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 }
});

const ShelfSchema = new Schema({
    _id: false, // Often good to disable _id for subdocuments unless you need to query them directly by _id
    shelfNumber: { type: Number, required: true },
    // Using an array of subdocuments for items here as it's more standard for Mongoose population/queries later
    items: [ShelfItemSchema],
    row: { type: Number, required: true },
    col: { type: Number, required: true },
    maxCapacityPerShelf: { type: Number, default: 96 }
});

const ShopSchema = new Schema({
    shopName: {
        type: String,
        required: [true, 'Shop name is required'],
        unique: true,
        trim: true
    },
    shelves: [ShelfSchema],
    // If you want default shelves upon creation:
    // defaultShelvesCount: { type: Number, default: 21 }, // Example
    // defaultShelvesPerRow: { type: Number, default: 3 }, // Example
}, {
    timestamps: true // Adds createdAt and updatedAt automatically
});

// Optional: Pre-save hook to initialize default shelves if a new shop is created
// ShopSchema.pre('save', function(next) {
//   if (this.isNew && this.shelves.length === 0 && this.defaultShelvesCount > 0) {
//     const shelves = [];
//     for (let i = 1; i <= this.defaultShelvesCount; i++) {
//       shelves.push({
//         shelfNumber: i,
//         items: [],
//         row: Math.floor((i - 1) / this.defaultShelvesPerRow),
//         col: (i - 1) % this.defaultShelvesPerRow,
//         maxCapacityPerShelf: 96
//       });
//     }
//     this.shelves = shelves;
//   }
//   next();
// });


module.exports = mongoose.model('Shop', ShopSchema);