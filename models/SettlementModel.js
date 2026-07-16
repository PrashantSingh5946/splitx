const mongoose = require("mongoose");

// A settle-up payment: `fromId` paid `toId` `amount` in cash/UPI outside the app.
// Settlements adjust balances directly and are not expenses.
const settlementSchema = new mongoose.Schema({
  groupId: { type: mongoose.Types.ObjectId, ref: "Group", required: true },

  fromId: { type: mongoose.Types.ObjectId, ref: "User", required: true },

  toId: { type: mongoose.Types.ObjectId, ref: "User", required: true },

  amount: {
    type: Number,
    required: true,
    min: [0.01, "Settlement amount must be positive"],
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model("Settlement", settlementSchema);
