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

  // For splitType 3 (percentage): map of userId → percentage (values sum to 100).
  // Stored so balances survive refetch instead of being recomputed client-side.
  percentages: {
    type: mongoose.Schema.Types.Mixed,
    default: undefined,
  },
}, {
  // Fix #14: use built-in timestamps so createdAt/updatedAt are set per-document,
  // not once at module load time (the old `default: new Date()` bug).
  timestamps: true,
});

module.exports = mongoose.model("Expense", expenseSchema);
