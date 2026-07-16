const { Signup, Login, CheckEmail } = require("../controllers/AuthController");
const router = require("express").Router();
const { userVerification } = require("../middlewares/AuthMiddleware");
const { rateLimit } = require("../middlewares/RateLimiter");

// Brute-force / enumeration protection on the unauthenticated endpoints.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const emailCheckLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

// Fix #10: add a response handler after userVerification so valid tokens don't hang.
router.post("/", userVerification, (req, res) => {
  res.json({ status: true });
});
router.get("/check-email", emailCheckLimiter, CheckEmail);
router.post("/signup", authLimiter, Signup);
router.post("/login", authLimiter, Login);

module.exports = router;
