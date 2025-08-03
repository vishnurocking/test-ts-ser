// ts-server/src/types/api.ts
// API request and response types

// Generic API Response
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  courses?: T; // Add for backward compatibility with JavaScript server format
  error?: string;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  totalItems: number;
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Authentication
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface GoogleLoginRequest {
  credential: string; // Google OAuth token
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    points?: number;
    level?: number;
    streak?: number;
  };
}

export interface UpdateProfileRequest {
  name?: string;
  nickname?: string;
  language_preference?: string;
  mother_tongue?: string;
  primary_target_language?: string;
  daily_time_commitment?: number;
  timezone?: string;
}

// Course Management
export interface CreateCourseRequest {
  courseTitle: string;
  subTitle?: string;
  description?: string;
  category: string;
  courseLevel: string;
  coursePrice: number;
  primaryLanguage?: string;
  supportedLanguages?: string[];
  tags?: string[];
}

export interface UpdateCourseRequest extends Partial<CreateCourseRequest> {
  isPublished?: boolean;
  courseThumbnail?: string;
  courseThumbnailPublicId?: string;
}

export interface CreateLectureRequest {
  lectureTitle: string;
  videoFile?: Express.Multer.File;
  isPreviewFree?: boolean;
  duration?: number;
}

export interface UpdateLectureRequest {
  lectureTitle?: string;
  isPreviewFree?: boolean;
  videoFile?: Express.Multer.File;
}

// Purchase
export interface CreatePurchaseRequest {
  courseId: string;
  amount: number;
  currency?: string;
}

export interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  courseId: string;
}

// Progress Tracking
export interface UpdateProgressRequest {
  lectureId: string;
  completed: boolean;
  timeSpent?: number;
}

export interface UpdateLessonProgressRequest {
  lessonId: string;
  status: 'completed' | 'in_progress' | 'failed';
  accuracy: number;
  timeSpent: number;
  exerciseResults: Array<{
    exerciseId: string;
    userAnswer: string | number;
    correct: boolean;
    timeSpent: number;
    attempts: number;
    hintsUsed?: number;
  }>;
}

// Search and Filters
export interface CourseSearchParams {
  query?: string;
  category?: string;
  level?: string;
  minPrice?: number;
  maxPrice?: number;
  language?: string;
  isPublished?: boolean;
  sortBy?: 'price' | 'rating' | 'students' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface LessonSearchParams {
  unitId?: string;
  difficulty?: string;
  isActive?: boolean;
  competencyLevel?: string;
  practiceType?: string;
}

// File Upload
export interface FileUploadResponse {
  success: boolean;
  data?: {
    public_id: string;
    secure_url: string;
    duration?: number;
    format?: string;
    resource_type?: string;
  };
  error?: string;
}

// Error Response
export interface ErrorResponse {
  success: false;
  message: string;
  error?: string;
  stack?: string; // Only in development
  timestamp?: string;
  path?: string;
}

// Browser-specific headers (Chrome compatibility)
export interface BrowserHeaders {
  'x-browser'?: string;
  'x-chrome-version'?: string;
  'x-supports-fedcm'?: string;
  'x-request-timestamp'?: string;
  'x-browser-info'?: string;
  'x-client-version'?: string;
}