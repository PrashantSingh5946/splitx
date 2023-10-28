const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Group name is required"],
    unique: true,
  },

  groupMembers: [{ type: mongoose.Types.ObjectId, ref: "User" }],

  ownerId: { type: mongoose.Types.ObjectId, ref: "User" },

  expenseIds: [{ type: mongoose.Types.ObjectId, ref: "Expense" }],

  updatedAt: {
    type: Date,
    default: new Date(),
  },

  createdAt: {
    type: Date,
    default: new Date(),
  },
});

module.exports = mongoose.model("Group", groupSchema);
