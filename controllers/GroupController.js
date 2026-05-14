const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const GroupModel = require("../models/GroupModel");
const ExpenseModel = require("../models/ExpenseModel");
const UserModel = require("../models/UserModel");
const { sendGroupInviteEmail, sendAddedToGroupEmail } = require("../util/EmailService");

module.exports.Add = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { name, emoji, group_members = [], invited_emails = [] } = req.body;

    const token = req.cookies.token;

    const { id } = jwt.verify(token, process.env.TOKEN_KEY);

    // Include the owner in the group members list if not already present
    const allMembers = group_members.includes(id)
      ? group_members
      : [...group_members, id];

    // Normalise invited emails to lowercase, exclude anyone already on the platform
    const normalizedInvites = invited_emails
      .map(e => e.toLowerCase().trim())
      .filter(Boolean);

    await session.withTransaction(async () => {
      const users = await UserModel.find({ _id: { $in: allMembers } });

      if (users.length !== allMembers.length) {
        return res.status(400).json({ status: false, message: "One or more group members are invalid" });
      }

      // If any invited email already has an account, add them as a real member instead
      const existingInvited = await UserModel.find({
        email: { $in: normalizedInvites },
      });
      const resolvedMemberIds = [
        ...allMembers,
        ...existingInvited.map(u => u._id.toString()),
      ];
      const pendingInvites = normalizedInvites.filter(
        e => !existingInvited.find(u => u.email === e)
      );

      const group = await GroupModel.create({
        name,
        emoji: emoji || "🌟",
        groupMembers: resolvedMemberIds,
        invitedEmails: pendingInvites,
        ownerId: id,
      });

      const groupOwner = await UserModel.findOne({ _id: id });
      groupOwner.groups.push(group._id);
      await groupOwner.save();
    });

    await session.commitTransaction();

    // ── Fire-and-forget emails ───────────────────────────────────────────────
    // Fetch owner for display name in emails
    const owner = await UserModel.findById(id).lean();
    const inviterName = owner ? `${owner.firstName} ${owner.lastName}` : "Someone";
    const createdGroup = await GroupModel.findOne({ ownerId: id, name })
      .sort({ _id: -1 }).lean();
    const gEmoji = (createdGroup && createdGroup.emoji) || "🌟";
    const gName  = name;

    // 1. Invite emails for non-users
    for (const email of normalizedInvites.filter(e => !existingInvited.find(u => u.email === e))) {
      sendGroupInviteEmail({ to: email, inviterName, groupName: gName, groupEmoji: gEmoji })
        .catch(err => console.error("[Email] group invite failed:", err));
    }

    // 2. "Added to group" emails for existing users (excluding the owner)
    const newMembers = await UserModel.find({
      _id: { $in: resolvedMemberIds.filter(mid => mid !== id) },
    }).lean();
    const totalMembers = resolvedMemberIds.length + (createdGroup?.invitedEmails?.length || 0);
    for (const member of newMembers) {
      sendAddedToGroupEmail({
        to: member.email,
        firstName: member.firstName,
        adderName: inviterName,
        groupName: gName,
        groupEmoji: gEmoji,
        memberCount: totalMembers,
      }).catch(err => console.error("[Email] added-to-group failed:", err));
    }

    return res.status(201).json({ status: true, message: "Group created Successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Error occurred" });
  } finally {
    await session.endSession();
  }
};

module.exports.Get = async (req, res) => {
  let groupData;
  const session = await mongoose.startSession();
  try {
    const { id: groupId } = req.params;

    const token = req.cookies.token;
    const { id: user_id } = jwt.verify(token, process.env.TOKEN_KEY);

    await session.withTransaction(async () => {
      let group = await GroupModel.findOne({
        _id: groupId,
        groupMembers: user_id,
      }).populate("groupMembers", "firstName lastName username email");

      if (!group) {
        throw "Group does not exist";
      }

      groupData = group;
    });

    await session.commitTransaction();
  } catch (error) {
    console.error(error);
    res.status(500);
  } finally {
    await session.endSession();
  }
  res.send(groupData);
};

module.exports.Update = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id: group_id } = req.params;
    const token = req.cookies.token;

    const { id: owner_id } = jwt.verify(token, process.env.TOKEN_KEY);
    await session.withTransaction(async () => {
      await GroupModel.updateOne(
        { _id: group_id, ownerId: owner_id },
        { $set: { ...req.body } }
      );
    });

    await session.commitTransaction();
  } catch (error) {
    console.error(error);
    res.status(500);
  } finally {
    await session.endSession();
  }
  res.send({ status: true, message: "Group details Updated" });
};

module.exports.Delete = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id: groupId } = req.params;

    const token = req.cookies.token;
    const { id: user_id } = jwt.verify(token, process.env.TOKEN_KEY);

    await session.withTransaction(async () => {
      let group = await GroupModel.findOne({
        _id: groupId,
        ownerId: user_id,
      });

      if (!group) {
        throw "Group does not exist";
      }

      let groupOwner = await UserModel.findOne({ _id: user_id });
      groupOwner.groups.pull(groupId);
      await groupOwner.save();

      await ExpenseModel.deleteMany({ groupId });

      await GroupModel.deleteOne({ _id: groupId });
    });

    await session.commitTransaction();
  } catch (error) {
    console.error(error);
    res.status(500);
  } finally {
    await session.endSession();
  }
  res.send("Deleted group successfully");
};

module.exports.AddMembers = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id: groupId } = req.params;
    const { member_ids = [], invited_emails = [] } = req.body;
    const token = req.cookies.token;
    const { id: userId } = jwt.verify(token, process.env.TOKEN_KEY);

    await session.withTransaction(async () => {
      const group = await GroupModel.findOne({ _id: groupId, groupMembers: userId });
      if (!group) throw "Group not found or access denied";

      // Validate real member IDs
      if (member_ids.length > 0) {
        const users = await UserModel.find({ _id: { $in: member_ids } });
        if (users.length !== member_ids.length) throw "One or more members are invalid";
      }

      // Resolve invited emails that already have accounts
      const normalizedInvites = invited_emails.map(e => e.toLowerCase().trim()).filter(Boolean);
      const existingInvited = normalizedInvites.length
        ? await UserModel.find({ email: { $in: normalizedInvites } })
        : [];
      const pendingInvites = normalizedInvites.filter(e => !existingInvited.find(u => u.email === e));

      const toAdd = [
        ...member_ids,
        ...existingInvited.map(u => u._id.toString()),
      ].filter(id => !group.groupMembers.map(m => m.toString()).includes(id));

      if (toAdd.length) {
        await GroupModel.updateOne(
          { _id: groupId },
          { $addToSet: { groupMembers: { $each: toAdd } } }
        );
      }
      if (pendingInvites.length) {
        await GroupModel.updateOne(
          { _id: groupId },
          { $addToSet: { invitedEmails: { $each: pendingInvites } } }
        );
      }
    });

    await session.commitTransaction();

    // ── Fire-and-forget emails ───────────────────────────────────────────────
    const adder = await UserModel.findById(userId).lean();
    const adderName = adder ? `${adder.firstName} ${adder.lastName}` : "Someone";
    const freshGroup = await GroupModel.findById(groupId).lean();
    const memberCount = freshGroup ? freshGroup.groupMembers.length : 0;

    // 1. "You've been added" emails to newly added real users
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

    // 2. Invite emails to pending email addresses
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
    console.error(error);
    return res.status(500).json({ status: false, message: typeof error === 'string' ? error : "Error occurred" });
  } finally {
    await session.endSession();
  }
};

module.exports.ShowAll = async (req, res) => {
  let groupData;
  const session = await mongoose.startSession();
  try {
    const token = req.cookies.token;
    const { id: user_id } = jwt.verify(token, process.env.TOKEN_KEY);

    await session.withTransaction(async () => {
      let groups = await GroupModel.find({ groupMembers: user_id })
        .populate("groupMembers", "firstName lastName username email")
        .populate("expenses");

      if (!groups) {
        throw "Group does not exist";
      }

      groupData = groups;
    });

    await session.commitTransaction();
  } catch (error) {
    console.error(error);
    res.status(500);
  } finally {
    await session.endSession();
  }
  res.send(groupData);
};
