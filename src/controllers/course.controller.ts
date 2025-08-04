// ts-server/src/controllers/course.controller.ts
// Course management controller with TypeScript

import { Request, Response } from "express";
import crypto from "crypto";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  ddbDocClient,
  pgPool,
  TABLE_NAMES,
} from "../config/databaseClients.js";
import {
  uploadImageToCloudinary,
  uploadVideoToCloudinary,
} from "../utils/cloudinary.js";
import {
  Course,
  Lecture,
  CreateCourseRequest,
  UpdateCourseRequest,
  CreateLectureRequest,
  UpdateLectureRequest,
  ApiResponse,
  CourseSearchParams,
} from "../types/index.js";

// Helper function to build DynamoDB UpdateExpression
interface UpdateExpression {
  UpdateExpression: string;
  ExpressionAttributeValues: Record<string, any>;
  ExpressionAttributeNames: Record<string, string>;
}

const buildUpdateExpression = (body: Record<string, any>): UpdateExpression => {
  const expression: UpdateExpression = {
    UpdateExpression: "SET ",
    ExpressionAttributeValues: {},
    ExpressionAttributeNames: {},
  };

  let first = true;
  for (const key in body) {
    if (body[key] !== undefined) {
      if (!first) {
        expression.UpdateExpression += ", ";
      }
      const attrValue = `:${key}`;
      const attrName = `#${key}`;
      expression.UpdateExpression += `${attrName} = ${attrValue}`;
      expression.ExpressionAttributeValues[attrValue] = body[key];
      expression.ExpressionAttributeNames[attrName] = key;
      first = false;
    }
  }
  return expression;
};

// Create a new course
export const createCourse = async (
  req: Request<{}, {}, CreateCourseRequest>,
  res: Response<ApiResponse<Course>>
): Promise<void> => {
  try {
    const {
      courseTitle,
      category,
      subTitle,
      description,
      courseLevel,
      coursePrice,
    } = req.body;

    if (!courseTitle || !category) {
      res.status(400).json({
        success: false,
        message: "Course title and category are required.",
      });
      return;
    }

    if (!req.id) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const courseId = crypto.randomUUID();
    const creatorId = req.id;
    const createdAt = new Date().toISOString();

    const courseItem: Course = {
      PK: `COURSE#${courseId}`,
      SK: "METADATA",
      courseId,
      courseTitle,
      subTitle: subTitle || "",
      description: description || "",
      category,
      courseLevel: courseLevel || "Beginner",
      coursePrice: coursePrice || 0,
      creator: creatorId,
      isPublished: false,
      createdAt,
      // GSI keys for querying by creator
      GSI1PK: `USER#${creatorId}`,
      GSI1SK: `COURSE#${createdAt}`,
      // Default enhanced fields
      primaryLanguage: "en",
      supportedLanguages: ["en"],
      contentType: "video_course",
      isActive: true,
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLE_NAMES.COURSES,
        Item: courseItem,
      })
    );

    res.status(201).json({
      success: true,
      message: "Course created successfully. You can now add more details.",
      data: courseItem,
    });
  } catch (error) {
    console.error("Create course error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create course",
    });
  }
};

// Edit course details
export const editCourse = async (
  req: Request<{ courseId: string }, {}, UpdateCourseRequest>,
  res: Response<ApiResponse<Course>>
): Promise<void> => {
  try {
    const { courseId } = req.params;

    // Fetch existing course
    const { Item: existingCourse } = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLE_NAMES.COURSES,
        Key: { PK: `COURSE#${courseId}`, SK: "METADATA" },
      })
    );

    if (!existingCourse) {
      res.status(404).json({
        success: false,
        message: "Course not found!",
      });
      return;
    }

    // Check ownership
    if (existingCourse.creator !== req.id) {
      res.status(403).json({
        success: false,
        message: "Forbidden. You are not the creator.",
      });
      return;
    }

    // Handle thumbnail upload if file provided
    let updatePayload = { ...req.body };

    if (req.file) {
      try {
        const uploadResult = await uploadImageToCloudinary(
          req.file,
          "course-thumbnails"
        );
        updatePayload.courseThumbnail = uploadResult.secure_url;
        updatePayload.courseThumbnailPublicId = uploadResult.public_id;
      } catch (uploadError) {
        console.error("Thumbnail upload error:", uploadError);
        res.status(400).json({
          success: false,
          message: "Failed to upload thumbnail",
        });
        return;
      }
    }

    // Convert coursePrice to number if provided
    if (
      updatePayload.coursePrice !== undefined &&
      updatePayload.coursePrice !== null
    ) {
      updatePayload.coursePrice = parseFloat(updatePayload.coursePrice as any);
    }

    const {
      UpdateExpression,
      ExpressionAttributeValues,
      ExpressionAttributeNames,
    } = buildUpdateExpression(updatePayload);

    if (Object.keys(ExpressionAttributeValues).length === 0) {
      res.status(400).json({
        success: false,
        message: "No fields to update provided.",
      });
      return;
    }

    const updateCommand = new UpdateCommand({
      TableName: TABLE_NAMES.COURSES,
      Key: { PK: `COURSE#${courseId}`, SK: "METADATA" },
      UpdateExpression,
      ExpressionAttributeValues,
      ExpressionAttributeNames,
      ReturnValues: "ALL_NEW",
    });

    const { Attributes: updatedCourse } = await ddbDocClient.send(
      updateCommand
    );

    res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: updatedCourse as Course,
    });
  } catch (error) {
    console.error("Edit course error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update course",
    });
  }
};

// Get course by ID
export const getCourseById = async (
  req: Request<{ courseId: string }>,
  res: Response<ApiResponse<{ course: Course; lectures: Lecture[] }>>
): Promise<void> => {
  try {
    const { courseId } = req.params;

    // Get course and all its lectures
    const { Items } = await ddbDocClient.send(
      new QueryCommand({
        TableName: TABLE_NAMES.COURSES,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `COURSE#${courseId}`,
        },
      })
    );

    if (!Items || Items.length === 0) {
      res.status(404).json({
        success: false,
        message: "Course not found",
      });
      return;
    }

    // Separate course metadata and lectures
    const course = Items.find((item) => item.SK === "METADATA") as Course;
    const lectures = Items.filter((item) =>
      item.SK.startsWith("LECTURE#")
    ) as Lecture[];

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course metadata not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { course, lectures },
    });
  } catch (error) {
    console.error("Get course error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get course",
    });
  }
};

// Get courses by creator
export const getCreatorCourses = async (
  req: Request,
  res: Response<ApiResponse<Course[]>>
): Promise<void> => {
  try {
    if (!req.id) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const { Items } = await ddbDocClient.send(
      new QueryCommand({
        TableName: TABLE_NAMES.COURSES,
        IndexName: "GSI1-ByCreator",
        KeyConditionExpression: "GSI1PK = :creatorPK",
        ExpressionAttributeValues: {
          ":creatorPK": `USER#${req.id}`,
        },
      })
    );

    let courses = (Items || []) as Course[];

    // Normalize data types for consistency
    courses = courses.map((course) => ({
      ...course,
      isPublished: course.isPublished === true || course.isPublished === "true",
      coursePrice:
        typeof course.coursePrice === "string"
          ? parseFloat(course.coursePrice)
          : course.coursePrice,
    }));

    // Return response format compatible with JavaScript server
    res.status(200).json({
      success: true,
      data: courses,
      courses: courses, // Add for backward compatibility with JavaScript format
    });
  } catch (error) {
    console.error("Get creator courses error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get courses",
    });
  }
};

// Get published courses
export const getPublishedCourses = async (
  req: Request<{}, {}, {}, CourseSearchParams>,
  res: Response<ApiResponse<Course[]>>
): Promise<void> => {
  try {
    const { category, level, sortBy = "createdAt" } = req.query;

    // Handle both string and boolean isPublished values for backward compatibility
    let filterExpression =
      "(isPublished = :publishedBool OR isPublished = :publishedStr)";
    const expressionAttributeValues: Record<string, any> = {
      ":publishedBool": true,
      ":publishedStr": "true", // Handle existing string data
    };

    // Add category filter
    if (category) {
      filterExpression += " AND category = :category";
      expressionAttributeValues[":category"] = category;
    }

    // Add level filter
    if (level) {
      filterExpression += " AND courseLevel = :level";
      expressionAttributeValues[":level"] = level;
    }

    const { Items } = await ddbDocClient.send(
      new QueryCommand({
        TableName: TABLE_NAMES.COURSES,
        IndexName: "GSI2-ByPublishedStatus",
        KeyConditionExpression: "GSI2PK = :publishedPK",
        FilterExpression: filterExpression,
        ExpressionAttributeValues: {
          ":publishedPK": "PUBLISHED#true", // Use string to match existing data
          ...expressionAttributeValues,
        },
      })
    );

    let courses = (Items || []) as Course[];

    // Normalize isPublished to boolean for consistency
    courses = courses.map((course) => ({
      ...course,
      isPublished: course.isPublished === true || course.isPublished === "true",
    }));

    // Sort courses
    if (sortBy === "price") {
      courses.sort((a, b) => {
        const priceA =
          typeof a.coursePrice === "string"
            ? parseFloat(a.coursePrice)
            : a.coursePrice;
        const priceB =
          typeof b.coursePrice === "string"
            ? parseFloat(b.coursePrice)
            : b.coursePrice;
        return priceA - priceB;
      });
    } else if (sortBy === "title") {
      courses.sort((a, b) => a.courseTitle.localeCompare(b.courseTitle));
    }

    // Return response format compatible with JavaScript server
    res.status(200).json({
      success: true,
      data: courses,
      courses: courses, // Add for backward compatibility with JavaScript format
    });
  } catch (error) {
    console.error("Get published courses error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get published courses",
    });
  }
};

// Create lecture
export const createLecture = async (
  req: Request<{ courseId: string }, {}, CreateLectureRequest>,
  res: Response<ApiResponse<Lecture>>
): Promise<void> => {
  try {
    const { courseId } = req.params;
    const { lectureTitle, isPreviewFree = false } = req.body;

    if (!lectureTitle) {
      res.status(400).json({
        success: false,
        message: "Lecture title is required",
      });
      return;
    }

    // Check course ownership
    const { Item: course } = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLE_NAMES.COURSES,
        Key: { PK: `COURSE#${courseId}`, SK: "METADATA" },
      })
    );

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course not found",
      });
      return;
    }

    if (course.creator !== req.id) {
      res.status(403).json({
        success: false,
        message: "Forbidden. You are not the course creator.",
      });
      return;
    }

    const lectureId = crypto.randomUUID();
    let videoUrl = "";
    let publicId = "";
    let duration = 0;

    // Handle video upload
    if (req.file) {
      try {
        const uploadResult = await uploadVideoToCloudinary(
          req.file,
          "course-videos"
        );
        videoUrl = uploadResult.secure_url;
        publicId = uploadResult.public_id;
        duration = uploadResult.duration || 0;
      } catch (uploadError) {
        console.error("Video upload error:", uploadError);
        res.status(400).json({
          success: false,
          message: "Failed to upload video",
        });
        return;
      }
    }

    const lectureItem: Lecture = {
      PK: `COURSE#${courseId}`,
      SK: `LECTURE#${lectureId}`,
      lectureId,
      lectureTitle,
      videoUrl,
      publicId,
      isPreviewFree,
      duration,
      createdAt: new Date().toISOString(),
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLE_NAMES.COURSES,
        Item: lectureItem,
      })
    );

    res.status(201).json({
      success: true,
      message: "Lecture created successfully",
      data: lectureItem,
    });
  } catch (error) {
    console.error("Create lecture error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create lecture",
    });
  }
};

// Toggle course publish status
export const togglePublishCourse = async (
  req: Request<{ courseId: string }, {}, {}, { publish?: string }>,
  res: Response<ApiResponse<Course>>
): Promise<void> => {
  try {
    const { courseId } = req.params;
    const { publish } = req.query;

    // Get course and check ownership
    const { Item: course } = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLE_NAMES.COURSES,
        Key: { PK: `COURSE#${courseId}`, SK: "METADATA" },
      })
    );

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course not found",
      });
      return;
    }

    if (course.creator !== req.id) {
      res.status(403).json({
        success: false,
        message: "Forbidden. You are not the course creator.",
      });
      return;
    }

    // Convert publish query parameter to string for compatibility with existing data
    const isPublished = publish === "true";
    const publishedStr = isPublished ? "true" : "false"; // Store as string to match existing data

    // Update course publish status with GSI2SK for proper querying
    const updateCommand = new UpdateCommand({
      TableName: TABLE_NAMES.COURSES,
      Key: { PK: `COURSE#${courseId}`, SK: "METADATA" },
      UpdateExpression:
        "SET isPublished = :published, GSI2PK = :gsi2pk, GSI2SK = :gsi2sk",
      ExpressionAttributeValues: {
        ":published": publishedStr, // Use string for backward compatibility
        ":gsi2pk": isPublished ? "PUBLISHED#true" : "PUBLISHED#false",
        ":gsi2sk": isPublished
          ? `${course.category}#${course.coursePrice || 0}`
          : null,
      },
      ReturnValues: "ALL_NEW",
    });

    const { Attributes: updatedCourse } = await ddbDocClient.send(
      updateCommand
    );

    res.status(200).json({
      success: true,
      message: `Course ${
        isPublished ? "published" : "unpublished"
      } successfully`,
      data: updatedCourse as Course,
    });
  } catch (error) {
    console.error("Toggle publish course error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update course publish status",
    });
  }
};

// Delete course
export const deleteCourse = async (
  req: Request<{ courseId: string }>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { courseId } = req.params;

    // Get course and check ownership
    const { Item: course } = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLE_NAMES.COURSES,
        Key: { PK: `COURSE#${courseId}`, SK: "METADATA" },
      })
    );

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course not found",
      });
      return;
    }

    if (course.creator !== req.id) {
      res.status(403).json({
        success: false,
        message: "Forbidden. You are not the course creator.",
      });
      return;
    }

    // Get all course items (lectures)
    const { Items } = await ddbDocClient.send(
      new QueryCommand({
        TableName: TABLE_NAMES.COURSES,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `COURSE#${courseId}`,
        },
      })
    );

    // Delete all items
    if (Items) {
      for (const item of Items) {
        await ddbDocClient.send(
          new DeleteCommand({
            TableName: TABLE_NAMES.COURSES,
            Key: { PK: item.PK, SK: item.SK },
          })
        );
      }
    }

    res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("Delete course error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete course",
    });
  }
};
