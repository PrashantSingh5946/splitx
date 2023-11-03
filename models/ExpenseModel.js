const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Expense name is required"],
  },

  amount: {
    type: Number,
    required: true,
    default: 0,
  },

  ownerId: { type: mongoose.Types.ObjectId, ref: "User" },

  groupId: { type: mongoose.Types.ObjectId, ref: "Group" },

  updatedAt: {
    type: Date,
    default: new Date(),
  },

  isSettled: {
    type: Boolean,
    default: false,
  },

  splitType: {
    type: Number,
    default: 0,
  },

  share: {
    type: Array,
    default: [],
    required: true,
  },

  createdAt: {
    type: Date,
    default: new Date(),
  },
});

module.exports = mongoose.model("Expense", expenseSchema);
