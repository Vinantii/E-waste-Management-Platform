const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    description: String,
    image: {
        url: {
          type: String,
          required: false,
        },
        filename: {
          type: String,
          required: false,
        },
    },
    pointsRequired: { 
        type: Number, 
        required: true 
    }, // Points needed to redeem
    agency: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Agency", 
        required: true 
    }, // Provided by which agency
    stock: { 
        type: Number, 
        required: true, 
        default: 0 
    }, // Available stock
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
});

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
