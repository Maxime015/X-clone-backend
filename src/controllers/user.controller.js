import asyncHandler from "express-async-handler";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";

export const getUserProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: "User not found" });

  res.status(200).json({ user });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { userId } = req; // Maintenant depuis le middleware

  const user = await User.findOneAndUpdate({ clerkId: userId }, req.body, { new: true });

  if (!user) return res.status(404).json({ error: "User not found" });

  res.status(200).json({ user });
});

export const syncUser = asyncHandler(async (req, res) => {
  try {
    const { userId } = req; // Maintenant depuis le middleware
    
    console.log("🔍 Syncing user with ID:", userId);

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Vérifier si l'utilisateur existe déjà dans MongoDB
    const existingUser = await User.findOne({ clerkId: userId });
    if (existingUser) {
      console.log("✅ User already exists:", existingUser.email);
      return res.status(200).json({ user: existingUser, message: "User already exists" });
    }

    // Créer un utilisateur avec des données basiques pour le moment
    // Nous améliorerons cela plus tard avec les données Clerk
    const userData = {
      clerkId: userId,
      email: `user-${userId}@temp.com`, // Email temporaire
      firstName: "User",
      lastName: "",
      username: `user_${userId.substring(0, 8)}`, // Génère un username unique
      profilePicture: "",
    };

    console.log("🔄 Creating user with data:", userData);

    const user = await User.create(userData);
    
    console.log("✅ User created successfully:", user.username);
    res.status(201).json({ 
      user, 
      message: "User created successfully" 
    });

  } catch (error) {
    console.error("❌ Sync user error:", error);
    console.error("Error details:", error.message);
    console.error("Stack trace:", error.stack);
    
    res.status(500).json({ 
      error: "Failed to sync user",
      details: error.message 
    });
  }
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  const { userId } = req; // Maintenant depuis le middleware
  const user = await User.findOne({ clerkId: userId });

  if (!user) return res.status(404).json({ error: "User not found" });

  res.status(200).json({ user });
});

export const followUser = asyncHandler(async (req, res) => {
  const { userId } = req; // Maintenant depuis le middleware
  const { targetUserId } = req.params;

  if (userId === targetUserId) return res.status(400).json({ error: "You cannot follow yourself" });

  const currentUser = await User.findOne({ clerkId: userId });
  const targetUser = await User.findById(targetUserId);

  if (!currentUser || !targetUser) return res.status(404).json({ error: "User not found" });

  const isFollowing = currentUser.following.includes(targetUserId);

  if (isFollowing) {
    // unfollow
    await User.findByIdAndUpdate(currentUser._id, {
      $pull: { following: targetUserId },
    });
    await User.findByIdAndUpdate(targetUserId, {
      $pull: { followers: currentUser._id },
    });
  } else {
    // follow
    await User.findByIdAndUpdate(currentUser._id, {
      $push: { following: targetUserId },
    });
    await User.findByIdAndUpdate(targetUserId, {
      $push: { followers: currentUser._id },
    });

    // create notification
    await Notification.create({
      from: currentUser._id,
      to: targetUserId,
      type: "follow",
    });
  }

  res.status(200).json({
    message: isFollowing ? "User unfollowed successfully" : "User followed successfully",
  });
});