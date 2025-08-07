// ts-server/src/types/models.ts
// Updated User interface with photo_url support for Google profile pictures

export interface User {
  // Core identity fields (matching PostgreSQL schema)
  user_id: string;
  email: string;
  name: string;
  nickname?: string;
  google_id?: string;
  password?: string; // Hashed password
  role: "Learner" | "Instructor";
  enrolled_courses?: string[]; // Array of course IDs

  // Gamification fields
  points: number;
  level: number;
  streak: number;
  last_login_date?: Date;
  language_preference?: string;

  // Enhanced language learning fields
  mother_tongue?: string;
  primary_target_language?: string;
  proficiency_level?: string;
  daily_time_commitment?: number;
  timezone?: string;
  is_active?: boolean;
  onboarding_completed?: boolean;

  // UPDATED: Profile picture fields
  photo_url?: string; // Database field - stores the actual URL
  photoUrl?: string; // Frontend alias - for compatibility
  avatar_url?: string; // Legacy field (if exists)

  // Timestamps (matching database schema)
  created_at: Date;
  updated_at: Date;

  // Frontend compatibility fields (optional)
  id?: string; // Alias for user_id
}

export interface Purchase {
  purchase_id: string;
  user_id: string;
  course_id: string;
  course_title?: string;
  course_thumbnail?: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed" | "refunded";

  // Razorpay fields
  payment_id?: string;
  order_id?: string;
  payment_signature?: string;

  // Enhanced fields
  payment_method?: string;
  processing_fee?: number;
  refund_amount?: number;
  content_type?: string;

  // Timestamps (matching database schema)
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
}

// DynamoDB Models
export interface Course {
  PK: string; // COURSE#{courseId}
  SK: string; // METADATA
  courseId: string;
  courseTitle: string;
  subTitle?: string;
  description?: string;
  category: string;
  courseLevel: string;
  coursePrice: number | string;
  courseThumbnail?: string;
  courseThumbnailPublicId?: string;
  creator: string; // User UUID from PostgreSQL
  isPublished: boolean | string;
  createdAt: string;

  // Enhanced fields
  primaryLanguage?: string;
  supportedLanguages?: string[];
  contentType?: string;
  difficulty?: string;
  estimatedDuration?: number;
  tags?: string[];
  isActive?: boolean;

  // GSI attributes
  GSI1PK?: string;
  GSI1SK?: string;
  GSI2PK?: string;
  GSI2SK?: string;
  GSI3PK?: string;
  GSI3SK?: string;

  // Purchase status fields (added dynamically)
  purchased?: boolean;
  isCreator?: boolean;
}

export interface Lecture {
  PK: string; // COURSE#{courseId}
  SK: string; // LECTURE#{lectureId}
  lectureId: string;
  lectureTitle: string;
  videoUrl?: string;
  publicId?: string;
  isPreviewFree: boolean;
  createdAt: string;

  // Enhanced fields
  duration?: number;
  transcriptUrl?: string;
  subtitleUrls?: Record<string, string>;
  notes?: string;
  resources?: Array<{
    title: string;
    url: string;
    type: string;
  }>;

  // Progress tracking (added dynamically)
  watched?: boolean;
  progress?: number; // Percentage watched
}

// Language Learning Models (DynamoDB)
export interface FreeLesson {
  PK: string; // UNIT#{unitId}
  SK: string; // LESSON#{order}
  lessonId: string;
  unitId: string;
  title: string;
  order: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  competencyLevel: string; // A1, A2, B1, B2, C1, C2
  estimatedTime: number; // in minutes

  // Content
  vocabulary: VocabularyItem[];
  exercises: Exercise[];

  // Metadata
  isActive: boolean;
  primaryLanguage: string;
  targetLanguage: string;
  tags?: string[];
  createdAt: string;

  // GSI attributes for queries
  ActiveLessonsIndex?: string;
  LanguageLevelIndex?: string;
}

export interface VocabularyItem {
  english: string;
  hindi: string;
  pronunciation?: string;
  audioUrl?: string;
  imageUrl?: string;
  example?: {
    english: string;
    hindi: string;
  };
}

export interface Exercise {
  exerciseId: string;
  type: "mcq" | "fillBlank" | "translation" | "listening" | "pronunciation";
  question: string;

  // MCQ fields
  options?: string[];
  correctAnswer: string | number;

  // Fill in the blank fields
  sentence?: string;
  blanks?: string[];

  // Translation fields
  englishText?: string;
  hindiText?: string;

  // Audio fields
  audioUrl?: string;

  // Metadata
  difficulty: number; // 1-10
  points: number;
  timeLimit?: number; // seconds
  hints?: string[];
  explanation?: string;
}

// User Progress Models (DynamoDB)
export interface UserProgress {
  PK: string; // USER#{userId}
  SK: string; // LESSON#{lessonId}
  userId: string;
  lessonId: string;
  unitId: string;

  // Progress data
  completed: boolean;
  accuracy: number; // percentage
  timeSpent: number; // seconds
  attempts: number;
  bestScore: number; // percentage

  // Exercise results
  exerciseResults: ExerciseResult[];

  // Timestamps
  startedAt: string;
  completedAt?: string;
  lastAttemptAt: string;

  // GSI attributes
  UserUnitIndex?: string;
  UserStreakIndex?: string;
}

export interface ExerciseResult {
  exerciseId: string;
  userAnswer: string | number;
  correct: boolean;
  timeSpent: number; // seconds
  attempts: number;
  hintsUsed: number;
  confidence?: number; // 1-5 scale
  difficulty?: number; // perceived difficulty 1-5
  timestamp: string;
}

// Course Progress Models (DynamoDB)
export interface CourseProgress {
  PK: string; // USER#{userId}
  SK: string; // COURSE#{courseId}
  userId: string;
  courseId: string;

  // Progress tracking
  lecturesWatched: string[];
  totalLectures: number;
  progressPercentage: number;
  completed: boolean;

  // Timestamps
  enrolledAt: string;
  lastAccessedAt: string;
  completedAt?: string;

  // Metadata
  timeSpent: number; // total seconds
  certificateIssued?: boolean;
  rating?: number; // 1-5 stars
  review?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

export interface AuthResponse extends ApiResponse<User> {
  user?: User;
  token?: string;
  sessionInfo?: {
    expiresAt: string;
    browserInfo: string;
  };
}

// Request Types
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role?: "Learner" | "Instructor";
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface GoogleLoginRequest {
  credential: string; // Google ID token
}

// UPDATED: Add photo_url to update profile request
export interface UpdateProfileRequest {
  name?: string;
  nickname?: string;
  language_preference?: string;
  mother_tongue?: string;
  primary_target_language?: string;
  daily_time_commitment?: number;
  timezone?: string;
  photo_url?: string; // ADDED: Allow profile picture updates
}

export interface CreateCourseRequest {
  courseTitle: string;
  category: string;
  subTitle?: string;
  description?: string;
  courseLevel?: string;
  coursePrice?: number;
}

export interface UpdateCourseRequest {
  courseTitle?: string;
  subTitle?: string;
  description?: string;
  category?: string;
  courseLevel?: string;
  coursePrice?: number;
  courseThumbnail?: string;
  isPublished?: boolean;
}

// Utility Types
export type UserRole = "Learner" | "Instructor";
export type PurchaseStatus = "pending" | "completed" | "failed" | "refunded";
export type ExerciseType =
  | "mcq"
  | "fillBlank"
  | "translation"
  | "listening"
  | "pronunciation";
export type DifficultyLevel = "beginner" | "intermediate" | "advanced";
export type CompetencyLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

// ADDED: Profile picture related types
export interface ProfilePictureSource {
  type: "google" | "custom" | "gravatar" | "default";
  url: string;
  isValid: boolean;
}

export interface ImageValidationResult {
  isValid: boolean;
  source: "google" | "custom" | "gravatar" | "default" | "none";
  url?: string;
  error?: string;
}
