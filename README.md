# Technothon - E-Waste Management Platform

A web-based platform connecting users with certified e-waste collection agencies to facilitate responsible electronic waste disposal and promote environmental sustainability.

## 🕒 Latest Updates (February, 2025)

### New Features Added

  - **15/2/2025**
  - **Redemption System**
      - Merchandise Store for Users
          - Agencies can list their merchandise products on the platform
          - Users can purchase these products using earned e-points
          - Agencies handle product shipping through third-party logistics services (e.g., BlueDart)
      - Redemption flow:
          - Users browse available merchandise
          - Select item and redeem using e-points
          - Agency receives request and confirms shipping

  - **Chatbot Integration**
      - AI-powered Chatbot Assistance
          - Helps users navigate platform features
          - Provides instant responses for:
            - Waste disposal guidelines
            - Reward system queries
            - Live chat support with FAQs
            
  - **Agency Statistics**
      - Performance Metrics
        - Track number of volunteers
        - Total assigned vs free volunteers
        - Monthly e-waste processed (last 6 months)
        - Waste categorization breakdown
      - Monthly E-Waste Processing Data
        - Agency can view last six months' waste collected
        - Data includes weight, categories, and processing rates
      - Real-Time Statistics Dashboard
        - Overview of processed weight            

  - **8/2/2025**
  - Story Feature Update - Added image upload option for community stories
  - Inventory Feature Update - Added waste breakdown options in inventory management
  - Inventory Storage Exhaustion Alert - Email notification when inventory reaches 90% capacity
  
  - **7/2/2025**
  - Inventory & Admin Authorization
  - Inventory Management System
  - Agencies can now manage inventory for collected e-waste
  - User gets reward based on the items te give for recycling and Quantity of those items.
- **Inventory tracking includes:**
  - Waste type (Mobile, Laptop, Batteries, etc.)
  - Quantity in stock
  - Segregation status
  - Processing status

- **Real-time updates for:**
  - New waste additions
  - Items sent for recycling
  - Processed inventory statistics
  - Dashboard for agencies to monitor inventory levels
  - Admin Authorization for New Agencies

- **Enhanced Agency Registration Process:**
  - Agencies must now undergo an authorization process before activation

- **Required Documents:**
  - PCB Authorization Certificate (Pollution Control Board)
  - Trade License
    - Documents are uploaded and securely stored in Google Drive
    - Admin reviews and verifies documents before approval

- **Admin Dashboard for Authorizations:**
  - Pending agency requests
  - Approve/Reject agency applications
  - Document verification
  - Track agency certification status

### Community Features
- **Community Events**
      -Event Creation
      -Users and agencies can create events such as:
        -Drives
        -Webinars
        -Workshops
      -Event details include:
          -Event title
          -Description
          -Date and time
          -Location 
          -Host information
         
- **Experience Sharing**
      -Users and Agencies can share their stories or experiences related to e-waste incidents
      Includes:
          -Story title
          -Detailed description
          -Publish and share with the community

- **Updated Reward System**  
      -Users can now earn points for:       
        -Responsible e-waste disposal
        -Adding new community events

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
    - Each milestone captures exact location
  - Agency Milestones:
    - Waste Segregation
    - Start Processing
    - Complete Processing
  - Each milestone includes:
    - Completion status
    - Timestamp
    - Optional notes
    - Location coordinates and address
    - Visual representation on map

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
- Leaflet.js (Interactive Maps)

### Backend

- Node.js
- Express.js
- MongoDB (Database)
- Mongoose (ODM)
- Passport.js (Authentication)
- Multer (File upload)
- Cloudinary (Image storage)
- OpenCage Geocoding API (Address lookup)
- NodeMailer (Email )
- OpenAI 

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
7.OPENCAGE_API_KEY=your_opencage_api_key
8.APP_PASSWORD=your_gmail_app_password
9.APP_EMAIL=your_gmail
10.OPENAI_API_KEY=your_openapikey

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

- [x] Real-time location tracking with interactive map
- [ ] In-app notifications
- [ ] Mobile responsive design
- [ ] Chat system between users and agencies
- [x] Analytics dashboard
- [ ] Payment integration


## 👥 Team

- [Team VASK](https://github.com/akshay81k/Technothon)
- [Akshay Kokate](https://github.com/akshay81k)
- [Vinanti Mhatre](https://github.com/Vinantii)
- [Kartikey Patil](https://github.com/kart1k3y)
- [Soham Patil](https://github.com/soham18-20)

---

© 2025 Technothon. All rights reserved.
