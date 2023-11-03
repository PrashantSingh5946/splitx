const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Group name is required"],
    unique: true,
  },

  groupMembers: [{ type: mongoose.Types.ObjectId, ref: "User" }],

  ownerId: { type: mongoose.Types.ObjectId, ref: "User" },

  expenses: [{ type: mongoose.Types.ObjectId, ref: "Expense", default: [] }],

  updatedAt: {
    type: Date,
    default: new Date(),
  },

  createdAt: {
    type: Date,
    default: new Date(),
  },

  totalExpenses: {
    type: Number,
    default: 0,
  },

  settledExpenses: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model("Group", groupSchema);
