// ts-server/src/middleware/isAuthenticated.ts
// Authentication middleware updated for TypeScript

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pgPool } from '../config/databaseClients.js';
import { User } from '../types/models.js';
import { verifyToken, TokenPayload } from '../utils/generateToken.js';

const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let client;
  try {
    const token = req.cookies.token;

    if (!token) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    // Verify JWT token
    const decoded = verifyToken(token);

    if (!decoded) {
      res.status(401).json({
        success: false,
        message: "Invalid token",
      });
      return;
    }

    // Get user from PostgreSQL
    client = await pgPool.connect();

    const userQuery = `
      SELECT user_id, name, email, role, points, level, streak
      FROM users 
      WHERE user_id = $1
    `;

    const result = await client.query<User>(userQuery, [decoded.userId]);

    if (result.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const user = result.rows[0];

    // Add user info to request object
    req.id = user.user_id;
    req.user = {
      id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      points: user.points,
      level: user.level,
      streak: user.streak,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: "Invalid token",
      });
      return;
    } else if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: "Token expired",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

export default isAuthenticated;