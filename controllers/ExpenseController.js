const Expense = require("../models/ExpenseModel");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const GroupModel = require("../models/GroupModel");
const ExpenseModel = require("../models/ExpenseModel");

//Create an expense

module.exports.Add = async (req, res, next) => {
  console.log("Session started");
  const session = await mongoose.startSession();

  try {
    console.log("Data passed ", req.body);
    const { name, amount, group_id } = req.body;
    const token = req.cookies.token;

    const { id } = jwt.verify(token, process.env.TOKEN_KEY);
    // Start the transaction.
    await session.withTransaction(async () => {
      const group = await GroupModel.findOne({ _id: group_id, ownerId: id });
      console.log(group);
      const expense = await Expense.create({
        name,
        amount,
        groupId: group_id,
        ownerId: id,
      });
      group.expenses.push(expense._id);
      await group.save();
    });

    // Commit the transaction.
    await session.commitTransaction();
  } catch (error) {
    // Abort the transaction.
    await session.abortTransaction();
    console.log(error);
    res.status(500);
    // Throw the error.
  } finally {
    // End the session.
    await session.endSession();
  }
  res.send({ status: true, message: "Expense added" });
};

//Read an expense

module.exports.Get = async (req, res) => {
  let expenseData;
  const session = await mongoose.startSession();
  try {
    const { id: expenseId } = req.params;

    const token = req.cookies.token;
    const { id: user_id } = jwt.verify(token, process.env.TOKEN_KEY);

    await session.withTransaction(async () => {
      //Find the expense
      let expense = await Expense.findOne({ _id: expenseId, ownerId: user_id });

      if (!expense) {
        throw "Expense does not exist";
      }

      //Find the group associated
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
    // Abort the transaction.
    await session.abortTransaction();
    console.log(error);
    res.status(500);
    // Throw the error.
  } finally {
    await session.endSession();
  }
  res.send(expenseData);
};

//Update an expense
module.exports.Update = async (req, res) => {
  console.log("Session started");
  const session = await mongoose.startSession();

  try {
    console.log("Data passed ", req.body);
    const { id: expense_id } = req.params;
    const token = req.cookies.token;

    console.log(expense_id);

    const { id } = jwt.verify(token, process.env.TOKEN_KEY);
    // Start the transaction.
    await session.withTransaction(async () => {
      const result = await ExpenseModel.updateOne(
        { _id: expense_id },
        {
          $set: {
            ...req.body,
          },
        }
      );
    });

    // Commit the transaction.
    await session.commitTransaction();
  } catch (error) {
    // Abort the transaction.
    await session.abortTransaction();
    console.log(error);
    res.status(500);
    // Throw the error.
  } finally {
    // End the session.
    await session.endSession();
  }
  res.send({ status: true, message: "Expense Updated " });
};

//Delete an expense

module.exports.Delete = async (req, res) => {
  let expenseData;
  const session = await mongoose.startSession();
  try {
    const { id: expenseId } = req.params;

    const token = req.cookies.token;
    const { id: user_id } = jwt.verify(token, process.env.TOKEN_KEY);

    await session.withTransaction(async () => {
      //Find the expense
      let expense = await Expense.findOne({ _id: expenseId, ownerId: user_id });

      if (!expense) {
        throw "Expense does not exist";
      }

      //Find the group associated
      let group = await GroupModel.findOne({ _id: expense.groupId });

      if (!group) {
        throw "Group does not exist";
      }

      let { groupMembers } = group;

      if (!groupMembers.includes(user_id)) {
        throw "User doesnt have access on the expense group";
      }

      //Start deleting the expense

      //Remove from group expenses array
      const result = await GroupModel.updateOne(
        { _id: group._id },
        { $pull: { expenses: expenseId } }
      );

      console.log(result);

      //Remove the expense from expenses collection

      await ExpenseModel.deleteOne({
        _id: expenseId,
      });
    });

    await session.commitTransaction();
  } catch (error) {
    // Abort the transaction.
    await session.abortTransaction();
    console.log(error);
    res.status(500);
    // Throw the error.
  } finally {
    await session.endSession();
  }
  res.send("Deleted successfully");
};
