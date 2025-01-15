# Technothon - E-Waste Management Platform

A web-based platform connecting users with certified e-waste collection agencies to facilitate responsible electronic waste disposal and promote environmental sustainability.

## 🕒 Latest Updates (January, 2025)

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
  - New Status Flow:
    - Pending → Accepted → Assigned → Processing → Completed
    - Request can be Rejected at initial stage
  - Clear role separation between Agency and Volunteer actions
- **Milestone Tracking System**
  - Volunteer Milestones:
    - Schedule Pickup
    - Start Pickup
    - Complete Pickup
  - Agency Milestones:
    - Waste Segregation
    - Start Processing
    - Complete Processing
  - Each milestone includes:
    - Completion status
    - Timestamp
    - Optional notes

#### Agency Dashboard Improvements
- **Request Organization**
  - New Requests (Pending)
  - Accepted Requests (Ready for volunteer assignment)
  - Assigned/Processing Requests (In progress with volunteer)
- **Status Management**
  - Accept/Reject new requests
  - Assign volunteers to accepted requests
  - Track processing status after pickup
- **Milestone Updates**
  - Agency-specific milestone controls
  - Processing stage management
  - Completion verification

#### Volunteer Dashboard Enhancements
- **Request Management**
  - View assigned requests
  - Update pickup-related milestones
  - Add notes for each status update
- **Status Controls**
  - Schedule pickup dates
  - Mark pickup started
  - Confirm pickup completion
- **Clear Progress Tracking**
  - Visual status indicators
  - Timestamp for each action
  - Historical record of completed pickups

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
1.MONGO_URL=your_mongodb_url
2.GOOGLE_CLIENT_ID=your_google_client_id
3.GOOGLE_CLIENT_SECRET=your_google_client_secret
4.CLOUD_NAME=your_cloudinary_cloud_name
5.CLOUD_API_KEY=your_cloudinary_api_key
6.CLOUD_API_SECRET=your_cloudinary_api_secret


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


## 👥 Team

- [Team VASK](https://github.com/akshay81k/Technothon)
- [Akshay Kokate](https://github.com/akshay81k)
- [Vinanti Mhatre](https://github.com/Vinantii)
- [Kartikey Patil](https://github.com/kart1k3y)
- [Soham Patil](https://github.com/soham18-20)

---

© 2025 Technothon. All rights reserved.
