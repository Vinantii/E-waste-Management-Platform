require("dotenv").config();

const express = require("express");
const ejs = require("ejs");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const User = require("./models/user");
const Agency = require("./models/agency");
const app = express();
const crypto = require("crypto");
const {
  validateUser,
  validateAgency,
  validateProfileCompletion,
  validateRequest,
} = require("./schema");
const multer = require("multer");
const cloudinary = require("./cloudConfig");
const upload = multer({ dest: "uploads/" });
const Request = require("./models/request"); // Adjust path as needed
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20");
const Volunteer = require("./models/volunteer");

// Utilities
const wrapAsync = require("./utils/wrapAsync");
const ExpressError = require("./utils/ExpressError");

// MIDDLEWARE: to protect routes
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

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "/public")));

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
passport.serializeUser((userOrAgency, done) => {
  // Add a type field to distinguish between user and agency
  done(null, {
    id: userOrAgency.id,
    type: userOrAgency.isAgency ? "agency" : "user",
  });
});

passport.deserializeUser(async (obj, done) => {
  try {
    let userOrAgency;
    if (obj.type === "agency") {
      userOrAgency = await Agency.findById(obj.id);
    } else {
      userOrAgency = await User.findById(obj.id);
    }
    done(null, userOrAgency);
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

//TODO Root  route
app.get(
  "/",
  wrapAsync(async (req, res) => {
    res.render("index.ejs");
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

    try {
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

      await User.findByIdAndUpdate(id, {
        phone: req.body.phone,
        address: req.body.address,
        pinCode: req.body.pinCode,
        ...(user.googleId && { password: hashPassword(req.body.password) }), // Only update password for Google users
        profilePic: {
          url: result.secure_url,
          filename: result.public_id,
        },
      });

      res.redirect(`/user/${id}/dashboard`);
    } catch (error) {
      throw new ExpressError(error.message, 400);
    }
  })
);

//TODO: Login Logic

passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password'
    },
    async function(email, password, done) {
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

        // If neither user nor agency found
        return done(null, false, { message: "Incorrect email." });
      } catch(err) {
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
    // Check if the logged-in entity is an agency or user and redirect accordingly
    if (req.user.isAgency) {
      res.redirect(`/agency/${req.user._id}/dashboard`);
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

//TODO:agency side auth

app.get(
  "/register/agency",
  wrapAsync(async (req, res) => {
    res.render("agency/signup.ejs");
  })
);

app.post(
  "/register/agency",
  upload.single("agencyLogo"),
  validateAgency,
  wrapAsync(async (req, res) => {
    try {
      if (!req.file) {
        throw new ExpressError("Agency logo is required", 400);
      }

      // Upload logo to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "Technothon",
        resource_type: "auto",
      });

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
      const agencyData = {
        ...req.body.agency,
        password: hashedPassword,
        isAgency: true,
        logo: {
          url: result.secure_url,
          filename: result.public_id,
        },
        location: {
          type: "Point",
          coordinates: formattedCoordinates,
        },
      };

      const newAgency = new Agency(agencyData);
      await newAgency.save();

      req.login(newAgency, (err) => {
        if (err) {
          throw new ExpressError("Error during login after registration", 500);
        }
        res.redirect(`/agency/${newAgency._id}/dashboard`);
      });
    } catch (error) {
      throw new ExpressError(error.message, 400);
    }
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

// TODO: User Apply Request Route
app.get(
  "/user/:id/apply-request",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new ExpressError("User not found", 404);
    }

    // Fetch all certified agencies
    const agencies = await Agency.find({
      certificationStatus: "Certified",
    }).select("name region wasteTypesHandled");

    res.render("user/apply-request.ejs", {
      currentUser: user,
      agencies: agencies,
    });
  })
);

app.post(
  "/user/:id/apply-request",
  isLoggedIn,
  upload.array("wasteImages", 5),
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!req.files || req.files.length === 0) {
      throw new ExpressError("Please upload at least one image", 400);
    }

    try {
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

        // Create and save the request
        const newRequest = new Request({
          ...req.body.request,
          user: id,
          agency: agency._id,
          status: "Pending",
          wasteImages: uploadResults.map((result) => ({
            url: result.secure_url,
            filename: result.public_id,
          })),
        });

        await newRequest.save();
        res.redirect(`/user/${id}/check-request`);
      });
    } catch (error) {
      throw new ExpressError("Error processing request: " + error.message, 400);
    }
  })
);

// TODO: User Check Request Route
app.get(
  "/user/:id/check-request",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.params.id)
      .populate({
        path: "requests",
        populate: {
          path: "agency",
          select: "name"
        }
      });
    
    if (!user) {
      throw new ExpressError("User not found", 404);
    }

    res.render("user/check-request", { requests: user.requests, currentUser: req.user });
  })
);

//TODO: Track Request Route
app.get(
  "/user/request/:id/track",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const request = await Request.findById(req.params.id)
      .populate("agency", "name")
      .populate("user", "name");
    
    if (!request) {
      throw new ExpressError("Request not found", 404);
    }

    // Pass both request and currentUser to the view
    res.render("user/track-request", { 
      request,
      currentUser: req.user 
    });
  })
);


// TODO: User Reward Route
app.get(
  "/user/:id/reward",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    res.render("user/reward.ejs");
  })
);

// TODO: Agency Dashboard Route
app.get(
  "/agency/:id/dashboard",
  isAgencyLoggedIn,
  wrapAsync(async (req, res) => {
    const agency = await Agency.findById(req.params.id);
    res.render("agency/dashboard.ejs", { agency });
  })
);

// TODO: Agency Profile Route
app.get(
  "/agency/:id/profile",
  isAgencyLoggedIn,
  wrapAsync(async (req, res) => {
    const agency = await Agency.findById(req.params.id);
    res.render("agency/profile.ejs", { agency });
  })
);

// TODO: Agency Requests Route
app.get(
  "/agency/:id/requests",
  isAgencyLoggedIn,
  wrapAsync(async (req, res) => {
    const requests = await Request.find({ agency: req.params.id })
      .populate("user", "name email")
      .populate("volunteerAssigned", "name")
      .sort({ createdAt: -1 });

    // Fetch active volunteers for the agency
    const volunteers = await Volunteer.find({ 
      agency: req.params.id,
      status: "Active"
    });

    res.render("agency/requests.ejs", { requests, volunteers });
  })
);

// Accept request
app.post(
  "/agency/request/:id/approve",
  isAgencyLoggedIn,
  wrapAsync(async (req, res) => {
    const request = await Request.findByIdAndUpdate(
      req.params.id,
      { status: "Approved" },
      { new: true }
    );
    // Redirect back to the agency's requests page with their ID
    res.redirect(`/agency/${req.user._id}/requests#approved`);
  })
);

// Reject request
app.post(
  "/agency/request/:id/reject",
  isAgencyLoggedIn,
  wrapAsync(async (req, res) => {
    const requestId = req.params.id;
    
    // Find the request to get user ID before deletion
    const request = await Request.findById(requestId);
    if (!request) {
      throw new ExpressError("Request not found", 404);
    }

    // Update user's requests array - remove the request ID
    await User.findByIdAndUpdate(request.user, {
      $pull: { requests: requestId }
    });

    // Update agency's requests array - remove the request ID
    await Agency.findByIdAndUpdate(req.user._id, {
      $pull: { requests: requestId }
    });

    // Update request status to Rejected (don't delete it so user can see the status)
    await Request.findByIdAndUpdate(requestId, {
      status: "Rejected",
      rejectedAt: new Date()
    });

    res.redirect(`/agency/${req.user._id}/requests`);
  })
);

// Approve Request -> Change the request status from approved to in progress
app.post(
  "/agency/request/:id/assign-volunteer",
  isAgencyLoggedIn,
  wrapAsync(async (req, res) => {
    const volunteerId = req.body.volunteerId;
    const requestId = req.params.id;

    // Update request with volunteer
    const request = await Request.findByIdAndUpdate(
      requestId,
      {
        volunteerAssigned: volunteerId,
        status: "In Progress",
        "trackingMilestones.pickupScheduled.completed": true,
        "trackingMilestones.pickupScheduled.timestamp": new Date()
      },
      { new: true }
    );

    // Add request to volunteer's assigned requests
    await Volunteer.findByIdAndUpdate(volunteerId, {
      $addToSet: { assignedRequests: requestId }
    });

    res.redirect(`/agency/${req.user._id}/requests#inprogress`);
  })
);

// Update request status -> Picked Up or Completed on agency side after volunteer assigned
app.post(
  "/agency/request/:id/update-status",
  isAgencyLoggedIn,
  wrapAsync(async (req, res) => {
    const request = await Request.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    res.redirect(`/agency/${req.user._id}/requests`);
  })
);



// TODO: volunteer routes
// Volunteer Management Routes ->  Agency volunteer page
app.get(
  "/agency/:id/volunteers",
  isAgencyLoggedIn,
  wrapAsync(async (req, res) => {
    const volunteers = await Volunteer.find({ agency: req.user._id })
      .populate("assignedRequests");
    res.render("agency/volunteers", { volunteers });
  })
);

// Add new volunteer
app.post(
  "/agency/volunteers",
  isAgencyLoggedIn,
  upload.single("profilePic"),
  wrapAsync(async (req, res) => {
    const volunteer = new Volunteer({
      ...req.body,
      agency: req.user._id
    });

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      volunteer.profilePic = {
        url: result.secure_url,
        filename: result.public_id
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
  wrapAsync(async (req, res) => {
    await Volunteer.findByIdAndUpdate(req.params.id, {
      status: req.body.status
    });
    res.sendStatus(200);
  })
);

// Delete volunteer -> Delete the volunteer from the database
app.delete(
  "/agency/volunteers/:id",
  isAgencyLoggedIn,
  wrapAsync(async (req, res) => {
    await Volunteer.findByIdAndDelete(req.params.id);
    res.sendStatus(200);
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





const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
