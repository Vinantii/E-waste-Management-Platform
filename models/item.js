const { boolean } = require("joi");
const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    itemName: { 
        type: String, 
        required: true
    },
    brandName: { 
        type: String, 
        required: true 
    },
    price: { 
        type: Number, 
        required: true 
    },
    itemImage: {
        url: {
            type: String,
            required: true,
        },
        filename: {
            type: String,
            required: true,
        },
    },
    billImage: { 
        url: {
            type: String,
            required: true,
        },
        filename: {
            type: String,
            required: true,
        },
    }, 
    numberOfMonthsUsed: { 
        type: Number, 
        required: true 
    },
    status: {
        type: String,
        enum:["pending","approved","rejected"],
        default: "pending"
    }
}, 
{ timestamps: true });

const Item = mongoose.model("Item", ItemSchema);

module.exports = Item;
