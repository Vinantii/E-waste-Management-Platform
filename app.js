require("dotenv").config();

const express = require("express");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const multer = require("multer");
const cloudinary = require("./cloudConfig");
const upload = multer({ dest: "uploads/" });
const GoogleStrategy = require("passport-google-oauth20");
const { google } = require("googleapis");
const stream = require("stream");
const uploadDrive = multer({ storage: multer.memoryStorage() });
const twilio = require("twilio");
const flash = require('connect-flash');

const User = require("./models/user");
const Agency = require("./models/agency");
const Request = require("./models/request");
const Volunteer = require("./models/volunteer");
const Community = require("./models/community");
const Story = require("./models/story");
const Inventory = require("./models/inventory");
const Admin = require("./models/admin");
const Product = require("./models/product");
const Order = require("./models/order");
const Facts = require("./models/facts");
const Feedback = require("./models/feedback");
const Item = require("./models/item");

const cors = require("cors");
const OpenAI = require("openai");
const fs = require("fs");
const axios = require("axios");

const app = express();
const crypto = require("crypto");

const {
  validateUser,
  validateAgency,
  validateProfileCompletion,
  validateRequest,
  validateVolunteer,
  validateProduct,
  validateCommunity,
  validateStory,
  validateInventory,
  validateFeedback,
} = require("./schema");

// Utilities
const wrapAsync = require("./utils/wrapAsync");
const ExpressError = require("./utils/ExpressError");
const sendInventoryAlert = require("./utils/emailService");
const { request } = require("http");

const client = new twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);

// Send SMS
const sendNotification = wrapAsync(async (msg, recipient) => {
    const message = await client.messages.create({
      body: msg.concat("\n~Avakara"),
      from: process.env.TWILIO_PHONE_NUMBER, // Ensure this is in E.164 format
      to: "+91" + recipient, // Must be in E.164 format (+countrycode1234567890)
    });
    console.log(`Message sent with SID: ${message.sid}`);
    return message.sid; // Return message SID for tracking
});

// MIDDLEWARE: to protect routes
// Middleware to check if user is logged in
const isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }
  next();
};

// Middleware to check if agency is logged in
const isAgencyLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated() || !req.user.isAgency) {
    return res.redirect("/login");
  }
  next();
};

// Middleware to check if volunteer is logged in
const isVolunteerLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated() || !req.user.isVolunteer) {
    return res.redirect("/login");
  }
  next();
};

// Middleware to check if admin is logged in
const isAdminLoggedIn = async (req, res, next) => {
  try {
    // Check if the user is logged in
    if (!req.isAuthenticated() || !req.user) {
      throw new ExpressError("You must be logged in to access this page.", 401);
    }

    // Check if the user is an admin
    if (!req.user.isAdmin) {
      throw new ExpressError(
        "Access denied. Admin privileges are required.",
        403
      );
    }

    if (req.user._id.toString() !== req.params.id) {
      throw new ExpressError("Unauthorized access to this dashboard.", 403);
    }
    // If the user is logged in and is an admin, proceed
    next();
  } catch (error) {
    next(error); // Pass error to the error handler
  }
};

const checkCertificationStatus = async (req, res, next) => {
  const agency = await Agency.findById(req.user._id);
  // console.log(agency);
  if (!agency || agency.certificationStatus == "Uncertified") {
    return res.render("agency/pending-certification.ejs"); // Redirect if not certified
  }
  next();
};

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "/public")));
app.use(cors());

// Connecting to Database
main()
  .then(() => {
    console.log("Connected to Database");
  })
  .catch((err) => console.log(err));

async function main() {
  await mongoose.connect(process.env.MONGO_URL);
}

app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Passport Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async function (accessToken, refreshToken, profile, done) {
      try {
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
          user = new User({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
            profilePicture: profile.photos[0].value,
          });
          await user.save();
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// Serialize and Deserialize User
passport.serializeUser((userOrAgencyOrVolunteerOrAdmin, done) => {
  let type = "user";
  if (userOrAgencyOrVolunteerOrAdmin.isAgency) type = "agency";
  if (userOrAgencyOrVolunteerOrAdmin.isVolunteer) type = "volunteer";
  if (userOrAgencyOrVolunteerOrAdmin.isAdmin) type = "admin";

  done(null, {
    id: userOrAgencyOrVolunteerOrAdmin.id,
    type: type,
  });
});

passport.deserializeUser(async (obj, done) => {
  try {
    let entity;
    switch (obj.type) {
      case "agency":
        entity = await Agency.findById(obj.id);
        break;
      case "volunteer":
        entity = await Volunteer.findById(obj.id);
        break;
      case "admin":
        entity = await Admin.findById(obj.id);
        break;
      default:
        entity = await User.findById(obj.id);
    }
    done(null, entity);
  } catch (err) {
    done(err, null);
  }
});

// Hashing and Verification Functions
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, "sha512")
    .toString("hex");
  return `${salt}:${hash}`; // Store salt and hash together
}

function verifyPassword(password, storedPassword) {
  const [salt, hash] = storedPassword.split(":");
  const hashedBuffer = crypto
    .pbkdf2Sync(password, salt, 1000, 64, "sha512")
    .toString("hex");
  return hash === hashedBuffer;
}

// Google Drive setup
const KEYFILEPATH = path.join(__dirname, "apikey.json");
const SCOPES = ["https://www.googleapis.com/auth/drive"];
const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});
const drive = google.drive({ version: "v3", auth });

// Helper function to upload files to Google Drive
const uploadFile = async (file) => {
  const bufferStream = new stream.PassThrough();
  bufferStream.end(file.buffer);
  // console.log(file);
  const { data } = await drive.files.create({
    media: {
      mimeType: file.mimetype,
      body: bufferStream,
    },
    requestBody: {
      name: file.originalname,
      parents: ["1Tsonq-vphIw-A6PFq_QVV_uAZ0h811jF"], // Use verified folder ID
    },
    fields: "id, name",
  });

  return {
    url: `https://drive.google.com/file/d/${data.id}/view`,
    filename: data.id,
  };
};

// upload logo
const uploadLogo = async (file) => {
  const bufferStream = new stream.PassThrough();
  bufferStream.end(file.buffer);

  // Upload file to Google Drive
  const { data } = await drive.files.create({
    media: {
      mimeType: file.mimetype,
      body: bufferStream,
    },
    requestBody: {
      name: file.originalname,
      parents: ["1Tsonq-vphIw-A6PFq_QVV_uAZ0h811jF"], // Verified folder ID
    },
    fields: "id, name, webContentLink, webViewLink",
  });

  const fileId = data.id;

  // **Make the file publicly viewable**
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  return {
    url: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`, // Fallback
    filename: data.id,
  };
};

const deleteFileFromDrive = async (fileId) => {
  try {
    await drive.files.delete({ fileId });
    console.log(`Deleted file ${fileId} from Google Drive.`);
  } catch (error) {
    console.error("Error deleting file from Google Drive:", error);
  }
};

// Add this helper function at the top with other utilities
const getLocationAddress = async (coordinates) => {
  try {
    const response = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${coordinates[1]}+${coordinates[0]}&key=${process.env.OPENCAGE_API_KEY}`
    );
    const data = await response.json();
    // console.log("Data:", data);
    const extracted = data.results[0]?.formatted.replace(
      /^unnamed road,\s*/,
      ""
    );
    // console.log("Address:", extracted);
    return extracted || "Location unavailable";
  } catch (error) {
    console.error("Error getting address:", error);
    return "Location unavailable";
  }
};

const updateUserPointsOnCompletion = wrapAsync(async (request) => {
  if (request.status !== "Completed") return;

  const WASTE_TYPE_POINTS = {
    mobile: 50,
    phones: 50,
    computers: 150,
    laptop: 100,
    Batteries: 20,
  };

  const user = await User.findById(request.user);
  if (!user) {
    console.error("User not found for request:", request._id);
    return;
  }

  let points = user.points;
  let monthlyPoints = user.monthlyPoints;

  request.wasteType.forEach((type, index) => {
    let perUnitPoints = WASTE_TYPE_POINTS[type] || 0;
    points += perUnitPoints * request.quantities[index];
    monthlyPoints += perUnitPoints * request.quantities[index];
  });

  await User.findByIdAndUpdate(user._id, {
    points,
    monthlyPoints,
    $inc: { completedRequests: 1 },
  });
});

//TODO Root  route
app.get(
  "/",
  wrapAsync(async (req, res) => {
    const facts = await Facts.find();
    const feedbacks = await Feedback.find().populate("user", "name profilePic");
    res.render("index.ejs", { facts, feedbacks });
  })
);

// TODO: Register Admin
app.post(
  "/register/admin",
  wrapAsync(async (req, res) => {
    let admin = {
      name: "Admin",
      email: "admin123@gmail.com",
      password: hashPassword("admin1234"),
    };
    const newAdmin = new Admin(admin);
    await newAdmin.save();
    res.send("Admin saved");
  })
);

//TODO: Admin dashboard
app.get(
  "/admin/:id/dashboard",
  isAdminLoggedIn,
  wrapAsync(async (req, res) => {
    const certifiedAgencies = await Agency.find({
      certificationStatus: "Certified",
    });
    const uncertifiedAgencies = await Agency.find({
      certificationStatus: "Uncertified",
    });
    let { id } = req.params;
    res.render("admin/dashboard.ejs", {
      certifiedAgencies,
      uncertifiedAgencies,
      id,
    });
  })
);

app.post(
  "/agency/:id/approve/:agencyId",
  isAdminLoggedIn,
  wrapAsync(async (req, res) => {
    const { id, agencyId } = req.params;
    await Agency.findByIdAndUpdate(
      agencyId,
      { $set: { certificationStatus: "Certified" } },
      { new: true, runValidators: true }
    );
    res.redirect(`/admin/${id}/dashboard`);
  })
);

//TODO: Register user Route
app.get(
  "/register/user",
  wrapAsync(async (req, res) => {
    res.render("user/signup.ejs");
  })
);

app.post(
  "/register/user",
  validateUser,
  wrapAsync(async (req, res) => {
    try {
      const hashedPassword = hashPassword(req.body.user.password);
      const userData = {
        name: req.body.user.name,
        email: req.body.user.email,
        password: hashedPassword,
      };

      const newUser = new User(userData);
      await newUser.save();

      req.login(newUser, (err) => {
        if (err) throw new ExpressError("Error during login", 500);
        res.redirect(`/user/${newUser._id}/add-details`);
      });
    } catch (error) {
      throw new ExpressError(error.message, 400);
    }
  })
);

// Google Authentication Routes (User only)
app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    failureMessage: true,
    successRedirect: "/auth/google/success",
  }),
  (req, res) => {
    const returnTo = req.session.returnTo || "/";
    delete req.session.returnTo;

    if (!req.user.phone || !req.user.address || !req.user.pinCode) {
      return res.redirect(`/user/${req.user._id}/add-details`);
    }
    res.redirect(`/user/${req.user._id}/dashboard`);
  }
);

// Add a new route to handle successful authentication
app.get("/auth/google/success", (req, res) => {
  if (!req.user) {
    return res.redirect("/login");
  }

  if (!req.user.phone || !req.user.address || !req.user.pinCode) {
    return res.redirect(`/user/${req.user._id}/add-details`);
  }
  res.redirect(`/user/${req.user._id}/dashboard`);
});

app.get(
  "/user/:id/add-details",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      throw new ExpressError("User not found", 404);
    }
    res.render("user/add-details.ejs", { user });
  })
);

app.post(
  "/user/:id/complete-profile",
  isLoggedIn,
  upload.single("profileImage"),
  validateProfileCompletion,
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    if (!req.file) {
      throw new ExpressError("Profile picture is required", 400);
    }

    const user = await User.findById(id);
    if (!user) {
      throw new ExpressError("User not found", 400);
    }

    // Handle password validation differently for Google users
    if (user.googleId) {
      // For Google users, just set the new password
      if (!req.body.password) {
        throw new ExpressError("Password is required", 400);
      }
    } else {
      // For regular users, verify the password matches signup password
      if (!verifyPassword(req.body.password, user.password)) {
        throw new ExpressError(
          "Password does not match your signup password",
          400
        );
      }
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "Technothon",
      resource_type: "auto",
    });

   // Ensure location coordinates are properly formatted
   const coordinates = req.body.user.location?.coordinates;
   if (!Array.isArray(coordinates) || coordinates.length !== 2) {
     throw new ExpressError("Invalid location coordinates", 400);
   }

   // Convert coordinates to numbers
   const formattedCoordinates = coordinates.map((coord) => Number(coord));
    await User.findByIdAndUpdate(id, {
      phone: req.body.phone,
      address: req.body.address,
      pinCode: req.body.pinCode,
      ...(user.googleId && { password: hashPassword(req.body.password) }), // Only update password for Google users
      profilePic: {
        url: result.secure_url,
        filename: result.public_id,
      },
      location: {
        type: "Point",
        coordinates: formattedCoordinates,
      },
    });

    res.redirect(`/user/${id}/dashboard`);
  })
);

//TODO: Login Logic

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async function (email, password, done) {
      try {
        // First check for user
        const user = await User.findOne({ email: email });
        if (user) {
          if (!verifyPassword(password, user.password)) {
            return done(null, false, { message: "Incorrect password." });
          }
          return done(null, user);
        }

        // If no user found, check for agency
        const agency = await Agency.findOne({ email: email });
        if (agency) {
          if (!verifyPassword(password, agency.password)) {
            return done(null, false, { message: "Incorrect password." });
          }
          return done(null, agency);
        }

        // If no agency or user then check for volunteer
        const volunteer = await Volunteer.findOne({ email: email });
        if (volunteer) {
          if (!verifyPassword(password, volunteer.password)) {
            return done(null, false, { message: "Incorrect password." });
          }
          return done(null, volunteer);
        }

        // If neither is fount then check for admin
        const admin = await Admin.findOne({ email: email });
        if (admin) {
          if (!verifyPassword(password, admin.password)) {
            return done(null, false, { message: "Incorrect password." });
          }
          return done(null, admin);
        }

        // If no match found
        return done(null, false, { message: "Incorrect email." });
      } catch (err) {
        return done(err);
      }
    }
  )
);

// TODO: Login Route
app.get(
  "/login",
  wrapAsync(async (req, res) => {
    res.render("user/login.ejs", { showGoogleAuth: true });
  })
);

app.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureMessage: true,
  }),
  (req, res) => {
    if (req.user.isAgency) {
      res.redirect(`/agency/${req.user._id}/dashboard`);
    } else if (req.user.isVolunteer) {
      res.redirect(`/volunteer/${req.user._id}/dashboard`);
    }
    if (req.user.isAdmin) {
      res.redirect(`/admin/${req.user._id}/dashboard`);
    } else {
      res.redirect(`/user/${req.user._id}/dashboard`);
    }
  }
);

// TODO: logout route
app.get(
  "/logout",
  wrapAsync(async (req, res) => {
    req.logout((err) => {
      if (err) {
        throw new ExpressError("Error during logout", 500);
      }
      res.redirect("/");
    });
  })
);

//TODO:agency registration

app.get(
  "/register/agency",
  wrapAsync(async (req, res) => {
    res.render("agency/signup.ejs");
  })
);

app.post(
  "/register/agency",
  uploadDrive.fields([
    { name: "agencyLogo", maxCount: 1 },
    { name: "tradeLicense", maxCount: 1 },
    { name: "pcbAuth", maxCount: 1 },
  ]),
  validateAgency,
  wrapAsync(async (req, res) => {
    // Ensure agency logo is uploaded
    if (!req.files["agencyLogo"]) {
      throw new ExpressError("Agency logo is required", 400);
    }

    let logoData = { url: "", filename: "" };
    if (req.files["agencyLogo"]) {
      logoData = await uploadLogo(req.files["agencyLogo"][0]);
    }
    if (!req.body.agency || !req.body.agency.password) {
      throw new ExpressError("Invalid registration data", 400);
    }

    // Ensure location coordinates are properly formatted
    const coordinates = req.body.agency.location?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      throw new ExpressError("Invalid location coordinates", 400);
    }

    // Convert coordinates to numbers
    const formattedCoordinates = coordinates.map((coord) => Number(coord));

    const hashedPassword = hashPassword(req.body.agency.password);

    // Upload trade license & PCB authorization PDFs to Google Drive
    let tradeLicenseData = { url: "", filename: "" };
    let pcbAuthData = { url: "", filename: "" };
    if (req.files["tradeLicense"]) {
      tradeLicenseData = await uploadFile(req.files["tradeLicense"][0]);
    }
    if (req.files["pcbAuth"]) {
      pcbAuthData = await uploadFile(req.files["pcbAuth"][0]);
    }
    // Create agency object with uploaded file URLs and filenames
    const agencyData = {
      ...req.body.agency,
      password: hashedPassword,
      isAgency: true,
      logo: logoData,
      location: {
        type: "Point",
        coordinates: formattedCoordinates,
      },
      documents: {
        tradeLicense: tradeLicenseData,
        pcbAuth: pcbAuthData,
      },
    };

    // Save agency to the database
    const newAgency = new Agency(agencyData);
    await newAgency.save();

    // Log in the agency after registration
    req.login(newAgency, (err) => {
      if (err) {
        throw new ExpressError("Error during login after registration", 500);
      }
      res.redirect(`/agency/${newAgency._id}/setup-inventory`);
    });
  })
);

app.get(
  "/agency/:id/setup-inventory",
  isLoggedIn,
  checkCertificationStatus,
  wrapAsync(async (req, res) => {
    let newAgency = await Agency.findById(req.params.id);

    res.render("agency/setup-inventory.ejs", { newAgency });
  })
);

// setup inventory route
app.post(
  "/agency/:id/setup-inventory",
  isAgencyLoggedIn,
  checkCertificationStatus,
  validateInventory,
  wrapAsync(async (req, res) => {
    let { id } = req.params;
    let agency = await Agency.findById(id);
    let inventory = new Inventory({
      ...req.body.inventory,
      agencyId: agency._id,
    });
    await Agency.findByIdAndUpdate(id, { isInventorySetup: true });
    await inventory.save();
    res.redirect(`/agency/${agency._id}/dashboard`);
  })
);

// TODO: User Dashboard Route
app.get(
  "/user/:id/dashboard",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new ExpressError("User not found", 404);
    }
    res.render("user/dashboard.ejs", { user });
  })
);

// TODO: User Profile Route
app.get(
  "/user/:id/profile",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    let user = await User.findById(req.params.id);
    res.render("user/profile.ejs", { user });
  })
);

//TASK: Update Profile
app.put("/user/:id", upload.single("profilePic"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address, email, pinCode, latitude, longitude } =
      req.body;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Handle Image Upload (If New Image is Provided)
    if (req.file) {
      if (user.profilePic.filename) {
        //Delete old image from Cloudinary
        await cloudinary.uploader.destroy(user.profilePic.filename);
      }

      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "Technothon",
        resource_type: "auto",
      });

      // Upload New Image
      user.profilePic = {
        url: result.secure_url,
        filename: result.public_id,
      };
    }
    // Update User Details
    user.name = name;
    user.phone = phone;
    user.address = address;
    user.email = email;
    user.pinCode = pinCode;
    user.location.coordinates = [longitude, latitude];
    await user.save();

    res.redirect(`/user/${id}/profile`);
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).send("Error updating profile.");
  }
});

//TASK: Delete Profile
app.delete("/user/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Delete Profile Image from Cloudinary (If Exists)
    if (user.profilePic.filename) {
      await cloudinary.uploader.destroy(user.profilePic.filename);
    }

    await Story.deleteMany({ "author.user": user._id });
    await Feedback.deleteMany({user: user._id });
    await Order.deleteMany({ user: user._id });
    await Item.deleteMany({ user: user._id });

    const requests = await Request.find({ user: user._id });

    for (const request of requests) {
      if (request.status === "Completed") {
        if (request.volunteerAssigned) {
          await Volunteer.findByIdAndUpdate(request.volunteerAssigned, {
            $pull: { assignedRequests: request._id },
          });
        }

        if (request.agency) {
          await Agency.findByIdAndUpdate(request.agency, {
            $pull: { requests: request._id },
          });
        }

        await Request.findByIdAndDelete(request._id);
      }
    }
    // Delete User from Database
    await User.findOneAndDelete({ _id: user._id });

    res.redirect("/"); // Redirect to signup page after deletion
  } catch (error) {
    console.error("Error deleting profile:", error);
    res.status(500).send("Error deleting profile.");
  }
});

// // TODO: User Apply Request Route
// app.get(
//   "/user/:id/apply-request",
//   isLoggedIn,
//   wrapAsync(async (req, res) => {
//     const user = await User.findById(req.params.id);
//     if (!user) {
//       throw new ExpressError("User not found", 404);
//     }

//     // Fetch all certified agencies
//     const agencies = await Agency.find({
//       certificationStatus: "Certified",
//     }).select("name region wasteTypesHandled");

//     res.render("user/apply-request.ejs", {
//       currentUser: user,
//       agencies: agencies,
//     });
//   })
// );

app.get(
  "/user/:id/apply-request",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new ExpressError("User not found", 404);
    }

    // Ensure user has valid coordinates
    if (!user.location || !user.location.coordinates || user.location.coordinates.length !== 2) {
      throw new ExpressError("User location is missing or invalid", 400);
    }

    const userCoordinates = user.location.coordinates; // [longitude, latitude]

    // Fetch certified agencies within 10 km using geoNear
    const agencies = await Agency.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: userCoordinates },
          distanceField: "distance",
          maxDistance: 50000,
          spherical: true
        }
      },
      { $match: { certificationStatus: "Certified" } }, // Only certified agencies
      { 
        $project: { 
          name: 1, 
          region: 1, 
          wasteTypesHandled: 1, 
          location: 1, 
          distance: 1 // Include distance in the results
        } 
      },
      { $sort: { distance: 1 } } // Sorting agencies by distance (closest first)
    ]);
    
    console.log(agencies);

    res.render("user/apply-request.ejs", {
      currentUser: user,
      agencies: agencies
    });
  })
);

app.post(
  "/user/:id/apply-request",
  isLoggedIn,
  upload.array("wasteImages[]", 5),
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!req.files || req.files.length === 0) {
      throw new ExpressError("Please upload at least one image", 400);
    }

    // Validate the request data first
    validateRequest(req, res, async () => {
      // Upload all images to Cloudinary
      const uploadPromises = req.files.map((file) =>
        cloudinary.uploader.upload(file.path, {
          folder: "Technothon",
          resource_type: "auto",
        })
      );

      const uploadResults = await Promise.all(uploadPromises);

      // Verify the selected agency exists
      const agency = await Agency.findById(req.body.request.agency);
      if (!agency) {
        throw new ExpressError("Selected agency not found", 400);
      }

      // Create and save the request with multiple waste types and quantities
      const newRequest = new Request({
        ...req.body.request,
        user: id,
        agency: agency._id,
        status: "Pending",
        wasteType: req.body.request.wasteType,
        quantities: req.body.request.quantities,
        wasteImages: uploadResults.map((result) => ({
          url: result.secure_url,
          filename: result.public_id,
        })),
      });

      await newRequest.save();
      res.redirect(`/user/${id}/check-request`);
    });
  })
);

app.post(
  "/classify-image",
  isLoggedIn,
  upload.single("image"),
  wrapAsync(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const imagePath = req.file.path;
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Image,
                },
              },
              {
                text: "Classify this as Battery, Laptop, Computer, or Mobile.",
              },
            ],
          },
        ],
      },
      { headers: { "Content-Type": "application/json" } }
    );

    let result = response.data.candidates[0].content.parts[0].text
      .trim()
      .toLowerCase();

    // Standardize the output category
    const validCategories = ["battery", "laptop", "computer", "mobile"];
    const matchedCategory = validCategories.find((category) =>
      result.includes(category)
    );

    res.json({
      category: matchedCategory || null,
      imageUrl: `/${req.file.filename}`,
    });
  })
);


// TODO: Request delete route user
app.delete("/user/request/:id/delete",isLoggedIn, wrapAsync(async (req,res) =>{
  const request = await Request.findById(req.params.id);
  if(!request){
    throw new ExpressError("Request is not available", 400);
  }
  const accpetedStatus = ["Pending","Accepted","Assigned"];
  if(!accpetedStatus.includes(request.status) || request.trackingMilestones.pickupStarted.completed === "false"){
    throw new ExpressError("You cannot cancel the requets as the request has already been processed.", 400);
  }
  
  // Remove the request from the user's requests array
  await User.findByIdAndUpdate(req.user._id, { $pull: { requests: request._id } });
  await Volunteer.findByIdAndUpdate(request.volunteerAssigned, { $pull: { assignedRequests: request._id } });
  await Agency.findByIdAndUpdate(request.agency, { $pull: { requests: request._id } });
  await Request.findByIdAndDelete(request._id);
  res.redirect(`/user/${req.user._id}/check-request`);

}));


// TODO: User Check Request Route
app.get(
  "/user/:id/check-request",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.params.id).populate({
      path: "requests",
      populate: {
        path: "agency",
        select: "name",
      },
    });

    if (!user) {
      throw new ExpressError("User not found", 404);
    }

    res.render("user/check-request", {
      requests: user.requests,
      currentUser: req.user,
    });
  })
);

//TODO: Track Request Route
app.get(
  "/user/request/:id/track",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const request = await Request.findById(req.params.id)
      .populate("agency")
      .populate("user")
      .populate("volunteerAssigned");

    if (!request) {
      throw new ExpressError("Request not found", 404);
    }

    res.render("user/track-request.ejs", {
      request,
      currentUser: req.user,
    });
  })
);

// // TODO:User Reward Route
// app.get(
//   "/user/:id/reward",
//   isLoggedIn,
//   wrapAsync(async (req, res) => {
//     const user = await User.findById(req.params.id).populate("requests");

//     // Get top 5 users by points
//     const topUsers = await User.find().sort({ points: -1 }).limit(5);

//     res.render("user/reward.ejs", { user, topUsers });
//   })
// );

// TODO:User Reward Route
app.get(
  "/user/:id/reward",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.params.id).populate("requests");

    // Step 1: Retrieve users who have a valid rank (lastRank is not null)
    const topUsers = await User.find({ "ranking.lastRank": { $ne: null } })
      .sort({ "ranking.lastRank": 1 }) // Sort by rank (1st place → top)
      .limit(5);

    // Step 2: Render the leaderboard with existing ranks
    res.render("user/reward.ejs", { user, topUsers });
  })
);

// TODO: User side Community Route
app.get(
  "/user/:id/community",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.params.id);
    const allCommunity = await Community.find();
    const allStories = await Story.find();
    res.render("user/community.ejs", { user, allCommunity, allStories });
  })
);

// Add community event button
app.get(
  "/user/:id/community/add",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.params.id);
    res.render("user/add-community.ejs", { user });
  })
);

app.post(
  "/user/:id/community/add",
  isLoggedIn,
  validateCommunity,
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { title, description, registrationLink } = req.body.community;

    // Verify event registration link using Gemini
    const requestBody = {
      model: "gemini-1.5-flash",
      contents: [{
        role: "user",
        parts: [{
          text: `Analyze the given community event registration link and classify it as:

          Rules:
          - **"VALID"** if it belongs to a trusted event platform (e.g., Eventbrite, Meetup, university/government domains).
          - **"FAKE"** if it appears suspicious, contains random characters, or resembles phishing links.
          - **"UNKNOWN"** if there is not enough information.
          **RULES:**
          - If the text contains random letters or meaningless words (e.g., "fdsg dfgdfg fdhgf"), return "FAKE".
          - If the text promotes irrelevant or suspicious offers (e.g., "Win a free laptop now!"), return "FAKE".
          - If the text is about **cleaning drives, e-waste drives, environmental awareness, or sustainability events**, return "VALID".
          - If the text is **just a general personal story without relevance to cleaning or e-waste**, return "FAKE".

          Return only: "VALID", "FAKE", or "UNKNOWN".

          Event Title: "${title}"
          Registration Link: "${registrationLink}"
          Description:"${description}"`
        }]
      }]
    };

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );

      const result = await response.json();

      const aiResponse = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase() || "UNKNOWN";
      if (aiResponse === "FAKE") {
        throw new ExpressError("The provided data is spam.", 400);
      }

      // Create new community event with verified link
      const newCommunity = new Community({
        ...req.body.community,
        organizer: {
          user: req.params.id,
          agency: null,
        },
      });

      await newCommunity.save();

      res.redirect(`/user/${user._id}/community`);

    } catch (error) {
      console.error("Error verifying event registration link:", error);
      throw new ExpressError("Event registration link verification failed.", 500);
    }
  })
);


// TODO: Add story button
app.get(
  "/user/:id/story/add",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.params.id);
    res.render("user/add-story.ejs", { user });
  })
);

// TASK: Spam checking

app.post("/check-spam", isLoggedIn, wrapAsync(async (req, res) => {
  const { title, content } = req.body;

  const requestBody = {
      model: "gemini-1.5-flash",
      contents: [{
          role: "user",
          parts: [{
              text: `Analyze the provided text and strictly classify it as one of the following categories:

                - "SPAM" if the text contains promotional, scam, misleading, or harmful content.
                - "GIBBERISH" if the text consists of random characters, meaningless words, or lacks coherent sentence structure.
                - "NOSPAM" if the text is a meaningful user-generated entry related to:
                  E-waste experiences, recycling, awareness, or disposal.
                  Environmental activities like cleaning drives, awareness events, and sustainability efforts.

                Rules:
                - If the text contains random letters or meaningless words (e.g., "fdsg dfgdfg fdhgf"), return "GIBBERISH".
                - If the text promotes irrelevant or suspicious offers (e.g., "Win a free laptop now!"), return "SPAM".
                - If the text is about **cleaning drives, e-waste drives, environmental awareness, or sustainability events**, return "NOSPAM".
                - If the text is **just a general personal story without relevance to cleaning or e-waste**, return "SPAM".

                Respond with only one word: "SPAM", "GIBBERISH", or "NOSPAM". No explanations, formatting, or extra text.

              Title: "${title}" 
              Content: "${content}"`
          }]
      }]
  };

  try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      const aiResponse = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase() || "UNKNOWN";

      if (!["SPAM", "GIBBERISH", "NOSPAM"].includes(aiResponse)) {
          console.warn("Unexpected AI response format. Defaulting to NOSPAM.");
      }

      res.json({ 
          isSpam: aiResponse === "SPAM" || aiResponse === "GIBBERISH", 
          category: aiResponse 
      });

  } catch (error) {
      console.error("Spam check error:", error);
      res.status(500).json({ error: "Spam detection failed" });
  }
}));




app.post(
  "/user/:id/story/add",
  isLoggedIn,
  upload.single("media"),
  validateStory,
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    // console.log(req.file);
    if (!req.file) {
      throw new ExpressError("Media picture is required", 400);
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "Technothon",
      resource_type: "auto",
    });

    const newStory = new Story({
      ...req.body.story,
      author: {
        user: req.params.id, // Set the user ID in the nested structure
        agency: null, // Set to null or the agency ID if available
      },
      media: {
        url: result.secure_url,
        filename: result.public_id,
      },
    });
    // Save the new community
    await newStory.save();
    res.redirect(`/user/${user._id}/community`);
  })
);

//TASK: Delete Story
app.delete(
  "/user/:id/story/:storyId",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const { id, storyId } = req.params;
    const user = await User.findById(id);
    if (!user) {
      throw new ExpressError("User not found", 404);
    }
    const story = await Story.findById(storyId);
    if (!story) {
      throw new ExpressError("Story not found", 404);
    }
    // Delete Story Image from Cloudinary (If Exists)
    if (story.media.filename) {
      await cloudinary.uploader.destroy(story.media.filename);
    }
    await Story.findByIdAndDelete(storyId);
    res.redirect(`/user/${id}/community`);
  })
);

//TODO: User side Marketplace
app.get("/user/:id/marketplace",isLoggedIn, wrapAsync(async(req,res) =>{
  const userId = req.params.id;

  const pendingItems = await Item.find({ status: "pending", user: userId }).populate("user", "name email phone");
  const approvedItems = await Item.find({ status: "approved", user: userId }).populate("user", "name email phone");
  const rejectedItems = await Item.find({ status: "rejected", user: userId }).populate("user", "name email phone");
  const allItems = await await Item.find({ status: "approved" }).populate("user", "name email phone");
  res.render('user/marketplace.ejs',{id:req.params.id, pendingItems, approvedItems, rejectedItems, allItems});
})
);


app.post("/user/:id/marketplace/add",isLoggedIn, upload.fields([{ name: "itemImage" }, { name: "billImage" }]), wrapAsync(async (req, res) => {

    const { itemName, brandName, price, numberOfMonthsUsed } = req.body;
    const userId = req.params.id;

    let itemImageData = { url: "", filename: "" };
    let billImageData = { url: "", filename: "" };

    // Upload item image to Cloudinary
    if (req.files["itemImage"]) {
      const itemImageResult = await cloudinary.uploader.upload(req.files["itemImage"][0].path, {
        folder: "Technothon",
        resource_type: "image",
      });
      itemImageData = {
        url: itemImageResult.secure_url,
        filename: itemImageResult.public_id,
      };
    }

    // Upload bill image to Cloudinary
    if (req.files["billImage"]) {
      const billImageResult = await cloudinary.uploader.upload(req.files["billImage"][0].path, {
        folder: "Technothon",
        resource_type: "image",
      });
      billImageData = {
        url: billImageResult.secure_url,
        filename: billImageResult.public_id,
      };
    }

    // Check if both uploads were successful
    if (!itemImageData.url || !billImageData.url) {
      throw new ExpressError("Image upload failed", 400);
    }

    // Create a new marketplace item and store image details
    const newItem = new Item({
      user:userId,
      itemName,
      brandName,
      price,
      numberOfMonthsUsed,
      itemImage: itemImageData,
      billImage: billImageData,
    });

    await newItem.save();
    res.redirect(`/user/${userId}/marketplace`)

}));



// TODO:Agency dashboard
 app.get(
  "/agency/:id/dashboard",
  isAgencyLoggedIn,
  checkCertificationStatus,
  wrapAsync(async (req, res) => {
    const agencyId = new mongoose.Types.ObjectId(req.params.id);
    const agency = await Agency.findById(req.params.id);
    // Fetch completed requests with location and weight
    const requests = await Request.find(
      {
        agency: agencyId,
        status: "Completed",
        pickupLocation: { $exists: true }, // Ensure location exists
        weight: { $exists: true }, // Ensure weight exists
      },
      "pickupLocation weight"
    );

    // Transform data for heatmap with validation
    // const heatmapData = requests
    //   .filter(
    //     (request) =>
    //       request.pickupLocation &&
    //       request.pickupLocation.coordinates &&
    //       request.pickupLocation.coordinates.length === 2 &&
    //       request.weight
    //   )
    //   .map((request) => ({
    //     lat: request.pickupLocation.coordinates[1],
    //     lng: request.pickupLocation.coordinates[0],
    //     intensity: request.weight || 1, // Default to 1 if weight is missing
    //   }));

    // Volunteers statistics
    const totalVolunteers = await Volunteer.countDocuments({
      agency: agencyId,
    });
    const assignedVolunteers = await Volunteer.countDocuments({
      agency: agencyId,
      assignedRequests: { $exists: true, $not: { $size: 0 } },
    });
    const freeVolunteers = await Volunteer.countDocuments({
      agency: agencyId,
      assignedRequests: { $size: 0 },
    });

    // Monthly E-Waste Processed - Last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Generate array of last 6 months
    const monthsArray = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
      };
    }).reverse();

    const monthlyEwasteData = await Request.aggregate([
      {
        $match: {
          agency: agencyId,
          status: "Completed",
          pickupDate: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$pickupDate" },
            month: { $month: "$pickupDate" },
          },
          totalWeight: { $sum: "$weight" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Fill in missing months with zero values
    const filledMonthlyData = monthsArray.map((monthYear) => {
      const existingData = monthlyEwasteData.find(
        (d) => d._id.year === monthYear.year && d._id.month === monthYear.month
      );
      return {
        _id: {
          year: monthYear.year,
          month: monthYear.month,
        },
        totalWeight: existingData ? existingData.totalWeight : 0,
      };
    });

    // Format the monthly data
    const monthlyEwaste =
      monthlyEwasteData.length > 0 ? monthlyEwasteData[0].totalWeight : 0;

    // E-Waste Categorization
    const ewasteCategories = await Request.aggregate([
      { $match: { agency: agencyId } },
      { $unwind: "$wasteType" }, // Ensuring wasteType is an array
      {
        $group: {
          _id: "$wasteType",
          totalQuantity: { $sum: { $ifNull: [{ $sum: "$quantities" }, 0] } },
        },
      },
      { $sort: { totalQuantity: -1 } },
    ]);

    res.render("agency/dashboard.ejs", {
      totalVolunteers,
      assignedVolunteers,
      freeVolunteers,
      monthlyEwaste,
      monthlyEwasteData: filledMonthlyData, // Use the filled data
      ewasteCategories,
      // heatmapData,
      agencyId,
      agency
    });
    
    // res.render("agency/dashboard.ejs", { agency });
  })
);

// TODO: Agency Profile Route
app.get(
  "/agency/:id/profile",
  isAgencyLoggedIn,
  checkCertificationStatus,
  wrapAsync(async (req, res) => {
    const agency = await Agency.findById(req.params.id);
    res.render("agency/profile.ejs", { agency });
  })
);

//TASK: Update Profile
app.put(
  "/agency/:id",
  uploadDrive.fields([
    { name: "logo", maxCount: 1 },
    { name: "tradeLicense", maxCount: 1 },
    { name: "pcbAuth", maxCount: 1 },
  ]),
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    const {
      name,
      description,
      agencyType,
      workingHours,
      wasteTypesHandled,
      phone,
      contactPerson,
      region,
      address,
    } = req.body;

    const agency = await Agency.findById(id);
    if (!agency) {
      return res.status(404).json({ error: "Agency not found" });
    }

    let logoData = agency.logo;
    let tradeLicenseData = agency.documents.tradeLicense;
    let pcbAuthData = agency.documents.pcbAuth;

    // ✅ Handle Logo Update (Delete Old & Upload New)
    if (req.files["logo"]) {
      if (agency.logo.filename) await deleteFileFromDrive(agency.logo.filename); // Delete old logo from Google Drive
      logoData = await uploadLogo(req.files["logo"][0]); // Upload new logo
    }

    // ✅ Handle Trade License Update (Delete Old & Upload New)
    if (req.files["tradeLicense"]) {
      if (agency.documents.tradeLicense.filename)
        await deleteFileFromDrive(agency.documents.tradeLicense.filename); // Delete old trade license
      tradeLicenseData = await uploadFile(req.files["tradeLicense"][0]); // Upload new trade license
    }

    // Handle PCB Authorization Update (Delete Old & Upload New)
    if (req.files["pcbAuth"]) {
      if (agency.documents.pcbAuth.filename)
        await deleteFileFromDrive(agency.documents.pcbAuth.filename); // Delete old PCB Auth
      pcbAuthData = await uploadFile(req.files["pcbAuth"][0]); // Upload new PCB Auth
    }

    // ✅ Update Agency Data
    await Agency.findByIdAndUpdate(
      id,
      {
        name,
        description,
        agencyType,
        workingHours,
        wasteTypesHandled,
        phone,
        contactPerson,
        region,
        address,
        logo: logoData,
        documents: {
          tradeLicense: tradeLicenseData,
          pcbAuth: pcbAuthData,
        },
        updatedAt: Date.now(),
      },
      { runValidators: true } // Return updated document & enforce validation
    );

    res.redirect(`/agency/${id}/profile`);
  })
);

//TASK: Delete Profile
app.delete(
  "/agency/:id",
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    const agency = await Agency.findById(id);
    if (!agency) {
      throw new ExpressError("Agency not found", 404);
    }

    if (agency.logo && agency.logo.filename) {
      await deleteFileFromDrive(agency.logo.filename);
    }

    if (
      agency.documents.tradeLicense &&
      agency.documents.tradeLicense.filename
    ) {
      await deleteFileFromDrive(agency.documents.tradeLicense.filename);
    }
    if (agency.documents.pcbAuth && agency.documents.pcbAuth.filename) {
      await deleteFileFromDrive(agency.documents.pcbAuth.filename);
    }

    await Agency.findByIdAndDelete(id);
    res.redirect("/");
  })
);

// TODO: Agency Requests Route
app.get(
  "/agency/:id/requests",
  isAgencyLoggedIn,
  checkCertificationStatus,
  wrapAsync(async (req, res) => {
    const requests = await Request.find({ agency: req.params.id })
      .populate("user", "name email")
      .populate("volunteerAssigned", "name")
      .sort({ createdAt: -1 });

    // Fetch active volunteers for the agency
    const volunteers = await Volunteer.find({
      agency: req.params.id,
      status: "Active",
    });
    // console.dir(requests);
    res.render("agency/requests.ejs", { requests, volunteers });
  })
);

//Accept request
app.post(
  "/agency/requests/:id/approve",
  isAgencyLoggedIn,
  checkCertificationStatus,
  wrapAsync(async (req, res) => {
    const request = await Request.findById(req.params.id)
      .populate("user", "phone")
      .populate("agency", "name"); // Populating agency and fetching only the name field

    const inventory = await Inventory.findOne({ agencyId: request.agency });

    if (!request) throw new ExpressError("Request not found", 404);
    if (!inventory) throw new ExpressError("Inventory not found", 404);

    // **Check if inventory has enough space**
    if (inventory.currentCapacity + request.weight > inventory.totalCapacity) {
      throw new ExpressError("Insufficient inventory capacity!", 400);
    }

    request.status = "Accepted";
    // sendNotification(
    //  `${request.agency.name} Agency Accepted your ewaste collection request`,
    //   request.user.phone
    // );

    // Important: Only update the specific milestone, not the entire trackingMilestones object
    request.trackingMilestones.agencyAccepted = {
      completed: true,
      timestamp: new Date(),
      notes: `Request accepted by ${req.user.name}`,
    };

    await request.save();
    res.redirect(`/agency/${req.user._id}/requests#Accepted`);
  })
);

// Reject request
app.post(
  "/agency/request/:id/reject",
  isAgencyLoggedIn,
  checkCertificationStatus,
  wrapAsync(async (req, res) => {
    const requestId = req.params.id;

    // Find the request to get user ID before deletion
    const request = await Request.findById(req.params.id)
      .populate("user", "phone")
      .populate("agency", "name");
    if (!request) {
      throw new ExpressError("Request not found", 404);
    }

    // Update user's requests array - remove the request ID
    await User.findByIdAndUpdate(request.user, {
      $pull: { requests: requestId },
    });

    // Update agency's requests array - remove the request ID
    await Agency.findByIdAndUpdate(req.user._id, {
      $pull: { requests: requestId },
    });

    // Update request status to Rejected (don't delete it so user can see the status)
    await Request.findByIdAndUpdate(requestId, {
      status: "Rejected",
      rejectedAt: new Date(),
    });

    // sendNotification(
    //   `${request.agency.name} Agency Rejected your ewaste collection request`,
    //   request.user.phone
    // );
    res.redirect(`/agency/${req.user._id}/requests`);
  })
);

// Approve Request -> Change the request status from approved to in progress = Assigning Volunteer
app.post(
  "/agency/request/:id/assign-volunteer",
  isAgencyLoggedIn,
  checkCertificationStatus,
  wrapAsync(async (req, res) => {
    const volunteerId = req.body.volunteerId;
    const { id } = req.params;
    const request = await Request.findById(req.params.id)
      .populate("user", "phone")
      .populate("agency", "name");
    const volunteer = await Volunteer.findById(volunteerId);

    if (!request || !volunteer) {
      throw new ExpressError("Request or Volunteer not found", 404);
    }

    request.volunteerAssigned = volunteerId;
    request.volunteerName = volunteer.name;
    request.status = "Assigned";
    // sendNotification(
    //   `Volunteer ${volunteer.name} assigned to handle the request`,
    //   request.user.phone
    // );

    // Important: Only update the specific milestone
    request.trackingMilestones.volunteerAssigned = {
      completed: true,
      timestamp: new Date(),
      notes: `Volunteer ${volunteer.name} assigned to handle the request`,
    };

    volunteer.assignedRequests.push(id);

    await Promise.all([request.save(), volunteer.save()]);
    res.redirect(`/agency/${req.user._id}/requests#Assigned`);
  })
);

app.post(
  "/agency/request/:id/update-status",
  isAgencyLoggedIn,
  checkCertificationStatus,
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    const { milestone, notes, latitude, longitude } = req.body;

    // Define allowed milestones for agency
    const allowedAgencyMilestones = [
      "wasteSegregated",
      "processingStarted",
      "processingCompleted",
    ];

    if (!allowedAgencyMilestones.includes(milestone)) {
      throw new ExpressError("Invalid milestone for agency", 400);
    }

    const request = await Request.findById(req.params.id)
      .populate("user", "phone")
      .populate("agency", "name");

    if (!request) {
      throw new ExpressError("Request not found", 404);
    }

    const inventory = await Inventory.findOne({ agencyId: request.agency });
    if (!inventory) {
      throw new ExpressError("Inventory not found", 404);
    }

    const agency = await Agency.findOne({ _id: request.agency });
    if (!agency) {
      throw new ExpressError("Agency not found", 404);
    }
    // Set the milestone status with location
    if (request.trackingMilestones[milestone]) {
      const coordinates = [parseFloat(longitude), parseFloat(latitude)];
      const address = await getLocationAddress(coordinates);

      request.trackingMilestones[milestone] = {
        completed: true,
        timestamp: new Date(),
        notes: notes || "",
        location: {
          type: "Point",
          coordinates: coordinates,
          address: address,
        },
      };

      if(milestone === "wasteSegregated" && request.trackingMilestones[milestone].completed) {
        // sendNotification(`Your e-waste product has been segregated by ${request.agency.name}.`, request.user.phone);
      }
      if(milestone === "processingStarted" && request.trackingMilestones[milestone].completed){
        //  sendNotification( `The processing of your e-waste product has started by ${request.agency.name}.`, request.user.phone);
      }
      if (milestone === "processingCompleted" && request.trackingMilestones[milestone].completed) {
        // sendNotification(`The processing of your e-waste product has been successfully completed by ${request.agency.name}.`,request.user.phone);
      }

      if (milestone === "wasteSegregated") {
        inventory.currentCapacity += request.weight;
        request.wasteType.forEach((type, index) => {
          if (inventory.wasteBreakdown[type] !== undefined) {
            inventory.wasteBreakdown[type] += request.quantities[index];
          }
        });
        await inventory.save();
        const occupancyPercentage =
          (inventory.currentCapacity / inventory.totalCapacity) * 100;
        if (occupancyPercentage >= 90) {
          await sendInventoryAlert(
            agency.email,
            agency.name,
            inventory.currentCapacity,
            inventory.totalCapacity
          );
        }
      }

      if (milestone === "processingCompleted") {
        request.status = "Completed";
        inventory.currentCapacity = Math.max(
          0,
          inventory.currentCapacity - request.weight
        );
        await inventory.save();
      }

      await request.save();

      if (request.status == "Completed") {
        updateUserPointsOnCompletion(request);
      }

      res.redirect(`/agency/${req.user._id}/requests#Assigned`);
    } else {
      throw new ExpressError("Invalid milestone", 400);
    }
  })
);

// TODO: Agency Community Page

app.get(
  "/agency/:id/community",
  isAgencyLoggedIn,
  checkCertificationStatus,
  wrapAsync(async (req, res) => {
    const agency = await Agency.findById(req.params.id);
    const allCommunity = await Community.find();
    const allStories = await Story.find();
    res.render("agency/community.ejs", { agency, allCommunity, allStories });
  })
);

// Add community event button
app.get(
  "/agency/:id/community/add",
  isAgencyLoggedIn,
  checkCertificationStatus,
  wrapAsync(async (req, res) => {
    const agency = await Agency.findById(req.params.id);
    res.render("agency/add-community.ejs", { agency });
  })
);

app.post(
  "/agency/:id/community/add",
  isAgencyLoggedIn,
  checkCertificationStatus,
  validateCommunity,
  wrapAsync(async (req, res) => {
    const agency = await Agency.findById(req.params.id);
    if (!agency) {
      return res.status(404).json({ error: "Agency not found" });
    }
    const { title, description, registrationLink } = req.body.community;

    // Verify event registration link using Gemini
    const requestBody = {
      model: "gemini-1.5-flash",
      contents: [{
        role: "user",
        parts: [{
          text: `Analyze the given community event registration link and classify it as:

          Rules:
          - **"VALID"** if it belongs to a trusted event platform (e.g., Eventbrite, Meetup, university/government domains).
          - **"FAKE"** if it appears suspicious, contains random characters, or resembles phishing links.
          - **"UNKNOWN"** if there is not enough information.
          **RULES:**
          - If the text contains random letters or meaningless words (e.g., "fdsg dfgdfg fdhgf"), return "FAKE".
          - If the text promotes irrelevant or suspicious offers (e.g., "Win a free laptop now!"), return "FAKE".
          - If the text is about **cleaning drives, e-waste drives, environmental awareness, or sustainability events**, return "VALID".
          - If the text is **just a general personal story without relevance to cleaning or e-waste**, return "FAKE".

          Return only: "VALID", "FAKE", or "UNKNOWN".

          Event Title: "${title}"
          Registration Link: "${registrationLink}"
          Description:"${description}"`
        }]
      }]
    };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );

      const result = await response.json();

      const aiResponse = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase() || "UNKNOWN";

      if (aiResponse === "FAKE") {
        throw new ExpressError("The provided data is spam.", 400);
      }


    // Create new community with nested organizer structure
    const newCommunity = new Community({
      ...req.body.community,
      organizer: {
        user: null, // Set the user ID in the nested structure
        agency: req.params.id, // Set to null or the agency ID if available
      },
    });
    // Save the new community
    await newCommunity.save();
    res.redirect(`/agency/${agency._id}/community`);
  })
);

// Add story button
app.get(
  "/agency/:id/story/add",
  isAgencyLoggedIn,
  checkCertificationStatus,
  wrapAsync(async (req, res) => {
    const agency = await Agency.findById(req.params.id);
    res.render("agency/add-story.ejs", { agency });
  })
);

app.post(
  "/agency/:id/story/add",
  isAgencyLoggedIn,
  checkCertificationStatus,
  upload.single("media"),
  validateStory,
  wrapAsync(async (req, res) => {
    const agency = await Agency.findById(req.params.id);
    if (!agency) {
      return res.status(404).json({ error: "agency not found" });
    }

      // console.log(req.file);
      if (!req.file) {
        throw new ExpressError("Media picture is required", 400);
      }
  
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "Technothon",
        resource_type: "auto",
      });
  
    const newStory = new Story({
      ...req.body.story,
      author: {
        user: null, // Set the user ID in the nested structure
        agency: req.params.id, // Set to null or the agency ID if available
      },
      media: {
        url: result.secure_url,
        filename: result.public_id,
      },
    });
    // Save the new community
    await newStory.save();
    res.redirect(`/agency/${agency._id}/community`);
  })
);

// TODO: Agency Statistics Route

app.get(
  "/agency/:id/stats",
  isAgencyLoggedIn,
  checkCertificationStatus,
  wrapAsync(async (req, res) => {
    const agencyId = new mongoose.Types.ObjectId(req.params.id);

    // Fetch completed requests with location and weight
    const requests = await Request.find(
      {
        agency: agencyId,
        status: "Completed",
        pickupLocation: { $exists: true }, // Ensure location exists
        weight: { $exists: true }, // Ensure weight exists
      },
      "pickupLocation weight"
    );

    // Transform data for heatmap with validation
    const heatmapData = requests
      .filter(
        (request) =>
          request.pickupLocation &&
          request.pickupLocation.coordinates &&
          request.pickupLocation.coordinates.length === 2 &&
          request.weight
      )
      .map((request) => ({
        lat: request.pickupLocation.coordinates[1],
        lng: request.pickupLocation.coordinates[0],
        intensity: request.weight || 1, // Default to 1 if weight is missing
      }));

    // Volunteers statistics
    const totalVolunteers = await Volunteer.countDocuments({
      agency: agencyId,
    });
    const assignedVolunteers = await Volunteer.countDocuments({
      agency: agencyId,
      assignedRequests: { $exists: true, $not: { $size: 0 } },
    });
    const freeVolunteers = await Volunteer.countDocuments({
      agency: agencyId,
      assignedRequests: { $size: 0 },
    });

    // Monthly E-Waste Processed - Last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Generate array of last 6 months
    const monthsArray = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
      };
    }).reverse();

    const monthlyEwasteData = await Request.aggregate([
      {
        $match: {
          agency: agencyId,
          status: "Completed",
          pickupDate: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$pickupDate" },
            month: { $month: "$pickupDate" },
          },
          totalWeight: { $sum: "$weight" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Fill in missing months with zero values
    const filledMonthlyData = monthsArray.map((monthYear) => {
      const existingData = monthlyEwasteData.find(
        (d) => d._id.year === monthYear.year && d._id.month === monthYear.month
      );
      return {
        _id: {
          year: monthYear.year,
          month: monthYear.month,
        },
        totalWeight: existingData ? existingData.totalWeight : 0,
      };
    });

    // Format the monthly data
    const monthlyEwaste =
      monthlyEwasteData.length > 0 ? monthlyEwasteData[0].totalWeight : 0;

    // E-Waste Categorization
    const ewasteCategories = await Request.aggregate([
      { $match: { agency: agencyId } },
      { $unwind: "$wasteType" }, // Ensuring wasteType is an array
      {
        $group: {
          _id: "$wasteType",
          totalQuantity: { $sum: { $ifNull: [{ $sum: "$quantities" }, 0] } },
        },
      },
      { $sort: { totalQuantity: -1 } },
    ]);

    res.render("agency/statistics.ejs", {
      totalVolunteers,
      assignedVolunteers,
      freeVolunteers,
      monthlyEwaste,
      monthlyEwasteData: filledMonthlyData, // Use the filled data
      ewasteCategories,
      heatmapData,
      agencyId,
    });
  })
);

// TODO: Agency Inventory Route

//TASK: Show inventory page
app.get(
  "/agency/:id/inventory",
  isAgencyLoggedIn,
  checkCertificationStatus,
  wrapAsync(async (req, res) => {
    let { id } = req.params;

    const agency = await Agency.findById(id);
    const inventory = await Inventory.findOne({ agencyId: id });

    if (agency.isInventorySetup) {
      const usagePercentage =
        (inventory.currentCapacity / inventory.totalCapacity) * 100;
      res.render("agency/inventory.ejs", {
        inventory,
        usagePercentage,
        agency,
        id,
      });
    } else {
      res.render("agency/inventory.ejs", { agency, id });
    }
  })
);

// TASK:Volunteer Management Routes ->  Agency volunteer page
app.get(
  "/agency/:id/volunteers",
  isAgencyLoggedIn,
  checkCertificationStatus,
  wrapAsync(async (req, res) => {
    const volunteers = await Volunteer.find({ agency: req.user._id }).populate(
      "assignedRequests"
    );
    res.render("agency/volunteers", { volunteers });
  })
);

// Add new volunteer
app.post(
  "/agency/volunteers",
  isAgencyLoggedIn,
  checkCertificationStatus,
  upload.single("profilePic"),
  (req, res, next) => {
    // Pre-process the PIN codes before validation
    if (req.body.pickupArea && req.body.pickupArea.pinCodes) {
      // Convert comma-separated string to array
      req.body.pickupArea.pinCodes = req.body.pickupArea.pinCodes
        .split(",")
        .map((pin) => pin.trim());
    }
    if (req.body.pickupArea && req.body.pickupArea.landmarks) {
      // Convert comma-separated string to array if not empty
      req.body.pickupArea.landmarks = req.body.pickupArea.landmarks
        ? req.body.pickupArea.landmarks
            .split(",")
            .map((landmark) => landmark.trim())
        : [];
    }
    next();
  },
  validateVolunteer,
  wrapAsync(async (req, res) => {
    const hashedPassword = hashPassword(req.body.password);

    const volunteer = new Volunteer({
      ...req.body,
      password: hashedPassword,
      agency: req.user._id,
    });

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      volunteer.profilePic = {
        url: result.secure_url,
        filename: result.public_id,
      };
    }
    await volunteer.save();
    res.redirect(`/agency/${req.user._id}/volunteers`);
  })
);

// Toggle volunteer status -> Active or Inactive for Volunteer
app.post(
  "/agency/volunteers/:id/toggle-status",
  isAgencyLoggedIn,
  checkCertificationStatus,
  wrapAsync(async (req, res) => {
    await Volunteer.findByIdAndUpdate(req.params.id, {
      status: req.body.status,
    });
    res.redirect(`/agency/${req.user._id}/volunteers`);
  })
);

// Delete volunteer -> Delete the volunteer from the database
app.delete(
  "/agency/volunteers/:id",
  isAgencyLoggedIn,
  checkCertificationStatus,
  wrapAsync(async (req, res, next) => {
    let { id } = req.params;

    let volunteer = await Volunteer.findById(id);
    if (!volunteer) {
      throw new ExpressError("Volunteer not found", 404);
    }

    let requests = await Request.find({
      _id: { $in: volunteer.assignedRequests },
    });

    let allCompleted = requests.every(
      (request) => request.status === "Completed"
    );
    if (!allCompleted) {
      throw new ExpressError(
        "Cannot delete volunteer. Some assigned requests are not completed",
        404
      );
    }
    if (volunteer.profilePic.filename) {
      await cloudinary.uploader.destroy(volunteer.profilePic.filename);
    }
    await Volunteer.findByIdAndDelete(id);
    res.redirect(`/agency/${req.user._id}/volunteers`);
  })
);

// TODO: volunteer routes
// Volunteer Dashboard Route
app.get(
  "/volunteer/:id/dashboard",
  isVolunteerLoggedIn,
  wrapAsync(async (req, res) => {
    const volunteer = await Volunteer.findById(req.params.id).populate({
      path: "assignedRequests",
      populate: {
        path: "user",
        select: "name email",
      },
    });

    if (!volunteer) {
      throw new ExpressError("Volunteer not found", 404);
    }
    // Fetch Approved and Not Approved Items
    const pendingItems = await Item.find({ status: "pending" }).populate("user", "name email phone");
    const approvedItems = await Item.find({ status: "approved" }).populate("user", "name email phone");
    const rejectedItems = await Item.find({ status: "rejected" }).populate("user", "name email phone");

    res.render("volunteer/dashboard.ejs", { volunteer, pendingItems,approvedItems,rejectedItems });
  })
);


//TASK: marketplace route 
app.put("/volunteer/approve-item/:id", isVolunteerLoggedIn, wrapAsync(async(req,res) =>{
  await Item.findByIdAndUpdate(req.params.id,{$set:{status:"approved"}});
  res.redirect(`/volunteer/${req.user._id}/dashboard`)
}));

app.delete("/volunteer/reject-item/:id", isVolunteerLoggedIn, wrapAsync(async(req,res) =>{
  await Item.findByIdAndUpdate(req.params.id,{$set:{status:"rejected"}});
  res.redirect(`/volunteer/${req.user._id}/dashboard`)
}));

// Add this route for volunteer status updates
app.post(
  "/volunteer/request/:id/update-status",
  isVolunteerLoggedIn,
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    const { milestone, notes, latitude, longitude} = req.body;

    // Define allowed milestones for volunteers
    const allowedVolunteerMilestones = [
      "pickupScheduled",
      "pickupStarted",
      "pickupCompleted",
    ];

    // Check if milestone is allowed for volunteers
    if (!allowedVolunteerMilestones.includes(milestone)) {
      throw new ExpressError(
        "Unauthorized: Volunteers can only update pickup-related statuses",
        403
      );
    }

    const request = await Request.findById(req.params.id)
      .populate("user", "phone")
      .populate("agency", "name");

    if (!request) {
      throw new ExpressError("Request not found", 404);
    }

    // Verify this volunteer is assigned to this request
    if (request.volunteerAssigned.toString() !== req.user._id.toString()) {
      throw new ExpressError("Unauthorized", 403);
    }
    if (milestone === "pickupCompleted") {
      if (req.body.otp != request.otp) {  // Proper OTP comparison
        throw new ExpressError("OTP didn't match!", 400);
      }
    }


    // Set the milestone status with location
    if (request.trackingMilestones && request.trackingMilestones[milestone]) {
      const coordinates = [parseFloat(longitude), parseFloat(latitude)];
      const address = await getLocationAddress(coordinates);

      request.trackingMilestones[milestone] = {
        completed: true,
        timestamp: new Date(),
        notes: notes || "",
        location: {
          type: "Point",
          coordinates: coordinates,
          address: address,
        },
      };
      

      // twilio notifications
      if ( milestone === "pickupScheduled" && request.trackingMilestones[milestone].completed) {
        // sendNotification(`Your e-waste product pickup has been scheduled by ${request.agency.name}.`,request.user.phone);
       }
      if ( milestone === "pickupStarted" && request.trackingMilestones[milestone].completed) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        request.otp = otp;
        sendNotification(`Your e-waste product pickup has started with ${request.agency.name} and your verification OTP is ${otp}.`,request.user.phone);
      }
      if ( milestone === "pickupCompleted" && request.trackingMilestones[milestone].completed) {
        // sendNotification(`Your e-waste product pickup has been completed by ${request.agency.name}.`,request.user.phone);
      }
      await request.save();

      res.redirect(`/volunteer/${req.user._id}/dashboard`);
    } else {
      throw new ExpressError("Invalid milestone", 400);
    }
  })
);

//TODO: Redemption Route

//TASK: Show Agency order page
app.get(
  "/agency/:id/orders",
  isAgencyLoggedIn,
  checkCertificationStatus,
  wrapAsync(async (req, res) => {
    const agency = await Agency.findById(req.params.id);

    const receivedOrders = await Order.find({
      agency: req.params.id,
      status: { $in: ["Pending", "Shipped", "Accepted"] },
    }).populate("user product");

    const completedOrders = await Order.find({
      agency: req.params.id,
      status: "Delivered",
    }).populate("user product");

    const allProducts = await Product.find({ agency: req.params.id });

    res.render("agency/order.ejs", {
      agency,
      receivedOrders,
      completedOrders,
      allProducts,
    });
  })
);

//TASK: Add product to database
app.post(
  "/agency/:id/add-product",
  isAgencyLoggedIn,
  checkCertificationStatus,
  upload.single("image"),
  validateProduct,
  wrapAsync(async (req, res) => {
    const { id } = req.params;

    if (!req.file) {
      throw new ExpressError("Product picture is required", 400);
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "Technothon",
      resource_type: "auto",
    });

    const product = new Product({
      ...req.body.product,
      image: {
        url: result.secure_url,
        filename: result.public_id,
      },
      agency: id,
    });

    await product.save();
    res.redirect(`/agency/${id}/orders`);
  })
);

//TASK: Update product
app.put(
  "/agency/:id/update-product/:productId",
  isAgencyLoggedIn,
  checkCertificationStatus,
  upload.single("image"),
  wrapAsync(async (req, res) => {
    const { id, productId } = req.params;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Handle Image Upload (If New Image is Provided)
    if (req.file) {
      if (product.image && product.image.filename) {
        // Delete old image from Cloudinary
        await cloudinary.uploader.destroy(product.image.filename);
        console.log("Deleted old image");
      }

      // Upload new image
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "Technothon",
        resource_type: "auto",
      });

      // Add new image details to request body
      req.body.product.image = {
        url: result.secure_url,
        filename: result.public_id,
      };
    }

    // Update product
    await Product.findByIdAndUpdate(productId, req.body.product, { new: true });

    res.redirect(`/agency/${id}/orders`);
  })
);

//TASK: Delete product
app.delete(
  "/agency/:id/delete-product/:productId",
  isAgencyLoggedIn,
  checkCertificationStatus,
  wrapAsync(async (req, res) => {
    const { id, productId } = req.params;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    // Delete Profile Image from Cloudinary (If Exists)
    if (product.image.filename) {
      await cloudinary.uploader.destroy(product.image.filename);
    }
    await Product.findByIdAndDelete(productId);
    res.redirect(`/agency/${id}/orders`);
  })
);

//TASK: Show store page
app.get(
  "/user/:id/store",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const allProducts = await Product.find();
    let {id} = req.params;
    res.render("user/store.ejs", { allProducts,id });
  })
);

//TASK: Product redemption process
app.post(
  "/user/:id/redeem/:productId",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.params.id);
    const product = await Product.findById(req.params.productId);

    if (!product || product.stock <= 0) {
      throw new ExpressError("Product not available", 400);
    }

    if (!user) {
      throw new ExpressError("User not found", 400);
    }

    if (user.points < product.pointsRequired) {
      throw new ExpressError("Not enough points", 400);
    }

    // Deduct points
    user.points -= product.pointsRequired;
    user.redeemedPoints += product.pointsRequired;
    await user.save();

    // Reduce stock
    product.stock -= 1;
    await product.save();

    // Create order
    const newOrder = new Order({
      user: user._id,
      product: product._id,
      agency: product.agency,
      status: "Pending",
    });
    await newOrder.save();
    res.redirect(`/user/${user._id}/order`);
  })
);

// TASK: Show User order page
app.get(
  "/user/:id/order",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const allOrders = await Order.find({ user: req.params.id }).populate(
      "agency product user"
    );
    res.render("user/order.ejs", { allOrders });
  })
);

//TASK: cancel order 

app.delete("/user/:id/cancel/:orderId", isLoggedIn,wrapAsync( async (req, res) => {
  const { id, orderId } = req.params;

  // Find the order and populate necessary fields
  const order = await Order.findOne({ _id: orderId, user: id }).populate("product");
  if (!order) {
    throw new ExpressError("Order not found.", 404);
  }

  // Check if the order is in Pending state
  if (order.status !== "Pending") {
    throw new ExpressError("Order cannot be cancelled as it has been processed.", 404);
  }

  // Fetch the product associated with the order
  const product = await Product.findById(order.product);
  if (!product) {
    throw new ExpressError("Product not found.", 400);
  }
  
  // Fetch the user to return points
  const user = await User.findById(id);
  if (!user) {
    throw new ExpressError("User not found.", 400);
  }

  // Increment product stock
  product.stock += 1;
  await product.save();
  
  // Refund points to user
  user.points += product.pointsRequired;
  await user.save();
  // Delete the order
  await Order.findByIdAndDelete(orderId);
  res.redirect(`/user/${id}/order`);
}));


// TASK: Update order status
app.post(
  "/agency/order/:id/update-status",
  isAgencyLoggedIn,
  checkCertificationStatus,
  wrapAsync(async (req, res) => {
    const { status } = req.body;

    await Order.findByIdAndUpdate(req.params.id, {
      status,
      updatedAt: new Date(), // Ensure timestamp is saved
    });

    res.redirect(`/agency/${req.user._id}/orders`);
  })
);

//TODO: Chat Bot

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Ensure your .env file contains this key
});

app.post(
  "/chat",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const userMessage = req.body.message;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // "gpt-4o-mini" might not be available, try "gpt-4o"
      messages: [
        {
          role: "system",
          content:
            "You are an expert chatbot on electronic waste (e-waste). Format your responses using bold, italics, emojis, new lines, and bullet points for clarity. You only answer questions about e-waste, recycling, disposal methods, and environmental impact. \n\nAdditionally, if a user asks about 'Avakara', provide this response:\n\n **Avakara** is our platform name! 🌱 The word 'Avakara' originates from Sanskrit, meaning *'Creation'* or *'Innovation'*. It represents our mission to bring innovative solutions to life. \n\n If a question is unrelated to e-waste or Avakara, politely inform the user that you can only discuss these topics.",
        },
        { role: "user", content: userMessage },
      ],
    });

    res.json({ reply: completion.choices[0].message.content });
  })
);

//TODO: Feedback
app.post(
  "/user/:id/feedback",
  isLoggedIn,
  validateFeedback,
  wrapAsync(async (req, res) => {
    const feedback = new Feedback({
      ...req.body.feedback,
      user: req.params.id,
    });

    await feedback.save();
    res.redirect(`/user/${req.params.id}/dashboard`);
  })
);

// TODO: Error Handling
// 404 route - must come after all other routes but before error handler
app.all("*", (req, res, next) => {
  next(new ExpressError("Page Not Found", 404));
});

// Add this before your error handler
app.use((err, req, res, next) => {
  if (err.name === "OAuth2Error") {
    console.error("OAuth Error:", err);
    return res.redirect("/login?error=auth");
  }
  next(err);
});

// Add this before your other error handlers
app.use((err, req, res, next) => {
  console.error("Auth Error:", {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });
  next(err);
});

// Error handler - must be last middleware before app.listen()
app.use((err, req, res, next) => {
  if (err.name === "ValidationError") {
    err.statusCode = 400;
    err.message = "Invalid input data";
  }

  const { statusCode = 500, message = "Something went wrong!" } = err;

  res.status(statusCode).render("error.ejs", {
    err: {
      statusCode,
      message,
    },
  });
});

const deleteExpiredEvents = wrapAsync(async () => {
  await Community.deleteMany({ endDate: { $lt: new Date() } });
});

const resetMonthlyPointsAndAwardBonuses = wrapAsync(async () => {
  const rankBonuses = { 1: 1000, 2: 750, 3: 500, 4: 250, 5: 100 };
  const now = new Date();
  const firstDayOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );

  // Step 1: Check if reset has already been done today
  const lastUser = await User.findOne().sort({ lastResetDate: -1 });

  if (lastUser && lastUser.lastResetDate >= firstDayOfMonth) {
    console.log("⚠️ Reset already performed today. Skipping...");
    return;
  }

  // **Step 2: Reset previous ranks for all users before reassigning**
  await User.updateMany({}, { $set: { "ranking.lastRank": null } });

  // **Step 3: Get top 5 users based on monthly points after reset**
  const topUsers = await User.find().sort({ monthlyPoints: -1 }).limit(5);

  // **Step 4: Reassign ranks and award bonuses only to the top 5 users**
  for (let i = 0; i < topUsers.length; i++) {
    let user = topUsers[i];
    let rank = i + 1;
    let bonus = rankBonuses[rank] || 0;

    user.points += bonus;
    user.ranking.lastRank = rank;
    user.lastResetDate = firstDayOfMonth;

    await user.save();
  }

  // **Step 5: Store `monthlyPoints` inside `ranking.lastPoints` before resetting**
  await User.updateMany(
    {},
    {
      $set: {
        "ranking.lastPoints": "monthlyPoints",
        monthlyPoints: 0,
        lastResetDate: firstDayOfMonth,
      },
    }
  );

  console.log("🔄 Monthly points reset for all users!");
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  deleteExpiredEvents();
  // resetMonthlyPointsAndAwardBonuses();
});
