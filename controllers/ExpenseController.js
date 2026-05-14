const Expense = require("../models/ExpenseModel");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const GroupModel = require("../models/GroupModel");
const ExpenseModel = require("../models/ExpenseModel");

module.exports.Add = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { name, amount, group_id } = req.body;
    const token = req.cookies.token;

    const { id } = jwt.verify(token, process.env.TOKEN_KEY);
    await session.withTransaction(async () => {
      const group = await GroupModel.findOne({
        _id: group_id,
        groupMembers: id,
      });
      const expense = await Expense.create({
        name,
        amount,
        groupId: group_id,
        ownerId: id,
        splitType: req.body.splitType ?? 0,
        share: req.body.share ?? [],
        isSettled: req.body.isSettled ?? false,
      });
      group.expenses.push(expense._id);
      group.totalExpenses += amount;
      await group.save();
    });

    await session.commitTransaction();
  } catch (error) {
    console.error(error);
    res.status(500);
  } finally {
    await session.endSession();
  }
  res.send({ status: true, message: "Expense added" });
};

module.exports.Get = async (req, res) => {
  let expenseData;
  const session = await mongoose.startSession();
  try {
    const { id: expenseId } = req.params;

    const token = req.cookies.token;
    const { id: user_id } = jwt.verify(token, process.env.TOKEN_KEY);

    await session.withTransaction(async () => {
      let expense = await Expense.findOne({ _id: expenseId, ownerId: user_id });

      if (!expense) {
        throw "Expense does not exist";
      }

      let group = await GroupModel.findOne({ _id: expense.groupId });

      if (!group) {
        throw "Group does not exist";
      }

      let { groupMembers } = group;

      if (groupMembers.includes(user_id)) {
        expenseData = expense;
      }
    });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    console.error(error);
    res.status(500);
  } finally {
    await session.endSession();
  }
  res.send(expenseData);
};

module.exports.Update = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id: expense_id } = req.params;
    const token = req.cookies.token;

    const { id } = jwt.verify(token, process.env.TOKEN_KEY);
    await session.withTransaction(async () => {
      const old_expense = await ExpenseModel.findOne({ _id: expense_id });

      await ExpenseModel.updateOne(
        { _id: expense_id },
        { $set: { ...req.body } }
      );

      if (req.body.amount !== undefined) {
        const group = await GroupModel.findOne({
          _id: old_expense.groupId,
          groupMembers: id,
        });
        group.totalExpenses =
          group.totalExpenses - old_expense.amount + req.body.amount;
        await group.save();
      }
    });

    await session.commitTransaction();
  } catch (error) {
    console.error(error);
    res.status(500);
  } finally {
    await session.endSession();
  }
  res.send({ status: true, message: "Expense Updated " });
};

module.exports.Delete = async (req, res) => {
  let expenseData;
  const session = await mongoose.startSession();
  try {
    const { id: expenseId } = req.params;

    const token = req.cookies.token;
    const { id: user_id } = jwt.verify(token, process.env.TOKEN_KEY);

    await session.withTransaction(async () => {
      let expense = await Expense.findOne({ _id: expenseId, ownerId: user_id });

      if (!expense) {
        throw "Expense does not exist";
      }

      let group = await GroupModel.findOne({ _id: expense.groupId });

      if (!group) {
        throw "Group does not exist";
      }

      let { groupMembers } = group;

      if (!groupMembers.includes(user_id)) {
        throw "User doesnt have access on the expense group";
      }

      await GroupModel.updateOne(
        { _id: group._id },
        { $pull: { expenses: expenseId } }
      );

      await ExpenseModel.deleteOne({ _id: expenseId });
    });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    console.error(error);
    res.status(500);
  } finally {
    await session.endSession();
  }
  res.send("Deleted successfully");
};

module.exports.ShowAll = async (req, res) => {
  let expenseData;
  const session = await mongoose.startSession();
  try {
    const { group_id } = req.params;

    const token = req.cookies.token;
    const { id: user_id } = jwt.verify(token, process.env.TOKEN_KEY);

    await session.withTransaction(async () => {
      let group = await GroupModel.findOne({
        _id: group_id,
        groupMembers: user_id,
      });

      let expenses = await Expense.find({ groupId: group_id });

      if (!expenses) {
        throw "Expense does not exist";
      }

      expenseData = expenses;
    });

    await session.commitTransaction();
  } catch (error) {
    console.error(error);
    res.status(500);
  } finally {
    await session.endSession();
  }
  res.send(expenseData);
};
