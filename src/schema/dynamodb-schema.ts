// ts-server/src/schema/dynamodb-schema.ts
// DynamoDB schema with updated table names: Courses, Learning, LearningProgress

export const DynamoDBSchema = {
  // ===================================
  // Table 1: Courses - Video Course Management (renamed from LMS)
  // ===================================
  Courses: {
    TableName: "Courses",
    KeySchema: {
      PartitionKey: "PK", // String
      SortKey: "SK", // String
    },
    EntityPatterns: {
      // Course Metadata
      Course: {
        PK: "COURSE#{courseId}",
        SK: "METADATA",
        Attributes: {
          // Core course attributes
          courseId: "String",
          courseTitle: "String",
          subTitle: "String",
          description: "String",
          category: "String",
          courseLevel: "String",
          coursePrice: "Number",
          courseThumbnail: "String",
          courseThumbnailPublicId: "String",
          creator: "String", // User UUID from PostgreSQL
          isPublished: "Boolean",
          createdAt: "String",
          
          // Enhanced attributes
          primaryLanguage: "String", // Default: "en"
          supportedLanguages: "List", // ["en", "hi"] for subtitles
          contentType: "String", // Default: "video_course"
          difficulty: "String", // "beginner", "intermediate", "advanced"
          estimatedDuration: "Number", // Total minutes
          tags: "List", // ["business", "communication"] for search
          isActive: "Boolean", // Default: true
          enrolledStudents: "List", // Student UUIDs for tracking
        },
      },
      
      // Course Lectures
      Lecture: {
        PK: "COURSE#{courseId}",
        SK: "LECTURE#{lectureId}",
        Attributes: {
          // Core lecture attributes
          lectureId: "String",
          lectureTitle: "String",
          videoUrl: "String",
          publicId: "String",
          isPreviewFree: "Boolean",
          createdAt: "String",
          
          // Enhanced attributes
          duration: "Number", // Seconds
          transcriptUrl: "String", // For accessibility
          subtitleUrls: "Map", // {"en": "url", "hi": "url"}
          viewCount: "Number", // Default: 0
          difficulty: "String", // Individual lecture difficulty
        },
      },
      
      // Course Progress Tracking
      Progress: {
        PK: "USER#{userId}",
        SK: "PROGRESS#{courseId}",
        Attributes: {
          // Core progress attributes
          userId: "String", // UUID from PostgreSQL users table
          courseId: "String",
          lectureProgress: "Map", // {lectureId: boolean}
          completed: "Boolean",
          lastAccessed: "String",
          
          // Enhanced progress attributes
          progressPercentage: "Number", // 0-100
          totalTimeSpent: "Number", // Total seconds
          currentLectureId: "String", // Resume point
          completedAt: "String", // ISO timestamp when course completed
          rating: "Number", // User rating 1-5
          studyStreak: "Number", // Days studying this course
        },
      },
    },
    
    GlobalSecondaryIndexes: {
      "GSI1-ByCreator": {
        PartitionKey: "GSI1PK", // USER#{userId} from PostgreSQL
        SortKey: "GSI1SK", // COURSE#{courseId}
      },
      "GSI2-ByPublishedStatus": {
        PartitionKey: "GSI2PK", // PUBLISHED#{isPublished}
        SortKey: "GSI2SK", // {category}#{price}
      },
      "GSI3-ByContentType": {
        PartitionKey: "GSI3PK", // CONTENT#{contentType}#{primaryLanguage}
        SortKey: "GSI3SK", // {difficulty}#{estimatedDuration}
      },
    },
  },

  // ===================================
  // Table 2: Learning - Language Learning Content (renamed from FreeLessons)
  // ===================================
  Learning: {
    TableName: "Learning",
    KeySchema: {
      PartitionKey: "PK", // UNIT#{unitId}
      SortKey: "SK", // LESSON#{lessonOrder}
    },
    Attributes: {
      // Core lesson attributes
      lessonId: "String", // 1.1, 1.2, 2.1
      unitId: "String", // 1, 2, 3
      lessonOrder: "Number", // 1, 2, 3
      title: "String", // Hello & Goodbye
      titleHindi: "String", // नमस्ते और अलविदा
      description: "String", // Learn basic greetings
      descriptionHindi: "String", // बुनियादी अभिवादन सीखें
      difficulty: "String", // beginner | intermediate | advanced
      estimatedTime: "Number", // Minutes
      prerequisites: "List", // [1.1, 1.2]
      vocabulary: "List", // See VocabularySchema
      exercises: "List", // See ExerciseSchema
      isActive: "String", // active | inactive
      createdAt: "String",
      updatedAt: "String",
      
      // Enhanced attributes
      supportedLanguages: "List", // ["en", "hi"] for multi-language support
      tags: "List", // ["greetings", "basic"] for search
      competencyLevel: "String", // "A1", "A2", "B1", etc. (CEFR)
      practiceType: "String", // "conversation", "grammar", "vocabulary"
      audioUrl: "String", // Native speaker audio
      imageUrl: "String", // Visual aid
      completionRate: "Number", // Success rate across all users
      averageRating: "Number", // Average user rating
    },
    
    GlobalSecondaryIndexes: {
      "ActiveLessonsIndex": {
        PartitionKey: "isActive", // active
        SortKey: "unitId",
      },
      "LanguageLevelIndex": {
        PartitionKey: "competencyLevel", // A1, A2, B1, etc.
        SortKey: "difficulty", // beginner, intermediate, advanced
      },
    },
    
    // Nested schemas
    VocabularySchema: {
      // Core vocabulary fields
      english: "String", // hello
      hindi: "String", // नमस्ते
      pronunciation: "String", // namaste
      example: "String", // Hello! How are you?
      
      // Enhanced vocabulary fields
      audioUrl: "String", // Pronunciation audio
      imageUrl: "String", // Visual representation
      difficulty: "String", // word difficulty level
      frequency: "String", // "common", "uncommon", "rare"
    },
    
    ExerciseSchema: {
      // Core exercise fields
      exerciseId: "String", // 1.1.1
      type: "String", // multiple_choice | fill_blank | translation
      question: "String", // How do you say...?
      sentence: "String", // For fill_blank
      hindiText: "String", // For translation
      options: "List", // Answer choices
      correctAnswer: "Mixed", // Index or String
      explanation: "String",
      hint: "String",
      
      // Enhanced exercise fields
      difficulty: "Number", // 1-10 scale
      timeLimit: "Number", // Seconds
      points: "Number", // Points awarded
      audioQuestion: "String", // Audio question URL
      audioOptions: "List", // Audio for each option
    },
  },

  // ===================================
  // Table 3: LearningProgress - Learning Progress Tracking (renamed from UserProgress)
  // ===================================
  LearningProgress: {
    TableName: "LearningProgress",
    KeySchema: {
      PartitionKey: "PK", // USER#{userId} from PostgreSQL
      SortKey: "SK", // LESSON#{lessonId}
    },
    Attributes: {
      // Core progress attributes
      userId: "String", // UUID from PostgreSQL users table
      lessonId: "String", // 1.1
      unitId: "String", // 1
      status: "String", // completed | in_progress | failed
      accuracy: "Number", // 85.5
      timeSpent: "Number", // Seconds
      attempts: "Number", // Number of tries
      exerciseResults: "List", // See ExerciseResultSchema
      lastAccessed: "String", // ISO timestamp
      createdAt: "String",
      
      // Enhanced progress attributes
      streak: "Number", // Daily study streak
      totalPoints: "Number", // Points earned from this lesson
      bestAccuracy: "Number", // Best accuracy achieved
      averageTime: "Number", // Average time per exercise
      hintsUsed: "Number", // Number of hints used
      completedAt: "String", // When lesson was completed
      preferredLanguage: "String", // User's interface language preference
      studyMode: "String", // "practice", "test", "review"
    },
    
    GlobalSecondaryIndexes: {
      "UserUnitIndex": {
        PartitionKey: "userId", // From PostgreSQL
        SortKey: "unitId",
      },
      "UserStatusIndex": {
        PartitionKey: "userId", // From PostgreSQL
        SortKey: "status",
      },
      "UserStreakIndex": {
        PartitionKey: "userId", // From PostgreSQL
        SortKey: "streak", // For leaderboards
      },
    },
    
    // Nested schema
    ExerciseResultSchema: {
      // Core result fields
      exerciseId: "String", // 1.1.1
      userAnswer: "Mixed", // User's answer
      correct: "Boolean", // Was it correct?
      timeSpent: "Number", // Seconds on this exercise
      attempts: "Number", // Tries for this exercise
      
      // Enhanced result fields
      hintsUsed: "Number", // Hints used for this exercise
      difficulty: "Number", // Perceived difficulty (user feedback)
      confidence: "Number", // User confidence level 1-5
      timestamp: "String", // When exercise was completed
    },
  },
};

// Access patterns for the new table structure
export const AccessPatterns = {
  // Courses table patterns
  getCourseWithLectures: "PK = COURSE#{courseId}",
  getCreatorCourses: "GSI1-ByCreator: GSI1PK = USER#{userId}",
  getPublishedCourses: "GSI2-ByPublishedStatus: GSI2PK = PUBLISHED#true",
  getCoursesByLanguageAndType: "GSI3-ByContentType: GSI3PK = CONTENT#{type}#{language}",
  
  // Learning table patterns
  getUnitLessons: "PK = UNIT#{unitId}",
  getLesson: "PK = UNIT#{unitId}, SK = LESSON#{order}",
  getActiveLessons: "ActiveLessonsIndex: isActive = active",
  getLessonsByLevel: "LanguageLevelIndex: competencyLevel = A1",
  
  // LearningProgress table patterns
  getUserProgress: "PK = USER#{userId}",
  getLessonProgress: "PK = USER#{userId}, SK = LESSON#{lessonId}",
  getUserUnitProgress: "UserUnitIndex: userId = ?, unitId = ?",
  getUserStreak: "UserStreakIndex: userId = ?, streak = ?",
  
  // Cross-database patterns (PostgreSQL integration)
  getUserPurchases: "SELECT * FROM purchases WHERE user_id = ?",
  checkPurchase: "SELECT * FROM purchases WHERE user_id = ? AND course_id = ?",
};

// Table name constants for use in application code
export const TABLE_NAMES = {
  COURSES: "Courses",
  LEARNING: "Learning", 
  LEARNING_PROGRESS: "LearningProgress",
} as const;

// Type definitions for table names
export type DynamoDBTableName = typeof TABLE_NAMES[keyof typeof TABLE_NAMES];

export default DynamoDBSchema;