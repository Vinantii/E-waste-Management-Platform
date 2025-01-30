const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema({
  agencyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Agency",
    required: true,
  },
  totalCapacity: {
    type: Number,
    required: true,
    min: [0, "Total capacity must be non-negative"],
  },
  currentCapacity: {
    type: Number,
    required: true,
    default: 0,
    min: [0, "Current capacity must be non-negative"],
    validate: {
      validator: function (value) {
        return value <= this.totalCapacity;
      },
      message: "Current capacity cannot exceed total capacity",
    },
  },
  location: {
    address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    postalCode: {
      type: String,
      required: true,
    },
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

// Middleware to update lastUpdated field before saving
inventorySchema.pre("save", function (next) {
  this.lastUpdated = Date.now();
  next();
});

// Export the Inventory model
const Inventory = mongoose.model("Inventory", inventorySchema);

module.exports = Inventory;
