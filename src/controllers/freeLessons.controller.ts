// ts-server/src/controllers/freeLessons.controller.ts
// Free lessons (language learning) controller with TypeScript

import { Request, Response } from 'express';
import {
  PutCommand,
  QueryCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ddbDocClient, TABLE_NAMES } from '../config/databaseClients.js';
import {
  FreeLesson,
  Exercise,
  VocabularyItem,
  LessonSearchParams,
  ApiResponse,
} from '../types/index.js';

// Exercise validation function
function validateExercise(exercise: Exercise, index: number): string[] {
  const errors: string[] = [];

  // Basic validation
  if (!exercise.type || !exercise.correctAnswer) {
    errors.push(`Exercise ${index + 1}: Missing type or correctAnswer`);
    return errors;
  }

  // Type-specific validation
  switch (exercise.type) {
    case "multiple_choice":
      if (
        !exercise.options ||
        !Array.isArray(exercise.options) ||
        exercise.options.length < 2
      ) {
        errors.push(`Exercise ${index + 1}: Missing or invalid options array`);
      }
      if (!exercise.question) {
        errors.push(`Exercise ${index + 1}: Missing question`);
      }
      // Validate correctAnswer is within options range for multiple choice
      if (exercise.options && typeof exercise.correctAnswer === 'number') {
        if (exercise.correctAnswer < 0 || exercise.correctAnswer >= exercise.options.length) {
          errors.push(`Exercise ${index + 1}: correctAnswer index out of range`);
        }
      }
      break;

    case "fill_blank":
      if (!exercise.sentence && !exercise.question) {
        errors.push(`Exercise ${index + 1}: Missing sentence or question field`);
      }
      if (exercise.options && !Array.isArray(exercise.options)) {
        errors.push(`Exercise ${index + 1}: Options must be an array if provided`);
      }
      break;

    case "translation":
      if (!exercise.hindiText) {
        errors.push(`Exercise ${index + 1}: Translation missing hindiText`);
      }
      if (!exercise.options || !Array.isArray(exercise.options)) {
        errors.push(`Exercise ${index + 1}: Translation missing options array`);
      } else {
        if (exercise.options.length < 2) {
          errors.push(`Exercise ${index + 1}: Translation should have at least 2 options`);
        }
        // Validate correctAnswer is one of the options
        if (typeof exercise.correctAnswer === 'string' && !exercise.options.includes(exercise.correctAnswer)) {
          errors.push(`Exercise ${index + 1}: Translation correctAnswer must be one of the provided options`);
        }
      }
      break;

    default:
      errors.push(`Exercise ${index + 1}: Unknown exercise type: ${exercise.type}`);
  }

  return errors;
}

// Vocabulary validation function
function validateVocabulary(vocabulary: VocabularyItem[], lessonId: string): string[] {
  const errors: string[] = [];

  if (!Array.isArray(vocabulary)) {
    errors.push(`Lesson ${lessonId}: Vocabulary must be an array`);
    return errors;
  }

  vocabulary.forEach((item, index) => {
    if (!item.english || !item.hindi) {
      errors.push(`Lesson ${lessonId}, Vocabulary ${index + 1}: Missing english or hindi text`);
    }
  });

  return errors;
}

// Get all active lessons
export const getActiveLessons = async (
  req: Request<{}, {}, {}, LessonSearchParams>,
  res: Response<ApiResponse<FreeLesson[]>>
): Promise<void> => {
  try {
    const { unitId, difficulty, competencyLevel, practiceType } = req.query;

    let queryParams: any = {
      TableName: TABLE_NAMES.FREE_LESSONS,
      IndexName: "ActiveLessonsIndex",
      KeyConditionExpression: "isActive = :active",
      ExpressionAttributeValues: {
        ":active": "active",
      },
    };

    // Add filters
    let filterExpression = "";
    if (unitId) {
      filterExpression += "unitId = :unitId";
      queryParams.ExpressionAttributeValues[":unitId"] = unitId;
    }
    if (difficulty) {
      if (filterExpression) filterExpression += " AND ";
      filterExpression += "difficulty = :difficulty";
      queryParams.ExpressionAttributeValues[":difficulty"] = difficulty;
    }
    if (competencyLevel) {
      if (filterExpression) filterExpression += " AND ";
      filterExpression += "competencyLevel = :competencyLevel";
      queryParams.ExpressionAttributeValues[":competencyLevel"] = competencyLevel;
    }
    if (practiceType) {
      if (filterExpression) filterExpression += " AND ";
      filterExpression += "practiceType = :practiceType";
      queryParams.ExpressionAttributeValues[":practiceType"] = practiceType;
    }

    if (filterExpression) {
      queryParams.FilterExpression = filterExpression;
    }

    const { Items } = await ddbDocClient.send(new QueryCommand(queryParams));
    const lessons = (Items || []) as FreeLesson[];

    // Sort by unitId and lessonOrder
    lessons.sort((a, b) => {
      if (a.unitId !== b.unitId) {
        return parseInt(a.unitId) - parseInt(b.unitId);
      }
      return a.lessonOrder - b.lessonOrder;
    });

    res.status(200).json({
      success: true,
      data: lessons,
    });
  } catch (error) {
    console.error("Get active lessons error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get lessons",
    });
  }
};

// Get lessons by unit
export const getLessonsByUnit = async (
  req: Request<{ unitId: string }>,
  res: Response<ApiResponse<FreeLesson[]>>
): Promise<void> => {
  try {
    const { unitId } = req.params;

    const { Items } = await ddbDocClient.send(
      new QueryCommand({
        TableName: TABLE_NAMES.FREE_LESSONS,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `UNIT#${unitId}`,
        },
      })
    );

    const lessons = (Items || []) as FreeLesson[];

    // Sort by lesson order
    lessons.sort((a, b) => a.lessonOrder - b.lessonOrder);

    res.status(200).json({
      success: true,
      data: lessons,
    });
  } catch (error) {
    console.error("Get lessons by unit error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get lessons for unit",
    });
  }
};

// Get specific lesson
export const getLessonById = async (
  req: Request<{ unitId: string; lessonOrder: string }>,
  res: Response<ApiResponse<FreeLesson>>
): Promise<void> => {
  try {
    const { unitId, lessonOrder } = req.params;

    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLE_NAMES.FREE_LESSONS,
        Key: {
          PK: `UNIT#${unitId}`,
          SK: `LESSON#${lessonOrder}`,
        },
      })
    );

    if (!Item) {
      res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
      return;
    }

    const lesson = Item as FreeLesson;

    res.status(200).json({
      success: true,
      data: lesson,
    });
  } catch (error) {
    console.error("Get lesson by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get lesson",
    });
  }
};

// Get lesson by lesson ID (alternative endpoint)
export const getLessonByLessonId = async (
  req: Request<{ lessonId: string }>,
  res: Response<ApiResponse<FreeLesson>>
): Promise<void> => {
  try {
    const { lessonId } = req.params;

    // Parse lesson ID to get unit and order (format: "1.1", "2.3", etc.)
    const [unitId, lessonOrder] = lessonId.split('.');
    
    if (!unitId || !lessonOrder) {
      res.status(400).json({
        success: false,
        message: "Invalid lesson ID format. Expected format: 'unit.lesson' (e.g., '1.1')",
      });
      return;
    }

    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLE_NAMES.FREE_LESSONS,
        Key: {
          PK: `UNIT#${unitId}`,
          SK: `LESSON#${lessonOrder}`,
        },
      })
    );

    if (!Item) {
      res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
      return;
    }

    const lesson = Item as FreeLesson;

    res.status(200).json({
      success: true,
      data: lesson,
    });
  } catch (error) {
    console.error("Get lesson by lesson ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get lesson",
    });
  }
};

// Create or update lesson (admin function)
export const upsertLesson = async (
  req: Request<{}, {}, Omit<FreeLesson, 'PK' | 'SK' | 'createdAt' | 'updatedAt'>>,
  res: Response<ApiResponse<FreeLesson>>
): Promise<void> => {
  try {
    const lessonData = req.body;

    // Validate required fields
    if (!lessonData.lessonId || !lessonData.unitId || !lessonData.title) {
      res.status(400).json({
        success: false,
        message: "Missing required fields: lessonId, unitId, title",
      });
      return;
    }

    // Validate exercises if provided
    if (lessonData.exercises) {
      const exerciseErrors: string[] = [];
      lessonData.exercises.forEach((exercise, index) => {
        exerciseErrors.push(...validateExercise(exercise, index));
      });

      if (exerciseErrors.length > 0) {
        res.status(400).json({
          success: false,
          message: "Exercise validation failed",
          error: exerciseErrors.join("; "),
        });
        return;
      }
    }

    // Validate vocabulary if provided
    if (lessonData.vocabulary) {
      const vocabularyErrors = validateVocabulary(lessonData.vocabulary, lessonData.lessonId);
      
      if (vocabularyErrors.length > 0) {
        res.status(400).json({
          success: false,
          message: "Vocabulary validation failed",
          error: vocabularyErrors.join("; "),
        });
        return;
      }
    }

    const now = new Date().toISOString();
    const lesson: FreeLesson = {
      PK: `UNIT#${lessonData.unitId}`,
      SK: `LESSON#${lessonData.lessonOrder}`,
      ...lessonData,
      createdAt: lessonData.createdAt || now,
      updatedAt: now,
      difficulty: lessonData.difficulty || 'beginner',
      estimatedTime: lessonData.estimatedTime || 15,
      isActive: lessonData.isActive || 'active',
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLE_NAMES.FREE_LESSONS,
        Item: lesson,
      })
    );

    res.status(200).json({
      success: true,
      message: "Lesson saved successfully",
      data: lesson,
    });
  } catch (error) {
    console.error("Upsert lesson error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save lesson",
    });
  }
};

// Get lessons by difficulty level
export const getLessonsByLevel = async (
  req: Request<{ level: string }>,
  res: Response<ApiResponse<FreeLesson[]>>
): Promise<void> => {
  try {
    const { level } = req.params;

    const { Items } = await ddbDocClient.send(
      new ScanCommand({
        TableName: TABLE_NAMES.FREE_LESSONS,
        FilterExpression: "difficulty = :level AND isActive = :active",
        ExpressionAttributeValues: {
          ":level": level,
          ":active": "active",
        },
      })
    );

    const lessons = (Items || []) as FreeLesson[];

    // Sort by unit and lesson order
    lessons.sort((a, b) => {
      if (a.unitId !== b.unitId) {
        return parseInt(a.unitId) - parseInt(b.unitId);
      }
      return a.lessonOrder - b.lessonOrder;
    });

    res.status(200).json({
      success: true,
      data: lessons,
    });
  } catch (error) {
    console.error("Get lessons by level error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get lessons by level",
    });
  }
};

// Search lessons
export const searchLessons = async (
  req: Request<{}, {}, {}, { query?: string; tags?: string }>,
  res: Response<ApiResponse<FreeLesson[]>>
): Promise<void> => {
  try {
    const { query: searchQuery, tags } = req.query;

    let filterExpression = "isActive = :active";
    const expressionAttributeValues: Record<string, any> = {
      ":active": "active",
    };

    if (searchQuery) {
      filterExpression += " AND (contains(title, :query) OR contains(description, :query))";
      expressionAttributeValues[":query"] = searchQuery;
    }

    if (tags) {
      const tagArray = tags.split(',');
      tagArray.forEach((tag, index) => {
        filterExpression += ` AND contains(tags, :tag${index})`;
        expressionAttributeValues[`:tag${index}`] = tag.trim();
      });
    }

    const { Items } = await ddbDocClient.send(
      new ScanCommand({
        TableName: TABLE_NAMES.FREE_LESSONS,
        FilterExpression: filterExpression,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );

    const lessons = (Items || []) as FreeLesson[];

    res.status(200).json({
      success: true,
      data: lessons,
    });
  } catch (error) {
    console.error("Search lessons error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search lessons",
    });
  }
};