const User = require("../models/UserModel");
const GroupModel = require("../models/GroupModel");
const { createSecretToken } = require("../util/SecretToken");
const { sendWelcomeEmail } = require("../util/EmailService");
const bcrypt = require("bcryptjs");

// ─── Helper: safe user object (no password) ───────────────────────────────────
function safeUser(user) {
  return {
    _id: user._id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone || null,
    avatarColor: user.avatarColor || "#6366F1",
  };
}

// Fix #19: secure cookie options — httpOnly always, secure+sameSite in production.
function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };
}

// ─── Signup ───────────────────────────────────────────────────────────────────
module.exports.Signup = async (req, res, next) => {
  try {
    let { email, password, username, firstName, lastName, phone } = req.body;

    if (!email || !password || !username || !firstName || !lastName) {
      return res.status(400).json({ message: "All required fields must be filled", success: false });
    }

    const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) {
      return res.status(409).json({ message: "An account with this email already exists", success: false });
    }

    const existingUsername = await User.findOne({ username: username.trim().toLowerCase() });
    if (existingUsername) {
      return res.status(409).json({ message: "That username is already taken", success: false });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      username: username.trim().toLowerCase(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone ? phone.trim() : null,
    });

    // Auto-join any groups that invited this email
    const pendingGroups = await GroupModel.find({
      invitedEmails: email.toLowerCase().trim(),
    });
    for (const group of pendingGroups) {
      group.groupMembers.push(user._id);
      group.invitedEmails = group.invitedEmails.filter(
        (e) => e !== email.toLowerCase().trim()
      );
      await group.save();
      // Fix #12: also push the group into the new user's groups array.
      user.groups.push(group._id);
    }
    if (pendingGroups.length > 0) {
      await user.save();
    }

    // Send welcome email (fire-and-forget — don't block the response)
    sendWelcomeEmail({
      to: user.email,
      firstName: user.firstName,
      username: user.username,
    }).catch((err) => console.error("[EmailService] Welcome email failed:", err));

    const token = createSecretToken(user._id);
    // Fix #19: add secure + sameSite flags.
    res.cookie("token", token, cookieOptions());

    return res.status(201).json({
      message: "Account created successfully",
      success: true,
      user: safeUser(user),
    });
  } catch (error) {
    console.error("[AuthController.Signup]", error);
    return res.status(500).json({ message: "Something went wrong", success: false });
  }
};

// ─── Check email ──────────────────────────────────────────────────────────────
module.exports.CheckEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.json({ exists: false, invited: false });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    const pendingGroup = await GroupModel.findOne({
      invitedEmails: email.toLowerCase().trim(),
    });

    res.json({
      exists: !!user,
      invited: !!pendingGroup,
    });
  } catch (error) {
    console.error("[AuthController.CheckEmail]", error);
    res.status(500).json({ exists: false, invited: false });
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
module.exports.Login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required", success: false });
    }

    // Same message + status for unknown email and wrong password so responses
    // can't be used to enumerate which emails have accounts.
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    const auth = user ? await bcrypt.compare(password, user.password) : false;
    if (!user || !auth) {
      return res.status(401).json({ message: "Invalid email or password", success: false });
    }

    const token = createSecretToken(user._id);
    // Fix #19: add secure + sameSite flags.
    res.cookie("token", token, cookieOptions());

    return res.status(200).json({
      message: "Logged in successfully",
      success: true,
      user: safeUser(user),
    });
  } catch (error) {
    console.error("[AuthController.Login]", error);
    return res.status(500).json({ message: "Something went wrong", success: false });
  }
};
