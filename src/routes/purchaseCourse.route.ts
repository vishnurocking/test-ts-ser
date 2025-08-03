// ts-server/src/routes/purchaseCourse.route.ts
// Course purchase routes with TypeScript

import express from 'express';
import {
  createRazorpayOrder,
  verifyPayment,
  getMyCourses,
  checkPurchaseStatus,
  getAllPurchases,
} from '../controllers/coursePurchase.controller.js';
import isAuthenticated from '../middleware/isAuthenticated.js';
import isInstructor from '../middleware/isInstructor.js';

const router = express.Router();

// Protected routes (user must be authenticated)
router.route('/create-order').post(isAuthenticated, createRazorpayOrder);
router.route('/verify-payment').post(isAuthenticated, verifyPayment);
router.route('/my-courses').get(isAuthenticated, getMyCourses);
router.route('/check/:courseId').get(isAuthenticated, checkPurchaseStatus);

// Admin routes (instructor access)
router.route('/all').get(isAuthenticated, isInstructor, getAllPurchases);

export default router;