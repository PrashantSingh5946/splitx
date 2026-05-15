const jwt = require("jsonwebtoken");
const UserModel = require("../models/UserModel");

module.exports.Me = async (req, res) => {
  try {
    const token = req.cookies.token;
    const { id } = jwt.verify(token, process.env.TOKEN_KEY);
    const user = await UserModel.findById(id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      _id: user._id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || null,
      avatarColor: user.avatarColor || "#6366F1",
    });
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Unauthorized" });
  }
};

module.exports.SearchUsers = async (req, res) => {
  try {
    const token = req.cookies.token;
    const { id: currentUserId } = jwt.verify(token, process.env.TOKEN_KEY);

    const { q } = req.query;
    if (!q || q.trim().length < 1) {
      return res.json([]);
    }

    // Fix #21: escape special regex chars to prevent ReDoS via crafted search strings.
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    const users = await UserModel.find({
      _id: { $ne: currentUserId },
      $or: [
        { firstName: regex },
        { lastName: regex },
        { username: regex },
        { email: regex },
      ],
    })
      .select("_id firstName lastName username email")
      .limit(10);

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json([]);
  }
};
