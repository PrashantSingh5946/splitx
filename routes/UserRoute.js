const router = require("express").Router();
const { Me, SearchUsers } = require("../controllers/UserController");
const { userVerification } = require("../middlewares/AuthMiddleware");

router.get("/me", userVerification, Me);
router.get("/search", userVerification, SearchUsers);

module.exports = router;
