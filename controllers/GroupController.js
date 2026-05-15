const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const GroupModel = require("../models/GroupModel");
const ExpenseModel = require("../models/ExpenseModel");
const UserModel = require("../models/UserModel");
const { sendGroupInviteEmail, sendAddedToGroupEmail } = require("../util/EmailService");

// Fix #7: whitelist of fields that may be updated on a group.
const UPDATABLE_GROUP_FIELDS = ["name", "emoji"];

// ─── Add ──────────────────────────────────────────────────────────────────────
module.exports.Add = async (req, res, next) => {
  const session = await mongoose.startSession();

  // Fix #11 (same pattern): hoist vars that are needed after withTransaction closes.
  let existingInvited = [];
  let resolvedMemberIds = [];
  let pendingInvites = [];

  try {
    const { name, emoji, group_members = [], invited_emails = [] } = req.body;
    const token = req.cookies.token;
    const { id } = jwt.verify(token, process.env.TOKEN_KEY);

    const allMembers = group_members.includes(id)
      ? group_members
      : [...group_members, id];

    const normalizedInvites = invited_emails
      .map(e => e.toLowerCase().trim())
      .filter(Boolean);

    await session.withTransaction(async () => {
      const users = await UserModel.find({ _id: { $in: allMembers } }).session(session);

      // Fix #8: throw instead of returning early — withTransaction needs a rejection to abort.
      if (users.length !== allMembers.length) {
        throw new Error("One or more group members are invalid");
      }

      existingInvited = normalizedInvites.length
        ? await UserModel.find({ email: { $in: normalizedInvites } }).session(session)
        : [];
      resolvedMemberIds = [
        ...allMembers,
        ...existingInvited.map(u => u._id.toString()),
      ];
      pendingInvites = normalizedInvites.filter(
        e => !existingInvited.find(u => u.email === e)
      );

      const [group] = await GroupModel.create([{
        name,
        emoji: emoji || "🌟",
        groupMembers: resolvedMemberIds,
        invitedEmails: pendingInvites,
        ownerId: id,
      }], { session });

      const groupOwner = await UserModel.findOne({ _id: id }).session(session);
      groupOwner.groups.push(group._id);
      await groupOwner.save({ session });
    });
    // Fix #2: no manual commitTransaction — withTransaction handles it.

    // ── Fire-and-forget emails ───────────────────────────────────────────────
    const owner = await UserModel.findById(id).lean();
    const inviterName = owner ? `${owner.firstName} ${owner.lastName}` : "Someone";
    const createdGroup = await GroupModel.findOne({ ownerId: id, name })
      .sort({ _id: -1 }).lean();
    const gEmoji = (createdGroup && createdGroup.emoji) || "🌟";

    for (const email of pendingInvites) {
      sendGroupInviteEmail({ to: email, inviterName, groupName: name, groupEmoji: gEmoji })
        .catch(err => console.error("[Email] group invite failed:", err));
    }

    const newMembers = await UserModel.find({
      _id: { $in: resolvedMemberIds.filter(mid => mid !== id) },
    }).lean();
    const totalMembers = resolvedMemberIds.length + pendingInvites.length;
    for (const member of newMembers) {
      sendAddedToGroupEmail({
        to: member.email,
        firstName: member.firstName,
        adderName: inviterName,
        groupName: name,
        groupEmoji: gEmoji,
        memberCount: totalMembers,
      }).catch(err => console.error("[Email] added-to-group failed:", err));
    }

    // Fix #1/#2: success response inside try.
    return res.status(201).json({ status: true, message: "Group created Successfully" });
  } catch (error) {
    console.error("[GroupController.Add]", error);
    const msg = error instanceof Error ? error.message : String(error);
    const statusCode = msg === "One or more group members are invalid" ? 400 : 500;
    return res.status(statusCode).json({ status: false, message: msg || "Error occurred" });
  } finally {
    await session.endSession();
  }
};

// ─── Get ──────────────────────────────────────────────────────────────────────
module.exports.Get = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id: groupId } = req.params;
    const token = req.cookies.token;
    const { id: userId } = jwt.verify(token, process.env.TOKEN_KEY);

    let groupData;
    await session.withTransaction(async () => {
      const group = await GroupModel.findOne({
        _id: groupId,
        groupMembers: userId,
      })
        .populate("groupMembers", "firstName lastName username email")
        .session(session);

      if (!group) throw new Error("Group does not exist");
      groupData = group;
    });
    // Fix #2: no manual commitTransaction.

    // Fix #1/#2: success response inside try.
    res.json(groupData);
  } catch (error) {
    console.error("[GroupController.Get]", error);
    res.status(500).json({ status: false, message: "Error occurred" });
  } finally {
    await session.endSession();
  }
};

// ─── Update ───────────────────────────────────────────────────────────────────
module.exports.Update = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id: group_id } = req.params;
    const token = req.cookies.token;
    const { id: owner_id } = jwt.verify(token, process.env.TOKEN_KEY);

    await session.withTransaction(async () => {
      // Fix #7: build update from whitelist — never allow raw req.body spread.
      const update = {};
      for (const field of UPDATABLE_GROUP_FIELDS) {
        if (req.body[field] !== undefined) update[field] = req.body[field];
      }

      await GroupModel.updateOne(
        { _id: group_id, ownerId: owner_id },
        { $set: update },
        { session }
      );
    });
    // Fix #2: no manual commitTransaction.

    // Fix #1/#2: success response inside try.
    res.json({ status: true, message: "Group details Updated" });
  } catch (error) {
    console.error("[GroupController.Update]", error);
    res.status(500).json({ status: false, message: "Error occurred" });
  } finally {
    await session.endSession();
  }
};

// ─── Delete ───────────────────────────────────────────────────────────────────
module.exports.Delete = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id: groupId } = req.params;
    const token = req.cookies.token;
    const { id: userId } = jwt.verify(token, process.env.TOKEN_KEY);

    await session.withTransaction(async () => {
      const group = await GroupModel.findOne({
        _id: groupId,
        ownerId: userId,
      }).session(session);

      if (!group) throw new Error("Group does not exist");

      // Fix #22: remove groupId from ALL members' groups arrays, not just owner's.
      await UserModel.updateMany(
        { _id: { $in: group.groupMembers } },
        { $pull: { groups: group._id } },
        { session }
      );

      await ExpenseModel.deleteMany({ groupId }, { session });
      await GroupModel.deleteOne({ _id: groupId }, { session });
    });
    // Fix #2: no manual commitTransaction.

    // Fix #1/#2: success response inside try.
    res.json({ status: true, message: "Deleted group successfully" });
  } catch (error) {
    console.error("[GroupController.Delete]", error);
    res.status(500).json({ status: false, message: "Error occurred" });
  } finally {
    await session.endSession();
  }
};

// ─── AddMembers ───────────────────────────────────────────────────────────────
module.exports.AddMembers = async (req, res) => {
  const session = await mongoose.startSession();

  // Fix #11: hoist variables that are needed after withTransaction closes.
  let toAdd = [];
  let pendingInvites = [];
  let group = null;

  try {
    const { id: groupId } = req.params;
    const { member_ids = [], invited_emails = [] } = req.body;
    const token = req.cookies.token;
    const { id: userId } = jwt.verify(token, process.env.TOKEN_KEY);

    await session.withTransaction(async () => {
      group = await GroupModel.findOne({ _id: groupId, groupMembers: userId }).session(session);
      if (!group) throw new Error("Group not found or access denied");

      if (member_ids.length > 0) {
        const users = await UserModel.find({ _id: { $in: member_ids } }).session(session);
        if (users.length !== member_ids.length) throw new Error("One or more members are invalid");
      }

      const normalizedInvites = invited_emails.map(e => e.toLowerCase().trim()).filter(Boolean);
      const existingInvited = normalizedInvites.length
        ? await UserModel.find({ email: { $in: normalizedInvites } }).session(session)
        : [];
      pendingInvites = normalizedInvites.filter(e => !existingInvited.find(u => u.email === e));

      toAdd = [
        ...member_ids,
        ...existingInvited.map(u => u._id.toString()),
      ].filter(id => !group.groupMembers.map(m => m.toString()).includes(id));

      if (toAdd.length) {
        await GroupModel.updateOne(
          { _id: groupId },
          { $addToSet: { groupMembers: { $each: toAdd } } },
          { session }
        );
      }
      if (pendingInvites.length) {
        await GroupModel.updateOne(
          { _id: groupId },
          { $addToSet: { invitedEmails: { $each: pendingInvites } } },
          { session }
        );
      }
    });
    // Fix #2: no manual commitTransaction.

    // ── Fire-and-forget emails ───────────────────────────────────────────────
    const adder = await UserModel.findById(userId).lean();
    const adderName = adder ? `${adder.firstName} ${adder.lastName}` : "Someone";
    const freshGroup = await GroupModel.findById(groupId).lean();
    const memberCount = freshGroup ? freshGroup.groupMembers.length : 0;

    if (toAdd.length > 0) {
      const addedUsers = await UserModel.find({ _id: { $in: toAdd } }).lean();
      for (const u of addedUsers) {
        sendAddedToGroupEmail({
          to: u.email,
          firstName: u.firstName,
          adderName,
          groupName: group.name,
          groupEmoji: group.emoji || "🌟",
          memberCount,
        }).catch(err => console.error("[Email] added-to-group failed:", err));
      }
    }

    for (const email of pendingInvites) {
      sendGroupInviteEmail({
        to: email,
        inviterName: adderName,
        groupName: group.name,
        groupEmoji: group.emoji || "🌟",
      }).catch(err => console.error("[Email] group invite failed:", err));
    }

    return res.status(200).json({ status: true, message: "Members added successfully" });
  } catch (error) {
    console.error("[GroupController.AddMembers]", error);
    return res.status(500).json({
      status: false,
      message: error instanceof Error ? error.message : "Error occurred",
    });
  } finally {
    await session.endSession();
  }
};

// ─── ShowAll ──────────────────────────────────────────────────────────────────
module.exports.ShowAll = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const token = req.cookies.token;
    const { id: userId } = jwt.verify(token, process.env.TOKEN_KEY);

    let groupData;
    await session.withTransaction(async () => {
      // Fix #17: find() never returns null — dead null check removed.
      groupData = await GroupModel.find({ groupMembers: userId })
        .populate("groupMembers", "firstName lastName username email")
        .populate("expenses")
        .session(session);
    });
    // Fix #2: no manual commitTransaction.

    // Fix #1/#2: success response inside try.
    res.json(groupData);
  } catch (error) {
    console.error("[GroupController.ShowAll]", error);
    res.status(500).json({ status: false, message: "Error occurred" });
  } finally {
    await session.endSession();
  }
};
