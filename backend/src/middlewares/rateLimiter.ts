import rateLimit from "express-rate-limit";

export const globalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 500, // limit each IP to 500 requests per windowMs
  message: {
    status: "error",
    message: "Too many requests from this IP, please try again later.",
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // limit each IP to 20 requests per windowMs
  message: {
    status: "error",
    message: "Too many login attempts from this IP, please try again later.",
  },
});
