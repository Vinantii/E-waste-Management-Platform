const Joi = require("joi");
const ExpressError = require("./utils/ExpressError");

// User validation schema for initial signup
const userSchema = Joi.object({
  user: Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    googleId: Joi.string(),
    isAgency: Joi.boolean().default(false),
  }).required(),
}).unknown(true); // Allow file upload

// Agency validation schema
const agencySchema = Joi.object({
  agency: Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    agencyType: Joi.array()
      .items(
        Joi.string().valid("Recycler", "Collector", "Disposal", "Aggregator")
      )
      //.min(1)
      .required()
      .messages({
        "array.min": "At least one agency type must be selected",
      }),
    address: Joi.string().required(),
    region: Joi.string().required(),
    phone: Joi.string()
      .pattern(/^\d{10}$/)
      .required()
      .messages({
        "string.pattern.base": "Phone number must be 10 digits",
      }),
    contactPerson: Joi.string().required(),
    location: Joi.object({
      type: Joi.string().valid("Point").default("Point"),
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
    }),
    workingHours: Joi.string().required(),
    wasteTypesHandled: Joi.array()
      .items(
        Joi.string().valid(
          "mobile",
          "laptop",
          "computers",
          "Batteries",
          "phones"
        )
      )
      .min(1)
      .required()
      .messages({
        "array.min": "At least one waste type must be selected",
      }),
    isAgency: Joi.boolean().default(true),
  }).required(),
}).unknown(true); // Allow file upload field

// Profile completion validation schema
const profileCompletionSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\d{10}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone number must be 10 digits",
    }),
  address: Joi.string().required(),
  pinCode: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      "string.pattern.base": "Pin code must be 6 digits",
    }),
  password: Joi.string().min(6).required(),
}).unknown(true); // Allow file upload

// Request validation schema
const requestSchema = Joi.object({
  request: Joi.object({
    wasteType: Joi.array()
      .items(
        Joi.string().valid(
          "mobile",
          "phones",
          "computers",
          "laptop",
          "Batteries"
        )
      )
      .min(1)
      .required()
      .single(),
    quantities: Joi.array().items(Joi.number().min(1)).required(),
    weight: Joi.number().required(),
    pickupAddress: Joi.string().required(),
    contactNumber: Joi.string()
      .pattern(/^\d{10}$/)
      .required(),
    pickupDate: Joi.date().greater("now").required(),
    agency: Joi.string().required(),
    pickupLocation: Joi.object({
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
    }),
    specialInstructions: Joi.string().max(500).allow("", null),
  }).required(),
}).unknown(true);

// Volunteer validation schema
const volunteerSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  phone: Joi.string()
    .pattern(/^\d{10}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone number must be 10 digits",
    }),
  address: Joi.string().required(),
  pickupArea: Joi.object({
    city: Joi.string().required(),
    district: Joi.string().required(),
    pinCodes: Joi.alternatives()
      .try(
        Joi.array().items(
          Joi.string()
            .pattern(/^\d{6}$/)
            .messages({
              "string.pattern.base": "PIN code must be 6 digits",
            })
        ),
        Joi.string().pattern(/^\d{6}(,\s*\d{6})*$/)
      )
      .required(),
    landmarks: Joi.alternatives()
      .try(Joi.array().items(Joi.string()), Joi.string())
      .allow(""),
    coordinates: Joi.object({
      type: Joi.string().valid("Point").default("Point"),
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
    }).required(),
  }).required(),
  status: Joi.string().valid("Active", "Inactive").default("Active"),
}).unknown(true); // Allow file upload field

// admin validation schema
const adminSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  isAdmin: Joi.boolean().default(true),
  createdAt: Joi.date().default(Date.now),
}).unknown(true); // Allows additional properties if needed

// community validation schema
const communitySchema = Joi.object({
  community: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().trim().required(),
    organizer: Joi.object({
      user: Joi.string().optional(),
      agency: Joi.string().optional(),
    }).or("user", "agency"), // At least one must be provided
    eventType: Joi.string()
      .valid("Event", "Drive", "Online Webinar", "Workshop")
      .required(),
    startDate: Joi.date().required(),
    endDate: Joi.date().required(),
    time: Joi.string().required(), // Keeping it flexible for different formats
    location: Joi.string().when("eventType", {
      is: "Online Webinar",
      then: Joi.optional(),
      otherwise: Joi.required(),
    }),
    registrationLink: Joi.string().uri().required(),
    contactInfo: Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().required(),
      phone: Joi.string()
        .pattern(/^\d{10}$/)
        .required(),
    }).required(),
    createdAt: Joi.date().default(Date.now),
  }).required(true), // Required field
}).unknown(true); // Allows extra properties if needed

// inventory validation schema
const inventorySchema = Joi.object({
  inventory: Joi.object({
    agencyId: Joi.string(),
    totalCapacity: Joi.number().min(0).required(),
    currentCapacity: Joi.number()
      .min(0)
      .max(Joi.ref("totalCapacity"))
      .required(),
    wasteBreakdown: Joi.object({
      mobile: Joi.number().min(0).default(0),
      phones: Joi.number().min(0).default(0),
      computers: Joi.number().min(0).default(0),
      laptop: Joi.number().min(0).default(0),
      Batteries: Joi.number().min(0).default(0),
    }).default({}),
    location: Joi.object({
      address: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      postalCode: Joi.string().required(),
    }).required(),
    lastUpdated: Joi.date().default(Date.now),
  }).required(),
}).unknown(true); // Allows additional properties if needed

// product validation schema
const productSchema = Joi.object({
  product: Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow(""), // Optional field
    pointsRequired: Joi.number().min(0).required(), // Ensures non-negative points
    agency: Joi.string(), // ObjectId reference
    stock: Joi.number().min(0).default(0).required(), // Ensures non-negative stock
    createdAt: Joi.date().default(Date.now),
  }).required(),
}).unknown(true); // Allows additional properties if needed

// story validation schema
const storySchema = Joi.object({
  story: Joi.object({
    title: Joi.string().trim().required(),
    content: Joi.string().required(),
    author: Joi.object({
      user: Joi.string().optional(), // ObjectId reference
      agency: Joi.string().optional(), // ObjectId reference
    }).or("user", "agency"), // At least one of them should be present
    publishedAt: Joi.date().default(Date.now),
    contactInfo: Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().required(),
    }).required(),
  }).required(),
}).unknown(true); // Allows additional properties if needed

// Validation middlewares
const validateUser = (req, res, next) => {
  const { error } = userSchema.validate(req.body);
  if (error) {
    const msg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(msg, 400);
  } else {
    next();
  }
};

const validateAgency = (req, res, next) => {
  const { error } = agencySchema.validate(req.body);
  if (error) {
    const msg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(msg, 400);
  } else {
    next();
  }
};

const validateProfileCompletion = (req, res, next) => {
  const { error } = profileCompletionSchema.validate(req.body);
  if (error) {
    const msg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(msg, 400);
  } else {
    next();
  }
};

const validateRequest = (req, res, next) => {
  const { error } = requestSchema.validate(req.body);
  if (error) {
    const msg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(msg, 400);
  } else {
    next();
  }
};

const validateVolunteer = (req, res, next) => {
  const { error } = volunteerSchema.validate(req.body);
  if (error) {
    const msg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(msg, 400);
  } else {
    next();
  }
};

const validateCommunity = (req, res, next) => {
  const { error } = communitySchema.validate(req.body, { abortEarly: false });
  if (error) {
    const msg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(msg, 400);
  }
  next();
};

const validateInventory = (req, res, next) => {
  const { error } = inventorySchema.validate(req.body);
  if (error) {
    const msg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(msg, 400);
  } else {
    next();
  }
};

const validateProduct = (req, res, next) => {
  const { error } = productSchema.validate(req.body);
  if (error) {
    const msg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(msg, 400);
  } else {
    next();
  }
};

const validateStory = (req, res, next) => {
  const { error } = storySchema.validate(req.body, { abortEarly: false });
  if (error) {
    const msg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(msg, 400);
  }
  next();
};

module.exports = {
  validateUser,
  validateAgency,
  validateProfileCompletion,
  validateRequest,
  validateVolunteer,
  validateCommunity,
  validateInventory,
  validateProduct,
  validateStory,
};
