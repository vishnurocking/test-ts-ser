// ts-server/src/routes/userProgress.route.ts
// User progress tracking for language learning routes with TypeScript

import express from 'express';
import {
  getUserProgressAll,
  getUserProgressByLesson,
  getUserProgressByUnit,
  updateLessonProgress,
  getUserStats,
} from '../controllers/userProgress.controller.js';
import isAuthenticated from '../middleware/isAuthenticated.js';

const router = express.Router();

// All routes require authentication
router.use(isAuthenticated);

// User progress routes
router.route('/').get(getUserProgressAll);
router.route('/stats').get(getUserStats);
router.route('/lesson/:lessonId').get(getUserProgressByLesson);
router.route('/lesson/:lessonId/update').put(updateLessonProgress);
router.route('/unit/:unitId').get(getUserProgressByUnit);

export default router;