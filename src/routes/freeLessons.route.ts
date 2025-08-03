// ts-server/src/routes/freeLessons.route.ts
// Free language learning lessons routes with TypeScript

import express from 'express';
import {
  getActiveLessons,
  getLessonsByUnit,
  getLessonById,
  getLessonByLessonId,
  upsertLesson,
  getLessonsByLevel,
  searchLessons,
} from '../controllers/freeLessons.controller.js';
import isAuthenticated from '../middleware/isAuthenticated.js';
import isInstructor from '../middleware/isInstructor.js';

const router = express.Router();

// Public routes (no authentication required)
router.route('/active').get(getActiveLessons);
router.route('/unit/:unitId').get(getLessonsByUnit);
router.route('/unit/:unitId/lesson/:lessonOrder').get(getLessonById);
router.route('/lesson/:lessonId').get(getLessonByLessonId);
router.route('/level/:level').get(getLessonsByLevel);
router.route('/search').get(searchLessons);

// Admin routes (instructor access for content management)
router.route('/').post(isAuthenticated, isInstructor, upsertLesson);
router.route('/upsert').put(isAuthenticated, isInstructor, upsertLesson);

export default router;