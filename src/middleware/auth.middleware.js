import { getAuth } from "@clerk/express";

export const protectRoute = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized - you must be logged in" });
    }
    
    // Attach userId to request for use in controllers
    req.userId = userId;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ message: "Unauthorized - invalid token" });
  }
};