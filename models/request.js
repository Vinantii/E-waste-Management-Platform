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
      enum: ["Pending", "Accepted", "In Progress", "Completed", "Cancelled"],
      default: "Pending",
    },
    // New tracking milestones
    trackingMilestones: {
      requestReceived: {
        completed: { type: Boolean, default: true },
        timestamp: { type: Date, default: Date.now },
        notes: String,
      },
      agencyAccepted: {
        completed: { type: Boolean, default: false },
        timestamp: Date,
        notes: String,
      },
      pickupScheduled: {
        completed: { type: Boolean, default: false },
        timestamp: Date,
        estimatedPickupTime: Date,
        notes: String,
      },
      pickupCompleted: {
        completed: { type: Boolean, default: false },
        timestamp: Date,
        actualPickupTime: Date,
        collectedQuantity: Number,
        notes: String,
      },
      wasteSegregated: {
        completed: { type: Boolean, default: false },
        timestamp: Date,
        segregationDetails: {
          reusable: Number,
          recyclable: Number,
          disposable: Number,
        },
        notes: String,
      },
      processingStarted: {
        completed: { type: Boolean, default: false },
        timestamp: Date,
        processingMethod: String,
        notes: String,
      },
      processingCompleted: {
        completed: { type: Boolean, default: false },
        timestamp: Date,
        disposalMethod: String,
        recyclingPercentage: Number,
        notes: String,
      },
      certificateIssued: {
        completed: { type: Boolean, default: false },
        timestamp: Date,
        certificateNumber: String,
        notes: String,
      },
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
  },
  {
    timestamps: true, // This will automatically update the updatedAt timestamp
  }
);

// Middleware to update status based on tracking milestones
requestSchema.pre("save", function (next) {
  if (this.trackingMilestones.certificateIssued.completed) {
    this.status = "Completed";
  } else if (this.trackingMilestones.agencyAccepted.completed) {
    this.status = "In Progress";
  } else if (this.isModified("status") && this.status === "Cancelled") {
    // Keep cancelled status if explicitly set
    this.status = "Cancelled";
  }
  next();
});

// Method to update a milestone
requestSchema.methods.updateMilestone = async function (milestoneName, data) {
  if (!this.trackingMilestones[milestoneName]) {
    throw new Error("Invalid milestone name");
  }

  this.trackingMilestones[milestoneName] = {
    ...this.trackingMilestones[milestoneName],
    ...data,
    completed: true,
    timestamp: new Date(),
  };

  await this.save();
  return this;
};

// Method to get current milestone
requestSchema.methods.getCurrentMilestone = function () {
  const milestones = [
    "requestReceived",
    "agencyAccepted",
    "pickupScheduled",
    "pickupCompleted",
    "wasteSegregated",
    "processingStarted",
    "processingCompleted",
    "certificateIssued",
  ];

  for (let i = milestones.length - 1; i >= 0; i--) {
    if (this.trackingMilestones[milestones[i]].completed) {
      return milestones[i];
    }
  }
  return "requestReceived";
};

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
