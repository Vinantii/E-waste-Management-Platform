const mongoose = require("mongoose");
const orderSchema = new mongoose.Schema(
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
      },
      agency: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Agency",
        required: true
      },
      status: {
        type: String,
        enum: ["Pending", "Shipped", "Delivered"],
        default: "Pending"
      }
    },
    { timestamps: true } //  Auto-manages `createdAt` and `updatedAt`
);
  const Order = mongoose.model("Order", orderSchema);
  module.exports = Order;
  