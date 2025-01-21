const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  content: {
    type: String,
    required: true,
  },
 author: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the User schema
    },
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency", // Reference to the Agency schema
    },
  },
  publishedAt: {
    type: Date,
    default: Date.now,
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
  },


//   media: [
//     {
//       type: {
//         type: String,
//         enum: ['image', 'video'],
//         required: true,
//       },
//       url: {
//         type: String,
//         required: true,
//       },
//     },
//   ],
  
  
//   likes: {
//     type: Number,
//     default: 0,
//   },
//   comments: [
//     {
//       userId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User',
//       },
//       comment: {
//         type: String,
//         trim: true,
//       },
//       commentedAt: {
//         type: Date,
//         default: Date.now,
//       },
//     },
//   ],
});

const Story = mongoose.model('Story', storySchema);

module.exports = Story;
