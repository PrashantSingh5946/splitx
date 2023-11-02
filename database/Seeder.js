const mongoose = require("mongoose");
const { faker } = require("@faker-js/faker");
const { MONGO_URL } = process.env;
const UserModel = require("../models/UserModel");
const GroupModel = require("../models/GroupModel");
const ExpenseModel = require("../models/ExpenseModel");
const bcrypt = require("bcryptjs");

mongoose.connect(MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Function to generate fake data

const generateFakeData = async () => {
  const fakeData = {
    username: faker.internet.userName(),
    firstName: faker.name.firstName(),
    lastName: faker.name.lastName(),
    email: faker.internet.email(),
    password: await bcrypt.hash("Bharat@123", 12),
    groups: [],
  };

  return fakeData;
};

const generateFakeGroups = (owner_id) => {
  const fakeGroup = {
    // Define your schema fields and generate fake data using 'faker' functions
    name: faker.lorem.words(4),
    groupMembers: [owner_id],
    ownerId: owner_id,
  };

  return fakeGroup;
};

const generateFakeExpenses = (group_id, spender_id) => {
  const fakeExpense = {
    // Define your schema fields and generate fake data using 'faker' functions
    name: faker.lorem.words(4),
    amount: faker.number.int(),
    groupId: group_id,
    ownerId: spender_id,
  };

  return fakeExpense;
};

// Function to save fake data to the database
const saveFakeDataToDatabase = async () => {
  try {
    const fakeUsers = await generateFakeData();
    const user = await UserModel.create(fakeUsers);

    const fakeGroup = generateFakeGroups(user._id);
    const group = await GroupModel.create(fakeGroup);

    //Add groupid to the groups array in User document
    const current_user = await UserModel.findById(user._id);

    current_user.groups.push(group._id);
    await current_user.save();

    //Add expenses to the group
    const fakeExpense = generateFakeExpenses(group._id, user._id);
    const expense = await ExpenseModel.create(fakeExpense);
    group.expenses.push(expense._id);
    await group.save();

    console.log("Saved fake data to the database:", user, group);
  } catch (error) {
    console.error("Error saving fake data:", error);
  }
};

// Generate and save multiple fake data entries
const numberOfEntriesToGenerate = 10;

for (let i = 0; i < numberOfEntriesToGenerate; i++) {
  saveFakeDataToDatabase();
}
