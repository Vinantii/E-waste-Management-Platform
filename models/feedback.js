const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    user:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    content: {
        type:String,
        required:true,
    },
    rating:{
        type: Number,
        required:true,
    },
    
  },
    { timestamps: true },
);
const Feedback = mongoose.model("Feedback", feedbackSchema);
module.exports = Feedback;