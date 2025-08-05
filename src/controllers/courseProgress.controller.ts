// ts-server/src/controllers/courseProgress.controller.ts
// Course progress tracking controller with TypeScript

import { Request, Response } from "express";
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient, TABLE_NAMES } from "../config/databaseClients.js";
import {
  Course,
  Lecture,
  CourseProgress,
  UpdateProgressRequest,
  ApiResponse,
} from "../types/index.js";

interface CourseProgressResponse {
  courseDetails: Course & { lectures: Lecture[] };
  progress: Record<string, boolean>;
  completed: boolean;
  progressPercentage?: number;
  totalTimeSpent?: number;
  currentLectureId?: string;
}

// Get course progress for a user with flat record structure
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
      // Get course details
      ddbDocClient.send(
        new QueryCommand({
          TableName: TABLE_NAMES.COURSES,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: { ":pk": `COURSE#${courseId}` },
        })
      ),
      // Get user's lecture progress for this course
      ddbDocClient.send(
        new QueryCommand({
          TableName: TABLE_NAMES.COURSES,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
          ExpressionAttributeValues: {
            ":pk": `USER#${userId}#COURSE#${courseId}`,
            ":sk": "LECTURE#"
          }
        })
      )
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

    const courseMetadata = courseItems.find(
      (item) => item.SK === "METADATA"
    ) as Course;
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

    // Convert flat progress records to progress map
    const progressItems = progressResult.Items || [];
    const progress: Record<string, boolean> = {};
    let totalTimeSpent = 0;
    let currentLectureId: string | undefined;

    progressItems.forEach(item => {
      progress[item.lectureId] = item.completed;
      totalTimeSpent += item.timeSpent || 0;
      if (item.completed) {
        currentLectureId = item.lectureId; // Last completed lecture
      }
    });

    // Calculate progress percentage
    const totalLectures = lectures.length;
    const completedLectures = Object.values(progress).filter(Boolean).length;
    const progressPercentage =
      totalLectures > 0
        ? Math.round((completedLectures / totalLectures) * 100)
        : 0;

    const responseData: CourseProgressResponse = {
      courseDetails,
      progress,
      completed: totalLectures > 0 && completedLectures === totalLectures,
      progressPercentage,
      totalTimeSpent,
      currentLectureId,
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

// Update lecture progress with flat record structure
export const updateLectureProgress = async (
  req: Request<
    { courseId: string; lectureId: string },
    {},
    UpdateProgressRequest
  >,
  res: Response<ApiResponse<any>>
): Promise<void> => {
  try {
    const { courseId, lectureId } = req.params;
    const { completed = true, timeSpent = 0 } = req.body;
    const userId = req.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    // Simple flat record - no nested maps, no path overlap issues
    await ddbDocClient.send(new PutCommand({
      TableName: TABLE_NAMES.COURSES,
      Item: {
        PK: `USER#${userId}#COURSE#${courseId}`,
        SK: `LECTURE#${lectureId}`,
        userId,
        courseId,
        lectureId,
        completed,
        viewedAt: new Date().toISOString(),
        timeSpent
      }
    }));

    res.status(200).json({
      success: true,
      message: "Progress updated successfully",
      data: {
        userId,
        courseId,
        lectureId,
        completed,
        viewedAt: new Date().toISOString(),
        timeSpent
      }
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
      TableName: TABLE_NAMES.COURSES,
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

    const { Attributes: updatedProgress } = await ddbDocClient.send(
      updateCommand
    );

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
        TableName: TABLE_NAMES.COURSES,
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
