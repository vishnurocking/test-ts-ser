// ts-server/src/middleware/optionalAuth.ts
// Optional authentication middleware - sets user ID if token exists but doesn't fail if missing

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface JwtPayload {
  userId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // PRIORITIZE cookies over Authorization headers
    let token = req.cookies.token;
    let tokenSource = "none";
    
    console.log("🍪 Cookie token present:", !!token);
    console.log("🔐 Authorization header present:", !!req.headers.authorization);
    
    // Only use Authorization header if no cookie
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
        tokenSource = "authorization_header";
        console.log("📨 Using Authorization header token");
      }
    } else {
      tokenSource = "cookie";
      console.log("🍪 Using cookie token");
    }

    if (token) {
      try {
        // Validate JWT_SECRET exists
        if (!process.env.JWT_SECRET) {
          console.error("❌ JWT_SECRET not defined in environment variables");
          console.log("ℹ️  Optional auth: Proceeding without authentication due to missing JWT_SECRET");
        } else {
          const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
          req.id = decoded.userId;
          console.log(`✅ Optional auth: User ${decoded.userId} authenticated via ${tokenSource}`);
        }
      } catch (tokenError) {
        console.log(`❌ Optional auth: Invalid token from ${tokenSource}, proceeding without authentication`);
        console.log("Token error:", tokenError.message);
        // Don't set req.id, continue without authentication
      }
    } else {
      console.log("ℹ️  Optional auth: No token provided, proceeding without authentication");
    }

    next(); // Always continue, whether authenticated or not
  } catch (error) {
    console.error("Optional auth middleware error:", error);
    next(); // Continue even if there's an error
  }
};

export default optionalAuth;