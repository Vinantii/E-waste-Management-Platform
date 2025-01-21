const mongoose = require("mongoose");

const communitySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  organizer: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the User schema
    },
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency", // Reference to the Agency schema
    },
  },
  eventType: {
    type: String,
    enum: ["Event", "Drive", "Online Webinar", "Workshop"],
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  time: {
    type: String, // Storing as a string to accommodate flexible formats (e.g., "10:00 AM")
    required: true,
  },
  location: {
    type: String, // For physical events
    required: function () {
      return this.eventType !== "Online Webinar";
    },
  },
  registrationLink: {
    type: String,
    required: true,
  },
  contactInfo: {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Community", communitySchema);
