const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Group name is required"],
    // Fix #13: removed global unique:true — group names should be unique per owner,
    // not globally. Drop the old index on the DB side via:
    //   db.groups.dropIndex("name_1")
  },

  emoji: {
    type: String,
    default: "🌟",
  },

  groupMembers: [{ type: mongoose.Types.ObjectId, ref: "User" }],

  ownerId: { type: mongoose.Types.ObjectId, ref: "User" },

  expenses: [{ type: mongoose.Types.ObjectId, ref: "Expense", default: [] }],

  settlements: [{ type: mongoose.Types.ObjectId, ref: "Settlement", default: [] }],

  invitedEmails: [{ type: String }],

  totalExpenses: {
    type: Number,
    default: 0,
  },

  settledExpenses: {
    type: Number,
    default: 0,
  },
}, {
  // Fix #14: built-in timestamps — createdAt/updatedAt set per-document correctly.
  timestamps: true,
});

module.exports = mongoose.model("Group", groupSchema);
