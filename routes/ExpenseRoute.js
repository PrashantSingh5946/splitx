const { Add } = require("../controllers/ExpenseController");
const router = require("express").Router();
const { userVerification } = require("../middlewares/AuthMiddleware");

router.post("/add", userVerification, Add);

module.exports = router;
