const mongoose = require("mongoose");
const Request = require("./request");

const WASTE_TYPE_POINTS = {
  mobile: 50,    // 50 points per mobile
  phones: 50,    // 50 points per phone
  computers: 150, // 150 points per computer
  laptop: 20,   // 100 points per laptop
  Batteries: 20   // 20 points per battery
};

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
  communityPoints: {
    type: Number,
    default: 0
  },
  completedRequests: {
    type: Number,
    default: 0
  }
});

// Add this helper function in userSchema
userSchema.methods.calculateRequestPoints = function(wasteTypes, quantities) {
  let totalPoints = 0;
  
  // Loop through each waste type and its quantity
  wasteTypes.forEach((type, index) => {
    const pointsPerItem = WASTE_TYPE_POINTS[type] || 0;
    totalPoints += pointsPerItem * quantities[index];
  });
  
  return totalPoints;
};

// Update the existing calculatePoints method
userSchema.methods.calculatePoints = async function() {
  // Get all completed requests for this user
  const completedRequests = await Request.find({
    user: this._id,
    status: 'Completed'
  });
  
  let totalRequestPoints = 0;
  
  // Calculate points for each completed request
  for (const request of completedRequests) {
    const requestPoints = this.calculateRequestPoints(
      request.wasteType,
      request.quantities // Use the actual quantities array from request
    );
    totalRequestPoints += requestPoints;
  }
  
  // Add community points
  let communityPoints = this.communityPoints;
  
  // Get user's rank
  const rank = await User.countDocuments({ points: { $gt: this.points } }) + 1;
  
  // Bonus points based on rank
  let rankBonus = 0;
  const rankBonuses = {  // Changed from rankBonus to rankBonuses
    1: 1000,  // 1st place bonus
    2: 750,   // 2nd place bonus
    3: 500,   // 3rd place bonus
    4: 250,   // 4th place bonus
    5: 100    // 5th place bonus
  };
  
  if (rank <= 5) {
    rankBonus = rankBonuses[rank] || 0;  // Use rankBonuses instead of rankBonus
  }

  // Calculate total points
  const totalPoints = totalRequestPoints + communityPoints + rankBonus;
  
  // Update user stats
  this.completedRequests = completedRequests.length;
  this.points = totalPoints;
  await this.save();
  
  return { 
    totalPoints,
    requestPoints: totalRequestPoints,
    rankBonus,
    rank 
  };
};

// Add a method to add community points
userSchema.methods.addCommunityPoints = async function (points) {
  this.communityPoints += points;
  await this.save();
  return this.points;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
