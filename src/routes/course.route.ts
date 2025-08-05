// ts-server/src/routes/course.route.ts
// Course management routes with TypeScript

import express from 'express';
import multer from 'multer';
import {
  createCourse,
  editCourse,
  getCourseById,
  getCreatorCourses,
  getPublishedCourses,
  createLecture,
  deleteCourse,
  togglePublishCourse,
} from '../controllers/course.controller.js';
import isAuthenticated from '../middleware/isAuthenticated.js';
import isInstructor from '../middleware/isInstructor.js';
import optionalAuth from '../middleware/optionalAuth.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  },
});

// Public routes
router.route('/published-courses').get(getPublishedCourses);
router.route('/search').get(getPublishedCourses); // Search uses same controller with query filters
router.route('/:courseId').get(optionalAuth, getCourseById); // Add optional auth to check purchase status

// Protected routes for instructors
router.route('/').post(isAuthenticated, isInstructor, createCourse);
router.route('/').get(isAuthenticated, isInstructor, getCreatorCourses); // Client expects GET to root
router.route('/my-courses').get(isAuthenticated, isInstructor, getCreatorCourses);

// Course management routes  
router
  .route('/:courseId')
  .put(isAuthenticated, isInstructor, upload.single('thumbnail'), editCourse) // Client expects PUT to /:courseId
  .patch(isAuthenticated, isInstructor, togglePublishCourse); // For publish/unpublish toggle

router
  .route('/:courseId/edit')
  .put(isAuthenticated, isInstructor, upload.single('thumbnail'), editCourse);

router
  .route('/:courseId/delete')
  .delete(isAuthenticated, isInstructor, deleteCourse);

// Lecture management routes
router
  .route('/:courseId/lecture')
  .post(isAuthenticated, isInstructor, upload.single('video'), createLecture)
  .get(isAuthenticated, isInstructor, getCourseById); // Client expects GET lectures

export default router;