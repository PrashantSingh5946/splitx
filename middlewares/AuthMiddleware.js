const User = require("../models/UserModel");
require("dotenv").config();
const jwt = require("jsonwebtoken");

module.exports.userVerification = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    // Fix #9: return 401 instead of silent HTTP 200.
    return res.status(401).json({ status: false });
  }
  jwt.verify(token, process.env.TOKEN_KEY, async (err, data) => {
    if (err) {
      // Fix #9: return 401 instead of silent HTTP 200.
      return res.status(401).json({ status: false });
    } else {
      const user = await User.findById(data.id);
      if (user) return next();
      // Fix #9: return 401 instead of silent HTTP 200.
      else return res.status(401).json({ status: false });
    }
  });
};
