const { Add, ShowAll } = require("../controllers/SettlementController");
const router = require("express").Router();
const { userVerification } = require("../middlewares/AuthMiddleware");

router.post("/add", userVerification, Add);
router.get("/group/:group_id", userVerification, ShowAll);

module.exports = router;
