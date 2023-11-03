const {
  Add,
  Get,
  Delete,
  Update,
  ShowAll,
} = require("../controllers/ExpenseController");
const router = require("express").Router();
const { userVerification } = require("../middlewares/AuthMiddleware");

router.get("/group/:group_id", userVerification, ShowAll);
router.post("/add", userVerification, Add);
router.get("/get/:id", userVerification, Get);
router.delete("/delete/:id", userVerification, Delete);
router.put("/update/:id", userVerification, Update);

module.exports = router;
