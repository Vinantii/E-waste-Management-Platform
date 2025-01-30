const mongoose = require("mongoose");
const User = require("./user");
const Agency = require("./agency");

const requestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      required: true,
    },
    wasteType: {
      type: [String],
      enum: ["mobile", "phones", "computers", "laptop", "Batteries"],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    weight: {
      type: Number,
      required:true,
    },
    pickupAddress: {
      type: String,
      required: true,
    },
    pickupLocation: {
      type: {
        type: String,
        default: "Point",
        enum: ["Point"],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    pickupDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "Pending",
        "Accepted",
        "Rejected",
        "Assigned",
        "Processing",
        "Completed",
      ],
      default: "Pending",
    },
    rejectedAt: {
      type: Date,
    },
    // Simplify the trackingMilestones structure
    trackingMilestones: {
      requestReceived: {
        completed: { type: Boolean, default: true },
        timestamp: { type: Date, default: Date.now },
        notes: { type: String, default: 'Request received successfully' }
      },
      agencyAccepted: {
        completed: { type: Boolean, default: false },
        timestamp: Date,
        notes: String
      },
      volunteerAssigned: {
        completed: { type: Boolean, default: false },
        timestamp: Date,
        notes: String
      },
      pickupScheduled: {
        completed: { type: Boolean, default: false },
        timestamp: Date,
        notes: String
      },
      pickupStarted: {
        completed: { type: Boolean, default: false },
        timestamp: Date,
        notes: String
      },
      pickupCompleted: {
        completed: { type: Boolean, default: false },
        timestamp: Date,
        notes: String
      },
      wasteSegregated: {
        completed: { type: Boolean, default: false },
        timestamp: Date,
        notes: String
      },
      processingStarted: {
        completed: { type: Boolean, default: false },
        timestamp: Date,
        notes: String
      },
      processingCompleted: {
        completed: { type: Boolean, default: false },
        timestamp: Date,
        notes: String
      }
    },
    contactNumber: {
      type: String,
      match: [/^\d{10}$/, "Phone number must be 10 digits"],
      required: true,
    },
    specialInstructions: {
      type: String,
      maxlength: 500,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    wasteImages: [
      {
        url: {
          type: String,
          required: true,
        },
        filename: String,
      },
    ],
    volunteerName: {
      type: String,
    },
    volunteerAssigned: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Volunteer"
    },
  },
  {
    timestamps: true, // This will automatically update the updatedAt timestamp
  }
);

// Add middleware to update User and Agency models when a request is created
requestSchema.post("save", async function (doc) {
  const User = mongoose.model("User");
  const Agency = mongoose.model("Agency");

  await User.findByIdAndUpdate(doc.user, {
    $addToSet: { requests: doc._id },
  });

  await Agency.findByIdAndUpdate(doc.agency, {
    $addToSet: { requests: doc._id },
  });
});

const Request = mongoose.model("Request", requestSchema);

module.exports = Request;
