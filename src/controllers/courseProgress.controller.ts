// ts-server/src/controllers/courseProgress.controller.ts
// Course progress tracking controller with TypeScript

import { Request, Response } from 'express';
import { GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient, TABLE_NAMES } from '../config/databaseClients.js';
import {
  Course,
  Lecture,
  CourseProgress,
  UpdateProgressRequest,
  ApiResponse,
} from '../types/index.js';

interface CourseProgressResponse {
  courseDetails: Course & { lectures: Lecture[] };
  progress: Record<string, boolean>;
  completed: boolean;
  progressPercentage?: number;
  totalTimeSpent?: number;
  currentLectureId?: string;
}

// Get course progress for a user
export const getCourseProgress = async (
  req: Request<{ courseId: string }>,
  res: Response<ApiResponse<CourseProgressResponse>>
): Promise<void> => {
  try {
    const { courseId } = req.params;
    const userId = req.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    // Fetch course structure and user progress in parallel
    const [courseResult, progressResult] = await Promise.all([
      ddbDocClient.send(
        new QueryCommand({
          TableName: TABLE_NAMES.LMS,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: { ":pk": `COURSE#${courseId}` },
        })
      ),
      ddbDocClient.send(
        new GetCommand({
          TableName: TABLE_NAMES.LMS,
          Key: { PK: `USER#${userId}`, SK: `PROGRESS#${courseId}` },
        })
      ),
    ]);

    // Assemble course details
    const courseItems = courseResult.Items;
    if (!courseItems || courseItems.length === 0) {
      res.status(404).json({
        success: false,
        message: "Course not found",
      });
      return;
    }

    const courseMetadata = courseItems.find((item) => item.SK === "METADATA") as Course;
    const lectures = courseItems.filter((item) =>
      item.SK.startsWith("LECTURE#")
    ) as Lecture[];

    if (!courseMetadata) {
      res.status(404).json({
        success: false,
        message: "Course metadata not found",
      });
      return;
    }

    const courseDetails = { ...courseMetadata, lectures };

    // Get progress data
    const courseProgress = progressResult.Item as CourseProgress | undefined;

    // Calculate progress percentage
    const totalLectures = lectures.length;
    let completedLectures = 0;
    const lectureProgress = courseProgress?.lectureProgress || {};

    if (totalLectures > 0) {
      completedLectures = Object.values(lectureProgress).filter(Boolean).length;
    }

    const progressPercentage = totalLectures > 0 
      ? Math.round((completedLectures / totalLectures) * 100) 
      : 0;

    const responseData: CourseProgressResponse = {
      courseDetails,
      progress: lectureProgress,
      completed: courseProgress?.completed || false,
      progressPercentage,
      totalTimeSpent: courseProgress?.totalTimeSpent || 0,
      currentLectureId: courseProgress?.currentLectureId,
    };

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Get course progress error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get course progress",
    });
  }
};

// Update lecture progress
export const updateLectureProgress = async (
  req: Request<{ courseId: string; lectureId: string }, {}, UpdateProgressRequest>,
  res: Response<ApiResponse<CourseProgress>>
): Promise<void> => {
  try {
    const { courseId, lectureId } = req.params;
    const { completed, timeSpent = 0 } = req.body;
    const userId = req.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    // Update lecture progress
    const updateCommand = new UpdateCommand({
      TableName: TABLE_NAMES.LMS,
      Key: { PK: `USER#${userId}`, SK: `PROGRESS#${courseId}` },
      UpdateExpression: `
        SET 
          lectureProgress.#lectureId = :completed,
          lastAccessed = :timestamp,
          currentLectureId = :currentLectureId,
          totalTimeSpent = if_not_exists(totalTimeSpent, :zero) + :timeSpent,
          userId = if_not_exists(userId, :userId),
          courseId = if_not_exists(courseId, :courseId)
      `,
      ExpressionAttributeNames: {
        "#lectureId": lectureId,
      },
      ExpressionAttributeValues: {
        ":completed": completed,
        ":timestamp": new Date().toISOString(),
        ":currentLectureId": lectureId,
        ":timeSpent": timeSpent,
        ":zero": 0,
        ":userId": userId,
        ":courseId": courseId,
      },
      ReturnValues: "ALL_NEW",
    });

    const { Attributes: updatedProgress } = await ddbDocClient.send(updateCommand);

    if (!updatedProgress) {
      res.status(500).json({
        success: false,
        message: "Failed to update progress",
      });
      return;
    }

    // Check if course is completed
    const lectureProgress = updatedProgress.lectureProgress || {};
    
    // Get total lectures count
    const { Items: courseItems } = await ddbDocClient.send(
      new QueryCommand({
        TableName: TABLE_NAMES.LMS,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": `COURSE#${courseId}` },
      })
    );

    const totalLectures = courseItems?.filter(item => 
      item.SK.startsWith("LECTURE#")
    ).length || 0;

    const completedLectures = Object.values(lectureProgress).filter(Boolean).length;
    const isCompleted = totalLectures > 0 && completedLectures === totalLectures;

    // Update completion status if course is completed
    if (isCompleted && !updatedProgress.completed) {
      const completeCommand = new UpdateCommand({
        TableName: TABLE_NAMES.LMS,
        Key: { PK: `USER#${userId}`, SK: `PROGRESS#${courseId}` },
        UpdateExpression: "SET completed = :completed, completedAt = :completedAt, progressPercentage = :percentage",
        ExpressionAttributeValues: {
          ":completed": true,
          ":completedAt": new Date().toISOString(),
          ":percentage": 100,
        },
        ReturnValues: "ALL_NEW",
      });

      const { Attributes: finalProgress } = await ddbDocClient.send(completeCommand);
      
      res.status(200).json({
        success: true,
        message: "Congratulations! Course completed!",
        data: finalProgress as CourseProgress,
      });
      return;
    }

    // Calculate and update progress percentage
    const progressPercentage = totalLectures > 0 
      ? Math.round((completedLectures / totalLectures) * 100) 
      : 0;

    if (progressPercentage !== updatedProgress.progressPercentage) {
      const percentageCommand = new UpdateCommand({
        TableName: TABLE_NAMES.LMS,
        Key: { PK: `USER#${userId}`, SK: `PROGRESS#${courseId}` },
        UpdateExpression: "SET progressPercentage = :percentage",
        ExpressionAttributeValues: {
          ":percentage": progressPercentage,
        },
        ReturnValues: "ALL_NEW",
      });

      const { Attributes: finalProgress } = await ddbDocClient.send(percentageCommand);
      
      res.status(200).json({
        success: true,
        message: "Progress updated successfully",
        data: finalProgress as CourseProgress,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Progress updated successfully",
      data: updatedProgress as CourseProgress,
    });
  } catch (error) {
    console.error("Update lecture progress error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update lecture progress",
    });
  }
};

// Mark course as completed
export const markCourseCompleted = async (
  req: Request<{ courseId: string }>,
  res: Response<ApiResponse<CourseProgress>>
): Promise<void> => {
  try {
    const { courseId } = req.params;
    const userId = req.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const updateCommand = new UpdateCommand({
      TableName: TABLE_NAMES.LMS,
      Key: { PK: `USER#${userId}`, SK: `PROGRESS#${courseId}` },
      UpdateExpression: `
        SET 
          completed = :completed,
          completedAt = :completedAt,
          progressPercentage = :percentage,
          lastAccessed = :timestamp
      `,
      ExpressionAttributeValues: {
        ":completed": true,
        ":completedAt": new Date().toISOString(),
        ":percentage": 100,
        ":timestamp": new Date().toISOString(),
      },
      ReturnValues: "ALL_NEW",
    });

    const { Attributes: updatedProgress } = await ddbDocClient.send(updateCommand);

    if (!updatedProgress) {
      res.status(500).json({
        success: false,
        message: "Failed to mark course as completed",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Course marked as completed successfully!",
      data: updatedProgress as CourseProgress,
    });
  } catch (error) {
    console.error("Mark course completed error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark course as completed",
    });
  }
};

// Get user's progress across all courses
export const getUserProgress = async (
  req: Request,
  res: Response<ApiResponse<CourseProgress[]>>
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
        TableName: TABLE_NAMES.LMS,
        KeyConditionExpression: "PK = :pk",
        FilterExpression: "begins_with(SK, :progressPrefix)",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
          ":progressPrefix": "PROGRESS#",
        },
      })
    );

    const progressItems = (Items || []) as CourseProgress[];

    res.status(200).json({
      success: true,
      data: progressItems,
    });
  } catch (error) {
    console.error("Get user progress error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user progress",
    });
  }
};