// ts-server/src/routes/courseProgress.route.ts
// Course progress tracking routes with TypeScript

import express from 'express';
import {
  getCourseProgress,
  updateLectureProgress,
  markCourseCompleted,
  getUserProgress,
} from '../controllers/courseProgress.controller.js';
import isAuthenticated from '../middleware/isAuthenticated.js';

const router = express.Router();

// All routes require authentication
router.use(isAuthenticated);

// Course progress routes
router.route('/:courseId').get(getCourseProgress);
router.route('/:courseId/lecture/:lectureId').put(updateLectureProgress);
router.route('/:courseId/lecture/:lectureId/view').post(updateLectureProgress); // Client expects POST to /view
router.route('/:courseId/complete').put(markCourseCompleted);
router.route('/:courseId/complete').post(markCourseCompleted); // Client expects POST
router.route('/:courseId/incomplete').post(markCourseCompleted); // Map to same controller for now

// User progress overview
router.route('/').get(getUserProgress);

export default router;