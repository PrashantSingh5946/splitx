const { Signup, Login, CheckEmail } = require("../controllers/AuthController");
const router = require("express").Router();
const { userVerification } = require("../middlewares/AuthMiddleware");

// Fix #10: add a response handler after userVerification so valid tokens don't hang.
router.post("/", userVerification, (req, res) => {
  res.json({ status: true });
});
router.get("/check-email", CheckEmail);
router.post("/signup", Signup);
router.post("/login", Login);

module.exports = router;
