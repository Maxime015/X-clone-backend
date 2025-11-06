import asyncHandler from "express-async-handler";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import { getAuth } from "@clerk/express";

// Correction : importez createClerkClient au lieu de Clerk
import { createClerkClient } from '@clerk/backend';

// Initialisez clerkClient avec createClerkClient
const clerkClient = createClerkClient({ 
  secretKey: process.env.CLERK_SECRET_KEY 
});

export const getUserProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: "User not found" });

  res.status(200).json({ user });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);

  const user = await User.findOneAndUpdate({ clerkId: userId }, req.body, { new: true });

  if (!user) return res.status(404).json({ error: "User not found" });

  res.status(200).json({ user });
});

export const syncUser = asyncHandler(async (req, res) => {
  try {
    const { userId } = getAuth(req);
    
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

    // Récupérer les données utilisateur depuis Clerk
    console.log("📡 Fetching user data from Clerk...");
    const clerkUser = await clerkClient.users.getUser(userId);
    console.log("📋 Clerk user data received");
    
    // Valider les données Clerk
    if (!clerkUser.emailAddresses || clerkUser.emailAddresses.length === 0) {
      console.log("❌ No email addresses found for user");
      return res.status(400).json({ error: "No email address found for user" });
    }

    // Préparer les données utilisateur
    const userData = {
      clerkId: userId,
      email: clerkUser.emailAddresses[0].emailAddress,
      firstName: clerkUser.firstName || "User",
      lastName: clerkUser.lastName || "",
      username: clerkUser.emailAddresses[0].emailAddress.split("@")[0],
      profilePicture: clerkUser.imageUrl || "",
    };

    console.log("🔄 Creating user with data:", {
      email: userData.email,
      username: userData.username,
      firstName: userData.firstName
    });

    // Créer l'utilisateur dans MongoDB
    const user = await User.create(userData);
    
    console.log("✅ User created successfully:", user.email);
    res.status(201).json({ 
      user, 
      message: "User created successfully" 
    });

  } catch (error) {
    console.error("❌ Sync user error:", error);
    console.error("Error details:", error.message);
    
    res.status(500).json({ 
      error: "Failed to sync user",
      details: error.message 
    });
  }
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const user = await User.findOne({ clerkId: userId });

  if (!user) return res.status(404).json({ error: "User not found" });

  res.status(200).json({ user });
});

export const followUser = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
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