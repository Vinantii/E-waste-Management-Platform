const mongoose = require("mongoose");

const volunteerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: String,
    required: true,
    match: [/^\d{10}$/, "Phone number must be 10 digits"],
  },
  address: {
    type: String,
    required: true,
  },
  pickupArea: {
    city: {
      type: String,
      required: true,
    },
    district: {
      type: String,
      required: true,
    },
    pinCodes: [{
      type: String,
      match: [/^\d{6}$/, "PIN code must be 6 digits"]
    }],
    landmarks: [String],
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    }
  },
  agency: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Agency",
    required: true,
  },
  status: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Active",
  },
  assignedRequests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Request",
  }],
  profilePic: {
    url: String,
    filename: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

volunteerSchema.index({ "pickupArea.coordinates": "2dsphere" });

const Volunteer = mongoose.model("Volunteer", volunteerSchema);
module.exports = Volunteer; 