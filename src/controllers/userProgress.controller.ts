// ts-server/src/controllers/userProgress.controller.ts
// User progress tracking for language learning lessons

import { Request, Response } from "express";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDocClient, TABLE_NAMES } from "../config/databaseClients.js";
import {
  UserProgress,
  ExerciseResult,
  UpdateLessonProgressRequest,
  ApiResponse,
} from "../types/index.js";

// Get user progress for all lessons
export const getUserProgressAll = async (
  req: Request,
  res: Response<ApiResponse<UserProgress[]>>
): Promise<void> => {
  try {
    const userId = req.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const { Items } = await ddbDocClient.send(
      new QueryCommand({
        TableName: TABLE_NAMES.LEARNING_PROGRESS,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
        },
      })
    );

    const progressItems = (Items || []) as UserProgress[];

    res.status(200).json({
      success: true,
      data: progressItems,
    });
  } catch (error) {
    console.error("Get user progress all error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user progress",
    });
  }
};

// Get user progress for a specific lesson
export const getUserProgressByLesson = async (
  req: Request<{ lessonId: string }>,
  res: Response<ApiResponse<UserProgress | null>>
): Promise<void> => {
  try {
    const userId = req.id;
    const { lessonId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLE_NAMES.LEARNING_PROGRESS,
        Key: {
          PK: `USER#${userId}`,
          SK: `LESSON#${lessonId}`,
        },
      })
    );

    const progress = Item as UserProgress | undefined;

    res.status(200).json({
      success: true,
      data: progress || null,
    });
  } catch (error) {
    console.error("Get user progress by lesson error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get lesson progress",
    });
  }
};

// Get user progress by unit
export const getUserProgressByUnit = async (
  req: Request<{ unitId: string }>,
  res: Response<ApiResponse<UserProgress[]>>
): Promise<void> => {
  try {
    const userId = req.id;
    const { unitId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const { Items } = await ddbDocClient.send(
      new QueryCommand({
        TableName: TABLE_NAMES.LEARNING_PROGRESS,
        IndexName: "UserUnitIndex",
        KeyConditionExpression: "userId = :userId AND unitId = :unitId",
        ExpressionAttributeValues: {
          ":userId": userId,
          ":unitId": unitId,
        },
      })
    );

    const progressItems = (Items || []) as UserProgress[];

    res.status(200).json({
      success: true,
      data: progressItems,
    });
  } catch (error) {
    console.error("Get user progress by unit error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get unit progress",
    });
  }
};

// Update lesson progress
export const updateLessonProgress = async (
  req: Request<{ lessonId: string }, {}, UpdateLessonProgressRequest>,
  res: Response<ApiResponse<UserProgress>>
): Promise<void> => {
  try {
    const userId = req.id;
    const { lessonId } = req.params;
    const { status, accuracy, timeSpent, exerciseResults } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    // Parse lesson ID to get unit (format: "1.1" -> unit "1")
    const unitId = lessonId.split(".")[0];
    if (!unitId) {
      res.status(400).json({
        success: false,
        message: "Invalid lesson ID format",
      });
      return;
    }

    // Check if progress already exists
    const { Item: existingProgress } = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLE_NAMES.LEARNING_PROGRESS,
        Key: {
          PK: `USER#${userId}`,
          SK: `LESSON#${lessonId}`,
        },
      })
    );

    const now = new Date().toISOString();
    let attempts = 1;
    let bestAccuracy = accuracy;
    let totalPoints = 0;

    // Calculate points based on accuracy and completion
    if (status === "completed") {
      totalPoints = Math.round(accuracy * 10); // Base points
      if (accuracy >= 90) totalPoints += 20; // Bonus for high accuracy
      if (accuracy === 100) totalPoints += 30; // Perfect score bonus
    }

    // If updating existing progress
    if (existingProgress) {
      const existing = existingProgress as UserProgress;
      attempts = (existing.attempts || 0) + 1;
      bestAccuracy = Math.max(existing.bestAccuracy || 0, accuracy);

      // Don't reduce total points if this attempt scored lower
      if (existing.totalPoints && existing.totalPoints > totalPoints) {
        totalPoints = existing.totalPoints;
      }
    }

    // Calculate average time per exercise
    const averageTime =
      exerciseResults.length > 0
        ? timeSpent / exerciseResults.length
        : timeSpent;

    // Count hints used
    const hintsUsed = exerciseResults.reduce(
      (sum, result) => sum + (result.hintsUsed || 0),
      0
    );

    // Update or create progress
    const progressData: UserProgress = {
      PK: `USER#${userId}`,
      SK: `LESSON#${lessonId}`,
      userId,
      lessonId,
      unitId,
      status,
      accuracy,
      timeSpent,
      attempts,
      exerciseResults,
      lastAccessed: now,
      createdAt: existingProgress?.createdAt || now,

      // Enhanced fields
      streak: existingProgress?.streak || 0,
      totalPoints,
      bestAccuracy,
      averageTime,
      hintsUsed,
      completedAt: status === "completed" ? now : existingProgress?.completedAt,
      preferredLanguage: "en", // Could be from user preferences
      studyMode: "practice", // Could be from request
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLE_NAMES.LEARNING_PROGRESS,
        Item: progressData,
      })
    );

    // Update user's streak if lesson completed
    if (status === "completed") {
      await updateUserStreak(userId);
    }

    res.status(200).json({
      success: true,
      message:
        status === "completed"
          ? "Lesson completed successfully!"
          : "Progress updated",
      data: progressData,
    });
  } catch (error) {
    console.error("Update lesson progress error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update lesson progress",
    });
  }
};

// Helper function to update user streak
async function updateUserStreak(userId: string): Promise<void> {
  try {
    // Get recent lesson completions to calculate streak
    const { Items } = await ddbDocClient.send(
      new QueryCommand({
        TableName: TABLE_NAMES.LEARNING_PROGRESS,
        KeyConditionExpression: "PK = :pk",
        FilterExpression: "#status = :completed",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
          ":completed": "completed",
        },
        ScanIndexForward: false, // Most recent first
        Limit: 30, // Check last 30 completed lessons
      })
    );

    const completedLessons = (Items || []) as UserProgress[];

    if (completedLessons.length === 0) return;

    // Calculate current streak (consecutive days with completed lessons)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentStreak = 0;
    let checkDate = new Date(today);

    for (let i = 0; i < 30; i++) {
      // Check last 30 days
      const dayStart = new Date(checkDate);
      const dayEnd = new Date(checkDate);
      dayEnd.setHours(23, 59, 59, 999);

      const hasLessonThisDay = completedLessons.some((lesson) => {
        if (!lesson.completedAt) return false;
        const lessonDate = new Date(lesson.completedAt);
        return lessonDate >= dayStart && lessonDate <= dayEnd;
      });

      if (hasLessonThisDay) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break; // Streak broken
      }
    }

    // Update streak for recent lessons
    const updatePromises = completedLessons.slice(0, 5).map((lesson) =>
      ddbDocClient.send(
        new UpdateCommand({
          TableName: TABLE_NAMES.LEARNING_PROGRESS,
          Key: { PK: lesson.PK, SK: lesson.SK },
          UpdateExpression: "SET streak = :streak",
          ExpressionAttributeValues: {
            ":streak": currentStreak,
          },
        })
      )
    );

    await Promise.all(updatePromises);
  } catch (error) {
    console.error("Update user streak error:", error);
    // Don't throw - streak update is not critical
  }
}

// Get user statistics
// Start a lesson
export const startLesson = async (
  req: Request,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const userId = req.id;
    const { lessonId } = req.params;
    const { unitId } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    if (!lessonId || !unitId) {
      res.status(400).json({
        success: false,
        message: "Lesson ID and Unit ID are required",
      });
      return;
    }

    const now = new Date().toISOString();

    // Create initial progress record
    const progressData: UserProgress = {
      PK: `USER#${userId}`,
      SK: `LESSON#${lessonId}`,
      userId,
      lessonId,
      unitId,
      status: "in_progress",
      accuracy: 0,
      timeSpent: 0,
      attempts: 0,
      exerciseResults: [],
      lastAccessed: now,
      createdAt: now,
      streak: 0,
      totalPoints: 0,
      bestAccuracy: 0,
      averageTime: 0,
      hintsUsed: 0,
      preferredLanguage: "en",
      studyMode: "practice",
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLE_NAMES.LEARNING_PROGRESS,
        Item: progressData,
      })
    );

    res.status(200).json({
      success: true,
      message: "Lesson started successfully",
      data: progressData,
    });
  } catch (error) {
    console.error("Start lesson error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start lesson",
    });
  }
};

// Complete a lesson
export const completeLesson = async (
  req: Request,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const userId = req.id;
    const { lessonId } = req.params;
    const { exerciseResults, timeSpent } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    if (!lessonId || !exerciseResults || timeSpent === undefined) {
      res.status(400).json({
        success: false,
        message: "Missing required data: exerciseResults and timeSpent",
      });
      return;
    }

    // Get existing progress
    const { Item: existingProgress } = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLE_NAMES.LEARNING_PROGRESS,
        Key: {
          PK: `USER#${userId}`,
          SK: `LESSON#${lessonId}`,
        },
      })
    );

    if (!existingProgress) {
      res.status(404).json({
        success: false,
        message: "Lesson progress not found. Please start the lesson first.",
      });
      return;
    }

    const existing = existingProgress as UserProgress;
    const now = new Date().toISOString();

    // Calculate metrics - handle both legacy 'correct' and new 'isCorrect' properties
    const correctAnswers = exerciseResults.filter((r: any) => r.isCorrect || r.correct).length;
    const totalExercises = exerciseResults.length;
    const accuracy = totalExercises > 0 ? correctAnswers / totalExercises : 0;
    const passed = accuracy >= 0.58; // 58% to pass internally
    
    // Calculate status based on accuracy (matching JavaScript legacy logic)
    const status = accuracy >= 0.58 ? "completed" : "needs_review";
    
    // Calculate points
    const basePoints = correctAnswers * 10;
    const accuracyBonus = accuracy >= 0.8 ? 20 : accuracy >= 0.6 ? 10 : 0;
    const totalPoints = basePoints + accuracyBonus;

    // Update progress
    const updatedProgress: UserProgress = {
      ...existing,
      status: status,
      accuracy,
      timeSpent,
      attempts: (existing.attempts || 0) + 1,
      exerciseResults,
      lastAccessed: now,
      completedAt: now,
      totalPoints,
      bestAccuracy: Math.max(existing.bestAccuracy || 0, accuracy),
      averageTime: timeSpent / totalExercises,
      hintsUsed: exerciseResults.reduce((sum: number, r: any) => sum + (r.hintsUsed || 0), 0),
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLE_NAMES.LEARNING_PROGRESS,
        Item: updatedProgress,
      })
    );

    // Update user's streak
    if (passed) {
      await updateUserStreak(userId);
    }

    res.status(200).json({
      success: true,
      message: passed ? "Lesson completed successfully!" : "Lesson completed. Try again to improve your score!",
      result: {
        passed,
        accuracy: Math.round(accuracy * 100),
        totalPoints,
        needsReview: !passed,
        minimumRequired: 60, // Display 60% to users
        status,
        totalExercises,
        correctAnswers,
      },
    });
  } catch (error) {
    console.error("Complete lesson error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete lesson",
    });
  }
};

export const getUserStats = async (
  req: Request,
  res: Response<
    ApiResponse<{
      totalLessons: number;
      completedLessons: number;
      totalPoints: number;
      averageAccuracy: number;
      currentStreak: number;
      totalTimeSpent: number;
      favoriteUnit: string;
    }>
  >
): Promise<void> => {
  try {
    const userId = req.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const { Items } = await ddbDocClient.send(
      new QueryCommand({
        TableName: TABLE_NAMES.LEARNING_PROGRESS,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
        },
      })
    );

    const progressItems = (Items || []) as UserProgress[];

    if (progressItems.length === 0) {
      res.status(200).json({
        success: true,
        data: {
          totalLessons: 0,
          completedLessons: 0,
          totalPoints: 0,
          averageAccuracy: 0,
          currentStreak: 0,
          totalTimeSpent: 0,
          favoriteUnit: "1",
        },
      });
      return;
    }

    const completedLessons = progressItems.filter(
      (p) => p.status === "completed"
    );
    const totalPoints = progressItems.reduce(
      (sum, p) => sum + (p.totalPoints || 0),
      0
    );
    const totalTimeSpent = progressItems.reduce(
      (sum, p) => sum + (p.timeSpent || 0),
      0
    );

    const averageAccuracy =
      completedLessons.length > 0
        ? completedLessons.reduce((sum, p) => sum + p.accuracy, 0) /
          completedLessons.length
        : 0;

    // Get current streak from most recent lesson
    const currentStreak = progressItems[0]?.streak || 0;

    // Find favorite unit (most lessons completed)
    const unitCounts: Record<string, number> = {};
    completedLessons.forEach((lesson) => {
      unitCounts[lesson.unitId] = (unitCounts[lesson.unitId] || 0) + 1;
    });

    const favoriteUnit = Object.keys(unitCounts).reduce(
      (a, b) => (unitCounts[a] > unitCounts[b] ? a : b),
      "1"
    );

    res.status(200).json({
      success: true,
      data: {
        totalLessons: progressItems.length,
        completedLessons: completedLessons.length,
        totalPoints,
        averageAccuracy: Math.round(averageAccuracy * 100) / 100,
        currentStreak,
        totalTimeSpent,
        favoriteUnit,
      },
    });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user statistics",
    });
  }
};
