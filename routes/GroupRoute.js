const router = require("express").Router();
const {
  Add,
  Get,
  Update,
  Delete,
  ShowAll,
} = require("../controllers/GroupController");
const { userVerification } = require("../middlewares/AuthMiddleware");

router.get("/", userVerification, ShowAll);
router.post("/add", userVerification, Add);
router.get("/get/:id", userVerification, Get);
router.delete("/delete/:id", userVerification, Delete);
router.put("/update/:id", userVerification, Update);

module.exports = router;
