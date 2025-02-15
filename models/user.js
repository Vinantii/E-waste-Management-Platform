const mongoose = require("mongoose");
const Request = require("./request");

const WASTE_TYPE_POINTS = {
  mobile: 50,     // 50 points per mobile
  phones: 50,     // 50 points per phone
  computers: 150,  // 150 points per computer
  laptop: 100,    // 100 points per laptop
  batteries: 20    // 20 points per battery
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
  },
  redeemedPoints: { 
    type: Number, 
    default: 0
  }
});

// Add this helper function in userSchema
userSchema.methods.calculateRequestPoints = function(wasteTypes, quantities) {
  let totalPoints = 0;
  
  // Loop through each waste type and its quantity
  wasteTypes.forEach((type, index) => {
    // Convert type to lowercase to match WASTE_TYPE_POINTS keys
    const normalizedType = type.toLowerCase();
    // Skip if quantity is undefined or not a number
    if (typeof quantities[index] !== 'number') {
      console.warn(`Invalid quantity for ${type} at index ${index}`);
      return;
    }
    
    const pointsPerItem = WASTE_TYPE_POINTS[normalizedType] || 0;
    totalPoints += pointsPerItem * quantities[index];
  });
  
  return isNaN(totalPoints) ? 0 : totalPoints;  // Return 0 if NaN
};

// Update the existing calculatePoints method
userSchema.methods.calculatePoints = async function() {
  try {
    // Initialize points if undefined
    if (typeof this.points !== 'number') {
      this.points = 0;
    }
    if (typeof this.communityPoints !== 'number') {
      this.communityPoints = 0;
    }

    // Add community points
    let communityPoints = this.communityPoints || 0;
    
    // Get user's rank
    const rank = await User.countDocuments({ points: { $gt: this.points } }) + 1;
    
    // Bonus points based on rank
    let rankBonus = 0;
    const rankBonuses = {
      1: 1000,
      2: 750,
      3: 500,
      4: 250,
      5: 100
    };
    
    if (rank <= 5) {
      rankBonus = rankBonuses[rank] || 0;
    }

    // Get all completed requests for this user
    const completedRequests = await Request.find({
      user: this._id,
      status: 'Completed'
    });
    
    let totalRequestPoints = 0;
    
    // Calculate points for each completed request
    for (const request of completedRequests) {

      if (Array.isArray(request.wasteType) && 
          Array.isArray(request.quantities) && 
          request.wasteType.length === request.quantities.length) {
        const requestPoints = this.calculateRequestPoints(
          request.wasteType,
          request.quantities
        );
        totalRequestPoints += requestPoints;
      } else {
        console.warn('Invalid request data:', {
          hasWasteType: Array.isArray(request.wasteType),
          hasQuantities: Array.isArray(request.quantities),
          lengthMatch: request.wasteType.length === request.quantities.length,
          request: request._id
        });
      }
    }
    
    console.log('Final calculation:', {
      totalRequestPoints,
      communityPoints: this.communityPoints,
      rankBonus
    });

    // Calculate total points
    // Ensure all values are numbers and default to 0 if NaN
    const safeNumber = (val) => isNaN(Number(val)) ? 0 : Number(val);
    const totalPoints = safeNumber(totalRequestPoints) + 
                       safeNumber(communityPoints) + 
                       safeNumber(rankBonus);
    
    // Ensure totalPoints is a valid number
    if (isNaN(totalPoints)) {
      console.error('Invalid points calculation:', {
        totalRequestPoints,
        communityPoints,
        rankBonus
      });
      throw new Error('Invalid points calculation');
    }
    
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
  } catch (error) {
   // console.error('Error calculating points:', error);
    throw error;
  }
};

// Add a method to add community points
userSchema.methods.addCommunityPoints = async function (points) {
  this.communityPoints += points;
  await this.save();
  return this.points;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
