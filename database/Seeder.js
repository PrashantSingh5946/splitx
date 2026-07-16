/**
 * SplitX — Database Seeder
 *
 * Creates:
 *   • 9 users  (including the "you" account: prashant / octanesingh@gmail.com)
 *   • 3 groups (Goa Trip, Apartment 4B, Weekend Crew)
 *   • 17 expenses spread across the groups
 *
 * Run:  SEED_CONFIRM=yes node database/Seeder.js
 * Env:  MONGO_URL must be set (reads from .env automatically)
 *
 * DESTRUCTIVE: wipes and recreates the seed users, their groups and expenses.
 * It refuses to run unless SEED_CONFIRM=yes is set.
 */
require("dotenv").config();

const MONGO_URL = process.env.MONGO_URL;
if (!MONGO_URL) {
  console.error("❌  MONGO_URL is not set. Add it to .env or the environment. Aborting.");
  process.exit(1);
}
if (process.env.SEED_CONFIRM !== "yes") {
  console.error("❌  Refusing to run: seeding wipes data. Re-run with SEED_CONFIRM=yes.");
  process.exit(1);
}

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { exit } = require("process");

const UserModel = require("../models/UserModel");
const GroupModel = require("../models/GroupModel");
const ExpenseModel = require("../models/ExpenseModel");
const SettlementModel = require("../models/SettlementModel");


const PASSWORD = "Splitx@123"; // shared password for all seed accounts

// ─── split-type enum (mirrors SplitType.js) ───────────────────────────────────
const SPLIT = { EQUAL_ALL: 0, EQUAL_SOME: 1, ONE_PERSON: 2, PERCENTAGE: 3 };

// ─── user definitions ─────────────────────────────────────────────────────────
const USER_DEFS = [
  { firstName: "Prashant", lastName: "Singh", username: "prashant", email: "octanesingh@gmail.com", phone: "+91 98765 00001", avatarColor: "#5B4CF5" },
  { firstName: "Aarav", lastName: "Sharma", username: "aarav.s", email: "aarav.sharma@example.com", phone: "+91 98765 00002", avatarColor: "#EC4899" },
  { firstName: "Priya", lastName: "Kapoor", username: "priya.k", email: "priya.kapoor@example.com", phone: "+91 98765 00003", avatarColor: "#F59E0B" },
  { firstName: "Karan", lastName: "Mehta", username: "karan.m", email: "karan.mehta@example.com", phone: "+91 98765 00004", avatarColor: "#10B981" },
  { firstName: "Meera", lastName: "Iyer", username: "meera.iyer", email: "meera.iyer@example.com", phone: "+91 98765 00005", avatarColor: "#06B6D4" },
  { firstName: "Riya", lastName: "Nair", username: "riya.n", email: "riya.nair@example.com", phone: "+91 98765 00006", avatarColor: "#8B5CF6" },
  { firstName: "Sameer", lastName: "Joshi", username: "sameer.j", email: "sameer.joshi@example.com", phone: "+91 98765 00007", avatarColor: "#F43F5E" },
  { firstName: "Ishaan", lastName: "Verma", username: "ishaan.v", email: "ishaan.verma@example.com", phone: "+91 98765 00008", avatarColor: "#0EA5E9" },
  { firstName: "Tara", lastName: "Bose", username: "tara.bose", email: "tara.bose@example.com", phone: "+91 98765 00009", avatarColor: "#84CC16" },
];

// ─── helpers ──────────────────────────────────────────────────────────────────
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function buildExpense({ name, amount, payer, participants, splitType = SPLIT.EQUAL_ALL, groupId, settled = false, daysBack = 0, percentages }) {
  return ExpenseModel.create({
    name,
    amount,
    ownerId: payer._id,
    groupId,
    splitType,
    share: participants.map(u => u._id),
    percentages,
    isSettled: settled,
    createdAt: daysAgo(daysBack),
    updatedAt: daysAgo(daysBack),
  });
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log("✅  Connected to MongoDB");

  // ── 1. wipe existing seed data (idempotent re-runs) ──────────────────────
  const existingEmails = USER_DEFS.map(u => u.email);
  const existingUsers = await UserModel.find({ email: { $in: existingEmails } });
  const existingIds = existingUsers.map(u => u._id);

  if (existingIds.length) {
    // remove expenses and groups owned by these users
    const groupsToDelete = await GroupModel.find({ ownerId: { $in: existingIds } });
    const groupIds = groupsToDelete.map(g => g._id);
    await ExpenseModel.deleteMany({ groupId: { $in: groupIds } });
    await SettlementModel.deleteMany({ groupId: { $in: groupIds } });
    await GroupModel.deleteMany({ _id: { $in: groupIds } });
    await UserModel.deleteMany({ _id: { $in: existingIds } });
    console.log("🗑️   Cleared previous seed data");
  }

  // ── 2. create users ───────────────────────────────────────────────────────
  const hashedPwd = await bcrypt.hash(PASSWORD, 12);
  const users = {};

  for (const def of USER_DEFS) {
    const user = await UserModel.create({ ...def, password: hashedPwd, groups: [] });
    users[def.username] = user;
    console.log(`👤  Created user: ${def.firstName} ${def.lastName} (${def.email})`);
  }

  // Shorthand aliases
  const prashant = users["prashant"];
  const aarav = users["aarav.s"];
  const priya = users["priya.k"];
  const karan = users["karan.m"];
  const meera = users["meera.iyer"];
  const riya = users["riya.n"];
  const sameer = users["sameer.j"];
  const ishaan = users["ishaan.v"];
  const tara = users["tara.bose"];

  // ── 3. Group 1: Goa Trip 2025 ─────────────────────────────────────────────
  const goaMembers = [prashant, aarav, priya, karan, meera];

  const goa = await GroupModel.create({
    name: "Goa Trip 2025",
    emoji: "🏖️",
    ownerId: prashant._id,
    groupMembers: goaMembers.map(u => u._id),
    invitedEmails: [],
    createdAt: daysAgo(12),
    updatedAt: daysAgo(1),
  });

  const goaExpenses = await Promise.all([
    buildExpense({ name: "Airbnb (3 nights)", amount: 18000, payer: priya, participants: goaMembers, groupId: goa._id, daysBack: 12 }),
    buildExpense({ name: "Cab from airport", amount: 1600, payer: karan, participants: [prashant, karan, meera], groupId: goa._id, splitType: SPLIT.EQUAL_SOME, daysBack: 12 }),
    buildExpense({ name: "Groceries & beer", amount: 3200, payer: prashant, participants: goaMembers, groupId: goa._id, daysBack: 11 }),
    buildExpense({ name: "Scooter rental", amount: 2400, payer: prashant, participants: goaMembers, groupId: goa._id, daysBack: 10 }),
    buildExpense({ name: "Water sports", amount: 5500, payer: meera, participants: goaMembers, groupId: goa._id, daysBack: 10 }),
    buildExpense({ name: "Beach shack dinner", amount: 4800, payer: aarav, participants: goaMembers, groupId: goa._id, daysBack: 9 }),
    buildExpense({ name: "Sunburn concert tickets", amount: 7500, payer: prashant, participants: [prashant, aarav, priya], groupId: goa._id, splitType: SPLIT.EQUAL_SOME, daysBack: 8 }),
    buildExpense({ name: "Dinner at Thalassa", amount: 6800, payer: aarav, participants: goaMembers, groupId: goa._id, daysBack: 7 }),
    buildExpense({
      name: "Villa BBQ night", amount: 4000, payer: prashant, participants: goaMembers,
      groupId: goa._id, splitType: SPLIT.PERCENTAGE, daysBack: 8,
      percentages: {
        [prashant._id]: 40, [aarav._id]: 15, [priya._id]: 15, [karan._id]: 15, [meera._id]: 15,
      },
    }),
    buildExpense({ name: "Cab to airport", amount: 1400, payer: karan, participants: [prashant, karan, meera], groupId: goa._id, splitType: SPLIT.EQUAL_SOME, daysBack: 7, settled: true }),
    buildExpense({ name: "Souvenir shopping split", amount: 2200, payer: priya, participants: [priya, aarav], groupId: goa._id, splitType: SPLIT.EQUAL_SOME, daysBack: 7, settled: true }),
  ]);

  goa.expenses = goaExpenses.map(e => e._id);
  // totalExpenses mirrors ExpenseController.Add semantics: sum of amounts, not count.
  goa.totalExpenses = goaExpenses.reduce((s, e) => s + e.amount, 0);
  goa.settledExpenses = goaExpenses.filter(e => e.isSettled).length;
  await goa.save();

  for (const u of goaMembers) {
    await UserModel.findByIdAndUpdate(u._id, { $addToSet: { groups: goa._id } });
  }
  console.log(`🏖️   Created group: ${goa.name} (${goaExpenses.length} expenses)`);

  // ── 4. Group 2: Apartment 4B ──────────────────────────────────────────────
  const flatMembers = [prashant, riya, sameer];

  const flat = await GroupModel.create({
    name: "Apartment 4B",
    emoji: "🏠",
    ownerId: prashant._id,
    groupMembers: flatMembers.map(u => u._id),
    invitedEmails: [],
    createdAt: daysAgo(90),
    updatedAt: daysAgo(2),
  });

  const flatExpenses = await Promise.all([
    buildExpense({ name: "April rent", amount: 45000, payer: prashant, participants: flatMembers, daysBack: 40 }),
    buildExpense({ name: "Electricity — April", amount: 2700, payer: riya, participants: flatMembers, daysBack: 32 }),
    buildExpense({ name: "Internet — April", amount: 1499, payer: prashant, participants: flatMembers, daysBack: 32 }),
    buildExpense({ name: "Gas cylinder", amount: 950, payer: riya, participants: flatMembers, daysBack: 28, settled: true }),
    buildExpense({ name: "Water purifier service", amount: 850, payer: sameer, participants: flatMembers, daysBack: 20, settled: true }),
    buildExpense({ name: "May rent", amount: 45000, payer: prashant, participants: flatMembers, daysBack: 9 }),
    buildExpense({ name: "Electricity — May", amount: 3100, payer: riya, participants: flatMembers, daysBack: 2 }),
    buildExpense({ name: "Internet — May", amount: 1499, payer: prashant, participants: flatMembers, daysBack: 2 }),
  ]);

  flat.expenses = flatExpenses.map(e => e._id);
  flat.totalExpenses = flatExpenses.reduce((s, e) => s + e.amount, 0);
  flat.settledExpenses = flatExpenses.filter(e => e.isSettled).length;
  await flat.save();

  for (const u of flatMembers) {
    await UserModel.findByIdAndUpdate(u._id, { $addToSet: { groups: flat._id } });
  }
  console.log(`🏠  Created group: ${flat.name} (${flatExpenses.length} expenses)`);

  // ── 5. Group 3: Weekend Crew ──────────────────────────────────────────────
  const crewMembers = [prashant, ishaan, tara, priya];

  const crew = await GroupModel.create({
    name: "Weekend Crew",
    emoji: "🎉",
    ownerId: prashant._id,
    groupMembers: crewMembers.map(u => u._id),
    invitedEmails: [],
    createdAt: daysAgo(60),
    updatedAt: daysAgo(1),
  });

  const crewExpenses = await Promise.all([
    buildExpense({ name: "Movie tickets", amount: 1200, payer: tara, participants: crewMembers, daysBack: 30, settled: true }),
    buildExpense({ name: "Dinner at Social", amount: 3400, payer: prashant, participants: crewMembers, daysBack: 23 }),
    buildExpense({ name: "Bowling night", amount: 2800, payer: ishaan, participants: [prashant, ishaan], groupId: crew._id, splitType: SPLIT.EQUAL_SOME, daysBack: 16 }),
    buildExpense({ name: "Sunday brunch", amount: 2100, payer: ishaan, participants: crewMembers, daysBack: 9 }),
    buildExpense({ name: "UNO night snacks", amount: 850, payer: priya, participants: crewMembers, daysBack: 6 }),
    buildExpense({ name: "Coffee run", amount: 540, payer: prashant, participants: crewMembers, daysBack: 2 }),
  ]);

  crew.expenses = crewExpenses.map(e => e._id);
  crew.totalExpenses = crewExpenses.reduce((s, e) => s + e.amount, 0);
  crew.settledExpenses = crewExpenses.filter(e => e.isSettled).length;
  await crew.save();

  for (const u of crewMembers) {
    await UserModel.findByIdAndUpdate(u._id, { $addToSet: { groups: crew._id } });
  }
  console.log(`🎉  Created group: ${crew.name} (${crewExpenses.length} expenses)`);

  // ── summary ───────────────────────────────────────────────────────────────
  const totalExp = goaExpenses.length + flatExpenses.length + crewExpenses.length;
  console.log("\n─────────────────────────────────────────");
  console.log(`✅  Seed complete`);
  console.log(`    ${USER_DEFS.length} users   •  3 groups   •  ${totalExp} expenses`);
  console.log(`    Login with any seed account using password: ${PASSWORD}`);
  console.log(`    Primary account: octanesingh@gmail.com`);
  console.log("─────────────────────────────────────────\n");

  await mongoose.disconnect();
  exit(0);
}

seed().catch(err => {
  console.error("❌  Seed failed:", err);
  exit(1);
});
