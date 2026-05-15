const Expense = require("../models/ExpenseModel");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const GroupModel = require("../models/GroupModel");
const ExpenseModel = require("../models/ExpenseModel");

// Fix #6: whitelist of fields that may be updated on an expense.
const UPDATABLE_EXPENSE_FIELDS = ["name", "amount", "splitType", "share", "isSettled"];

// ─── Add ──────────────────────────────────────────────────────────────────────
module.exports.Add = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const token = req.cookies.token;
    const { id } = jwt.verify(token, process.env.TOKEN_KEY);

    const { name, group_id } = req.body;
    // Fix #18: coerce amount to a number; reject non-positive values.
    const amount = Number(req.body.amount);
    if (!name || !amount || amount <= 0 || !group_id) {
      return res.status(400).json({ status: false, message: "Missing or invalid required fields" });
    }

    // Fix (original): use explicit ownerId when the payer is someone other than the auth user.
    const ownerId = req.body.ownerId ?? id;

    await session.withTransaction(async () => {
      const group = await GroupModel.findOne({
        _id: group_id,
        groupMembers: id,
      }).session(session);

      if (!group) throw new Error("Group not found or access denied");

      const [expense] = await Expense.create([{
        name,
        amount,
        groupId: group_id,
        ownerId,
        splitType: req.body.splitType ?? 0,
        share: req.body.share ?? [],
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
    res.status(500).json({ status: false, message: "Error occurred" });
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

      // Fix #18: coerce amount when present.
      if (update.amount !== undefined) {
        update.amount = Number(update.amount);
        if (update.amount <= 0) throw new Error("Amount must be positive");

        // Only adjust the group total when the amount actually changes.
        group.totalExpenses = group.totalExpenses - expense.amount + update.amount;
        await group.save({ session });
      }

      await ExpenseModel.updateOne({ _id: expenseId }, { $set: update }, { session });
    });

    res.json({ status: true, message: "Expense updated" });
  } catch (error) {
    console.error("[ExpenseController.Update]", error);
    res.status(500).json({ status: false, message: "Error occurred" });
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
