# Technothon - E-Waste Management Platform

A web-based platform connecting users with certified e-waste collection agencies to facilitate responsible electronic waste disposal and promote environmental sustainability.

## 🕒 Latest Updates (January 12, 2025)

### New Features Added

#### Volunteer Management System
- **Volunteer Profiles**
  - Detailed volunteer registration with required fields:
    - Name, email, phone, address
    - Pickup area specification (city, district)
    - PIN codes coverage area
    - Landmarks for better navigation
    - Geospatial coordinates for location tracking
  - Profile picture upload and management
  - Active/Inactive status tracking

#### Enhanced Request Management
- **Volunteer Assignment**
  - Agencies can assign specific volunteers to requests
  - Real-time status updates with timestamps
  - Tracking milestones for request progress
- **Request Status Flow**
  - Pending → Approved → In Progress → Picked Up → Completed
  - Automatic milestone tracking
  - Status history with timestamps

#### Agency Dashboard Improvements
- **Request Organization**
  - Separate tabs for New, Approved, and In Progress requests
  - Volunteer assignment interface
  - Status update controls
- **Volunteer Management Interface**
  - List all agency volunteers
  - Toggle volunteer status
  - Track volunteer assignments

## 🌟 Features

### User Features

- Dual Authentication System
  - Traditional email/password signup
  - Google OAuth integration
- Profile Management
  - Profile picture upload to Cloudinary
  - Personal information management
  - Password management
- E-waste Collection Services
  - Multiple waste type selection (Mobile, Laptop, Computers, Batteries)
  - Image upload for waste items
  - Location-based agency matching
  - Real-time request tracking
- Reward System
  - E-tokens for responsible disposal
  - Track reward points

### Agency Features

- Specialized Registration System
  - Agency profile with logo
  - Service area definition
  - Waste type specialization
- Certification Management
  - Display certification status
  - Verification system
- Request Management
  - Accept/reject requests
  - Track collection progress
  - Update request status

## 🛠️ Tech Stack

### Frontend

- HTML5
- CSS3
- JavaScript
- Bootstrap 5.3
- EJS (Embedded JavaScript templates)

### Backend

- Node.js
- Express.js
- MongoDB (Database)
- Mongoose (ODM)
- Passport.js (Authentication)
- Multer (File upload)
- Cloudinary (Image storage)

### Security

- Crypto (Password hashing)
- Express-session
- Joi (Data validation)

## 🚀 Getting Started

1. Clone the repository
2. Install dependencies
3. Set up environment variables
4. Start the server

## 🔐 Environment Variables Required

env
MONGO_URL=your_mongodb_url
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
CLOUD_NAME=your_cloudinary_cloud_name
CLOUD_API_KEY=your_cloudinary_api_key
CLOUD_API_SECRET=your_cloudinary_api_secret

## 📁 Project Structure

├── models/
│ ├── user.js # User model
│ ├── agency.js # Agency model
│ └── request.js # Request model
├── views/
│ ├── user/ # User-related views
│ ├── agency/ # Agency-related views
│ └── error.ejs # Error handling view
├── public/
│ └── js/
│ └── script.js # Client-side validation
├── utils/
│ ├── ExpressError.js # Error utility
│ └── wrapAsync.js # Async wrapper
├── app.js # Main application file
├── cloudConfig.js # Cloudinary configuration
└── schema.js # Joi validation schemas

## 🔄 Authentication Flows

### Regular User Signup

1. User provides name, email, password
2. Redirected to add-details page
3. Completes profile with:
   - Phone number
   - Address
   - Pin code
   - Profile picture
   - Password confirmation
4. Accesses dashboard

### Google OAuth

1. User authenticates with Google
2. First-time users complete profile
3. Sets new password
4. Accesses dashboard

## 🛡️ Security Features

- Password hashing using crypto
- Google OAuth 2.0 integration
- Session-based authentication
- Form validation using Joi
- Protected routes
- File upload validation
- Error handling middleware

## 🔜 Planned Features

- [ ] Real-time tracking updates
- [ ] In-app notifications
- [ ] Mobile responsive design
- [ ] Chat system between users and agencies
- [ ] Analytics dashboard
- [ ] Payment integration

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the MIT License.

## 👥 Team

- [Team VASK](https://github.com/akshay81k/Technothon)
- [Akshay Kokate](https://github.com/akshay81k)
- [Vinanti Mhatre](https://github.com/vinanti)

---

© 2025 Technothon. All rights reserved.
