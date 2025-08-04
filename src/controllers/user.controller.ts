// ts-server/src/controllers/user.controller.ts
// User controller with TypeScript

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid';
import { pgPool, query } from '../config/databaseClients.js';
import { generateToken } from '../utils/generateToken.js';
import { 
  User, 
  RegisterRequest, 
  LoginRequest, 
  GoogleLoginRequest,
  UpdateProfileRequest,
  AuthResponse,
  ApiResponse 
} from '../types/index.js';

// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// User registration
export const register = async (
  req: Request<{}, {}, RegisterRequest>,
  res: Response<AuthResponse>
): Promise<void> => {
  let client;
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
      return;
    }

    client = await pgPool.connect();

    // Check if user already exists
    const existingUser = await client.query<{ user_id: string }>(
      "SELECT user_id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      res.status(400).json({
        success: false,
        message: "User already exists.",
      });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    // Create user
    const insertQuery = `
      INSERT INTO users (user_id, name, email, password, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING user_id, name, email, role, created_at
    `;

    const result = await client.query<User>(insertQuery, [
      userId,
      name,
      email,
      hashedPassword,
      "Learner", // Default role
    ]);

    const user = result.rows[0];

    // Generate token
    const token = generateToken(user.user_id);

    // Set HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to register user.",
    });
  } finally {
    if (client) client.release();
  }
};

// User login
export const login = async (
  req: Request<{}, {}, LoginRequest>,
  res: Response<AuthResponse>
): Promise<void> => {
  let client;
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
      return;
    }

    client = await pgPool.connect();

    // Find user by email
    const userQuery = `
      SELECT user_id, name, email, password, role, points, level, streak
      FROM users 
      WHERE email = $1
    `;

    const result = await client.query<User>(userQuery, [email]);

    if (result.rows.length === 0) {
      res.status(400).json({
        success: false,
        message: "Incorrect email or password.",
      });
      return;
    }

    const user = result.rows[0];

    // Compare password
    if (!user.password) {
      res.status(400).json({
        success: false,
        message: "Password login not available for this account.",
      });
      return;
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      res.status(400).json({
        success: false,
        message: "Incorrect email or password.",
      });
      return;
    }

    // Update last login
    await client.query(
      "UPDATE users SET last_login_date = CURRENT_TIMESTAMP WHERE user_id = $1",
      [user.user_id]
    );

    // Generate token
    const token = generateToken(user.user_id);

    // Set HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      message: `Welcome back ${user.name}`,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        points: user.points,
        level: user.level,
        streak: user.streak,
      },
      token: token, // Add token to response for frontend
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to login user.",
    });
  } finally {
    if (client) client.release();
  }
};

// Google login
export const googleLogin = async (
  req: Request<{}, {}, GoogleLoginRequest>,
  res: Response<AuthResponse>
): Promise<void> => {
  let client;
  try {
    const { credential } = req.body;

    if (!credential) {
      res.status(400).json({
        success: false,
        message: "Google credential is required.",
      });
      return;
    }

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(400).json({
        success: false,
        message: "Invalid Google token.",
      });
      return;
    }

    const { email, name, sub: googleId } = payload;

    client = await pgPool.connect();

    // Check if user exists
    let userQuery = `
      SELECT user_id, name, email, role, points, level, streak
      FROM users 
      WHERE email = $1 OR google_id = $2
    `;

    let result = await client.query<User>(userQuery, [email, googleId]);

    let user: User;

    if (result.rows.length === 0) {
      // Create new user
      const userId = uuidv4();
      const insertQuery = `
        INSERT INTO users (user_id, name, email, google_id, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING user_id, name, email, role, points, level, streak
      `;

      const newUserResult = await client.query<User>(insertQuery, [
        userId,
        name || email,
        email,
        googleId,
        "Learner",
      ]);

      user = newUserResult.rows[0];
    } else {
      user = result.rows[0];

      // Update Google ID if not set
      if (!user.google_id) {
        await client.query(
          "UPDATE users SET google_id = $1 WHERE user_id = $2",
          [googleId, user.user_id]
        );
      }
    }

    // Update last login
    await client.query(
      "UPDATE users SET last_login_date = CURRENT_TIMESTAMP WHERE user_id = $1",
      [user.user_id]
    );

    // Generate token
    const token = generateToken(user.user_id);

    // Set HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      message: `Welcome ${user.name}!`,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        points: user.points,
        level: user.level,
        streak: user.streak,
      },
      token: token, // Add token to response for frontend
    });
  } catch (error) {
    console.error("Google login error:", error);
    res.status(500).json({
      success: false,
      message: "Google login failed.",
    });
  } finally {
    if (client) client.release();
  }
};

// Enhanced logout with Chrome compatibility
export const logout = async (
  req: Request,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const origin = req.headers.origin;
    const userAgent = req.headers["user-agent"] || "";
    const browser = req.headers["x-browser"] || "unknown";

    // Detect Chrome
    const isChrome = userAgent.includes("Chrome") && !userAgent.includes("Edg");
    const chromeVersion = req.headers["x-chrome-version"] || "unknown";
    const browserType = isChrome ? "Chrome" : browser;

    console.log(`🌐 Browser: ${browserType}, Origin: ${origin}`);

    // Check for Chrome-specific issues
    const potentialChromeIssue =
      isChrome &&
      (req.headers["x-supports-fedcm"] === "true" ||
        (typeof chromeVersion === 'string' && 
         (chromeVersion.includes("120") || chromeVersion.includes("121"))));

    if (potentialChromeIssue) {
      console.log("🔍 Potential Chrome FedCM compatibility detected");
    }

    // Clear cookie with various approaches for browser compatibility
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict" as const,
      path: "/",
    };

    // Clear with different approaches
    res.clearCookie("token", cookieOptions);
    res.cookie("token", "", { ...cookieOptions, maxAge: 0 });
    res.cookie("token", "deleted", { ...cookieOptions, expires: new Date(0) });

    // Add Chrome-specific headers
    if (isChrome) {
      res.setHeader("Clear-Site-Data", '"cookies", "storage"');
      res.setHeader("X-Chrome-Logout", "true");
    }

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Logout failed. Please try again.",
    });
  }
};

// Get user profile
export const getUserProfile = async (
  req: Request,
  res: Response<ApiResponse<User>>
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "User profile loaded successfully",
      data: {
        ...req.user,
        user_id: req.user.id,
      } as User,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user profile",
    });
  }
};

// Update user profile
export const updateProfile = async (
  req: Request<{}, {}, UpdateProfileRequest>,
  res: Response<ApiResponse<User>>
): Promise<void> => {
  let client;
  try {
    if (!req.id) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const updates = req.body;
    const allowedUpdates = [
      'name', 
      'nickname', 
      'language_preference',
      'mother_tongue',
      'primary_target_language',
      'daily_time_commitment',
      'timezone'
    ];

    // Filter only allowed fields
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (allowedUpdates.includes(key) && value !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        updateValues.push(value);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
      return;
    }

    updateValues.push(req.id); // Add user ID as last parameter

    client = await pgPool.connect();

    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE user_id = $${paramIndex}
      RETURNING user_id, name, email, role, nickname, language_preference,
                mother_tongue, primary_target_language, daily_time_commitment,
                timezone, points, level, streak
    `;

    const result = await client.query<User>(updateQuery, updateValues);

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const updatedUser = result.rows[0];

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  } finally {
    if (client) client.release();
  }
};