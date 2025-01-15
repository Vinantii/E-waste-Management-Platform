const mongoose = require("mongoose");
const Request = require("./request");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  email: {
    type: String,
  },
  password: {
    type: String,
  },
  phone: {
    type: String,
    match: [/^\d{10}$/, "Phone number must be 10 digits"],
  },
  address: {
    type: String,
  },
  location: {
    type: {
      type: String,
      default: "Point",
      enum: ["Point"],
    },
    coordinates: [Number], // [longitude, latitude]
  },
  pinCode: Number,
  googleId: {
    type: String,
  },
  profilePic: {
    url: {
      type: String,
      required: false,
    },
    filename: {
      type: String,
      required: false,
    },
  },
  eTokens: Number,
  requestMade: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Request",
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  requests: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Request",
    },
  ],
  points: {
    type: Number,
    default: 0
  },
  completedRequests: {
    type: Number,
    default: 0
  }
});

// Add a method to calculate and update points
userSchema.methods.calculatePoints = async function() {
  const completedRequests = await Request.countDocuments({
    user: this._id,
    status: 'Completed'
  });
  
  // Basic points: 100 points per completed request
  let points = completedRequests * 100;
  
  // Get user's rank
  const rank = await User.countDocuments({ points: { $gt: this.points } }) + 1;
  
  // Bonus points based on rank
  if (rank <= 5) {
    const rankBonus = {
      1: 1000,  // 1st place bonus
      2: 750,   // 2nd place bonus
      3: 500,   // 3rd place bonus
      4: 250,   // 4th place bonus
      5: 100    // 5th place bonus
    };
    points += rankBonus[rank] || 0;
  }
  
  this.completedRequests = completedRequests;
  this.points = points;
  await this.save();
  
  return { points, rank };
};

const User = mongoose.model("User", userSchema);

module.exports = User;
