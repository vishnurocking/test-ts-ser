// ts-server/src/middleware/isInstructor.ts
// Instructor role verification middleware

import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/index.js';

const isInstructor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if user exists in request (should be added by isAuthenticated middleware)
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    // Check if user has instructor role
    if (req.user.role !== UserRole.INSTRUCTOR) {
      res.status(403).json({
        success: false,
        message: "Access denied. Instructor role required.",
      });
      return;
    }

    // User is authenticated and is an instructor
    next();
  } catch (error) {
    console.error("Instructor verification error:", error);
    res.status(500).json({
      success: false,
      message: "Role verification failed",
    });
  }
};

export default isInstructor;