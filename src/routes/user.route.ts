// ts-server/src/routes/user.route.ts
// User routes with TypeScript

import express from 'express';
import {
  getUserProfile,
  login,
  logout,
  register,
  updateProfile,
  googleLogin,
} from '../controllers/user.controller.js';
import isAuthenticated from '../middleware/isAuthenticated.js';

const router = express.Router();

// Google OAuth routes
router.route('/google-login').post(googleLogin);

// Auth routes
router.route('/register').post(register);
router.route('/login').post(login);
router.route('/logout').get(logout);

// Protected routes
router.route('/profile').get(isAuthenticated, getUserProfile);
router.route('/profile/update').put(isAuthenticated, updateProfile);

export default router;