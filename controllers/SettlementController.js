const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const GroupModel = require("../models/GroupModel");
const SettlementModel = require("../models/SettlementModel");

class ValidationError extends Error {}

// ─── Add ──────────────────────────────────────────────────────────────────────
// POST /settlements/add — records that the auth user paid `toId` `amount`.
module.exports.Add = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const token = req.cookies.token;
    const { id: userId } = jwt.verify(token, process.env.TOKEN_KEY);

    const { group_id } = req.body;
    const toId = String(req.body.toId ?? "");
    const amount = Number(req.body.amount);

    if (!group_id || !mongoose.Types.ObjectId.isValid(toId)) {
      return res.status(400).json({ status: false, message: "Missing or invalid required fields" });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ status: false, message: "Amount must be a positive number" });
    }
    if (toId === String(userId)) {
      return res.status(400).json({ status: false, message: "Cannot settle up with yourself" });
    }

    await session.withTransaction(async () => {
      const group = await GroupModel.findOne({
        _id: group_id,
        groupMembers: userId,
      }).session(session);

      if (!group) throw new Error("Group not found or access denied");

      if (!group.groupMembers.some(m => m.toString() === toId)) {
        throw new ValidationError("Recipient must be a group member");
      }

      const [settlement] = await SettlementModel.create([{
        groupId: group_id,
        fromId: userId,
        toId,
        amount,
      }], { session });

      group.settlements.push(settlement._id);
      await group.save({ session });
    });

    res.status(201).json({ status: true, message: "Settlement recorded" });
  } catch (error) {
    console.error("[SettlementController.Add]", error);
    const status = error instanceof ValidationError ? 400 : 500;
    res.status(status).json({ status: false, message: error instanceof ValidationError ? error.message : "Error occurred" });
  } finally {
    await session.endSession();
  }
};

// ─── ShowAll ──────────────────────────────────────────────────────────────────
// GET /settlements/group/:group_id — all settlements for a group (members only).
module.exports.ShowAll = async (req, res) => {
  try {
    const { group_id } = req.params;
    const token = req.cookies.token;
    const { id: userId } = jwt.verify(token, process.env.TOKEN_KEY);

    const group = await GroupModel.findOne({
      _id: group_id,
      groupMembers: userId,
    });

    if (!group) return res.status(404).json({ status: false, message: "Group not found or access denied" });

    const settlements = await SettlementModel.find({ groupId: group_id }).sort({ createdAt: -1 });
    res.json(settlements);
  } catch (error) {
    console.error("[SettlementController.ShowAll]", error);
    res.status(500).json({ status: false, message: "Error occurred" });
  }
};
