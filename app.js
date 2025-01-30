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
const stream = require('stream');
const uploadDrive = multer({ storage: multer.memoryStorage() });

const User = require("./models/user");
const Agency = require("./models/agency");
const Request = require("./models/request");
const Volunteer = require("./models/volunteer");
const Community = require("./models/community");
const Story = require("./models/story");
const Inventory = require("./models/inventory");
const Admin = require("./models/admin");

const app = express();
const crypto = require("crypto");

const {
  validateUser,
  validateAgency,
  validateProfileCompletion,
  validateRequest,
  validateVolunteer,
} = require("./schema");



// Utilities
const wrapAsync = require("./utils/wrapAsync");
const ExpressError = require("./utils/ExpressError");

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
      throw new ExpressError("Access denied. Admin privileges are required.", 403);
    }

    if (req.user._id.toString() !== req.params.id) {
      throw new ExpressError('Unauthorized access to this dashboard.', 403);
    }
    // If the user is logged in and is an admin, proceed
    next();
  } catch (error) {
    next(error); // Pass error to the error handler
  }
};


const checkCertificationStatus = async (req, res, next) => {
  const agency = await Agency.findById(req.user._id);
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
    filename: data.name,
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
    url: data.webContentLink || `https://drive.google.com/uc?export=view&id=${fileId}`, // Fallback
    filename: data.name,
  };
};



//TODO Root  route
app.get(
  "/",
  wrapAsync(async (req, res) => {
    res.render("index.ejs");
  })
);



// TODO: Register Admin
app.post('/register/admin', wrapAsync(async(req,res)=>{
  let admin = {
    name:"Admin",
    email:"admin123@gmail.com",
    password: hashPassword("admin1234")
  };
  const newAdmin = new Admin(admin);
  await newAdmin.save();
  console.log("Admin created")
  res.send("Admin saved");
}));


//TODO: Admin dashboard
app.get('/admin/:id/dashboard',isAdminLoggedIn, wrapAsync(async(req,res)=>{
  const certifiedAgencies = await Agency.find({ certificationStatus: "Certified" });
  const uncertifiedAgencies = await Agency.find({ certificationStatus: "Uncertified" });
  let {id} = req.params;
  res.render('admin/dashboard.ejs', { certifiedAgencies, uncertifiedAgencies, id });
}));

app.post('/agency/:id/approve/:agencyId',wrapAsync(async(req,res)=>{
  const {id,agencyId}=req.params;
  console.log(id);
  console.log(agencyId);
  await Agency.findByIdAndUpdate(
    agencyId,
    { $set: { certificationStatus: "Certified" } },
    { new: true, runValidators: true }
  );
  res.redirect(`/admin/${id}/dashboard`);
}));

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
    } if (req.user.isAdmin) {
      res.redirect(`/admin/${req.user._id}/dashboard`);
    }else {
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
    try {
      console.log("inside try");
      // Ensure agency logo is uploaded
      if (!req.files["agencyLogo"]) {
        throw new ExpressError("Agency logo is required", 400);
      }
      console.log("before cloudinary")
      // Upload agency logo to Cloudinary
      // const logoResult = await cloudinary.uploader.upload(req.files["agencyLogo"][0].path, {
      //   folder: "Technothon",
      //   resource_type: "auto",
      // });

      let logoData = { url: "", filename: "" };
      if (req.files["agencyLogo"]) {
        logoData = await uploadLogo(req.files["agencyLogo"][0]);
      }
      console.log("after cloudinga")
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
      console.log("Before drive")
      if (req.files["tradeLicense"]) {
        tradeLicenseData = await uploadFile(req.files["tradeLicense"][0]);
      }
      if (req.files["pcbAuth"]) {
        pcbAuthData = await uploadFile(req.files["pcbAuth"][0]);
      }
      console.log("after drive ");
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
      console.log("Agency Created");

      // Log in the agency after registration
      req.login(newAgency, (err) => {
        if (err) {
          throw new ExpressError("Error during login after registration", 500);
        }
        res.redirect(`/agency/${newAgency._id}/setup-inventory`);
      });
    } catch (error) {
      throw new ExpressError(error.message, 400);
    }
  })
);



app.get("/agency/:id/setup-inventory", isLoggedIn, checkCertificationStatus, wrapAsync(async (req, res) => {
  let newAgency = await Agency.findById(req.params.id);

  res.render("agency/setup-inventory.ejs",{newAgency});
}));

// setup inventory route
app.post(
  "/agency/:id/setup-inventory",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    let { id } = req.params;
    let agency = await Agency.findById(id);
    let inventory = new Inventory({
      ...req.body.inventory,
      agencyId: agency._id,
    });
    await Agency.findByIdAndUpdate(id,{ isInventorySetup: true });
    await inventory.save();
    console.log("Inventory created");
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
        console.log("Upload complete");
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

// TODO:User Reward Route
app.get(
  "/user/:id/reward",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.params.id).populate("requests");

    // Calculate and update user's points
    await user.calculatePoints();

    // Get top 5 users by points
    const topUsers = await User.find().sort({ points: -1 }).limit(5);

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
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    // Create new community with nested organizer structure
    const newCommunity = new Community({
      ...req.body.community,
      organizer: {
        user: req.params.id,
        agency: null,
      },
    });
    // Save the new community
    await newCommunity.save();

    // Add 20 points to user for creating a community event
    await user.addCommunityPoints(20);

    res.redirect(`/user/${user._id}/community`);
  })
);

// Add story button
app.get(
  "/user/:id/story/add",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.params.id);
    res.render("user/add-story.ejs", { user });
  })
);

app.post(
  "/user/:id/story/add",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const newStory = new Story({
      ...req.body.story,
      author: {
        user: req.params.id, // Set the user ID in the nested structure
        agency: null, // Set to null or the agency ID if available
      },
    });
    // Save the new community
    await newStory.save();
    res.redirect(`/user/${user._id}/community`);
  })
);

// TODO: Agency Dashboard Route
app.get(
  "/agency/:id/dashboard",
  isAgencyLoggedIn,
  checkCertificationStatus,
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
      status: "Active",
    });

    res.render("agency/requests.ejs", { requests, volunteers });
  })
);

//Accept request
app.post(
  "/agency/requests/:id/approve",
  isAgencyLoggedIn,
  wrapAsync(async (req, res) => {
    const request = await Request.findById(req.params.id);

    if (!request) {
      throw new ExpressError("Request not found", 404);
    }

    request.status = "Accepted";

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
  wrapAsync(async (req, res) => {
    const requestId = req.params.id;

    // Find the request to get user ID before deletion
    const request = await Request.findById(requestId);
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

    res.redirect(`/agency/${req.user._id}/requests`);
  })
);

// Approve Request -> Change the request status from approved to in progress = Assigning Volunteer
app.post(
  "/agency/request/:id/assign-volunteer",
  isAgencyLoggedIn,
  wrapAsync(async (req, res) => {
    const volunteerId = req.body.volunteerId;
    const { id } = req.params;
    const request = await Request.findById(id);
    const volunteer = await Volunteer.findById(volunteerId);

    if (!request || !volunteer) {
      throw new ExpressError("Request or Volunteer not found", 404);
    }

    request.volunteerAssigned = volunteerId;
    request.volunteerName = volunteer.name;
    request.status = "Assigned";

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

// Update request status -> Picked Up or Completed on agency side after volunteer assigned
app.post(
  "/agency/request/:id/update-status",
  isAgencyLoggedIn,
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    const { milestone, notes } = req.body;

    // Define allowed milestones for agency
    const allowedAgencyMilestones = [
      "wasteSegregated",
      "processingStarted",
      "processingCompleted",
    ];

    if (!allowedAgencyMilestones.includes(milestone)) {
      throw new ExpressError("Invalid milestone for agency", 400);
    }

    const request = await Request.findById(id);
    const inventory = await Inventory.findOne({ agencyId: request.agency });

    if (!request) {
      throw new ExpressError("Request not found", 404);
    }

    // Set the milestone status
    if (request.trackingMilestones && request.trackingMilestones[milestone]) {
      request.trackingMilestones[milestone] = {
        completed: true,
        timestamp: new Date(),
        notes: notes || "",
      };

      if (request.trackingMilestones["processingCompleted"].completed) {
        request.status = "Completed";
        inventory.currentCapacity = Math.max(
          0,
          inventory.currentCapacity - request.weight
        );
        await inventory.save();
      }

      await request.save();

      res.redirect(`/agency/${req.user._id}/requests#Assigned`);
    } else {
      throw new ExpressError("Invalid milestone", 400);
    }
  })
);

// TODO: Agency Community Page

app.get(
  "/agency/:id/community",
  isLoggedIn,
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
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const agency = await Agency.findById(req.params.id);
    res.render("agency/add-community.ejs", { agency });
  })
);

app.post(
  "/agency/:id/community/add",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const agency = await Agency.findById(req.params.id);
    if (!agency) {
      return res.status(404).json({ error: "Agency not found" });
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
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const agency = await Agency.findById(req.params.id);
    res.render("agency/add-story.ejs", { agency });
  })
);

app.post(
  "/agency/:id/story/add",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const agency = await Agency.findById(req.params.id);
    if (!agency) {
      return res.status(404).json({ error: "agency not found" });
    }

    const newStory = new Story({
      ...req.body.story,
      author: {
        user: null, // Set the user ID in the nested structure
        agency: req.params.id, // Set to null or the agency ID if available
      },
    });
    // Save the new community
    await newStory.save();
    res.redirect(`/agency/${agency._id}/community`);
  })
);

//TODO: Agency Inventory Route

//TASK: Show inventory page
app.get(
  "/agency/:id/inventory",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    let { id } = req.params;
    console.log("id:",id);
    const agency = await Agency.findById(id);
    console.log(agency);
    const inventory = await Inventory.findOne({ agencyId: id });

    if(agency.isInventorySetup){
      const usagePercentage =
      (inventory.currentCapacity / inventory.totalCapacity) * 100;
    res.render("agency/inventory.ejs", { inventory, usagePercentage, agency, id});  
    }else{
      res.render("agency/inventory.ejs",{agency,id});
    }
    
  })
);

// TODO: volunteer routes
// Volunteer Management Routes ->  Agency volunteer page
app.get(
  "/agency/:id/volunteers",
  isAgencyLoggedIn,
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
    try {
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
    } catch (error) {
      throw new ExpressError(error.message, 400);
    }
  })
);

// Toggle volunteer status -> Active or Inactive for Volunteer
app.post(
  "/agency/volunteers/:id/toggle-status",
  isAgencyLoggedIn,
  wrapAsync(async (req, res) => {
    await Volunteer.findByIdAndUpdate(req.params.id, {
      status: req.body.status,
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

    res.render("volunteer/dashboard.ejs", { volunteer });
  })
);

// Add this route for volunteer status updates
app.post(
  "/volunteer/request/:id/update-status",
  isVolunteerLoggedIn,
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    const { milestone, notes } = req.body;

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

    const request = await Request.findById(id);
    const inventory = await Inventory.findOne({ agencyId: request.agency });

    if (!request) {
      throw new ExpressError("Request not found", 404);
    }

    // Verify this volunteer is assigned to this request
    if (request.volunteerAssigned.toString() !== req.user._id.toString()) {
      throw new ExpressError("Unauthorized", 403);
    }

    // Set the milestone status
    if (request.trackingMilestones && request.trackingMilestones[milestone]) {
      request.trackingMilestones[milestone] = {
        completed: true,
        timestamp: new Date(),
        notes: notes || "",
      };

      // If pickup is completed, change the request status to processing
      if (request.trackingMilestones["pickupCompleted"].completed) {
        inventory.currentCapacity += request.weight;
        if (inventory.currentCapacity > inventory.totalCapacity) {
          // Send alert: capacity exceeded
        }
        request.status = "Processing";
        console.log("Current capacity updated");
      }

      try {
        await request.save();
        await inventory.save();
        res.redirect(`/volunteer/${req.user._id}/dashboard`);
      } catch (error) {
        console.error("Save Error:", error);
        throw new ExpressError("Error updating request status", 500);
      }
    } else {
      throw new ExpressError("Invalid milestone", 400);
    }
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
