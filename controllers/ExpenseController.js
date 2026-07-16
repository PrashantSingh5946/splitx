const Expense = require("../models/ExpenseModel");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const GroupModel = require("../models/GroupModel");
const ExpenseModel = require("../models/ExpenseModel");

// Fix #6: whitelist of fields that may be updated on an expense.
const UPDATABLE_EXPENSE_FIELDS = ["name", "amount", "splitType", "share", "isSettled", "percentages"];

// Split-type enum (mirrors util/Enums/SplitType.js).
const SPLIT = { EQUAL_ALL: 0, EQUAL_SOME: 1, ONE_PERSON: 2, PERCENTAGE: 3 };

// Thrown for bad client input so catch blocks can answer 400 instead of 500.
class ValidationError extends Error {}

/**
 * Validates and normalizes split fields against the group's current members.
 * Returns { splitType, share, percentages } ready to persist; throws ValidationError
 * on invalid input. For EQUAL_ALL the share list is snapshotted server-side from
 * current membership so later member changes never rewrite old balances.
 */
function resolveSplit(group, { splitType, share, percentages }) {
  const memberIds = new Set(group.groupMembers.map(m => m.toString()));
  const type = Number(splitType ?? SPLIT.EQUAL_ALL);
  if (![SPLIT.EQUAL_ALL, SPLIT.EQUAL_SOME, SPLIT.ONE_PERSON, SPLIT.PERCENTAGE].includes(type)) {
    throw new ValidationError("Invalid splitType");
  }

  let shareIds = Array.isArray(share) ? [...new Set(share.map(String))] : [];
  for (const sid of shareIds) {
    if (!memberIds.has(sid)) throw new ValidationError("share contains a user who is not a group member");
  }

  if (type === SPLIT.EQUAL_ALL) {
    return {
      splitType: type,
      share: group.groupMembers.map(m => m.toString()),
      percentages: null,
    };
  }
  if (type === SPLIT.EQUAL_SOME) {
    if (shareIds.length === 0) throw new ValidationError("share must list at least one member");
    return { splitType: type, share: shareIds, percentages: null };
  }
  if (type === SPLIT.ONE_PERSON) {
    if (shareIds.length !== 1) throw new ValidationError("one-person split needs exactly one member in share");
    return { splitType: type, share: shareIds, percentages: null };
  }

  // PERCENTAGE
  if (!percentages || typeof percentages !== "object" || Array.isArray(percentages)) {
    throw new ValidationError("percentage split requires a percentages object");
  }
  const clean = {};
  let sum = 0;
  for (const [uid, val] of Object.entries(percentages)) {
    const pct = Number(val);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new ValidationError("Invalid percentage value");
    if (pct === 0) continue;
    if (!memberIds.has(uid)) throw new ValidationError("percentages contains a user who is not a group member");
    clean[uid] = pct;
    sum += pct;
  }
  if (Object.keys(clean).length === 0) throw new ValidationError("percentages must have at least one positive entry");
  if (Math.abs(sum - 100) > 0.5) throw new ValidationError("percentages must sum to 100");
  return { splitType: type, share: Object.keys(clean), percentages: clean };
}

// ─── Add ──────────────────────────────────────────────────────────────────────
module.exports.Add = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const token = req.cookies.token;
    const { id } = jwt.verify(token, process.env.TOKEN_KEY);

    const { name, group_id } = req.body;
    // Fix #18: coerce amount to a number; reject non-positive/NaN values.
    const amount = Number(req.body.amount);
    if (!name || !Number.isFinite(amount) || amount <= 0 || !group_id) {
      return res.status(400).json({ status: false, message: "Missing or invalid required fields" });
    }

    // Fix (original): use explicit ownerId when the payer is someone other than the auth user.
    const ownerId = String(req.body.ownerId ?? id);
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ status: false, message: "Invalid ownerId" });
    }

    await session.withTransaction(async () => {
      const group = await GroupModel.findOne({
        _id: group_id,
        groupMembers: id,
      }).session(session);

      if (!group) throw new Error("Group not found or access denied");

      // Payer must be a member of the group.
      if (!group.groupMembers.some(m => m.toString() === ownerId)) {
        throw new ValidationError("Payer must be a group member");
      }

      const split = resolveSplit(group, {
        splitType: req.body.splitType,
        share: req.body.share,
        percentages: req.body.percentages,
      });

      const [expense] = await Expense.create([{
        name,
        amount,
        groupId: group_id,
        ownerId,
        splitType: split.splitType,
        share: split.share,
        percentages: split.percentages,
        isSettled: req.body.isSettled ?? false,
      }], { session });

      group.expenses.push(expense._id);
      group.totalExpenses += amount;
      await group.save({ session });
    });

    // Fix #1/#2: success response inside try (after withTransaction), error in catch.
    // No manual commitTransaction — withTransaction handles it.
    res.json({ status: true, message: "Expense added" });
  } catch (error) {
    console.error("[ExpenseController.Add]", error);
    const status = error instanceof ValidationError ? 400 : 500;
    res.status(status).json({ status: false, message: error instanceof ValidationError ? error.message : "Error occurred" });
  } finally {
    await session.endSession();
  }
};

// ─── Get ──────────────────────────────────────────────────────────────────────
module.exports.Get = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id: expenseId } = req.params;
    const token = req.cookies.token;
    const { id: userId } = jwt.verify(token, process.env.TOKEN_KEY);

    let expenseData;
    await session.withTransaction(async () => {
      // Fix #3: don't filter by ownerId — any group member may view any expense.
      const expense = await Expense.findById(expenseId).session(session);
      if (!expense) throw new Error("Expense not found");

      // Verify the requesting user is a member of the group that owns this expense.
      const group = await GroupModel.findOne({
        _id: expense.groupId,
        groupMembers: userId,
      }).session(session);

      if (!group) throw new Error("Access denied");

      expenseData = expense;
    });

    // Fix #1/#2: success path inside try.
    res.json(expenseData);
  } catch (error) {
    console.error("[ExpenseController.Get]", error);
    res.status(500).json({ status: false, message: "Error occurred" });
  } finally {
    await session.endSession();
  }
};

// ─── Update ───────────────────────────────────────────────────────────────────
module.exports.Update = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id: expenseId } = req.params;
    const token = req.cookies.token;
    const { id: userId } = jwt.verify(token, process.env.TOKEN_KEY);

    await session.withTransaction(async () => {
      const expense = await ExpenseModel.findById(expenseId).session(session);
      if (!expense) throw new Error("Expense not found");

      // Fix #5: verify the requesting user is a member of the expense's group.
      const group = await GroupModel.findOne({
        _id: expense.groupId,
        groupMembers: userId,
      }).session(session);

      if (!group) throw new Error("Access denied");

      // Fix #6: build the update from a whitelist — never allow raw req.body spread.
      const update = {};
      for (const field of UPDATABLE_EXPENSE_FIELDS) {
        if (req.body[field] !== undefined) update[field] = req.body[field];
      }

      // Fix #18 (hardened): reject NaN/Infinity — `NaN <= 0` is false, so the old
      // check let NaN through and corrupted group.totalExpenses.
      if (update.amount !== undefined) {
        update.amount = Number(update.amount);
        if (!Number.isFinite(update.amount) || update.amount <= 0) {
          throw new ValidationError("Amount must be a positive number");
        }

        // Only adjust the group total when the amount actually changes.
        group.totalExpenses = group.totalExpenses - expense.amount + update.amount;
        await group.save({ session });
      }

      // Re-validate the whole split whenever any split-related field changes.
      if (update.splitType !== undefined || update.share !== undefined || update.percentages !== undefined) {
        const split = resolveSplit(group, {
          splitType: update.splitType ?? expense.splitType,
          share: update.share ?? expense.share,
          percentages: update.percentages ?? expense.percentages,
        });
        update.splitType = split.splitType;
        update.share = split.share;
        update.percentages = split.percentages;
      }

      await ExpenseModel.updateOne({ _id: expenseId }, { $set: update }, { session });
    });

    res.json({ status: true, message: "Expense updated" });
  } catch (error) {
    console.error("[ExpenseController.Update]", error);
    const status = error instanceof ValidationError ? 400 : 500;
    res.status(status).json({ status: false, message: error instanceof ValidationError ? error.message : "Error occurred" });
  } finally {
    await session.endSession();
  }
};

// ─── Delete ───────────────────────────────────────────────────────────────────
module.exports.Delete = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id: expenseId } = req.params;
    const token = req.cookies.token;
    const { id: userId } = jwt.verify(token, process.env.TOKEN_KEY);

    await session.withTransaction(async () => {
      const expense = await Expense.findById(expenseId).session(session);
      if (!expense) throw new Error("Expense not found");

      const group = await GroupModel.findOne({
        _id: expense.groupId,
        groupMembers: userId,
      }).session(session);

      if (!group) throw new Error("Access denied");

      // Fix #4: decrement totalExpenses when the expense is deleted.
      await GroupModel.updateOne(
        { _id: group._id },
        {
          $pull: { expenses: expenseId },
          $inc: { totalExpenses: -expense.amount },
        },
        { session }
      );

      await ExpenseModel.deleteOne({ _id: expenseId }, { session });
    });

    res.json({ status: true, message: "Expense deleted" });
  } catch (error) {
    console.error("[ExpenseController.Delete]", error);
    res.status(500).json({ status: false, message: "Error occurred" });
  } finally {
    await session.endSession();
  }
};

// ─── ShowAll ──────────────────────────────────────────────────────────────────
module.exports.ShowAll = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { group_id } = req.params;
    const token = req.cookies.token;
    const { id: userId } = jwt.verify(token, process.env.TOKEN_KEY);

    let expenseData;
    await session.withTransaction(async () => {
      // Fix #15: check membership and verify the group was actually found.
      const group = await GroupModel.findOne({
        _id: group_id,
        groupMembers: userId,
      }).session(session);

      if (!group) throw new Error("Group not found or access denied");

      // Fix #16: Expense.find() returns [] not null — no null check needed.
      expenseData = await Expense.find({ groupId: group_id }).session(session);
    });

    res.json(expenseData);
  } catch (error) {
    console.error("[ExpenseController.ShowAll]", error);
    res.status(500).json({ status: false, message: "Error occurred" });
  } finally {
    await session.endSession();
  }
};
