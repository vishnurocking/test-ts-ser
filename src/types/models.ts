// ts-server/src/types/models.ts
// Database model types for PostgreSQL and DynamoDB

// PostgreSQL Models

export interface User {
  user_id: string;
  email: string;
  name: string;
  nickname?: string;
  google_id?: string;
  password?: string; // Hashed password
  role: 'Learner' | 'Instructor';
  enrolled_courses?: string[]; // Array of course IDs
  
  // Gamification fields
  points: number;
  level: number;
  streak: number;
  last_login_date?: Date;
  language_preference?: string;
  
  // Enhanced fields (optional)
  mother_tongue?: string;
  primary_target_language?: string;
  proficiency_level?: string;
  daily_time_commitment?: number;
  timezone?: string;
  is_active?: boolean;
  onboarding_completed?: boolean;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

export interface Purchase {
  purchase_id: string;
  user_id: string;
  course_id: string;
  course_title?: string;
  course_thumbnail?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  
  // Razorpay fields
  payment_id?: string;
  order_id?: string;
  payment_signature?: string;
  
  // Enhanced fields (optional)
  payment_method?: string;
  processing_fee?: number;
  refund_amount?: number;
  content_type?: string;
  
  // Timestamps
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
  coursePrice: number | string; // Handle both number and string for backward compatibility
  courseThumbnail?: string;
  courseThumbnailPublicId?: string;
  creator: string; // User UUID from PostgreSQL
  isPublished: boolean | string; // Handle both boolean and string for backward compatibility
  createdAt: string;
  
  // Enhanced fields (optional)
  primaryLanguage?: string;
  supportedLanguages?: string[];
  contentType?: string;
  difficulty?: string;
  estimatedDuration?: number;
  tags?: string[];
  isActive?: boolean;
  
  // GSI attributes
  GSI1PK?: string; // USER#{userId}
  GSI1SK?: string; // COURSE#{courseId}
  GSI2PK?: string; // PUBLISHED#{isPublished}
  GSI2SK?: string; // {category}#{price}
  GSI3PK?: string; // CONTENT#{contentType}#{primaryLanguage}
  GSI3SK?: string; // {difficulty}#{estimatedDuration}
  
  // Purchase status fields (added dynamically by getCourseById)
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
  
  // Enhanced fields (optional)
  duration?: number;
  transcriptUrl?: string;
  subtitleUrls?: Record<string, string>;
  viewCount?: number;
  difficulty?: string;
}

export interface CourseProgress {
  PK: string; // USER#{userId}
  SK: string; // PROGRESS#{courseId}
  userId: string;
  courseId: string;
  lectureProgress: Record<string, boolean>;
  completed: boolean;
  lastAccessed: string;
  
  // Enhanced fields (optional)
  progressPercentage?: number;
  totalTimeSpent?: number;
  currentLectureId?: string;
  completedAt?: string;
  rating?: number;
  studyStreak?: number;
}

export interface FreeLesson {
  PK: string; // UNIT#{unitId}
  SK: string; // LESSON#{lessonOrder}
  lessonId: string;
  unitId: string;
  lessonOrder: number;
  title: string;
  titleHindi?: string;
  description?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number;
  prerequisites?: string[];
  vocabulary?: VocabularyItem[];
  exercises?: Exercise[];
  isActive: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  
  // Enhanced fields (optional)
  supportedLanguages?: string[];
  tags?: string[];
  competencyLevel?: string;
  practiceType?: string;
  audioUrl?: string;
  imageUrl?: string;
  completionRate?: number;
  averageRating?: number;
}

export interface VocabularyItem {
  english: string;
  hindi: string;
  pronunciation?: string;
  example?: string;
  
  // Enhanced fields (optional)
  audioUrl?: string;
  imageUrl?: string;
  difficulty?: string;
  frequency?: string;
}

export interface Exercise {
  exerciseId: string;
  type: 'multiple_choice' | 'fill_blank' | 'translation';
  question: string;
  sentence?: string;
  hindiText?: string;
  options?: string[];
  correctAnswer: string | number;
  explanation?: string;
  hint?: string;
  
  // Enhanced fields (optional)
  difficulty?: number;
  timeLimit?: number;
  points?: number;
  audioQuestion?: string;
  audioOptions?: string[];
}

export interface UserProgress {
  PK: string; // USER#{userId}
  SK: string; // LESSON#{lessonId}
  userId: string;
  lessonId: string;
  unitId: string;
  status: 'completed' | 'in_progress' | 'failed';
  accuracy: number;
  timeSpent: number;
  attempts: number;
  exerciseResults: ExerciseResult[];
  lastAccessed: string;
  createdAt: string;
  
  // Enhanced fields (optional)
  streak?: number;
  totalPoints?: number;
  bestAccuracy?: number;
  averageTime?: number;
  hintsUsed?: number;
  completedAt?: string;
  preferredLanguage?: string;
  studyMode?: string;
}

export interface ExerciseResult {
  exerciseId: string;
  userAnswer: string | number;
  correct: boolean;
  timeSpent: number;
  attempts: number;
  
  // Enhanced fields (optional)
  hintsUsed?: number;
  difficulty?: number;
  confidence?: number;
  timestamp?: string;
}