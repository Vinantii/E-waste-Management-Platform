const mongoose = require("mongoose");
const Request = require("./request");

const agencySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  agencyType: {
    type: [String],
    enum: ["Recycler", "Collector", "Disposal", "Aggregator"], // Types of agencies
  },
  address: String,
  region: String, // Region like 'North', 'South', 'West', 'East', or specific states
  phone: {
    type: String,
    match: [/^\d{10}$/, "Phone number must be 10 digits"],
  },
  contactPerson: String, // Name of the contact person for the agency
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number], // This expects an array of numbers [longitude, latitude]
      required: true,
    },
  },
  workingHours: String, // Example: '9 AM - 6 PM'
  certificationStatus: {
    type: String,
    enum: ["Certified", "Uncertified"],
  },
  wasteTypesHandled: {
    type: [String],
    enum: ["mobile", "phones", "computers", "laptop", "Batteries"],
  },
  pickupRequests: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Request", // Reference to PickupRequest model
    },
  ],
  requests: [
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
  isAgency: {
    type: Boolean,
    default: true,
  },
  logo: {
    url: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
  },
});

// Add this pre-save middleware to log what's being saved
agencySchema.pre("save", function (next) {
  console.log("Saving agency:", this.toObject());
  next();
});

const Agency = mongoose.model("Agency", agencySchema);

module.exports = Agency;
