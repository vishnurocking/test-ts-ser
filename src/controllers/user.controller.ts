// ts-server/src/controllers/user.controller.ts
// Updated with Google profile picture URL storage

import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/generateToken.js";
import { pgPool } from "../config/databaseClients.js";
import { User, AuthResponse, ApiResponse } from "../types/index.js";
import type {
  RegisterRequest,
  LoginRequest,
  UpdateProfileRequest,
  GoogleLoginRequest,
} from "../types/index.js";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Get user profile - UPDATED to include photo_url
export const getUserProfile = async (
  req: Request,
  res: Response<{ success: boolean; message: string; data?: User }>
): Promise<void> => {
  let client;
  try {
    console.log("🔍 Profile request - Auth check:");
    console.log("- req.user exists:", !!req.user);
    console.log("- req.id exists:", !!req.id);
    console.log("- User ID:", req.id);

    // Check authentication
    if (!req.user || !req.id) {
      console.log("❌ User not authenticated");
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    client = await pgPool.connect();

    // Fetch fresh user data from database - ADDED photo_url
    const userQuery = `
      SELECT 
        user_id, name, email, role, nickname, photo_url,
        language_preference, mother_tongue, primary_target_language,
        daily_time_commitment, timezone, points, level, streak,
        created_at, updated_at, last_login_date
      FROM users 
      WHERE user_id = $1
    `;

    const result = await client.query<User>(userQuery, [req.id]);

    if (result.rows.length === 0) {
      console.log("❌ User not found in database");
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const user = result.rows[0];

    // Format user data for frontend - ADDED photoUrl mapping
    const userData: User = {
      id: user.user_id,
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      nickname: user.nickname,
      language_preference: user.language_preference,
      mother_tongue: user.mother_tongue,
      primary_target_language: user.primary_target_language,
      daily_time_commitment: user.daily_time_commitment,
      timezone: user.timezone,
      points: user.points || 0,
      level: user.level || 1,
      streak: user.streak || 0,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login_date: user.last_login_date,
      // ADDED: Include photo URL for frontend
      photo_url: user.photo_url,
      photoUrl: user.photo_url, // Frontend alias
    };

    console.log("✅ Profile loaded successfully for user:", user.user_id);
    console.log("📸 Photo URL:", user.photo_url ? "Present" : "None");

    res.status(200).json({
      success: true,
      message: "User profile loaded successfully",
      data: userData,
    });
  } catch (error) {
    console.error("❌ Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user profile",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Google OAuth login - UPDATED to store profile picture
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

    // UPDATED: Extract picture URL from Google payload
    const { email, name, picture, sub: googleId } = payload;

    console.log("🔍 Google OAuth payload:");
    console.log("- Email:", email);
    console.log("- Name:", name);
    console.log("- Picture URL:", picture);
    console.log("- Google ID:", googleId);

    client = await pgPool.connect();

    // Check if user exists
    let userQuery = `
      SELECT user_id, name, email, role, points, level, streak, photo_url
      FROM users 
      WHERE email = $1
    `;

    let result = await client.query<User>(userQuery, [email]);

    let user: User;

    if (result.rows.length === 0) {
      // Create new user - UPDATED to include photo_url
      console.log("👤 Creating new user with Google profile picture");
      const insertQuery = `
        INSERT INTO users (name, email, google_id, role, points, level, streak, photo_url)
        VALUES ($1, $2, $3, 'Learner', 0, 1, 0, $4)
        RETURNING user_id, name, email, role, points, level, streak, photo_url
      `;

      const insertResult = await client.query<User>(insertQuery, [
        name || email.split("@")[0], // Use name or email prefix
        email,
        googleId,
        picture, // ADDED: Store Google profile picture URL
      ]);

      user = insertResult.rows[0];
      console.log("✅ New user created with photo URL:", picture);
    } else {
      user = result.rows[0];

      // Update existing user - UPDATED to update photo_url and google_id
      console.log(
        "🔄 Updating existing user with latest Google profile picture"
      );
      await client.query(
        `UPDATE users 
         SET photo_url = $1, google_id = $2, last_login_date = CURRENT_TIMESTAMP 
         WHERE user_id = $3`,
        [picture, googleId, user.user_id]
      );

      // Update user object with new photo URL
      user.photo_url = picture;
      console.log("✅ Existing user updated with photo URL:", picture);
    }

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
      message: `Welcome ${user.name}`,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        points: user.points,
        level: user.level,
        streak: user.streak,
        // ADDED: Include photo URL in response
        photoUrl: user.photo_url,
        photo_url: user.photo_url,
      },
      token: token,
    });
  } catch (error) {
    console.error("Google login error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to authenticate with Google. Please try again.",
    });
  } finally {
    if (client) client.release();
  }
};

// Update user profile - ENHANCED to include photo_url updates
export const updateProfile = async (
  req: Request<{}, {}, UpdateProfileRequest>,
  res: Response<{ success: boolean; message: string; data?: User }>
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
      "name",
      "nickname",
      "language_preference",
      "mother_tongue",
      "primary_target_language",
      "daily_time_commitment",
      "timezone",
      "photo_url", // ADDED: Allow photo URL updates
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

    // UPDATED: Include photo_url in RETURNING clause
    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $${paramIndex}
      RETURNING 
        user_id, name, email, role, nickname, photo_url,
        language_preference, mother_tongue, primary_target_language,
        daily_time_commitment, timezone, points, level, streak,
        created_at, updated_at, last_login_date
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

    // Format response data - ADDED photo URL mapping
    const userData: User = {
      id: updatedUser.user_id,
      user_id: updatedUser.user_id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      nickname: updatedUser.nickname,
      language_preference: updatedUser.language_preference,
      mother_tongue: updatedUser.mother_tongue,
      primary_target_language: updatedUser.primary_target_language,
      daily_time_commitment: updatedUser.daily_time_commitment,
      timezone: updatedUser.timezone,
      points: updatedUser.points || 0,
      level: updatedUser.level || 1,
      streak: updatedUser.streak || 0,
      created_at: updatedUser.created_at,
      updated_at: updatedUser.updated_at,
      last_login_date: updatedUser.last_login_date,
      // ADDED: Include photo URL
      photo_url: updatedUser.photo_url,
      photoUrl: updatedUser.photo_url,
    };

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: userData,
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

// User registration - UPDATED to support photo_url
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
    const existingUser = await client.query(
      "SELECT user_id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      res.status(400).json({
        success: false,
        message: "User already exists with this email.",
      });
      return;
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user - ready for photo_url (will be NULL for email registrations)
    const insertQuery = `
      INSERT INTO users (name, email, password, role, points, level, streak)
      VALUES ($1, $2, $3, 'Learner', 0, 1, 0)
      RETURNING user_id, name, email, role, points, level, streak, photo_url, created_at
    `;

    const result = await client.query<User>(insertQuery, [
      name,
      email,
      hashedPassword,
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
      token: token,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        points: user.points,
        level: user.level,
        streak: user.streak,
        photoUrl: user.photo_url, // Will be null for email registrations
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

// User login - UPDATED to include photo_url in response
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

    // Find user by email - ADDED photo_url to query
    const userQuery = `
      SELECT user_id, name, email, password, role, points, level, streak, photo_url
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
        photoUrl: user.photo_url, // ADDED: Include photo URL
      },
      token: token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to login user. Please try again.",
    });
  } finally {
    if (client) client.release();
  }
};

// User logout
export const logout = async (
  req: Request,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    // Clear HTTP-only cookie
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to logout. Please try again.",
    });
  }
};
