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
      .min(1)
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
    certificationStatus: Joi.string()
      .valid("Certified", "Uncertified")
      .required(),
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
    wasteType: Joi.array().items(Joi.string()).min(1).required(),
    quantity: Joi.number().min(1).required(),
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
    pinCodes: Joi.alternatives().try(
      Joi.array().items(
        Joi.string()
          .pattern(/^\d{6}$/)
          .messages({
            "string.pattern.base": "PIN code must be 6 digits",
          })
      ),
      Joi.string().pattern(/^\d{6}(,\s*\d{6})*$/)
    ).required(),
    landmarks: Joi.alternatives().try(
      Joi.array().items(Joi.string()),
      Joi.string()
    ).allow(''),
    coordinates: Joi.object({
      type: Joi.string().valid("Point").default("Point"),
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
    }).required(),
  }).required(),
  status: Joi.string().valid("Active", "Inactive").default("Active"),
}).unknown(true); // Allow file upload field

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

module.exports = {
  validateUser,
  validateAgency,
  validateProfileCompletion,
  validateRequest,
  validateVolunteer,
  requestSchema,
};
