const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const GroupModel = require("../models/GroupModel");
const ExpenseModel = require("../models/ExpenseModel");
const UserModel = require("../models/UserModel");

//Create an expense
module.exports.Add = async (req, res, next) => {
  console.log("Session started");
  const session = await mongoose.startSession();

  try {
    console.log("Data passed ", req.body);

    const { name, group_members } = req.body;

    const token = req.cookies.token;

    const { id } = jwt.verify(token, process.env.TOKEN_KEY);

    // Start the transaction.
    await session.withTransaction(async () => {
      //Check if all the users exist in the group_members list
      const users = await UserModel.find({ _id: { $in: group_members } });

      console.log(users);

      console.log(users.length);

      if (!(users.length === group_members.length)) {
        res.status(401);
        throw "Group members are invalid";
      }

      //Create the group
      const group = await GroupModel.create({
        name,
        groupMembers: group_members,
        ownerId: id,
      });

      console.log(group);

      //Add the group to the User's group list

      const groupOwner = await UserModel.findOne({ _id: id });
      groupOwner.groups.push(group._id);
      groupOwner.save();

      console.log(groupOwner);
    });

    // Commit the transaction.
    await session.commitTransaction();
  } catch (error) {
    // Abort the transaction.
    //await session.abortTransaction();
    console.log(error);
    res.status(500);
    res.send("Error occurred");
    // Throw the error.
  } finally {
    // End the session.
    await session.endSession();
  }
  res.send({ status: true, message: "Group created Successfully" });
};

//Read an expense
module.exports.Get = async (req, res) => {
  let groupData;
  const session = await mongoose.startSession();
  try {
    const { id: groupId } = req.params;

    const token = req.cookies.token;
    const { id: user_id } = jwt.verify(token, process.env.TOKEN_KEY);

    await session.withTransaction(async () => {
      //Find the expense
      let group = await GroupModel.findOne({
        _id: groupId,
        groupMembers: user_id,
      });

      if (!group) {
        throw "Group does not exist";
      }

      groupData = group;
    });

    await session.commitTransaction();
  } catch (error) {
    // Abort the transaction.
    console.log(error);
    res.status(500);
    // Throw the error.
  } finally {
    await session.endSession();
  }
  res.send(groupData);
};

//Update an expense
module.exports.Update = async (req, res) => {
  console.log("Session started");
  const session = await mongoose.startSession();

  try {
    console.log("Data passed ", req.body);
    const { id: group_id } = req.params;
    const token = req.cookies.token;

    console.log(group_id);

    const { id: owner_id } = jwt.verify(token, process.env.TOKEN_KEY);
    // Start the transaction.
    await session.withTransaction(async () => {
      const result = await GroupModel.updateOne(
        { _id: group_id, ownerId: owner_id },
        {
          $set: {
            ...req.body,
          },
        }
      );
    });

    console.log(result);

    // Commit the transaction.
    await session.commitTransaction();
  } catch (error) {
    console.log(error);
    res.status(500);
    // Throw the error.
  } finally {
    // End the session.
    await session.endSession();
  }
  res.send({ status: true, message: "Group details Updated" });
};

//Delete an expense
module.exports.Delete = async (req, res) => {
  let group;

  const session = await mongoose.startSession();
  try {
    const { id: groupId } = req.params;

    const token = req.cookies.token;
    const { id: user_id } = jwt.verify(token, process.env.TOKEN_KEY);

    await session.withTransaction(async () => {
      //Find the expense
      let group = await GroupModel.findOne({
        _id: groupId,
        ownerId: user_id,
      });

      if (!group) {
        throw "Group does not exist";
      }

      //Start deleting the group

      //Detach from user document

      let groupOwner = await UserModel.findOne({ _id: user_id });
      groupOwner.groups.pull(groupId);
      await groupOwner.save();

      console.log(groupOwner);

      //Remove all the expenses associated with the group

      await ExpenseModel.deleteMany({ groupId });

      //Remove the group

      await GroupModel.deleteOne({ _id: groupId });
    });

    await session.commitTransaction();
  } catch (error) {
    // Abort the transaction.
    console.log(error);
    res.status(500);
    // Throw the error.
  } finally {
    await session.endSession();
  }
  res.send("Deleted group successfully");
};

//Show all groups associated with a user_id
module.exports.ShowAll = async (req, res) => {
  let groupData;
  const session = await mongoose.startSession();
  try {
    const token = req.cookies.token;
    const { id: user_id } = jwt.verify(token, process.env.TOKEN_KEY);

    await session.withTransaction(async () => {
      //Find the expense
      let groups = await GroupModel.find({
        ownerId: user_id,
      });

      if (!groups) {
        throw "Group does not exist";
      }

      groupData = groups;
    });

    await session.commitTransaction();
  } catch (error) {
    // Abort the transaction.
    console.log(error);
    res.status(500);
    // Throw the error.
  } finally {
    await session.endSession();
  }
  res.send(groupData);
};
