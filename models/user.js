const mongoose = require("mongoose");
const Request = require("./request");
const Story = require("./story");
const Order = require("./order");
const Volunteer = require("./volunteer");
const Agency = require("./agency");
const wrapAsync = require("../utils/wrapAsync");

const WASTE_TYPE_POINTS = {
  mobile: 50, // 50 points per mobile
  phones: 50, // 50 points per phone
  computers: 150, // 150 points per computer
  laptop: 100, // 100 points per laptop
  batteries: 20, // 20 points per battery
};

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  phone: {
    type: String,
    match: [/^\d{10}$/, "Phone number must be 10 digits"],
  },
  address: String,
  location: {
    type: { type: String, default: "Point", enum: ["Point"] },
    coordinates: [Number], // [longitude, latitude]
  },
  pinCode: Number,
  googleId: String,
  profilePic: {
    url: String,
    filename: String,
  },
  eTokens: Number,
  requestMade: [{ type: mongoose.Schema.Types.ObjectId, ref: "Request" }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  requests: [{ type: mongoose.Schema.Types.ObjectId, ref: "Request" }],
  points: { type: Number, default: 0 }, // Total points (redeemable)
  monthlyPoints: { type: Number, default: 0 }, // Points for ranking
  communityPoints: { type: Number, default: 0 },
  completedRequests: { type: Number, default: 0 },
  redeemedPoints: { type: Number, default: 0 },
  ranking: {
    lastRank: { type: Number, default: null },
    lastPoints: { type: Number, default: 0 },
  },
  lastResetDate: { type: Date, default: null }, // Track last reset date
});

const User = mongoose.model("User", userSchema);

module.exports = User;
