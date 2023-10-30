const Expense = require("../models/ExpenseModel");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const GroupModel = require("../models/GroupModel");

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
    res.send(500, "Error occurred");
    // Throw the error.
  } finally {
    // End the session.
    await session.endSession();
  }

  //Complete the request
  res.send("Expense added");
};

//Read an expense

//Update an expense

//Delete an expense
